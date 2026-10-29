import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, QrCode, AlertCircle, RefreshCw, Check } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title: string;
  description?: string;
  placeholder?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title,
  description,
  placeholder = 'Masukkan kode barcode / ID manual...'
}) => {
  const [manualInput, setManualInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'barcode-modal-scanner-viewport';

  // Play a friendly success beep using Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {}
  };

  const stopCamera = async () => {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
        await qrScannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      } finally {
        qrScannerRef.current = null;
        setCameraActive(false);
      }
    }
  };

  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraError('');
    await stopCamera();

    try {
      const scanner = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A
        ],
        verbose: false
      });
      qrScannerRef.current = scanner;

      await scanner.start(
        { facingMode: mode },
        {
          fps: 12,
          qrbox: { width: 260, height: 200 }
        },
        (decodedText) => {
          playBeep();
          stopCamera();
          onScan(decodedText.trim());
          onClose();
        },
        () => {
          // Frame parse failure, continue
        }
      );

      setCameraActive(true);
    } catch (err: any) {
      console.warn('Gagal memulai kamera modal:', err);
      setCameraError('Tidak dapat membuka kamera. Pastikan izin kamera telah diberikan atau gunakan input manual.');
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Small timeout to allow DOM container to render
      const timer = setTimeout(() => {
        startCamera(facingMode);
      }, 150);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isOpen, facingMode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    playBeep();
    stopCamera();
    onScan(manualInput.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="motion-backdrop fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="motion-modal bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-xl">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">{title}</h3>
              <p className="text-[11px] text-slate-400">
                {description || 'Arahkan kamera ke Barcode atau QR Code'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="relative bg-slate-950 min-h-[260px] flex items-center justify-center overflow-hidden">
          <div id={containerId} className="w-full h-full min-h-[260px]"></div>

          {/* Guide Overlay */}
          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-64 h-48 border-2 border-dashed border-blue-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                {/* Laser scan line animation */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-bounce mt-20"></div>
              </div>
              <span className="text-white/80 text-[11px] font-medium mt-3 px-3 py-1 bg-black/60 rounded-full backdrop-blur-sm">
                Sejajarkan barcode / QR di dalam kotak
              </span>
            </div>
          )}

          {cameraError && (
            <div className="p-4 bg-rose-900/90 text-rose-100 text-xs text-center rounded-xl mx-4 flex flex-col items-center gap-2">
              <AlertCircle className="w-6 h-6 text-rose-300" />
              <span>{cameraError}</span>
              <button
                onClick={() => startCamera(facingMode)}
                className="mt-1 px-3 py-1 bg-white text-rose-900 rounded-lg font-semibold text-[11px]"
              >
                Coba Lagi
              </button>
            </div>
          )}
        </div>

        {/* Camera Controls & Manual Input Fallback */}
        <div className="p-4 bg-slate-50 space-y-3 border-t border-slate-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              {cameraActive ? '● Pemindai Aktif' : '○ Kamera Nonaktif'}
            </span>
            <button
              type="button"
              onClick={() => {
                const nextMode = facingMode === 'environment' ? 'user' : 'environment';
                setFacingMode(nextMode);
              }}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ganti Kamera ({facingMode === 'environment' ? 'Belakang' : 'Depan'})</span>
            </button>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder={placeholder}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              Pilih
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
