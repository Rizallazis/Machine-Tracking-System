import { google, sheets_v4 } from 'googleapis';
import {
  MasterMesin,
  MasterKategori,
  MasterLokasi,
  MasterPIC,
  LogPerpindahan,
  LogKondisi,
  MasterUser,
  LogAudit,
  MovementStatus,
  MachineStatus,
  MachineCondition,
  ConditionType,
  RepairStatus,
  UserRole,
  AuditResult
} from '@machine-tracking/shared';
import { ISheetsRepository } from './sheets-interface';

export class GoogleSheetsProvider implements ISheetsRepository {
  private sheets!: sheets_v4.Sheets;
  private spreadsheetId: string;
  private serviceAccountEmail: string;
  private privateKey: string;
  private isInitialized = false;
  private readonly readCache = new Map<string, { expiresAt: number; rows: string[][] }>();
  private readonly cacheTtlMs = 15_000;

  constructor(options: { spreadsheetId: string; serviceAccountEmail: string; privateKey: string }) {
    this.spreadsheetId = options.spreadsheetId;
    this.serviceAccountEmail = options.serviceAccountEmail;
    this.privateKey = options.privateKey.replace(/\\n/g, '\n');
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    const auth = new google.auth.JWT({
      email: this.serviceAccountEmail,
      key: this.privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.isInitialized = true;
  }

  // Helper to read range
  private async readRows(sheetName: string): Promise<string[][]> {
    await this.init();

    // Cache only relatively static master data. Machine and transaction logs are
    // deliberately excluded because their state must stay fresh.
    const cacheableSheets = new Set(['02_MASTER_KATEGORI', '03_MASTER_LOKASI', '04_MASTER_PIC']);
    if (cacheableSheets.has(sheetName)) {
      const cached = this.readCache.get(sheetName);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.rows.map(row => [...row]);
      }
    }

    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A2:Z`
      });
      const rows = ((res.data.values || []) as string[][]).map(row => [...row]);
      if (cacheableSheets.has(sheetName)) {
        this.readCache.set(sheetName, { rows, expiresAt: Date.now() + this.cacheTtlMs });
      }
      return rows;
    } catch (err: any) {
      // Do not turn quota/network errors into empty data. Callers must receive
      // the failure so the API cannot silently report an empty sheet.
      console.error(`Gagal membaca sheet ${sheetName}:`, err?.message);
      throw err;
    }
  }

  // Helper to append row
  private async appendRow(sheetName: string, values: any[]): Promise<void> {
    await this.init();
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values.map(v => (v === undefined || v === null ? '' : String(v)))]
      }
    });
    this.readCache.delete(sheetName);
  }

  // 01_MASTER_MESIN
  async getMachines(filter?: { activeOnly?: boolean; categoryId?: string; locationId?: string; status?: string; condition?: string }): Promise<MasterMesin[]> {
    const rows = await this.readRows('01_MASTER_MESIN');
    return rows
      .map(r => ({
        Machine_ID: r[0] || '',
        QR_Token: r[1] || '',
        Machine_Name: r[2] || '',
        Category_ID: r[3] || '',
        Brand: r[4] || '',
        Model: r[5] || '',
        Serial_Number: r[6] || '',
        Asset_Number: r[7] || '',
        Purchase_Date: r[8] || '',
        Current_Location_ID: r[9] || '',
        Current_PIC_ID: r[10] || '',
        Current_Status: (r[11] || MachineStatus.AVAILABLE) as MachineStatus,
        Machine_Condition: (r[12] || MachineCondition.NORMAL) as MachineCondition,
        Created_At: r[13] || '',
        Created_By: r[14] || '',
        Updated_At: r[15] || '',
        Updated_By: r[16] || '',
        Active: String(r[17]).toUpperCase() === 'TRUE',
        Notes: r[18] || '',
        ID_Code: r[19] || ''
      }))
      .filter(m => {
        if (!m.Machine_ID) return false;
        if (filter?.activeOnly && !m.Active) return false;
        if (filter?.categoryId && m.Category_ID !== filter.categoryId) return false;
        if (filter?.locationId && m.Current_Location_ID !== filter.locationId) return false;
        if (filter?.status && m.Current_Status !== filter.status) return false;
        if (filter?.condition && m.Machine_Condition !== filter.condition) return false;
        return true;
      });
  }

  async getMachineById(machineId: string): Promise<MasterMesin | null> {
    const machines = await this.getMachines();
    return machines.find(m => m.Machine_ID === machineId) || null;
  }

  async getMachineByQRToken(qrToken: string): Promise<MasterMesin | null> {
    const machines = await this.getMachines();
    return machines.find(m => m.QR_Token === qrToken) || null;
  }

  async insertMachine(machine: MasterMesin): Promise<MasterMesin> {
    const existing = await this.getMachineById(machine.Machine_ID);
    if (existing) {
      throw new Error(`Mesin dengan ID ${machine.Machine_ID} sudah terdaftar`);
    }

    await this.appendRow('01_MASTER_MESIN', [
      machine.Machine_ID,
      machine.QR_Token,
      machine.Machine_Name,
      machine.Category_ID,
      machine.Brand,
      machine.Model,
      machine.Serial_Number,
      machine.Asset_Number,
      machine.Purchase_Date,
      machine.Current_Location_ID,
      machine.Current_PIC_ID,
      machine.Current_Status,
      machine.Machine_Condition,
      machine.Created_At,
      machine.Created_By,
      machine.Updated_At,
      machine.Updated_By,
      machine.Active ? 'TRUE' : 'FALSE',
      machine.Notes,
      machine.ID_Code || ''
    ]);

    return machine;
  }

  async updateMachine(machineId: string, updates: Partial<MasterMesin>): Promise<MasterMesin | null> {
    await this.init();
    const rows = await this.readRows('01_MASTER_MESIN');
    const rowIndex = rows.findIndex(r => r[0] === machineId);
    if (rowIndex === -1) return null;

    const row = rows[rowIndex];
    const updated: MasterMesin = {
      Machine_ID: row[0],
      QR_Token: row[1],
      Machine_Name: updates.Machine_Name !== undefined ? updates.Machine_Name : row[2],
      Category_ID: updates.Category_ID !== undefined ? updates.Category_ID : row[3],
      Brand: updates.Brand !== undefined ? updates.Brand : row[4],
      Model: updates.Model !== undefined ? updates.Model : row[5],
      Serial_Number: updates.Serial_Number !== undefined ? updates.Serial_Number : row[6],
      Asset_Number: updates.Asset_Number !== undefined ? updates.Asset_Number : row[7],
      Purchase_Date: updates.Purchase_Date !== undefined ? updates.Purchase_Date : row[8],
      Current_Location_ID: updates.Current_Location_ID !== undefined ? updates.Current_Location_ID : row[9],
      Current_PIC_ID: updates.Current_PIC_ID !== undefined ? updates.Current_PIC_ID : row[10],
      Current_Status: (updates.Current_Status !== undefined ? updates.Current_Status : row[11]) as MachineStatus,
      Machine_Condition: (updates.Machine_Condition !== undefined ? updates.Machine_Condition : row[12]) as MachineCondition,
      Created_At: row[13],
      Created_By: row[14],
      Updated_At: new Date().toISOString(),
      Updated_By: updates.Updated_By !== undefined ? updates.Updated_By : row[16],
      Active: updates.Active !== undefined ? updates.Active : String(row[17]).toUpperCase() === 'TRUE',
      Notes: updates.Notes !== undefined ? updates.Notes : row[18],
      ID_Code: updates.ID_Code !== undefined ? updates.ID_Code : (row[19] || '')
    };

    // Google Sheets is 1-indexed, and row 1 is header, so row in A2:Z starts at index 2
    const actualSheetRowNumber = rowIndex + 2;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `01_MASTER_MESIN!A${actualSheetRowNumber}:T${actualSheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          updated.Machine_ID,
          updated.QR_Token,
          updated.Machine_Name,
          updated.Category_ID,
          updated.Brand,
          updated.Model,
          updated.Serial_Number,
          updated.Asset_Number,
          updated.Purchase_Date,
          updated.Current_Location_ID,
          updated.Current_PIC_ID,
          updated.Current_Status,
          updated.Machine_Condition,
          updated.Created_At,
          updated.Created_By,
          updated.Updated_At,
          updated.Updated_By,
          updated.Active ? 'TRUE' : 'FALSE',
          updated.Notes,
          updated.ID_Code || ''
        ]]
      }
    });

    return updated;
  }

  // 02_MASTER_KATEGORI
  async getCategories(activeOnly = true): Promise<MasterKategori[]> {
    const rows = await this.readRows('02_MASTER_KATEGORI');
    return rows
      .map(r => ({
        Category_ID: r[0] || '',
        Category_Name: r[1] || '',
        Department: r[2] || '',
        Description: r[3] || '',
        Active: String(r[4]).toUpperCase() === 'TRUE'
      }))
      .filter(k => k.Category_ID && (activeOnly ? k.Active : true));
  }

  async getCategoryById(categoryId: string): Promise<MasterKategori | null> {
    const list = await this.getCategories(false);
    return list.find(k => k.Category_ID === categoryId) || null;
  }

  async insertCategory(category: MasterKategori): Promise<MasterKategori> {
    await this.appendRow('02_MASTER_KATEGORI', [
      category.Category_ID,
      category.Category_Name,
      category.Department,
      category.Description,
      category.Active ? 'TRUE' : 'FALSE'
    ]);
    return category;
  }

  // 03_MASTER_LOKASI
  async getLocations(activeOnly = true): Promise<MasterLokasi[]> {
    const rows = await this.readRows('03_MASTER_LOKASI');
    return rows
      .map(r => ({
        Location_ID: r[0] || '',
        Building: r[1] || '',
        Floor: r[2] || '',
        Department: r[3] || '',
        Area: r[4] || '',
        Line: r[5] || '',
        Position_Code: r[6] || '',
        Location_Name: r[7] || '',
        Active: String(r[8]).toUpperCase() === 'TRUE',
        Notes: r[9] || ''
      }))
      .filter(l => l.Location_ID && (activeOnly ? l.Active : true));
  }

  async getLocationById(locationId: string): Promise<MasterLokasi | null> {
    const list = await this.getLocations(false);
    return list.find(l => l.Location_ID === locationId) || null;
  }

  async insertLocation(location: MasterLokasi): Promise<MasterLokasi> {
    await this.appendRow('03_MASTER_LOKASI', [
      location.Location_ID,
      location.Building,
      location.Floor,
      location.Department,
      location.Area,
      location.Line,
      location.Position_Code,
      location.Location_Name,
      location.Active ? 'TRUE' : 'FALSE',
      location.Notes
    ]);
    return location;
  }

  // 04_MASTER_PIC
  async getPICs(activeOnly = true): Promise<MasterPIC[]> {
    const rows = await this.readRows('04_MASTER_PIC');
    return rows
      .map(r => ({
        PIC_ID: r[0] || '',
        PIC_Name: r[1] || '',
        Employee_ID: r[2] || '',
        Department: r[3] || '',
        Role: r[4] || '',
        User_ID: r[5] || '',
        Active: String(r[6]).toUpperCase() === 'TRUE'
      }))
      .filter(p => p.PIC_ID && (activeOnly ? p.Active : true));
  }

  async getPICById(picId: string): Promise<MasterPIC | null> {
    const list = await this.getPICs(false);
    return list.find(p => p.PIC_ID === picId) || null;
  }

  async insertPIC(pic: MasterPIC): Promise<MasterPIC> {
    await this.appendRow('04_MASTER_PIC', [
      pic.PIC_ID,
      pic.PIC_Name,
      pic.Employee_ID,
      pic.Department,
      pic.Role,
      pic.User_ID,
      pic.Active ? 'TRUE' : 'FALSE'
    ]);
    return pic;
  }

  // 05_LOG_PERPINDAHAN
  async getMovements(filter?: { machineId?: string; fromDate?: string; toDate?: string; status?: string }): Promise<LogPerpindahan[]> {
    const rows = await this.readRows('05_LOG_PERPINDAHAN');
    return rows
      .map(r => ({
        Movement_ID: r[0] || '',
        Machine_ID: r[1] || '',
        From_Location_ID: r[2] || '',
        To_Location_ID: r[3] || '',
        Old_PIC_ID: r[4] || '',
        New_PIC_ID: r[5] || '',
        Movement_DateTime: r[6] || '',
        Movement_Reason: r[7] || '',
        Requested_By: r[8] || '',
        Approved_By: r[9] || '',
        Status: (r[10] || MovementStatus.PENDING) as MovementStatus,
        Notes: r[11] || '',
        Request_ID: r[12] || ''
      }))
      .filter(m => {
        if (!m.Movement_ID) return false;
        if (filter?.machineId && m.Machine_ID !== filter.machineId) return false;
        if (filter?.status && m.Status !== filter.status) return false;
        if (filter?.fromDate && m.Movement_DateTime < filter.fromDate) return false;
        if (filter?.toDate && m.Movement_DateTime > filter.toDate) return false;
        return true;
      })
      .reverse();
  }

  async getMovementById(movementId: string): Promise<LogPerpindahan | null> {
    const list = await this.getMovements();
    return list.find(m => m.Movement_ID === movementId) || null;
  }

  async getMovementByRequestId(requestId: string): Promise<LogPerpindahan | null> {
    const list = await this.getMovements();
    return list.find(m => m.Request_ID === requestId) || null;
  }

  async insertMovement(movement: LogPerpindahan): Promise<LogPerpindahan> {
    await this.appendRow('05_LOG_PERPINDAHAN', [
      movement.Movement_ID,
      movement.Machine_ID,
      movement.From_Location_ID,
      movement.To_Location_ID,
      movement.Old_PIC_ID,
      movement.New_PIC_ID,
      movement.Movement_DateTime,
      movement.Movement_Reason,
      movement.Requested_By,
      movement.Approved_By,
      movement.Status,
      movement.Notes,
      movement.Request_ID
    ]);
    return movement;
  }

  async updateMovementStatus(movementId: string, status: MovementStatus, notes?: string): Promise<LogPerpindahan | null> {
    await this.init();
    const rows = await this.readRows('05_LOG_PERPINDAHAN');
    const rowIndex = rows.findIndex(r => r[0] === movementId);
    if (rowIndex === -1) return null;

    const actualRow = rowIndex + 2;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `05_LOG_PERPINDAHAN!K${actualRow}:L${actualRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[status, notes !== undefined ? notes : rows[rowIndex][11] || '']]
      }
    });

    return this.getMovementById(movementId);
  }

  // 06_LOG_KONDISI
  async getConditionLogs(filter?: { machineId?: string; repairStatus?: string }): Promise<LogKondisi[]> {
    const rows = await this.readRows('06_LOG_KONDISI');
    return rows
      .map(r => ({
        Condition_Log_ID: r[0] || '',
        Machine_ID: r[1] || '',
        Report_DateTime: r[2] || '',
        Condition_Type: (r[3] || ConditionType.NORMAL) as ConditionType,
        Problem_Description: r[4] || '',
        Reported_By: r[5] || '',
        Technician_ID: r[6] || '',
        Action_Taken: r[7] || '',
        Repair_Status: (r[8] || RepairStatus.OPEN) as RepairStatus,
        Completion_DateTime: r[9] || '',
        Notes: r[10] || ''
      }))
      .filter(c => {
        if (!c.Condition_Log_ID) return false;
        if (filter?.machineId && c.Machine_ID !== filter.machineId) return false;
        if (filter?.repairStatus && c.Repair_Status !== filter.repairStatus) return false;
        return true;
      })
      .reverse();
  }

  async getConditionLogById(logId: string): Promise<LogKondisi | null> {
    const list = await this.getConditionLogs();
    return list.find(c => c.Condition_Log_ID === logId) || null;
  }

  async insertConditionLog(log: LogKondisi): Promise<LogKondisi> {
    await this.appendRow('06_LOG_KONDISI', [
      log.Condition_Log_ID,
      log.Machine_ID,
      log.Report_DateTime,
      log.Condition_Type,
      log.Problem_Description,
      log.Reported_By,
      log.Technician_ID,
      log.Action_Taken,
      log.Repair_Status,
      log.Completion_DateTime,
      log.Notes
    ]);
    return log;
  }

  async updateConditionLog(logId: string, updates: Partial<LogKondisi>): Promise<LogKondisi | null> {
    await this.init();
    const rows = await this.readRows('06_LOG_KONDISI');
    const rowIndex = rows.findIndex(r => r[0] === logId);
    if (rowIndex === -1) return null;

    const actualRow = rowIndex + 2;
    const existing = rows[rowIndex];

    const techId = updates.Technician_ID !== undefined ? updates.Technician_ID : existing[6];
    const action = updates.Action_Taken !== undefined ? updates.Action_Taken : existing[7];
    const repairStatus = updates.Repair_Status !== undefined ? updates.Repair_Status : existing[8];
    const compDate = updates.Completion_DateTime !== undefined ? updates.Completion_DateTime : existing[9];
    const notes = updates.Notes !== undefined ? updates.Notes : existing[10];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `06_LOG_KONDISI!G${actualRow}:K${actualRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[techId, action, repairStatus, compDate, notes]]
      }
    });

    // Return the updated record from the row already read above. Avoid a second
    // Google Sheets read just to fetch the same record after writing it.
    return {
      Condition_Log_ID: existing[0] || '',
      Machine_ID: existing[1] || '',
      Report_DateTime: existing[2] || '',
      Condition_Type: (existing[3] || ConditionType.NORMAL) as ConditionType,
      Problem_Description: existing[4] || '',
      Reported_By: existing[5] || '',
      Technician_ID: techId || '',
      Action_Taken: action || '',
      Repair_Status: (repairStatus || RepairStatus.OPEN) as RepairStatus,
      Completion_DateTime: compDate || '',
      Notes: notes || ''
    };
  }

  // 07_MASTER_USER
  async getUsers(activeOnly = true): Promise<MasterUser[]> {
    const rows = await this.readRows('07_MASTER_USER');
    return rows
      .map(r => ({
        User_ID: r[0] || '',
        User_Name: r[1] || '',
        Login_Email: r[2] || '',
        Role_ID: (r[3] || UserRole.PIC) as UserRole,
        Department: r[4] || '',
        Active: String(r[5]).toUpperCase() === 'TRUE',
        Created_At: r[6] || '',
        Password_Hash: r[7] || ''
      }))
      .filter(u => u.User_ID && (activeOnly ? u.Active : true));
  }

  async getUserById(userId: string): Promise<MasterUser | null> {
    const list = await this.getUsers(false);
    return list.find(u => u.User_ID === userId) || null;
  }

  async getUserByEmail(email: string): Promise<MasterUser | null> {
    const list = await this.getUsers(false);
    return list.find(u => u.Login_Email.toLowerCase() === email.toLowerCase()) || null;
  }

  async insertUser(user: MasterUser): Promise<MasterUser> {
    await this.appendRow('07_MASTER_USER', [
      user.User_ID,
      user.User_Name,
      user.Login_Email,
      user.Role_ID,
      user.Department,
      user.Active ? 'TRUE' : 'FALSE',
      user.Created_At,
      user.Password_Hash || ''
    ]);
    return user;
  }

  async updateUser(userId: string, updates: Partial<MasterUser>): Promise<MasterUser | null> {
    await this.init();
    const rows = await this.readRows('07_MASTER_USER');
    const rowIndex = rows.findIndex(r => r[0] === userId);
    if (rowIndex === -1) return null;

    const actualRow = rowIndex + 2;
    const existing = rows[rowIndex];

    const userName = updates.User_Name !== undefined ? updates.User_Name : existing[1];
    const roleId = updates.Role_ID !== undefined ? updates.Role_ID : existing[3];
    const dept = updates.Department !== undefined ? updates.Department : existing[4];
    const active = updates.Active !== undefined ? (updates.Active ? 'TRUE' : 'FALSE') : existing[5];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `07_MASTER_USER!B${actualRow}:F${actualRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[userName, existing[2], roleId, dept, active]]
      }
    });

    return this.getUserById(userId);
  }

  // 08_LOG_AUDIT
  async getAuditLogs(limit = 100): Promise<LogAudit[]> {
    const rows = await this.readRows('08_LOG_AUDIT');
    return rows
      .map(r => ({
        Audit_ID: r[0] || '',
        User_ID: r[1] || '',
        Action: r[2] || '',
        Entity_Type: r[3] || '',
        Entity_ID: r[4] || '',
        Timestamp: r[5] || '',
        Old_Value: r[6] || '',
        New_Value: r[7] || '',
        Request_ID: r[8] || '',
        Result: (r[9] || AuditResult.SUCCESS) as AuditResult
      }))
      .reverse()
      .slice(0, limit);
  }

  async insertAuditLog(audit: LogAudit): Promise<LogAudit> {
    await this.appendRow('08_LOG_AUDIT', [
      audit.Audit_ID,
      audit.User_ID,
      audit.Action,
      audit.Entity_Type,
      audit.Entity_ID,
      audit.Timestamp,
      audit.Old_Value,
      audit.New_Value,
      audit.Request_ID,
      audit.Result
    ]);
    return audit;
  }
}
