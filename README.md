import { WebSocket } from "ws";
import { send, broadcast, WSMessage } from "./ws";

import { SensorService } from "../app/sensor_info/sensor_info.service";
import { SittingService } from "../app/sittings/sittings.service";
import { ESP_32_INFO } from "../interface";

// GLOBAL STATE
let MOTOR_MODE: "AUTO" | "MANUAL" = "MANUAL";
let MANUAL_MOTOR_STATE: "ON" | "OFF" | null = null;
let LAST_MANUAL_STATE: "ON" | "OFF" | null = null;
let LAST_AUTO_STATE: boolean | null = null;

const DRY = 30;
const WET = 60;

let CURRENT_SENSOR: ESP_32_INFO | null = null;

let activeSession: {
start: ESP_32_INFO;
motorStart: Date;
} | null = null;

// Load mode
async function initMotorMode() {
MOTOR_MODE = await SittingService.getMotorModeFromDB();
}

initMotorMode();

export const socketEvents = (ws: WebSocket) => {
send(ws, "app-motor-mode", MOTOR_MODE);

ws.on("message", async (message: Buffer) => {
try {
const parsed: WSMessage = JSON.parse(message.toString());

      switch (parsed.event) {
        case "motor-mode:update":
          await handleMotorMode(parsed.data);
          break;

        case "app-motor-state":
          handleManualState(parsed.data);
          break;

        case "sensor-info":
          await handleSensor(parsed.data);
          break;

        case "history:request":
          await handleHistory(ws);
          break;
      }
    } catch (error) {
      console.log("Invalid message");
    }

});
};

// MOTOR MODE
const handleMotorMode = async (mode: "AUTO" | "MANUAL") => {
if (mode === "AUTO") {
MANUAL_MOTOR_STATE = null;
LAST_MANUAL_STATE = null;
LAST_AUTO_STATE = null;
}

const motor_mode = await SittingService.updateMotorMode(mode);
MOTOR_MODE = motor_mode ?? "MANUAL";

broadcast("app-motor-mode", MOTOR_MODE);
};

// MANUAL
const handleManualState = (state: "ON" | "OFF" | null) => {
MANUAL_MOTOR_STATE = state;
broadcast("app-motor-state", state);
};

// SENSOR
const handleSensor = async (data: ESP_32_INFO) => {
CURRENT_SENSOR = data;

broadcast("live-info", data);

if (MOTOR_MODE === "AUTO") {
if (
CURRENT_SENSOR &&
CURRENT_SENSOR.soilMoisture < DRY &&
LAST_AUTO_STATE !== true
) {
broadcast("esp-motor-state", true);

      activeSession = {
        start: { ...CURRENT_SENSOR },
        motorStart: new Date(),
      };

      LAST_AUTO_STATE = true;
    }

    if (
      CURRENT_SENSOR &&
      CURRENT_SENSOR.soilMoisture > WET &&
      LAST_AUTO_STATE !== false &&
      activeSession
    ) {
      broadcast("esp-motor-state", false);

      try {
        await SensorService.storeSensorInformationToDB({
          soilMoistureStart: activeSession.start.soilMoisture,
          soilMoistureEnd: CURRENT_SENSOR.soilMoisture,

          temperatureStart: activeSession.start.temperature,
          temperatureEnd: CURRENT_SENSOR.temperature,

          humidityStart: activeSession.start.humidity,
          humidityEnd: CURRENT_SENSOR.humidity,

          waterLevelStart: activeSession.start.waterLevel,
          waterLevelEnd: CURRENT_SENSOR.waterLevel,

          motorStart: activeSession.motorStart,
          motorOff: new Date(),
        });
      } catch {
        console.log("Data not stored");
      }

      activeSession = null;
      LAST_AUTO_STATE = false;
    }

}
};

// HISTORY
const handleHistory = async (ws: WebSocket) => {
try {
const result = await SensorService.getMotorHistoryFromDB();

    send(ws, "history:response", {
      success: true,
      data: result,
    });

} catch {
send(ws, "history:response", {
success: false,
});
}
};
