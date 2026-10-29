import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  CheckCircle,
  Wrench,
  Clock,
  ArrowRightLeft,
  QrCode,
  PlusCircle,
  RefreshCw,
  Building,
  Tag
} from 'lucide-react';
import { api } from '../services/api';
import {
  DashboardSummary,
  DashboardByLocation,
  DashboardByCategory,
  MachineStatus
} from '@machine-tracking/shared';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { useToast, PageLoader } from '../context/ToastContext';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();
  const hasShownLoadedToast = useRef(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [byLocation, setByLocation] = useState<DashboardByLocation[]>([]);
  const [byCategory, setByCategory] = useState<DashboardByCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const overviewRes = await api.get('/dashboard/overview');
      setSummary(overviewRes.data.data.summary);
      if (!hasShownLoadedToast.current) {
        notify('success', 'Dashboard berhasil dimuat', 'Ringkasan data terbaru sudah tersedia.');
        hasShownLoadedToast.current = true;
      }
      setByLocation(overviewRes.data.data.byLocation);
      setByCategory(overviewRes.data.data.byCategory);
    } catch (err) {
      console.error('Gagal mengambil data dashboard:', err);
      notify('error', 'Gagal memuat dashboard', 'Silakan segarkan halaman atau periksa koneksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      {loading && <div className="rounded-2xl border border-slate-200 bg-white"><PageLoader message="Memuat ringkasan dashboard..." /></div>}
      {/* Header & Quick Action Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-blue-900/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-blue-200 font-semibold">
            Pabrik Garment PT ESGI Sambi
          </span>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">
            Selamat Datang, {user?.User_Name}
          </h1>
          <p className="text-sm text-blue-100 mt-1 max-w-xl">
            Sistem pelacakan identitas, posisi aktif, dan riwayat perpindahan mesin berbasis spreadsheet terpadu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Link
            to="/scan"
            className="flex-1 md:flex-none px-4 py-2.5 bg-white text-blue-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-blue-50 transition-colors"
          >
            <QrCode className="w-4 h-4 text-blue-600" />
            <span>Scan QR Mesin</span>
          </Link>
          <Link
            to="/move"
            className="flex-1 md:flex-none px-4 py-2.5 bg-blue-600/60 hover:bg-blue-600 border border-blue-400/40 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Pindah Mesin</span>
          </Link>
          <button
            onClick={fetchDashboardData}
            title="Muat ulang"
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Mesin Aktif</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {loading ? '...' : summary?.activeMachines || 0}
          </p>
          <span className="text-[11px] text-slate-400 font-normal">Dari {summary?.totalMachines || 0} total aset</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Sedang Digunakan</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {loading ? '...' : summary?.statusCounts[MachineStatus.IN_USE] || 0}
          </p>
          <span className="text-[11px] text-emerald-600/80 font-medium">Di line produksi</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tersedia / Standby</span>
            <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-cyan-600 mt-2">
            {loading ? '...' : summary?.statusCounts[MachineStatus.AVAILABLE] || 0}
          </p>
          <span className="text-[11px] text-slate-400 font-normal">Siap dipindahkan</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Dalam Perbaikan</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">
            {loading ? '...' : summary?.statusCounts[MachineStatus.UNDER_REPAIR] || 0}
          </p>
          <span className="text-[11px] text-rose-600 font-medium">Workshop / Servis</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pindah Hari Ini</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-600 mt-2">
            {loading ? '...' : summary?.totalMovementsToday || 0}
          </p>
          <span className="text-[11px] text-slate-400 font-normal">Transaksi log</span>
        </div>
      </div>

      {/* Grid: Rekap Lokasi & Kategori */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rekap Lokasi / Line */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-800">Distribusi Mesin per Lokasi</h2>
            </div>
            <Link to="/machines" className="text-xs font-medium text-blue-600 hover:underline">
              Lihat Semua
            </Link>
          </div>

          <div className="space-y-3">
            {byLocation.slice(0, 6).map((loc) => (
              <div key={loc.locationId} className="flex items-center justify-between text-xs p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                <div>
                  <span className="font-semibold text-slate-800 block">{loc.locationName}</span>
                  <span className="text-[11px] text-slate-400">{loc.building} • {loc.line}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-xs">
                    {loc.count} Unit
                  </span>
                  {loc.underRepairCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 font-medium text-[10px]">
                      {loc.underRepairCount} Servis
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rekap Kategori Mesin */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-800">Rekap Mesin per Kategori (IE)</h2>
            </div>
            <Link to="/machines" className="text-xs font-medium text-blue-600 hover:underline">
              Semua Mesin
            </Link>
          </div>

          <div className="space-y-3">
            {byCategory.map((cat) => (
              <div key={cat.categoryId} className="flex items-center justify-between text-xs p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                <div>
                  <span className="font-semibold text-slate-800 block">{cat.categoryName}</span>
                  <span className="text-[11px] text-slate-400">Dept: {cat.department}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-bold text-xs">
                  {cat.count} Mesin
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Aktivitas Perpindahan Terkini */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">Log Perpindahan Mesin Terkini</h2>
          </div>
          <Link to="/history" className="text-xs font-medium text-blue-600 hover:underline">
            Riwayat Lengkap
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-semibold">ID Transaksi</th>
                <th className="py-2.5 px-3 font-semibold">Mesin</th>
                <th className="py-2.5 px-3 font-semibold">Waktu</th>
                <th className="py-2.5 px-3 font-semibold">Alasan</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary?.recentMovements?.slice(0, 5).map((mov) => (
                <tr key={mov.Movement_ID} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-mono font-semibold text-blue-700">{mov.Movement_ID}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{mov.Machine_ID}</td>
                  <td className="py-2.5 px-3 text-slate-500">{new Date(mov.Movement_DateTime).toLocaleString('id-ID')}</td>
                  <td className="py-2.5 px-3 text-slate-600">{mov.Movement_Reason}</td>
                  <td className="py-2.5 px-3">
                    <StatusBadge movementStatus={mov.Status} />
                  </td>
                </tr>
              ))}
              {(!summary?.recentMovements || summary.recentMovements.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    Belum ada riwayat perpindahan hari ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
