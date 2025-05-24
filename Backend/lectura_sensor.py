import network
import urequests
import time
import machine
import dht

# Configura WiFi
ssid = "TU_SSID"
password = "TU_PASSWORD"

station = network.WLAN(network.STA_IF)
station.active(True)
station.connect(ssid, password)

while not station.isconnected():
    time.sleep(1)

print("Conectado a WiFi:", station.ifconfig())

# Sensor DHT11 o DHT22 en pin 15
sensor = dht.DHT22(machine.Pin(15))

THINGSPEAK_API_KEY = "TU_WRITE_API_KEY"
THINGSPEAK_URL = "https://api.thingspeak.com/update"

while True:
    sensor.measure()
    temp = sensor.temperature()

    # Enviar datos a ThingSpeak
    url = f"{THINGSPEAK_URL}?api_key={THINGSPEAK_API_KEY}&field1={temp}"
    response = urequests.get(url)
    print("Enviado:", temp, "Respuesta:", response.text)
    response.close()

    time.sleep(20)  # ThingSpeak permite 1 mensaje cada 15s (mínimo)