import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Building,
  Tag,
  Users,
  Shield,
  Plus,
  X,
  CheckCircle2,
  Printer,
  QrCode
} from 'lucide-react';

import { api } from '../services/api';
import {
  MasterKategori,
  MasterLokasi,
  MasterPIC,
  MasterUser,
  UserRole,
  UserRoleLabel
} from '@machine-tracking/shared';
import { useAuth } from '../context/AuthContext';
import { useToast, PageLoader } from '../context/ToastContext';

export const MasterDataPage: React.FC = () => {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const hasShownLoadedToast = useRef(false);
  const [activeTab, setActiveTab] = useState<'categories' | 'locations' | 'pics' | 'users'>('locations');

  const [categories, setCategories] = useState<MasterKategori[]>([]);
  const [locations, setLocations] = useState<MasterLokasi[]>([]);
  const [pics, setPics] = useState<MasterPIC[]>([]);
  const [users, setUsers] = useState<MasterUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [printBarcodeData, setPrintBarcodeData] = useState<{ title: string; subtitle: string; code: string; barcodeDataUrl: string } | null>(null);

  // Generate barcode Code 128-B locally, so the printed label matches the
  // horizontal inventory barcode used on the physical machines and employee cards.
  const makeCode128DataUrl = (value: string) => {
    const patterns = [
      '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212',
      '112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131',
      '311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321',
      '112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121',
      '313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
      '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114',
      '122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212',
      '124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113',
      '114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'
    ];
    const chars = Array.from(value).map((char) => char.charCodeAt(0));
    if (chars.some((code) => code < 32 || code > 126)) throw new Error('Code 128-B hanya mendukung karakter ASCII yang dapat dicetak.');
    const values = [104, ...chars.map((code) => code - 32)];
    const checksum = values.reduce((sum, code, index) => sum + code * (index || 1), 0) % 103;
    const encoded = [...values, checksum, 106].map((code) => patterns[code]);
    let x = 10;
    let bars = '';
    encoded.forEach((pattern) => {
      let isBar = true;
      for (const digit of pattern) {
        const width = Number(digit) * 2;
        if (isBar) bars += `<rect x="${x}" y="4" width="${width}" height="76" fill="#111827"/>`;
        x += width;
        isBar = !isBar;
      }
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${x + 10}" height="96" viewBox="0 0 ${x + 10} 96"><rect width="100%" height="100%" fill="white"/>${bars}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const handlePrintBarcode = (title: string, subtitle: string, code: string) => {
    try {
      const url = makeCode128DataUrl(code);
      setPrintBarcodeData({ title, subtitle, code, barcodeDataUrl: url });
    } catch (err) {
      console.error('Gagal membuat barcode Code 128:', err);
      notify('error', 'Barcode gagal dibuat', 'Pastikan kode berisi karakter ASCII yang dapat dicetak.');
    }
  };

  // Forms
  const [catForm, setCatForm] = useState({ categoryName: '', department: 'Sewing', description: '' });
  const [locForm, setLocForm] = useState({
    building: 'Gedung Produksi A',
    floor: 'Lantai 1',
    department: 'Sewing',
    area: 'Produksi',
    line: 'Line 01',
    positionCode: '-',
    locationName: '',
    notes: ''
  });
  const [picForm, setPicForm] = useState({ picName: '', employeeId: '', department: 'Sewing', role: 'Operator' });
  const [userForm, setUserForm] = useState({ userName: '', loginEmail: '', roleId: UserRole.PIC, department: 'Sewing', password: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, lRes, pRes] = await Promise.all([
        api.get('/categories', { params: { activeOnly: false } }),
        api.get('/locations', { params: { activeOnly: false } }),
        api.get('/pics', { params: { activeOnly: false } })
      ]);
      setCategories(cRes.data.data);
      if (!hasShownLoadedToast.current) {
        notify('success', 'Data master berhasil dimuat', 'Kategori, lokasi, dan PIC berhasil diambil.');
        hasShownLoadedToast.current = true;
      }
      setLocations(lRes.data.data);
      setPics(pRes.data.data);

      if (hasRole(UserRole.ADMIN, UserRole.IE)) {
        try {
          const uRes = await api.get('/users', { params: { activeOnly: false } });
          setUsers(uRes.data.data);
        } catch {}
      }
    } catch (err) {
      console.error('Gagal mengambil data master:', err);
      notify('error', 'Gagal memuat data master', 'Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/categories', catForm);
      notify('success', 'Kategori berhasil dibuat', 'Data kategori sudah tersimpan.');
      setShowModal(false);
      setCatForm({ categoryName: '', department: 'Sewing', description: '' });
      fetchData();
    } catch (err: any) {
      notify('error', 'Gagal membuat kategori', err.response?.data?.message || 'Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/locations', locForm);
      notify('success', 'Lokasi berhasil dibuat', 'Data lokasi sudah tersimpan.');
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      notify('error', 'Gagal membuat lokasi', err.response?.data?.message || 'Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePIC = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/pics', picForm);
      notify('success', 'PIC berhasil didaftarkan', 'Data PIC sudah tersimpan.');
      setShowModal(false);
      setPicForm({ picName: '', employeeId: '', department: 'Sewing', role: 'Operator' });
      fetchData();
    } catch (err: any) {
      notify('error', 'Gagal mendaftarkan PIC', err.response?.data?.message || 'Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/users', userForm);
      notify('success', 'Pengguna berhasil dibuat', 'Akun baru sudah tersimpan.');
      setShowModal(false);
      setUserForm({ userName: '', loginEmail: '', roleId: UserRole.PIC, department: 'Sewing', password: '' });
      fetchData();
    } catch (err: any) {
      notify('error', 'Gagal membuat pengguna', err.response?.data?.message || 'Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-8">
      {loading && <div className="rounded-2xl border border-slate-200 bg-white"><PageLoader message="Memuat data master..." /></div>}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Master Data Pabrik & Pengguna
          </h1>
          <p className="text-xs text-slate-500">
            Kelola Master Kategori Mesin, Lokasi Gedung/Line, Penanggung Jawab (PIC), dan Akun Akses
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Data Baru</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-1 text-xs">
        <button
          onClick={() => setActiveTab('locations')}
          className={`flex items-center gap-1.5 py-2.5 px-4 font-semibold border-b-2 transition-colors ${
            activeTab === 'locations'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>03 Master Lokasi ({locations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-1.5 py-2.5 px-4 font-semibold border-b-2 transition-colors ${
            activeTab === 'categories'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>02 Master Kategori ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pics')}
          className={`flex items-center gap-1.5 py-2.5 px-4 font-semibold border-b-2 transition-colors ${
            activeTab === 'pics'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>04 Master PIC ({pics.length})</span>
        </button>

        {hasRole(UserRole.ADMIN, UserRole.IE) && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 py-2.5 px-4 font-semibold border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>07 Master User ({users.length})</span>
          </button>
        )}
      </div>

      {/* Tab Contents */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {activeTab === 'locations' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-3.5">ID Lokasi</th>
                  <th className="py-3 px-3.5">Nama Lokasi</th>
                  <th className="py-3 px-3.5">Gedung</th>
                  <th className="py-3 px-3.5">Line / Area</th>
                  <th className="py-3 px-3.5">Departemen</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Label Barcode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {locations.map((loc) => (
                  <tr key={loc.Location_ID} className="hover:bg-slate-50">
                    <td className="py-3 px-3.5 font-mono font-bold text-blue-700">{loc.Location_ID}</td>
                    <td className="py-3 px-3.5 font-semibold text-slate-900">{loc.Location_Name}</td>
                    <td className="py-3 px-3.5 text-slate-600">{loc.Building} ({loc.Floor})</td>
                    <td className="py-3 px-3.5 text-slate-600">{loc.Line}</td>
                    <td className="py-3 px-3.5 text-slate-600">{loc.Department}</td>
                    <td className="py-3 px-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${loc.Active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {loc.Active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        onClick={() => handlePrintBarcode(loc.Location_Name, `${loc.Building} • ${loc.Line}`, loc.Location_ID)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-[11px] font-semibold transition-colors border border-slate-200"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Cetak Barcode</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-3.5">ID Kategori</th>
                  <th className="py-3 px-3.5">Nama Kategori</th>
                  <th className="py-3 px-3.5">Departemen</th>
                  <th className="py-3 px-3.5">Keterangan</th>
                  <th className="py-3 px-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((cat) => (
                  <tr key={cat.Category_ID} className="hover:bg-slate-50">
                    <td className="py-3 px-3.5 font-mono font-bold text-blue-700">{cat.Category_ID}</td>
                    <td className="py-3 px-3.5 font-semibold text-slate-900">{cat.Category_Name}</td>
                    <td className="py-3 px-3.5 text-slate-600">{cat.Department}</td>
                    <td className="py-3 px-3.5 text-slate-500">{cat.Description}</td>
                    <td className="py-3 px-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cat.Active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {cat.Active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'pics' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-3.5">ID PIC</th>
                  <th className="py-3 px-3.5">Nama Lengkap</th>
                  <th className="py-3 px-3.5">No Karyawan</th>
                  <th className="py-3 px-3.5">Departemen</th>
                  <th className="py-3 px-3.5">Jabatan / Role</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Badge Barcode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pics.map((p) => (
                  <tr key={p.PIC_ID} className="hover:bg-slate-50">
                    <td className="py-3 px-3.5 font-mono font-bold text-blue-700">{p.PIC_ID}</td>
                    <td className="py-3 px-3.5 font-semibold text-slate-900">{p.PIC_Name}</td>
                    <td className="py-3 px-3.5 text-slate-600">{p.Employee_ID || '-'}</td>
                    <td className="py-3 px-3.5 text-slate-600">{p.Department}</td>
                    <td className="py-3 px-3.5 text-slate-700 font-medium">{p.Role}</td>
                    <td className="py-3 px-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${p.Active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {p.Active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        onClick={() => handlePrintBarcode(p.PIC_Name, `${p.Role} • ${p.Department}`, p.PIC_ID)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 rounded-lg text-[11px] font-semibold transition-colors border border-slate-200"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Cetak Badge</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-3.5">User ID</th>
                  <th className="py-3 px-3.5">Nama Pengguna</th>
                  <th className="py-3 px-3.5">Email Login</th>
                  <th className="py-3 px-3.5">Hak Akses (Role)</th>
                  <th className="py-3 px-3.5">Departemen</th>
                  <th className="py-3 px-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.User_ID} className="hover:bg-slate-50">
                    <td className="py-3 px-3.5 font-mono font-bold text-blue-700">{u.User_ID}</td>
                    <td className="py-3 px-3.5 font-semibold text-slate-900">{u.User_Name}</td>
                    <td className="py-3 px-3.5 text-slate-600">{u.Login_Email}</td>
                    <td className="py-3 px-3.5">
                      <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {UserRoleLabel[u.Role_ID] || u.Role_ID}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-600">{u.Department}</td>
                    <td className="py-3 px-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${u.Active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {u.Active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Tambah {activeTab === 'locations' ? 'Lokasi Baru' : activeTab === 'categories' ? 'Kategori Baru' : activeTab === 'pics' ? 'PIC Baru' : 'Pengguna Baru'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeTab === 'locations' && (
              <form onSubmit={handleCreateLocation} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Nama Lengkap Lokasi *</label>
                  <input
                    type="text"
                    required
                    placeholder="contoh: Gedung A - Sewing Line 06"
                    value={locForm.locationName}
                    onChange={(e) => setLocForm({ ...locForm, locationName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold mb-1">Gedung *</label>
                    <input
                      type="text"
                      required
                      value={locForm.building}
                      onChange={(e) => setLocForm({ ...locForm, building: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Lantai *</label>
                    <input
                      type="text"
                      required
                      value={locForm.floor}
                      onChange={(e) => setLocForm({ ...locForm, floor: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold mb-1">Departemen *</label>
                    <input
                      type="text"
                      required
                      value={locForm.department}
                      onChange={(e) => setLocForm({ ...locForm, department: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Line / Baris</label>
                    <input
                      type="text"
                      value={locForm.line}
                      onChange={(e) => setLocForm({ ...locForm, line: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl font-semibold">Batal</button>
                  <button type="submit" disabled={submitting} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold">{submitting ? '...' : 'Simpan'}</button>
                </div>
              </form>
            )}

            {activeTab === 'categories' && (
              <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Nama Kategori *</label>
                  <input
                    type="text"
                    required
                    placeholder="contoh: Packaging Equipment"
                    value={catForm.categoryName}
                    onChange={(e) => setCatForm({ ...catForm, categoryName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Departemen Utama *</label>
                  <input
                    type="text"
                    required
                    value={catForm.department}
                    onChange={(e) => setCatForm({ ...catForm, department: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Keterangan</label>
                  <input
                    type="text"
                    value={catForm.description}
                    onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl font-semibold">Batal</button>
                  <button type="submit" disabled={submitting} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold">{submitting ? '...' : 'Simpan'}</button>
                </div>
              </form>
            )}

            {activeTab === 'pics' && (
              <form onSubmit={handleCreatePIC} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Nama PIC *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama lengkap PIC"
                    value={picForm.picName}
                    onChange={(e) => setPicForm({ ...picForm, picName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Nomor Karyawan</label>
                  <input
                    type="text"
                    placeholder="EMP-..."
                    value={picForm.employeeId}
                    onChange={(e) => setPicForm({ ...picForm, employeeId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold mb-1">Departemen *</label>
                    <input
                      type="text"
                      required
                      value={picForm.department}
                      onChange={(e) => setPicForm({ ...picForm, department: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Jabatan *</label>
                    <input
                      type="text"
                      required
                      value={picForm.role}
                      onChange={(e) => setPicForm({ ...picForm, role: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl font-semibold">Batal</button>
                  <button type="submit" disabled={submitting} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold">{submitting ? '...' : 'Simpan'}</button>
                </div>
              </form>
            )}

            {activeTab === 'users' && (
              <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama user"
                    value={userForm.userName}
                    onChange={(e) => setUserForm({ ...userForm, userName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Email Login *</label>
                  <input
                    type="email"
                    required
                    placeholder="nama@esgi.co.id"
                    value={userForm.loginEmail}
                    onChange={(e) => setUserForm({ ...userForm, loginEmail: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold mb-1">Hak Akses (Role) *</label>
                    <select
                      value={userForm.roleId}
                      onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value as UserRole })}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold"
                    >
                      <option value={UserRole.ADMIN}>ADMIN</option>
                      <option value={UserRole.IE}>IE</option>
                      <option value={UserRole.SPV}>SPV</option>
                      <option value={UserRole.MECHANIC}>MECHANIC</option>
                      <option value={UserRole.PIC}>PIC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Departemen *</label>
                    <input
                      type="text"
                      required
                      value={userForm.department}
                      onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Password Awal *</label>
                  <input
                    type="password"
                    required
                    minLength={12}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl font-semibold">Batal</button>
                  <button type="submit" disabled={submitting} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold">{submitting ? '...' : 'Simpan User'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Cetak Barcode Code 128 */}
      {printBarcodeData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                PT ESGI GARMENT — ASSET LABEL
              </span>
              <button
                onClick={() => setPrintBarcodeData(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div id="printable-qr-label" className="p-4 border-2 border-dashed border-slate-300 rounded-2xl bg-white flex flex-col items-center">
              <img
                src={printBarcodeData.barcodeDataUrl}
                alt="Barcode"
                className="w-full max-w-[320px] h-auto bg-white p-1"
              />
              <span className="font-mono text-base font-extrabold text-slate-900 mt-2 tracking-wider">
                {printBarcodeData.code}
              </span>
              <h4 className="text-sm font-bold text-slate-800 mt-0.5">
                {printBarcodeData.title}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                {printBarcodeData.subtitle}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPrintBarcodeData(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Label</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
