import { Router, Request, Response, NextFunction } from 'express';
import { MovementSchema, UserRole } from '@machine-tracking/shared';
import { MovementService } from '../services/movement.service';
import { authenticate, requireRole } from '../middleware/auth.middleware';

export const movementsRouter = Router();

movementsRouter.use(authenticate);

// Perform machine movement
// Hanya Admin, IE, dan SPV yang boleh memindahkan mesin. Ubah daftar role jika SOP pabrik berbeda.
movementsRouter.post('/', requireRole(UserRole.ADMIN, UserRole.IE, UserRole.SPV), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = MovementSchema.parse(req.body);
    const result = await MovementService.moveMachine(validated, req.user!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// List movements
movementsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { machineId, fromDate, toDate, status } = req.query;
    const movements = await MovementService.getMovements({
      machineId: machineId as string,
      fromDate: fromDate as string,
      toDate: toDate as string,
      status: status as string
    });
    res.json({ success: true, count: movements.length, data: movements });
  } catch (err) {
    next(err);
  }
});

// Get movement detail
movementsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const movement = await MovementService.getMovementById(req.params.id);
    if (!movement) {
      res.status(404).json({ success: false, message: 'Transaksi perpindahan tidak ditemukan' });
      return;
    }
    res.json({ success: true, data: movement });
  } catch (err) {
    next(err);
  }
});
