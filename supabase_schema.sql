-- =====================================================
-- KANTIN PUTRA — Schema Database Supabase
-- Jalankan di Supabase → SQL Editor
-- =====================================================

-- 1. Tabel Laporan Harian
CREATE TABLE IF NOT EXISTS harian (
    tgl         DATE        PRIMARY KEY,
    pendapatan1 NUMERIC     DEFAULT 0,
    pendapatan2 NUMERIC     DEFAULT 0,
    titipan1    NUMERIC     DEFAULT 0,
    titipan2    NUMERIC     DEFAULT 0,
    titipan3    NUMERIC     DEFAULT 0,
    tabungan    NUMERIC     DEFAULT 0,
    is_libur    BOOLEAN     DEFAULT FALSE,
    libur_ket   TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Pengeluaran
CREATE TABLE IF NOT EXISTS pengeluaran (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tgl         DATE        NOT NULL,
    keterangan  TEXT,
    total       NUMERIC     DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Penarikan Tabungan
CREATE TABLE IF NOT EXISTS penarikan (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tgl         DATE        NOT NULL,
    keterangan  TEXT,
    jumlah      NUMERIC     DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel Pemasok
CREATE TABLE IF NOT EXISTS pemasok (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nama        TEXT        NOT NULL,
    kontak      TEXT,
    keterangan  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabel Barang Titipan (Konsinyasi)
CREATE TABLE IF NOT EXISTS titipan (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nama        TEXT        NOT NULL,
    pemasok_id  UUID        REFERENCES pemasok(id) ON DELETE SET NULL,
    harga_pokok NUMERIC     DEFAULT 0,
    harga_jual  NUMERIC     DEFAULT 0,
    stok        INTEGER     DEFAULT 0,
    terjual     INTEGER     DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabel Penjualan Titipan Harian
CREATE TABLE IF NOT EXISTS titipan_harian (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tgl         DATE        NOT NULL,
    titipan_id  UUID        REFERENCES titipan(id) ON DELETE CASCADE,
    qty         INTEGER     DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabel Piutang
CREATE TABLE IF NOT EXISTS piutang (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tgl         DATE        NOT NULL,
    nama        TEXT        NOT NULL,
    keterangan  TEXT,
    jumlah      NUMERIC     DEFAULT 0,
    lunas       BOOLEAN     DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) — Aktifkan setelah setup auth
-- =====================================================

-- Aktifkan RLS di semua tabel
ALTER TABLE harian         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengeluaran    ENABLE ROW LEVEL SECURITY;
ALTER TABLE penarikan      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pemasok        ENABLE ROW LEVEL SECURITY;
ALTER TABLE titipan        ENABLE ROW LEVEL SECURITY;
ALTER TABLE titipan_harian ENABLE ROW LEVEL SECURITY;
ALTER TABLE piutang        ENABLE ROW LEVEL SECURITY;

-- Policy: hanya user yang sudah login (authenticated) yang bisa akses
CREATE POLICY "authenticated_access" ON harian         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON pengeluaran    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON penarikan      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON pemasok        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON titipan        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON titipan_harian FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON piutang        FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGER auto-update updated_at pada tabel harian
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER harian_updated_at
  BEFORE UPDATE ON harian
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- CATATAN SETUP AUTH:
-- 1. Buka Supabase Dashboard → Authentication → Users
-- 2. Klik "Add User" → masukkan email dan password
--    Contoh: admin@kantinputra.com / password123
-- 3. User tersebut bisa login ke aplikasi web
-- =====================================================
