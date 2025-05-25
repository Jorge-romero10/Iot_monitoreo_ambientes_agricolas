from machine import Pin, ADC
from utime import sleep
import network
import urequests
import time

# === CONFIGURACIÓN WIFI ===
ssid = "TU_SSID"
password = "TU_PASSWORD"

station = network.WLAN(network.STA_IF)
station.active(True)
station.connect(ssid, password)

while not station.isconnected():
    sleep(1)

print("✅ Conectado a WiFi:", station.ifconfig())

# === ZONA HORARIA (UTC-5)
TIMEZONE_OFFSET = -5 * 3600

# === FIREBASE ===
firebase_base_url = "https://data-real-time-9d86e-default-rtdb.firebaseio.com/sensors"

# === SENSOR ===
temp = ADC(Pin(27))  # GP27
pot = ADC(Pin(26)) #GP26

# === TIMESTAMP ===
def get_timestamp():
    t = time.time() + TIMEZONE_OFFSET
    fecha = time.localtime(t)
    return "{:04d}-{:02d}-{:02d}_{:02d}-{:02d}-{:02d}".format(*fecha[0:6])

# === LOOP ===
while True:
    temperatura = temp.read_u16()
    potenciometro = pot.read_u16()
    timestamp = get_timestamp()
    print(f"[{timestamp}] Enviado: {temperatura}")

    data = {
        "temperatura": temperatura,
        "humedad": 0,
        "presion": potenciometro,
        "luminosidad": 0,
        "co2": 0
   }

    # Agrega cada dato con timestamp como clave única
    url = f"{firebase_base_url}/{timestamp}.json"

    try:
        respuesta = urequests.put(url, json=data)
        print("✅ Respuesta Firebase:", respuesta.text)
        respuesta.close()
    except Exception as e:
        print("❌ Error al enviar:", e)

    sleep(10)
