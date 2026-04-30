import { ISensorInfo } from "./sensor_info.interface";
import { SensorInfoModel } from "./sensor_info.model";

const storeSensorInformationToDB = async (payload: ISensorInfo) => {
  try {
    console.log(payload);

    const result = await SensorInfoModel.create(payload);
    return result;
  } catch (error) {
    console.error("Error storing sensor info to DB:", error);
    throw error;
  }
};

const getMotorHistoryFromDB = async () => {
  const result = await SensorInfoModel.find({}).sort({ motorOff: 1 });
  return result;
};

// DELETE SENSOR HISTORY
const deleteSensorHistroy = async () => {
  const result = await SensorInfoModel.deleteMany();
  return result;
};

export const SensorService = {
  storeSensorInformationToDB,
  getMotorHistoryFromDB,
  deleteSensorHistroy,
};
