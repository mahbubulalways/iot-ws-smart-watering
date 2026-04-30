import express, { Application, Request, Response } from "express";
import cors from "cors";
import { StatusCodes } from "http-status-codes";
import { SensorService } from "./app/sensor_info/sensor_info.service";
import { sendResponse } from "./utils/sendResponse";

const app: Application = express();
app.use(express());
app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    statusCode: StatusCodes.OK,
    success: true,
    message: "Server is Running!!!!!!!!!!!!!!!!",
  });
});
app.get("/delete-history", async (req: Request, res: Response) => {
  const result = await SensorService.deleteSensorHistroy();
  if (result.acknowledged) {
    sendResponse(res, {
      success: true,
      message: "HEHE DELETE ALL HISTORY",
      statusCode: StatusCodes.OK,
    });
  } else {
    sendResponse(res, {
      success: false,
      message: "NOT DELETE ACTION FAILED",
      statusCode: StatusCodes.OK,
    });
  }
});

export default app;
