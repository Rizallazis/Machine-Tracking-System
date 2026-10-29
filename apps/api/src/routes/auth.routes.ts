import { Router, Request, Response, NextFunction } from 'express';
import { LoginSchema } from '@machine-tracking/shared';
import { AuthService } from '../services/auth.service';
import { authenticate } from '../middleware/auth.middleware';

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = LoginSchema.parse(req.body);
    const result = await AuthService.login(validated);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Berhasil keluar' });
});

authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await AuthService.getMe(req.user!.userId);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});
