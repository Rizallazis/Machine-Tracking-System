export enum MachineStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  IDLE = 'IDLE',
  UNDER_REPAIR = 'UNDER_REPAIR',
  BORROWED = 'BORROWED',
  RETIRED = 'RETIRED'
}

export enum MachineCondition {
  NORMAL = 'NORMAL',
  NEEDS_INSPECTION = 'NEEDS_INSPECTION',
  DAMAGED = 'DAMAGED'
}

export enum RepairStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  IE = 'IE',
  SPV = 'SPV',
  MECHANIC = 'MECHANIC',
  PIC = 'PIC'
}

export enum MovementStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED'
}

export enum ConditionType {
  NORMAL = 'NORMAL',
  NEEDS_INSPECTION = 'NEEDS_INSPECTION',
  DAMAGED = 'DAMAGED'
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DEACTIVATE = 'DEACTIVATE',
  MOVEMENT = 'MOVEMENT',
  CONDITION_REPORT = 'CONDITION_REPORT',
  LOGIN = 'LOGIN'
}

export enum AuditResult {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

// User-friendly Indonesian labels
export const MachineStatusLabel: Record<MachineStatus, string> = {
  [MachineStatus.AVAILABLE]: 'Tersedia',
  [MachineStatus.IN_USE]: 'Digunakan',
  [MachineStatus.IDLE]: 'Menganggur (Idle)',
  [MachineStatus.UNDER_REPAIR]: 'Dalam Perbaikan',
  [MachineStatus.BORROWED]: 'Dipinjam',
  [MachineStatus.RETIRED]: 'Dinonaktifkan / Afkir'
};

export const MachineConditionLabel: Record<MachineCondition, string> = {
  [MachineCondition.NORMAL]: 'Normal',
  [MachineCondition.NEEDS_INSPECTION]: 'Perlu Pemeriksaan',
  [MachineCondition.DAMAGED]: 'Rusak'
};

export const RepairStatusLabel: Record<RepairStatus, string> = {
  [RepairStatus.OPEN]: 'Menunggu Tindakan',
  [RepairStatus.IN_PROGRESS]: 'Sedang Dikerjakan',
  [RepairStatus.COMPLETED]: 'Selesai Diperbaiki'
};

export const UserRoleLabel: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.IE]: 'Industrial Engineering (IE)',
  [UserRole.SPV]: 'Supervisor Produksi',
  [UserRole.MECHANIC]: 'Mekanik / Teknisi',
  [UserRole.PIC]: 'PIC / Operator'
};
