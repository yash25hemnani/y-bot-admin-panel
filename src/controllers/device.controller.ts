import { Request, Response } from "express";
import { ApiResponse, AuthRequest } from "../types/api";
import { handleApiError } from "../utils/api";
import { Device } from "../db/models";
import crypto from "crypto";
import bcrypt from "bcrypt";

export const addDevice = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
) => {
  try {
    const { deviceName, deviceType, devicePassword } = req.body;

    // Check if device deviceName already exists for that particular user
    const existingDevice = await Device.findOne({
      where: { deviceName, userId: req.user?.id },
    });

    if (existingDevice) {
      return res.status(409).json({
        success: false,
        error: {
          code: "DEVICE_NAME_TAKEN",
          message: "Device with this name already exists.",
        },
      });
    }

    const devicePasswordHash = await bcrypt.hash(devicePassword, 10);

    // Generate device ID and hmacSecret
    const deviceId = crypto.randomUUID();
    const hmacSecret = crypto.randomBytes(32).toString("hex");

    // TODO - Add a check for uniqueness
    const newDevice = await Device.create({
      deviceName,
      deviceId,
      deviceType,
      devicePasswordHash,
      hmacSecret,
      userId: req.user!.id,
    });

    return res.status(201).json({
      success: true,
      message: "Device added successfully!",
      data: {
        deviceName: newDevice.deviceName,
        deviceId: newDevice.deviceId,
        hmacSecret: newDevice.hmacSecret,
      },
    });
  } catch (error) {
    return handleApiError(res, error, "Device addition failed");
  }
};

export const removeDevice = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
) => {
  try {
    const { deviceId } = req.params;
    const { devicePassword } = req.body;

    const device = await Device.findOne({ where: { id: deviceId } });

    if (!device)
      return res.status(404).json({
        success: false,
        error: {
          code: "DEVICE_NOT_FOUND",
          message: "The specified device does not exist.",
        },
      });

    const valid = await bcrypt.compare(
      devicePassword,
      device.devicePasswordHash,
    );

    if (!valid) {
      return res.status(403).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Incorrect password.",
        },
      });
    }

    await Device.destroy({
      where: {
        id: deviceId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Device deleted successfully!",
    });
  } catch (error) {
    return handleApiError(res, error, "Signup failed");
  }
};

export const rotateHmacSecret = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findOne({
      where: { id: deviceId },
    });

    if (!device)
      return res.status(404).json({
        success: false,
        error: {
          code: "DEVICE_NOT_FOUND",
          message: "The specified device does not exist.",
        },
      });

    const newHmacSecret = crypto.randomBytes(32).toString("hex");

    const [updatedCount, updatedDevices] = await Device.update(
      { hmacSecret: newHmacSecret },
      {
        where: {
          id: deviceId,
          isRevoked: false,
        },
        returning: true,
      },
    );

    if (updatedCount === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: "DEVICE_NOT_FOUND",
          message: "Device not found or already revoked",
        },
      });
    }

    const updatedDevice = updatedDevices[0];

    return res.status(201).json({
      success: true,
      message: "Rotation successful!",
      data: {
        deviceName: updatedDevice.deviceName,
        deviceId: updatedDevice.deviceId,
        hmacSecret: updatedDevice.hmacSecret,
      },
    });
  } catch (error) {
    return handleApiError(res, error, "Refresh failed!");
  }
};
