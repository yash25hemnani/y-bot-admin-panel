import { Request, Response } from "express";
import { ApiResponse, AuthRequest } from "../types/api";
import { handleApiError } from "../utils/api";
import { Device, User } from "../db/models";
import crypto from "crypto";
import bcrypt from "bcrypt";
import {
  buildPaginatedResponse,
  getPaginationParams,
} from "../utils/pagination";
import { error } from "console";
import { createAuditLog } from "../utils/audit";
import { AuditAction, AuditResourceType } from "../db/models/AuditLog";

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

    await createAuditLog(req, {
      action: AuditAction.DEVICE_CREATED,
      resourceType: AuditResourceType.DEVICE,
      resourceId: newDevice.id,
    })

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

export const getDevices = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
) => {
  try {
    const { page, limit, offset } = getPaginationParams(req.query);
    // If admin, send all devices
    // If user, send user devices
    const isAdmin = req.user?.role === "admin";

    const { count, rows: devices } = await Device.findAndCountAll({
      where: isAdmin ? {} : { userId: req.user?.id },
      include: [{ model: User, attributes: ["id", "username", "email"] }],
      attributes: {
        exclude: ["devicePasswordHash"],
      },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res
      .status(200)
      .json(buildPaginatedResponse(devices, count, { page, limit, offset }));
  } catch (error) {
    return handleApiError(res, error, "Could not get devices!");
  }
};

export const getDevice = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
) => {
  try {
    const { id } = req.params;

    const device = await Device.findOne({
      where: { id, userId: req.user?.id },
      include: [{ model: User, attributes: ["id", "username", "email"] }],
      attributes: {
        exclude: ["devicePasswordHash"],
      },
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        error: {
          code: "DEVICE_NOT_FOUND",
          message: "Device with this is does not exist!",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: device.toJSON(),
    });
  } catch (error) {
    return handleApiError(res, error, "Could not get devices!");
  }
};

export const revokeDevice = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user?.role === "admin";

    const device = isAdmin
      ? await Device.findByPk(id as string)
      : await Device.findOne({
          where: {
            id,
            userId: req.user?.id,
          },
        });

    if (!device) {
      return res.status(404).json({
        success: false,
        error: {
          code: "DEVICE_NOT_FOUND",
          message: "Device not found.",
        },
      });
    }

    await Device.update(
      { isRevoked: true, revokedAt: new Date() },
      { where: { id } },
    );

    return res.status(200).json({
      success: true,
      message: "The device was revoked successfully!",
    });
  } catch (error) {
    return handleApiError(res, error, "Unable to revoke device.");
  }
};

export const enableDevice = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user?.role === "admin";

    const device = await Device.findOne({
      where: isAdmin
        ? { id: id as string }
        : {
            id: id as string,
            userId: req.user?.id,
          },
      attributes: {
        exclude: ["devicePasswordHash"],
      },
      include: [
        {
          model: User,
          attributes: ["id", "username", "email"],
        },
      ],
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        error: {
          code: "DEVICE_NOT_FOUND",
          message: "Device not found.",
        },
      });
    }

    await Device.update(
      { isRevoked: false, revokedAt: undefined },
      { where: { id } },
    );

    return res.status(200).json({
      success: true,
      message: "The device was enabled successfully!",
      data: device.toJSON(),
    });
  } catch (error) {
    return handleApiError(res, error, "Unable to revoke device.");
  }
};
