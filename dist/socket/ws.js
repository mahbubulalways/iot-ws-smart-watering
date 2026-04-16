"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcast = exports.send = exports.initWebSocket = void 0;
const ws_1 = require("ws");
const events_1 = require("./events");
let wss;
const initWebSocket = (server) => {
    wss = new ws_1.WebSocketServer({ server });
    wss.on("connection", (ws) => {
        console.log("Client Connected");
        (0, events_1.socketEvents)(ws);
        ws.on("close", () => {
            console.log("Client Disconnected");
        });
        ws.on("error", (err) => {
            console.log("Socket Error:", err);
        });
    });
};
exports.initWebSocket = initWebSocket;
// Send single
const send = (ws, event, data) => {
    ws.send(JSON.stringify({
        event,
        data,
    }));
};
exports.send = send;
// Broadcast
const broadcast = (event, data) => {
    wss.clients.forEach((client) => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(JSON.stringify({
                event,
                data,
            }));
        }
    });
};
exports.broadcast = broadcast;
