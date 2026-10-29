import { MovementStatus, AuditAction, AuditResult } from '@machine-tracking/shared';
import { getSheetsRepository } from '../repositories/sheets-client';
import { AuditService } from '../services/audit.service';

export class RecoveryJob {
  /**
   * Run reconciliation for any stranded PENDING transactions
   */
  static async runReconciliation(): Promise<void> {
    const repo = getSheetsRepository();
    try {
      const movements = await repo.getMovements({ status: MovementStatus.PENDING });
      if (movements.length === 0) return;

      console.log(`[Recovery Job] Ditemukan ${movements.length} transaksi berstatus PENDING. Menjalankan rekonsiliasi...`);

      for (const mov of movements) {
        const machine = await repo.getMachineById(mov.Machine_ID);
        if (!machine) continue;

        if (machine.Current_Location_ID === mov.To_Location_ID) {
          // Master machine was actually updated, so mark transaction as COMPLETED
          await repo.updateMovementStatus(mov.Movement_ID, MovementStatus.COMPLETED, 'Dipulihkan otomatis oleh background recovery job');
          console.log(`[Recovery Job] Transaksi ${mov.Movement_ID} dipulihkan menjadi COMPLETED`);

          await AuditService.log({
            userId: 'SYSTEM_RECOVERY',
            action: AuditAction.UPDATE,
            entityType: 'MOVEMENT_RECOVERY',
            entityId: mov.Movement_ID,
            newValue: { Status: MovementStatus.COMPLETED },
            result: AuditResult.SUCCESS
          });
        } else {
          // Master machine was not updated, mark as REJECTED so client can safely retry
          await repo.updateMovementStatus(mov.Movement_ID, MovementStatus.REJECTED, 'Ditolak otomatis oleh recovery job (penulisan master terputus)');
          console.log(`[Recovery Job] Transaksi ${mov.Movement_ID} ditandai REJECTED (inkonsisten)`);

          await AuditService.log({
            userId: 'SYSTEM_RECOVERY',
            action: AuditAction.UPDATE,
            entityType: 'MOVEMENT_RECOVERY',
            entityId: mov.Movement_ID,
            newValue: { Status: MovementStatus.REJECTED },
            result: AuditResult.FAILED
          });
        }
      }
    } catch (err: any) {
      console.error('[Recovery Job Error] Gagal menjalankan rekonsiliasi:', err?.message);
    }
  }

  static startPeriodic(intervalMs = 60000): NodeJS.Timeout {
    return setInterval(() => {
      this.runReconciliation().catch(console.error);
    }, intervalMs);
  }
}
