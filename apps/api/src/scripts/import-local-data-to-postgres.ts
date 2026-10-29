import fs from 'fs';
import path from 'path';
import {
  MasterMesin,
  MasterKategori,
  MasterLokasi,
  MasterPIC,
  LogPerpindahan,
  LogKondisi,
  MasterUser,
  LogAudit
} from '@machine-tracking/shared';
import { getSheetsRepository } from '../repositories/sheets-client';

interface SeedData {
  '01_MASTER_MESIN': MasterMesin[];
  '02_MASTER_KATEGORI': MasterKategori[];
  '03_MASTER_LOKASI': MasterLokasi[];
  '04_MASTER_PIC': MasterPIC[];
  '05_LOG_PERPINDAHAN': LogPerpindahan[];
  '06_LOG_KONDISI': LogKondisi[];
  '07_MASTER_USER': MasterUser[];
  '08_LOG_AUDIT': LogAudit[];
}

async function importLocalData(): Promise<void> {
  if (process.env.STORAGE_MODE !== 'postgres') {
    throw new Error('Atur STORAGE_MODE=postgres sebelum menjalankan importer.');
  }

  const filePath = path.resolve(__dirname, '../../data/sheets.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`File sumber tidak ditemukan: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SeedData;
  const repository = getSheetsRepository();
  await repository.init();

  const machines = await repository.getMachines({ activeOnly: false });
  const categories = await repository.getCategories(false);
  const locations = await repository.getLocations(false);
  const pics = await repository.getPICs(false);
  const movements = await repository.getMovements();
  const conditions = await repository.getConditionLogs();
  const users = await repository.getUsers(false);
  const audits = await repository.getAuditLogs(1_000_000);

  const machineIds = new Set(machines.map(record => record.Machine_ID));
  const categoryIds = new Set(categories.map(record => record.Category_ID));
  const locationIds = new Set(locations.map(record => record.Location_ID));
  const picIds = new Set(pics.map(record => record.PIC_ID));
  const movementIds = new Set(movements.map(record => record.Movement_ID));
  const requestIds = new Set(movements.map(record => record.Request_ID).filter(Boolean));
  const conditionIds = new Set(conditions.map(record => record.Condition_Log_ID));
  const userIds = new Set(users.map(record => record.User_ID));
  const auditIds = new Set(audits.map(record => record.Audit_ID));

  let imported = 0;
  const insertIfMissing = async <T>(records: T[], hasRecord: (record: T) => boolean, insert: (record: T) => Promise<unknown>) => {
    for (const record of records || []) {
      if (hasRecord(record)) continue;
      await insert(record);
      imported += 1;
    }
  };

  await insertIfMissing(data['02_MASTER_KATEGORI'], record => categoryIds.has(record.Category_ID), record => repository.insertCategory(record));
  await insertIfMissing(data['03_MASTER_LOKASI'], record => locationIds.has(record.Location_ID), record => repository.insertLocation(record));
  await insertIfMissing(data['04_MASTER_PIC'], record => picIds.has(record.PIC_ID), record => repository.insertPIC(record));
  await insertIfMissing(data['01_MASTER_MESIN'], record => machineIds.has(record.Machine_ID), record => repository.insertMachine(record));
  await insertIfMissing(data['05_LOG_PERPINDAHAN'], record => movementIds.has(record.Movement_ID) || requestIds.has(record.Request_ID), record => repository.insertMovement(record));
  await insertIfMissing(data['06_LOG_KONDISI'], record => conditionIds.has(record.Condition_Log_ID), record => repository.insertConditionLog(record));
  await insertIfMissing(data['07_MASTER_USER'], record => userIds.has(record.User_ID), record => repository.insertUser(record));
  await insertIfMissing(data['08_LOG_AUDIT'], record => auditIds.has(record.Audit_ID), record => repository.insertAuditLog(record));

  console.log(`Impor selesai: ${imported} record baru dimasukkan ke PostgreSQL.`);
}

importLocalData().catch(error => {
  console.error('Impor data ke PostgreSQL gagal:', error);
  process.exitCode = 1;
});
