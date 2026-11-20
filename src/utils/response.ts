import { Response } from 'express';

export interface ApiResponseData<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: unknown;
}

export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message = 'Request successful',
  statusCode = 200
): Response => {
  const payload: ApiResponseData<T> = {
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
  };
  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  message = 'Internal server error',
  statusCode = 500,
  error?: unknown
): Response => {
  const payload: ApiResponseData = {
    success: false,
    message,
    ...(error ? { error } : {}),
  };
  return res.status(statusCode).json(payload);
};

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
