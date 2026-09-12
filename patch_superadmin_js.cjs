const fs = require('fs');
let js = fs.readFileSync('public/superadmin.js', 'utf8');

const newVars = `    const saSystemInfoBox = document.getElementById('saSystemInfoBox');
    const saBtnFactoryReset = document.getElementById('saBtnFactoryReset');
`;

const newFuncs = `
    async function loadSystemInfo() {
        try {
            const res = await authFetch('/api/superadmin/app-info');
            if (res.ok) {
                const data = await res.json();
                if(saSystemInfoBox) {
                    saSystemInfoBox.innerHTML = \`
                        <table style="width:100%; border-collapse:collapse;">
                            <tr><td style="padding:4px 0; color:var(--text-muted); width:150px;">Aplikasi</td><td>: \${data.appName}</td></tr>
                            <tr><td style="padding:4px 0; color:var(--text-muted);">Versi</td><td>: <span style="color:#10b981;">\${data.version}</span></td></tr>
                            <tr><td style="padding:4px 0; color:var(--text-muted);">OS / Arsitektur</td><td>: \${data.platform} / \${data.arch}</td></tr>
                            <tr><td style="padding:4px 0; color:var(--text-muted);">Node.js</td><td>: \${data.nodeVersion}</td></tr>
                            <tr><td style="padding:4px 0; color:var(--text-muted);">Direktori App</td><td>: \${data.appDirectory}</td></tr>
                            <tr><td style="padding:4px 0; color:var(--text-muted);">File Database</td><td>: <span style="color:#eab308;">\${data.databaseFile}</span></td></tr>
                            <tr><td style="padding:4px 0; color:var(--text-muted);">Config MediaMTX</td><td>: \${data.mediaMtxConfig}</td></tr>
                        </table>
                    \`;
                }
            }
        } catch(err) {
            console.error('Gagal memuat info sistem', err);
        }
    }

    if (saBtnFactoryReset) {
        saBtnFactoryReset.addEventListener('click', async () => {
            const conf = confirm('PERINGATAN KRITIS!\\n\\nApakah Anda yakin ingin melakukan Factory Reset?\\nSeluruh pengaturan (User, Kamera, Lisensi) akan kembali ke kondisi awal (default).\\nAnda harus login ulang setelah ini.\\n\\nLanjutkan?');
            if(conf) {
                try {
                    const res = await authFetch('/api/superadmin/factory-reset', { method: 'POST' });
                    if (res.ok) {
                        alert('Sistem berhasil di-reset ke pengaturan pabrik. Silakan login kembali.');
                        localStorage.removeItem('nvr_auth_token');
                        window.location.reload();
                    } else {
                        alert('Gagal melakukan factory reset.');
                    }
                } catch (err) {
                    alert('Terjadi kesalahan saat factory reset.');
                }
            }
        });
    }
`;

js = js.replace("const saAdminTableBody = document.getElementById('saAdminTableBody');", "const saAdminTableBody = document.getElementById('saAdminTableBody');\n" + newVars);
js = js.replace("loadSuperSettings();\n                    loadAdmins();", "loadSuperSettings();\n                    loadAdmins();\n                    loadSystemInfo();");
js = js.replace("loadSuperSettings();\n            loadAdmins();", "loadSuperSettings();\n            loadAdmins();\n            loadSystemInfo();");

// Insert newFuncs before "checkAuth();"
js = js.replace("    checkAuth();\n});", newFuncs + "\n    checkAuth();\n});");

fs.writeFileSync('public/superadmin.js', js);
console.log('Patched superadmin.js');
