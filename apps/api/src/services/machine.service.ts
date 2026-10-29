import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import {
  MasterMesin,
  EnrichedMachine,
  CreateMachineRequest,
  UpdateMachineRequest,
  MachineStatus,
  MachineCondition,
  AuditAction,
  AuditResult
} from '@machine-tracking/shared';
import { getSheetsRepository } from '../repositories/sheets-client';
import { AuditService } from './audit.service';

export class MachineService {
  /**
   * Enrich machines with human-readable Category, Location, and PIC details
   */
  static async enrichMachine(machine: MasterMesin): Promise<EnrichedMachine> {
    const repo = getSheetsRepository();
    const [categories, locations, pics] = await Promise.all([
      repo.getCategories(false),
      repo.getLocations(false),
      repo.getPICs(false)
    ]);

    const cat = categories.find(c => c.Category_ID === machine.Category_ID);
    const loc = locations.find(l => l.Location_ID === machine.Current_Location_ID);
    const pic = pics.find(p => p.PIC_ID === machine.Current_PIC_ID);

    return {
      ...machine,
      Category_Name: cat ? cat.Category_Name : machine.Category_ID,
      Location_Name: loc ? loc.Location_Name : machine.Current_Location_ID,
      Location_Line: loc ? loc.Line : '',
      Location_Building: loc ? loc.Building : '',
      PIC_Name: pic ? pic.PIC_Name : machine.Current_PIC_ID,
      PIC_Role: pic ? pic.Role : ''
    };
  }

  static async getMachines(filter?: {
    activeOnly?: boolean;
    categoryId?: string;
    locationId?: string;
    status?: string;
    condition?: string;
    search?: string;
    line?: string;
  }): Promise<EnrichedMachine[]> {
    const repo = getSheetsRepository();
    let machines = await repo.getMachines(filter);

    const [categories, locations, pics] = await Promise.all([
      repo.getCategories(false),
      repo.getLocations(false),
      repo.getPICs(false)
    ]);

    const catMap = new Map(categories.map(c => [c.Category_ID, c.Category_Name]));
    const locMap = new Map(locations.map(l => [l.Location_ID, l]));
    const picMap = new Map(pics.map(p => [p.PIC_ID, p]));

    let enriched: EnrichedMachine[] = machines.map(m => {
      const loc = locMap.get(m.Current_Location_ID);
      const pic = picMap.get(m.Current_PIC_ID);
      return {
        ...m,
        Category_Name: catMap.get(m.Category_ID) || m.Category_ID,
        Location_Name: loc ? loc.Location_Name : m.Current_Location_ID,
        Location_Line: loc ? loc.Line : '',
        Location_Building: loc ? loc.Building : '',
        PIC_Name: pic ? pic.PIC_Name : m.Current_PIC_ID,
        PIC_Role: pic ? pic.Role : ''
      };
    });

    if (filter?.line) {
      enriched = enriched.filter(m => m.Location_Line?.toLowerCase() === filter.line?.toLowerCase());
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      enriched = enriched.filter(
        m =>
          m.Machine_ID.toLowerCase().includes(q) ||
          m.Machine_Name.toLowerCase().includes(q) ||
          m.Brand.toLowerCase().includes(q) ||
          m.Model.toLowerCase().includes(q) ||
          m.Serial_Number.toLowerCase().includes(q) ||
          (m.Asset_Number && m.Asset_Number.toLowerCase().includes(q)) ||
          (m.ID_Code && m.ID_Code.toLowerCase().includes(q)) ||
          (m.Location_Name && m.Location_Name.toLowerCase().includes(q))
      );
    }

    return enriched;
  }

  static async getMachineById(machineId: string): Promise<EnrichedMachine | null> {
    const repo = getSheetsRepository();
    const machine = await repo.getMachineById(machineId);
    if (!machine) return null;
    return this.enrichMachine(machine);
  }

  static async getMachineByQRToken(qrToken: string): Promise<EnrichedMachine | null> {
    const repo = getSheetsRepository();
    const clean = String(qrToken ?? '').trim();
    // Keep QR_Token support, but also resolve the physical Code 128 label.
    let machine = await repo.getMachineByQRToken(clean);
    if (!machine) {
      const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
      const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '');
      const machines = await repo.getMachines({ activeOnly: false });
      const target = normalize(clean);
      const targetDigits = digits(clean);
      machine = machines.find(m =>
        normalize(m.ID_Code) === target ||
        normalize(m.Machine_ID) === target ||
        normalize(m.Asset_Number) === target ||
        normalize(m.Serial_Number) === target ||
        (targetDigits.length > 0 && (
          digits(m.ID_Code) === targetDigits ||
          digits(m.Machine_ID) === targetDigits ||
          digits(m.Asset_Number) === targetDigits ||
          digits(m.Serial_Number) === targetDigits
        ))
      ) || null;
    }
    if (!machine) return null;
    return this.enrichMachine(machine);
  }

  static async createMachine(req: CreateMachineRequest, userId: string): Promise<EnrichedMachine> {
    const repo = getSheetsRepository();

    // Generate unique Machine_ID (e.g. MC-000001)
    const existingMachines = await repo.getMachines();
    let maxIdNum = 0;
    for (const m of existingMachines) {
      const match = m.Machine_ID.match(/^MC-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxIdNum) maxIdNum = num;
      }
    }
    const machineId = `MC-${String(maxIdNum + 1).padStart(6, '0')}`;
    const qrToken = `QR-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
    const now = new Date().toISOString();

    const newMachine: MasterMesin = {
      Machine_ID: machineId,
      QR_Token: qrToken,
      Machine_Name: req.machineName,
      Category_ID: req.categoryId,
      Brand: req.brand,
      Model: req.model,
      Serial_Number: req.serialNumber,
      Asset_Number: req.assetNumber || '',
      ID_Code: req.idCode || '',
      Purchase_Date: req.purchaseDate || new Date().toISOString().slice(0, 10),
      Current_Location_ID: req.currentLocationId,
      Current_PIC_ID: req.currentPicId,
      Current_Status: req.currentStatus || MachineStatus.AVAILABLE,
      Machine_Condition: req.machineCondition || MachineCondition.NORMAL,
      Created_At: now,
      Created_By: userId,
      Updated_At: now,
      Updated_By: userId,
      Active: true,
      Notes: req.notes || ''
    };

    const saved = await repo.insertMachine(newMachine);

    await AuditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'MACHINE',
      entityId: machineId,
      newValue: saved,
      result: AuditResult.SUCCESS
    });

    return this.enrichMachine(saved);
  }

  static async updateMachine(machineId: string, req: UpdateMachineRequest, userId: string): Promise<EnrichedMachine> {
    const repo = getSheetsRepository();
    const existing = await repo.getMachineById(machineId);
    if (!existing) {
      throw new Error(`Mesin dengan ID ${machineId} tidak ditemukan`);
    }

    const updates: Partial<MasterMesin> = {
      Updated_By: userId
    };

    if (req.machineName !== undefined) updates.Machine_Name = req.machineName;
    if (req.categoryId !== undefined) updates.Category_ID = req.categoryId;
    if (req.brand !== undefined) updates.Brand = req.brand;
    if (req.model !== undefined) updates.Model = req.model;
    if (req.serialNumber !== undefined) updates.Serial_Number = req.serialNumber;
    if (req.assetNumber !== undefined) updates.Asset_Number = req.assetNumber;
    if (req.idCode !== undefined) updates.ID_Code = req.idCode;
    if (req.purchaseDate !== undefined) updates.Purchase_Date = req.purchaseDate;
    if (req.currentStatus !== undefined) updates.Current_Status = req.currentStatus;
    if (req.machineCondition !== undefined) updates.Machine_Condition = req.machineCondition;
    if (req.notes !== undefined) updates.Notes = req.notes;

    const updated = await repo.updateMachine(machineId, updates);
    if (!updated) {
      throw new Error(`Gagal memperbarui mesin ${machineId}`);
    }

    await AuditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'MACHINE',
      entityId: machineId,
      oldValue: existing,
      newValue: updated,
      result: AuditResult.SUCCESS
    });

    return this.enrichMachine(updated);
  }

  static async deactivateMachine(machineId: string, userId: string): Promise<EnrichedMachine> {
    const repo = getSheetsRepository();
    const existing = await repo.getMachineById(machineId);
    if (!existing) {
      throw new Error(`Mesin dengan ID ${machineId} tidak ditemukan`);
    }

    const updated = await repo.updateMachine(machineId, {
      Active: false,
      Current_Status: MachineStatus.RETIRED,
      Updated_By: userId
    });

    if (!updated) {
      throw new Error(`Gagal menonaktifkan mesin ${machineId}`);
    }

    await AuditService.log({
      userId,
      action: AuditAction.DEACTIVATE,
      entityType: 'MACHINE',
      entityId: machineId,
      oldValue: { Active: existing.Active, Current_Status: existing.Current_Status },
      newValue: { Active: false, Current_Status: MachineStatus.RETIRED },
      result: AuditResult.SUCCESS
    });

    return this.enrichMachine(updated);
  }

  /**
   * Generate QR Code Data URL for sticker printing & scanning
   */
  static async generateQRCode(machine: MasterMesin, _frontendUrl = 'http://localhost:5173'): Promise<string> {
    // QR hanya menyimpan kode angka. Utamakan barcode inventaris fisik (ID_Code)
    // dan pertahankan nol di depan; jika belum ada, gunakan digit dari Machine_ID.
    const inventoryCode = String(machine.ID_Code || '').trim();
    const qrData = /^\d+$/.test(inventoryCode)
      ? inventoryCode
      : String(machine.Machine_ID || '').replace(/\D/g, '');

    if (!qrData) {
      throw new Error('QR tidak dapat dibuat: isi ID Code numerik mesin terlebih dahulu.');
    }

    return QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 400
    });
  }
}
