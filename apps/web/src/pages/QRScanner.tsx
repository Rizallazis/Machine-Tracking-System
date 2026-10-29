import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  QrCode,
  Camera,
  AlertCircle,
  Search,
  ArrowRight,
  CheckCircle2,
  MapPin,
  User,
  ArrowRightLeft,
  Zap,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { EnrichedMachine, MasterPIC } from '@machine-tracking/shared';
import { StatusBadge } from '../components/StatusBadge';

export const QRScanner: React.FC = () => {
  const navigate = useNavigate();
  const [manualToken, setManualToken] = useState('');
  const [scannedMachine, setScannedMachine] = useState<EnrichedMachine | null>(null);
  const [scannedPic, setScannedPic] = useState<MasterPIC | null>(null);
  const [scanType, setScanType] = useState<'machine' | 'pic'>('machine');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [fastMoveMode, setFastMoveMode] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const scannerStartRef = useRef<Promise<unknown> | null>(null);
  const scannerStopRef = useRef<Promise<void> | null>(null);

  // Sound beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {}
  };

  const handleLookup = async (tokenOrId: string) => {
    setError('');
    setLoading(true);
    setScannedMachine(null);
    setScannedPic(null);
    try {
      let clean = tokenOrId.trim();
      try {
        const parsed = JSON.parse(clean);
        if (parsed.token) clean = String(parsed.token);
        else if (parsed.id) clean = String(parsed.id);
      } catch {}

      if (scanType === 'pic') {
        const res = await api.get('/pics');
        const pics: MasterPIC[] = res.data.data || [];
        const pic = pics.find(p =>
          String(p.PIC_ID).trim().toLowerCase() === clean.toLowerCase() ||
          String(p.Employee_ID || '').trim().toLowerCase() === clean.toLowerCase()
        );
        if (!pic) throw new Error('PIC_NOT_FOUND');
        playBeep();
        setScannedPic(pic);
        return;
      }

      let machine: EnrichedMachine | null = null;
      try {
        const res = await api.get(`/qr/${encodeURIComponent(clean)}`);
        machine = res.data.data || null;
      } catch {}
      if (!machine && /^MC-/i.test(clean)) {
        try {
          const res = await api.get(`/machines/${encodeURIComponent(clean)}`);
          machine = res.data.data || null;
        } catch {}
      }
      // Barcode inventaris fisik seperti 028031000820 disimpan di ID_Code.
      if (!machine) {
        const res = await api.get('/machines', { params: { activeOnly: false } });
        const machines: EnrichedMachine[] = res.data.data || [];
        const normalizedClean = clean.trim().toLowerCase();
        const scannedDigits = normalizedClean.replace(/\D/g, '');
        machine = machines.find(m => {
          const idCode = String(m.ID_Code || '').trim().toLowerCase();
          const assetNumber = String(m.Asset_Number || '').trim().toLowerCase();
          const machineId = String(m.Machine_ID || '').trim().toLowerCase();
          const serialNumber = String(m.Serial_Number || '').trim().toLowerCase();
          const qrToken = String(m.QR_Token || '').trim().toLowerCase();
          // Cocokkan teks persis terlebih dahulu agar nol di depan tetap terjaga.
          // Fallback digit-only mengatasi spreadsheet/scanner yang menghilangkan nol awal.
          return idCode === normalizedClean ||
            assetNumber === normalizedClean ||
            machineId === normalizedClean ||
            serialNumber === normalizedClean ||
            qrToken === normalizedClean ||
            (scannedDigits.length > 0 && (
              idCode.replace(/\D/g, '') === scannedDigits ||
              assetNumber.replace(/\D/g, '') === scannedDigits ||
              machineId.replace(/\D/g, '') === scannedDigits ||
              serialNumber.replace(/\D/g, '') === scannedDigits
            ));
        }) || null;
      }
      if (!machine) throw new Error('MACHINE_NOT_FOUND');
      playBeep();
      setScannedMachine(machine);
      if (fastMoveMode) navigate(`/move?machineId=${machine.Machine_ID}`);
    } catch (err: any) {
      setError(err.message === 'PIC_NOT_FOUND'
        ? 'Barcode PIC tidak ditemukan. Pastikan kode pada kartu cocok dengan No. Karyawan atau ID PIC di Master Data.'
        : 'Barcode mesin tidak ditemukan. Pastikan barcode sudah terdaftar pada ID Code di Master Data Mesin.');
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async () => {
    setError('');
    await stopScanner();

    const qrScanner = new Html5Qrcode('qr-reader', {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.UPC_A
      ],
      verbose: false
    });
    qrScannerRef.current = qrScanner;

    try {
      const startPromise = qrScanner.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: { width: 260, height: 220 }
        },
        (decodedText) => {
          stopScanner();
          handleLookup(decodedText);
        },
        () => {}
      );
      scannerStartRef.current = startPromise;
      await startPromise;

      if (qrScannerRef.current === qrScanner) setCameraActive(true);
    } catch (err: any) {
      console.warn('Gagal mengaktifkan kamera:', err);
      setError('Tidak dapat mengakses kamera. Pastikan izin kamera aktif atau gunakan pencarian manual di bawah.');
      setCameraActive(false);
      await stopScanner();
    } finally {
      if (scannerStartRef.current) scannerStartRef.current = null;
    }
  };

  const stopScanner = async () => {
    if (scannerStopRef.current) return scannerStopRef.current;

    const scanner = qrScannerRef.current;
    if (!scanner) return;

    const stopPromise = (async () => {
      try {
        await scannerStartRef.current?.catch(() => undefined);
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch (err) {
        console.error(err);
      } finally {
        if (qrScannerRef.current === scanner) qrScannerRef.current = null;
        scannerStartRef.current = null;
        setCameraActive(false);
        scannerStopRef.current = null;
      }
    })();

    scannerStopRef.current = stopPromise;
    return stopPromise;
  };

  useEffect(() => {
    const timer = setTimeout(() => startScanner(), 0);
    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [scanType]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24 md:pb-8">
      {/* Title & Fast Mode Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Scan Barcode Mesin / PIC
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pilih jenis barcode: inventaris mesin atau kartu identitas PIC/karyawan.
          </p>
        </div>

        {/* Toggle Fast Move Mode */}
        <button
          onClick={() => setFastMoveMode(!fastMoveMode)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
            fastMoveMode
              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${fastMoveMode ? 'fill-white text-white' : 'text-blue-600'}`} />
          <span>Mode Pindah Cepat: {fastMoveMode ? 'AKTIF' : 'NONAKTIF'}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
        <button type="button" onClick={() => { setScanType('machine'); setScannedPic(null); setScannedMachine(null); setError(''); }} className={`py-2.5 rounded-lg text-xs font-bold transition-colors ${scanType === 'machine' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
          <QrCode className="inline w-4 h-4 mr-1.5" /> Barcode Mesin
        </button>
        <button type="button" onClick={() => { setScanType('pic'); setScannedPic(null); setScannedMachine(null); setError(''); setFastMoveMode(false); }} className={`py-2.5 rounded-lg text-xs font-bold transition-colors ${scanType === 'pic' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>
          <User className="inline w-4 h-4 mr-1.5" /> Barcode PIC
        </button>
      </div>

      {fastMoveMode && scanType === 'machine' && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>Mode Pindah Cepat Aktif:</strong> Setelah barcode mesin terdeteksi, Anda akan langsung dialihkan ke form perpindahan.
          </span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Camera Viewfinder */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          id="qr-reader"
          className="w-full rounded-xl overflow-hidden bg-slate-950 min-h-[260px] flex items-center justify-center text-white"
        ></div>

        <div className="flex items-center justify-between mt-3 text-xs">
          <span className="text-slate-500 flex items-center gap-1.5 font-medium">
            <Camera className="w-4 h-4 text-blue-600" />
            Status: {cameraActive ? 'Kamera Aktif' : 'Kamera Nonaktif'}
          </span>
          {!cameraActive ? (
            <button
              onClick={startScanner}
              className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 text-xs shadow-sm"
            >
              Nyalakan Pemindai
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 text-xs"
            >
              Matikan Pemindai
            </button>
          )}
        </div>
      </div>

      {/* Scanned Result */}
      {scannedMachine && (
        <div className="bg-blue-50 border-2 border-blue-400 p-5 rounded-2xl shadow-md space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-blue-600 text-white">
              {scannedMachine.Machine_ID}
            </span>
            <div className="flex gap-1.5">
              <StatusBadge status={scannedMachine.Current_Status} />
              <StatusBadge condition={scannedMachine.Machine_Condition} />
            </div>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">{scannedMachine.Machine_Name}</h3>
            <p className="text-xs text-slate-600">
              {scannedMachine.Brand} • {scannedMachine.Model} ({scannedMachine.Category_Name})
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 pt-2 border-t border-blue-200">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span className="truncate">{scannedMachine.Location_Name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span className="truncate">{scannedMachine.PIC_Name}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={() => navigate(`/machines/${scannedMachine.Machine_ID}`)}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>Lihat Detail Mesin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => navigate(`/move?machineId=${scannedMachine.Machine_ID}`)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Pindahkan Mesin Ini</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual Input Fallback */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Input Manual Barcode {scanType === 'machine' ? 'Mesin / Token' : 'PIC'}
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={scanType === 'machine' ? 'Scan/masukkan kode mesin, contoh 028031000820' : 'Scan/masukkan No. Karyawan atau ID PIC'}
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={() => handleLookup(manualToken)}
            disabled={loading || !manualToken}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
          >
            {loading ? 'Mencari...' : 'Periksa'}
          </button>
        </div>

      </div>

      {scannedPic && (
        <div className="bg-purple-50 border-2 border-purple-300 p-5 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold font-mono px-2 py-1 rounded bg-purple-600 text-white">{scannedPic.PIC_ID}</span>
            <span className="text-[11px] font-semibold text-purple-700 bg-white border border-purple-200 px-2 py-1 rounded-full">PIC ditemukan</span>
          </div>
          <h3 className="text-base font-bold text-slate-900">{scannedPic.PIC_Name}</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 border-t border-purple-200 pt-3">
            <div><span className="text-slate-500 block">No. Karyawan</span><strong>{scannedPic.Employee_ID || '-'}</strong></div>
            <div><span className="text-slate-500 block">Departemen</span><strong>{scannedPic.Department || '-'}</strong></div>
            <div><span className="text-slate-500 block">Jabatan</span><strong>{scannedPic.Role || '-'}</strong></div>
            <div><span className="text-slate-500 block">Status</span><strong>{scannedPic.Active ? 'Aktif' : 'Nonaktif'}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
};
