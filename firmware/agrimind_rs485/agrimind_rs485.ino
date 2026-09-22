#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ModbusMaster.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// =====================================================================
//  AgriMind — REAL 7-in-1 RS485 soil sensor build (JXBS-3001 register map)
//  Reads pH, soil moisture, temperature, EC, N, P, K over Modbus RTU and
//  POSTs them to the AgriMind telemetry endpoint. Aligned with the backend:
//  {"token": <device token>, "readings":[{sensor_type,value,optimal_min,optimal_max}]}
//
//  NOTE on labelling: the RS485 probe measures SOIL MOISTURE (not air
//  humidity). It is therefore sent to the backend as sensor_type "moisture"
//  (the authoritative reading). The capacitive probe is a local cross-check /
//  irrigation fallback and is not sent, so the dashboard shows one clean set.
// =====================================================================

//======================================================
//                    CONFIGURATION
//======================================================
const char* WIFI_SSID     = "I-am-Groot-2G";
const char* WIFI_PASSWORD = "ot!npSK1121";

const char* BACKEND_URL =
  "https://undated-reunion-scowling.ngrok-free.dev/api/v1/iot/telemetry/";

const char* DEVICE_TOKEN = "4932f5d487f362ddfc12ac2023f966c2";

const unsigned long SEND_INTERVAL_MS        = 30000;
const unsigned long SENSOR_READ_INTERVAL_MS = 3000;
const unsigned long LCD_UPDATE_INTERVAL_MS  = 2000;
const unsigned long PRINT_INTERVAL_MS       = 5000;
const unsigned long WIFI_RETRY_MS           = 10000;
const unsigned long FUNCTION_RETEST_MS       = 15000;
const unsigned long DATA_FRESH_LIMIT_MS     = 10000;
const uint16_t HTTP_TIMEOUT_MS               = 5000;

//======================================================
//        COMMON BEANS RECOMMENDED OPERATING BANDS
//======================================================
const float MOISTURE_MIN = 40.0;
const float MOISTURE_MAX = 70.0;
const float TEMP_MIN     = 18.0;
const float TEMP_MAX     = 27.0;
const float PH_MIN       = 6.0;
const float PH_MAX       = 7.0;
const float EC_MIN       = 0.4;
const float EC_MAX       = 1.6;
const float N_MIN        = 50.0;
const float N_MAX        = 200.0;
const float P_MIN        = 25.0;
const float P_MAX        = 90.0;
const float K_MIN        = 120.0;
const float K_MAX        = 280.0;

//======================================================
//                 IRRIGATION THRESHOLDS
//======================================================
const float DRY_LEVEL = 40.0;
const float WET_LEVEL = 65.0;

//======================================================
//                       PINS
//======================================================
#define CAPACITIVE_MOISTURE_PIN 34
#define RELAY_PIN               23
#define GREEN_LED               26
#define RED_LED                 27
#define BUZZER_PIN              25

// MAX485 / RS485 pins
#define MAX485_RE_DE 4
#define RS485_RX     16
#define RS485_TX     17

//======================================================
//               MODBUS SENSOR SETTINGS
//======================================================
#define SOIL_SENSOR_SLAVE_ID 1
#define SOIL_SENSOR_BAUD     9600

// JXBS-3001 / scattered holding-register map.
// The sensor answered function 0x03 but rejected address 0x0000,
// so the measurements must be requested from their real addresses.
#define REG_SOIL_PH          0x0006  // raw / 100 = pH
#define REG_SOIL_MOISTURE    0x0012  // raw / 10  = %RH
#define REG_SOIL_TEMPERATURE 0x0013  // signed raw / 10 = deg C
#define REG_SOIL_EC          0x0015  // raw = uS/cm
#define REG_SOIL_NITROGEN    0x001E  // mg/kg
#define REG_SOIL_PHOSPHORUS  0x001F  // mg/kg
#define REG_SOIL_POTASSIUM   0x0020  // mg/kg

//======================================================
//                  OBJECTS AND GLOBALS
//======================================================
WebServer server(80);
LiquidCrystal_I2C lcd(0x27, 20, 4);
HardwareSerial RS485Serial(2);
ModbusMaster node;

enum ModbusFunctionMode : uint8_t {
  MODE_UNKNOWN = 0,
  MODE_HOLDING_REGISTERS,
  MODE_INPUT_REGISTERS
};

ModbusFunctionMode activeModbusMode = MODE_HOLDING_REGISTERS;

// Real capacitive sensor values (local cross-check / irrigation fallback)
float moisture = NAN;
int capacitiveRaw = 0;

// Real RS485 sensor values
float soilMoistureRS = NAN;   // RS485 soil moisture (%), the authoritative reading
float temperature = NAN;
float ph = NAN;
float ec = NAN;
float nitrogen = NAN;
float phosphorus = NAN;
float potassium = NAN;

bool pumpState = false;
bool rs485ReadOK = false;
bool hasRealRS485Data = false;

uint8_t lastHoldingResult = 0xFF;
uint8_t lastInputResult = 0xFF;
uint8_t lastBulkResult = 0xFF;

unsigned long lastSend = 0;
unsigned long lastSensorRead = 0;
unsigned long lastLcdUpdate = 0;
unsigned long lastPrint = 0;
unsigned long lastWifiCheck = 0;
unsigned long lastFunctionTest = 0;
unsigned long lastGoodRS485Read = 0;

//======================================================
//                 FUNCTION DECLARATIONS
//======================================================
void preTransmission();
void postTransmission();
void readCapacitiveMoisture();
uint8_t readHoldingRegisters(uint16_t startAddress, uint16_t quantity);
bool readRS485SoilSensor();
bool validateRS485Values(float m, float t, float conductivity,
                         float soilPH, float n, float p, float k);
const char* modbusModeText();
void printModbusResult(const char* label, uint16_t address, uint8_t result);
float irrigationMoisture();
void controlPump();
void updateAlerts();
void updateLCD();
void sendTelemetry();
void ensureWifi();
const char* wifiStatusText(int status);
String valueText(float value, int decimals);
String makeWebPage();
void handleRoot();

//======================================================
//              MAX485 DIRECTION CONTROL
//======================================================
void preTransmission() {
  digitalWrite(MAX485_RE_DE, HIGH);
  delayMicroseconds(300);
}

void postTransmission() {
  delayMicroseconds(300);
  digitalWrite(MAX485_RE_DE, LOW);
}

//======================================================
//          REAL CAPACITIVE MOISTURE READING
//======================================================
void readCapacitiveMoisture() {
  const int samples = 10;
  long total = 0;

  for (int i = 0; i < samples; i++) {
    total += analogRead(CAPACITIVE_MOISTURE_PIN);
    delay(3);
  }

  capacitiveRaw = total / samples;

  // Calibrate these dry and wet values using your own probe.
  moisture = map(capacitiveRaw, 4095, 1500, 0, 100);
  moisture = constrain(moisture, 0.0f, 100.0f);
}

//======================================================
//              MODBUS HOLDING-REGISTER READ
//======================================================
uint8_t readHoldingRegisters(uint16_t startAddress, uint16_t quantity) {
  node.clearResponseBuffer();
  digitalWrite(MAX485_RE_DE, LOW);
  delay(20);
  return node.readHoldingRegisters(startAddress, quantity);
}

void printModbusResult(const char* label, uint16_t address, uint8_t result) {
  Serial.print(label);
  Serial.printf(" 0x%04X -> 0x%02X", address, result);

  if (result == node.ku8MBSuccess) {
    Serial.println(" OK");
  } else if (result == 0x01) {
    Serial.println(" ILLEGAL FUNCTION");
  } else if (result == 0x02) {
    Serial.println(" ILLEGAL ADDRESS");
  } else if (result == 0xE2) {
    Serial.println(" TIMEOUT");
  } else {
    Serial.println();
  }
}

const char* modbusModeText() {
  return "0x03 HOLDING";
}

//======================================================
//          REAL 7-IN-1 RS485 SENSOR READING
//======================================================
bool readRS485SoilSensor() {
  Serial.println();
  Serial.println("========== REAL MODBUS READ ==========");
  Serial.printf("Slave ID: %d | Baud: %d | Function: 0x03\n",
                SOIL_SENSOR_SLAVE_ID, SOIL_SENSOR_BAUD);

  // 1) pH at 0x0006
  uint8_t resultPH = readHoldingRegisters(REG_SOIL_PH, 1);
  printModbusResult("pH register", REG_SOIL_PH, resultPH);
  if (resultPH != node.ku8MBSuccess) {
    rs485ReadOK = false;
    Serial.println("======================================");
    return false;
  }
  uint16_t rawPH = node.getResponseBuffer(0);
  delay(120);

  // 2) Moisture and temperature are consecutive at 0x0012-0x0013
  uint8_t resultMT = readHoldingRegisters(REG_SOIL_MOISTURE, 2);
  printModbusResult("Moisture/temp block", REG_SOIL_MOISTURE, resultMT);
  if (resultMT != node.ku8MBSuccess) {
    rs485ReadOK = false;
    Serial.println("======================================");
    return false;
  }
  uint16_t rawMoisture = node.getResponseBuffer(0);
  int16_t rawTemperature = (int16_t)node.getResponseBuffer(1);
  delay(120);

  // 3) Electrical conductivity at 0x0015
  uint8_t resultEC = readHoldingRegisters(REG_SOIL_EC, 1);
  printModbusResult("EC register", REG_SOIL_EC, resultEC);
  if (resultEC != node.ku8MBSuccess) {
    rs485ReadOK = false;
    Serial.println("======================================");
    return false;
  }
  uint16_t rawEC = node.getResponseBuffer(0);
  delay(120);

  // 4) N, P and K are consecutive at 0x001E-0x0020
  uint8_t resultNPK = readHoldingRegisters(REG_SOIL_NITROGEN, 3);
  printModbusResult("NPK block", REG_SOIL_NITROGEN, resultNPK);
  if (resultNPK != node.ku8MBSuccess) {
    rs485ReadOK = false;
    Serial.println("======================================");
    return false;
  }

  uint16_t rawN = node.getResponseBuffer(0);
  uint16_t rawP = node.getResponseBuffer(1);
  uint16_t rawK = node.getResponseBuffer(2);

  // Convert according to the sensor register units.
  float newMoisture = rawMoisture / 10.0f;      // %RH (soil moisture)
  float newTemperature = rawTemperature / 10.0f;
  float newEC = rawEC / 1000.0f;  // uS/cm -> mS/cm
  float newPH = rawPH / 100.0f;   // register unit is 0.01 pH
  float newNitrogen = rawN;
  float newPhosphorus = rawP;
  float newPotassium = rawK;

  Serial.println("Raw register values:");
  Serial.printf("pH=%u Moisture=%u Temperature=%d EC=%u N=%u P=%u K=%u\n",
                rawPH, rawMoisture, rawTemperature, rawEC,
                rawN, rawP, rawK);

  if (!validateRS485Values(newMoisture, newTemperature, newEC,
                           newPH, newNitrogen,
                           newPhosphorus, newPotassium)) {
    Serial.println("Values received, but one or more are outside valid ranges.");
    rs485ReadOK = false;
    Serial.println("======================================");
    return false;
  }

  soilMoistureRS = newMoisture;
  temperature = newTemperature;
  ec = newEC;
  ph = newPH;
  nitrogen = newNitrogen;
  phosphorus = newPhosphorus;
  potassium = newPotassium;

  rs485ReadOK = true;
  hasRealRS485Data = true;
  lastGoodRS485Read = millis();

  Serial.println("Converted real values:");
  Serial.printf("Soil moisture: %.1f %% | Temperature: %.1f C | pH: %.2f\n",
                soilMoistureRS, temperature, ph);
  Serial.printf("EC: %.3f mS/cm | N: %.0f | P: %.0f | K: %.0f mg/kg\n",
                ec, nitrogen, phosphorus, potassium);
  Serial.println("RS485 real data read successfully.");
  Serial.println("======================================");
  return true;
}

bool validateRS485Values(float m, float t, float conductivity,
                         float soilPH, float n, float p, float k) {
  if (m < 0.0f || m > 100.0f) return false;
  if (t < -40.0f || t > 85.0f) return false;
  if (conductivity < 0.0f || conductivity > 20.0f) return false;
  if (soilPH < 0.0f || soilPH > 14.0f) return false;
  if (n < 0.0f || n > 5000.0f) return false;
  if (p < 0.0f || p > 5000.0f) return false;
  if (k < 0.0f || k > 5000.0f) return false;
  return true;
}

//======================================================
//                  SMART IRRIGATION
//======================================================
// Prefer the RS485 soil-moisture reading (accurate); fall back to the
// capacitive probe if the RS485 sensor hasn't produced fresh data.
float irrigationMoisture() {
  bool fresh = hasRealRS485Data &&
               (millis() - lastGoodRS485Read <= DATA_FRESH_LIMIT_MS) &&
               !isnan(soilMoistureRS);
  return fresh ? soilMoistureRS : moisture;
}

void controlPump() {
  float m = irrigationMoisture();
  if (isnan(m)) return;

  if (m < DRY_LEVEL) {
    pumpState = true;
    digitalWrite(RELAY_PIN, LOW);
  } else if (m > WET_LEVEL) {
    pumpState = false;
    digitalWrite(RELAY_PIN, HIGH);
  }
}

//======================================================
//                 LED AND BUZZER ALERTS
//======================================================
void updateAlerts() {
  float m = irrigationMoisture();
  bool drySoil = !isnan(m) && m < DRY_LEVEL;

  digitalWrite(RED_LED, drySoil ? HIGH : LOW);
  digitalWrite(GREEN_LED, drySoil ? LOW : HIGH);

  if (drySoil) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(60);
    digitalWrite(BUZZER_PIN, LOW);
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
}

//======================================================
//                     LCD FUNCTIONS
//======================================================
String valueText(float value, int decimals) {
  if (isnan(value)) return "--";
  return String(value, decimals);
}

void updateLCD() {
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Moist:");
  lcd.print(valueText(soilMoistureRS, 0));
  lcd.print("% T:");
  lcd.print(valueText(temperature, 1));

  lcd.setCursor(0, 1);
  lcd.print("pH:");
  lcd.print(valueText(ph, 1));
  lcd.print(" EC:");
  lcd.print(valueText(ec, 2));

  lcd.setCursor(0, 2);
  lcd.print("N:");
  lcd.print(valueText(nitrogen, 0));
  lcd.print(" P:");
  lcd.print(valueText(phosphorus, 0));
  lcd.print(" K:");
  lcd.print(valueText(potassium, 0));

  lcd.setCursor(0, 3);
  lcd.print("Cap:");
  lcd.print(valueText(moisture, 0));
  lcd.print("% Pump:");
  lcd.print(pumpState ? "ON" : "OFF");
}

//======================================================
//                 BACKEND JSON HELPER
//======================================================
static void addReading(String& body, const char* type, float value,
                       int decimals, float optimalMin,
                       float optimalMax, bool last) {
  body += "{\"sensor_type\":\"";
  body += type;
  body += "\",\"value\":";
  body += String(value, decimals);
  body += ",\"optimal_min\":";
  body += String(optimalMin, 1);
  body += ",\"optimal_max\":";
  body += String(optimalMax, 1);
  body += "}";

  if (!last) body += ",";
}

//======================================================
//                  SEND REAL TELEMETRY
//======================================================
void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Telemetry skipped: Wi-Fi is offline.");
    return;
  }

  bool dataFresh = hasRealRS485Data &&
                   millis() - lastGoodRS485Read <= DATA_FRESH_LIMIT_MS;

  if (!dataFresh) {
    Serial.println("Telemetry skipped: no fresh real RS485 data.");
    return;
  }

  if (isnan(soilMoistureRS) || isnan(temperature) ||
      isnan(ph) || isnan(ec) || isnan(nitrogen) ||
      isnan(phosphorus) || isnan(potassium)) {
    Serial.println("Telemetry skipped: invalid sensor value.");
    return;
  }

  // Only real sensors are sent. RS485 soil moisture is the authoritative
  // "moisture"; the soil probe has no air-humidity channel, so humidity is
  // intentionally omitted (no simulated values).
  String body = "{\"token\":\"" + String(DEVICE_TOKEN) +
                "\",\"readings\":[";

  addReading(body, "moisture", soilMoistureRS, 1,
             MOISTURE_MIN, MOISTURE_MAX, false);
  addReading(body, "temperature", temperature, 1,
             TEMP_MIN, TEMP_MAX, false);
  addReading(body, "ph", ph, 2,
             PH_MIN, PH_MAX, false);
  addReading(body, "ec", ec, 3,
             EC_MIN, EC_MAX, false);
  addReading(body, "nitrogen", nitrogen, 0,
             N_MIN, N_MAX, false);
  addReading(body, "phosphorus", phosphorus, 0,
             P_MIN, P_MAX, false);
  addReading(body, "potassium", potassium, 0,
             K_MIN, K_MAX, true);

  body += "],\"pump\":";
  body += (pumpState ? "true" : "false");
  body += "}";

  bool secure = String(BACKEND_URL).startsWith("https");
  WiFiClientSecure tlsClient;
  WiFiClient plainClient;
  HTTPClient http;

  tlsClient.setInsecure();
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);

  bool started = secure
                   ? http.begin(tlsClient, BACKEND_URL)
                   : http.begin(plainClient, BACKEND_URL);

  if (!started) {
    Serial.println("HTTP initialization failed.");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");

  int httpCode = http.POST(body);

  Serial.print("POST telemetry -> HTTP ");
  Serial.println(httpCode);

  if (httpCode >= 200 && httpCode < 300) {
    Serial.println("Real sensor readings delivered successfully.");

    String response = http.getString();
    if (response.length() > 0) {
      Serial.println(response);
    }
  } else {
    Serial.print("HTTP error: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

//======================================================
//                    WI-FI FUNCTIONS
//======================================================
const char* wifiStatusText(int status) {
  switch (status) {
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

  Serial.printf("Wi-Fi offline (%s). Retrying...\n",
                wifiStatusText(WiFi.status()));

  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

//======================================================
//                    LOCAL WEB PAGE
//======================================================
String makeWebPage() {
  bool fresh = hasRealRS485Data &&
               millis() - lastGoodRS485Read <= DATA_FRESH_LIMIT_MS;

  String html = "<!DOCTYPE html><html><head>";
  html += "<meta http-equiv='refresh' content='5'>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>AGRIMIND</title>";
  html += "<style>body{font-family:Arial;background:#f4f7f4;margin:0;padding:20px;}";
  html += ".card{max-width:650px;margin:auto;background:white;padding:22px;border-radius:14px;";
  html += "box-shadow:0 4px 18px rgba(0,0,0,.12)}h2{color:#176b35}.ok{color:green}.bad{color:red}";
  html += "p{font-size:17px;border-bottom:1px solid #eee;padding:8px 0}</style>";
  html += "</head><body><div class='card'>";
  html += "<h2>AGRIMIND SMART FARM</h2>";

  html += "<p>Modbus mode: <b>" + String(modbusModeText()) + "</b></p>";
  html += "<p>RS485 sensor: <b class='";
  html += fresh ? "ok'>ONLINE" : "bad'>NO FRESH DATA";
  html += "</b></p>";

  html += "<p>RS485 soil moisture: <b>" + valueText(soilMoistureRS, 1) + "%</b></p>";
  html += "<p>Capacitive moisture: <b>" + valueText(moisture, 1) + "%</b>";
  html += " (raw " + String(capacitiveRaw) + ")</p>";
  html += "<p>Soil temperature: <b>" + valueText(temperature, 1) + " &deg;C</b></p>";
  html += "<p>Soil pH: <b>" + valueText(ph, 1) + "</b></p>";
  html += "<p>Electrical conductivity: <b>" + valueText(ec, 3) + " mS/cm</b></p>";
  html += "<p>Nitrogen: <b>" + valueText(nitrogen, 0) + " mg/kg</b></p>";
  html += "<p>Phosphorus: <b>" + valueText(phosphorus, 0) + " mg/kg</b></p>";
  html += "<p>Potassium: <b>" + valueText(potassium, 0) + " mg/kg</b></p>";
  html += "<p>Pump: <b>" + String(pumpState ? "ON" : "OFF") + "</b></p>";

  if (WiFi.status() == WL_CONNECTED) {
    html += "<p>ESP32 IP: <b>" + WiFi.localIP().toString() + "</b></p>";
  } else {
    html += "<p>Wi-Fi: <b class='bad'>OFFLINE</b></p>";
  }

  html += "</div></body></html>";
  return html;
}

void handleRoot() {
  server.send(200, "text/html", makeWebPage());
}

//======================================================
//                         SETUP
//======================================================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(500);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(MAX485_RE_DE, OUTPUT);
  pinMode(CAPACITIVE_MOISTURE_PIN, INPUT);

  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(MAX485_RE_DE, LOW);

  analogReadResolution(12);
  analogSetPinAttenuation(CAPACITIVE_MOISTURE_PIN, ADC_11db);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("AGRIMIND BOOTING");
  lcd.setCursor(0, 1);
  lcd.print("Reading RS485...");

  RS485Serial.begin(
    SOIL_SENSOR_BAUD,
    SERIAL_8N1,
    RS485_RX,
    RS485_TX
  );

  node.begin(SOIL_SENSOR_SLAVE_ID, RS485Serial);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);

  Serial.printf("Connecting to Wi-Fi '%s'\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected. ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.printf("Wi-Fi failed (%s). Running locally.\n",
                  wifiStatusText(WiFi.status()));
  }

  server.on("/", handleRoot);
  server.begin();
  Serial.println("Local web server started.");

  readCapacitiveMoisture();
  readRS485SoilSensor();
  controlPump();
  updateAlerts();
  updateLCD();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("AGRIMIND READY");
  lcd.setCursor(0, 1);
  lcd.print(modbusModeText());
  lcd.setCursor(0, 2);
  lcd.print(rs485ReadOK ? "RS485 SENSOR OK" : "RS485 ERROR");
  delay(1500);
}

//======================================================
//                          LOOP
//======================================================
void loop() {
  server.handleClient();
  ensureWifi();

  unsigned long now = millis();

  readCapacitiveMoisture();
  controlPump();

  if (now - lastSensorRead >= SENSOR_READ_INTERVAL_MS) {
    lastSensorRead = now;
    readRS485SoilSensor();
  }

  if (now - lastLcdUpdate >= LCD_UPDATE_INTERVAL_MS) {
    lastLcdUpdate = now;
    updateAlerts();
    updateLCD();
  }

  if (now - lastPrint >= PRINT_INTERVAL_MS) {
    lastPrint = now;

    String ipText = WiFi.status() == WL_CONNECTED
                      ? WiFi.localIP().toString()
                      : "offline";

    Serial.println("---------------- REAL SENSOR DATA ----------------");
    Serial.printf("Capacitive raw: %d\n", capacitiveRaw);
    Serial.printf("Capacitive moisture: %.1f %%\n", moisture);
    Serial.printf("Selected Modbus mode: %s\n", modbusModeText());

    if (hasRealRS485Data) {
      Serial.printf("RS485 soil moisture: %.1f %%\n", soilMoistureRS);
      Serial.printf("Soil temperature: %.1f C\n", temperature);
      Serial.printf("Soil pH: %.1f\n", ph);
      Serial.printf("EC: %.3f mS/cm\n", ec);
      Serial.printf("Nitrogen: %.0f mg/kg\n", nitrogen);
      Serial.printf("Phosphorus: %.0f mg/kg\n", phosphorus);
      Serial.printf("Potassium: %.0f mg/kg\n", potassium);
    } else {
      Serial.println("RS485 values: NO VALID REAL READING YET");
    }

    Serial.printf("Pump: %s\n", pumpState ? "ON" : "OFF");
    Serial.printf("RS485 status: %s\n", rs485ReadOK ? "OK" : "ERROR");
    Serial.printf("Wi-Fi: %s\n", ipText.c_str());
    Serial.println("--------------------------------------------------");
  }

  if (now - lastSend >= SEND_INTERVAL_MS) {
    lastSend = now;
    sendTelemetry();
  }

  delay(50);
}
