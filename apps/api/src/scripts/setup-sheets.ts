import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { UserRole, AuditResult } from '@machine-tracking/shared';

export async function seedInitialData() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error('Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (at least 12 characters) before seeding.');
  }

  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const database = {
    '01_MASTER_MESIN': [],
    '02_MASTER_KATEGORI': [],
    '03_MASTER_LOKASI': [],
    '04_MASTER_PIC': [],
    '05_LOG_PERPINDAHAN': [],
    '06_LOG_KONDISI': [],
    '07_MASTER_USER': [{
      User_ID: 'USR-001',
      User_Name: 'Administrator',
      Login_Email: adminEmail,
      Password_Hash: passwordHash,
      Role_ID: UserRole.ADMIN,
      Department: 'Administration',
      Active: true,
      Created_At: now
    }],
    '08_LOG_AUDIT': [{
      Audit_ID: 'AUD-000001',
      User_ID: 'USR-001',
      Action: 'SETUP_INITIAL',
      Entity_Type: 'SYSTEM',
      Entity_ID: 'DATABASE_INIT',
      Timestamp: now,
      Old_Value: '',
      New_Value: 'Initial schema setup',
      Request_ID: 'init-audit-001',
      Result: AuditResult.SUCCESS
    }]
  };

  const dataDir = path.resolve(__dirname, '../../data');
  fs.mkdirSync(dataDir, { recursive: true });
  const jsonPath = path.join(dataDir, 'sheets.json');
  fs.writeFileSync(jsonPath, JSON.stringify(database, null, 2), 'utf-8');
  console.log(`Initial data created at: ${jsonPath}`);
}

if (require.main === module) {
  seedInitialData().catch((error) => {
    console.error('Failed to seed initial data:', error);
    process.exitCode = 1;
  });
}