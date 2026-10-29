import { Router, Request, Response, NextFunction } from 'express';
import { ConditionReportSchema, UpdateConditionSchema, UserRole } from '@machine-tracking/shared';
import { ConditionService } from '../services/condition.service';
import { authenticate, requireRole } from '../middleware/auth.middleware';

export const conditionsRouter = Router();

conditionsRouter.use(authenticate);

// Report condition / damage
conditionsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = ConditionReportSchema.parse(req.body);
    const result = await ConditionService.reportCondition(validated, req.user!.userId);
    res.status(201).json({ success: true, data: result, message: 'Laporan kondisi berhasil dicatat' });
  } catch (err) {
    next(err);
  }
});

// List condition logs
conditionsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { machineId, repairStatus } = req.query;
    const logs = await ConditionService.getConditionLogs({
      machineId: machineId as string,
      repairStatus: repairStatus as string
    });
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    next(err);
  }
});

// Update repair progress (Mechanic, Admin, IE)
conditionsRouter.patch('/:id', requireRole(UserRole.MECHANIC, UserRole.ADMIN, UserRole.IE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = UpdateConditionSchema.parse(req.body);
    const result = await ConditionService.updateCondition(req.params.id, validated, req.user!.userId);
    res.json({ success: true, data: result, message: 'Tindak lanjut perbaikan berhasil diperbarui' });
  } catch (err) {
    next(err);
  }
});
