import {
  LogKondisi,
  ConditionReportRequest,
  UpdateConditionRequest,
  RepairStatus,
  ConditionType,
  MachineStatus,
  MachineCondition,
  AuditAction,
  AuditResult
} from '@machine-tracking/shared';
import { getSheetsRepository } from '../repositories/sheets-client';
import { AuditService } from './audit.service';

export class ConditionService {
  static async reportCondition(req: ConditionReportRequest, userId: string): Promise<LogKondisi> {
    const repo = getSheetsRepository();
    const machine = await repo.getMachineById(req.machineId);
    if (!machine) {
      throw new Error(`Mesin dengan ID ${req.machineId} tidak ditemukan`);
    }

    const logId = `CND-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const now = new Date().toISOString();

    const conditionLog: LogKondisi = {
      Condition_Log_ID: logId,
      Machine_ID: req.machineId,
      Report_DateTime: now,
      Condition_Type: req.conditionType,
      Problem_Description: req.problemDescription,
      Reported_By: userId,
      Technician_ID: req.technicianId || '',
      Action_Taken: req.actionTaken || '',
      Repair_Status: req.repairStatus || (req.conditionType === ConditionType.NORMAL ? RepairStatus.COMPLETED : RepairStatus.OPEN),
      Completion_DateTime: req.repairStatus === RepairStatus.COMPLETED ? now : '',
      Notes: req.notes || ''
    };

    const saved = await repo.insertConditionLog(conditionLog);

    // Update physical condition on 01_MASTER_MESIN
    let newStatus = machine.Current_Status;
    let newCondition: MachineCondition = MachineCondition.NORMAL;

    if (req.conditionType === ConditionType.DAMAGED) {
      newCondition = MachineCondition.DAMAGED;
      newStatus = MachineStatus.UNDER_REPAIR;
    } else if (req.conditionType === ConditionType.NEEDS_INSPECTION) {
      newCondition = MachineCondition.NEEDS_INSPECTION;
    } else {
      newCondition = MachineCondition.NORMAL;
      if (machine.Current_Status === MachineStatus.UNDER_REPAIR) {
        newStatus = MachineStatus.AVAILABLE;
      }
    }

    await repo.updateMachine(req.machineId, {
      Machine_Condition: newCondition,
      Current_Status: newStatus,
      Updated_By: userId
    });

    await AuditService.log({
      userId,
      action: AuditAction.CONDITION_REPORT,
      entityType: 'CONDITION_LOG',
      entityId: logId,
      newValue: saved,
      result: AuditResult.SUCCESS
    });

    return saved;
  }

  static async updateCondition(logId: string, req: UpdateConditionRequest, userId: string): Promise<LogKondisi> {
    const repo = getSheetsRepository();
    const existing = await repo.getConditionLogById(logId);
    if (!existing) {
      throw new Error(`Laporan kondisi ${logId} tidak ditemukan`);
    }

    const updates: Partial<LogKondisi> = {
      Repair_Status: req.repairStatus
    };
    if (req.technicianId !== undefined) updates.Technician_ID = req.technicianId;
    if (req.actionTaken !== undefined) updates.Action_Taken = req.actionTaken;
    if (req.notes !== undefined) updates.Notes = req.notes;

    if (req.repairStatus === RepairStatus.COMPLETED) {
      updates.Completion_DateTime = new Date().toISOString();
      // Restore machine status and condition to NORMAL / AVAILABLE
      await repo.updateMachine(existing.Machine_ID, {
        Machine_Condition: MachineCondition.NORMAL,
        Current_Status: MachineStatus.AVAILABLE,
        Updated_By: userId
      });
    }

    const updated = await repo.updateConditionLog(logId, updates);
    if (!updated) {
      throw new Error(`Gagal memperbarui laporan kondisi ${logId}`);
    }

    await AuditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'CONDITION_LOG',
      entityId: logId,
      oldValue: existing,
      newValue: updated,
      result: AuditResult.SUCCESS
    });

    return updated;
  }

  static async getConditionLogs(filter?: { machineId?: string; repairStatus?: string }): Promise<LogKondisi[]> {
    const repo = getSheetsRepository();
    return repo.getConditionLogs(filter);
  }

  static async getConditionLogById(logId: string): Promise<LogKondisi | null> {
    const repo = getSheetsRepository();
    return repo.getConditionLogById(logId);
  }
}
