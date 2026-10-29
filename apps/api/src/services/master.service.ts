import bcrypt from 'bcryptjs';
import {
  MasterKategori,
  MasterLokasi,
  MasterPIC,
  MasterUser,
  CreateCategorySchema,
  CreateLocationSchema,
  CreatePICSchema,
  CreateUserSchema,
  AuditAction,
  AuditResult
} from '@machine-tracking/shared';
import { getSheetsRepository } from '../repositories/sheets-client';
import { AuditService } from './audit.service';
import { z } from 'zod';

export class MasterService {
  // --- CATEGORIES ---
  static async getCategories(activeOnly = true): Promise<MasterKategori[]> {
    const repo = getSheetsRepository();
    return repo.getCategories(activeOnly);
  }

  static async createCategory(data: z.infer<typeof CreateCategorySchema>, userId: string): Promise<MasterKategori> {
    const repo = getSheetsRepository();
    const categories = await repo.getCategories(false);

    let maxNum = 0;
    for (const c of categories) {
      const match = c.Category_ID.match(/^CAT-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const categoryId = `CAT-${String(maxNum + 1).padStart(3, '0')}`;

    const newCategory: MasterKategori = {
      Category_ID: categoryId,
      Category_Name: data.categoryName,
      Department: data.department,
      Description: data.description || '',
      Active: true
    };

    const saved = await repo.insertCategory(newCategory);

    await AuditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'CATEGORY',
      entityId: categoryId,
      newValue: saved,
      result: AuditResult.SUCCESS
    });

    return saved;
  }

  // --- LOCATIONS ---
  static async getLocations(activeOnly = true): Promise<MasterLokasi[]> {
    const repo = getSheetsRepository();
    return repo.getLocations(activeOnly);
  }

  static async createLocation(data: z.infer<typeof CreateLocationSchema>, userId: string): Promise<MasterLokasi> {
    const repo = getSheetsRepository();
    const locations = await repo.getLocations(false);

    let maxNum = 0;
    for (const l of locations) {
      const match = l.Location_ID.match(/^LOC-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const locationId = `LOC-${String(maxNum + 1).padStart(4, '0')}`;

    const newLocation: MasterLokasi = {
      Location_ID: locationId,
      Building: data.building,
      Floor: data.floor,
      Department: data.department,
      Area: data.area,
      Line: data.line || '-',
      Position_Code: data.positionCode || '-',
      Location_Name: data.locationName,
      Active: true,
      Notes: data.notes || ''
    };

    const saved = await repo.insertLocation(newLocation);

    await AuditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'LOCATION',
      entityId: locationId,
      newValue: saved,
      result: AuditResult.SUCCESS
    });

    return saved;
  }

  // --- PICS ---
  static async getPICs(activeOnly = true): Promise<MasterPIC[]> {
    const repo = getSheetsRepository();
    return repo.getPICs(activeOnly);
  }

  static async createPIC(data: z.infer<typeof CreatePICSchema>, userId: string): Promise<MasterPIC> {
    const repo = getSheetsRepository();
    const pics = await repo.getPICs(false);

    let maxNum = 0;
    for (const p of pics) {
      const match = p.PIC_ID.match(/^PIC-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const picId = `PIC-${String(maxNum + 1).padStart(4, '0')}`;

    const newPic: MasterPIC = {
      PIC_ID: picId,
      PIC_Name: data.picName,
      Employee_ID: data.employeeId || '',
      Department: data.department,
      Role: data.role,
      User_ID: data.userId || '',
      Active: true
    };

    const saved = await repo.insertPIC(newPic);

    await AuditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'PIC',
      entityId: picId,
      newValue: saved,
      result: AuditResult.SUCCESS
    });

    return saved;
  }

  // --- USERS ---
  static async getUsers(activeOnly = true): Promise<Omit<MasterUser, 'Password_Hash'>[]> {
    const repo = getSheetsRepository();
    const users = await repo.getUsers(activeOnly);
    return users.map(({ Password_Hash, ...u }) => u);
  }

  static async createUser(data: z.infer<typeof CreateUserSchema>, currentUserId: string): Promise<Omit<MasterUser, 'Password_Hash'>> {
    const repo = getSheetsRepository();
    const users = await repo.getUsers(false);

    const existing = await repo.getUserByEmail(data.loginEmail);
    if (existing) {
      throw new Error(`Email ${data.loginEmail} sudah terdaftar`);
    }

    let maxNum = 0;
    for (const u of users) {
      const match = u.User_ID.match(/^USR-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const userId = `USR-${String(maxNum + 1).padStart(3, '0')}`;
    if (!data.password || data.password.length < 12) {
      throw new Error('Password pengguna minimal 12 karakter');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const newUser: MasterUser = {
      User_ID: userId,
      User_Name: data.userName,
      Login_Email: data.loginEmail,
      Password_Hash: passwordHash,
      Role_ID: data.roleId,
      Department: data.department,
      Active: true,
      Created_At: new Date().toISOString()
    };

    const saved = await repo.insertUser(newUser);

    await AuditService.log({
      userId: currentUserId,
      action: AuditAction.CREATE,
      entityType: 'USER',
      entityId: userId,
      newValue: { User_ID: userId, User_Name: data.userName, Role_ID: data.roleId },
      result: AuditResult.SUCCESS
    });

    const { Password_Hash, ...safeUser } = saved;
    return safeUser;
  }
}
