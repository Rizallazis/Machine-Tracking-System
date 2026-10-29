import { z } from 'zod';
import {
  MachineStatus,
  MachineCondition,
  RepairStatus,
  UserRole,
  ConditionType
} from './enums';

export const LoginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().optional()
});

export const MovementSchema = z.object({
  machineId: z.string().min(1, 'Machine ID wajib diisi'),
  toLocationId: z.string().min(1, 'Lokasi tujuan wajib diisi'),
  newPicId: z.string().min(1, 'PIC baru wajib diisi'),
  reason: z.string().min(3, 'Alasan perpindahan minimal 3 karakter'),
  requestId: z.string().min(1, 'Request ID (idempotency key) wajib disertakan'),
  notes: z.string().optional()
});

export const CreateMachineSchema = z.object({
  machineName: z.string().min(1, 'Nama mesin wajib diisi'),
  categoryId: z.string().min(1, 'Kategori wajib diisi'),
  brand: z.string().min(1, 'Merk wajib diisi'),
  model: z.string().min(1, 'Model wajib diisi'),
  serialNumber: z.string().min(1, 'Nomor seri wajib diisi'),
  assetNumber: z.string().optional().default(''),
  idCode: z.string().optional().default(''),
  purchaseDate: z.string().optional().default(''),
  currentLocationId: z.string().min(1, 'Lokasi saat ini wajib diisi'),
  currentPicId: z.string().min(1, 'PIC saat ini wajib diisi'),
  currentStatus: z.nativeEnum(MachineStatus).optional().default(MachineStatus.AVAILABLE),
  machineCondition: z.nativeEnum(MachineCondition).optional().default(MachineCondition.NORMAL),
  notes: z.string().optional().default('')
});

export const UpdateMachineSchema = z.object({
  machineName: z.string().optional(),
  categoryId: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  assetNumber: z.string().optional(),
  idCode: z.string().optional(),
  purchaseDate: z.string().optional(),
  currentStatus: z.nativeEnum(MachineStatus).optional(),
  machineCondition: z.nativeEnum(MachineCondition).optional(),
  notes: z.string().optional()
});

export const ConditionReportSchema = z.object({
  machineId: z.string().min(1, 'Machine ID wajib diisi'),
  conditionType: z.nativeEnum(ConditionType),
  problemDescription: z.string().min(3, 'Deskripsi masalah wajib diisi'),
  technicianId: z.string().optional(),
  actionTaken: z.string().optional(),
  repairStatus: z.nativeEnum(RepairStatus).optional().default(RepairStatus.OPEN),
  notes: z.string().optional()
});

export const UpdateConditionSchema = z.object({
  technicianId: z.string().optional(),
  actionTaken: z.string().optional(),
  repairStatus: z.nativeEnum(RepairStatus),
  notes: z.string().optional()
});

export const CreateCategorySchema = z.object({
  categoryName: z.string().min(1, 'Nama kategori wajib diisi'),
  department: z.string().min(1, 'Departemen wajib diisi'),
  description: z.string().optional().default('')
});

export const CreateLocationSchema = z.object({
  building: z.string().min(1, 'Gedung wajib diisi'),
  floor: z.string().min(1, 'Lantai wajib diisi'),
  department: z.string().min(1, 'Departemen wajib diisi'),
  area: z.string().min(1, 'Area wajib diisi'),
  line: z.string().optional().default('-'),
  positionCode: z.string().optional().default('-'),
  locationName: z.string().min(1, 'Nama lokasi wajib diisi'),
  notes: z.string().optional().default('')
});

export const CreatePICSchema = z.object({
  picName: z.string().min(1, 'Nama PIC wajib diisi'),
  employeeId: z.string().optional().default(''),
  department: z.string().min(1, 'Departemen wajib diisi'),
  role: z.string().min(1, 'Jabatan wajib diisi'),
  userId: z.string().optional().default('')
});

export const CreateUserSchema = z.object({
  userName: z.string().min(1, 'Nama user wajib diisi'),
  loginEmail: z.string().email('Format email tidak valid'),
  roleId: z.nativeEnum(UserRole),
  department: z.string().min(1, 'Departemen wajib diisi'),
  password: z.string().min(12, 'Password minimal 12 karakter').optional()
});
