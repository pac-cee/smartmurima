/*
 * AgriMind Smart Farm - ESP32 firmware (v3)
 * ==========================================================================
 * WHAT'S NEW vs v2: no hard-coded Wi-Fi. The board provisions itself.
 *
 *  - Always raises its own hotspot  "AgriMind-XXXX"  (AP+STA mode), so you can
 *    reach the setup page any time at http://192.168.4.1 - even with no Wi-Fi.
 *  - Captive portal: joining the hotspot pops the setup page automatically.
 *  - On-device web app (web_portal.h): scan nearby Wi-Fi, pick one, enter the
 *    password, connect. Save MANY networks; the board auto-reconnects to
 *    whichever it can see. Forget/disconnect at will.
 *  - Backend URL, device token and send-interval are configurable in the UI and
 *    stored in flash (Preferences) - survive reboots, change without re-flashing.
 *  - Non-blocking Wi-Fi state machine: the farm keeps running (sensors, pump,
 *    LCD, local readout) whether or not the internet is up.
 *
 * FARM LOGIC (v4 — REAL sensing, no simulation):
 *  - A 7-in-1 RS485 soil sensor (Modbus RTU, fn 0x03) provides REAL soil
 *    moisture, temperature, EC, pH, Nitrogen, Phosphorus and Potassium on UART2.
 *  - A capacitive probe on MOISTURE_PIN cross-checks moisture and is the
 *    irrigation fallback if the RS485 sensor stops answering.
 *  - Smart pump (on when dry, off before waterlogging). Thresholds for BEANS.
 *  - Every send-interval, POSTs the real reading set to the AgriMind telemetry
 *    endpoint with each value's crop-optimal band so the dashboard alerts.
 *
 * First run:  power on -> phone Wi-Fi -> join "AgriMind-XXXX" (pwd: agrimind123)
 *             -> setup page opens -> Wi-Fi tab -> Scan -> pick yours -> connect.
 */

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "web_portal.h"

//================ FACTORY DEFAULTS (used until changed in the UI) =================
// Point this at the SmartMurima backend. On a LAN, that is the host running
// `docker compose up` -- e.g. "http://192.168.1.50:8000/api/v1/iot/telemetry/".
// "localhost" is the ESP32 itself, so it will never work here. The URL is also
// editable in the portal's Settings tab, so a flashed board can be re-pointed
// without a rebuild. The announce endpoint is derived from it automatically.
const char* DEFAULT_BACKEND_URL  = "http://192.168.1.100:8000/api/v1/iot/telemetry/";
// Empty by default: a fresh device starts UNPAIRED, announces itself, and gets
// its token automatically when a farmer claims it in the app. (You can still
// paste a token manually in the portal's Settings tab to skip discovery.)
const char* DEFAULT_DEVICE_TOKEN = "";
const char* DEFAULT_AP_PASSWORD  = "agrimind123";   // >=8 chars, or "" for an open hotspot
const uint32_t DEFAULT_INTERVAL_S = 5;              // telemetry cadence (seconds) - live dashboard

//================ TIMING =================
const unsigned long TICK_MS         = 2000;   // sensor/LCD/pump update + drift
const unsigned long PRINT_MS        = 5000;   // serial readout cadence
const uint16_t      HTTP_TIMEOUT_MS = 6000;
const unsigned long CONNECT_TIMEOUT = 12000;  // give each Wi-Fi join attempt this long
const unsigned long RECONNECT_EVERY = 15000;  // when offline, retry a saved net this often

//================ CROP-OPTIMAL BANDS (common beans) =================
const float MOISTURE_MIN = 40,  MOISTURE_MAX = 70;
const float TEMP_MIN     = 18,  TEMP_MAX     = 27;
const float HUM_MIN      = 55,  HUM_MAX      = 75;
const float PH_MIN       = 6.0, PH_MAX       = 7.0;
const float EC_MIN       = 0.4, EC_MAX       = 1.6;
const float N_MIN        = 50,  N_MAX        = 200;
const float P_MIN        = 25,  P_MAX        = 90;
const float K_MIN        = 120, K_MAX        = 280;

//================ IRRIGATION THRESHOLDS (updatable from backend) =================
int DRY_LEVEL = 40;   // pump ON below this %
int WET_LEVEL = 65;   // pump OFF above this %

//================ PINS =================
#define MOISTURE_PIN 34    // capacitive probe (analog, fallback / cross-check)
#define RELAY_PIN 23
#define GREEN_LED 26
#define RED_LED 27
#define BUZZER_PIN 25

//================ RS485 / MODBUS (7-in-1 soil NPK sensor) =================
// Wiring: MAX485 RO->RX2(16), DI->TX2(17), DE+RE tied together->GPIO4.
// (Auto-direction RS485 modules need no DE pin — set RS485_DE_PIN to -1.)
#define RS485_RX_PIN 16
#define RS485_TX_PIN 17
#define RS485_DE_PIN 4     // HIGH = transmit, LOW = receive; -1 for auto modules
#define RS485_SLAVE  0x01  // sensor Modbus address (factory default)
#define RS485_BAUD   4800  // sensor default: 4800 8N1
HardwareSerial RS485Serial(2);   // UART2

//================ PERIPHERALS =================
WebServer server(80);
DNSServer dnsServer;
LiquidCrystal_I2C lcd(0x27, 20, 4);
Preferences prefs;

//================ LIVE DATA (all REAL — read from the RS485 sensor) =================
float moisture = 0;        // soil moisture used for irrigation (RS485, capacitive fallback)
float capMoisture = 0;     // raw capacitive-probe reading (%)
float temperature = 23, humidity = 0, ph = 6.5, ec = 1.0;
float nitrogen = 0, phosphorus = 0, potassium = 0;
bool  rs485Online = false; // true once the RS485 sensor answers a Modbus poll
bool  pumpState = false;
String pumpMode = "auto";   // "auto" | "manual" — set by the backend
int    cmdPumpOn = -1;      // manual desired: 1=ON, 0=OFF, -1=unset (auto)

unsigned long lastTick = 0, lastPrint = 0, lastSend = 0;

//================ RUNTIME CONFIG (loaded from flash) =================
String  cfgBackend, cfgToken, cfgApPwd;
unsigned long cfgIntervalMs = DEFAULT_INTERVAL_S * 1000UL;
String  apSsid;
String  hardwareId;                    // stable chip id, e.g. "ESP32-A1B2C3D4E5F6"
String  lastSendMsg = "idle";
unsigned long lastAnnounce = 0;
const unsigned long ANNOUNCE_EVERY = 10000;  // heartbeat to backend while unpaired

//================ SAVED WI-FI NETWORKS =================
#define MAX_NETWORKS 8
struct WifiCred { String ssid; String pwd; };
WifiCred savedNets[MAX_NETWORKS];
int savedCount = 0;

//================ WI-FI STATE MACHINE =================
enum StaState { STA_IDLE, STA_CONNECTING, STA_CONNECTED };
StaState staState = STA_IDLE;
bool          autoConnect = true;     // false after a manual Disconnect
String        targetSsid = "";        // forced "connect now" target (overrides round-robin)
int           rrIndex = -1;           // round-robin pointer across saved networks
unsigned long connectStart = 0, lastConnectAttempt = 0;

//================ FORWARD DECLARATIONS =================
void loadConfig();
void persistNetworks();
bool addNetwork(const String& ssid, const String& pwd);
bool removeNetwork(const String& ssid);
String passwordFor(const String& ssid);
void manageWifi();
void startConnect(const String& ssid, const String& pwd);
void startAP();
void readMoisture();
bool readRS485Sensor();
uint16_t modbusCRC(const uint8_t* buf, int len);
void controlPump();
void statusLeds();
void lcdUpdate();
void sendTelemetry();
void announceDevice();
String announceUrl();
String jsonField(const String& src, const char* key);
long jsonInt(const String& src, const char* key, long dflt);
void applyCommand(const String& resp);
String jsonEsc(const String& s);
void registerRoutes();
void handleStatus();
void handleScan();
void handleNetworks();
void handleConnect();
void handleForget();
void handleDisconnect();
void handleSettings();
void handleRoot();
void handleNotFound();

//================ CONFIG STORAGE =================
void loadConfig() {
  prefs.begin("agrimind", false);
  savedCount = prefs.getInt("netCount", 0);
  if (savedCount > MAX_NETWORKS) savedCount = MAX_NETWORKS;
  for (int i = 0; i < savedCount; i++) {
    savedNets[i].ssid = prefs.getString(("s" + String(i)).c_str(), "");
    savedNets[i].pwd  = prefs.getString(("p" + String(i)).c_str(), "");
  }
  cfgBackend    = prefs.getString("backend", DEFAULT_BACKEND_URL);
  cfgToken      = prefs.getString("token",   DEFAULT_DEVICE_TOKEN);
  cfgApPwd      = prefs.getString("appwd",   DEFAULT_AP_PASSWORD);
  cfgIntervalMs = (unsigned long) prefs.getUInt("interval", DEFAULT_INTERVAL_S) * 1000UL;
}

void persistNetworks() {
  prefs.putInt("netCount", savedCount);
  for (int i = 0; i < savedCount; i++) {
    prefs.putString(("s" + String(i)).c_str(), savedNets[i].ssid);
    prefs.putString(("p" + String(i)).c_str(), savedNets[i].pwd);
  }
}

bool addNetwork(const String& ssid, const String& pwd) {
  if (ssid.length() == 0) return false;
  for (int i = 0; i < savedCount; i++) {            // already known -> update password
    if (savedNets[i].ssid == ssid) {
      if (pwd.length()) savedNets[i].pwd = pwd;
      persistNetworks();
      return true;
    }
  }
  if (savedCount >= MAX_NETWORKS) return false;
  savedNets[savedCount].ssid = ssid;
  savedNets[savedCount].pwd  = pwd;
  savedCount++;
  persistNetworks();
  return true;
}

bool removeNetwork(const String& ssid) {
  for (int i = 0; i < savedCount; i++) {
    if (savedNets[i].ssid == ssid) {
      for (int j = i; j < savedCount - 1; j++) savedNets[j] = savedNets[j + 1];
      savedCount--;
      savedNets[savedCount] = WifiCred();
      persistNetworks();
      return true;
    }
  }
  return false;
}

String passwordFor(const String& ssid) {
  for (int i = 0; i < savedCount; i++)
    if (savedNets[i].ssid == ssid) return savedNets[i].pwd;
  return "";
}

//================ WI-FI: NON-BLOCKING STATE MACHINE =================
void startConnect(const String& ssid, const String& pwd) {
  if (ssid.length() == 0) return;
  Serial.printf("Wi-Fi: connecting to '%s'...\n", ssid.c_str());
  WiFi.begin(ssid.c_str(), pwd.c_str());
  staState = STA_CONNECTING;
  connectStart = lastConnectAttempt = millis();
}

void startAP() {
  WiFi.softAPdisconnect(true);
  bool open = (cfgApPwd.length() < 8);   // WPA2 needs >=8 chars; otherwise open
  WiFi.softAP(apSsid.c_str(), open ? nullptr : cfgApPwd.c_str());
  Serial.printf("Hotspot '%s' up at %s  (%s)\n", apSsid.c_str(),
                WiFi.softAPIP().toString().c_str(), open ? "open" : "secured");
}

void manageWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (staState != STA_CONNECTED) {
      staState = STA_CONNECTED;
      Serial.printf("Wi-Fi connected: %s  IP %s  RSSI %d dBm\n",
                    WiFi.SSID().c_str(), WiFi.localIP().toString().c_str(), WiFi.RSSI());
    }
    return;
  }
  if (staState == STA_CONNECTED) staState = STA_IDLE;   // link dropped

  // A manual "connect now" overrides everything (even an in-flight attempt).
  if (targetSsid.length()) {
    String s = targetSsid; targetSsid = "";
    startConnect(s, passwordFor(s));
    return;
  }
  if (staState == STA_CONNECTING) {
    if (millis() - connectStart > CONNECT_TIMEOUT) {
      Serial.println("Wi-Fi: attempt timed out");
      staState = STA_IDLE;
    } else {
      return;   // still trying
    }
  }
  if (!autoConnect || savedCount == 0) return;
  if (millis() - lastConnectAttempt < RECONNECT_EVERY) return;
  rrIndex = (rrIndex + 1) % savedCount;                 // round-robin saved nets
  startConnect(savedNets[rrIndex].ssid, savedNets[rrIndex].pwd);
}

//================ SENSORS / PUMP =================
void readMoisture() {
  // Capacitive probe on the ADC — averaged so it's steady. Kept as a cross-check
  // and as the irrigation fallback when the RS485 sensor isn't answering.
  const int SAMPLES = 12;
  long sum = 0;
  for (int i = 0; i < SAMPLES; i++) { sum += analogRead(MOISTURE_PIN); delayMicroseconds(400); }
  int raw = sum / SAMPLES;
  capMoisture = constrain(map(raw, 4095, 1500, 0, 100), 0, 100);
  if (!rs485Online) moisture = capMoisture;   // fallback until RS485 responds
}

// Modbus-RTU CRC16 (poly 0xA001, init 0xFFFF), low byte first on the wire.
uint16_t modbusCRC(const uint8_t* buf, int len) {
  uint16_t crc = 0xFFFF;
  for (int i = 0; i < len; i++) {
    crc ^= buf[i];
    for (int b = 0; b < 8; b++) {
      if (crc & 1) { crc >>= 1; crc ^= 0xA001; }
      else          crc >>= 1;
    }
  }
  return crc;
}

// Read the 7-in-1 RS485 soil sensor over Modbus RTU: function 0x03, 7 holding
// registers from 0x0000 = moisture, temperature, EC, pH, N, P, K. Returns true
// on a valid, CRC-checked frame and updates the globals with REAL values.
bool readRS485Sensor() {
  uint8_t req[8] = { RS485_SLAVE, 0x03, 0x00, 0x00, 0x00, 0x07, 0, 0 };
  uint16_t crc = modbusCRC(req, 6);
  req[6] = crc & 0xFF; req[7] = crc >> 8;      // CRC low byte first

  while (RS485Serial.available()) RS485Serial.read();   // drop stale bytes

  if (RS485_DE_PIN >= 0) digitalWrite(RS485_DE_PIN, HIGH);   // enable transmit
  delayMicroseconds(50);
  RS485Serial.write(req, 8);
  RS485Serial.flush();                                       // wait until fully sent
  if (RS485_DE_PIN >= 0) digitalWrite(RS485_DE_PIN, LOW);    // back to receive

  // Response: addr, func, byteCount(0x0E), 14 data bytes, 2 CRC = 19 bytes.
  const int EXPECT = 3 + 7 * 2 + 2;
  uint8_t resp[32];
  int n = 0;
  unsigned long t0 = millis();
  while (n < EXPECT && millis() - t0 < 350) {
    if (RS485Serial.available()) resp[n++] = RS485Serial.read();
  }
  if (n < EXPECT || resp[0] != RS485_SLAVE || resp[1] != 0x03 || resp[2] != 0x0E) {
    rs485Online = false;
    return false;
  }
  uint16_t rc = modbusCRC(resp, EXPECT - 2);
  if ((rc & 0xFF) != resp[EXPECT - 2] || ((rc >> 8) & 0xFF) != resp[EXPECT - 1]) {
    rs485Online = false;
    return false;
  }

  auto reg = [&](int i) -> int16_t { return (int16_t)((resp[3 + i * 2] << 8) | resp[4 + i * 2]); };
  float rsMoist = reg(0) / 10.0;     // %RH   (e.g. 195 -> 19.5%)
  temperature   = reg(1) / 10.0;     // °C    (signed, 237 -> 23.7)
  ec            = reg(2) / 1000.0;   // µS/cm -> mS/cm (291 -> 0.291)
  ph            = reg(3) / 10.0;     // pH    (64 -> 6.4)
  nitrogen      = reg(4);            // mg/kg
  phosphorus    = reg(5);            // mg/kg
  potassium     = reg(6);            // mg/kg
  moisture      = rsMoist;           // RS485 soil moisture drives irrigation
  rs485Online   = true;
  return true;
}

void controlPump() {
  // MANUAL: obey the backend's command (farmer/agronomist override).
  if (pumpMode == "manual" && cmdPumpOn >= 0) {
    pumpState = (cmdPumpOn == 1);
    digitalWrite(RELAY_PIN, pumpState ? LOW : HIGH);
    return;
  }
  // AUTO: smart irrigation with the (backend-updatable) dry/wet thresholds.
  if (moisture < DRY_LEVEL)      { pumpState = true;  digitalWrite(RELAY_PIN, LOW); }
  else if (moisture > WET_LEVEL) { pumpState = false; digitalWrite(RELAY_PIN, HIGH); }
}

// Parse a numeric field like  "dry_level":40  from a small JSON response.
long jsonInt(const String& src, const char* key, long dflt) {
  String pat = String("\"") + key + "\":";
  int i = src.indexOf(pat);
  if (i < 0) return dflt;
  return src.substring(i + pat.length()).toInt();
}

// Apply the {command} block the backend returns with each telemetry POST.
void applyCommand(const String& resp) {
  String mode = jsonField(resp, "pump_mode");
  if (mode.length()) pumpMode = mode;
  int p = resp.indexOf("\"pump_on\":");
  if (p >= 0) {
    String after = resp.substring(p + 10, p + 20);
    if (after.startsWith("true"))       cmdPumpOn = 1;
    else if (after.startsWith("false")) cmdPumpOn = 0;
    else                                cmdPumpOn = -1;   // null → auto
  }
  long d = jsonInt(resp, "dry_level", DRY_LEVEL);
  long w = jsonInt(resp, "wet_level", WET_LEVEL);
  if (d > 0 && d < 100) DRY_LEVEL = (int)d;
  if (w > 0 && w <= 100) WET_LEVEL = (int)w;
}

void statusLeds() {
  bool needsWater = moisture < DRY_LEVEL;
  digitalWrite(RED_LED,   needsWater ? HIGH : LOW);
  digitalWrite(GREEN_LED, needsWater ? LOW  : HIGH);
}

void lcdUpdate() {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Moist:"); lcd.print(moisture, 0); lcd.print("% T:"); lcd.print(temperature, 0);
  lcd.setCursor(0, 1); lcd.print("pH:"); lcd.print(ph, 1); lcd.print(" EC:"); lcd.print(ec, 2);
  lcd.setCursor(0, 2);
  if (WiFi.status() == WL_CONNECTED) { lcd.print("Net:"); lcd.print(WiFi.SSID().substring(0, 14)); }
  else { lcd.print("Setup:"); lcd.print(WiFi.softAPIP().toString()); }
  lcd.setCursor(0, 3); lcd.print("Pump:"); lcd.print(pumpState ? "ON " : "OFF");
  lcd.print(WiFi.status() == WL_CONNECTED ? " ONLINE" : " AP");
}

//================ TELEMETRY =================
static void addReading(String& b, const char* type, float val, int dp, float omin, float omax, bool last) {
  b += "{\"sensor_type\":\""; b += type; b += "\",\"value\":" + String(val, dp);
  b += ",\"optimal_min\":" + String(omin, 1) + ",\"optimal_max\":" + String(omax, 1) + "}";
  if (!last) b += ",";
}

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) { lastSendMsg = "offline"; return; }
  if (cfgToken.length() == 0 || cfgBackend.length() == 0) { lastSendMsg = "no token/URL"; return; }

  // Only real sensors are sent. The RS485 soil probe has no air-humidity
  // channel, so humidity is intentionally omitted (no simulated values).
  String body = "{\"token\":\"" + cfgToken + "\",\"readings\":[";
  addReading(body, "moisture",   moisture,    1, MOISTURE_MIN, MOISTURE_MAX, false);
  addReading(body, "temperature",temperature, 1, TEMP_MIN,     TEMP_MAX,     false);
  addReading(body, "ph",         ph,          2, PH_MIN,       PH_MAX,       false);
  addReading(body, "ec",         ec,          3, EC_MIN,       EC_MAX,       false);
  addReading(body, "nitrogen",   nitrogen,    0, N_MIN,        N_MAX,        false);
  addReading(body, "phosphorus", phosphorus,  0, P_MIN,        P_MAX,        false);
  addReading(body, "potassium",  potassium,   0, K_MIN,        K_MAX,        true);
  body += "],\"pump\":";
  body += (pumpState ? "true" : "false");
  body += "}";

  bool secure = cfgBackend.startsWith("https");
  WiFiClientSecure tls; WiFiClient plain; tls.setInsecure();
  HTTPClient http;
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (secure) http.begin(tls, cfgBackend); else http.begin(plain, cfgBackend);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  int code = http.POST(body);
  if (code == 200) {
    applyCommand(http.getString());   // pump mode/state + dry/wet from the backend
    lastSendMsg = String("HTTP 200 (") + pumpMode + ")";
    Serial.printf("POST telemetry -> 200 OK | pump %s mode=%s\n", pumpState ? "ON" : "OFF", pumpMode.c_str());
  } else {
    lastSendMsg = "HTTP " + String(code);
    Serial.printf("POST telemetry -> %d %s\n", code, http.errorToString(code).c_str());
  }
  http.end();
}

//================ AUTO-PAIRING (cloud discovery) =================
// Derive the announce endpoint from the configured telemetry URL, e.g.
// ".../iot/telemetry/" -> ".../iot/announce/".
String announceUrl() {
  int i = cfgBackend.indexOf("telemetry");
  if (i < 0) return "";
  return cfgBackend.substring(0, i) + "announce/";
}

// Tiny extractor for a string field in a small JSON response: "key":"value".
String jsonField(const String& src, const char* key) {
  String pat = String("\"") + key + "\":\"";
  int i = src.indexOf(pat);
  if (i < 0) return "";
  i += pat.length();
  int j = src.indexOf('"', i);
  if (j < 0) return "";
  return src.substring(i, j);
}

// While unpaired, heartbeat our hardware id to the backend. Once a farmer claims
// this device in the app, the response carries our token: we save it and switch
// straight into sending telemetry - no re-flash, no copy-paste.
void announceDevice() {
  String url = announceUrl();
  if (url.length() == 0) { lastSendMsg = "set backend URL"; return; }

  String body = "{\"hardware_id\":\"" + jsonEsc(hardwareId) + "\",\"name\":\"" + jsonEsc(apSsid) + "\"}";
  bool secure = url.startsWith("https");
  WiFiClientSecure tls; WiFiClient plain; tls.setInsecure();
  HTTPClient http;
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (secure) http.begin(tls, url); else http.begin(plain, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  int code = http.POST(body);
  if (code == 200) {
    String resp = http.getString();
    String token = jsonField(resp, "token");
    if (token.length()) {
      cfgToken = token;
      prefs.putString("token", cfgToken);
      lastSendMsg = "paired - starting telemetry";
      Serial.printf("Paired! Token received, saved to flash: %s\n", token.c_str());
    } else {
      lastSendMsg = "waiting to be claimed in app";
      Serial.println("Announce OK - not claimed yet. Register this device in AgriMind.");
    }
  } else {
    lastSendMsg = "announce HTTP " + String(code);
    Serial.printf("Announce -> %d %s\n", code, http.errorToString(code).c_str());
  }
  http.end();
}

//================ JSON HELPERS / WEB ENDPOINTS =================
String jsonEsc(const String& s) {
  String o; o.reserve(s.length() + 4);
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c == '"' || c == '\\') { o += '\\'; o += c; }
    else if (c == '\n') o += "\\n";
    else if (c == '\r') {}
    else o += c;
  }
  return o;
}

static void appendSensor(String& j, const char* key, float v, int dp, const char* unit, bool last) {
  // status mirrors the backend: warning past the band, critical past band +/- 15%.
  float omin, omax;
  if      (!strcmp(key, "moisture"))    { omin = MOISTURE_MIN; omax = MOISTURE_MAX; }
  else if (!strcmp(key, "temperature")) { omin = TEMP_MIN; omax = TEMP_MAX; }
  else if (!strcmp(key, "humidity"))    { omin = HUM_MIN;  omax = HUM_MAX; }
  else if (!strcmp(key, "ph"))          { omin = PH_MIN;   omax = PH_MAX; }
  else if (!strcmp(key, "ec"))          { omin = EC_MIN;   omax = EC_MAX; }
  else if (!strcmp(key, "nitrogen"))    { omin = N_MIN;    omax = N_MAX; }
  else if (!strcmp(key, "phosphorus"))  { omin = P_MIN;    omax = P_MAX; }
  else                                  { omin = K_MIN;    omax = K_MAX; }
  float span = max(omax - omin, 1.0f);
  const char* st = "ok";
  if (v < omin - span * 0.15f || v > omax + span * 0.15f) st = "critical";
  else if (v < omin || v > omax) st = "warning";
  j += "\""; j += key; j += "\":{\"value\":" + String(v, dp) +
       ",\"unit\":\""; j += unit; j += "\",\"status\":\""; j += st; j += "\"}";
  if (!last) j += ",";
}

void handleStatus() {
  bool online = WiFi.status() == WL_CONNECTED;
  String j = "{";
  j += "\"connected\":" + String(online ? "true" : "false");
  j += ",\"ssid\":\"" + jsonEsc(online ? WiFi.SSID() : "") + "\"";
  j += ",\"ip\":\"" + (online ? WiFi.localIP().toString() : String("")) + "\"";
  j += ",\"rssi\":" + String(online ? WiFi.RSSI() : 0);
  j += ",\"ap_ssid\":\"" + jsonEsc(apSsid) + "\"";
  j += ",\"ap_ip\":\"" + WiFi.softAPIP().toString() + "\"";
  j += ",\"backend\":\"" + jsonEsc(cfgBackend) + "\"";
  j += ",\"token_set\":" + String(cfgToken.length() ? "true" : "false");
  j += ",\"interval\":" + String(cfgIntervalMs / 1000);
  j += ",\"pump\":" + String(pumpState ? "true" : "false");
  j += ",\"last_send\":\"" + jsonEsc(lastSendMsg) + "\"";
  j += ",\"sensors\":{";
  appendSensor(j, "moisture",    moisture,    1, "%", false);
  appendSensor(j, "temperature", temperature, 1, "C", false);
  appendSensor(j, "ph",          ph,          2, "",  false);
  appendSensor(j, "ec",          ec,          3, "",  false);
  appendSensor(j, "nitrogen",    nitrogen,    0, "",  false);
  appendSensor(j, "phosphorus",  phosphorus,  0, "",  false);
  appendSensor(j, "potassium",   potassium,   0, "",  true);
  j += "}}";
  server.send(200, "application/json", j);
}

void handleScan() {
  int n = WiFi.scanComplete();
  if (n == WIFI_SCAN_RUNNING) { server.send(200, "application/json", "{\"scanning\":true,\"networks\":[]}"); return; }
  if (n == WIFI_SCAN_FAILED)  { WiFi.scanNetworks(true, true); server.send(200, "application/json", "{\"scanning\":true,\"networks\":[]}"); return; }
  String j = "{\"scanning\":false,\"networks\":[";
  for (int i = 0; i < n; i++) {
    int q = constrain(2 * (WiFi.RSSI(i) + 100), 0, 100);
    j += "{\"ssid\":\"" + jsonEsc(WiFi.SSID(i)) + "\",\"quality\":" + String(q) +
         ",\"secure\":" + String(WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "false" : "true") + "}";
    if (i < n - 1) j += ",";
  }
  j += "]}";
  WiFi.scanDelete();
  server.send(200, "application/json", j);
}

void handleNetworks() {
  String cur = (WiFi.status() == WL_CONNECTED) ? WiFi.SSID() : "";
  String j = "{\"networks\":[";
  for (int i = 0; i < savedCount; i++) {
    j += "{\"ssid\":\"" + jsonEsc(savedNets[i].ssid) + "\",\"active\":" +
         String(savedNets[i].ssid == cur ? "true" : "false") + "}";
    if (i < savedCount - 1) j += ",";
  }
  j += "]}";
  server.send(200, "application/json", j);
}

void handleConnect() {
  String ssid = server.arg("ssid");
  String pwd  = server.arg("password");
  if (ssid.length() == 0) { server.send(400, "application/json", "{\"ok\":false,\"error\":\"ssid required\"}"); return; }
  if (pwd.length() || !passwordFor(ssid).length()) addNetwork(ssid, pwd);  // save/update creds
  autoConnect = true;
  targetSsid = ssid;                 // picked up next loop, overrides current attempt
  staState = STA_IDLE;
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleForget() {
  String ssid = server.arg("ssid");
  bool ok = removeNetwork(ssid);
  if (ok && WiFi.status() == WL_CONNECTED && WiFi.SSID() == ssid) { WiFi.disconnect(); staState = STA_IDLE; }
  server.send(200, "application/json", ok ? "{\"ok\":true}" : "{\"ok\":false}");
}

void handleDisconnect() {
  autoConnect = false;
  targetSsid = "";
  WiFi.disconnect();
  staState = STA_IDLE;
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleSettings() {
  if (server.hasArg("backend"))  { cfgBackend = server.arg("backend"); cfgBackend.trim(); prefs.putString("backend", cfgBackend); }
  if (server.hasArg("token"))    { cfgToken = server.arg("token"); cfgToken.trim(); prefs.putString("token", cfgToken); }
  if (server.hasArg("interval")) {
    long s = server.arg("interval").toInt();
    s = constrain(s, 5, 3600);
    cfgIntervalMs = (unsigned long)s * 1000UL;
    prefs.putUInt("interval", (uint32_t)s);
  }
  bool apChanged = false;
  if (server.hasArg("appwd")) { String p = server.arg("appwd"); if (p != cfgApPwd) { cfgApPwd = p; prefs.putString("appwd", cfgApPwd); apChanged = true; } }
  server.send(200, "application/json", "{\"ok\":true}");
  if (apChanged) { delay(200); startAP(); }
}

void handleRoot() { server.send_P(200, "text/html", PORTAL_HTML); }

// Captive-portal: send every unknown host/URL back to the setup page so the
// "sign in to Wi-Fi" sheet opens automatically on phones.
void handleNotFound() {
  server.sendHeader("Location", String("http://") + WiFi.softAPIP().toString(), true);
  server.send(302, "text/plain", "");
}

void registerRoutes() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/status",     HTTP_GET,  handleStatus);
  server.on("/api/scan",       HTTP_GET,  handleScan);
  server.on("/api/networks",   HTTP_GET,  handleNetworks);
  server.on("/api/connect",    HTTP_POST, handleConnect);
  server.on("/api/forget",     HTTP_POST, handleForget);
  server.on("/api/disconnect", HTTP_POST, handleDisconnect);
  server.on("/api/settings",   HTTP_POST, handleSettings);
  server.onNotFound(handleNotFound);
}

//================ SETUP =================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  Serial.begin(115200);

  // RS485 / Modbus soil sensor on UART2.
  RS485Serial.begin(RS485_BAUD, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);
  if (RS485_DE_PIN >= 0) { pinMode(RS485_DE_PIN, OUTPUT); digitalWrite(RS485_DE_PIN, LOW); }

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);   // pump off (active-LOW relay)

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("AGRIMIND BOOTING");

  loadConfig();

  // Unique hotspot name from the chip MAC: "AgriMind-1A2B".
  uint64_t id = ESP.getEfuseMac();
  char suffix[8];
  snprintf(suffix, sizeof(suffix), "%04X", (uint16_t)(id >> 32));
  apSsid = String("AgriMind-") + suffix;
  char hid[24];
  snprintf(hid, sizeof(hid), "ESP32-%012llX", (unsigned long long)id);
  hardwareId = hid;

  WiFi.persistent(false);
  WiFi.setAutoReconnect(false);    // we drive reconnection ourselves
  WiFi.mode(WIFI_AP_STA);          // hotspot + station at the same time
  WiFi.setSleep(false);
  startAP();
  dnsServer.start(53, "*", WiFi.softAPIP());   // captive portal DNS

  registerRoutes();
  server.begin();

  Serial.printf("Saved networks: %d. Join '%s' then open http://%s\n",
                savedCount, apSsid.c_str(), WiFi.softAPIP().toString().c_str());

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("AGRIMIND READY");
  lcd.setCursor(0, 1); lcd.print("Setup:");
  lcd.setCursor(0, 2); lcd.print(apSsid);
  lcd.setCursor(0, 3); lcd.print(WiFi.softAPIP().toString());
}

//================ LOOP =================
void loop() {
  dnsServer.processNextRequest();
  server.handleClient();
  manageWifi();

  readMoisture();
  controlPump();

  unsigned long now = millis();

  if (now - lastTick >= TICK_MS) {
    lastTick = now;
    readRS485Sensor();            // real 7-in-1 soil readings over Modbus
    statusLeds();
    lcdUpdate();
  }

  if (now - lastPrint >= PRINT_MS) {
    lastPrint = now;
    Serial.printf(
      "RS485:%s Moist:%.1f%% Temp:%.1fC pH:%.2f EC:%.3f N:%.0f P:%.0f K:%.0f Pump:%s WiFi:%s\n",
      rs485Online ? "ONLINE" : "OFFLINE",
      moisture, temperature, ph, ec, nitrogen, phosphorus, potassium,
      pumpState ? "ON" : "OFF",
      WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString().c_str() : "AP-only");
  }

  if (WiFi.status() == WL_CONNECTED && cfgToken.length() == 0) {
    // Unpaired: heartbeat to the backend so the farmer can discover + claim us.
    if (now - lastAnnounce >= ANNOUNCE_EVERY) {
      lastAnnounce = now;
      announceDevice();
    }
  } else if (now - lastSend >= cfgIntervalMs) {
    lastSend = now;
    sendTelemetry();
  }

  delay(20);
}
