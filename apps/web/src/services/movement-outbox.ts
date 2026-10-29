import { MovementRequest, MovementStatus } from '@machine-tracking/shared';

const databaseName = 'machine-tracking-offline';
const storeName = 'pending-movements';
const queueChangedEvent = 'offline-movement-queue-change';

export interface QueuedMovement {
  requestId: string;
  userId: string;
  payload: MovementRequest;
  queuedAt: string;
  lastError?: string;
}

export const isMovementCompleted = (response: any): boolean =>
  response?.success === true && response?.status === MovementStatus.COMPLETED;

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, 1);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(storeName)) {
      database.createObjectStore(storeName, { keyPath: 'requestId' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
};

const emitQueueChanged = () => window.dispatchEvent(new Event(queueChangedEvent));

export const movementQueueEvents = {
  changed: queueChangedEvent,
  completed: 'offline-movement-sync-completed'
};

export const enqueueMovement = async (entry: QueuedMovement): Promise<void> => {
  await runTransaction('readwrite', store => store.put(entry));
  emitQueueChanged();
};

export const listQueuedMovements = async (userId: string): Promise<QueuedMovement[]> => {
  const records = await runTransaction('readonly', store => store.getAll());
  return (records as QueuedMovement[])
    .filter(record => record.userId === userId)
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
};

export const removeQueuedMovement = async (requestId: string): Promise<void> => {
  await runTransaction('readwrite', store => store.delete(requestId));
  emitQueueChanged();
};

export const updateQueuedMovementError = async (requestId: string, lastError?: string): Promise<void> => {
  const records = await runTransaction('readonly', store => store.get(requestId)) as QueuedMovement | undefined;
  if (!records) return;
  await runTransaction('readwrite', store => store.put({ ...records, lastError }));
  emitQueueChanged();
};
