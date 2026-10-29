import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CloudOff, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import {
  listQueuedMovements,
  movementQueueEvents,
  removeQueuedMovement,
  updateQueuedMovementError,
  QueuedMovement,
  isMovementCompleted
} from '../services/movement-outbox';

export const OfflineMovementSync: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();
  const [queue, setQueue] = useState<QueuedMovement[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!user?.User_ID) {
      setQueue([]);
      return;
    }

    let mounted = true;
    const refreshQueue = async () => {
      try {
        const records = await listQueuedMovements(user.User_ID);
        if (mounted) setQueue(records);
      } catch (error) {
        console.error('Gagal membaca antrean offline:', error);
      }
    };

    const synchronize = async () => {
      if (!navigator.onLine || syncingRef.current) return;
      syncingRef.current = true;
      setSyncing(true);
      let completedCount = 0;

      try {
        const records = await listQueuedMovements(user.User_ID);
        for (const record of records) {
          if (record.lastError) continue;
          try {
            const response = await api.post('/movements', record.payload);
            if (!isMovementCompleted(response.data)) {
              await updateQueuedMovementError(
                record.requestId,
                response.data?.message || 'Server belum mengonfirmasi perpindahan selesai.'
              );
              continue;
            }
            await removeQueuedMovement(record.requestId);
            window.dispatchEvent(new CustomEvent(movementQueueEvents.completed, {
              detail: { requestId: record.requestId, response: response.data }
            }));
            completedCount += 1;
          } catch (error: any) {
            if (error.response) {
              await updateQueuedMovementError(
                record.requestId,
                error.response.data?.message || 'Server menolak perpindahan ini.'
              );
              continue;
            }
            break;
          }
        }
      } finally {
        syncingRef.current = false;
        if (mounted) {
          setSyncing(false);
          await refreshQueue();
        }
        if (completedCount > 0) {
          notify('success', 'Sinkronisasi selesai', `${completedCount} perpindahan berhasil dikirim ke server.`);
        }
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      void synchronize();
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueueChanged = () => {
      void refreshQueue();
      if (navigator.onLine) void synchronize();
    };

    void refreshQueue();
    if (navigator.onLine) void synchronize();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(movementQueueEvents.changed, handleQueueChanged);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(movementQueueEvents.changed, handleQueueChanged);
    };
  }, [user?.User_ID, notify]);

  const retryFailed = async () => {
    await Promise.all(queue.map(record => updateQueuedMovementError(record.requestId, undefined)));
    window.dispatchEvent(new Event(movementQueueEvents.changed));
  };

  if (!queue.length) return null;

  const failedCount = queue.filter(record => record.lastError).length;

  return (
    <aside className="border-b border-amber-200 bg-amber-50/90" aria-live="polite">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2 text-xs text-amber-900 flex-1 min-w-0">
          {isOnline ? <RefreshCw className={`w-4 h-4 shrink-0 ${syncing ? 'animate-spin' : ''}`} /> : <CloudOff className="w-4 h-4 shrink-0" />}
          <span className="font-semibold">
            {syncing ? 'Mengirim perpindahan...' : `${queue.length} perpindahan menunggu sinkronisasi`}
          </span>
          {!isOnline && <span className="text-amber-800">Saat koneksi pulih, data akan dikirim otomatis.</span>}
          {failedCount > 0 && <span className="text-rose-700">{failedCount} perlu ditinjau.</span>}
        </div>

        <div className="flex items-center gap-2">
          {failedCount > 0 && (
            <button type="button" onClick={retryFailed} className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-[11px] font-semibold text-amber-900 hover:bg-amber-100">
              Coba lagi
            </button>
          )}
          {queue.filter(record => record.lastError).map(record => (
            <button
              key={record.requestId}
              type="button"
              title={`Hapus antrean gagal: ${record.lastError}`}
              aria-label={`Hapus antrean gagal perpindahan mesin ${record.payload.machineId}`}
              onClick={() => void removeQueuedMovement(record.requestId)}
              className="p-1 text-amber-800 hover:bg-amber-100 rounded-md"
            >
              {record.lastError ? <AlertCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </div>
      {failedCount > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 text-[11px] text-rose-700">
          {queue.find(record => record.lastError)?.lastError}
        </div>
      )}
    </aside>
  );
};
