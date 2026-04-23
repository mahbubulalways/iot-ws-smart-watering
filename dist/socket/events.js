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
        // Close any active manual session
        if (activeSession && activeSession.isManual) {
            await closeSensorSession(activeSession);
            activeSession = null;
        }
    }
    if (mode === "MANUAL") {
        (0, ws_1.broadcast)("app-motor-state", "OFF");
        LAST_AUTO_STATE = null;
        // Close any active auto session
        if (activeSession && !activeSession.isManual) {
            await closeSensorSession(activeSession);
            activeSession = null;
        }
    }
    const motor_mode = await sittings_service_1.SittingService.updateMotorMode(mode);
    MOTOR_MODE = motor_mode ?? "MANUAL";
    console.log(`🔄 Motor Mode Changed to: ${MOTOR_MODE}`);
    (0, ws_1.broadcast)("app-motor-mode", MOTOR_MODE);
};
// MANUAL
const handleManualState = (state) => {
    console.log(`🎮 Manual Motor State: ${state}`);
    MANUAL_MOTOR_STATE = state;
    // Send to ESP32 (using correct event name)
    (0, ws_1.broadcast)("app-motor-state", state);
    // START MANUAL SESSION
    if (state === "ON" && !activeSession) {
        console.log("📝 Starting Manual Motor Session...");
        activeSession = {
            start: { ...CURRENT_SENSOR },
            motorStart: new Date(),
            isManual: true,
        };
    }
    // END MANUAL SESSION & SAVE HISTORY
    if (state === "OFF" && activeSession && activeSession.isManual) {
        console.log("💾 Saving Manual Motor Session to Database...");
        closeSensorSession(activeSession);
        activeSession = null;
    }
    LAST_MANUAL_STATE = state;
};
// SENSOR
const handleSensor = async (data) => {
    CURRENT_SENSOR = data;
    console.log("📊 Sensor Data Received:", {
        soilMoisture: data.soilMoisture,
        temperature: data.temperature,
        humidity: data.humidity,
        waterLevel: data.waterLevel,
    });
    (0, ws_1.broadcast)("live-info", data);
    // AUTO MODE LOGIC
    if (MOTOR_MODE === "AUTO") {
        // TURN ON MOTOR when soil is DRY
        if (CURRENT_SENSOR &&
            CURRENT_SENSOR.soilMoisture < DRY &&
            LAST_AUTO_STATE !== true) {
            console.log("🌱 Soil Dry! Starting Auto Motor...");
            // ✅ FIX: Send correct event to ESP32
            (0, ws_1.broadcast)("app-motor-state", "ON");
            activeSession = {
                start: { ...CURRENT_SENSOR },
                motorStart: new Date(),
                isManual: false,
            };
            LAST_AUTO_STATE = true;
        }
        // TURN OFF MOTOR when soil is WET
        if (CURRENT_SENSOR &&
            CURRENT_SENSOR.soilMoisture > WET &&
            LAST_AUTO_STATE !== false &&
            activeSession &&
            !activeSession.isManual) {
            console.log("💧 Soil Wet! Stopping Auto Motor...");
            // ✅ FIX: Send correct event to ESP32
            (0, ws_1.broadcast)("app-motor-state", "OFF");
            // Save the session
            await closeSensorSession(activeSession);
            activeSession = null;
            LAST_AUTO_STATE = false;
        }
    }
    // MANUAL MODE: Update active session with latest sensor data
    if (MOTOR_MODE === "MANUAL" && activeSession && activeSession.isManual) {
        activeSession.start = { ...CURRENT_SENSOR };
    }
};
// Close session and save to database
const closeSensorSession = async (session) => {
    try {
        console.log(`💾 Saving ${session.isManual ? "Manual" : "Auto"} Motor Session...`);
        await sensor_info_service_1.SensorService.storeSensorInformationToDB({
            soilMoistureStart: session.start.soilMoisture,
            soilMoistureEnd: CURRENT_SENSOR?.soilMoisture || session.start.soilMoisture,
            temperatureStart: session.start.temperature,
            temperatureEnd: CURRENT_SENSOR?.temperature || session.start.temperature,
            humidityStart: session.start.humidity,
            humidityEnd: CURRENT_SENSOR?.humidity || session.start.humidity,
            waterLevelStart: session.start.waterLevel,
            waterLevelEnd: CURRENT_SENSOR?.waterLevel || session.start.waterLevel,
            motorStart: session.motorStart,
            motorOff: new Date(),
        });
        console.log("✅ Session saved successfully!");
    }
    catch (error) {
        console.log("❌ Error saving session data:", error);
    }
};
// HISTORY
const handleHistory = async (ws) => {
    try {
        const result = await sensor_info_service_1.SensorService.getMotorHistoryFromDB();
        console.log("📜 Sending motor history...");
        (0, ws_1.send)(ws, "history:response", {
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.log("❌ Error fetching history:", error);
        (0, ws_1.send)(ws, "history:response", {
            success: false,
        });
    }
};
