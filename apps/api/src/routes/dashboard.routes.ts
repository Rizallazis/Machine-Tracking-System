import { Router, Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { authenticate } from '../middleware/auth.middleware';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await DashboardService.getOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await DashboardService.getSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get('/by-location', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await DashboardService.getByLocation();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get('/by-category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await DashboardService.getByCategory();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
