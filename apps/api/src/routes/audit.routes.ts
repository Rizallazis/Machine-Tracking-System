import { Router, Request, Response, NextFunction } from 'express';
import { UserRole } from '@machine-tracking/shared';
import { AuditService } from '../services/audit.service';
import { authenticate, requireRole } from '../middleware/auth.middleware';

export const auditRouter = Router();

auditRouter.use(authenticate);

auditRouter.get('/', requireRole(UserRole.ADMIN, UserRole.IE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const logs = await AuditService.getLogs(limit);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    next(err);
  }
});
