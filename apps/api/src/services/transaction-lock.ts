/**
 * Transaction Lock & Idempotency Manager
 * Provides per-machine mutex lock and request deduplication
 */
export class TransactionLock {
  private static machineLocks = new Map<string, Promise<void>>();
  private static lockResolvers = new Map<string, () => void>();

  /**
   * Acquire a lock for a specific machine ID.
   * If another transaction is in progress for this machine, waits until it completes.
   */
  static async acquire(machineId: string): Promise<() => void> {
    while (this.machineLocks.has(machineId)) {
      await this.machineLocks.get(machineId);
    }

    let releaseLock!: () => void;
    const lockPromise = new Promise<void>(resolve => {
      releaseLock = () => {
        this.machineLocks.delete(machineId);
        this.lockResolvers.delete(machineId);
        resolve();
      };
    });

    this.machineLocks.set(machineId, lockPromise);
    this.lockResolvers.set(machineId, releaseLock);

    return releaseLock;
  }

  /**
   * Check if a machine currently has an active lock
   */
  static isLocked(machineId: string): boolean {
    return this.machineLocks.has(machineId);
  }
}
