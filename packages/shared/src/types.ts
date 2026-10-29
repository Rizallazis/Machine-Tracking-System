import {
  MachineStatus,
  MachineCondition,
  RepairStatus,
  UserRole,
  MovementStatus,
  ConditionType,
  AuditResult
} from './enums';

// 01_MASTER_MESIN
export interface MasterMesin {
  Machine_ID: string;
  QR_Token: string;
  ID_Code: string;       // Kode barcode internal pabrik / sistem ERP lama
  Machine_Name: string;
  Category_ID: string;
  Brand: string;
  Model: string;
  Serial_Number: string;
  Asset_Number: string;
  Purchase_Date: string;
  Current_Location_ID: string;
  Current_PIC_ID: string;
  Current_Status: MachineStatus;
  Machine_Condition: MachineCondition;
  Created_At: string;
  Created_By: string;
  Updated_At: string;
  Updated_By: string;
  Active: boolean;
  Notes: string;
}

// 02_MASTER_KATEGORI
export interface MasterKategori {
  Category_ID: string;
  Category_Name: string;
  Department: string;
  Description: string;
  Active: boolean;
}

// 03_MASTER_LOKASI
export interface MasterLokasi {
  Location_ID: string;
  Building: string;
  Floor: string;
  Department: string;
  Area: string;
  Line: string;
  Position_Code: string;
  Location_Name: string;
  Active: boolean;
  Notes: string;
}

// 04_MASTER_PIC
export interface MasterPIC {
  PIC_ID: string;
  PIC_Name: string;
  Employee_ID: string;
  Department: string;
  Role: string;
  User_ID: string;
  Active: boolean;
}

// 05_LOG_PERPINDAHAN
export interface LogPerpindahan {
  Movement_ID: string;
  Machine_ID: string;
  From_Location_ID: string;
  To_Location_ID: string;
  Old_PIC_ID: string;
  New_PIC_ID: string;
  Movement_DateTime: string;
  Movement_Reason: string;
  Requested_By: string;
  Approved_By: string;
  Status: MovementStatus;
  Notes: string;
  Request_ID: string;
}

// 06_LOG_KONDISI
export interface LogKondisi {
  Condition_Log_ID: string;
  Machine_ID: string;
  Report_DateTime: string;
  Condition_Type: ConditionType;
  Problem_Description: string;
  Reported_By: string;
  Technician_ID: string;
  Action_Taken: string;
  Repair_Status: RepairStatus;
  Completion_DateTime: string;
  Notes: string;
}

// 07_MASTER_USER
export interface MasterUser {
  User_ID: string;
  User_Name: string;
  Login_Email: string;
  Password_Hash?: string;
  Role_ID: UserRole;
  Department: string;
  Active: boolean;
  Created_At: string;
}

// 08_LOG_AUDIT
export interface LogAudit {
  Audit_ID: string;
  User_ID: string;
  Action: string;
  Entity_Type: string;
  Entity_ID: string;
  Timestamp: string;
  Old_Value: string;
  New_Value: string;
  Request_ID: string;
  Result: AuditResult;
}

// Enriched Machine with Category, Location, and PIC names for UI
export interface EnrichedMachine extends MasterMesin {
  Category_Name?: string;
  Location_Name?: string;
  Location_Line?: string;
  Location_Building?: string;
  PIC_Name?: string;
  PIC_Role?: string;
}

// DTO Requests & Responses
export interface LoginRequest {
  email: string;
  password?: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<MasterUser, 'Password_Hash'>;
}

export interface MovementRequest {
  machineId: string;
  toLocationId: string;
  newPicId: string;
  reason: string;
  requestId: string;
  notes?: string;
}

export interface MovementResponse {
  success: boolean;
  movementId: string;
  machineId: string;
  currentLocationId: string;
  currentPicId: string;
  status: MovementStatus;
  message?: string;
}

export interface CreateMachineRequest {
  machineName: string;
  categoryId: string;
  brand: string;
  model: string;
  serialNumber: string;
  assetNumber?: string;
  idCode?: string;
  purchaseDate?: string;
  currentLocationId: string;
  currentPicId: string;
  currentStatus?: MachineStatus;
  machineCondition?: MachineCondition;
  notes?: string;
}

export interface UpdateMachineRequest {
  machineName?: string;
  categoryId?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  assetNumber?: string;
  idCode?: string;
  purchaseDate?: string;
  currentStatus?: MachineStatus;
  machineCondition?: MachineCondition;
  notes?: string;
}

export interface ConditionReportRequest {
  machineId: string;
  conditionType: ConditionType;
  problemDescription: string;
  technicianId?: string;
  actionTaken?: string;
  repairStatus?: RepairStatus;
  notes?: string;
}

export interface UpdateConditionRequest {
  technicianId?: string;
  actionTaken?: string;
  repairStatus: RepairStatus;
  notes?: string;
}

export interface DashboardSummary {
  totalMachines: number;
  activeMachines: number;
  statusCounts: Record<MachineStatus, number>;
  conditionCounts: Record<MachineCondition, number>;
  totalMovementsToday: number;
  recentMovements: LogPerpindahan[];
}

export interface DashboardByLocation {
  locationId: string;
  locationName: string;
  line: string;
  building: string;
  count: number;
  inUseCount: number;
  underRepairCount: number;
}

export interface DashboardByCategory {
  categoryId: string;
  categoryName: string;
  department: string;
  count: number;
}
