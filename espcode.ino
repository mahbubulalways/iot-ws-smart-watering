#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

#define TRIG_PIN 4
#define ECHO_PIN 2
#define DHT_PIN 26
#define DHT_TYPE DHT11
#define SOIL_MOISTURE_AO 34
#define RELAY_PIN 18  

const char* ssid = "Mahbubul";
const char* password = "11223344";
const char* host = "iot-ws-smart-watering.onrender.com";
const int port = 443;
const char* path = "/";

WebSocketsClient webSocket;
DHT dht(DHT_PIN, DHT_TYPE);
unsigned long lastSend = 0;

void connectWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
  Serial.println(WiFi.localIP());
  connectWS();
}

void connectWS() {
  Serial.println("Connecting WebSocket...");
  webSocket.disconnect();
  delay(500);
  webSocket.beginSSL(host, port, path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);     // ← এড করো
  digitalWrite(RELAY_PIN, HIGH);  // শুরুতে OFF
  dht.begin();
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  connectWiFi();
}

void loop() {
  webSocket.loop();
  if (webSocket.isConnected() && millis() - lastSend > 3000) {
    lastSend = millis();
    float waterLevel = getWaterLevel();
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();
    float soilMoisture = getSoilMoisture();

    StaticJsonDocument<256> doc;
    doc["event"] = "sensor-info";
    doc["data"]["waterLevel"] = waterLevel;
    doc["data"]["temperature"] = temperature;
    doc["data"]["humidity"] = humidity;
    doc["data"]["soilMoisture"] = soilMoisture;

    String msg;
    serializeJson(doc, msg);
    webSocket.sendTXT(msg);
    Serial.println("Sent: " + msg);
  }
}

float getWaterLevel() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  float distance = duration * 0.034 / 2;
  float percentage = ((10.0 - distance) / 10.0) * 100;
  return constrain(percentage, 0, 100);
}

float getSoilMoisture() {
  int rawValue = analogRead(SOIL_MOISTURE_AO);
  float moisture = map(rawValue, 0, 4095, 100, 0);
  return constrain(moisture, 0, 100);
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("WebSocket Connected ✅");
      webSocket.sendTXT("{\"event\":\"backend-connect\",\"data\":\"esp32 online\"}");
      break;
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected ❌");
      break;
    case WStype_TEXT:
      {
        String msg = String((char*)payload);
        Serial.println("Received: " + msg);
        StaticJsonDocument<256> doc;
        DeserializationError err = deserializeJson(doc, msg);

        String event = doc["event"].as<String>();
        Serial.println(event);

        if (event == "app-motor-state") {
          Serial.println("APP MOTOR STATE BLOCK A DHUKSE");
          String state = doc["data"].as<String>();
          if (state == "ON") {
            digitalWrite(RELAY_PIN, LOW);  // Motor ON
            Serial.println("MOTOR ON ✅");
          } else if (state == "OFF") {
            digitalWrite(RELAY_PIN, HIGH);  // Motor OFF
            Serial.println("MOTOR OFF ❌");
          }
        }
      }
    default:
      break;
  }
}