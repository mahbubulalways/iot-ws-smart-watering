"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketEvents = void 0;
const ws_1 = require("./ws");
const sensor_info_service_1 = require("../app/sensor_info/sensor_info.service");
const sittings_service_1 = require("../app/sittings/sittings.service");
// GLOBAL STATE
let MOTOR_MODE = "MANUAL";
let MANUAL_MOTOR_STATE = null;
let LAST_MANUAL_STATE = null;
let LAST_AUTO_STATE = null;
const DRY = 30;
const WET = 60;
let CURRENT_SENSOR = null;
let activeSession = null;
// Load mode
async function initMotorMode() {
    MOTOR_MODE = await sittings_service_1.SittingService.getMotorModeFromDB();
}
initMotorMode();
const socketEvents = (ws) => {
    (0, ws_1.send)(ws, "app-motor-mode", MOTOR_MODE);
    ws.on("message", async (message) => {
        try {
            const parsed = JSON.parse(message.toString());
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
        }
        catch (error) {
            console.log("Invalid message");
        }
    });
};
exports.socketEvents = socketEvents;
// MOTOR MODE
const handleMotorMode = async (mode) => {
    if (mode === "AUTO") {
        MANUAL_MOTOR_STATE = null;
        LAST_MANUAL_STATE = null;
        LAST_AUTO_STATE = null;
    }
    const motor_mode = await sittings_service_1.SittingService.updateMotorMode(mode);
    MOTOR_MODE = motor_mode ?? "MANUAL";
    (0, ws_1.broadcast)("app-motor-mode", MOTOR_MODE);
};
// MANUAL
const handleManualState = (state) => {
    MANUAL_MOTOR_STATE = state;
    (0, ws_1.broadcast)("app-motor-state", state);
};
// SENSOR
const handleSensor = async (data) => {
    CURRENT_SENSOR = data;
    (0, ws_1.broadcast)("live-info", data);
    if (MOTOR_MODE === "AUTO") {
        if (CURRENT_SENSOR &&
            CURRENT_SENSOR.soilMoisture < DRY &&
            LAST_AUTO_STATE !== true) {
            (0, ws_1.broadcast)("esp-motor-state", true);
            activeSession = {
                start: { ...CURRENT_SENSOR },
                motorStart: new Date(),
            };
            LAST_AUTO_STATE = true;
        }
        if (CURRENT_SENSOR &&
            CURRENT_SENSOR.soilMoisture > WET &&
            LAST_AUTO_STATE !== false &&
            activeSession) {
            (0, ws_1.broadcast)("esp-motor-state", false);
            try {
                await sensor_info_service_1.SensorService.storeSensorInformationToDB({
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
            }
            catch {
                console.log("Data not stored");
            }
            activeSession = null;
            LAST_AUTO_STATE = false;
        }
    }
};
// HISTORY
const handleHistory = async (ws) => {
    try {
        const result = await sensor_info_service_1.SensorService.getMotorHistoryFromDB();
        (0, ws_1.send)(ws, "history:response", {
            success: true,
            data: result,
        });
    }
    catch {
        (0, ws_1.send)(ws, "history:response", {
            success: false,
        });
    }
};
