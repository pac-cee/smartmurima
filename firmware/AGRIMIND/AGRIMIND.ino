/*
 * AgriMind Smart Farm - ESP32 firmware (v2)
 * --------------------------------------------------------------------------
 * - REAL soil moisture (probe on MOISTURE_PIN).
 * - Smart irrigation: pump ON when soil is dry, OFF before waterlogging.
 * - Simulates Temperature, Humidity and FULL NPK (N,P,K) + pH + EC with a
 *   gentle, mean-reverting random walk so values drift GRADUALLY (realistic).
 * - Sends a reading set to the AgriMind backend every 30 seconds, each value
 *   tagged with its crop-optimal band so the dashboard raises the right alerts.
 * - Prints the full reading line to Serial every 5 s - works with/without net.
 * - LCD + LEDs + local web page for on-site use.
 *
 * Thresholds tuned for COMMON BEANS (Claudine's Beans Field):
 *   pH 6.0-7.5 ideal (N-fixation drops below ~5.8); temp 18-27 C; steady
 *   moisture but avoid waterlogging; moderate humidity (high -> fungal); beans
 *   fix N but need P and K for flowering and pod fill.
 */

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

//================ CONFIG - EDIT THESE =================
const char* WIFI_SSID     = "Pac Cee";         // network your backend machine is on
const char* WIFI_PASSWORD = "12345678";

// REMOTE via ngrok HTTPS (board on a different network than the backend) - active:
const char* BACKEND_URL  = "https://undated-reunion-scowling.ngrok-free.dev/api/v1/iot/telemetry/";
// LOCAL alternative (board on the SAME Wi-Fi as the backend machine):
// const char* BACKEND_URL = "http://10.220.48.155:8000/api/v1/iot/telemetry/";

const char* DEVICE_TOKEN = "4932f5d487f362ddfc12ac2023f966c2";  // Claudine / Beans Field

const unsigned long SEND_INTERVAL_MS = 30000;  // push to backend every 30 s
const unsigned long TICK_MS          = 2000;   // sensor/LCD/pump update + drift
const unsigned long PRINT_MS         = 5000;   // serial readout cadence
const uint16_t      HTTP_TIMEOUT_MS  = 5000;
const unsigned long WIFI_RETRY_MS    = 10000;

//================ CROP-OPTIMAL BANDS (common beans) =================
// {optimal_min, optimal_max} - sent with each reading; backend flags out-of-band.
const float MOISTURE_MIN = 40,  MOISTURE_MAX = 70;   // consistent, not waterlogged
const float TEMP_MIN     = 18,  TEMP_MAX     = 27;   // warm-season legume
const float HUM_MIN      = 55,  HUM_MAX      = 75;   // >85% -> fungal disease risk
const float PH_MIN       = 6.0, PH_MAX       = 7.0;  // <5.8 hurts N-fixation
const float EC_MIN       = 0.4, EC_MAX       = 1.6;  // low-moderate salinity
const float N_MIN        = 50,  N_MAX        = 200;  // mg/kg
const float P_MIN        = 25,  P_MAX        = 90;
const float K_MIN        = 120, K_MAX        = 280;

//================ IRRIGATION THRESHOLDS =================
const int DRY_LEVEL = 40;   // pump ON below this (beans need steady moisture)
const int WET_LEVEL = 65;   // pump OFF above this (avoid root rot / waterlogging)

//================ WEB / LCD =================
WebServer server(80);
LiquidCrystal_I2C lcd(0x27, 20, 4);

//================ PINS =================
#define MOISTURE_PIN 34
#define RELAY_PIN 23
#define GREEN_LED 26
#define RED_LED 27
#define BUZZER_PIN 25

//================ LIVE / SIMULATED DATA =================
float moisture = 0;        // REAL
float temperature = 23;    // simulated, centred in band
float humidity = 65;
float ph = 6.5;
float ec = 1.0;
float nitrogen = 120;
float phosphorus = 55;
float potassium = 200;
bool  pumpState = false;

unsigned long lastSend = 0, lastTick = 0, lastPrint = 0, lastWifiCheck = 0;

//================ FORWARD DECLARATIONS =================
void readMoisture();
float drift(float v, float lo, float hi, float step);
void simulateSensors();
void controlPump();
void alerts();
void lcdUpdate();
void sendTelemetry();
void ensureWifi();
const char* wifiStatusText(int s);
String page();
void handleRoot();

//================ SENSOR READ (REAL) =================
void readMoisture() {
  int raw = analogRead(MOISTURE_PIN);
  moisture = map(raw, 4095, 1500, 0, 100);   // calibrate for your soil/probe
  if (moisture < 0) moisture = 0;
  if (moisture > 100) moisture = 100;
}

//================ GRADUAL DRIFT (mean-reverting random walk) =================
float drift(float v, float lo, float hi, float step) {
  float mid = (lo + hi) / 2.0;
  v += ((float)random(-100, 101) / 100.0) * step;   // random nudge
  v += (mid - v) * 0.04;                             // 4% pull to centre
  float hardLo = lo - (hi - lo) * 0.25;
  float hardHi = hi + (hi - lo) * 0.25;
  if (v < hardLo) v = hardLo;
  if (v > hardHi) v = hardHi;
  return v;
}

void simulateSensors() {
  temperature = drift(temperature, TEMP_MIN, TEMP_MAX, 0.25);
  humidity    = drift(humidity,    HUM_MIN,  HUM_MAX,  0.6);
  ph          = drift(ph,          PH_MIN,   PH_MAX,   0.04);
  ec          = drift(ec,          EC_MIN,   EC_MAX,   0.04);
  nitrogen    = drift(nitrogen,    N_MIN,    N_MAX,    2.0);
  phosphorus  = drift(phosphorus,  P_MIN,    P_MAX,    1.2);
  potassium   = drift(potassium,   K_MIN,    K_MAX,    3.0);
}

//================ SMART IRRIGATION =================
void controlPump() {
  if (moisture < DRY_LEVEL) { pumpState = true;  digitalWrite(RELAY_PIN, LOW); }
  else if (moisture > WET_LEVEL) { pumpState = false; digitalWrite(RELAY_PIN, HIGH); }
}

//================ STATUS LEDS =================
void alerts() {
  bool needsWater = moisture < DRY_LEVEL;
  digitalWrite(RED_LED,   needsWater ? HIGH : LOW);
  digitalWrite(GREEN_LED, needsWater ? LOW  : HIGH);
  // Buzzer left off to keep peak current low on USB power.
}

//================ LCD =================
void lcdUpdate() {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Moist:"); lcd.print(moisture, 0); lcd.print("% T:"); lcd.print(temperature, 0);
  lcd.setCursor(0, 1); lcd.print("Hum:"); lcd.print(humidity, 0); lcd.print("% pH:"); lcd.print(ph, 1);
  lcd.setCursor(0, 2); lcd.print("N:"); lcd.print(nitrogen, 0); lcd.print(" P:"); lcd.print(phosphorus, 0); lcd.print(" K:"); lcd.print(potassium, 0);
  lcd.setCursor(0, 3); lcd.print("Pump:"); lcd.print(pumpState ? "ON " : "OFF"); lcd.print(" EC:"); lcd.print(ec, 1);
}

//================ SEND TO BACKEND =================
static void addReading(String& b, const char* type, float val, int dp, float omin, float omax, bool last) {
  b += "{\"sensor_type\":\""; b += type; b += "\",\"value\":" + String(val, dp);
  b += ",\"optimal_min\":" + String(omin, 1) + ",\"optimal_max\":" + String(omax, 1) + "}";
  if (!last) b += ",";
}

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;

  String body = "{\"token\":\"" + String(DEVICE_TOKEN) + "\",\"readings\":[";
  addReading(body, "moisture",   moisture,    1, MOISTURE_MIN, MOISTURE_MAX, false);
  addReading(body, "temperature",temperature, 1, TEMP_MIN,     TEMP_MAX,     false);
  addReading(body, "humidity",   humidity,    1, HUM_MIN,      HUM_MAX,      false);
  addReading(body, "ph",         ph,          2, PH_MIN,       PH_MAX,       false);
  addReading(body, "ec",         ec,          2, EC_MIN,       EC_MAX,       false);
  addReading(body, "nitrogen",   nitrogen,    0, N_MIN,        N_MAX,        false);
  addReading(body, "phosphorus", phosphorus,  0, P_MIN,        P_MAX,        false);
  addReading(body, "potassium",  potassium,   0, K_MIN,        K_MAX,        true);
  body += "]}";

  bool secure = String(BACKEND_URL).startsWith("https");
  WiFiClientSecure tls; WiFiClient plain; tls.setInsecure();
  HTTPClient http;
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (secure) http.begin(tls, BACKEND_URL); else http.begin(plain, BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  int code = http.POST(body);
  if (code == 200) Serial.println("POST telemetry -> HTTP 200 OK (readings delivered)");
  else { Serial.print("POST telemetry -> HTTP "); Serial.print(code); Serial.print("  "); Serial.println(http.errorToString(code)); }
  http.end();
}

//================ WIFI KEEP-ALIVE =================
const char* wifiStatusText(int s) {
  switch (s) {
    case WL_NO_SSID_AVAIL: return "SSID not found";
    case WL_CONNECT_FAILED: return "wrong password";
    case WL_CONNECTION_LOST: return "connection lost";
    case WL_DISCONNECTED: return "disconnected";
    default: return "unknown";
  }
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiCheck < WIFI_RETRY_MS) return;
  lastWifiCheck = millis();
  Serial.printf("Wi-Fi offline (%s) - retrying...\n", wifiStatusText(WiFi.status()));
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

//================ WEB PAGE =================
String page() {
  String h = "<html><head><meta http-equiv='refresh' content='5'>";
  h += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  h += "</head><body style='font-family:sans-serif'>";
  h += "<h2>AGRIMIND SMART FARM</h2>";
  h += "<p>Moisture: " + String(moisture, 0) + "%</p>";
  h += "<p>Temperature: " + String(temperature, 1) + " C</p>";
  h += "<p>Humidity: " + String(humidity, 0) + "%</p>";
  h += "<p>pH: " + String(ph, 2) + " | EC: " + String(ec, 2) + "</p>";
  h += "<p>NPK: " + String(nitrogen, 0) + " / " + String(phosphorus, 0) + " / " + String(potassium, 0) + " mg/kg</p>";
  h += "<p>Pump: <b>" + String(pumpState ? "ON" : "OFF") + "</b></p>";
  h += "</body></html>";
  return h;
}

void handleRoot() { server.send(200, "text/html", page()); }

//================ SETUP =================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  Serial.begin(115200);
  randomSeed(analogRead(35));

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);   // pump off (active-LOW relay)

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("AGRIMIND BOOTING");

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  Serial.printf("Connecting to Wi-Fi '%s'\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);
  int t = 0;
  while (WiFi.status() != WL_CONNECTED && t < 30) { delay(500); Serial.print("."); t++; }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) { Serial.print("Wi-Fi connected, IP: "); Serial.println(WiFi.localIP()); }
  else Serial.printf("Wi-Fi FAILED (%s) - running offline\n", wifiStatusText(WiFi.status()));

  server.on("/", handleRoot);
  server.begin();

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("AGRIMIND READY");
}

//================ LOOP =================
void loop() {
  server.handleClient();
  ensureWifi();
  readMoisture();
  controlPump();

  unsigned long now = millis();

  if (now - lastTick >= TICK_MS) {        // gradual sensor drift + LCD
    lastTick = now;
    simulateSensors();
    alerts();
    lcdUpdate();
  }

  if (now - lastPrint >= PRINT_MS) {      // local readout (no internet needed)
    lastPrint = now;
    Serial.printf(
      "Moist:%.0f%%  Temp:%.1fC  Hum:%.0f%%  pH:%.2f  EC:%.2f  N:%.0f P:%.0f K:%.0f  Pump:%s  WiFi:%s\n",
      moisture, temperature, humidity, ph, ec, nitrogen, phosphorus, potassium,
      pumpState ? "ON" : "OFF",
      WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString().c_str() : "offline");
  }

  if (now - lastSend >= SEND_INTERVAL_MS) {   // push to backend every 30 s
    lastSend = now;
    sendTelemetry();
  }

  delay(50);
}
