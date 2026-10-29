import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  MasterUser,
  LoginRequest,
  LoginResponse,
  AuditAction,
  AuditResult
} from '@machine-tracking/shared';
import { getSheetsRepository } from '../repositories/sheets-client';
import { AuditService } from './audit.service';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32 || secret === 'esgi-garment-machine-tracking-secret-key-2026') {
    throw new Error('Konfigurasi JWT_SECRET belum aman. Isi .env dengan secret acak minimal 32 karakter.');
  }
  return secret;
}

export class AuthService {
  static async login(req: LoginRequest): Promise<LoginResponse> {
    const repo = getSheetsRepository();
    const user = await repo.getUserByEmail(req.email);

    if (!user) {
      throw new Error('Email atau akun pengguna tidak ditemukan');
    }

    if (!user.Active) {
      throw new Error('Akun pengguna ini sedang dinonaktifkan. Silakan hubungi Administrator');
    }

    // Password dan hash wajib ada; jangan pernah menerbitkan token tanpa verifikasi.
    if (typeof req.password !== 'string' || req.password.length === 0) {
      throw new Error('Password wajib diisi');
    }
    if (typeof user.Password_Hash !== 'string' || user.Password_Hash.length === 0) {
      throw new Error('Akun belum memiliki password yang valid. Hubungi Administrator.');
    }
    const isValid = await bcrypt.compare(req.password, user.Password_Hash);
    if (!isValid) {
      throw new Error('Password yang dimasukkan salah');
    }

    const { Password_Hash, ...safeUser } = user;

    // Generate JWT token (valid for 3 days)
    const token = jwt.sign(
      {
        userId: user.User_ID,
        email: user.Login_Email,
        role: user.Role_ID,
        name: user.User_Name
      },
      getJwtSecret(),
      { expiresIn: '3d' }
    );

    await AuditService.log({
      userId: user.User_ID,
      action: AuditAction.LOGIN,
      entityType: 'AUTH',
      entityId: user.User_ID,
      result: AuditResult.SUCCESS
    });

    return {
      token,
      user: safeUser
    };
  }

  static async getMe(userId: string): Promise<Omit<MasterUser, 'Password_Hash'>> {
    const repo = getSheetsRepository();
    const user = await repo.getUserById(userId);
    if (!user) {
      throw new Error('Pengguna tidak ditemukan');
    }
    const { Password_Hash, ...safeUser } = user;
    return safeUser;
  }
}
