import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { machinesRouter, qrRouter } from './routes/machines.routes';
import { movementsRouter } from './routes/movements.routes';
import { conditionsRouter } from './routes/conditions.routes';
import { masterRouter } from './routes/master.routes';
import { auditRouter } from './routes/audit.routes';
import { exportRouter } from './routes/export.routes';
import { errorHandler } from './middleware/error.middleware';

export const app = express();

const allowedOrigins = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173', 'http://localhost:5174');
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use((req, res, next) => {
  const start = performance.now();

  res.on("finish", () => {
    const elapsed = Math.round(performance.now() - start);

    console.log(
      `[PERFORMANCE] ${req.method} ${req.originalUrl} ` +
      `${res.statusCode} ${elapsed}ms`
    );
  });

  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Machine Tracking System API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes with /api/v1 prefix
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/machines', machinesRouter);
app.use('/api/v1/qr', qrRouter);
app.use('/api/v1/movements', movementsRouter);
app.use('/api/v1/conditions', conditionsRouter);
app.use('/api/v1', masterRouter);
app.use('/api/v1/audit', auditRouter);
app.use('/api/v1/exports', exportRouter);

// Error Handling Middleware
app.use(errorHandler);
