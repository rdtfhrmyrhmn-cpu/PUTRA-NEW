import './styles/main.css'
import { App } from './app.js'
import { ENV_MISSING } from './lib/supabase.js'

// Jika env vars kosong → tampilkan halaman setup, bukan blank putih
if (ENV_MISSING) {
  document.getElementById('app').innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                font-family:system-ui,sans-serif;background:#0f172a;padding:20px;">
      <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
                  border-radius:20px;padding:40px 36px;width:480px;max-width:100%;text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">⚙️</div>
        <h1 style="color:#fff;font-size:20px;font-weight:700;margin-bottom:8px;">Setup Belum Selesai</h1>
        <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin-bottom:24px;">
          Aplikasi tidak bisa terhubung ke database.<br>
          Environment variables Supabase belum dikonfigurasi.
        </p>
        <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:18px;text-align:left;
                    font-family:monospace;font-size:13px;margin-bottom:24px;border:1px solid rgba(255,255,255,0.08);">
          <div style="color:#94a3b8;margin-bottom:10px;"># Wajib diisi di Netlify → Environment variables:</div>
          <div style="color:#34d399;">VITE_SUPABASE_URL<span style="color:#64748b"> = </span><span style="color:#60a5fa">https://xxx.supabase.co</span></div>
          <div style="color:#34d399;margin-top:6px;">VITE_SUPABASE_ANON_KEY<span style="color:#64748b"> = </span><span style="color:#60a5fa">eyJhbGci...</span></div>
        </div>
        <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);
                    border-radius:10px;padding:14px;font-size:13px;color:#fbbf24;line-height:1.6;">
          <strong>Langkah:</strong> Netlify Dashboard → Site → 
          Site configuration → Environment variables → Add variable → 
          Trigger deploy ulang
        </div>
      </div>
    </div>`
} else {
  // Semua env tersedia → jalankan App
  App().catch(err => {
    console.error('App crash:', err)
    document.getElementById('app').innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                  font-family:system-ui,sans-serif;background:#0f172a;padding:20px;">
        <div style="background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.25);
                    border-radius:16px;padding:32px;width:440px;max-width:100%;text-align:center;">
          <div style="font-size:40px;margin-bottom:12px;">❌</div>
          <h2 style="color:#f87171;font-size:18px;margin-bottom:8px;">Koneksi Gagal</h2>
          <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin-bottom:16px;">
            Periksa kembali nilai VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY<br>
            sudah benar di Netlify, lalu deploy ulang.
          </p>
          <div style="background:rgba(0,0,0,0.4);border-radius:8px;padding:12px;
                      font-family:monospace;font-size:12px;color:#f87171;text-align:left;">
            ${err.message || String(err)}
          </div>
          <button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;
                  background:#3b82f6;color:#fff;border:none;border-radius:9px;
                  font-size:13px;font-weight:600;cursor:pointer;">
            🔄 Coba Lagi
          </button>
        </div>
      </div>`
  })
}
