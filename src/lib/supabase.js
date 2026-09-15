import { createClient } from '@supabase/supabase-js'

// ─── ENV CHECK ────────────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const ENV_MISSING = !supabaseUrl || !supabaseKey

// Jika env vars tidak ada → jangan crash, export client dummy
export const supabase = ENV_MISSING
  ? null
  : createClient(supabaseUrl, supabaseKey)

// ─── Auth helpers ──────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ─── Harian ────────────────────────────────────────────────────
export async function fetchHarian(bulan, tahun) {
  const from = `${tahun}-${String(bulan).padStart(2,'0')}-01`
  const to   = `${tahun}-${String(bulan).padStart(2,'0')}-31`
  const { data, error } = await supabase
    .from('harian').select('*').gte('tgl', from).lte('tgl', to).order('tgl')
  if (error) throw error
  return data
}

export async function upsertHarian(row) {
  const { error } = await supabase.from('harian').upsert(row, { onConflict: 'tgl' })
  if (error) throw error
}

export async function fetchAllHarian() {
  const { data, error } = await supabase.from('harian').select('*').order('tgl')
  if (error) throw error
  return data
}

// ─── Pengeluaran ───────────────────────────────────────────────
export async function fetchPengeluaran(bulan, tahun) {
  const from = `${tahun}-${String(bulan).padStart(2,'0')}-01`
  const to   = `${tahun}-${String(bulan).padStart(2,'0')}-31`
  const { data, error } = await supabase
    .from('pengeluaran').select('*').gte('tgl', from).lte('tgl', to).order('tgl')
  if (error) throw error
  return data
}

export async function insertPengeluaran(row) {
  const { data, error } = await supabase.from('pengeluaran').insert(row).select().single()
  if (error) throw error
  return data
}

export async function deletePengeluaran(id) {
  const { error } = await supabase.from('pengeluaran').delete().eq('id', id)
  if (error) throw error
}

export async function fetchAllPengeluaran() {
  const { data, error } = await supabase.from('pengeluaran').select('*').order('tgl')
  if (error) throw error
  return data
}

// ─── Penarikan ─────────────────────────────────────────────────
export async function fetchPenarikan() {
  const { data, error } = await supabase.from('penarikan').select('*').order('tgl', { ascending: false })
  if (error) throw error
  return data
}

export async function insertPenarikan(row) {
  const { data, error } = await supabase.from('penarikan').insert(row).select().single()
  if (error) throw error
  return data
}

export async function deletePenarikan(id) {
  const { error } = await supabase.from('penarikan').delete().eq('id', id)
  if (error) throw error
}

// ─── Pemasok ───────────────────────────────────────────────────
export async function fetchPemasok() {
  const { data, error } = await supabase.from('pemasok').select('*').order('nama')
  if (error) throw error
  return data
}

export async function insertPemasok(row) {
  const { data, error } = await supabase.from('pemasok').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updatePemasok(id, row) {
  const { error } = await supabase.from('pemasok').update(row).eq('id', id)
  if (error) throw error
}

export async function deletePemasok(id) {
  const { error } = await supabase.from('pemasok').delete().eq('id', id)
  if (error) throw error
}

// ─── Titipan ───────────────────────────────────────────────────
export async function fetchTitipan() {
  const { data, error } = await supabase
    .from('titipan').select('*, pemasok:pemasok_id(nama)').order('nama')
  if (error) throw error
  return data
}

export async function insertTitipan(row) {
  const { data, error } = await supabase.from('titipan').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateTitipan(id, row) {
  const { error } = await supabase.from('titipan').update(row).eq('id', id)
  if (error) throw error
}

export async function deleteTitipan(id) {
  const { error } = await supabase.from('titipan').delete().eq('id', id)
  if (error) throw error
}

// ─── Titipan Harian ────────────────────────────────────────────
export async function fetchTitipanHarian(bulan, tahun) {
  const from = `${tahun}-${String(bulan).padStart(2,'0')}-01`
  const to   = `${tahun}-${String(bulan).padStart(2,'0')}-31`
  const { data, error } = await supabase
    .from('titipan_harian').select('*').gte('tgl', from).lte('tgl', to)
  if (error) throw error
  return data
}

export async function fetchAllTitipanHarian() {
  const { data, error } = await supabase.from('titipan_harian').select('*')
  if (error) throw error
  return data
}

// ─── Piutang ───────────────────────────────────────────────────
export async function fetchPiutang() {
  const { data, error } = await supabase.from('piutang').select('*').order('tgl', { ascending: false })
  if (error) throw error
  return data
}

export async function insertPiutang(row) {
  const { data, error } = await supabase.from('piutang').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updatePiutang(id, row) {
  const { error } = await supabase.from('piutang').update(row).eq('id', id)
  if (error) throw error
}

export async function deletePiutang(id) {
  const { error } = await supabase.from('piutang').delete().eq('id', id)
  if (error) throw error
}
