import { Response } from "express";
import { ApiResponse, AuthRequest } from "../types/api";
import { unauthorized } from "../utils/api";
import { UploadedFile } from "../db/models/UploadedFile";

/**
 * Upload a file and return its id
 */
export const uploadFile = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
) => {
  try {
    if (!req.user) return unauthorized(res);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: "NO_FILE",
          message: "No file was provided.",
        },
      });
    }

    const record = await UploadedFile.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/${req.file.filename}`,
      uploadedBy: req.user.id,
    });


    return res.status(201).json({
      success: true,
      data: {
        id: record.id,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
      },
    });
  }
};

/**
 * Get file metadata by id
 */
export const getFile = async (req: AuthRequest, res: Response<ApiResponse>) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "User is not authorized.",
      },
    });
  }

  const { id } = req.params;

  const file = await UploadedFile.findOne({
    where: { id, uploadedBy: req.user.id },
    attributes: ["id", "originalName", "mimeType", "size", "createdAt"],
  });

  if (!file) {
    return res.status(404).json({
      success: false,
      error: {
        code: "FILE_NOT_FOUND",
        message: "File not found.",
      },
    });
  }

  return res.status(200).json({
    success: true,
    data: { file },
  });
};

/**
 * Delete a file by id
 */
export const deleteFile = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
) => {
  if (!req.user) return unauthorized(res);

  const { id } = req.params;

  try {
    const file = await UploadedFile.findOne({
      where: { id, uploadedBy: req.user.id },
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: "FILE_NOT_FOUND",
          message: "File not found.",
        },
      });
    }

    await file.destroy();

    return res.status(200).json({
      success: true,
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
      },
    });
  }
};