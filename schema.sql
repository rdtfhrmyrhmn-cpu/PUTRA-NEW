-- ================================================================
-- KANTIN PUTRA — Supabase Schema
-- Jalankan di Supabase Dashboard → SQL Editor
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────
-- TABEL: harian (Laporan Pendapatan Harian)
-- ────────────────────────────────────────
CREATE TABLE public.harian (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tgl          DATE NOT NULL UNIQUE,
  is_libur     BOOLEAN DEFAULT FALSE,
  libur_ket    TEXT DEFAULT '',
  pendapatan1  NUMERIC(15,2) DEFAULT 0,
  pendapatan2  NUMERIC(15,2) DEFAULT 0,
  titipan1     NUMERIC(15,2) DEFAULT 0,
  titipan2     NUMERIC(15,2) DEFAULT 0,
  titipan3     NUMERIC(15,2) DEFAULT 0,
  tabungan     NUMERIC(15,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────
-- TABEL: pengeluaran (Biaya Operasional)
-- ────────────────────────────────────────
CREATE TABLE public.pengeluaran (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tgl          DATE NOT NULL,
  keterangan   TEXT NOT NULL,
  total        NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────
-- TABEL: penarikan (Penarikan Tabungan)
-- ────────────────────────────────────────
CREATE TABLE public.penarikan (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tgl          DATE NOT NULL,
  keterangan   TEXT DEFAULT '',
  jumlah       NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────
-- TABEL: pemasok (Supplier / Mitra)
-- ────────────────────────────────────────
CREATE TABLE public.pemasok (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nama         TEXT NOT NULL,
  kontak       TEXT DEFAULT '',
  keterangan   TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────
-- TABEL: titipan (Produk Konsinyasi)
-- ────────────────────────────────────────
CREATE TABLE public.titipan (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nama         TEXT NOT NULL,
  pemasok_id   UUID REFERENCES public.pemasok(id) ON DELETE SET NULL,
  harga_pokok  NUMERIC(15,2) DEFAULT 0,
  harga_jual   NUMERIC(15,2) DEFAULT 0,
  stok         INTEGER DEFAULT 0,
  terjual      INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────
-- TABEL: titipan_harian (Penjualan Konsinyasi Harian)
-- ────────────────────────────────────────
CREATE TABLE public.titipan_harian (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tgl          DATE NOT NULL,
  titipan_id   UUID REFERENCES public.titipan(id) ON DELETE CASCADE,
  qty          INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────
-- TABEL: piutang (Bon / Catatan Kredit)
-- ────────────────────────────────────────
CREATE TABLE public.piutang (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tgl          DATE NOT NULL,
  nama         TEXT NOT NULL,
  keterangan   TEXT DEFAULT '',
  jumlah       NUMERIC(15,2) NOT NULL DEFAULT 0,
  lunas        BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Hanya pengguna yang login yang bisa akses data
-- ════════════════════════════════════════
ALTER TABLE public.harian          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengeluaran     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penarikan       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemasok         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titipan         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titipan_harian  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piutang         ENABLE ROW LEVEL SECURITY;

-- Policy: Hanya authenticated user yang bisa akses
CREATE POLICY "authenticated_full_access" ON public.harian
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.pengeluaran
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.penarikan
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.pemasok
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.titipan
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.titipan_harian
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.piutang
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ════════════════════════════════════════
-- TRIGGER: Auto-update updated_at pada tabel harian
-- ════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER harian_updated_at
  BEFORE UPDATE ON public.harian
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
