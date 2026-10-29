import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Send,
  User,
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import {
  EnrichedMachine,
  LogKondisi,
  ConditionType,
  RepairStatus,
  MasterPIC,
  UserRole
} from '@machine-tracking/shared';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast, PageLoader } from '../context/ToastContext';

export const ConditionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedMachineId = searchParams.get('machineId');
  const { hasRole, user } = useAuth();
  const { notify } = useToast();
  const hasShownLoadedToast = useRef(false);

  const [conditionLogs, setConditionLogs] = useState<LogKondisi[]>([]);
  const [machines, setMachines] = useState<EnrichedMachine[]>([]);
  const [pics, setPics] = useState<MasterPIC[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [repairFilter, setRepairFilter] = useState<string>('');

  // Report Form State
  const [showReportForm, setShowReportForm] = useState(!!preselectedMachineId);
  const [reportMachineId, setReportMachineId] = useState(preselectedMachineId || '');
  const [conditionType, setConditionType] = useState<ConditionType>(ConditionType.DAMAGED);
  const [problemDescription, setProblemDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Follow-up modal
  const [selectedLog, setSelectedLog] = useState<LogKondisi | null>(null);
  const [actionTaken, setActionTaken] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [repairStatus, setRepairStatus] = useState<RepairStatus>(RepairStatus.IN_PROGRESS);
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, mRes, pRes] = await Promise.all([
        api.get('/conditions', { params: { repairStatus: repairFilter || undefined } }),
        api.get('/machines', { params: { activeOnly: true } }),
        api.get('/pics')
      ]);
      setConditionLogs(cRes.data.data);
      if (!hasShownLoadedToast.current) {
        notify('success', 'Data berhasil dimuat', 'Data kondisi mesin berhasil diperbarui.');
        hasShownLoadedToast.current = true;
      }
      setMachines(mRes.data.data);
      setPics(pRes.data.data);

      if (!reportMachineId && mRes.data.data.length > 0) {
        setReportMachineId(mRes.data.data[0].Machine_ID);
      }
    } catch (err) {
      console.error('Gagal mengambil log kondisi:', err);
      notify('error', 'Gagal memuat data', 'Periksa koneksi atau coba muat ulang halaman.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [repairFilter]);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportMachineId || !problemDescription.trim()) return;

    setSubmittingReport(true);
    try {
      await api.post('/conditions', {
        machineId: reportMachineId,
        conditionType,
        problemDescription: problemDescription.trim(),
        notes: notes.trim() || undefined
      });
      notify('success', 'Laporan berhasil disimpan', 'Laporan kondisi mesin sudah tercatat.');
      setShowReportForm(false);
      setProblemDescription('');
      setNotes('');
      fetchData();
    } catch (err: any) {
      notify('error', 'Gagal mengirim laporan', err.response?.data?.message || 'Silakan coba lagi.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLog) return;

    setSubmittingUpdate(true);
    try {
      await api.patch(`/conditions/${selectedLog.Condition_Log_ID}`, {
        repairStatus,
        technicianId: technicianId || undefined,
        actionTaken: actionTaken || undefined
      });
      notify('success', 'Tindak lanjut diperbarui', 'Status perbaikan berhasil disimpan.');
      setSelectedLog(null);
      fetchData();
    } catch (err: any) {
      notify('error', 'Gagal memperbarui', err.response?.data?.message || 'Silakan coba lagi.');
    } finally {
      setSubmittingUpdate(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Laporan Kondisi & Pemeliharaan Mesin
          </h1>
          <p className="text-xs text-slate-500">
            Pencatatan kerusakan fisik mesin, perbaikan teknisi mekanik, dan pengujian kelayakan
          </p>
        </div>

        <button
          onClick={() => setShowReportForm(!showReportForm)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{showReportForm ? 'Tutup Formulir' : 'Laporkan Kerusakan'}</span>
        </button>
      </div>

      {/* Formulir Pelaporan Masalah Baru */}
      {showReportForm && (
        <form onSubmit={handleReportSubmit} className="bg-white p-6 rounded-2xl border-2 border-rose-200 shadow-md space-y-4 animate-in fade-in">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h2 className="text-sm font-bold text-slate-900">Form Laporan Kerusakan / Masalah Mesin</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pilih Mesin *</label>
              <select
                value={reportMachineId}
                onChange={(e) => setReportMachineId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500"
              >
                {machines.map(m => (
                  <option key={m.Machine_ID} value={m.Machine_ID}>
                    {m.Machine_ID} — {m.Machine_Name} ({m.Location_Name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Jenis Kondisi Fisik *</label>
              <select
                value={conditionType}
                onChange={(e) => setConditionType(e.target.value as ConditionType)}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 font-semibold"
              >
                <option value={ConditionType.DAMAGED}>RUSAK (DAMAGED) — Otomatis status UNDER_REPAIR</option>
                <option value={ConditionType.NEEDS_INSPECTION}>PERLU PEMERIKSAAN (NEEDS_INSPECTION)</option>
                <option value={ConditionType.NORMAL}>NORMAL (Kondisi baik/selesai)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Deskripsi Masalah / Gejala Kerusakan *
            </label>
            <textarea
              rows={2}
              required
              placeholder="Jelaskan kendala: misal servo motor berasap, benang sering putus, jarum patah, error kode E-07..."
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowReportForm(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submittingReport}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-rose-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submittingReport ? 'Menyimpan...' : 'Kirim Laporan'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Status Perbaikan */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] mr-1">Status:</span>
        {[
          { label: 'Semua Status', value: '' },
          { label: 'Menunggu Tindakan', value: RepairStatus.OPEN },
          { label: 'Sedang Dikerjakan', value: RepairStatus.IN_PROGRESS },
          { label: 'Selesai', value: RepairStatus.COMPLETED }
        ].map((btn) => (
          <button
            key={btn.value}
            onClick={() => setRepairFilter(btn.value)}
            className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
              repairFilter === btn.value
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Maintenance List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <PageLoader message="Memuat data perbaikan..." />
        </div>
      ) : conditionLogs.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 text-xs">
          Tidak ada laporan perbaikan yang sesuai.
        </div>
      ) : (
        <div className="space-y-3">
          {conditionLogs.map((log) => (
            <div
              key={log.Condition_Log_ID}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-300 transition-colors"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {log.Condition_Log_ID}
                  </span>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                    {log.Machine_ID}
                  </span>
                  <StatusBadge condition={log.Condition_Type} />
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold border bg-slate-100 text-slate-700">
                    {log.Repair_Status}
                  </span>
                </div>

                <p className="text-sm font-semibold text-slate-900">
                  {log.Problem_Description}
                </p>

                {log.Action_Taken && (
                  <p className="text-xs text-emerald-800 bg-emerald-50/70 p-2 rounded-xl border border-emerald-100">
                    <strong>Tindakan Perbaikan:</strong> {log.Action_Taken}
                  </p>
                )}

                <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                  <span>Pelapor: {log.Reported_By}</span>
                  <span>Waktu: {new Date(log.Report_DateTime).toLocaleString('id-ID')}</span>
                  {log.Completion_DateTime && (
                    <span className="text-emerald-600 font-semibold">
                      Selesai: {new Date(log.Completion_DateTime).toLocaleString('id-ID')}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button for Mechanic / Admin */}
              {hasRole(UserRole.MECHANIC, UserRole.ADMIN, UserRole.IE) && log.Repair_Status !== RepairStatus.COMPLETED && (
                <button
                  onClick={() => {
                    setSelectedLog(log);
                    setActionTaken(log.Action_Taken || '');
                    setTechnicianId(log.Technician_ID || '');
                    setRepairStatus(RepairStatus.IN_PROGRESS);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm shrink-0"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Update Servis Mekanik</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Update Servis Mekanik */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Update Tindak Lanjut Servis Mesin
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-mono">
              Laporan {selectedLog.Condition_Log_ID} • Mesin {selectedLog.Machine_ID}
            </p>

            <form onSubmit={handleUpdateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Perbaikan *</label>
                <select
                  value={repairStatus}
                  onChange={(e) => setRepairStatus(e.target.value as RepairStatus)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value={RepairStatus.IN_PROGRESS}>Sedang Dikerjakan (IN_PROGRESS)</option>
                  <option value={RepairStatus.COMPLETED}>Selesai Diperbaiki (COMPLETED) — Otomatis Mesin Normal</option>
                  <option value={RepairStatus.OPEN}>Menunggu Tindakan (OPEN)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tindakan Perbaikan / Sparepart Diganti *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ganti needle bar, setel rotary hook, kalibrasi sensor, dll."
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingUpdate}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold shadow-md shadow-blue-600/20"
                >
                  {submittingUpdate ? 'Menyimpan...' : 'Simpan Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
