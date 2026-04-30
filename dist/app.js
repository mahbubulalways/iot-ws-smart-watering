"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_status_codes_1 = require("http-status-codes");
const sensor_info_service_1 = require("./app/sensor_info/sensor_info.service");
const sendResponse_1 = require("./utils/sendResponse");
const app = (0, express_1.default)();
app.use((0, express_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/", (req, res) => {
    res.status(http_status_codes_1.StatusCodes.OK).json({
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: "Server is Running!!!!!!!!!!!!!!!!",
    });
});
app.get("/delete-history", async (req, res) => {
    const result = await sensor_info_service_1.SensorService.deleteSensorHistroy();
    if (result.acknowledged) {
        (0, sendResponse_1.sendResponse)(res, {
            success: true,
            message: "HEHE DELETE ALL HISTORY",
            statusCode: http_status_codes_1.StatusCodes.OK,
        });
    }
    else {
        (0, sendResponse_1.sendResponse)(res, {
            success: false,
            message: "NOT DELETE ACTION FAILED",
            statusCode: http_status_codes_1.StatusCodes.OK,
        });
    }
});
exports.default = app;
