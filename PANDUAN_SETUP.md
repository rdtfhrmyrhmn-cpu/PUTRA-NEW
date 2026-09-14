# 📋 Panduan Setup — Kantin Putra Web App

> Aplikasi web laporan keuangan kantin berbasis **Supabase** + **Netlify**

---

## 🗂️ Daftar Isi
1. [Persiapan Awal](#1-persiapan-awal)
2. [Setup Supabase (Database)](#2-setup-supabase-database)
3. [Setup Environment Variables](#3-setup-environment-variables)
4. [Jalankan Lokal (Opsional)](#4-jalankan-lokal-opsional)
5. [Deploy ke Netlify](#5-deploy-ke-netlify)
6. [Buat Akun Pengguna](#6-buat-akun-pengguna)
7. [Struktur Fitur](#7-struktur-fitur)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Persiapan Awal

### Yang Dibutuhkan
- Akun **Supabase** gratis → https://supabase.com
- Akun **Netlify** gratis → https://netlify.com
- **Node.js** v18+ (jika ingin jalankan lokal) → https://nodejs.org

---

## 2. Setup Supabase (Database)

### Langkah 2.1 — Buat Project Baru
1. Login ke [supabase.com](https://supabase.com)
2. Klik **"New Project"**
3. Isi:
   - **Name:** `kantin-putra`
   - **Database Password:** buat password yang kuat (catat!)
   - **Region:** pilih terdekat (mis. Singapore)
4. Tunggu project selesai dibuat (~1-2 menit)

### Langkah 2.2 — Jalankan Schema SQL
1. Di Dashboard Supabase → klik **"SQL Editor"** (ikon < >)
2. Klik **"New Query"**
3. Copy-paste seluruh isi file `supabase_schema.sql`
4. Klik **"Run"** (atau tekan Ctrl+Enter)
5. Pastikan muncul pesan **"Success"**

### Langkah 2.3 — Ambil API Keys
1. Di Dashboard Supabase → klik **"Settings"** (ikon ⚙️)
2. Klik **"API"** di sidebar kiri
3. Catat dua nilai berikut:

```
Project URL  → https://xxxxxxxxxxxxx.supabase.co
anon key     → eyJhbGci... (panjang)
```

---

## 3. Setup Environment Variables

### Untuk Development Lokal
1. Di folder project, buat file `.env` (salin dari `.env.example`):

```bash
cp .env.example .env
```

2. Buka `.env` dan isi dengan nilai dari Supabase:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 4. Jalankan Lokal (Opsional)

```bash
# 1. Install dependencies
npm install

# 2. Jalankan development server
npm run dev

# 3. Buka di browser
# http://localhost:3000
```

---

## 5. Deploy ke Netlify

### Cara A — Drag & Drop (Paling Mudah)

1. Build project terlebih dahulu:
```bash
npm install
npm run build
```
2. Folder `dist/` akan terbuat
3. Buka [app.netlify.com](https://app.netlify.com)
4. Klik **"Add new site"** → **"Deploy manually"**
5. **Drag & drop** folder `dist/` ke area yang tersedia
6. Site akan langsung online!

> ⚠️ Jika deploy lewat drag & drop, variabel environment perlu diset manual (lihat poin 5.3)

### Cara B — GitHub (Direkomendasikan untuk update otomatis)

1. Upload folder project ke GitHub:
```bash
git init
git add .
git commit -m "init: Kantin Putra Web App"
git remote add origin https://github.com/USERNAME/kantin-putra.git
git push -u origin main
```

2. Di Netlify:
   - Klik **"Add new site"** → **"Import an existing project"**
   - Pilih **GitHub** → pilih repo `kantin-putra`
   - Build settings sudah otomatis terbaca dari `netlify.toml`
   - Klik **"Deploy site"**

### Langkah 5.3 — Set Environment Variables di Netlify

1. Di Netlify Dashboard → pilih site Anda
2. Klik **"Site configuration"** → **"Environment variables"**
3. Klik **"Add variable"** dan tambahkan:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` |

4. Klik **"Save"**
5. Klik **"Deploys"** → **"Trigger deploy"** → **"Deploy site"**

---

## 6. Buat Akun Pengguna

Aplikasi ini menggunakan **Supabase Auth** (email + password).

### Cara Buat User Pertama (Admin)
1. Buka Supabase Dashboard → **"Authentication"** → **"Users"**
2. Klik **"Add user"** → **"Create new user"**
3. Isi:
   - **Email:** `admin@kantinputra.com` (atau email apapun)
   - **Password:** buat password yang aman (minimal 6 karakter)
4. Klik **"Create user"**

### Login ke Aplikasi
- Buka URL Netlify Anda
- Masukkan email & password yang sudah dibuat
- Klik **"Masuk"** ✅

---

## 7. Struktur Fitur

| Menu | Fungsi |
|------|--------|
| 📅 **Laporan Harian** | Input & lihat pendapatan harian (P1, P2, Titipan, Tabungan) |
| 💸 **Pengeluaran** | Catat semua pengeluaran operasional |
| 💰 **Tabungan** | Monitor saldo, setoran per bulan, riwayat penarikan |
| 📊 **Dashboard** | Grafik & statistik bulanan |
| 📈 **Analisis** | Tren keuangan multi-bulan (6/12/24 bln) |
| 🤝 **Pemasok** | Kelola daftar supplier/pemasok |
| 🍱 **Titipan** | Manajemen barang konsinyasi & laba |
| 📝 **Piutang** | Catat bon/kredit pelanggan |
| 📂 **Cetak & Ekspor** | Export PDF, CSV, atau cetak laporan |

### Fitur Keamanan
- 🔒 **Kunci Periode** — data bulan lalu terkunci, hanya bisa diedit setelah verifikasi password
- 🔑 **Ganti Password** — bisa diubah langsung dari aplikasi
- 🔐 **Session Auth** — login/logout aman via Supabase Auth

---

## 8. Troubleshooting

### ❌ "Supabase env vars missing"
→ Pastikan file `.env` sudah diisi dan nama variabel **persis** seperti di `.env.example`

### ❌ Tidak bisa login
→ Cek apakah user sudah dibuat di Supabase Auth → Users

### ❌ Data tidak tersimpan / RLS error
→ Pastikan SQL schema sudah dijalankan penuh di Supabase (termasuk bagian RLS Policy)

### ❌ Deploy Netlify gagal (build error)
→ Pastikan Node.js version di Netlify = 20 (sudah diset di `netlify.toml`)

### ❌ Halaman 404 setelah refresh di Netlify
→ File `netlify.toml` sudah ada redirect rule. Pastikan file ini ter-deploy.

---

## 📞 Struktur File Proyek

```
kantin-putra/
├── index.html              ← Entry point HTML
├── vite.config.js          ← Konfigurasi Vite (build tool)
├── netlify.toml            ← Konfigurasi deploy Netlify
├── package.json            ← Dependencies
├── .env.example            ← Template variabel environment
├── supabase_schema.sql     ← SQL untuk setup database Supabase
├── PANDUAN_SETUP.md        ← File ini
└── src/
    ├── main.js             ← Entry JS (import App)
    ├── app.js              ← Logika utama aplikasi
    ├── lib/
    │   └── supabase.js     ← Koneksi & query Supabase
    └── styles/
        └── main.css        ← Styling aplikasi
```

---

**Dibuat untuk:** Kantin Putra — Sumberkembang, Banyuwangi  
**Basis:** KeuanganToko v11.0.0 (Electron) → Web Version (Supabase + Netlify)
