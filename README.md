# Machine Tracking System — PT ESGI Sambi

Sistem pelacakan mesin pabrik garment berbasis Web/PWA (React + TypeScript), Backend API (Node.js + Express + TypeScript), dan Google Sheets sebagai database utama.

---

## Fitur Utama

- **Identitas & Posisi Mesin**: Pelacakan posisi aktual (`Current_Location_ID`), PIC penanggung jawab (`Current_PIC_ID`), status operasional, dan kondisi fisik setiap mesin.
- **Pindai QR Code Langsung**: Menggunakan kamera HP / tablet pekerja di lantai produksi pabrik garment, dilengkapi fallback input token manual.
- **Cetak Label QR Resmi**: Format label stiker siap cetak dengan logo PT ESGI, ID Mesin, Nama Mesin, Serial Number, dan QR Code.
- **Protokol Transaksi Aman 7-Langkah**:
  1. Validasi hak akses role backend.
  2. Pengecekan idempotensi `Request_ID` (mencegah duplikasi).
  3. Kunci transaksi per mesin (mutex lock).
  4. Verifikasi pembacaan ulang master mesin.
  5. Pencatatan log transaksi awal `PENDING`.
  6. Pembaruan lokasi dan PIC aktif master mesin.
  7. Verifikasi penulisan, update log menjadi `COMPLETED`, dan pencatatan jejak audit.
- **Recovery Job**: Rekonsiliasi otomatis jika transaksi `PENDING` tertinggal akibat jaringan terputus.
- **Alur Pemeliharaan & Kerusakan**: Pelaporan kerusakan mesin dan antrean tindak lanjut perbaikan untuk mekanik.
- **Ekspor Data IE**: Ekspor data master mesin dan log perpindahan ke format CSV untuk analisis spreadsheet Industrial Engineering.
- **Dual-Engine Repository**: Berjalan instan dengan engine spreadsheet lokal, dan otomatis beralih ke live Google Sheets API saat kredensial Service Account dikonfigurasi.
- **Penyimpanan PostgreSQL**: Backend dapat memakai PostgreSQL sebagai database utama tanpa mengubah API frontend.

---

## 8 Skema Sheet Database

1. `01_MASTER_MESIN`: Data master mesin fisik, token QR, lokasi & PIC aktif.
2. `02_MASTER_KATEGORI`: Master kategori mesin (Sewing, Cutting, Finishing, dll.).
3. `03_MASTER_LOKASI`: Master lokasi pabrik (Gedung, Lantai, Line, Area).
4. `04_MASTER_PIC`: Master penanggung jawab mesin dan operator leader.
5. `05_LOG_PERPINDAHAN`: Catatan transaksi perpindahan (append-only dengan status `PENDING` / `COMPLETED`).
6. `06_LOG_KONDISI`: Catatan kerusakan dan riwayat servis mekanik.
7. `07_MASTER_USER`: Akun pengguna aplikasi beserta role RBAC.
8. `08_LOG_AUDIT`: Log audit seluruh perubahan data penting.

---

## Cara Menjalankan Proyek

### 1. Prasyarat
- Node.js versi 18+ (disarankan Node.js 20 atau 24)
- npm versi 9+

### 2. Menjalankan Server Backend API
```bash
npm run dev:api
```
Server backend berjalan di `http://localhost:5000` (API prefix: `/api/v1`).

### 3. Menjalankan Frontend Web / PWA
```bash
npm run dev:web
```
Aplikasi web berjalan di `http://localhost:5173`.

### 4. Menjalankan Otomatisasi Tes Integrasi (T01 - T20)
```bash
npm run test:integration
```

---

## Membuat Akun Administrator Awal

Atur `INITIAL_ADMIN_EMAIL` dan `INITIAL_ADMIN_PASSWORD` di environment backend sebelum menjalankan `npm run seed`. Gunakan alamat email milik administrator dan password unik yang kuat. Seed hanya membuat akun administrator awal; akun pengguna lain dibuat dari menu master data setelah login.

---

## Menghubungkan ke Google Sheets API Resmi

Untuk menghubungkan sistem ke Google Spreadsheet asli:
1. Buat Service Account di Google Cloud Console dan unduh file JSON key.
2. Buat Google Spreadsheet baru dan bagikan akses **Editor** ke email service account Anda.
3. Buka file `apps/api/.env` dan isi variabel berikut:
   ```env
   STORAGE_MODE=google
   GOOGLE_SHEETS_SPREADSHEET_ID=id_spreadsheet_anda
   GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
  GOOGLE_PRIVATE_KEY=<private-key-from-service-account-json>
   ```
4. Restart backend (`npm run dev:api`). Backend otomatis membaca dan menulis langsung ke Google Spreadsheet!

## Deploy ke Internet dengan Google Sheets

Web dan backend harus memiliki URL HTTPS yang dapat diakses dari internet. Backend mengakses Google Sheets menggunakan Service Account; jangan masukkan private key Google ke aplikasi web atau Android.

- Atur environment backend: `STORAGE_MODE=google`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, dan `JWT_SECRET` yang kuat.
- Atur `FRONTEND_URL` di backend menjadi origin web yang diizinkan, tanpa path. Beberapa origin dapat dipisahkan dengan koma, misalnya `https://mesin.example.com,https://admin.example.com`.
- Saat membangun web, atur `VITE_API_URL` menjadi URL API lengkap sampai prefix versi, misalnya `https://api.example.com/api/v1`.
- Jika web dan API memakai domain yang sama melalui reverse proxy, `VITE_API_URL` dapat dikosongkan agar web tetap memakai `/api/v1`.
- `VITE_API_URL` ditanam ke hasil build web. Ubah nilainya lalu build ulang web setiap kali URL API berubah.

File contoh environment tersedia di `apps/api/.env.example` dan `apps/web/.env.example`. Gunakan HTTPS untuk akses kamera pemindai dari HP.

### Frontend di GitHub Pages

GitHub Pages hanya meng-host frontend statis. Deploy backend API secara terpisah ke layanan yang menjalankan Node.js, lalu:

1. Di pengaturan repository GitHub, buka **Settings > Secrets and variables > Actions > Variables** dan buat variable `VITE_API_URL`, misalnya `https://api.example.com/api/v1`.
2. Pada pengaturan backend, set `FRONTEND_URL` ke alamat GitHub Pages yang diberikan GitHub, misalnya `https://akun.github.io/nama-repo`.
3. Buka **Settings > Pages**, pilih **GitHub Actions** sebagai sumber deploy.
4. Push branch `main` atau jalankan workflow **Deploy web to GitHub Pages** secara manual.

Workflow akan gagal dengan pesan yang jelas jika `VITE_API_URL` belum diatur. Setelah workflow berhasil, URL Pages muncul di **Settings > Pages** dan di hasil workflow. Setiap perubahan URL API perlu diikuti deploy web ulang.

## Menggunakan PostgreSQL

PostgreSQL direkomendasikan untuk penggunaan multi-pengguna. Jalankan langkah berikut dari folder proyek. Pastikan Docker Desktop aktif, atau sediakan PostgreSQL 16+ sendiri.

1. Jalankan database lokal:
  ```bash
  docker compose -f docker-compose.postgres.yml up -d
  ```
2. Salin `apps/api/.env.example` menjadi `apps/api/.env`, lalu atur:
  ```env
  STORAGE_MODE=postgres
  DATABASE_URL=postgresql://machine_app:local-dev-only-change-me@localhost:5432/machine_tracking
  ```
  Ganti password default untuk penggunaan selain komputer development pribadi. Jika password berisi karakter khusus, URL-encode password tersebut.
3. Impor data lokal yang sudah ada ke PostgreSQL (perintah ini aman dijalankan ulang untuk ID yang sama):
  ```bash
  npm run import:postgres --workspace=@machine-tracking/api
  ```
4. Jalankan backend:
  ```bash
  npm run dev:api
  ```

Tabel PostgreSQL dibuat otomatis saat API mulai. Tabel yang digunakan: `machines`, `categories`, `locations`, `pics`, `movements`, `conditions`, `users`, dan `audits`. Data record disimpan sebagai JSONB, dengan kolom ID dan indeks untuk pencarian, email unik, serta deduplikasi `Request_ID` perpindahan.

Untuk database server, buat database dan user dengan hak akses minimum yang diperlukan, lalu set `DATABASE_URL` sebagai environment secret pada host API. Jangan masukkan kredensial database ke frontend atau commit file `.env`.

PostgreSQL merupakan sumber data backend; antrean offline browser yang saat ini tersedia untuk perpindahan mesin tetap akan menyinkronkan operasi ke database melalui API.


---

## Optimasi UI — Loading & Notifikasi

- Menambahkan animasi loading untuk pemeriksaan sesi, dashboard, daftar/detail mesin, data master, riwayat, audit, serta formulir perpindahan.
- Menambahkan notifikasi toast di dalam aplikasi untuk keberhasilan pemuatan data, login, penyimpanan, perpindahan mesin, pelaporan kondisi, dan ekspor.
- Mengganti pemanggilan `alert()` pada halaman terkait dengan notifikasi internal aplikasi.
- Menambahkan status proses pada tombol login dan transaksi, serta menonaktifkan tombol perpindahan ketika data form masih dimuat.
- Notifikasi tidak menggunakan notifikasi browser; tampil di dalam halaman aplikasi dan menutup otomatis.

### Setelah mengekstrak ZIP

Jalankan dari folder proyek:

```bash
npm install
npm run build
```

Untuk pengembangan lokal, jalankan backend dan frontend pada dua terminal:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Catatan: folder `node_modules` tidak disertakan agar paket tetap ringan dan dependensi dapat dipasang sesuai sistem pengguna. Build frontend lama tidak disertakan; `npm run build` akan membuat ulang hasil build dari source terbaru.
