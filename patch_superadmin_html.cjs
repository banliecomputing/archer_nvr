const fs = require('fs');
let html = fs.readFileSync('public/superadmin.html', 'utf8');

const newSection = `
        <!-- Informasi Sistem & Reset -->
        <div class="camera-form-section" style="margin-bottom:2rem; border-color:#f43f5e;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
                <div style="flex:1;">
                    <h2 style="font-size:1.25rem; margin:0; display:flex; align-items:center; gap:0.5rem; color:#f43f5e;">
                        <span>ℹ️</span> Informasi Sistem & Basis Data (About)
                    </h2>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
                        Detail versi aplikasi dan lokasi direktori penting NVR pada Armbian STB.
                    </p>
                    <div id="saSystemInfoBox" style="margin-top:1rem; font-size:0.85rem; line-height:1.6; background:rgba(0,0,0,0.2); padding:1rem; border-radius:6px; font-family:monospace; color:#cbd5e1;">
                        Memuat data...
                    </div>
                </div>
                <div style="width:300px; padding-left:1.5rem; border-left:1px solid var(--border);">
                    <h3 style="font-size:1rem; margin-top:0; margin-bottom:0.75rem; color:#ef4444;">🚨 Zona Bahaya</h3>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem;">
                        Tindakan ini akan mengembalikan seluruh pengaturan database (Kamera, Pengguna, Super Settings) kembali ke kondisi standar pabrik (default). Rekaman MP4 di penyimpanan tidak akan dihapus.
                    </p>
                    <button id="saBtnFactoryReset" class="btn btn-primary" style="background:#ef4444; width:100%; font-size:0.85rem;">
                        ⚠️ Reset Pengaturan Pabrik
                    </button>
                </div>
            </div>
        </div>
`;

// Insert it right before the last closing </div> for saDashboard
const target = "    </div>\n    <script src=\"superadmin.js\"></script>";
html = html.replace(target, newSection + target);

fs.writeFileSync('public/superadmin.html', html);
console.log('Patched superadmin.html');
