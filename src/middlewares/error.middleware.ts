import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, sendError } from '../utils/response.js';

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Response => {
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(res, 'Validation failed', 400, formattedErrors);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return sendError(res, 'A record with this unique field already exists.', 409);
    }
    if (err.code === 'P2025') {
      return sendError(res, 'Requested record was not found.', 404);
    }
  }

  const message = err instanceof Error ? err.message : 'Internal Server Error';
  console.error('💥 Unhandled Exception:', err);

  return sendError(
    res,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
    500
  );
};
