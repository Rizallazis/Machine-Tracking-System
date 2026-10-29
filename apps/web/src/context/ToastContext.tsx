import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, LoaderCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';
type ToastItem = { id: number; type: ToastType; title: string; message?: string; duration?: number };
type ToastContextValue = {
  notify: (type: ToastType, title: string, message?: string, duration?: number) => number;
  dismiss: (id: number) => void;
};
const ToastContext = createContext<ToastContextValue | null>(null);

const iconByType = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  loading: LoaderCircle
};
const styleByType = {
  success: 'border-emerald-200 bg-white text-emerald-700',
  error: 'border-rose-200 bg-white text-rose-700',
  info: 'border-blue-200 bg-white text-blue-700',
  loading: 'border-slate-200 bg-white text-slate-700'
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const notify = useCallback((type: ToastType, title: string, message?: string, duration = 3800) => {
    const id = Date.now() + Math.floor(Math.random() * 10000);
    setItems(prev => [...prev, { id, type, title, message, duration }].slice(-4));
    if (type !== 'loading' && duration > 0) {
      window.setTimeout(() => setItems(prev => prev.filter(item => item.id !== id)), duration);
    }
    return id;
  }, []);
  const dismiss = useCallback((id: number) => setItems(prev => prev.filter(item => item.id !== id)), []);
  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {items.map(item => {
          const Icon = iconByType[item.type];
          return (
            <div key={item.id} role={item.type === 'error' ? 'alert' : 'status'} className={`app-toast ${styleByType[item.type]}`}>
              <Icon className={`toast-icon ${item.type === 'loading' ? 'animate-spin' : ''}`} size={21} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-5">{item.title}</p>
                {item.message && <p className="mt-0.5 text-xs text-slate-500 leading-4">{item.message}</p>}
              </div>
              <button type="button" aria-label="Tutup notifikasi" onClick={() => dismiss(item.id)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast harus digunakan di dalam ToastProvider');
  return context;
};

export const PageLoader: React.FC<{ message?: string }> = ({ message = 'Memuat data...' }) => (
  <div className="page-loader" role="status" aria-live="polite">
    <div className="loader-ring"><LoaderCircle size={30} className="animate-spin text-blue-600" /></div>
    <p className="mt-3 text-sm font-semibold text-slate-700">{message}</p>
    <p className="mt-1 text-xs text-slate-400">Mohon tunggu sebentar</p>
  </div>
);
