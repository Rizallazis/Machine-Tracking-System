import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  Download,
  QrCode,
  MapPin,
  User,
  ArrowRight,
  X,
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import {
  EnrichedMachine,
  MasterKategori,
  MasterLokasi,
  MasterPIC,
  MachineStatus,
  MachineCondition,
  UserRole
} from '@machine-tracking/shared';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast, PageLoader } from '../context/ToastContext';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

export const MachineList: React.FC = () => {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const hasShownLoadedToast = useRef(false);
  const [machines, setMachines] = useState<EnrichedMachine[]>([]);
  const [categories, setCategories] = useState<MasterKategori[]>([]);
  const [locations, setLocations] = useState<MasterLokasi[]>([]);
  const [pics, setPics] = useState<MasterPIC[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMachineBarcodeScanner, setShowMachineBarcodeScanner] = useState(false);
  const [newMachine, setNewMachine] = useState({
    machineName: '',
    categoryId: '',
    brand: '',
    model: '',
    serialNumber: '',
    assetNumber: '',
    idCode: '',
    currentLocationId: '',
    currentPicId: '',
    currentStatus: MachineStatus.AVAILABLE,
    machineCondition: MachineCondition.NORMAL,
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, cRes, lRes, pRes] = await Promise.all([
        api.get('/machines', {
          params: {
            search: search || undefined,
            categoryId: selectedCategory || undefined,
            line: selectedLine || undefined,
            status: selectedStatus || undefined,
            condition: selectedCondition || undefined
          }
        }),
        api.get('/categories'),
        api.get('/locations'),
        api.get('/pics')
      ]);

      setMachines(mRes.data.data);
      if (!hasShownLoadedToast.current) {
        notify('success', 'Daftar mesin berhasil dimuat', `${mRes.data.data.length} data mesin tersedia.`);
        hasShownLoadedToast.current = true;
      }
      setCategories(cRes.data.data);
      setLocations(lRes.data.data);
      setPics(pRes.data.data);

      if (!newMachine.categoryId && cRes.data.data.length > 0) {
        setNewMachine(prev => ({
          ...prev,
          categoryId: cRes.data.data[0].Category_ID,
          currentLocationId: lRes.data.data[0]?.Location_ID || '',
          currentPicId: pRes.data.data[0]?.PIC_ID || ''
        }));
      }
    } catch (err) {
      console.error('Gagal mengambil data mesin:', err);
      notify('error', 'Gagal memuat daftar mesin', 'Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCategory, selectedLine, selectedStatus, selectedCondition]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/exports/machines', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-mesin-esgi-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      notify('error', 'Ekspor gagal', 'Gagal mengunduh file CSV.');
    }
  };

  const handleCreateMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/machines', newMachine);
      notify('success', 'Mesin berhasil ditambahkan', 'Data mesin baru sudah tersimpan.');
      setShowAddModal(false);
      setNewMachine({
        machineName: '',
        categoryId: categories[0]?.Category_ID || '',
        brand: '',
        model: '',
        serialNumber: '',
        assetNumber: '',
        idCode: '',
        currentLocationId: locations[0]?.Location_ID || '',
        currentPicId: pics[0]?.PIC_ID || '',
        currentStatus: MachineStatus.AVAILABLE,
        machineCondition: MachineCondition.NORMAL,
        notes: ''
      });
      fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Gagal mendaftarkan mesin');
    } finally {
      setSubmitting(false);
    }
  };

  // Unique line options
  const lineOptions = Array.from(new Set(locations.map(l => l.Line).filter(l => l && l !== '-')));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Master Data Mesin Produksi
          </h1>
          <p className="text-xs text-slate-500">
            Daftar seluruh mesin pabrik garment, lokasi penempatan, dan status operasional
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Ekspor CSV</span>
          </button>

          {hasRole(UserRole.ADMIN, UserRole.IE) && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Registrasi Mesin</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Cari ID Mesin (MC-000001), Nama, Merk (Juki), Model, Serial, atau Asset Number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
          >
            Cari
          </button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Line / Area</label>
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Semua Line</option>
              {lineOptions.map(line => (
                <option key={line} value={line}>{line}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kategori</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Semua Kategori</option>
              {categories.map(cat => (
                <option key={cat.Category_ID} value={cat.Category_ID}>{cat.Category_Name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status Operasional</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Semua Status</option>
              <option value={MachineStatus.IN_USE}>Digunakan (IN_USE)</option>
              <option value={MachineStatus.AVAILABLE}>Tersedia (AVAILABLE)</option>
              <option value={MachineStatus.IDLE}>Menganggur (IDLE)</option>
              <option value={MachineStatus.UNDER_REPAIR}>Dalam Perbaikan</option>
              <option value={MachineStatus.BORROWED}>Dipinjam</option>
              <option value={MachineStatus.RETIRED}>Afkir (RETIRED)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kondisi Fisik</label>
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Semua Kondisi</option>
              <option value={MachineCondition.NORMAL}>Normal</option>
              <option value={MachineCondition.NEEDS_INSPECTION}>Perlu Pemeriksaan</option>
              <option value={MachineCondition.DAMAGED}>Rusak</option>
            </select>
          </div>
        </div>
      </div>

      {/* Machine Cards / Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <PageLoader message="Memuat daftar mesin..." />
        </div>
      ) : machines.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 text-xs">
          Tidak ada mesin yang cocok dengan kriteria pencarian atau filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map((machine) => (
            <Link
              key={machine.Machine_ID}
              to={`/machines/${machine.Machine_ID}`}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {machine.Machine_ID}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={machine.Current_Status} />
                    <StatusBadge condition={machine.Machine_Condition} />
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                  {machine.Machine_Name}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {machine.Brand} • {machine.Model} ({machine.Category_Name})
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{machine.Location_Name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">PIC: {machine.PIC_Name}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2 flex items-center justify-between text-xs text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                <span>Lihat Profil & QR Label</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal Registrasi Mesin Baru */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Registrasi Mesin Baru</h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateMachine} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Mesin *</label>
                <input
                  type="text"
                  required
                  placeholder="contoh: Mesin Jahit 1-Needle High Speed"
                  value={newMachine.machineName}
                  onChange={(e) => setNewMachine({ ...newMachine, machineName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori *</label>
                  <select
                    required
                    value={newMachine.categoryId}
                    onChange={(e) => setNewMachine({ ...newMachine, categoryId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map(c => (
                      <option key={c.Category_ID} value={c.Category_ID}>{c.Category_Name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Merk (Brand) *</label>
                  <input
                    type="text"
                    required
                    placeholder="JUKI, Brother, Yamato"
                    value={newMachine.brand}
                    onChange={(e) => setNewMachine({ ...newMachine, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Model / Tipe *</label>
                  <input
                    type="text"
                    required
                    placeholder="DDL-8700"
                    value={newMachine.model}
                    onChange={(e) => setNewMachine({ ...newMachine, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Seri (Serial No) *</label>
                  <input
                    type="text"
                    required
                    placeholder="SN-12345"
                    value={newMachine.serialNumber}
                    onChange={(e) => setNewMachine({ ...newMachine, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lokasi Awal *</label>
                  <select
                    required
                    value={newMachine.currentLocationId}
                    onChange={(e) => setNewMachine({ ...newMachine, currentLocationId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                  >
                    {locations.map(l => (
                      <option key={l.Location_ID} value={l.Location_ID}>{l.Location_Name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PIC Penanggung Jawab *</label>
                  <select
                    required
                    value={newMachine.currentPicId}
                    onChange={(e) => setNewMachine({ ...newMachine, currentPicId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                  >
                    {pics.map(p => (
                      <option key={p.PIC_ID} value={p.PIC_ID}>{p.PIC_Name} ({p.Role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Barcode Mesin / ID Code (sesuai stiker mesin)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Contoh: 028031000820"
                    value={newMachine.idCode}
                    onChange={(e) => setNewMachine({ ...newMachine, idCode: e.target.value.trim() })}
                    className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMachineBarcodeScanner(true)}
                    className="shrink-0 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-semibold flex items-center gap-1.5 hover:bg-blue-100"
                  >
                    <QrCode className="w-4 h-4" /> Scan
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">Pindai barcode inventaris yang sudah menempel pada mesin. Kode ini disimpan sebagai ID Code, bukan ID Mesin internal.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor Aset Akuntansi (Opsional)</label>
                <input
                  type="text"
                  placeholder="AST-2024-..."
                  value={newMachine.assetNumber}
                  onChange={(e) => setNewMachine({ ...newMachine, assetNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold shadow-md shadow-blue-600/20"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Mesin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <BarcodeScannerModal
        isOpen={showMachineBarcodeScanner}
        onClose={() => setShowMachineBarcodeScanner(false)}
        onScan={(code) => setNewMachine(prev => ({ ...prev, idCode: code }))}
        title="Scan Barcode Mesin"
        description="Arahkan kamera ke barcode inventaris pada badan mesin"
        placeholder="Masukkan kode barcode mesin..."
      />
    </div>
  );
};
