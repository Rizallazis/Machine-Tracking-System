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
  LogAudit,
  MovementStatus
} from '@machine-tracking/shared';
import { ISheetsRepository } from './sheets-interface';

interface LocalDatabase {
  '01_MASTER_MESIN': MasterMesin[];
  '02_MASTER_KATEGORI': MasterKategori[];
  '03_MASTER_LOKASI': MasterLokasi[];
  '04_MASTER_PIC': MasterPIC[];
  '05_LOG_PERPINDAHAN': LogPerpindahan[];
  '06_LOG_KONDISI': LogKondisi[];
  '07_MASTER_USER': MasterUser[];
  '08_LOG_AUDIT': LogAudit[];
}

export class LocalSheetsProvider implements ISheetsRepository {
  private filePath: string;
  private db: LocalDatabase = {
    '01_MASTER_MESIN': [],
    '02_MASTER_KATEGORI': [],
    '03_MASTER_LOKASI': [],
    '04_MASTER_PIC': [],
    '05_LOG_PERPINDAHAN': [],
    '06_LOG_KONDISI': [],
    '07_MASTER_USER': [],
    '08_LOG_AUDIT': []
  };
  private isLoaded = false;

  constructor(customPath?: string) {
    this.filePath = customPath || path.resolve(__dirname, '../../data/sheets.json');
  }

  async init(): Promise<void> {
    if (this.isLoaded) return;
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.db = {
          '01_MASTER_MESIN': parsed['01_MASTER_MESIN'] || [],
          '02_MASTER_KATEGORI': parsed['02_MASTER_KATEGORI'] || [],
          '03_MASTER_LOKASI': parsed['03_MASTER_LOKASI'] || [],
          '04_MASTER_PIC': parsed['04_MASTER_PIC'] || [],
          '05_LOG_PERPINDAHAN': parsed['05_LOG_PERPINDAHAN'] || [],
          '06_LOG_KONDISI': parsed['06_LOG_KONDISI'] || [],
          '07_MASTER_USER': parsed['07_MASTER_USER'] || [],
          '08_LOG_AUDIT': parsed['08_LOG_AUDIT'] || []
        };
      } catch (err) {
        console.error('Gagal membaca sheets.json lokal, membuat database baru:', err);
        await this.persist();
      }
    } else {
      await this.persist();
    }
    this.isLoaded = true;
  }

  private async persist(): Promise<void> {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.db, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('Gagal menyimpan file sheets lokal:', err);
    }
  }

  // 01_MASTER_MESIN
  async getMachines(filter?: { activeOnly?: boolean; categoryId?: string; locationId?: string; status?: string; condition?: string }): Promise<MasterMesin[]> {
    await this.init();
    return this.db['01_MASTER_MESIN'].filter(m => {
      if (filter?.activeOnly && !m.Active) return false;
      if (filter?.categoryId && m.Category_ID !== filter.categoryId) return false;
      if (filter?.locationId && m.Current_Location_ID !== filter.locationId) return false;
      if (filter?.status && m.Current_Status !== filter.status) return false;
      if (filter?.condition && m.Machine_Condition !== filter.condition) return false;
      return true;
    });
  }

  async getMachineById(machineId: string): Promise<MasterMesin | null> {
    await this.init();
    const found = this.db['01_MASTER_MESIN'].find(m => m.Machine_ID === machineId);
    return found ? { ...found } : null;
  }

  async getMachineByQRToken(qrToken: string): Promise<MasterMesin | null> {
    await this.init();
    const found = this.db['01_MASTER_MESIN'].find(m => m.QR_Token === qrToken);
    return found ? { ...found } : null;
  }

  async insertMachine(machine: MasterMesin): Promise<MasterMesin> {
    await this.init();
    if (this.db['01_MASTER_MESIN'].some(m => m.Machine_ID === machine.Machine_ID)) {
      throw new Error(`Mesin dengan ID ${machine.Machine_ID} sudah terdaftar`);
    }
    this.db['01_MASTER_MESIN'].push({ ...machine });
    await this.persist();
    return { ...machine };
  }

  async updateMachine(machineId: string, updates: Partial<MasterMesin>): Promise<MasterMesin | null> {
    await this.init();
    const index = this.db['01_MASTER_MESIN'].findIndex(m => m.Machine_ID === machineId);
    if (index === -1) return null;

    const updated = {
      ...this.db['01_MASTER_MESIN'][index],
      ...updates,
      Updated_At: new Date().toISOString()
    };
    this.db['01_MASTER_MESIN'][index] = updated;
    await this.persist();
    return { ...updated };
  }

  // 02_MASTER_KATEGORI
  async getCategories(activeOnly = true): Promise<MasterKategori[]> {
    await this.init();
    return this.db['02_MASTER_KATEGORI'].filter(k => (activeOnly ? k.Active : true));
  }

  async getCategoryById(categoryId: string): Promise<MasterKategori | null> {
    await this.init();
    const found = this.db['02_MASTER_KATEGORI'].find(k => k.Category_ID === categoryId);
    return found ? { ...found } : null;
  }

  async insertCategory(category: MasterKategori): Promise<MasterKategori> {
    await this.init();
    this.db['02_MASTER_KATEGORI'].push({ ...category });
    await this.persist();
    return { ...category };
  }

  // 03_MASTER_LOKASI
  async getLocations(activeOnly = true): Promise<MasterLokasi[]> {
    await this.init();
    return this.db['03_MASTER_LOKASI'].filter(l => (activeOnly ? l.Active : true));
  }

  async getLocationById(locationId: string): Promise<MasterLokasi | null> {
    await this.init();
    const found = this.db['03_MASTER_LOKASI'].find(l => l.Location_ID === locationId);
    return found ? { ...found } : null;
  }

  async insertLocation(location: MasterLokasi): Promise<MasterLokasi> {
    await this.init();
    this.db['03_MASTER_LOKASI'].push({ ...location });
    await this.persist();
    return { ...location };
  }

  // 04_MASTER_PIC
  async getPICs(activeOnly = true): Promise<MasterPIC[]> {
    await this.init();
    return this.db['04_MASTER_PIC'].filter(p => (activeOnly ? p.Active : true));
  }

  async getPICById(picId: string): Promise<MasterPIC | null> {
    await this.init();
    const found = this.db['04_MASTER_PIC'].find(p => p.PIC_ID === picId);
    return found ? { ...found } : null;
  }

  async insertPIC(pic: MasterPIC): Promise<MasterPIC> {
    await this.init();
    this.db['04_MASTER_PIC'].push({ ...pic });
    await this.persist();
    return { ...pic };
  }

  // 05_LOG_PERPINDAHAN
  async getMovements(filter?: { machineId?: string; fromDate?: string; toDate?: string; status?: string }): Promise<LogPerpindahan[]> {
    await this.init();
    return this.db['05_LOG_PERPINDAHAN']
      .filter(m => {
        if (filter?.machineId && m.Machine_ID !== filter.machineId) return false;
        if (filter?.status && m.Status !== filter.status) return false;
        if (filter?.fromDate && m.Movement_DateTime < filter.fromDate) return false;
        if (filter?.toDate && m.Movement_DateTime > filter.toDate) return false;
        return true;
      })
      .reverse(); // Newest first
  }

  async getMovementById(movementId: string): Promise<LogPerpindahan | null> {
    await this.init();
    const found = this.db['05_LOG_PERPINDAHAN'].find(m => m.Movement_ID === movementId);
    return found ? { ...found } : null;
  }

  async getMovementByRequestId(requestId: string): Promise<LogPerpindahan | null> {
    await this.init();
    const found = this.db['05_LOG_PERPINDAHAN'].find(m => m.Request_ID === requestId);
    return found ? { ...found } : null;
  }

  async insertMovement(movement: LogPerpindahan): Promise<LogPerpindahan> {
    await this.init();
    this.db['05_LOG_PERPINDAHAN'].push({ ...movement });
    await this.persist();
    return { ...movement };
  }

  async updateMovementStatus(movementId: string, status: MovementStatus, notes?: string): Promise<LogPerpindahan | null> {
    await this.init();
    const index = this.db['05_LOG_PERPINDAHAN'].findIndex(m => m.Movement_ID === movementId);
    if (index === -1) return null;

    this.db['05_LOG_PERPINDAHAN'][index].Status = status;
    if (notes) {
      this.db['05_LOG_PERPINDAHAN'][index].Notes = notes;
    }
    await this.persist();
    return { ...this.db['05_LOG_PERPINDAHAN'][index] };
  }

  // 06_LOG_KONDISI
  async getConditionLogs(filter?: { machineId?: string; repairStatus?: string }): Promise<LogKondisi[]> {
    await this.init();
    return this.db['06_LOG_KONDISI']
      .filter(c => {
        if (filter?.machineId && c.Machine_ID !== filter.machineId) return false;
        if (filter?.repairStatus && c.Repair_Status !== filter.repairStatus) return false;
        return true;
      })
      .reverse();
  }

  async getConditionLogById(logId: string): Promise<LogKondisi | null> {
    await this.init();
    const found = this.db['06_LOG_KONDISI'].find(c => c.Condition_Log_ID === logId);
    return found ? { ...found } : null;
  }

  async insertConditionLog(log: LogKondisi): Promise<LogKondisi> {
    await this.init();
    this.db['06_LOG_KONDISI'].push({ ...log });
    await this.persist();
    return { ...log };
  }

  async updateConditionLog(logId: string, updates: Partial<LogKondisi>): Promise<LogKondisi | null> {
    await this.init();
    const index = this.db['06_LOG_KONDISI'].findIndex(c => c.Condition_Log_ID === logId);
    if (index === -1) return null;

    const updated = {
      ...this.db['06_LOG_KONDISI'][index],
      ...updates
    };
    this.db['06_LOG_KONDISI'][index] = updated;
    await this.persist();
    return { ...updated };
  }

  // 07_MASTER_USER
  async getUsers(activeOnly = true): Promise<MasterUser[]> {
    await this.init();
    return this.db['07_MASTER_USER'].filter(u => (activeOnly ? u.Active : true));
  }

  async getUserById(userId: string): Promise<MasterUser | null> {
    await this.init();
    const found = this.db['07_MASTER_USER'].find(u => u.User_ID === userId);
    return found ? { ...found } : null;
  }

  async getUserByEmail(email: string): Promise<MasterUser | null> {
    await this.init();
    const found = this.db['07_MASTER_USER'].find(u => u.Login_Email.toLowerCase() === email.toLowerCase());
    return found ? { ...found } : null;
  }

  async insertUser(user: MasterUser): Promise<MasterUser> {
    await this.init();
    if (this.db['07_MASTER_USER'].some(u => u.Login_Email.toLowerCase() === user.Login_Email.toLowerCase())) {
      throw new Error(`Email ${user.Login_Email} sudah digunakan`);
    }
    this.db['07_MASTER_USER'].push({ ...user });
    await this.persist();
    return { ...user };
  }

  async updateUser(userId: string, updates: Partial<MasterUser>): Promise<MasterUser | null> {
    await this.init();
    const index = this.db['07_MASTER_USER'].findIndex(u => u.User_ID === userId);
    if (index === -1) return null;

    const updated = {
      ...this.db['07_MASTER_USER'][index],
      ...updates
    };
    this.db['07_MASTER_USER'][index] = updated;
    await this.persist();
    return { ...updated };
  }

  // 08_LOG_AUDIT
  async getAuditLogs(limit = 100): Promise<LogAudit[]> {
    await this.init();
    return [...this.db['08_LOG_AUDIT']].reverse().slice(0, limit);
  }

  async insertAuditLog(audit: LogAudit): Promise<LogAudit> {
    await this.init();
    this.db['08_LOG_AUDIT'].push({ ...audit });
    await this.persist();
    return { ...audit };
  }
}
