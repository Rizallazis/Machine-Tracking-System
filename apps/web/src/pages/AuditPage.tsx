import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, RefreshCw, Clock, User, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { LogAudit, AuditResult } from '@machine-tracking/shared';
import { useToast, PageLoader } from '../context/ToastContext';

export const AuditPage: React.FC = () => {
  const { notify } = useToast();
  const hasShownLoadedToast = useRef(false);
  const [logs, setLogs] = useState<LogAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAudit, setSelectedAudit] = useState<LogAudit | null>(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit', { params: { limit: 100 } });
      setLogs(res.data.data);
      if (!hasShownLoadedToast.current) {
        notify('success', 'Log audit berhasil dimuat', `${res.data.data.length} catatan audit tersedia.`);
        hasShownLoadedToast.current = true;
      }
    } catch (err) {
      console.error('Gagal mengambil log audit:', err);
      notify('error', 'Gagal memuat log audit', 'Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Log Audit & Keamanan Sistem
          </h1>
          <p className="text-xs text-slate-500">
            Jejak rekaman perubahan data master dan transaksi (Sheet 08_LOG_AUDIT)
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          className="p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-3.5">ID Audit</th>
                <th className="py-3 px-3.5">Tindakan</th>
                <th className="py-3 px-3.5">Objek (Entitas)</th>
                <th className="py-3 px-3.5">User ID</th>
                <th className="py-3 px-3.5">Waktu ISO</th>
                <th className="py-3 px-3.5">Hasil</th>
                <th className="py-3 px-3.5 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-2"><PageLoader message="Memuat log audit..." /></td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">Belum ada riwayat audit.</td>
                </tr>
              ) : (
                logs.map((audit) => (
                  <tr key={audit.Audit_ID} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3.5 text-blue-700 font-semibold">{audit.Audit_ID}</td>
                    <td className="py-3 px-3.5">
                      <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800">
                        {audit.Action}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-sans font-medium text-slate-700">
                      {audit.Entity_Type} ({audit.Entity_ID})
                    </td>
                    <td className="py-3 px-3.5 text-slate-600">{audit.User_ID}</td>
                    <td className="py-3 px-3.5 text-slate-400">{new Date(audit.Timestamp).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-3.5">
                      <span className={`inline-flex items-center gap-1 font-bold ${audit.Result === AuditResult.SUCCESS ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {audit.Result === AuditResult.SUCCESS ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        )}
                        {audit.Result}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right font-sans">
                      <button
                        onClick={() => setSelectedAudit(audit)}
                        className="text-blue-600 font-semibold hover:underline"
                      >
                        Inspeksi
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Inspeksi Audit */}
      {selectedAudit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Inspeksi Log Audit {selectedAudit.Audit_ID}
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-mono">
              Pelaku: {selectedAudit.User_ID} • Request ID: {selectedAudit.Request_ID}
            </p>

            <div className="space-y-3 text-xs">
              {selectedAudit.Old_Value && (
                <div>
                  <span className="font-semibold text-slate-600 block mb-1">Nilai Lama (Sebelum):</span>
                  <pre className="p-3 bg-slate-100 rounded-xl overflow-x-auto text-[11px] font-mono text-slate-800">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedAudit.Old_Value), null, 2);
                      } catch {
                        return selectedAudit.Old_Value;
                      }
                    })()}
                  </pre>
                </div>
              )}

              {selectedAudit.New_Value && (
                <div>
                  <span className="font-semibold text-slate-600 block mb-1">Nilai Baru (Sesudah):</span>
                  <pre className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl overflow-x-auto text-[11px] font-mono text-emerald-900">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedAudit.New_Value), null, 2);
                      } catch {
                        return selectedAudit.New_Value;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedAudit(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
