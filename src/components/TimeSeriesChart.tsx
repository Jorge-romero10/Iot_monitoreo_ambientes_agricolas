import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ReferenceArea,
  ReferenceLine,
  Legend,
} from "recharts";

export type RangeKey = "24h" | "7d" | "30d" | "90d";
export type Point = { ts: number; [k: string]: number | null };

type SeriesCfg = {
  key: string;     // ej. "airTemp"
  name: string;    // etiqueta
  stroke?: string;
  unit?: string;   // "°C", "%", "ppm"
  yAxisId?: string; // 'y1' (default) o 'y2'
};

type Band = { min: number; max: number; yAxisId?: string };

type Props = {
  data: Point[];
  series: SeriesCfg[];
  height?: number;
  rangeKey: RangeKey;
  onRangeChange?: (r: RangeKey) => void;
  optimalBands?: Band[];
  syncId?: string;
  yDefaults?: Record<string, { min: number; max: number }>;
};

const timeRanges: Record<RangeKey, number> = {
  "24h": 24 * 3600 * 1000,
  "7d": 7 * 24 * 3600 * 1000,
  "30d": 30 * 24 * 3600 * 1000,
  "90d": 90 * 24 * 3600 * 1000,
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function safeNumber(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// Downsample robusto (tolerante a null/NaN)
function downsample(points: Point[], target = 900): Point[] {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (points.length <= target) return points;
  const bucket = Math.max(1, Math.ceil(points.length / target));
  const out: Point[] = [];
  for (let i = 0; i < points.length; i += bucket) {
    const slice = points.slice(i, i + bucket);
    if (slice.length === 0) continue;
    const mid = slice[Math.floor(slice.length / 2)];
    const merged: Point = { ts: safeNumber(mid?.ts) ?? Date.now() };
    const keys = Object.keys(slice[0] ?? {}).filter((k) => k !== "ts");
    for (const k of keys) {
      const nums = slice
        .map((p) => safeNumber(p?.[k]))
        .filter((v): v is number => v != null);
      merged[k] = nums.length
        ? nums.reduce((s, x) => s + x, 0) / nums.length
        : null;
    }
    out.push(merged);
  }
  return out;
}

function fmt24h(ts: number) {
  const d = new Date(ts || Date.now());
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtDateTime(ts: number) {
  const d = new Date(ts || Date.now());
  return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

const TimeSeriesChart: React.FC<Props> = ({
  data,
  series,
  height = 320,
  rangeKey,
  optimalBands,
  syncId,
  yDefaults,
}) => {
  try {
    const safeSeries = Array.isArray(series) && series.length > 0 ? series : [];
    if (safeSeries.length === 0) {
      return <div className="h-40 grid place-items-center text-slate-500 border rounded-2xl text-sm">Sin series configuradas.</div>;
    }

    const now = Date.now();
    const minTs = now - (timeRanges[rangeKey] ?? timeRanges["24h"]);

    const filtered = useMemo(
      () => (Array.isArray(data) ? data : []).filter((p) => {
        const t = safeNumber(p?.ts);
        return t != null && t >= minTs && t <= now;
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [data, minTs, now]
    );

    const sampled = useMemo(() => downsample(filtered, 900), [filtered]);

    const yIds = useMemo(() => {
      const ids = new Set<string>();
      safeSeries.forEach((s) => ids.add(s.yAxisId ?? "y1"));
      if (ids.size === 0) ids.add("y1");
      return Array.from(ids.values());
    }, [safeSeries]);

    // dominios por eje
    const domains: Record<string, [number, number]> = useMemo(() => {
      const acc: Record<string, { min: number; max: number } | null> = {};
      for (const id of yIds) acc[id] = null;

      for (const row of sampled) {
        for (const s of safeSeries) {
          const id = s.yAxisId ?? "y1";
          const v = safeNumber(row?.[s.key]);
          if (v == null) continue;
          if (!acc[id]) acc[id] = { min: v, max: v };
          else {
            acc[id]!.min = Math.min(acc[id]!.min, v);
            acc[id]!.max = Math.max(acc[id]!.max, v);
          }
        }
      }

      const out: Record<string, [number, number]> = {};
      for (const id of yIds) {
        const d = acc[id];
        const def = yDefaults?.[id];
        if (!d) {
          out[id] = def ? [def.min, def.max] : [0, 1];
        } else {
          const pad = Math.max(0.3, (d.max - d.min) * 0.25);
          const min = Math.floor(((def ? Math.min(def.min, d.min - pad) : d.min - pad)) * 10) / 10;
          const max = Math.ceil(((def ? Math.max(def.max, d.max + pad) : d.max + pad)) * 10) / 10;
          // evita dominios inválidos (min==max)
          out[id] = min === max ? [min - 0.5, max + 0.5] : [min, max];
        }
      }
      return out;
    }, [sampled, yDefaults, yIds, safeSeries]);

    return (
      <div className="w-full">
        {sampled.length === 0 ? (
          <div className="h-40 grid place-items-center text-slate-500 border rounded-2xl">
            Sin datos en el rango seleccionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={sampled} margin={{ top: 10, right: 20, bottom: 0, left: 0 }} syncId={syncId}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
              <XAxis
                dataKey="ts"
                type="number"
                domain={[minTs, now]}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => (rangeKey === "24h" ? fmt24h(Number(v)) : fmtDateTime(Number(v)))}
                allowDataOverflow
              />
              {yIds.map((id, idx) => (
                <YAxis
                  key={id}
                  yAxisId={id}
                  domain={domains[id]}
                  tick={{ fontSize: 12 }}
                  width={idx === 0 ? 50 : 60}
                  orientation={idx === 0 ? "left" : "right"}
                  allowDataOverflow
                />
              ))}
              <Tooltip
                labelFormatter={(v) => fmtDateTime(Number(v))}
                formatter={(value: any, name: any) => {
                  const cfg = safeSeries.find((x) => x.name === name);
                  const unit = cfg?.unit ? ` ${cfg.unit}` : "";
                  const n = safeNumber(value);
                  return [n != null ? `${n.toFixed(2)}${unit}` : "N/D", String(name ?? "")];
                }}
              />
              <Legend verticalAlign="top" height={24} />

              {optimalBands?.map((b, i) => (
                <ReferenceArea key={i} yAxisId={b.yAxisId ?? "y1"} y1={b.min} y2={b.max} fillOpacity={0.08} />
              ))}
              <ReferenceLine y={0} ifOverflow="extendDomain" opacity={0} />

              {safeSeries.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  yAxisId={s.yAxisId ?? "y1"}
                  stroke={s.stroke ?? "currentColor"}
                  strokeWidth={2}
                  strokeOpacity={0.9}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 3 }}
                  isAnimationActive={true}
                  animationDuration={800}
                />
              ))}

              <Brush
                dataKey="ts"
                height={22}
                travellerWidth={8}
                tickFormatter={(v) => fmtDateTime(Number(v))}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    );
  } catch (e) {
    console.error("[TimeSeriesChart] crash:", e);
    return (
      <div className="h-40 grid place-items-center text-red-600 border rounded-2xl">
        Error al renderizar el gráfico.
      </div>
    );
  }
};

export default TimeSeriesChart;
