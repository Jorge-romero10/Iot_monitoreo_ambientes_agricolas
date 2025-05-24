// src/App.jsx
import { useEffect, useState } from "react";

function App() {
  const [temp, setTemp] = useState(null);

  useEffect(() => {
    const fetchTemp = async () => {
      try {
        const res = await fetch(
          "https://api.thingspeak.com/channels/TU_CHANNEL_ID/fields/1/last.json"
        );
        const data = await res.json();
        setTemp(data.field1);
      } catch (error) {
        console.error("Error al obtener datos:", error);
      }
    };

    fetchTemp();
    const interval = setInterval(fetchTemp, 10000); // actualizar cada 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-center">
      <h1 className="text-3xl font-bold mb-4">Temperatura Actual</h1>
      <div className="text-6xl">{temp ? ${temp} °C : "Cargando..."}</div>
    </div>
  );
}

export default App;