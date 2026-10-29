import React, { useState, useEffect, useRef } from 'react';
import { Download, History, ArrowRightLeft, Search, Filter } from 'lucide-react';
import { api } from '../services/api';
import { LogPerpindahan, MovementStatus } from '@machine-tracking/shared';
import { StatusBadge } from '../components/StatusBadge';
import { useToast, PageLoader } from '../context/ToastContext';

export const HistoryPage: React.FC = () => {
  const { notify } = useToast();
  const hasShownLoadedToast = useRef(false);
  const [movements, setMovements] = useState<LogPerpindahan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/movements', {
        params: {
          status: statusFilter || undefined,
          machineId: machineFilter || undefined
        }
      });
      setMovements(res.data.data);
      if (!hasShownLoadedToast.current) {
        notify('success', 'Riwayat berhasil dimuat', `${res.data.data.length} catatan perpindahan tersedia.`);
        hasShownLoadedToast.current = true;
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat:', err);
      notify('error', 'Gagal memuat riwayat', 'Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [statusFilter]);

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/exports/movements', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `log-perpindahan-mesin-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      notify('error', 'Ekspor gagal', 'Gagal mengunduh file CSV.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Riwayat Perpindahan Mesin
          </h1>
          <p className="text-xs text-slate-500">
            Log audit append-only dari setiap perpindahan mesin di seluruh area pabrik
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Ekspor Log CSV</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Cari ID Mesin (misal: MC-000001)..."
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchHistory()}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Status</option>
            <option value={MovementStatus.COMPLETED}>COMPLETED</option>
            <option value={MovementStatus.PENDING}>PENDING</option>
            <option value={MovementStatus.REJECTED}>REJECTED</option>
          </select>

          <button
            onClick={fetchHistory}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-3.5">ID Transaksi</th>
                <th className="py-3 px-3.5">Mesin</th>
                <th className="py-3 px-3.5">Dari Lokasi</th>
                <th className="py-3 px-3.5">Ke Lokasi</th>
                <th className="py-3 px-3.5">PIC Baru</th>
                <th className="py-3 px-3.5">Alasan</th>
                <th className="py-3 px-3.5">Waktu Server</th>
                <th className="py-3 px-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Memuat riwayat...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Belum ada catatan perpindahan.
                  </td>
                </tr>
              ) : (
                movements.map((mov) => (
                  <tr key={mov.Movement_ID} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3.5 font-mono font-bold text-blue-700">{mov.Movement_ID}</td>
                    <td className="py-3 px-3.5 font-semibold text-slate-900">{mov.Machine_ID}</td>
                    <td className="py-3 px-3.5 text-slate-500">{mov.From_Location_ID}</td>
                    <td className="py-3 px-3.5 font-medium text-slate-800">{mov.To_Location_ID}</td>
                    <td className="py-3 px-3.5 text-slate-700">{mov.New_PIC_ID}</td>
                    <td className="py-3 px-3.5 text-slate-600 max-w-xs truncate">{mov.Movement_Reason}</td>
                    <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(mov.Movement_DateTime).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3.5">
                      <StatusBadge movementStatus={mov.Status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
