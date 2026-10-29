import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
  ArrowRightLeft,
  MapPin,
  User,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Camera,
  QrCode,
  Zap,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import {
  EnrichedMachine,
  MasterLokasi,
  MasterPIC,
  MovementResponse,
  MachineStatus,
  MovementStatus
} from '@machine-tracking/shared';
import { StatusBadge } from '../components/StatusBadge';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { useToast, PageLoader } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { enqueueMovement, movementQueueEvents } from '../services/movement-outbox';

export const MovementForm: React.FC = () => {
  const { notify } = useToast();
  const { user } = useAuth();
  const hasShownLoadedToast = useRef(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedMachineId = searchParams.get('machineId');

  const [machines, setMachines] = useState<EnrichedMachine[]>([]);
  const [locations, setLocations] = useState<MasterLokasi[]>([]);
  const [pics, setPics] = useState<MasterPIC[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState(preselectedMachineId || '');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedPicId, setSelectedPicId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState<MovementResponse | null>(null);
  const queuedRequestIdRef = useRef('');
  const syncedRequestIdsRef = useRef(new Set<string>());

  // Barcode Scanner Modal State
  const [scannerTarget, setScannerTarget] = useState<'machine' | 'location' | 'pic' | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ field: string; message: string } | null>(null);

  useEffect(() => {
    const fetchFormData = async () => {
      setLoadingData(true);
      try {
        const [mRes, lRes, pRes] = await Promise.all([
          api.get('/machines', { params: { activeOnly: true } }),
          api.get('/locations'),
          api.get('/pics')
        ]);

        const activeMachines = mRes.data.data.filter((m: EnrichedMachine) => m.Current_Status !== MachineStatus.RETIRED);
        setMachines(activeMachines);
        setLocations(lRes.data.data);
        setPics(pRes.data.data);
        if (!hasShownLoadedToast.current) {
          notify('success', 'Formulir berhasil dimuat', 'Data mesin, lokasi, dan PIC siap digunakan.');
          hasShownLoadedToast.current = true;
        }

        if (preselectedMachineId) {
          setSelectedMachineId(preselectedMachineId);
        } else if (activeMachines.length > 0) {
          setSelectedMachineId(activeMachines[0].Machine_ID);
        }

        if (lRes.data.data.length > 0) {
          setSelectedLocationId(lRes.data.data[0].Location_ID);
        }
        if (pRes.data.data.length > 0) {
          setSelectedPicId(pRes.data.data[0].PIC_ID);
        }
      } catch (err) {
        console.error('Gagal mengambil data form perpindahan:', err);
        notify('error', 'Gagal memuat formulir', 'Data mesin, lokasi, atau PIC tidak berhasil diambil.');
      } finally {
        setLoadingData(false);
      }
    };

    fetchFormData();
  }, [preselectedMachineId]);

  useEffect(() => {
    const handleMovementSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ requestId: string; response: MovementResponse }>).detail;
      if (detail.requestId !== queuedRequestIdRef.current) return;
      syncedRequestIdsRef.current.add(detail.requestId);
      setSuccessResult(detail.response);
      queuedRequestIdRef.current = '';
    };
    window.addEventListener(movementQueueEvents.completed, handleMovementSynced);
    return () => window.removeEventListener(movementQueueEvents.completed, handleMovementSynced);
  }, []);

  const selectedMachine = machines.find(m => m.Machine_ID === selectedMachineId);

  // Set default PIC when machine is changed
  useEffect(() => {
    if (selectedMachine && !selectedPicId) {
      setSelectedPicId(selectedMachine.Current_PIC_ID);
    }
  }, [selectedMachine]);

  // Handler for Scanned Codes
  const handleBarcodeScanned = (scannedText: string) => {
    let clean = scannedText.trim();

    // Check if JSON payload from QR
    try {
      const parsed = JSON.parse(clean);
      if (parsed.id) clean = parsed.id;
      else if (parsed.token) clean = parsed.token;
    } catch {}

    if (scannerTarget === 'machine') {
      // Find machine by ID or QR Token
      const found = machines.find(
        m => m.Machine_ID.toLowerCase() === clean.toLowerCase() ||
             m.QR_Token.toLowerCase() === clean.toLowerCase() ||
             String(m.ID_Code || '').trim().toLowerCase() === clean.toLowerCase() ||
             String(m.Asset_Number || '').trim().toLowerCase() === clean.toLowerCase() ||
             m.Serial_Number?.toLowerCase() === clean.toLowerCase() ||
             (clean.replace(/\D/g, '').length > 0 && (
               String(m.ID_Code || '').replace(/\D/g, '') === clean.replace(/\D/g, '') ||
               String(m.Machine_ID || '').replace(/\D/g, '') === clean.replace(/\D/g, '')
             ))
      );

      if (found) {
        setSelectedMachineId(found.Machine_ID);
        setScanFeedback({
          field: 'machine',
          message: `Berhasil Scan Mesin: ${found.Machine_ID} — ${found.Machine_Name}`
        });
        setError('');
      } else {
        setError(`Mesin dengan barcode/token "${clean}" tidak ditemukan.`);
      }
    } else if (scannerTarget === 'location') {
      // Find location by Location_ID, Location_Name, or Line
      const found = locations.find(
        l => l.Location_ID.toLowerCase() === clean.toLowerCase() ||
             l.Location_Name.toLowerCase().includes(clean.toLowerCase()) ||
             l.Position_Code?.toLowerCase() === clean.toLowerCase()
      );

      if (found) {
        setSelectedLocationId(found.Location_ID);
        setScanFeedback({
          field: 'location',
          message: `Berhasil Scan Lokasi: ${found.Location_Name}`
        });
        setError('');
      } else {
        setError(`Lokasi dengan barcode "${clean}" tidak ditemukan.`);
      }
    } else if (scannerTarget === 'pic') {
      // Find PIC by PIC_ID, Employee_ID, or Name
      const found = pics.find(
        p => p.PIC_ID.toLowerCase() === clean.toLowerCase() ||
             p.Employee_ID.toLowerCase() === clean.toLowerCase() ||
             p.PIC_Name.toLowerCase().includes(clean.toLowerCase())
      );

      if (found) {
        setSelectedPicId(found.PIC_ID);
        setScanFeedback({
          field: 'pic',
          message: `Berhasil Scan Badge PIC: ${found.PIC_Name} (${found.Role})`
        });
        setError('');
      } else {
        setError(`PIC / Karyawan dengan badge "${clean}" tidak ditemukan.`);
      }
    }

    setScannerTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId) {
      setError('Pilih atau scan barcode mesin yang akan dipindahkan');
      return;
    }
    if (!selectedLocationId) {
      setError('Pilih atau scan lokasi tujuan baru');
      return;
    }
    if (!selectedPicId) {
      setError('Pilih PIC penanggung jawab baru');
      return;
    }
    if (!reason || reason.trim().length < 3) {
      setError('Alasan perpindahan minimal 3 karakter');
      return;
    }

    setError('');
    setSubmitting(true);
    const requestId = `req-${uuidv4()}`;
    const payload = {
      machineId: selectedMachineId,
      toLocationId: selectedLocationId,
      newPicId: selectedPicId,
      reason: reason.trim(),
      requestId,
      notes: notes.trim() || undefined
    };

    try {
      const res = await api.post('/movements', payload);

      setSuccessResult(res.data);
      notify('success', 'Perpindahan berhasil diproses', 'Data perpindahan mesin berhasil disimpan.');
    } catch (err: any) {
      if (!err.response && user?.User_ID) {
        try {
          queuedRequestIdRef.current = requestId;
          await enqueueMovement({
            requestId,
            userId: user.User_ID,
            payload,
            queuedAt: new Date().toISOString()
          });
          if (!syncedRequestIdsRef.current.has(requestId)) {
            setSuccessResult({
              success: true,
              movementId: `LOCAL-${requestId.slice(-8)}`,
              machineId: selectedMachineId,
              currentLocationId: selectedLocationId,
              currentPicId: selectedPicId,
              status: MovementStatus.PENDING,
              message: 'Disimpan pada perangkat dan menunggu sinkronisasi'
            });
          }
          notify('info', 'Disimpan di perangkat', 'Perpindahan akan dikirim saat koneksi tersedia.');
          return;
        } catch (queueError) {
          queuedRequestIdRef.current = '';
          console.error('Gagal menyimpan perpindahan ke antrean lokal:', queueError);
        }
      }
      const message = err.response?.data?.message || 'Gagal memproses perpindahan mesin.';
      setError(message);
      notify('error', 'Perpindahan gagal', message);
    } finally {
      setSubmitting(false);
    }
  };

  const destinationLocation = locations.find(l => l.Location_ID === selectedLocationId);
  const newPic = pics.find(p => p.PIC_ID === selectedPicId);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Perpindahan Mesin via Barcode
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Scan barcode mesin dan barcode lokasi tujuan langsung menggunakan kamera HP
          </p>
        </div>

        {/* Quick Fast Move Guide */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
          <span>Mode Cepat Aktif</span>
        </div>
      </div>

      {loadingData && (
        <div className="rounded-2xl border border-blue-100 bg-white">
          <PageLoader message="Memuat data mesin, lokasi, dan PIC..." />
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {scanFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-2xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{scanFeedback.message}</span>
          </div>
          <button
            onClick={() => setScanFeedback(null)}
            className="text-xs text-emerald-600 font-bold hover:underline ml-2"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Success Modal / Card */}
      {successResult && (
        <div className={`${successResult.status === MovementStatus.PENDING ? 'bg-amber-50 border-amber-400' : 'bg-emerald-50 border-emerald-400'} border-2 p-6 rounded-2xl shadow-lg space-y-4 animate-in fade-in`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 ${successResult.status === MovementStatus.PENDING ? 'bg-amber-600' : 'bg-emerald-600'} text-white rounded-xl`}>
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {successResult.status === MovementStatus.PENDING ? 'Menunggu Sinkronisasi' : 'Perpindahan Sukses Terverifikasi!'}
              </h3>
              <p className={`text-xs ${successResult.status === MovementStatus.PENDING ? 'text-amber-800' : 'text-emerald-800'}`}>
                {successResult.status === MovementStatus.PENDING
                  ? 'Perpindahan tersimpan di perangkat dan belum mengubah data server.'
                  : 'Lokasi aktif pada Master Spreadsheet dan log perpindahan telah diperbarui.'}
              </p>
            </div>
          </div>

          <div className="p-4 bg-white/80 rounded-xl border border-emerald-200 text-xs space-y-2 font-mono">
            <div>ID Transaksi: <strong>{successResult.movementId}</strong></div>
            <div>ID Mesin: <strong>{successResult.machineId}</strong></div>
            <div>Lokasi Baru: <strong>{destinationLocation?.Location_Name || successResult.currentLocationId}</strong></div>
            <div>PIC Baru: <strong>{newPic?.PIC_Name || successResult.currentPicId}</strong></div>
            <div>Status: <span className={`${successResult.status === MovementStatus.PENDING ? 'text-amber-700' : 'text-emerald-700'} font-bold`}>{successResult.status}</span></div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => navigate(`/machines/${successResult.machineId}`)}
              className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>Lihat Detail Mesin</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setSuccessResult(null);
                setReason('');
                setNotes('');
                setScanFeedback(null);
              }}
              className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50"
            >
              Pindah Mesin Lain
            </button>
          </div>
        </div>
      )}

      {!successResult && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          {/* 1. MACHINE SELECTION WITH CAMERA BARCODE SCANNER */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Mesin yang Dipindahkan *
              </label>
              <button
                type="button"
                onClick={() => setScannerTarget('machine')}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-blue-600" />
                <span>Scan Barcode Mesin</span>
              </button>
            </div>

            <div className="flex gap-2">
              <select
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {machines.map((m) => (
                  <option key={m.Machine_ID} value={m.Machine_ID}>
                    {m.Machine_ID} — {m.Machine_Name} ({m.Brand} {m.Model})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Current Location & PIC (Read-only Verification Card) */}
          {selectedMachine && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Posisi Aktual Saat Ini (Master Sheet):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate"><strong>Lokasi:</strong> {selectedMachine.Location_Name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate"><strong>PIC:</strong> {selectedMachine.PIC_Name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Status Operasional:</span>
                <StatusBadge status={selectedMachine.Current_Status} />
                <StatusBadge condition={selectedMachine.Machine_Condition} />
              </div>
            </div>
          )}

          {/* 2. DESTINATION LOCATION WITH CAMERA BARCODE SCANNER */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Lokasi Tujuan Baru *
              </label>
              <button
                type="button"
                onClick={() => setScannerTarget('location')}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                <span>Scan Barcode Lokasi</span>
              </button>
            </div>

            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {locations.map((loc) => (
                <option key={loc.Location_ID} value={loc.Location_ID}>
                  {loc.Location_Name} ({loc.Building} • {loc.Line})
                </option>
              ))}
            </select>
          </div>

          {/* 3. NEW PIC WITH CAMERA BADGE SCANNER */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                3. PIC Penanggung Jawab Baru *
              </label>
              <button
                type="button"
                onClick={() => setScannerTarget('pic')}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-purple-600" />
                <span>Scan ID Badge PIC</span>
              </button>
            </div>

            <select
              value={selectedPicId}
              onChange={(e) => setSelectedPicId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {pics.map((p) => (
                <option key={p.PIC_ID} value={p.PIC_ID}>
                  {p.PIC_Name} — {p.Role} ({p.Department})
                </option>
              ))}
            </select>
          </div>

          {/* 4. REASON WITH QUICK PRESETS */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              4. Alasan Perpindahan *
            </label>
            <input
              type="text"
              required
              placeholder="Ketik atau pilih alasan cepat di bawah..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />

            {/* Quick Presets */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                'Setup Produksi PO Baru',
                'Penataan Line Jahit',
                'Pindah ke Bengkel Servis',
                'Pindah ke Gudang Standby',
                'Pinjam Mesin Antar Line',
                'Kalibrasi & Perawatan'
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg text-[11px] font-medium border border-slate-200 transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Catatan Tambahan (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Kondisi meja, nomor posisi baru, perlengkapan yang disertakan..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Proteksi Idempotensi Aktif</span>
            </div>

            <button
              type="submit"
              disabled={submitting || loadingData}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-md shadow-blue-600/20 flex items-center gap-2 transition-colors"
            >
              <ArrowRightLeft className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
              <span>{submitting ? 'Memproses Transaksi...' : 'Konfirmasi Perpindahan'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Barcode Scanner Modal Instance */}
      <BarcodeScannerModal
        isOpen={scannerTarget !== null}
        onClose={() => setScannerTarget(null)}
        onScan={handleBarcodeScanned}
        title={
          scannerTarget === 'machine'
            ? 'Scan Barcode / QR Mesin'
            : scannerTarget === 'location'
            ? 'Scan Barcode Lokasi Tujuan'
            : 'Scan ID Badge PIC'
        }
        description={
          scannerTarget === 'machine'
            ? 'Arahkan kamera ke stiker QR/Barcode pada fisik mesin'
            : scannerTarget === 'location'
            ? 'Arahkan kamera ke stiker Barcode/QR penanda Lokasi/Line'
            : 'Arahkan kamera ke ID Card / Badge barcode PIC baru'
        }
        placeholder={
          scannerTarget === 'machine'
            ? 'Masukkan MC-000001 atau token QR...'
            : scannerTarget === 'location'
            ? 'Masukkan LOC-0001 atau nama line...'
            : 'Masukkan PIC-0001 atau nomor karyawan...'
        }
      />
    </div>
  );
};
