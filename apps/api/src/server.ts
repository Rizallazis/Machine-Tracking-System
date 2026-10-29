import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { getSheetsRepository } from './repositories/sheets-client';
import { RecoveryJob } from './jobs/recovery.job';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    const repo = getSheetsRepository();
    await repo.init();

    // Start background recovery job for pending transactions
    RecoveryJob.startPeriodic(60000);

    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`🚀 Machine Tracking System API running on port ${PORT}`);
      console.log(`📡 URL API: http://0.0.0.0:${PORT}/api/v1`);
      console.log(`🏥 Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('❌ Gagal menjalankan server API:', err);
    process.exit(1);
  }
}

bootstrap();
