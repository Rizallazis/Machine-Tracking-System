import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Printer,
  ArrowRightLeft,
  Wrench,
  Trash2,
  MapPin,
  User,
  Calendar,
  Layers,
  ArrowLeft,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { api } from '../services/api';
import {
  EnrichedMachine,
  LogPerpindahan,
  LogKondisi,
  UserRole,
  MachineStatus
} from '@machine-tracking/shared';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast, PageLoader } from '../context/ToastContext';
import { makeCode128DataUrl } from '../utils/code128';

export const MachineDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const hasShownLoadedToast = useRef(false);

  const [machine, setMachine] = useState<EnrichedMachine | null>(null);
  const [qrImage, setQrImage] = useState<string>('');
  const [movements, setMovements] = useState<LogPerpindahan[]>([]);
  const [conditionLogs, setConditionLogs] = useState<LogKondisi[]>([]);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState(false);

  const fetchMachineDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [mRes, movRes, cndRes] = await Promise.all([
        api.get(`/machines/${id}`),
        api.get('/movements', { params: { machineId: id } }),
        api.get('/conditions', { params: { machineId: id } })
      ]);
      const loadedMachine = mRes.data.data as EnrichedMachine;
      setMachine(loadedMachine);
      const inventoryCode = String(loadedMachine.ID_Code || loadedMachine.Machine_ID || '').trim();
      setQrImage(inventoryCode ? makeCode128DataUrl(inventoryCode) : '');
      if (!hasShownLoadedToast.current) {
        notify('success', 'Detail mesin berhasil dimuat', `Data ${mRes.data.data.Machine_ID} sudah tersedia.`);
        hasShownLoadedToast.current = true;
      }
      setMovements(movRes.data.data);
      setConditionLogs(cndRes.data.data);
    } catch (err) {
      console.error('Gagal mengambil data mesin:', err);
      notify('error', 'Gagal memuat detail mesin', 'Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachineDetail();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDeactivate = async () => {
    if (!machine) return;
    if (!window.confirm(`Apakah Anda yakin ingin menonaktifkan / mengafkirkan mesin ${machine.Machine_ID} (${machine.Machine_Name})?`)) {
      return;
    }

    setDeactivating(true);
    try {
      await api.post(`/machines/${machine.Machine_ID}/deactivate`);
      notify('success', 'Mesin dinonaktifkan', 'Status mesin berhasil diperbarui.');
      fetchMachineDetail();
    } catch (err: any) {
      notify('error', 'Gagal menonaktifkan mesin', err.response?.data?.message || 'Silakan coba lagi.');
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4">
        <PageLoader message="Memuat detail mesin..." />
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <p className="text-slate-600 font-semibold mb-4 text-sm">Mesin tidak ditemukan.</p>
        <Link to="/machines" className="text-blue-600 text-xs font-semibold hover:underline">
          &larr; Kembali ke Daftar Mesin
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      {/* Back Button & Title */}
      <div className="flex items-center justify-between">
        <Link
          to="/machines"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to={`/move?machineId=${machine.Machine_ID}`}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Pindahkan Mesin</span>
          </Link>
          <Link
            to={`/conditions?machineId=${machine.Machine_ID}`}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Lapor Masalah</span>
          </Link>
          {hasRole(UserRole.ADMIN, UserRole.IE) && machine.Active && (
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="px-3 py-1.5 border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deactivating ? '...' : 'Afkir'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Machine Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                {machine.Machine_ID}
              </span>
              <StatusBadge status={machine.Current_Status} />
              <StatusBadge condition={machine.Machine_Condition} />
              {!machine.Active && (
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                  Nonaktif / Retired
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {machine.Machine_Name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kategori: <strong className="text-slate-700">{machine.Category_Name}</strong> • Brand: <strong className="text-slate-700">{machine.Brand}</strong> ({machine.Model})
            </p>
          </div>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Label QR Stiker</span>
          </button>
        </div>

        {/* Current Location & PIC Highlight Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Lokasi Aktif Saat Ini
              </span>
              <span className="text-sm font-bold text-slate-900 block mt-0.5">
                {machine.Location_Name}
              </span>
              <span className="text-xs text-slate-500">
                {machine.Location_Building} • Line: {machine.Location_Line || '-'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                PIC Penanggung Jawab
              </span>
              <span className="text-sm font-bold text-slate-900 block mt-0.5">
                {machine.PIC_Name}
              </span>
              <span className="text-xs text-slate-500">
                Jabatan: {machine.PIC_Role || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Specifications Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-2">
          <div>
            <span className="text-slate-400 block font-medium">Nomor Seri</span>
            <span className="font-semibold text-slate-800 block mt-0.5">{machine.Serial_Number || '-'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Nomor Aset</span>
            <span className="font-semibold text-slate-800 block mt-0.5">{machine.Asset_Number || '-'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Tanggal Pengadaan</span>
            <span className="font-semibold text-slate-800 block mt-0.5">{machine.Purchase_Date || '-'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">QR Token Sistem</span>
            <span className="font-mono font-semibold text-blue-700 block mt-0.5 truncate">{machine.QR_Token}</span>
          </div>
        </div>

        {machine.Notes && (
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">Catatan:</span>
            <p className="text-slate-700 mt-0.5">{machine.Notes}</p>
          </div>
        )}
      </div>

      {/* Printable Code 128 Barcode Label Section */}
      <div id="printable-qr-label" className="bg-white p-6 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col sm:flex-row items-center gap-6 justify-between">
        <div className="space-y-1.5 text-center sm:text-left">
          <span className="text-[10px] uppercase font-bold tracking-widest text-blue-600 block">
            PT ESGI SAMBI — ASSET LABEL
          </span>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            {machine.Machine_ID}
          </h3>
          <p className="text-xs font-semibold text-slate-800">
            {machine.Machine_Name}
          </p>
          <div className="text-[11px] text-slate-500 space-y-0.5 font-mono">
            <div>SN: {machine.Serial_Number}</div>
            <div>AST: {machine.Asset_Number || '-'}</div>
            <div>ID CODE: {machine.ID_Code || 'BELUM DIISI'}</div>
          </div>
        </div>

        {qrImage && (
          <div className="flex flex-col items-center">
            <img
              src={qrImage}
              alt={`Barcode Code 128 ${machine.ID_Code || machine.Machine_ID}`}
              className="w-72 h-20 object-contain border border-slate-200 rounded-xl p-1 bg-white shadow-sm"
            />
            <span className="text-[9px] text-slate-400 font-mono mt-1">Barcode Code 128 — scan untuk detail/pindah</span>
          </div>
        )}
      </div>

      {/* History Tabs / Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Log Perpindahan Mesin */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Riwayat Perpindahan Mesin</h2>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{movements.length} Transaksi</span>
          </div>

          <div className="space-y-3">
            {movements.map((mov) => (
              <div key={mov.Movement_ID} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-700">{mov.Movement_ID}</span>
                  <StatusBadge movementStatus={mov.Status} />
                </div>
                <p className="font-medium text-slate-800">{mov.Movement_Reason}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Ke: <strong>{mov.To_Location_ID}</strong> (PIC: {mov.New_PIC_ID})</span>
                  <span>{new Date(mov.Movement_DateTime).toLocaleDateString('id-ID')}</span>
                </div>
              </div>
            ))}
            {movements.length === 0 && (
              <p className="text-center py-6 text-slate-400 text-xs">Belum ada riwayat perpindahan.</p>
            )}
          </div>
        </div>

        {/* Log Kondisi & Servis Mesin */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">Laporan Kerusakan & Servis</h2>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{conditionLogs.length} Laporan</span>
          </div>

          <div className="space-y-3">
            {conditionLogs.map((cnd) => (
              <div key={cnd.Condition_Log_ID} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-700">{cnd.Condition_Log_ID}</span>
                  <StatusBadge condition={cnd.Condition_Type} />
                </div>
                <p className="font-medium text-slate-800">{cnd.Problem_Description}</p>
                {cnd.Action_Taken && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50/60 p-1.5 rounded-lg border border-emerald-100">
                    Tindakan: {cnd.Action_Taken}
                  </p>
                )}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Status: <strong>{cnd.Repair_Status}</strong></span>
                  <span>{new Date(cnd.Report_DateTime).toLocaleDateString('id-ID')}</span>
                </div>
              </div>
            ))}
            {conditionLogs.length === 0 && (
              <p className="text-center py-6 text-slate-400 text-xs">Kondisi mesin normal, tidak ada laporan kerusakan.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
