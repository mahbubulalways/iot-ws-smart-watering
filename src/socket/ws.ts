import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { socketEvents } from "./events";

export interface WSMessage {
  event: string;
  data?: any;
}

let wss: WebSocketServer;

export const initWebSocket = (server: Server) => {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WebSocket) => {
    console.log("Client Connected");

    socketEvents(ws);

    ws.on("close", () => {
      console.log("Client Disconnected");
    });

    ws.on("error", (err) => {
      console.log("Socket Error:", err);
    });
  });
};

// Send single
export const send = (ws: WebSocket, event: string, data: any) => {
  ws.send(
    JSON.stringify({
      event,
      data,
    }),
  );
};

// Broadcast
export const broadcast = (event: string, data: any) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          event,
          data,
        }),
      );
    }
  });
};
