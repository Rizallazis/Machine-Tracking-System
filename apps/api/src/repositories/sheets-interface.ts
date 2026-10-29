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

export interface ISheetsRepository {
  init(): Promise<void>;

  // 01_MASTER_MESIN
  getMachines(filter?: { activeOnly?: boolean; categoryId?: string; locationId?: string; status?: string; condition?: string }): Promise<MasterMesin[]>;
  getMachineById(machineId: string): Promise<MasterMesin | null>;
  getMachineByQRToken(qrToken: string): Promise<MasterMesin | null>;
  insertMachine(machine: MasterMesin): Promise<MasterMesin>;
  updateMachine(machineId: string, updates: Partial<MasterMesin>): Promise<MasterMesin | null>;

  // 02_MASTER_KATEGORI
  getCategories(activeOnly?: boolean): Promise<MasterKategori[]>;
  getCategoryById(categoryId: string): Promise<MasterKategori | null>;
  insertCategory(category: MasterKategori): Promise<MasterKategori>;

  // 03_MASTER_LOKASI
  getLocations(activeOnly?: boolean): Promise<MasterLokasi[]>;
  getLocationById(locationId: string): Promise<MasterLokasi | null>;
  insertLocation(location: MasterLokasi): Promise<MasterLokasi>;

  // 04_MASTER_PIC
  getPICs(activeOnly?: boolean): Promise<MasterPIC[]>;
  getPICById(picId: string): Promise<MasterPIC | null>;
  insertPIC(pic: MasterPIC): Promise<MasterPIC>;

  // 05_LOG_PERPINDAHAN
  getMovements(filter?: { machineId?: string; fromDate?: string; toDate?: string; status?: string }): Promise<LogPerpindahan[]>;
  getMovementById(movementId: string): Promise<LogPerpindahan | null>;
  getMovementByRequestId(requestId: string): Promise<LogPerpindahan | null>;
  insertMovement(movement: LogPerpindahan): Promise<LogPerpindahan>;
  updateMovementStatus(movementId: string, status: LogPerpindahan['Status'], notes?: string): Promise<LogPerpindahan | null>;

  // 06_LOG_KONDISI
  getConditionLogs(filter?: { machineId?: string; repairStatus?: string }): Promise<LogKondisi[]>;
  getConditionLogById(logId: string): Promise<LogKondisi | null>;
  insertConditionLog(log: LogKondisi): Promise<LogKondisi>;
  updateConditionLog(logId: string, updates: Partial<LogKondisi>): Promise<LogKondisi | null>;

  // 07_MASTER_USER
  getUsers(activeOnly?: boolean): Promise<MasterUser[]>;
  getUserById(userId: string): Promise<MasterUser | null>;
  getUserByEmail(email: string): Promise<MasterUser | null>;
  insertUser(user: MasterUser): Promise<MasterUser>;
  updateUser(userId: string, updates: Partial<MasterUser>): Promise<MasterUser | null>;

  // 08_LOG_AUDIT
  getAuditLogs(limit?: number): Promise<LogAudit[]>;
  insertAuditLog(audit: LogAudit): Promise<LogAudit>;
}
