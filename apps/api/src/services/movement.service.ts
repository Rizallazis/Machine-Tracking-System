import {
  MovementRequest,
  MovementResponse,
  MovementStatus,
  MachineStatus,
  LogPerpindahan,
  AuditAction,
  AuditResult
} from '@machine-tracking/shared';
import { getSheetsRepository } from '../repositories/sheets-client';
import { TransactionLock } from './transaction-lock';
import { AuditService } from './audit.service';

export class MovementService {
  /**
   * Executes machine movement using the 7-step safe transaction protocol
   */
  static async moveMachine(request: MovementRequest, userId: string): Promise<MovementResponse> {
    const repo = getSheetsRepository();

    // 1. Idempotency Check: check if request_id has already been processed
    const existingMovement = await repo.getMovementByRequestId(request.requestId);
    if (existingMovement) {
      console.log(`[Idempotency] Request ID ${request.requestId} sudah pernah diproses. Mengembalikan transaksi lama.`);
      return {
        success: existingMovement.Status === MovementStatus.COMPLETED,
        movementId: existingMovement.Movement_ID,
        machineId: existingMovement.Machine_ID,
        currentLocationId: existingMovement.To_Location_ID,
        currentPicId: existingMovement.New_PIC_ID,
        status: existingMovement.Status,
        message: 'Transaksi sudah pernah diproses sebelumnya (idempotent replay)'
      };
    }

    // 2. Acquire per-machine transaction lock (mutex)
    const releaseLock = await TransactionLock.acquire(request.machineId);

    try {
      // 3. Re-read latest machine and validation checks
      const machine = await repo.getMachineById(request.machineId);
      if (!machine) {
        throw new Error(`Mesin dengan ID ${request.machineId} tidak ditemukan`);
      }
      if (!machine.Active) {
        throw new Error(`Mesin ${request.machineId} dalam status nonaktif dan tidak dapat dipindahkan`);
      }
      if (machine.Current_Status === MachineStatus.RETIRED) {
        throw new Error(`Mesin ${request.machineId} sudah berstatus RETIRED (afkir) dan tidak boleh dipindahkan melalui alur normal`);
      }

      // Check destination location
      const destination = await repo.getLocationById(request.toLocationId);
      if (!destination) {
        throw new Error(`Lokasi tujuan ${request.toLocationId} tidak terdaftar`);
      }
      if (!destination.Active) {
        throw new Error(`Lokasi tujuan ${destination.Location_Name} sedang tidak aktif`);
      }

      // Check new PIC
      const newPic = await repo.getPICById(request.newPicId);
      if (!newPic) {
        throw new Error(`PIC ${request.newPicId} tidak terdaftar`);
      }
      if (!newPic.Active) {
        throw new Error(`PIC ${newPic.PIC_Name} sedang tidak aktif`);
      }

      const movementId = `MOV-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
      const now = new Date().toISOString();

      // 4. Record transaction as PENDING in 05_LOG_PERPINDAHAN
      const pendingMovement: LogPerpindahan = {
        Movement_ID: movementId,
        Machine_ID: machine.Machine_ID,
        From_Location_ID: machine.Current_Location_ID,
        To_Location_ID: request.toLocationId,
        Old_PIC_ID: machine.Current_PIC_ID,
        New_PIC_ID: request.newPicId,
        Movement_DateTime: now,
        Movement_Reason: request.reason,
        Requested_By: userId,
        Approved_By: '', // Sesuai spesifikasi: kosong pada versi awal
        Status: MovementStatus.PENDING,
        Notes: request.notes || '',
        Request_ID: request.requestId
      };

      await repo.insertMovement(pendingMovement);

      // 5. Update master machine active location & PIC in 01_MASTER_MESIN
      const oldMachineState = {
        Current_Location_ID: machine.Current_Location_ID,
        Current_PIC_ID: machine.Current_PIC_ID
      };

      const updatedMachine = await repo.updateMachine(machine.Machine_ID, {
        Current_Location_ID: request.toLocationId,
        Current_PIC_ID: request.newPicId,
        Updated_By: userId
      });

      // 6. Verify written result
      if (!updatedMachine || updatedMachine.Current_Location_ID !== request.toLocationId) {
        // Mark as needing recovery / rejected
        await repo.updateMovementStatus(movementId, MovementStatus.REJECTED, 'Gagal verifikasi penulisan ke master sheet');
        throw new Error('Gagal memverifikasi pembaruan lokasi pada spreadsheet master');
      }

      // 7. Mark transaction COMPLETED and log audit
      await repo.updateMovementStatus(movementId, MovementStatus.COMPLETED);

      await AuditService.log({
        userId,
        action: AuditAction.MOVEMENT,
        entityType: 'MACHINE',
        entityId: machine.Machine_ID,
        oldValue: oldMachineState,
        newValue: {
          Current_Location_ID: request.toLocationId,
          Current_PIC_ID: request.newPicId,
          Movement_ID: movementId
        },
        requestId: request.requestId,
        result: AuditResult.SUCCESS
      });

      return {
        success: true,
        movementId,
        machineId: machine.Machine_ID,
        currentLocationId: request.toLocationId,
        currentPicId: request.newPicId,
        status: MovementStatus.COMPLETED,
        message: 'Perpindahan mesin berhasil diselesaikan'
      };
    } catch (err: any) {
      console.error(`[Movement Error] Gagal memindahkan mesin ${request.machineId}:`, err?.message);
      throw err;
    } finally {
      // Release machine lock
      releaseLock();
    }
  }

  static async getMovements(filter?: { machineId?: string; fromDate?: string; toDate?: string; status?: string }): Promise<LogPerpindahan[]> {
    const repo = getSheetsRepository();
    return repo.getMovements(filter);
  }

  static async getMovementById(id: string): Promise<LogPerpindahan | null> {
    const repo = getSheetsRepository();
    return repo.getMovementById(id);
  }

  static async getMovementsByMachineId(machineId: string): Promise<LogPerpindahan[]> {
    const repo = getSheetsRepository();
    return repo.getMovements({ machineId });
  }
}
