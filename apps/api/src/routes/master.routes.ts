import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateCategorySchema,
  CreateLocationSchema,
  CreatePICSchema,
  CreateUserSchema,
  UserRole
} from '@machine-tracking/shared';
import { MasterService } from '../services/master.service';
import { authenticate, requireRole } from '../middleware/auth.middleware';

export const masterRouter = Router();

masterRouter.use(authenticate);

// --- CATEGORIES ---
masterRouter.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    const categories = await MasterService.getCategories(activeOnly);
    res.json({ success: true, count: categories.length, data: categories });
  } catch (err) {
    next(err);
  }
});

masterRouter.post('/categories', requireRole(UserRole.ADMIN, UserRole.IE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreateCategorySchema.parse(req.body);
    const category = await MasterService.createCategory(validated, req.user!.userId);
    res.status(201).json({ success: true, data: category, message: 'Kategori baru berhasil ditambahkan' });
  } catch (err) {
    next(err);
  }
});

// --- LOCATIONS ---
masterRouter.get('/locations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    const locations = await MasterService.getLocations(activeOnly);
    res.json({ success: true, count: locations.length, data: locations });
  } catch (err) {
    next(err);
  }
});

masterRouter.post('/locations', requireRole(UserRole.ADMIN, UserRole.IE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreateLocationSchema.parse(req.body);
    const location = await MasterService.createLocation(validated, req.user!.userId);
    res.status(201).json({ success: true, data: location, message: 'Lokasi baru berhasil ditambahkan' });
  } catch (err) {
    next(err);
  }
});

// --- PICS ---
masterRouter.get('/pics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    const pics = await MasterService.getPICs(activeOnly);
    res.json({ success: true, count: pics.length, data: pics });
  } catch (err) {
    next(err);
  }
});

masterRouter.post('/pics', requireRole(UserRole.ADMIN, UserRole.IE, UserRole.SPV), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreatePICSchema.parse(req.body);
    const pic = await MasterService.createPIC(validated, req.user!.userId);
    res.status(201).json({ success: true, data: pic, message: 'PIC baru berhasil didaftarkan' });
  } catch (err) {
    next(err);
  }
});

// --- USERS ---
masterRouter.get('/users', requireRole(UserRole.ADMIN, UserRole.IE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    const users = await MasterService.getUsers(activeOnly);
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
});

masterRouter.post('/users', requireRole(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreateUserSchema.parse(req.body);
    const user = await MasterService.createUser(validated, req.user!.userId);
    res.status(201).json({ success: true, data: user, message: 'Pengguna baru berhasil ditambahkan' });
  } catch (err) {
    next(err);
  }
});
