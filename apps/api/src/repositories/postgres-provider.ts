import { Pool, PoolClient } from 'pg';
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

const createTablesSql = `
CREATE TABLE IF NOT EXISTS machines (
  machine_id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  category_id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS locations (
  location_id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS pics (
  pic_id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS movements (
  movement_id TEXT PRIMARY KEY,
  request_id TEXT UNIQUE,
  machine_id TEXT NOT NULL,
  created_at BIGSERIAL,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS conditions (
  condition_log_id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL,
  created_at BIGSERIAL,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  login_email TEXT NOT NULL,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS audits (
  audit_id TEXT PRIMARY KEY,
  created_at BIGSERIAL,
  data JSONB NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_login_email_lower_uq ON users (LOWER(login_email));
CREATE INDEX IF NOT EXISTS movements_machine_created_idx ON movements (machine_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conditions_machine_created_idx ON conditions (machine_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audits_created_idx ON audits (created_at DESC);
`;

export class PostgresProvider implements ISheetsRepository {
  private readonly pool: Pool;
  private initialized = false;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10 });
    this.pool.on('error', error => console.error('[PostgreSQL] Pool error:', error.message));
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.pool.query(createTablesSql);
    this.initialized = true;
  }

  private async getOne<T>(table: string, keyColumn: string, key: string, client: Pool | PoolClient = this.pool): Promise<T | null> {
    const result = await client.query<{ data: T }>(`SELECT data FROM ${table} WHERE ${keyColumn} = $1`, [key]);
    return result.rows[0]?.data || null;
  }

  private async getAll<T>(table: string, orderBy = ''): Promise<T[]> {
    const result = await this.pool.query<{ data: T }>(`SELECT data FROM ${table}${orderBy ? ` ORDER BY ${orderBy}` : ''}`);
    return result.rows.map(row => row.data);
  }

  private async insert<T extends object>(table: string, keyColumn: string, key: string, data: T, extraColumns = '', extraValues: unknown[] = []): Promise<T> {
    const columns = `${keyColumn}, data${extraColumns}`;
    const values = ['$1', '$2', ...extraValues.map((_, index) => `$${index + 3}`)];
    const parameters = [key, JSON.stringify(data), ...extraValues];
    await this.pool.query(`INSERT INTO ${table} (${columns}) VALUES (${values.join(', ')})`, parameters);
    return data;
  }

  private async update<T extends object>(table: string, keyColumn: string, key: string, updates: Partial<T>, client: Pool | PoolClient = this.pool): Promise<T | null> {
    const result = await client.query<{ data: T }>(
      `UPDATE ${table} SET data = data || $2::jsonb WHERE ${keyColumn} = $1 RETURNING data`,
      [key, JSON.stringify(updates)]
    );
    return result.rows[0]?.data || null;
  }

  async getMachines(filter?: { activeOnly?: boolean; categoryId?: string; locationId?: string; status?: string; condition?: string }): Promise<MasterMesin[]> {
    const machines = await this.getAll<MasterMesin>('machines');
    return machines.filter(machine => {
      if (filter?.activeOnly && !machine.Active) return false;
      if (filter?.categoryId && machine.Category_ID !== filter.categoryId) return false;
      if (filter?.locationId && machine.Current_Location_ID !== filter.locationId) return false;
      if (filter?.status && machine.Current_Status !== filter.status) return false;
      if (filter?.condition && machine.Machine_Condition !== filter.condition) return false;
      return true;
    });
  }

  getMachineById(machineId: string): Promise<MasterMesin | null> { return this.getOne('machines', 'machine_id', machineId); }
  async getMachineByQRToken(qrToken: string): Promise<MasterMesin | null> {
    const result = await this.pool.query<{ data: MasterMesin }>("SELECT data FROM machines WHERE data->>'QR_Token' = $1 LIMIT 1", [qrToken]);
    return result.rows[0]?.data || null;
  }
  insertMachine(machine: MasterMesin): Promise<MasterMesin> { return this.insert('machines', 'machine_id', machine.Machine_ID, machine); }
  updateMachine(machineId: string, updates: Partial<MasterMesin>): Promise<MasterMesin | null> {
    return this.update('machines', 'machine_id', machineId, { ...updates, Updated_At: new Date().toISOString() });
  }

  async getCategories(activeOnly = true): Promise<MasterKategori[]> {
    return (await this.getAll<MasterKategori>('categories')).filter(item => !activeOnly || item.Active);
  }
  getCategoryById(categoryId: string): Promise<MasterKategori | null> { return this.getOne('categories', 'category_id', categoryId); }
  insertCategory(category: MasterKategori): Promise<MasterKategori> { return this.insert('categories', 'category_id', category.Category_ID, category); }

  async getLocations(activeOnly = true): Promise<MasterLokasi[]> {
    return (await this.getAll<MasterLokasi>('locations')).filter(item => !activeOnly || item.Active);
  }
  getLocationById(locationId: string): Promise<MasterLokasi | null> { return this.getOne('locations', 'location_id', locationId); }
  insertLocation(location: MasterLokasi): Promise<MasterLokasi> { return this.insert('locations', 'location_id', location.Location_ID, location); }

  async getPICs(activeOnly = true): Promise<MasterPIC[]> {
    return (await this.getAll<MasterPIC>('pics')).filter(item => !activeOnly || item.Active);
  }
  getPICById(picId: string): Promise<MasterPIC | null> { return this.getOne('pics', 'pic_id', picId); }
  insertPIC(pic: MasterPIC): Promise<MasterPIC> { return this.insert('pics', 'pic_id', pic.PIC_ID, pic); }

  async getMovements(filter?: { machineId?: string; fromDate?: string; toDate?: string; status?: string }): Promise<LogPerpindahan[]> {
    const movements = await this.getAll<LogPerpindahan>('movements', 'created_at DESC');
    return movements.filter(item => {
      if (filter?.machineId && item.Machine_ID !== filter.machineId) return false;
      if (filter?.status && item.Status !== filter.status) return false;
      if (filter?.fromDate && item.Movement_DateTime < filter.fromDate) return false;
      if (filter?.toDate && item.Movement_DateTime > filter.toDate) return false;
      return true;
    });
  }
  getMovementById(movementId: string): Promise<LogPerpindahan | null> { return this.getOne('movements', 'movement_id', movementId); }
  async getMovementByRequestId(requestId: string): Promise<LogPerpindahan | null> {
    const result = await this.pool.query<{ data: LogPerpindahan }>('SELECT data FROM movements WHERE request_id = $1 LIMIT 1', [requestId]);
    return result.rows[0]?.data || null;
  }
  insertMovement(movement: LogPerpindahan): Promise<LogPerpindahan> {
    return this.insert('movements', 'movement_id', movement.Movement_ID, movement, ', request_id, machine_id', [movement.Request_ID || null, movement.Machine_ID]);
  }
  async updateMovementStatus(movementId: string, status: MovementStatus, notes?: string): Promise<LogPerpindahan | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await this.getOne<LogPerpindahan>('movements', 'movement_id', movementId, client);
      if (!existing) {
        await client.query('COMMIT');
        return null;
      }
      const updated = { ...existing, Status: status, ...(notes !== undefined ? { Notes: notes } : {}) };
      await client.query('UPDATE movements SET data = $2::jsonb WHERE movement_id = $1', [movementId, JSON.stringify(updated)]);
      await client.query('COMMIT');
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getConditionLogs(filter?: { machineId?: string; repairStatus?: string }): Promise<LogKondisi[]> {
    const records = await this.getAll<LogKondisi>('conditions', 'created_at DESC');
    return records.filter(item => {
      if (filter?.machineId && item.Machine_ID !== filter.machineId) return false;
      if (filter?.repairStatus && item.Repair_Status !== filter.repairStatus) return false;
      return true;
    });
  }
  getConditionLogById(logId: string): Promise<LogKondisi | null> { return this.getOne('conditions', 'condition_log_id', logId); }
  insertConditionLog(log: LogKondisi): Promise<LogKondisi> {
    return this.insert('conditions', 'condition_log_id', log.Condition_Log_ID, log, ', machine_id', [log.Machine_ID]);
  }
  updateConditionLog(logId: string, updates: Partial<LogKondisi>): Promise<LogKondisi | null> {
    return this.update('conditions', 'condition_log_id', logId, updates);
  }

  async getUsers(activeOnly = true): Promise<MasterUser[]> {
    return (await this.getAll<MasterUser>('users')).filter(item => !activeOnly || item.Active);
  }
  getUserById(userId: string): Promise<MasterUser | null> { return this.getOne('users', 'user_id', userId); }
  async getUserByEmail(email: string): Promise<MasterUser | null> {
    const result = await this.pool.query<{ data: MasterUser }>('SELECT data FROM users WHERE LOWER(login_email) = LOWER($1) LIMIT 1', [email]);
    return result.rows[0]?.data || null;
  }
  insertUser(user: MasterUser): Promise<MasterUser> {
    return this.insert('users', 'user_id', user.User_ID, user, ', login_email', [user.Login_Email]);
  }
  async updateUser(userId: string, updates: Partial<MasterUser>): Promise<MasterUser | null> {
    const updated = await this.update('users', 'user_id', userId, updates);
    if (!updated) return null;
    if (updates.Login_Email !== undefined) {
      await this.pool.query('UPDATE users SET login_email = $2 WHERE user_id = $1', [userId, updated.Login_Email]);
    }
    return updated;
  }

  getAuditLogs(limit = 100): Promise<LogAudit[]> {
    return this.getAll<LogAudit>('audits', 'created_at DESC').then(records => records.slice(0, limit));
  }
  insertAuditLog(audit: LogAudit): Promise<LogAudit> { return this.insert('audits', 'audit_id', audit.Audit_ID, audit); }
}
