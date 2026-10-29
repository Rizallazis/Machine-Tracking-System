import { Router, Request, Response, NextFunction } from 'express';
import { CreateMachineSchema, UpdateMachineSchema, UserRole } from '@machine-tracking/shared';
import { MachineService } from '../services/machine.service';
import { authenticate, requireRole } from '../middleware/auth.middleware';

export const machinesRouter = Router();
export const qrRouter = Router();

// Endpoint GET /api/v1/qr/:token — Mencari mesin berdasarkan QR token
qrRouter.get('/:token', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const machine = await MachineService.getMachineByQRToken(req.params.token);
    if (!machine) {
      res.status(404).json({ success: false, message: 'QR Code tidak terdaftar pada sistem' });
      return;
    }
    res.json({ success: true, data: machine });
  } catch (err) {
    next(err);
  }
});

// List machines with filters: GET /api/v1/machines
machinesRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { activeOnly, categoryId, locationId, status, condition, search, line } = req.query;
    const machines = await MachineService.getMachines({
      activeOnly: activeOnly === 'false' ? false : true,
      categoryId: categoryId as string,
      locationId: locationId as string,
      status: status as string,
      condition: condition as string,
      search: search as string,
      line: line as string
    });
    res.json({ success: true, count: machines.length, data: machines });
  } catch (err) {
    next(err);
  }
});

// Register new machine: POST /api/v1/machines (Admin, IE)
machinesRouter.post('/', authenticate, requireRole(UserRole.ADMIN, UserRole.IE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreateMachineSchema.parse(req.body);
    const created = await MachineService.createMachine(validated, req.user!.userId);
    res.status(201).json({ success: true, data: created, message: 'Mesin baru berhasil didaftarkan' });
  } catch (err) {
    next(err);
  }
});

// Get machine detail by ID: GET /api/v1/machines/:id
machinesRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const machine = await MachineService.getMachineById(req.params.id);
    if (!machine) {
      res.status(404).json({ success: false, message: `Mesin dengan ID ${req.params.id} tidak ditemukan` });
      return;
    }
    res.json({ success: true, data: machine });
  } catch (err) {
    next(err);
  }
});

// Update machine master data: PATCH /api/v1/machines/:id
machinesRouter.patch('/:id', authenticate, requireRole(UserRole.ADMIN, UserRole.IE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = UpdateMachineSchema.parse(req.body);
    const updated = await MachineService.updateMachine(req.params.id, validated, req.user!.userId);
    res.json({ success: true, data: updated, message: 'Data mesin berhasil diperbarui' });
  } catch (err) {
    next(err);
  }
});

// Deactivate machine: POST /api/v1/machines/:id/deactivate
machinesRouter.post('/:id/deactivate', authenticate, requireRole(UserRole.ADMIN, UserRole.IE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deactivated = await MachineService.deactivateMachine(req.params.id, req.user!.userId);
    res.json({ success: true, data: deactivated, message: 'Mesin berhasil dinonaktifkan' });
  } catch (err) {
    next(err);
  }
});

// Generate QR Code image data URL: GET /api/v1/machines/:id/qr
machinesRouter.get('/:id/qr', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const machine = await MachineService.getMachineById(req.params.id);
    if (!machine) {
      res.status(404).json({ success: false, message: 'Mesin tidak ditemukan' });
      return;
    }
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const qrImage = await MachineService.generateQRCode(machine, frontendUrl);
    res.json({
      success: true,
      data: {
        machineId: machine.Machine_ID,
        machineName: machine.Machine_Name,
        qrToken: machine.QR_Token,
        qrImage
      }
    });
  } catch (err) {
    next(err);
  }
});
