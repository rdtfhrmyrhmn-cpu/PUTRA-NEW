// ============================================================
// KANTIN PUTRA — Web App (Supabase + Netlify)
// Dibuat berdasarkan: Kantin Uimsya Putri v11.0.0
// ============================================================
import { supabase, signIn, signOut, getSession,
  fetchHarian, upsertHarian, fetchAllHarian,
  fetchPengeluaran, insertPengeluaran, deletePengeluaran, fetchAllPengeluaran,
  fetchPenarikan, insertPenarikan, deletePenarikan,
  fetchPemasok, insertPemasok, updatePemasok, deletePemasok,
  fetchTitipan, insertTitipan, updateTitipan, deleteTitipan,
  fetchTitipanHarian, fetchAllTitipanHarian,
  insertPiutang, fetchPiutang, updatePiutang, deletePiutang
} from './lib/supabase.js'

// ─── KONSTANTA ───────────────────────────────────────────────
const HARI_ID  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember']
const NAMA_TOKO   = 'KANTIN PUTRA'
const ALAMAT_TOKO = 'Sumberkembang, Banyuwangi'

// ─── STATE ───────────────────────────────────────────────────
let activeBulan = new Date().getMonth() + 1
let activeTahun = new Date().getFullYear()
let sessionUnlocked = false
let currentUser = null
let chartD1, chartD2, chartK1, chartK2, chartK3

// Cache data
let cacheHarian     = []
let cachePengeluaran = []
let cachePenarikan  = []
let cachePemasok    = []
let cacheTitipan    = []
let cacheTitipanHarian = []
let cachePiutang    = []

// ─── FORMAT ──────────────────────────────────────────────────
const fmt = v => 'Rp' + Math.abs(Math.round(Number(v)||0)).toLocaleString('id-ID')
const num = v => parseFloat(v) || 0
const isJumat  = tgl => new Date(tgl + 'T00:00:00').getDay() === 5
const namaHari = tgl => HARI_ID[new Date(tgl + 'T00:00:00').getDay()]
function labelTgl(tgl) {
  const d = new Date(tgl + 'T00:00:00')
  return `${HARI_ID[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`
}
function labelBulan(b, t) { return `${BULAN_ID[b-1]} ${t}` }
function jumlahHariDlm(b, t) { return new Date(t, b, 0).getDate() }
function semuaHari(b, t) {
  const arr = [], n = jumlahHariDlm(b, t)
  for (let d = 1; d <= n; d++) {
    arr.push(`${t}-${String(b).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
  }
  return arr
}
function fmtGrafik(v) {
  const n = Math.abs(Math.round(Number(v)))
  if (n >= 1000000) return 'Rp' + (n/1000000).toLocaleString('id-ID', {maximumFractionDigits:1}) + ' JT'
  if (n >= 1000)    return 'Rp' + Math.round(n/1000) + 'rb'
  return 'Rp' + n
}

// ─── DATA HELPERS ────────────────────────────────────────────
function isLibur(tgl) {
  if (isJumat(tgl)) return true
  const row = cacheHarian.find(r => r.tgl === tgl)
  return row && row.is_libur
}

function hitungTotal(row) {
  if (!row || row.is_libur) return 0
  return num(row.pendapatan1) + num(row.pendapatan2)
       - num(row.titipan1)   - num(row.titipan2) - num(row.titipan3)
       - num(row.tabungan)
}

function getHarianBulan(b, t) {
  b = b || activeBulan; t = t || activeTahun
  return semuaHari(b, t).map(tgl => ({
    tgl,
    row: cacheHarian.find(r => r.tgl === tgl) || null
  }))
}

function getPengeluaranBulan(b, t) {
  b = b || activeBulan; t = t || activeTahun
  const pref = `${t}-${String(b).padStart(2,'0')}`
  return cachePengeluaran.filter(p => p.tgl && p.tgl.startsWith(pref))
    .sort((a,b2) => a.tgl.localeCompare(b2.tgl))
}

function getTotalTabungan() {
  const setor = cacheHarian.reduce((s, r) => s + num(r.tabungan), 0)
  const tarik = cachePenarikan.reduce((s, p) => s + num(p.jumlah), 0)
  return { setor, tarik, saldo: setor - tarik }
}

function isTerkunci(tgl) {
  if (sessionUnlocked) return false
  const now = new Date()
  const batas = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  return tgl < batas
}

// ─── LOADING ─────────────────────────────────────────────────
function showLoading(show) {
  const el = document.getElementById('loading-overlay')
  if (el) el.style.display = show ? 'flex' : 'none'
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast')
  if (!toast) return
  toast.textContent = msg
  toast.className = `toast toast-${type} show`
  clearTimeout(toast._t)
  toast._t = setTimeout(() => toast.classList.remove('show'), 3000)
}

// ─── MODAL ───────────────────────────────────────────────────
function openModal(title, body) {
  document.getElementById('modal-title').textContent = title
  document.getElementById('modal-body').innerHTML = body
  document.getElementById('modal-overlay').style.display = 'flex'
  document.querySelector('.modal').style.display = 'block'
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none'
  document.querySelector('.modal').style.display = 'none'
}

window.closeModal = closeModal

// ─── NAVIGASI ────────────────────────────────────────────────
const TAB_NAMES = {
  home:'Beranda', harian:'Laporan Harian', pengeluaran:'Pengeluaran',
  tabungan:'Tabungan', pemasok:'Pemasok', titipan:'Titipan Barang',
  piutang:'Catatan Piutang', dashboard:'Dashboard Bulanan',
  'dashboard-kompleks':'Analisis Keuangan', ekspor:'Cetak & Ekspor'
}

async function showTab(tab) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'))
  const el = document.getElementById('tab-' + tab)
  if (el) el.classList.add('active')
  const tt = document.getElementById('topbar-title')
  if (tt) tt.textContent = TAB_NAMES[tab] || tab
  showLoading(true)
  try {
    if (tab === 'harian') {
      await loadHarian()
      renderHarian()
    } else if (tab === 'pengeluaran') {
      await loadPengeluaran()
      renderPengeluaran()
    } else if (tab === 'tabungan') {
      await loadTabungan()
      renderTabungan()
    } else if (tab === 'pemasok') {
      await loadPemasok()
      renderPemasok()
    } else if (tab === 'titipan') {
      await loadTitipan()
      renderTitipanHarian()
    } else if (tab === 'piutang') {
      await loadPiutang()
      renderPiutang()
    } else if (tab === 'dashboard') {
      await Promise.all([loadHarian(), loadPengeluaran(), loadTitipanHarianData()])
      renderDashboard()
    } else if (tab === 'dashboard-kompleks') {
      await loadAllForDashboard()
      renderDashboardKompleks()
    } else if (tab === 'ekspor') {
      const b = document.getElementById('exp-bulan'), t2 = document.getElementById('exp-tahun')
      if (b) b.value = activeBulan
      if (t2) t2.value = activeTahun
    }
  } catch(e) {
    showToast('Gagal memuat data: ' + e.message, 'error')
  }
  showLoading(false)
  if (tab === 'home') startClock()
}

window.bubbleNav = (tab) => showTab(tab)
window.goHome = () => showTab('home')
window.showTab = showTab

// ─── DATA LOADERS ────────────────────────────────────────────
async function loadHarian() {
  cacheHarian = await fetchHarian(activeBulan, activeTahun)
}
async function loadPengeluaran() {
  cachePengeluaran = await fetchPengeluaran(activeBulan, activeTahun)
}
async function loadTabungan() {
  const [allH, allP] = await Promise.all([fetchAllHarian(), fetchPenarikan()])
  cacheHarian = allH; cachePenarikan = allP
  await loadHarian()
}
async function loadPemasok() {
  cachePemasok = await fetchPemasok()
}
async function loadTitipan() {
  ;[cacheTitipan, cachePemasok, cacheTitipanHarian] = await Promise.all([
    fetchTitipan(), fetchPemasok(), fetchAllTitipanHarian()
  ])
}
async function loadTitipanHarianData() {
  cacheTitipanHarian = await fetchAllTitipanHarian()
  cacheTitipan = await fetchTitipan()
}
async function loadPiutang() {
  cachePiutang = await fetchPiutang()
}
async function loadAllForDashboard() {
  ;[cacheHarian, cachePengeluaran, cachePenarikan, cacheTitipan, cacheTitipanHarian] = await Promise.all([
    fetchAllHarian(), fetchAllPengeluaran(), fetchPenarikan(), fetchTitipan(), fetchAllTitipanHarian()
  ])
}

// ─── RENDER HARIAN ───────────────────────────────────────────
function renderHarian() {
  const days = getHarianBulan()
  const tbody = document.getElementById('tbody-harian')
  const tfoot = document.getElementById('tfoot-harian')
  if (!tbody || !tfoot) return
  let tP1=0, tP2=0, tT1=0, tT2=0, tT3=0, tTab=0, tTotal=0

  tbody.innerHTML = days.map(({ tgl, row }) => {
    const libur = isLibur(tgl)
    const ketLibur = row?.libur_ket || (isJumat(tgl) ? 'LIBUR JUMAT' : 'LIBUR')
    if (libur) return `<tr class="row-jumat">
      <td class="td-tgl">${labelTgl(tgl)}</td>
      <td colspan="7" style="text-align:center;font-style:italic;color:#f59e0b">— ${ketLibur} —</td>
      <td><button class="btn btn-outline btn-sm" onclick="showModalEdit('${tgl}')">✎</button></td>
    </tr>`
    if (!row) return `<tr class="row-kosong">
      <td class="td-tgl">${labelTgl(tgl)}</td>
      <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
      <td class="td-total">—</td>
      <td><button class="btn btn-outline btn-sm" onclick="showModalEdit('${tgl}')">✎</button></td>
    </tr>`
    const total = hitungTotal(row)
    tP1 += num(row.pendapatan1); tP2 += num(row.pendapatan2)
    tT1 += num(row.titipan1); tT2 += num(row.titipan2); tT3 += num(row.titipan3)
    tTab += num(row.tabungan); tTotal += total
    return `<tr>
      <td class="td-tgl">${labelTgl(tgl)}</td>
      <td>${row.pendapatan1 ? fmt(row.pendapatan1) : '—'}</td>
      <td>${row.pendapatan2 ? fmt(row.pendapatan2) : '—'}</td>
      <td>${row.titipan1 ? fmt(row.titipan1) : '—'}</td>
      <td>${row.titipan2 ? fmt(row.titipan2) : '—'}</td>
      <td>${row.titipan3 ? fmt(row.titipan3) : '—'}</td>
      <td>${row.tabungan ? fmt(row.tabungan) : '—'}</td>
      <td class="td-total" style="color:${total>=0?'#60a5fa':'#f87171'}">${fmt(total)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="showModalEdit('${tgl}')">✎</button></td>
    </tr>`
  }).join('')

  const { saldo } = getTotalTabungan()
  tfoot.innerHTML = `<tr>
    <td>TOTAL</td><td>${fmt(tP1)}</td><td>${fmt(tP2)}</td>
    <td>${fmt(tT1)}</td><td>${fmt(tT2)}</td><td>${fmt(tT3)}</td>
    <td>${fmt(tTab)}</td><td class="td-total-foot">${fmt(tTotal)}</td><td></td>
  </tr>
  <tr style="background:rgba(59,130,246,0.1);font-weight:700;">
    <td colspan="6" style="text-align:right;">SALDO TABUNGAN SAAT INI:</td>
    <td>${fmt(saldo)}</td><td colspan="2"></td>
  </tr>`

  document.getElementById('judul-harian').textContent = `Laporan Harian — ${labelBulan(activeBulan, activeTahun)}`
}

// Modal edit harian
window.showModalEdit = function(tgl) {
  if (isTerkunci(tgl)) {
    showModalUnlock(tgl, () => window.showModalEdit(tgl))
    return
  }
  const row = cacheHarian.find(r => r.tgl === tgl) || {}
  const libur = isLibur(tgl)
  const ketLibur = row.libur_ket || ''
  openModal(`✎ Edit Data — ${labelTgl(tgl)}`, `
    <div class="form-check-group" style="margin-bottom:16px;">
      <label class="check-label">
        <input type="checkbox" id="m-libur" ${libur ? 'checked' : ''} onchange="toggleLiburFields(this.checked)"/>
        Hari Libur
      </label>
    </div>
    <div id="libur-ket-wrap" style="${libur ? '' : 'display:none;'}margin-bottom:16px;">
      <div class="form-group">
        <label>Keterangan Libur</label>
        <input type="text" id="m-libur-ket" value="${ketLibur}" placeholder="Mis: Libur Jumat, Hari Raya..."/>
      </div>
    </div>
    <div id="form-harian-fields" style="${libur ? 'display:none' : ''}">
      <div class="form-grid">
        <div class="form-group"><label>Pendapatan I (Rp)</label>
          <input type="number" id="m-p1" value="${row.pendapatan1 || 0}" min="0"/></div>
        <div class="form-group"><label>Pendapatan II (Rp)</label>
          <input type="number" id="m-p2" value="${row.pendapatan2 || 0}" min="0"/></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Titipan I (Rp)</label>
          <input type="number" id="m-t1" value="${row.titipan1 || 0}" min="0"/></div>
        <div class="form-group"><label>Titipan II (Rp)</label>
          <input type="number" id="m-t2" value="${row.titipan2 || 0}" min="0"/></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Titipan III (Rp)</label>
          <input type="number" id="m-t3" value="${row.titipan3 || 0}" min="0"/></div>
        <div class="form-group"><label>Tabungan (Rp)</label>
          <input type="number" id="m-tab" value="${row.tabungan || 0}" min="0"/></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanHarian('${tgl}')">💾 Simpan</button>
    </div>`)
}

window.toggleLiburFields = function(checked) {
  document.getElementById('libur-ket-wrap').style.display = checked ? '' : 'none'
  document.getElementById('form-harian-fields').style.display = checked ? 'none' : ''
}

window.simpanHarian = async function(tgl) {
  const isLib = document.getElementById('m-libur')?.checked
  const liburKet = document.getElementById('m-libur-ket')?.value.trim() || null
  const row = {
    tgl,
    is_libur: isLib || false,
    libur_ket: liburKet,
    pendapatan1: isLib ? 0 : num(document.getElementById('m-p1')?.value),
    pendapatan2: isLib ? 0 : num(document.getElementById('m-p2')?.value),
    titipan1:    isLib ? 0 : num(document.getElementById('m-t1')?.value),
    titipan2:    isLib ? 0 : num(document.getElementById('m-t2')?.value),
    titipan3:    isLib ? 0 : num(document.getElementById('m-t3')?.value),
    tabungan:    isLib ? 0 : num(document.getElementById('m-tab')?.value),
  }
  try {
    await upsertHarian(row)
    await loadHarian()
    closeModal()
    renderHarian()
    showToast('✓ Data harian berhasil disimpan')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

// ─── RENDER PENGELUARAN ──────────────────────────────────────
function renderPengeluaran() {
  const list = getPengeluaranBulan()
  const tbody = document.getElementById('tbody-pengeluaran')
  const tfoot = document.getElementById('tfoot-pengeluaran')
  if (!tbody || !tfoot) return
  const total = list.reduce((s, p) => s + num(p.total), 0)
  tbody.innerHTML = !list.length
    ? `<tr><td colspan="4" class="empty">Belum ada pengeluaran bulan ini</td></tr>`
    : list.map(p => `<tr>
        <td class="td-tgl">${labelTgl(p.tgl)}</td>
        <td class="td-ket">${p.keterangan}</td>
        <td class="td-total" style="color:#f87171">${fmt(p.total)}</td>
        <td><button class="btn btn-outline btn-sm" onclick="hapusPengeluaran('${p.id}')">🗑</button></td>
      </tr>`).join('')
  tfoot.innerHTML = `<tr>
    <td colspan="2">TOTAL PENGELUARAN</td>
    <td class="td-total-foot" style="color:#f87171">${fmt(total)}</td><td></td>
  </tr>`
  document.getElementById('judul-pengeluaran').textContent = `Pengeluaran — ${labelBulan(activeBulan, activeTahun)}`
}

window.showModalTambahPengeluaran = function() {
  const today = new Date().toISOString().slice(0, 10)
  openModal('+ Tambah Pengeluaran', `
    <div class="form-group" style="margin-bottom:12px;">
      <label>Tanggal</label>
      <input type="date" id="m-peng-tgl" value="${today}"/>
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>Keterangan</label>
      <input type="text" id="m-peng-ket" placeholder="Mis: Beli tepung, Gas, dll..."/>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label>Total (Rp)</label>
      <input type="number" id="m-peng-total" placeholder="0" min="0"/>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanPengeluaran()">💾 Simpan</button>
    </div>`)
}

window.simpanPengeluaran = async function() {
  const tgl = document.getElementById('m-peng-tgl')?.value
  const ket = document.getElementById('m-peng-ket')?.value.trim()
  const total = num(document.getElementById('m-peng-total')?.value)
  if (!tgl || !ket || total <= 0) { showToast('Isi semua data dengan benar', 'error'); return }
  try {
    await insertPengeluaran({ tgl, keterangan: ket, total })
    await loadPengeluaran()
    closeModal(); renderPengeluaran()
    showToast('✓ Pengeluaran berhasil ditambahkan')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

window.hapusPengeluaran = async function(id) {
  if (!confirm('Hapus pengeluaran ini?')) return
  try {
    await deletePengeluaran(id)
    await loadPengeluaran(); renderPengeluaran()
    showToast('✓ Pengeluaran dihapus')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

// ─── RENDER TABUNGAN ─────────────────────────────────────────
function renderTabungan() {
  const { setor, tarik, saldo } = getTotalTabungan()
  const sv = document.getElementById('tab-saldo-val')
  const ttr = document.getElementById('tab-tarik-val')
  if (sv) sv.textContent = fmt(saldo)
  if (ttr) ttr.textContent = fmt(tarik)

  // Rekap per bulan
  const rekapBulan = {}
  cacheHarian.forEach(row => {
    const tab = num(row.tabungan); if (!tab) return
    const key = row.tgl.slice(0, 7)
    rekapBulan[key] = (rekapBulan[key] || 0) + tab
  })
  const rekapEl = document.getElementById('tabungan-rekap')
  if (rekapEl) {
    const sorted = Object.entries(rekapBulan).sort().reverse()
    rekapEl.innerHTML = sorted.length
      ? sorted.map(([key, val]) => {
          const [y, m] = key.split('-')
          return `<div class="rata-item"><span>${BULAN_ID[parseInt(m)-1]} ${y}</span><span class="rata-val c-blue">${fmt(val)}</span></div>`
        }).join('')
        + `<div class="rata-item" style="font-weight:700;border-top:2px solid rgba(255,255,255,0.1);padding-top:10px;margin-top:4px;">
             <span>Saldo Aktif</span><span class="c-red">${fmt(saldo)}</span>
           </div>`
      : '<div class="empty">Belum ada tabungan</div>'
  }

  // Tabungan detail table (bulan aktif)
  const tbTabungan = document.getElementById('tbody-tabungan')
  if (tbTabungan) {
    const days = getHarianBulan()
    const titulCardLabel = document.getElementById('tab-detail-judul')
    if (titulCardLabel) titulCardLabel.textContent = `Detail Tabungan — ${labelBulan(activeBulan, activeTahun)}`
    let saldoJalan = 0
    // hitung saldo sebelum bulan ini dari semua setoran & penarikan
    const prefBulan = `${activeTahun}-${String(activeBulan).padStart(2,'0')}`
    cacheHarian.filter(r => r.tgl < prefBulan+'-01').forEach(r => saldoJalan += num(r.tabungan))
    cachePenarikan.filter(p => p.tgl < prefBulan+'-01').forEach(p => saldoJalan -= num(p.jumlah))

    const rows = []
    days.forEach(({ tgl, row }) => {
      if (row && num(row.tabungan)) {
        saldoJalan += num(row.tabungan)
        rows.push(`<tr>
          <td class="td-tgl">${labelTgl(tgl)}</td>
          <td>${namaHari(tgl)}</td>
          <td>Setoran Harian</td>
          <td class="c-blue">+${fmt(row.tabungan)}</td>
          <td class="td-total">${fmt(saldoJalan)}</td>
        </tr>`)
      }
    })
    cachePenarikan.filter(p => p.tgl.startsWith(prefBulan)).sort((a,b) => a.tgl.localeCompare(b.tgl)).forEach(p => {
      saldoJalan -= num(p.jumlah)
      rows.push(`<tr>
        <td class="td-tgl">${labelTgl(p.tgl)}</td>
        <td></td>
        <td>${p.keterangan}</td>
        <td style="color:#f87171">−${fmt(p.jumlah)}</td>
        <td class="td-total">${fmt(saldoJalan)}</td>
      </tr>`)
    })
    tbTabungan.innerHTML = rows.length
      ? rows.join('')
      : '<tr><td colspan="5" class="empty">Belum ada transaksi tabungan bulan ini</td></tr>'
  }

  // Riwayat penarikan
  const penarikanList = document.getElementById('penarikan-list')
  if (penarikanList) {
    const sorted = [...cachePenarikan].sort((a,b) => b.tgl.localeCompare(a.tgl))
    penarikanList.innerHTML = !sorted.length
      ? '<div class="empty">Belum ada penarikan</div>'
      : sorted.map(p => `<div class="penarikan-item">
          <div>
            <div class="penarikan-ket">${p.keterangan}</div>
            <div class="penarikan-tgl">${labelTgl(p.tgl)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="penarikan-val">−${fmt(p.jumlah)}</span>
            <button class="penarikan-del" onclick="hapusPenarikan('${p.id}')">✕</button>
          </div>
        </div>`).join('')
  }
}

window.showModalPenarikan = function() {
  const today = new Date().toISOString().slice(0, 10)
  openModal('💸 Tarik Tabungan', `
    <div class="form-group" style="margin-bottom:12px;">
      <label>Tanggal Penarikan</label>
      <input type="date" id="m-tar-tgl" value="${today}"/>
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>Keterangan</label>
      <input type="text" id="m-tar-ket" placeholder="Mis: Kebutuhan bulanan, Investasi..."/>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label>Jumlah Ditarik (Rp)</label>
      <input type="number" id="m-tar-jml" placeholder="0" min="0"/>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanPenarikan()">💸 Tarik</button>
    </div>`)
}

window.simpanPenarikan = async function() {
  const tgl = document.getElementById('m-tar-tgl')?.value
  const ket = document.getElementById('m-tar-ket')?.value.trim()
  const jml = num(document.getElementById('m-tar-jml')?.value)
  if (!tgl || !ket || jml <= 0) { showToast('Isi semua data dengan benar', 'error'); return }
  const { saldo } = getTotalTabungan()
  if (jml > saldo) { showToast('Saldo tidak mencukupi!', 'error'); return }
  try {
    await insertPenarikan({ tgl, keterangan: ket, jumlah: jml })
    cachePenarikan = await fetchPenarikan()
    closeModal(); renderTabungan()
    showToast('✓ Penarikan berhasil dicatat')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

window.hapusPenarikan = async function(id) {
  if (!confirm('Hapus catatan penarikan ini?')) return
  try {
    await deletePenarikan(id)
    cachePenarikan = await fetchPenarikan(); renderTabungan()
    showToast('✓ Penarikan dihapus')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

// ─── RENDER PEMASOK ──────────────────────────────────────────
function renderPemasok() {
  const tbody = document.getElementById('tbody-pemasok')
  if (!tbody) return
  tbody.innerHTML = !cachePemasok.length
    ? `<tr><td colspan="4" class="empty">Belum ada pemasok</td></tr>`
    : cachePemasok.map(p => `<tr>
        <td style="text-align:left;padding-left:12px;font-weight:600">${p.nama}</td>
        <td>${p.kontak || '—'}</td>
        <td>${p.keterangan || '—'}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="showModalEditPemasok('${p.id}')">✎</button>
          <button class="btn btn-outline btn-sm" onclick="hapusPemasok('${p.id}')">🗑</button>
        </td>
      </tr>`).join('')
}

window.showModalTambahPemasok = function() {
  openModal('+ Tambah Pemasok', `
    <div class="form-group" style="margin-bottom:12px;">
      <label>Nama Pemasok</label>
      <input type="text" id="m-pas-nama" placeholder="Nama pemasok/supplier"/>
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>Kontak</label>
      <input type="text" id="m-pas-kontak" placeholder="No HP / WhatsApp"/>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label>Keterangan</label>
      <input type="text" id="m-pas-ket" placeholder="Jenis barang yang dipasok..."/>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanPemasok()">💾 Simpan</button>
    </div>`)
}

window.simpanPemasok = async function() {
  const nama = document.getElementById('m-pas-nama')?.value.trim()
  if (!nama) { showToast('Nama pemasok harus diisi', 'error'); return }
  try {
    await insertPemasok({
      nama,
      kontak: document.getElementById('m-pas-kontak')?.value.trim() || null,
      keterangan: document.getElementById('m-pas-ket')?.value.trim() || null
    })
    await loadPemasok(); closeModal(); renderPemasok()
    showToast('✓ Pemasok berhasil ditambahkan')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

window.showModalEditPemasok = function(id) {
  const p = cachePemasok.find(x => x.id === id)
  if (!p) return
  openModal('✎ Edit Pemasok', `
    <div class="form-group" style="margin-bottom:12px;">
      <label>Nama Pemasok</label>
      <input type="text" id="m-pas-nama" value="${p.nama}"/>
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>Kontak</label>
      <input type="text" id="m-pas-kontak" value="${p.kontak || ''}"/>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label>Keterangan</label>
      <input type="text" id="m-pas-ket" value="${p.keterangan || ''}"/>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="updatePemasokData('${id}')">💾 Simpan</button>
    </div>`)
}

window.updatePemasokData = async function(id) {
  const nama = document.getElementById('m-pas-nama')?.value.trim()
  if (!nama) { showToast('Nama harus diisi', 'error'); return }
  try {
    await updatePemasok(id, {
      nama,
      kontak: document.getElementById('m-pas-kontak')?.value.trim() || null,
      keterangan: document.getElementById('m-pas-ket')?.value.trim() || null
    })
    await loadPemasok(); closeModal(); renderPemasok()
    showToast('✓ Pemasok diperbarui')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

window.hapusPemasok = async function(id) {
  if (!confirm('Hapus pemasok ini?')) return
  try {
    await deletePemasok(id)
    await loadPemasok(); renderPemasok()
    showToast('✓ Pemasok dihapus')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

// ─── RENDER TITIPAN ──────────────────────────────────────────
function renderTitipanHarian() {
  const el = document.getElementById('tit-total-barang')
  const el2 = document.getElementById('tit-estimasi-untung')
  const el3 = document.getElementById('tit-jml-pemasok')
  const el4 = document.getElementById('tit-terjual')
  if (el) el.textContent = cacheTitipan.length
  if (el2) {
    const untung = cacheTitipan.reduce((s,t) => s + (num(t.harga_jual)-num(t.harga_pokok))*num(t.terjual), 0)
    el2.textContent = fmt(untung)
  }
  if (el3) {
    const pemasokSet = new Set(cacheTitipan.map(t => t.pemasok_id).filter(Boolean))
    el3.textContent = pemasokSet.size
  }
  if (el4) el4.textContent = cacheTitipan.reduce((s,t) => s + num(t.terjual), 0)

  const tbody = document.getElementById('tbody-titipan')
  const tfoot = document.getElementById('tfoot-titipan')
  if (!tbody) return

  let totalLaba = 0
  tbody.innerHTML = !cacheTitipan.length
    ? `<tr><td colspan="8" class="empty">Belum ada barang titipan</td></tr>`
    : cacheTitipan.map(t => {
        const laba = (num(t.harga_jual) - num(t.harga_pokok)) * num(t.terjual)
        totalLaba += laba
        const namaPemasok = t.pemasok?.nama || (cachePemasok.find(p=>p.id===t.pemasok_id)?.nama) || '—'
        return `<tr>
          <td style="text-align:left;padding-left:12px;font-weight:600">${t.nama}</td>
          <td>${namaPemasok}</td>
          <td class="td-total">${fmt(t.harga_pokok)}</td>
          <td class="td-total">${fmt(t.harga_jual)}</td>
          <td style="text-align:center">${t.stok}</td>
          <td style="text-align:center">${t.terjual}</td>
          <td class="td-total" style="color:${laba>=0?'#4ade80':'#f87171'}">${fmt(laba)}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="showModalEditTitipan('${t.id}')">✎</button>
            <button class="btn btn-outline btn-sm" onclick="hapusTitipan('${t.id}')">🗑</button>
          </td>
        </tr>`
      }).join('')

  if (tfoot) tfoot.innerHTML = `<tr>
    <td colspan="6">TOTAL LABA KONSINYASI</td>
    <td class="td-total-foot" style="color:#4ade80">${fmt(totalLaba)}</td><td></td>
  </tr>`
}

window.showModalTambahTitipan = function() {
  const opts = cachePemasok.map(p => `<option value="${p.id}">${p.nama}</option>`).join('')
  openModal('+ Tambah Barang Titipan', `
    <div class="form-group" style="margin-bottom:12px;">
      <label>Nama Barang</label>
      <input type="text" id="m-tit-nama" placeholder="Contoh: Keripik, Nasi Bungkus..."/>
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>Pemasok</label>
      <select id="m-tit-pemasok">${opts || '<option value="">— Tambah pemasok dulu —</option>'}</select>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Harga Pokok (Rp)</label><input type="number" id="m-tit-pokok" value="0" min="0"/></div>
      <div class="form-group"><label>Harga Jual (Rp)</label><input type="number" id="m-tit-jual" value="0" min="0"/></div>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Stok Awal</label><input type="number" id="m-tit-stok" value="0" min="0"/></div>
      <div class="form-group"><label>Terjual</label><input type="number" id="m-tit-terjual" value="0" min="0"/></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanTitipan()">💾 Simpan</button>
    </div>`)
}

window.simpanTitipan = async function() {
  const nama = document.getElementById('m-tit-nama')?.value.trim()
  if (!nama) { showToast('Nama barang harus diisi', 'error'); return }
  try {
    await insertTitipan({
      nama,
      pemasok_id: document.getElementById('m-tit-pemasok')?.value || null,
      harga_pokok: num(document.getElementById('m-tit-pokok')?.value),
      harga_jual: num(document.getElementById('m-tit-jual')?.value),
      stok: num(document.getElementById('m-tit-stok')?.value),
      terjual: num(document.getElementById('m-tit-terjual')?.value),
    })
    await loadTitipan(); closeModal(); renderTitipanHarian()
    showToast('✓ Barang titipan berhasil ditambahkan')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

window.showModalEditTitipan = function(id) {
  const t = cacheTitipan.find(x => x.id === id)
  if (!t) return
  const opts = cachePemasok.map(p => `<option value="${p.id}" ${p.id===t.pemasok_id?'selected':''}>${p.nama}</option>`).join('')
  openModal('✎ Edit Barang Titipan', `
    <div class="form-group" style="margin-bottom:12px;">
      <label>Nama Barang</label>
      <input type="text" id="m-tit-nama" value="${t.nama}"/>
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>Pemasok</label>
      <select id="m-tit-pemasok">${opts}</select>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Harga Pokok (Rp)</label><input type="number" id="m-tit-pokok" value="${t.harga_pokok}"/></div>
      <div class="form-group"><label>Harga Jual (Rp)</label><input type="number" id="m-tit-jual" value="${t.harga_jual}"/></div>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Stok Awal</label><input type="number" id="m-tit-stok" value="${t.stok}"/></div>
      <div class="form-group"><label>Terjual (Kumulatif)</label><input type="number" id="m-tit-terjual" value="${t.terjual}"/></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="updateTitipanData('${id}')">💾 Simpan</button>
    </div>`)
}

window.updateTitipanData = async function(id) {
  const nama = document.getElementById('m-tit-nama')?.value.trim()
  if (!nama) { showToast('Nama barang harus diisi', 'error'); return }
  try {
    await updateTitipan(id, {
      nama,
      pemasok_id: document.getElementById('m-tit-pemasok')?.value || null,
      harga_pokok: num(document.getElementById('m-tit-pokok')?.value),
      harga_jual: num(document.getElementById('m-tit-jual')?.value),
      stok: num(document.getElementById('m-tit-stok')?.value),
      terjual: num(document.getElementById('m-tit-terjual')?.value),
    })
    await loadTitipan(); closeModal(); renderTitipanHarian()
    showToast('✓ Barang titipan diperbarui')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

window.hapusTitipan = async function(id) {
  if (!confirm('Hapus barang titipan ini?')) return
  try {
    await deleteTitipan(id)
    await loadTitipan(); renderTitipanHarian()
    showToast('✓ Barang titipan dihapus')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

// ─── RENDER PIUTANG ──────────────────────────────────────────
function renderPiutang() {
  const tbody = document.getElementById('tbody-piutang')
  if (!tbody) return
  const prefBulan = `${activeTahun}-${String(activeBulan).padStart(2,'0')}`
  let totalBelum = 0, totalLunas = 0
  tbody.innerHTML = !cachePiutang.length
    ? `<tr><td colspan="6" class="empty">Belum ada catatan piutang</td></tr>`
    : cachePiutang.map(p => {
        if (!p.lunas) totalBelum += num(p.jumlah)
        else if (p.tgl.startsWith(prefBulan)) totalLunas += num(p.jumlah)
        return `<tr>
          <td class="td-tgl">${labelTgl(p.tgl)}</td>
          <td style="text-align:left;padding-left:12px;font-weight:600">${p.nama}</td>
          <td>${p.keterangan || '—'}</td>
          <td class="td-total">${fmt(p.jumlah)}</td>
          <td style="text-align:center">
            ${p.lunas
              ? '<span class="badge badge-lunas">LUNAS</span>'
              : '<span class="badge badge-belum">BELUM LUNAS</span>'}
          </td>
          <td>
            ${!p.lunas ? `<button class="btn btn-success btn-sm" onclick="setLunasPiutang('${p.id}')">✓</button>` : ''}
            <button class="btn btn-outline btn-sm" onclick="hapusPiutang('${p.id}')">🗑</button>
          </td>
        </tr>`
      }).join('')

  const bl = document.getElementById('piu-total-belumlunas')
  const lu = document.getElementById('piu-total-lunas')
  if (bl) bl.textContent = fmt(totalBelum)
  if (lu) lu.textContent = fmt(totalLunas)
}

window.showModalTambahPiutang = function() {
  const today = new Date().toISOString().slice(0, 10)
  openModal('+ Tambah Catatan Piutang', `
    <div class="form-group" style="margin-bottom:12px;">
      <label>Tanggal</label>
      <input type="date" id="m-piu-tgl" value="${today}"/>
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>Nama Pelanggan</label>
      <input type="text" id="m-piu-nama" placeholder="Pak Budi, Mbak Ani..."/>
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>Jumlah (Rp)</label>
      <input type="number" id="m-piu-jml" placeholder="0" min="0"/>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label>Keterangan</label>
      <input type="text" id="m-piu-ket" placeholder="Bon makan siang, Rokok..."/>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanPiutang()">💾 Simpan</button>
    </div>`)
}

window.simpanPiutang = async function() {
  const tgl = document.getElementById('m-piu-tgl')?.value
  const nama = document.getElementById('m-piu-nama')?.value.trim()
  const jml = num(document.getElementById('m-piu-jml')?.value)
  if (!tgl || !nama || jml <= 0) { showToast('Isi tanggal, nama, dan jumlah', 'error'); return }
  try {
    await insertPiutang({
      tgl, nama, jumlah: jml,
      keterangan: document.getElementById('m-piu-ket')?.value.trim() || null,
      lunas: false
    })
    await loadPiutang(); closeModal(); renderPiutang()
    showToast('✓ Piutang berhasil dicatat')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

window.setLunasPiutang = async function(id) {
  if (!confirm('Tandai piutang ini sebagai Lunas?')) return
  try {
    await updatePiutang(id, { lunas: true })
    await loadPiutang(); renderPiutang()
    showToast('✓ Piutang ditandai lunas')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

window.hapusPiutang = async function(id) {
  if (!confirm('Hapus catatan piutang ini?')) return
  try {
    await deletePiutang(id)
    await loadPiutang(); renderPiutang()
    showToast('✓ Piutang dihapus')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

// ─── RENDER DASHBOARD ────────────────────────────────────────
function renderDashboard() {
  const days = getHarianBulan()
  const peng = getPengeluaranBulan()
  let tKotor=0, tBersih=0, tTab=0, hKerja=0

  days.forEach(({ tgl, row }) => {
    if (isLibur(tgl) || !row) return
    hKerja++
    tKotor += num(row.pendapatan1) + num(row.pendapatan2)
    tTab += num(row.tabungan)
    tBersih += hitungTotal(row)
  })

  const prefBulan = `${activeTahun}-${String(activeBulan).padStart(2,'0')}`
  const tUntungTitipan = cacheTitipanHarian
    .filter(h => h.tgl.startsWith(prefBulan))
    .reduce((s, h) => {
      const item = cacheTitipan.find(t => t.id === h.titipan_id)
      return s + (item ? (num(item.harga_jual) - num(item.harga_pokok)) * num(h.qty) : 0)
    }, 0)

  const tPeng = peng.reduce((s, p) => s + num(p.total), 0)
  const laba = tBersih + tUntungTitipan - tPeng
  const rataP = hKerja ? Math.round(tBersih / hKerja) : 0

  const mc = document.getElementById('metric-cards')
  if (mc) mc.innerHTML = `
    <div class="metric"><div class="metric-label">💰 Pendapatan Toko</div><div class="metric-value c-blue">${fmt(tBersih)}</div><div class="metric-delta">${hKerja} hari kerja</div></div>
    <div class="metric"><div class="metric-label">📦 Laba Titipan</div><div class="metric-value c-green">${fmt(tUntungTitipan)}</div><div class="metric-delta">Konsinyasi</div></div>
    <div class="metric"><div class="metric-label">📤 Pengeluaran</div><div class="metric-value c-red">${fmt(tPeng)}</div><div class="metric-delta">${peng.length} item</div></div>
    <div class="metric"><div class="metric-label">📈 Laba Bersih</div><div class="metric-value ${laba>=0?'c-green':'c-red'}">${fmt(laba)}</div><div class="metric-delta">Total Akhir</div></div>`

  renderDashChart(days, peng)

  const nilaiHari = days.filter(({tgl,row}) => !isJumat(tgl) && row).map(({tgl,row}) => hitungTotal(row))
  const tertinggiP = nilaiHari.length ? Math.max(...nilaiHari) : 0
  const terendahP  = nilaiHari.length ? Math.min(...nilaiHari) : 0

  const rataP_el = document.getElementById('rata-pendapatan')
  if (rataP_el) rataP_el.innerHTML = `
    <div class="rata-item"><span>Rata-rata per hari</span><span class="rata-val c-green">${fmt(rataP)}</span></div>
    <div class="rata-item"><span>Hari tertinggi</span><span class="rata-val c-green">${fmt(tertinggiP)}</span></div>
    <div class="rata-item"><span>Hari terendah</span><span class="rata-val c-red">${fmt(terendahP)}</span></div>
    <div class="rata-item"><span>Hari tercatat</span><span class="rata-val">${nilaiHari.length} hari</span></div>
    <div class="rata-item"><span>Total pendapatan bersih</span><span class="rata-val c-green">${fmt(tBersih)}</span></div>`

  const nilaiPeng = peng.map(p => num(p.total))
  const tertinggiK = nilaiPeng.length ? Math.max(...nilaiPeng) : 0
  const terendahK  = nilaiPeng.length ? Math.min(...nilaiPeng) : 0
  const rataK = peng.length ? Math.round(tPeng/peng.length) : 0

  const rataK_el = document.getElementById('rata-pengeluaran')
  if (rataK_el) rataK_el.innerHTML = `
    <div class="rata-item"><span>Rata-rata per transaksi</span><span class="rata-val c-red">${fmt(rataK)}</span></div>
    <div class="rata-item"><span>Pengeluaran tertinggi</span><span class="rata-val c-red">${fmt(tertinggiK)}</span></div>
    <div class="rata-item"><span>Pengeluaran terendah</span><span class="rata-val c-orange">${fmt(terendahK)}</span></div>
    <div class="rata-item"><span>Total transaksi</span><span class="rata-val">${peng.length} item</span></div>
    <div class="rata-item"><span>Total pengeluaran</span><span class="rata-val c-red">${fmt(tPeng)}</span></div>`
}

function renderDashChart(days, peng) {
  if (!window.Chart) return
  const type = document.getElementById('dash-chart-type')?.value || 'bar'
  const labels = [], vals = []
  days.forEach(({ tgl, row }) => {
    if (isLibur(tgl)) return
    labels.push(new Date(tgl+'T00:00:00').getDate())
    vals.push(row ? hitungTotal(row) : 0)
  })

  const ctx1 = document.getElementById('dashChart')
  if (ctx1) {
    if (chartD1) chartD1.destroy()
    chartD1 = new Chart(ctx1, { type,
      data: { labels, datasets: [{ label:'Bersih Harian', data:vals,
        borderColor:'#60a5fa', backgroundColor: type==='line' ? 'rgba(96,165,250,0.1)' : 'rgba(96,165,250,0.7)',
        tension:.3, fill: type==='line', pointRadius:3 }] },
      options: { responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false} },
        scales:{ x:{ticks:{color:'#94a3b8',font:{size:10}}},
                 y:{ticks:{callback:v=>fmtGrafik(v),color:'#94a3b8',font:{size:10}}} } } })
  }

  const tK = days.reduce((s,{tgl,row}) => { if(!row||isLibur(tgl))return s; return s+num(row.pendapatan1)+num(row.pendapatan2) }, 0)
  const tP = peng.reduce((s,p) => s+num(p.total), 0)
  const ctx2 = document.getElementById('dashChart2')
  if (ctx2) {
    if (chartD2) chartD2.destroy()
    chartD2 = new Chart(ctx2, { type:'bar',
      data: { labels:['Pend. Kotor','Pengeluaran'], datasets:[{ data:[tK,tP],
        backgroundColor:['rgba(74,222,128,0.8)','rgba(248,113,113,0.8)'], borderWidth:0 }] },
      options: { responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false} },
        scales:{ y:{ticks:{callback:v=>fmtGrafik(v),color:'#94a3b8'}} } } })
  }
}

window.changeDashChartType = async function() {
  await showTab('dashboard')
}

// ─── DASHBOARD KOMPLEKS ──────────────────────────────────────
let activePeriod = 12

function getRekapBulanan() {
  const map = {}
  cacheHarian.forEach(row => {
    const key = row.tgl.slice(0, 7)
    if (!map[key]) map[key] = { pendapatan:0, titipan:0, pengeluaran:0, tabungan:0, bersih:0, untungTitipan:0, penarikan:0 }
    if (!isLibur(row.tgl)) {
      map[key].pendapatan += num(row.pendapatan1)+num(row.pendapatan2)
      map[key].titipan    += num(row.titipan1)+num(row.titipan2)+num(row.titipan3)
      map[key].tabungan   += num(row.tabungan)
      map[key].bersih     += hitungTotal(row)
    }
  })
  cacheTitipanHarian.forEach(h => {
    const key = h.tgl.slice(0, 7)
    if (!map[key]) map[key] = { pendapatan:0, titipan:0, pengeluaran:0, tabungan:0, bersih:0, untungTitipan:0, penarikan:0 }
    const item = cacheTitipan.find(t => t.id === h.titipan_id)
    if (item) map[key].untungTitipan += (num(item.harga_jual)-num(item.harga_pokok))*num(h.qty)
  })
  cachePengeluaran.forEach(p => {
    const key = p.tgl.slice(0, 7)
    if (!map[key]) map[key] = { pendapatan:0, titipan:0, pengeluaran:0, tabungan:0, bersih:0, untungTitipan:0, penarikan:0 }
    map[key].pengeluaran += num(p.total)
  })
  cachePenarikan.forEach(p => {
    const key = p.tgl.slice(0, 7)
    if (!map[key]) map[key] = { pendapatan:0, titipan:0, pengeluaran:0, tabungan:0, bersih:0, untungTitipan:0, penarikan:0 }
    map[key].penarikan += num(p.jumlah)
  })
  return map
}

function getBulanRange(n) {
  const result = []; const now = new Date()
  for (let i = n-1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  return result
}

function renderDashboardKompleks() {
  const bulanRange = getBulanRange(activePeriod)
  const rekap = getRekapBulanan()

  const labels = bulanRange.map(key => {
    const [y, m] = key.split('-')
    return `${BULAN_ID[parseInt(m)-1].slice(0,3)} '${y.slice(2)}`
  })
  const dataPend = bulanRange.map(k => (rekap[k]||{}).bersih||0)
  const dataPeng = bulanRange.map(k => (rekap[k]||{}).pengeluaran||0)
  const dataTab  = bulanRange.map(k => (rekap[k]||{}).tabungan||0)
  const dataLaba = bulanRange.map(k => ((rekap[k]||{}).bersih||0) + ((rekap[k]||{}).untungTitipan||0) - ((rekap[k]||{}).pengeluaran||0))
  const dataRekap = bulanRange.map(k => rekap[k] || {})

  // Chart 1
  const ctx1 = document.getElementById('kompChart1')
  if (ctx1 && window.Chart) {
    if (chartK1) chartK1.destroy()
    chartK1 = new Chart(ctx1, { type:'bar',
      data: { labels, datasets: [
        { label:'Total Pend. Harian', data:dataPend, backgroundColor:'rgba(74,222,128,0.75)', borderRadius:4 },
        { label:'Pengeluaran', data:dataPeng, backgroundColor:'rgba(248,113,113,0.7)', borderRadius:4 },
        { label:'Laba Bersih', data:dataLaba, type:'line', borderColor:'#60a5fa', backgroundColor:'rgba(96,165,250,0.1)', tension:.4, fill:true, pointRadius:4 }
      ] },
      options: { responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{color:'#94a3b8',font:{size:11}} } },
        scales:{ x:{ticks:{color:'#94a3b8',font:{size:10},maxRotation:45}}, y:{ticks:{callback:v=>fmtGrafik(v),color:'#94a3b8'}} } } })
  }

  // Chart 2: Tabungan
  const ctx2 = document.getElementById('kompChart2')
  if (ctx2 && window.Chart) {
    if (chartK2) chartK2.destroy()
    chartK2 = new Chart(ctx2, { type:'line',
      data: { labels, datasets: [{ label:'Tabungan per Bulan', data:dataTab,
        borderColor:'#a78bfa', backgroundColor:'rgba(167,139,250,0.15)', tension:.4, fill:true, pointRadius:4 }] },
      options: { responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{labels:{color:'#94a3b8'}} },
        scales:{ x:{ticks:{color:'#94a3b8',font:{size:10},maxRotation:45}}, y:{ticks:{callback:v=>fmtGrafik(v),color:'#94a3b8'}} } } })
  }

  // Tabel rekap
  const tbody = document.getElementById('tbody-komp')
  if (tbody) {
    tbody.innerHTML = bulanRange.map((key, i) => {
      const r = rekap[key] || {}
      const laba = (r.bersih||0) + (r.untungTitipan||0) - (r.pengeluaran||0)
      return `<tr>
        <td>${labels[i]}</td>
        <td class="td-total c-green">${fmt(r.bersih||0)}</td>
        <td class="td-total c-orange">${fmt(r.untungTitipan||0)}</td>
        <td class="td-total c-red">${fmt(r.pengeluaran||0)}</td>
        <td class="td-total c-blue">${fmt(r.tabungan||0)}</td>
        <td class="td-total" style="color:${laba>=0?'#4ade80':'#f87171'}">${fmt(laba)}</td>
      </tr>`
    }).join('')
  }
  const tfoot = document.getElementById('tfoot-komp')
  if (tfoot) {
    const totPend   = dataRekap.reduce((s,r) => s+(r.bersih||0), 0)
    const totTitipan= dataRekap.reduce((s,r) => s+(r.untungTitipan||0), 0)
    const totPeng   = dataRekap.reduce((s,r) => s+(r.pengeluaran||0), 0)
    const totTab    = dataRekap.reduce((s,r) => s+(r.tabungan||0), 0)
    const totLaba   = totPend + totTitipan - totPeng
    tfoot.innerHTML = `<tr style="font-weight:700">
      <td>TOTAL ${activePeriod} BLN</td>
      <td class="td-total-foot c-green">${fmt(totPend)}</td>
      <td class="td-total-foot c-orange">${fmt(totTitipan)}</td>
      <td class="td-total-foot c-red">${fmt(totPeng)}</td>
      <td class="td-total-foot c-blue">${fmt(totTab)}</td>
      <td class="td-total-foot" style="color:${totLaba>=0?'#4ade80':'#f87171'}">${fmt(totLaba)}</td>
    </tr>`
  }
}

window.setPeriod = async function(n) {
  activePeriod = n
  document.querySelectorAll('.btn-period').forEach(b => b.classList.remove('active-period'))
  document.getElementById('p-'+n)?.classList.add('active-period')
  await loadAllForDashboard()
  renderDashboardKompleks()
}

// ─── EKSPOR CSV ──────────────────────────────────────────────
window.eksporHarianCSV = function(fromExp) {
  const b = fromExp ? parseInt(document.getElementById('exp-bulan').value) : activeBulan
  const t = fromExp ? parseInt(document.getElementById('exp-tahun').value) : activeTahun
  const days = getHarianBulan(b, t)
  const rows = [['Tanggal','Pendapatan I','Pendapatan II','Titipan I','Titipan II','Titipan III','Tabungan','Total Bersih']]
  days.forEach(({ tgl, row }) => {
    if (isLibur(tgl)) return rows.push([labelTgl(tgl),'LIBUR','','','','','',''])
    if (!row) return rows.push([labelTgl(tgl),'','','','','','',''])
    rows.push([labelTgl(tgl), row.pendapatan1||0, row.pendapatan2||0,
               row.titipan1||0, row.titipan2||0, row.titipan3||0,
               row.tabungan||0, hitungTotal(row)])
  })
  downloadCSV(`laporan_harian_${t}_${String(b).padStart(2,'0')}.csv`, rows)
  showToast('✓ CSV laporan harian berhasil diunduh')
}

window.eksporPengeluaranCSV = function(fromExp) {
  const b = fromExp ? parseInt(document.getElementById('exp-bulan').value) : activeBulan
  const t = fromExp ? parseInt(document.getElementById('exp-tahun').value) : activeTahun
  const list = cachePengeluaran.filter(p => p.tgl.startsWith(`${t}-${String(b).padStart(2,'0')}`))
  const rows = [['Tanggal','Keterangan','Total']]
  list.forEach(p => rows.push([labelTgl(p.tgl), p.keterangan, p.total]))
  rows.push(['TOTAL','', list.reduce((s,p) => s+num(p.total), 0)])
  downloadCSV(`pengeluaran_${t}_${String(b).padStart(2,'0')}.csv`, rows)
  showToast('✓ CSV pengeluaran berhasil diunduh')
}

function downloadCSV(filename, rows) {
  const bom = '\uFEFF'
  const csv = bom + rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

// ─── EKSPOR PDF ──────────────────────────────────────────────
window.eksporPDF_Harian = async function(fromExp) {
  if (!window.jspdf) { showToast('Library jsPDF belum termuat', 'error'); return }
  const { jsPDF } = window.jspdf
  const b = fromExp ? parseInt(document.getElementById('exp-bulan').value) : activeBulan
  const t = fromExp ? parseInt(document.getElementById('exp-tahun').value) : activeTahun
  const days = getHarianBulan(b, t)
  const lbl = labelBulan(b, t)
  const tglCetak = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})

  let tP1=0, tP2=0, tT1=0, tT2=0, tT3=0, tTab=0, tTotal=0
  days.forEach(({tgl,row}) => {
    if (!row || isLibur(tgl)) return
    tP1+=num(row.pendapatan1); tP2+=num(row.pendapatan2)
    tT1+=num(row.titipan1); tT2+=num(row.titipan2); tT3+=num(row.titipan3)
    tTab+=num(row.tabungan); tTotal+=hitungTotal(row)
  })

  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  // Header
  doc.setFillColor(0, 91, 150)
  doc.rect(0, 0, 210, 10, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor(255,255,255)
  doc.text(NAMA_TOKO, 105, 7, { align:'center' })
  doc.setFillColor(245,249,255); doc.rect(0, 10, 210, 16, 'F')
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(60,60,60)
  doc.text(ALAMAT_TOKO, 105, 16, { align:'center' })
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(0,91,150)
  doc.text('LAPORAN PENDAPATAN HARIAN', 105, 22, { align:'center' })
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(100,100,100)
  doc.text(`Periode: ${lbl}`, 15, 29)
  doc.text(`Dicetak: ${tglCetak}`, 195, 29, { align:'right' })
  doc.setDrawColor(0,91,150); doc.setLineWidth(0.6); doc.line(15,31,195,31)

  const startY = 34
  const HARI_S = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']
  const tableBody = days.map(({tgl,row}) => {
    const d = new Date(tgl+'T00:00:00')
    const ts = `${HARI_S[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}`
    if (isLibur(tgl)) {
      const ket = row?.libur_ket || (isJumat(tgl)?'LIBUR JUMAT':'LIBUR')
      return [{ content:ts, styles:{fontStyle:'italic',textColor:[180,120,0]} },
              { content:ket, colSpan:7, styles:{fontStyle:'italic',textColor:[180,120,0],halign:'center'} }]
    }
    if (!row) return [ts,'','','','','','','—']
    const total = hitungTotal(row)
    const fN = v => v ? Math.round(v).toLocaleString('id-ID') : ''
    return [ts, fN(row.pendapatan1), fN(row.pendapatan2), fN(row.titipan1), fN(row.titipan2), fN(row.titipan3), fN(row.tabungan),
            { content:Math.round(total).toLocaleString('id-ID'), styles:{fontStyle:'bold',textColor:total>=0?[0,91,150]:[200,30,30]} }]
  })

  const fN = v => Math.round(v).toLocaleString('id-ID')
  doc.autoTable({
    head:[['Tgl','Pend. I','Pend. II','Tip. I','Tip. II','Tip. III','Tab.','TOTAL']],
    body: tableBody,
    foot:[['TOTAL', fN(tP1),fN(tP2),fN(tT1),fN(tT2),fN(tT3),fN(tTab),fN(tTotal)]],
    startY, margin:{left:15,right:15},
    styles:{fontSize:8,cellPadding:2.2},
    headStyles:{fillColor:[0,91,150],textColor:255,fontStyle:'bold',halign:'center'},
    footStyles:{fillColor:[230,240,255],textColor:[0,0,0],fontStyle:'bold'},
    columnStyles:{0:{cellWidth:18},1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'},6:{halign:'right'},7:{halign:'right',fontStyle:'bold'}},
    alternateRowStyles:{fillColor:[248,251,255]}
  })

  // TTD
  const ttdY = Math.min(doc.lastAutoTable.finalY + 14, 248)
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60)
  doc.text(`Sumberkembang, ${tglCetak}`, 140, ttdY)
  doc.text('Pengelola,', 140, ttdY+5)
  doc.line(138, ttdY+24, 192, ttdY+24)
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5)
  doc.text('( ................................ )', 165, ttdY+29, {align:'center'})
  doc.setFontSize(7.5); doc.setFont('helvetica','italic'); doc.setTextColor(150,150,150)
  doc.text(`${NAMA_TOKO}  ·  Aplikasi Keuangan Kantin Web`, 105, 290, {align:'center'})

  doc.save(`laporan_pendapatan_${t}_${String(b).padStart(2,'0')}.pdf`)
  showToast('✓ PDF berhasil diunduh')
}

window.eksporPDF_Pengeluaran = async function(fromExp) {
  if (!window.jspdf) { showToast('Library jsPDF belum termuat', 'error'); return }
  const { jsPDF } = window.jspdf
  const b = fromExp ? parseInt(document.getElementById('exp-bulan').value) : activeBulan
  const t = fromExp ? parseInt(document.getElementById('exp-tahun').value) : activeTahun
  const list = cachePengeluaran.filter(p => p.tgl.startsWith(`${t}-${String(b).padStart(2,'0')}`))
  const lbl = labelBulan(b, t)
  const total = list.reduce((s,p) => s+num(p.total), 0)
  const tglCetak = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})

  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  doc.setFillColor(180,30,30); doc.rect(0,0,210,10,'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor(255,255,255)
  doc.text(NAMA_TOKO, 105, 7, {align:'center'})
  doc.setFillColor(255,248,248); doc.rect(0,10,210,16,'F')
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(60,60,60)
  doc.text(ALAMAT_TOKO, 105, 16, {align:'center'})
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(180,30,30)
  doc.text('LAPORAN PENGELUARAN OPERASIONAL', 105, 22, {align:'center'})
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(100,100,100)
  doc.text(`Periode: ${lbl}`, 15, 29)
  doc.text(`Dicetak: ${tglCetak}`, 195, 29, {align:'right'})
  doc.setDrawColor(180,30,30); doc.setLineWidth(0.6); doc.line(15,31,195,31)

  const HARI_S = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']
  doc.autoTable({
    head:[['Tanggal','Keterangan','Total (Rp)']],
    body: list.map(p => {
      const d = new Date(p.tgl+'T00:00:00')
      return [`${HARI_S[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}`, p.keterangan, Math.round(p.total).toLocaleString('id-ID')]
    }),
    foot:[['','TOTAL PENGELUARAN', Math.round(total).toLocaleString('id-ID')]],
    startY:34, margin:{left:15,right:15},
    styles:{fontSize:9,cellPadding:2.5},
    headStyles:{fillColor:[180,30,30],textColor:255,fontStyle:'bold'},
    footStyles:{fillColor:[255,230,225],textColor:[150,0,0],fontStyle:'bold'},
    columnStyles:{0:{cellWidth:25},1:{halign:'left'},2:{halign:'right',fontStyle:'bold',textColor:[180,30,30]}},
    alternateRowStyles:{fillColor:[255,248,248]}
  })

  const ttdY = Math.min(doc.lastAutoTable.finalY+14, 248)
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60)
  doc.text(`Sumberkembang, ${tglCetak}`, 140, ttdY)
  doc.text('Pengelola,', 140, ttdY+5)
  doc.line(138, ttdY+24, 192, ttdY+24)
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5)
  doc.text('( ................................ )', 165, ttdY+29, {align:'center'})
  doc.setFontSize(7.5); doc.setFont('helvetica','italic'); doc.setTextColor(150,150,150)
  doc.text(`${NAMA_TOKO}  ·  Aplikasi Keuangan Kantin Web`, 105, 290, {align:'center'})

  doc.save(`pengeluaran_${t}_${String(b).padStart(2,'0')}.pdf`)
  showToast('✓ PDF berhasil diunduh')
}

// ─── CETAK ───────────────────────────────────────────────────
window.cetakHarian = function(fromExp) {
  const b = fromExp ? parseInt(document.getElementById('exp-bulan').value) : activeBulan
  const t = fromExp ? parseInt(document.getElementById('exp-tahun').value) : activeTahun
  const days = getHarianBulan(b, t)
  let tP1=0,tP2=0,tT1=0,tT2=0,tT3=0,tTab=0,tTotal=0
  const rows = days.map(({tgl,row}) => {
    if (isLibur(tgl)) return `<tr><td>${labelTgl(tgl)}</td><td colspan="7" style="text-align:center;color:#b45309">— ${row?.libur_ket||'LIBUR'} —</td></tr>`
    if (!row) return `<tr><td>${labelTgl(tgl)}</td><td colspan="7" style="text-align:center;color:#6b7280">—</td></tr>`
    const total = hitungTotal(row)
    tP1+=num(row.pendapatan1); tP2+=num(row.pendapatan2)
    tT1+=num(row.titipan1); tT2+=num(row.titipan2); tT3+=num(row.titipan3)
    tTab+=num(row.tabungan); tTotal+=total
    return `<tr><td>${labelTgl(tgl)}</td><td>${fmt(row.pendapatan1||0)}</td><td>${fmt(row.pendapatan2||0)}</td><td>${fmt(row.titipan1||0)}</td><td>${fmt(row.titipan2||0)}</td><td>${fmt(row.titipan3||0)}</td><td>${fmt(row.tabungan||0)}</td><td style="font-weight:700">${fmt(total)}</td></tr>`
  }).join('')

  const win = window.open('','_blank')
  win.document.write(`<!DOCTYPE html><html><head><title>Laporan Harian — ${labelBulan(b,t)}</title>
    <style>body{font-family:Arial;font-size:12px;margin:20px}table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #999;padding:5px 8px;text-align:right}th{background:#005b96;color:#fff}
    td:first-child{text-align:left}h2,h3{text-align:center;margin:5px 0}
    tfoot td{background:#dbeafe;font-weight:700}</style></head>
    <body><h2>${NAMA_TOKO}</h2><h3>Laporan Harian — ${labelBulan(b,t)}</h3>
    <table><thead><tr><th>Tanggal</th><th>Pend. I</th><th>Pend. II</th><th>Tip. I</th><th>Tip. II</th><th>Tip. III</th><th>Tabungan</th><th>TOTAL</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td>TOTAL</td><td>${fmt(tP1)}</td><td>${fmt(tP2)}</td><td>${fmt(tT1)}</td><td>${fmt(tT2)}</td><td>${fmt(tT3)}</td><td>${fmt(tTab)}</td><td>${fmt(tTotal)}</td></tr></tfoot>
    </table></body></html>`)
  win.document.close(); win.print()
}

// ─── KUNCI PERIODE ───────────────────────────────────────────
function showModalUnlock(tgl, callback) {
  const d = new Date(tgl+'T00:00:00')
  const periodeInfo = `${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`
  openModal('🔒 Periode Terkunci', `
    <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:13px 15px;margin-bottom:16px;font-size:13px;line-height:1.6;">
      ⚠️ Data periode <b>${periodeInfo}</b> dikunci.<br>
      Data bulan lalu diproteksi untuk mencegah perubahan tidak sah.<br>
      Masukkan <b>password</b> untuk membuka kunci sementara.
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label>Password</label>
      <input type="password" id="m-unlock-pass" placeholder="Masukkan password..."/>
    </div>
    <div id="unlock-alert" style="display:none;background:rgba(220,38,38,0.15);color:#f87171;border:1px solid rgba(220,38,38,0.3);border-radius:7px;padding:9px 13px;margin-bottom:12px;font-size:13px;"></div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="doUnlock()">🔓 Buka Kunci</button>
    </div>`)
  setTimeout(() => document.getElementById('m-unlock-pass')?.focus(), 100)
  window._unlockCallback = callback
}

window.doUnlock = async function() {
  const pass = document.getElementById('m-unlock-pass')?.value
  const alertEl = document.getElementById('unlock-alert')
  if (!pass) { alertEl.textContent = '❌ Masukkan password terlebih dahulu.'; alertEl.style.display = 'block'; return }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: currentUser.email, password: pass })
    if (!error && data.user) {
      sessionUnlocked = true
      closeModal()
      const cb = window._unlockCallback; window._unlockCallback = null
      if (cb) cb()
      showToast('🔓 Periode berhasil dibuka untuk sesi ini')
    } else {
      alertEl.textContent = '❌ Password salah. Coba lagi.'; alertEl.style.display = 'block'
      document.getElementById('m-unlock-pass').value = ''
    }
  } catch(e) { alertEl.textContent = '❌ Gagal verifikasi.'; alertEl.style.display = 'block' }
}

window.kunciUlang = function() {
  sessionUnlocked = false
  updateLockBadge()
  showToast('🔒 Kunci periode diaktifkan kembali')
}

function updateLockBadge() {
  const badge = document.getElementById('lock-badge')
  if (!badge) return
  if (sessionUnlocked) {
    badge.textContent = '🔓 Terbuka'
    badge.style.background = 'rgba(74,222,128,0.2)'
    badge.style.color = '#4ade80'
    badge.style.borderColor = 'rgba(74,222,128,0.4)'
  } else {
    badge.textContent = '🔒 Terkunci'
    badge.style.background = 'rgba(245,158,11,0.15)'
    badge.style.color = '#fbbf24'
    badge.style.borderColor = 'rgba(245,158,11,0.3)'
  }
}
setInterval(updateLockBadge, 2000)

// ─── GANTI PASSWORD ──────────────────────────────────────────
window.showModalGantiPass = async function() {
  openModal('🔑 Ganti Password', `
    <div class="form-group" style="margin-bottom:12px;">
      <label>Password Lama</label>
      <input type="password" id="m-pass-lama" placeholder="Password saat ini"/>
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label>Password Baru</label>
      <input type="password" id="m-pass-baru" placeholder="Minimal 6 karakter"/>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label>Konfirmasi Password Baru</label>
      <input type="password" id="m-pass-konfirm" placeholder="Ulangi password baru"/>
    </div>
    <div id="pass-alert" style="display:none;background:rgba(220,38,38,0.15);color:#f87171;border-radius:7px;padding:9px 13px;margin-bottom:12px;font-size:13px;"></div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="gantiPassword()">🔑 Ubah Password</button>
    </div>`)
}

window.gantiPassword = async function() {
  const lama = document.getElementById('m-pass-lama')?.value
  const baru = document.getElementById('m-pass-baru')?.value
  const konfirm = document.getElementById('m-pass-konfirm')?.value
  const alertEl = document.getElementById('pass-alert')
  if (!lama || !baru) { alertEl.textContent = 'Isi semua field'; alertEl.style.display = 'block'; return }
  if (baru.length < 6) { alertEl.textContent = 'Password baru minimal 6 karakter'; alertEl.style.display = 'block'; return }
  if (baru !== konfirm) { alertEl.textContent = 'Konfirmasi password tidak cocok'; alertEl.style.display = 'block'; return }
  try {
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: currentUser.email, password: lama })
    if (verifyError) { alertEl.textContent = '❌ Password lama salah'; alertEl.style.display = 'block'; return }
    const { error } = await supabase.auth.updateUser({ password: baru })
    if (error) throw error
    closeModal()
    showToast('✓ Password berhasil diubah')
  } catch(e) { alertEl.textContent = '❌ Gagal: ' + e.message; alertEl.style.display = 'block' }
}

// ─── TAMBAH DATA CEPAT (dari beranda) ───────────────────────
window.showModalTambah = function() {
  const today = new Date().toISOString().slice(0,10)
  openModal('➕ Tambah Data Hari Ini', `
    <p style="color:#94a3b8;font-size:13px;margin-bottom:16px;">Tanggal: <b>${labelTgl(today)}</b></p>
    <div class="form-grid">
      <div class="form-group"><label>Pendapatan I (Rp)</label><input type="number" id="m-q-p1" value="0" min="0"/></div>
      <div class="form-group"><label>Pendapatan II (Rp)</label><input type="number" id="m-q-p2" value="0" min="0"/></div>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Titipan I (Rp)</label><input type="number" id="m-q-t1" value="0" min="0"/></div>
      <div class="form-group"><label>Titipan II (Rp)</label><input type="number" id="m-q-t2" value="0" min="0"/></div>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Titipan III (Rp)</label><input type="number" id="m-q-t3" value="0" min="0"/></div>
      <div class="form-group"><label>Tabungan (Rp)</label><input type="number" id="m-q-tab" value="0" min="0"/></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanCepat('${today}')">💾 Simpan</button>
    </div>`)
}

window.simpanCepat = async function(tgl) {
  const row = {
    tgl,
    is_libur: false,
    pendapatan1: num(document.getElementById('m-q-p1')?.value),
    pendapatan2: num(document.getElementById('m-q-p2')?.value),
    titipan1: num(document.getElementById('m-q-t1')?.value),
    titipan2: num(document.getElementById('m-q-t2')?.value),
    titipan3: num(document.getElementById('m-q-t3')?.value),
    tabungan: num(document.getElementById('m-q-tab')?.value),
  }
  try {
    await upsertHarian(row)
    await loadHarian()
    closeModal()
    showToast('✓ Data hari ini berhasil disimpan')
  } catch(e) { showToast('Gagal: ' + e.message, 'error') }
}

// ─── PERIOD SELECTOR ─────────────────────────────────────────
function isiSel() {
  const tahunNow = new Date().getFullYear()
  ;[['sel-bulan','sel-tahun'], ['exp-bulan','exp-tahun']].forEach(([sbId, stId]) => {
    const sb = document.getElementById(sbId), st = document.getElementById(stId)
    if (!sb || !st) return
    sb.innerHTML = BULAN_ID.map((nm, i) => `<option value="${i+1}" ${i+1===activeBulan?'selected':''}>${nm}</option>`).join('')
    st.innerHTML = [tahunNow-2,tahunNow-1,tahunNow,tahunNow+1].map(y => `<option value="${y}" ${y===activeTahun?'selected':''}>${y}</option>`).join('')
  })
}

window.onBulanChange = function() {
  const sb = document.getElementById('sel-bulan'), st = document.getElementById('sel-tahun')
  if (!sb || !st) return
  activeBulan = parseInt(sb.value); activeTahun = parseInt(st.value)
  const eb = document.getElementById('exp-bulan'), et = document.getElementById('exp-tahun')
  if (eb) eb.value = activeBulan; if (et) et.value = activeTahun
  // Re-render current tab
  const aktif = document.querySelector('.tab-section.active')
  if (aktif) {
    const tabId = aktif.id.replace('tab-','')
    if (tabId !== 'home') showTab(tabId)
  }
}

// ─── CLOCK ───────────────────────────────────────────────────
let clockInterval = null
function startClock() {
  if (clockInterval) clearInterval(clockInterval)
  function tick() {
    const now = new Date()
    const el = document.getElementById('home-clock')
    const el2 = document.getElementById('home-date')
    if (el) el.textContent = now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
    if (el2) el2.textContent = now.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
  }
  tick(); clockInterval = setInterval(tick, 1000)
}

// ─── LOGOUT ──────────────────────────────────────────────────
window.doLogout = async function() {
  if (!confirm('Keluar dari aplikasi?')) return
  await signOut()
  renderLogin()
}

// ─── MOTIVASI / GREETING ─────────────────────────────────────
const MOTIVASI = [
  '"Kerja keras adalah doa yang paling nyata." 💪',
  '"Setiap hari adalah kesempatan baru untuk menjadi lebih baik." ✨',
  '"Mulailah dengan niat yang baik, jalankan dengan penuh semangat." 🌅',
  '"Sukses bukan tentang siapa yang paling cepat, tapi siapa yang paling gigih." 🏆',
  '"Rezeki yang baik datang dari usaha yang sungguh-sungguh." 🌿',
  '"Jangan hitung lelahnya, hitung berkahnya." 🤲',
  '"Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lainnya." 🌟',
]
const GREETING_DAY = ['Selamat Minggu','Selamat Senin','Selamat Selasa','Selamat Rabu','Selamat Kamis','Selamat Jumat','Selamat Sabtu']
const GREETING_SUB = ['Waktunya Istirahat 😌','Semangat Memulai Pekan! 💪','Terus Melaju! 🚀','Di Tengah Pekan, Tetap Semangat! ⚡','Hampir Akhir Pekan! 🎯','Alhamdulillah, Pekan Hampir Selesai 🤲','Selamat Beristirahat! 🌙']

function renderHome() {
  const now = new Date()
  const hariIdx = now.getDay()
  const mot = document.getElementById('home-motivasi')
  const greet = document.getElementById('home-greeting')
  const greetSub = document.getElementById('home-greeting-sub')
  if (mot) mot.textContent = MOTIVASI[Math.floor(Math.random() * MOTIVASI.length)]
  if (greet) greet.textContent = GREETING_DAY[hariIdx] + '! 👋'
  if (greetSub) greetSub.textContent = GREETING_SUB[hariIdx]
  startClock()
}

// ─── MAIN RENDER ────────────────────────────────────────────
function renderLogin() {
  const app = document.getElementById('app')
  app.innerHTML = `
  <div class="login-page">
    <div class="login-bg-shape login-bg-1"></div>
    <div class="login-bg-shape login-bg-2"></div>
    <div class="login-card">
      <div class="login-logo-wrap">
        <div class="login-logo-icon">🍽️</div>
        <h1 class="login-title">${NAMA_TOKO}</h1>
        <p class="login-subtitle">Sistem Laporan Keuangan</p>
      </div>
      <div class="login-form">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="login-email" placeholder="admin@kantinputra.com" autocomplete="username"
                 onkeydown="if(event.key==='Enter')document.getElementById('login-pass').focus()"/>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="login-pass" placeholder="••••••••" autocomplete="current-password"
                 onkeydown="if(event.key==='Enter')doLogin()"/>
        </div>
        <div id="login-alert" style="display:none;background:rgba(220,38,38,0.15);color:#f87171;border:1px solid rgba(220,38,38,0.3);border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:12px;"></div>
        <button class="btn btn-primary btn-block" id="login-btn" onclick="doLogin()">
          <span id="login-btn-text">🔐 Masuk</span>
        </button>
      </div>
      <div class="login-footer">
        <p>Kantin Putra • Sumberkembang, Banyuwangi</p>
        <p style="font-size:11px;margin-top:4px;opacity:0.5">Dibuat dengan ❤️ — Web Version</p>
      </div>
    </div>
  </div>`

  setTimeout(() => document.getElementById('login-email')?.focus(), 100)
}

window.doLogin = async function() {
  const email = document.getElementById('login-email')?.value.trim()
  const pass  = document.getElementById('login-pass')?.value
  const btn   = document.getElementById('login-btn')
  const btnTxt= document.getElementById('login-btn-text')
  const alertEl = document.getElementById('login-alert')
  alertEl.style.display = 'none'
  if (!email || !pass) { alertEl.textContent = 'Isi email dan password'; alertEl.style.display = 'block'; return }
  btn.disabled = true; btnTxt.textContent = '⏳ Memproses...'
  try {
    const { data } = await signIn(email, pass)
    currentUser = data.user
    renderMainApp()
  } catch(e) {
    alertEl.textContent = '❌ Email atau password salah.'
    alertEl.style.display = 'block'
    btn.disabled = false; btnTxt.textContent = '🔐 Masuk'
  }
}

function renderMainApp() {
  const app = document.getElementById('app')
  app.innerHTML = `
  <!-- LOADING OVERLAY -->
  <div id="loading-overlay" class="loading-overlay" style="display:none">
    <div class="loading-spinner"></div>
  </div>
  <!-- TOAST -->
  <div id="toast" class="toast"></div>

  <div class="app">
    <div class="main" id="main-area">
      <header class="topbar">
        <div class="topbar-left">
          <button class="btn-home-back" onclick="goHome()">🏠 Beranda</button>
          <div class="topbar-title" id="topbar-title">Beranda</div>
        </div>
        <div class="topbar-actions">
          <select id="sel-bulan" class="sel-period" onchange="onBulanChange()"></select>
          <select id="sel-tahun" class="sel-period" onchange="onBulanChange()"></select>
          <div class="lock-badge" id="lock-badge" title="Status Kunci Periode" onclick="kunciUlang()" style="cursor:pointer;">🔒 Terkunci</div>
          <button class="btn btn-outline btn-sm" onclick="showModalGantiPass()" title="Ganti Password">🔑</button>
          <button class="btn btn-logout btn-sm" onclick="doLogout()">⏻ Keluar</button>
        </div>
      </header>

      <main class="content">

        <!-- ══ HOME ══ -->
        <section class="tab-section active" id="tab-home">
          <div class="home-wrap">
            <div class="home-logo-area">
              <div class="home-logo-icon">🍽️</div>
            </div>
            <div class="home-greeting-area">
              <div class="home-greeting" id="home-greeting">Selamat Datang! 👋</div>
              <div class="home-greeting-sub" id="home-greeting-sub">Sistem Laporan Keuangan Kantin Putra</div>
            </div>
            <div class="home-motivasi-wrap">
              <div class="home-motivasi" id="home-motivasi">"Kerja keras adalah doa yang paling nyata." 💪</div>
            </div>
            <div class="home-datetime-wrap">
              <div class="home-clock" id="home-clock">00:00:00</div>
              <div class="home-date" id="home-date">...</div>
              <div class="home-location">📍 Sumberkembang, Banyuwangi</div>
            </div>
            <div class="home-bubbles">
              <button class="bubble-btn" onclick="bubbleNav('harian')"><span class="bubble-icon">📅</span><span class="bubble-label">Laporan Harian</span></button>
              <button class="bubble-btn" onclick="bubbleNav('pengeluaran')"><span class="bubble-icon">💸</span><span class="bubble-label">Pengeluaran</span></button>
              <button class="bubble-btn" onclick="bubbleNav('tabungan')"><span class="bubble-icon">💰</span><span class="bubble-label">Tabungan</span></button>
              <button class="bubble-btn bubble-accent" onclick="showModalTambah()"><span class="bubble-icon">➕</span><span class="bubble-label">Tambah Data</span></button>
              <button class="bubble-btn" onclick="bubbleNav('dashboard')"><span class="bubble-icon">📊</span><span class="bubble-label">Dashboard</span></button>
              <button class="bubble-btn" onclick="bubbleNav('dashboard-kompleks')"><span class="bubble-icon">📈</span><span class="bubble-label">Analisis</span></button>
              <button class="bubble-btn" onclick="bubbleNav('pemasok')"><span class="bubble-icon">🤝</span><span class="bubble-label">Pemasok</span></button>
              <button class="bubble-btn" onclick="bubbleNav('titipan')"><span class="bubble-icon">🍱</span><span class="bubble-label">Titipan</span></button>
              <button class="bubble-btn" onclick="bubbleNav('piutang')"><span class="bubble-icon">📝</span><span class="bubble-label">Piutang</span></button>
              <button class="bubble-btn" onclick="bubbleNav('ekspor')"><span class="bubble-icon">📂</span><span class="bubble-label">Cetak & Ekspor</span></button>
            </div>
            <div class="home-hadist">
              <span>🌿</span> "Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lainnya"
            </div>
          </div>
        </section>

        <!-- ══ LAPORAN HARIAN ══ -->
        <section class="tab-section" id="tab-harian">
          <div class="card card-table">
            <div class="tbl-toolbar">
              <span class="card-title" id="judul-harian">Laporan Harian</span>
              <div class="toolbar-btns">
                <button class="btn btn-outline btn-sm" onclick="cetakHarian(false)">🖨️ Cetak</button>
                <button class="btn btn-outline btn-sm" onclick="eksporHarianCSV(false)">📊 CSV</button>
                <button class="btn btn-outline btn-sm" onclick="eksporPDF_Harian(false)" style="color:#f87171;border-color:#f87171">📄 PDF</button>
              </div>
            </div>
            <div class="tbl-scroll">
              <table class="tbl-main">
                <thead><tr>
                  <th class="th-tgl">Tanggal</th>
                  <th class="th-num">Pendapatan I</th>
                  <th class="th-num">Pendapatan II</th>
                  <th class="th-num">Titipan I</th>
                  <th class="th-num">Titipan II</th>
                  <th class="th-num">Titipan III</th>
                  <th class="th-num">Tabungan</th>
                  <th class="th-num th-total">TOTAL</th>
                  <th class="th-act"></th>
                </tr></thead>
                <tbody id="tbody-harian"></tbody>
                <tfoot id="tfoot-harian"></tfoot>
              </table>
            </div>
          </div>
        </section>

        <!-- ══ PENGELUARAN ══ -->
        <section class="tab-section" id="tab-pengeluaran">
          <div class="card card-table">
            <div class="tbl-toolbar">
              <span class="card-title" id="judul-pengeluaran">Pengeluaran</span>
              <button class="btn btn-primary btn-sm" onclick="showModalTambahPengeluaran()">+ Tambah</button>
            </div>
            <div class="tbl-scroll">
              <table class="tbl-main">
                <thead><tr>
                  <th class="th-tgl">Tanggal</th>
                  <th style="text-align:left">Keterangan</th>
                  <th class="th-num">Total</th>
                  <th class="th-act"></th>
                </tr></thead>
                <tbody id="tbody-pengeluaran"></tbody>
                <tfoot id="tfoot-pengeluaran"></tfoot>
              </table>
            </div>
          </div>
        </section>

        <!-- ══ TABUNGAN ══ -->
        <section class="tab-section" id="tab-tabungan">
          <div class="grid-3" style="margin-bottom:20px;">
            <div class="metric">
              <div class="metric-label">💰 Saldo Tabungan</div>
              <div class="metric-value c-green" id="tab-saldo-val">Rp0</div>
            </div>
            <div class="metric">
              <div class="metric-label">💸 Total Penarikan</div>
              <div class="metric-value c-red" id="tab-tarik-val">Rp0</div>
            </div>
            <div class="metric">
              <button class="btn btn-primary" onclick="showModalPenarikan()" style="width:100%;margin-top:8px;">💸 Tarik Tabungan</button>
            </div>
          </div>
          <div class="grid-2" style="margin-bottom:20px;">
            <div class="card">
              <div class="card-title" style="margin-bottom:12px;">📅 Setoran per Bulan</div>
              <div id="tabungan-rekap"></div>
            </div>
            <div class="card">
              <div class="card-title" style="margin-bottom:12px;">💸 Riwayat Penarikan</div>
              <div id="penarikan-list"></div>
            </div>
          </div>
          <div class="card card-table">
            <div class="tbl-toolbar">
              <span class="card-title" id="tab-detail-judul">Detail Tabungan</span>
            </div>
            <div class="tbl-scroll">
              <table class="tbl-main">
                <thead><tr>
                  <th class="th-tgl">Tanggal</th>
                  <th style="text-align:left">Hari</th>
                  <th style="text-align:left">Keterangan</th>
                  <th class="th-num">Debit/Kredit</th>
                  <th class="th-num th-total">Saldo</th>
                </tr></thead>
                <tbody id="tbody-tabungan"></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- ══ DASHBOARD ══ -->
        <section class="tab-section" id="tab-dashboard">
          <div class="grid-4" id="metric-cards" style="margin-bottom:20px;"></div>
          <div class="grid-2" style="margin-bottom:20px;">
            <div class="card">
              <div class="tbl-toolbar" style="margin-bottom:12px;">
                <span class="card-title">📊 Grafik Harian</span>
                <select id="dash-chart-type" class="sel-period" style="font-size:12px;" onchange="changeDashChartType()">
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                </select>
              </div>
              <div style="height:220px"><canvas id="dashChart"></canvas></div>
            </div>
            <div class="card">
              <div class="card-title" style="margin-bottom:12px;">⚖️ Pendapatan vs Pengeluaran</div>
              <div style="height:220px"><canvas id="dashChart2"></canvas></div>
            </div>
          </div>
          <div class="grid-2">
            <div class="card">
              <div class="card-title" style="margin-bottom:12px;">💰 Statistik Pendapatan</div>
              <div id="rata-pendapatan"></div>
            </div>
            <div class="card">
              <div class="card-title" style="margin-bottom:12px;">📤 Statistik Pengeluaran</div>
              <div id="rata-pengeluaran"></div>
            </div>
          </div>
        </section>

        <!-- ══ ANALISIS KEUANGAN ══ -->
        <section class="tab-section" id="tab-dashboard-kompleks">
          <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
            <button class="btn btn-period" id="p-6" onclick="setPeriod(6)">6 Bulan</button>
            <button class="btn btn-period active-period" id="p-12" onclick="setPeriod(12)">12 Bulan</button>
            <button class="btn btn-period" id="p-24" onclick="setPeriod(24)">24 Bulan</button>
          </div>
          <div class="grid-2" style="margin-bottom:20px;">
            <div class="card">
              <div class="card-title" style="margin-bottom:12px;">📊 Pendapatan & Pengeluaran</div>
              <div style="height:220px"><canvas id="kompChart1"></canvas></div>
            </div>
            <div class="card">
              <div class="card-title" style="margin-bottom:12px;">💰 Tren Tabungan</div>
              <div style="height:220px"><canvas id="kompChart2"></canvas></div>
            </div>
          </div>
          <div class="card card-table">
            <div class="tbl-toolbar">
              <span class="card-title">📋 Rekap per Bulan</span>
            </div>
            <div class="tbl-scroll">
              <table class="tbl-main">
                <thead><tr>
                  <th style="text-align:left">Bulan</th>
                  <th class="th-num">Pend. Harian</th>
                  <th class="th-num">Laba Titipan</th>
                  <th class="th-num">Pengeluaran</th>
                  <th class="th-num">Tab. Aktif</th>
                  <th class="th-num th-total">Laba Bersih</th>
                </tr></thead>
                <tbody id="tbody-komp"></tbody>
                <tfoot id="tfoot-komp"></tfoot>
              </table>
            </div>
          </div>
        </section>

        <!-- ══ PEMASOK ══ -->
        <section class="tab-section" id="tab-pemasok">
          <div class="card card-table">
            <div class="tbl-toolbar">
              <span class="card-title">🤝 Daftar Pemasok / Supplier</span>
              <button class="btn btn-primary btn-sm" onclick="showModalTambahPemasok()">+ Tambah Pemasok</button>
            </div>
            <div class="tbl-scroll">
              <table class="tbl-main">
                <thead><tr>
                  <th style="text-align:left;padding-left:12px">Nama Pemasok</th>
                  <th style="text-align:left">Kontak</th>
                  <th style="text-align:left">Keterangan</th>
                  <th class="th-act"></th>
                </tr></thead>
                <tbody id="tbody-pemasok"></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- ══ TITIPAN ══ -->
        <section class="tab-section" id="tab-titipan">
          <div class="grid-4" style="margin-bottom:20px;">
            <div class="metric"><div class="metric-label">📦 Total Barang</div><div class="metric-value" id="tit-total-barang">0</div></div>
            <div class="metric"><div class="metric-label">💰 Est. Keuntungan</div><div class="metric-value c-green" id="tit-estimasi-untung">Rp0</div></div>
            <div class="metric"><div class="metric-label">🤝 Jml Pemasok</div><div class="metric-value c-blue" id="tit-jml-pemasok">0</div></div>
            <div class="metric"><div class="metric-label">📉 Total Terjual</div><div class="metric-value c-orange" id="tit-terjual">0</div></div>
          </div>
          <div class="card card-table">
            <div class="tbl-toolbar">
              <span class="card-title">🍱 Manajemen Barang Titipan (Konsinyasi)</span>
              <button class="btn btn-primary btn-sm" onclick="showModalTambahTitipan()">+ Tambah Barang</button>
            </div>
            <div class="tbl-scroll">
              <table class="tbl-main">
                <thead><tr>
                  <th style="text-align:left;padding-left:12px">Nama Barang</th>
                  <th style="text-align:left">Pemasok</th>
                  <th class="th-num">Harga Pokok</th>
                  <th class="th-num">Harga Jual</th>
                  <th class="th-num">Stok</th>
                  <th class="th-num">Terjual</th>
                  <th class="th-num th-total">Laba</th>
                  <th class="th-act"></th>
                </tr></thead>
                <tbody id="tbody-titipan"></tbody>
                <tfoot id="tfoot-titipan"></tfoot>
              </table>
            </div>
          </div>
        </section>

        <!-- ══ PIUTANG ══ -->
        <section class="tab-section" id="tab-piutang">
          <div class="grid-2" style="margin-bottom:20px;">
            <div class="card text-center">
              <div class="metric-label">💳 Total Piutang Belum Lunas</div>
              <div class="metric-value c-red" id="piu-total-belumlunas">Rp0</div>
            </div>
            <div class="card text-center">
              <div class="metric-label">✅ Total Piutang Lunas (Bulan Ini)</div>
              <div class="metric-value c-green" id="piu-total-lunas">Rp0</div>
            </div>
          </div>
          <div class="card card-table">
            <div class="tbl-toolbar">
              <span class="card-title">📝 Catatan Piutang (Bon)</span>
              <button class="btn btn-primary btn-sm" onclick="showModalTambahPiutang()">+ Tambah Piutang</button>
            </div>
            <div class="tbl-scroll">
              <table class="tbl-main">
                <thead><tr>
                  <th class="th-tgl">Tanggal</th>
                  <th style="text-align:left;padding-left:12px">Nama</th>
                  <th style="text-align:left">Keterangan</th>
                  <th class="th-num">Jumlah</th>
                  <th style="text-align:center">Status</th>
                  <th class="th-act"></th>
                </tr></thead>
                <tbody id="tbody-piutang"></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- ══ EKSPOR ══ -->
        <section class="tab-section" id="tab-ekspor">
          <div class="card" style="margin-bottom:16px;">
            <div class="tbl-toolbar" style="margin-bottom:12px;"><span class="card-title">📅 Pilih Periode</span></div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <select id="exp-bulan" class="sel-period"></select>
              <select id="exp-tahun" class="sel-period"></select>
            </div>
          </div>
          <div class="grid-2" style="margin-bottom:16px;">
            <div class="card cetak-card">
              <div class="cetak-icon-wrap" style="background:rgba(96,165,250,0.15);color:#60a5fa">📋</div>
              <div class="cetak-judul">Laporan Pendapatan</div>
              <div class="cetak-sub">Rincian harian pendapatan, titipan, tabungan & total bersih</div>
              <div class="cetak-btns">
                <button class="btn btn-cetak-p" onclick="cetakHarian(true)">🖨️ Cetak</button>
                <button class="btn btn-ekspor" onclick="eksporHarianCSV(true)">📊 CSV</button>
                <button class="btn btn-ekspor" onclick="eksporPDF_Harian(true)" style="background:#dc2626">📄 PDF</button>
              </div>
            </div>
            <div class="card cetak-card">
              <div class="cetak-icon-wrap" style="background:rgba(248,113,113,0.15);color:#f87171">📤</div>
              <div class="cetak-judul">Laporan Pengeluaran</div>
              <div class="cetak-sub">Daftar pengeluaran operasional per tanggal dan keterangan</div>
              <div class="cetak-btns">
                <button class="btn btn-cetak-k" onclick="window.location='#'" style="background:#dc2626">🖨️ Cetak</button>
                <button class="btn btn-ekspor" onclick="eksporPengeluaranCSV(true)">📊 CSV</button>
                <button class="btn btn-ekspor" onclick="eksporPDF_Pengeluaran(true)" style="background:#dc2626">📄 PDF</button>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  </div>

  <!-- MODAL -->
  <div class="modal-overlay" id="modal-overlay" onclick="closeModal()" style="display:none"></div>
  <div class="modal" id="modal-wrap" style="display:none">
    <div class="modal-header">
      <span class="modal-title" id="modal-title"></span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" id="modal-body"></div>
  </div>`

  // Fix modal selector
  window.openModal = function(title, body) {
    document.getElementById('modal-title').textContent = title
    document.getElementById('modal-body').innerHTML = body
    document.getElementById('modal-overlay').style.display = 'flex'
    document.getElementById('modal-wrap').style.display = 'block'
  }
  window.closeModal = function() {
    document.getElementById('modal-overlay').style.display = 'none'
    document.getElementById('modal-wrap').style.display = 'none'
  }

  isiSel()
  renderHome()
  updateLockBadge()
}

// ─── ENTRY POINT ─────────────────────────────────────────────
export async function App() {
  const session = await getSession()
  if (session) {
    currentUser = session.user
    renderMainApp()
  } else {
    renderLogin()
  }

  // Auth state listener
  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null
    if (event === 'SIGNED_OUT') renderLogin()
  })
}
