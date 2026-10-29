import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@machine-tracking/shared';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32 || secret === 'esgi-garment-machine-tracking-secret-key-2026') {
    throw new Error('Konfigurasi JWT_SECRET belum aman. Isi .env dengan secret acak minimal 32 karakter.');
  }
  return secret;
}

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Autentikasi diperlukan. Token tidak ditemukan.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Sesi login tidak valid atau sudah kedaluwarsa. Silakan login kembali.' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Akses ditolak: pengguna belum login' });
      return;
    }

    if (!allowedRoles.includes(req.user.role) && req.user.role !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        message: `Akses ditolak: Role Anda (${req.user.role}) tidak memiliki izin untuk tindakan ini.`
      });
      return;
    }

    next();
  };
}
