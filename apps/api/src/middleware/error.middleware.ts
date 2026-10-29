import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('[API Error]:', err);

  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    res.status(400).json({
      success: false,
      message: `Validasi gagal: ${formattedErrors}`,
      errors: err.errors
    });
    return;
  }

  const statusCode = err.statusCode || (err.message && err.message.includes('tidak ditemukan') ? 404 : 400);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Terjadi kesalahan internal pada server'
  });
}
