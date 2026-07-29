/*
 * SmartMurima — ESP32 Sensor Node Firmware
 * ------------------------------------------------------------
 * Reads a capacitive soil-moisture sensor + DHT22 (temperature/humidity)
 * and an optional resistive rain sensor, then publishes a JSON payload to
 * the MQTT broker over Wi-Fi on topic:  smartmurima/<DEVICE_ID>/telemetry
 *
 * Board:   ESP32-WROOM-32
 * Libraries (Arduino Library Manager):
 *   - PubSubClient (Nick O'Leary)
 *   - DHT sensor library (Adafruit) + Adafruit Unified Sensor
 *   - ArduinoJson (Benoit Blanchon)
 *
 * Wiring:
 *   Capacitive soil moisture AOUT -> GPIO34 (ADC1_CH6, input only)
 *   DHT22 DATA                     -> GPIO4  (10k pull-up to 3V3)
 *   Rain sensor AOUT (optional)    -> GPIO35 (ADC1_CH7)
 *   All sensors powered from 3V3.
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ---------- Configuration ----------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* MQTT_HOST = "192.168.1.100";   // MQTT broker IP (the gateway/server)
const int   MQTT_PORT = 1883;
const char* DEVICE_ID = "node-bugesera-01"; // unique per node

// Publish every 60 seconds
const unsigned long PUBLISH_INTERVAL_MS = 60UL * 1000UL;

// ---------- Pins ----------
#define SOIL_PIN 34
#define RAIN_PIN 35
#define DHT_PIN  4
#define DHT_TYPE DHT22

// Calibrate these against your specific capacitive sensor:
const int SOIL_DRY_RAW = 3200;  // raw ADC in dry air
const int SOIL_WET_RAW = 1200;  // raw ADC fully submerged

DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient espClient;
PubSubClient mqtt(espClient);

char topic[64];
unsigned long lastPublish = 0;

// ---------- Helpers ----------
float readSoilMoisturePct() {
  long acc = 0;
  for (int i = 0; i < 10; i++) { acc += analogRead(SOIL_PIN); delay(10); }
  int raw = acc / 10;
  float pct = 100.0f * (float)(SOIL_DRY_RAW - raw) / (float)(SOIL_DRY_RAW - SOIL_WET_RAW);
  if (pct < 0)   pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}

float readRainfallMm() {
  // Simple proxy: wetter contact -> higher reading. Map to a 0..25mm proxy.
  int raw = analogRead(RAIN_PIN);
  float wetness = (float)(4095 - raw) / 4095.0f; // 0 dry .. 1 wet
  return wetness * 25.0f;
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf("\nWi-Fi connected: %s\n", WiFi.localIP().toString().c_str());
}

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = String("sm-") + DEVICE_ID;
    if (mqtt.connect(clientId.c_str())) {
      Serial.println(" connected");
    } else {
      Serial.printf(" failed rc=%d, retry in 3s\n", mqtt.state());
      delay(3000);
    }
  }
}

void publishReading() {
  float soil = readSoilMoisturePct();
  float temp = dht.readTemperature();     // Celsius
  float hum  = dht.readHumidity();        // %RH
  float rain = readRainfallMm();

  if (isnan(temp)) temp = 0;
  if (isnan(hum))  hum  = 0;

  StaticJsonDocument<256> doc;
  doc["device_id"]     = DEVICE_ID;
  doc["soil_moisture"] = roundf(soil * 100) / 100.0;
  doc["temperature"]   = roundf(temp * 10) / 10.0;
  doc["humidity"]      = roundf(hum  * 10) / 10.0;
  doc["rainfall"]      = roundf(rain * 100) / 100.0;

  char buffer[256];
  size_t n = serializeJson(doc, buffer);
  mqtt.publish(topic, buffer, n);
  Serial.printf("Published -> %s : %s\n", topic, buffer);
}

// ---------- Arduino lifecycle ----------
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);          // 0..4095
  analogSetAttenuation(ADC_11db);    // full 3.3V range
  dht.begin();
  snprintf(topic, sizeof(topic), "smartmurima/%s/telemetry", DEVICE_ID);
  connectWifi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  unsigned long now = millis();
  if (now - lastPublish >= PUBLISH_INTERVAL_MS || lastPublish == 0) {
    lastPublish = now;
    publishReading();
  }
}
