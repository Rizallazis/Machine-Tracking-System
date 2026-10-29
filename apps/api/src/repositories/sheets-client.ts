import dotenv from 'dotenv';
import { ISheetsRepository } from './sheets-interface';
import { LocalSheetsProvider } from './local-sheets-provider';
import { GoogleSheetsProvider } from './google-sheets-provider';
import { PostgresProvider } from './postgres-provider';

dotenv.config();

let instance: ISheetsRepository | null = null;

export function getSheetsRepository(): ISheetsRepository {
  if (instance) return instance;

  const storageMode = process.env.STORAGE_MODE || 'local';
  const databaseUrl = process.env.DATABASE_URL;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (storageMode === 'google') {
    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      throw new Error('STORAGE_MODE=google tetapi konfigurasi Google Sheets belum lengkap. Periksa GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, dan GOOGLE_PRIVATE_KEY.');
    }
    console.log('[Storage Engine] Using Google Sheets Provider (Spreadsheet ID: ' + spreadsheetId + ')');
    instance = new GoogleSheetsProvider({
      spreadsheetId,
      serviceAccountEmail,
      privateKey: privateKey.replace(/\\n/g, '\n')
    });
  } else if (storageMode === 'postgres') {
    if (!databaseUrl) {
      throw new Error('STORAGE_MODE=postgres tetapi DATABASE_URL belum diatur. Periksa apps/api/.env.');
    }
    console.log('[Storage Engine] Using PostgreSQL Provider');
    instance = new PostgresProvider(databaseUrl);
  } else if (storageMode === 'local') {
    console.log('[Storage Engine] Using Local Mock Sheet Engine (local file fallback)');
    instance = new LocalSheetsProvider();
  } else {
    throw new Error(`STORAGE_MODE tidak dikenal: ${storageMode}. Gunakan 'local', 'google', atau 'postgres'.`);
  }

  return instance;
}
