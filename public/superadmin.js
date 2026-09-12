// superadmin.js - Archer NVR V8.8 Developer Global Console

document.addEventListener('DOMContentLoaded', () => {
    const saAuthOverlay = document.getElementById('saAuthOverlay');
    const saDashboard = document.getElementById('saDashboard');
    const saLoginForm = document.getElementById('saLoginForm');
    const saUsername = document.getElementById('saUsername');
    const saPassword = document.getElementById('saPassword');
    const saLoginError = document.getElementById('saLoginError');
    const saBtnLogout = document.getElementById('saBtnLogout');

    const saLicenseForm = document.getElementById('saLicenseForm');
    const saLicenseKey = document.getElementById('saLicenseKey');
    const saP2pForm = document.getElementById('saP2pForm');
    const saP2pHost = document.getElementById('saP2pHost');

    const btnToggleAddAdmin = document.getElementById('btnToggleAddAdmin');
    const formAddAdminBox = document.getElementById('formAddAdminBox');
    const btnCancelAddAdmin = document.getElementById('btnCancelAddAdmin');
    const saAddAdminForm = document.getElementById('saAddAdminForm');
    const saAdminTableBody = document.getElementById('saAdminTableBody');
    const saSystemInfoBox = document.getElementById('saSystemInfoBox');
    const saBtnFactoryReset = document.getElementById('saBtnFactoryReset');


    // Token Helper
    function getAuthToken() {
        return localStorage.getItem('nvr_auth_token') || '';
    }

    function authFetch(url, options = {}) {
        const opts = { ...options };
        opts.headers = opts.headers ? { ...opts.headers } : {};
        const token = getAuthToken();
        if (token) {
            opts.headers['Authorization'] = `Bearer ${token}`;
        }
        opts.credentials = 'include';
        return fetch(url, opts);
    }

    // Password Peek
    document.querySelectorAll('.btn-peek-pwd').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (!input) return;
            const icon = btn.querySelector('.peek-icon');
            if (input.type === 'password') {
                input.type = 'text';
                if (icon) icon.textContent = '🙈';
            } else {
                input.type = 'password';
                if (icon) icon.textContent = '👁️';
            }
        };
    });

    // Check Current Superadmin Auth
    async function checkAuth() {
        try {
            const res = await authFetch('/api/auth/status');
            const data = await res.json();
            if (data.authenticated && data.role === 'superadmin') {
                saAuthOverlay.style.display = 'none';
                saDashboard.style.display = 'block';
                loadSuperSettings();
                loadAdmins();
            } else {
                saAuthOverlay.style.display = 'flex';
                saDashboard.style.display = 'none';
            }
        } catch (err) {
            saAuthOverlay.style.display = 'flex';
            saDashboard.style.display = 'none';
        }
    }

    // Login Form Submit
    saLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saLoginError.textContent = '';
        const username = saUsername.value.trim();
        const password = saPassword.value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                if (data.token) {
                    localStorage.setItem('nvr_auth_token', data.token);
                    localStorage.setItem('nvr_role', data.role);
                }
                if (data.role === 'superadmin') {
                    saAuthOverlay.style.display = 'none';
                    saDashboard.style.display = 'block';
                    loadSuperSettings();
                    loadAdmins();
                    loadSystemInfo();
                } else {
                    saLoginError.textContent = 'Akun ini bukan role Superadmin. Gunakan admin@archer.nvr!';
                }
            } else {
                saLoginError.textContent = data.error || 'Login Superadmin gagal.';
            }
        } catch (err) {
            saLoginError.textContent = 'Gagal menghubungi server.';
        }
    });

    // Logout
    saBtnLogout.addEventListener('click', async () => {
        try {
            await authFetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {}
        localStorage.removeItem('nvr_auth_token');
        localStorage.removeItem('nvr_role');
        window.location.reload();
    });

    // Toggle Form Add Admin
    btnToggleAddAdmin.addEventListener('click', () => {
        const isHidden = formAddAdminBox.style.display === 'none';
        formAddAdminBox.style.display = isHidden ? 'block' : 'none';
        btnToggleAddAdmin.textContent = isHidden ? '✕ Tutup Form' : '+ Tambah Administrator Baru';
    });

    btnCancelAddAdmin.addEventListener('click', () => {
        formAddAdminBox.style.display = 'none';
        btnToggleAddAdmin.textContent = '+ Tambah Administrator Baru';
        saAddAdminForm.reset();
    });

    // Load Super Settings
    async function loadSuperSettings() {
        try {
            const res = await authFetch('/api/superadmin/settings');
            if (res.ok) {
                const s = await res.json();
                if (saLicenseKey) saLicenseKey.value = s.license || 'ARCHER-PRO-COMMUNITY-2026';
                if (saP2pHost) saP2pHost.value = s.p2p_relay || 'p2p.archer-nvr.net:443';
            }
        } catch (err) {
            console.error('Gagal memuat setting superadmin', err);
        }
    }

    // Save License
    saLicenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const license = saLicenseKey.value.trim();
        try {
            const res = await authFetch('/api/superadmin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ license })
            });
            if (res.ok) {
                alert('Kunci Lisensi Global berhasil disimpan!');
            } else {
                alert('Gagal menyimpan lisensi.');
            }
        } catch (err) {
            alert('Kesalahan koneksi saat menyimpan lisensi.');
        }
    });

    // Save P2P Relay
    saP2pForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const p2p_relay = saP2pHost.value.trim();
        try {
            const res = await authFetch('/api/superadmin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ p2p_relay })
            });
            if (res.ok) {
                alert('Server P2P Relay berhasil diperbarui!');
            } else {
                alert('Gagal memperbarui server P2P.');
            }
        } catch (err) {
            alert('Kesalahan koneksi saat memperbarui P2P.');
        }
    });

    // Load Administrators
    async function loadAdmins() {
        try {
            const res = await authFetch('/api/superadmin/admins');
            if (!res.ok) throw new Error('Gagal mengambil daftar admin');
            const data = await res.json();
            renderAdminTable(data.administrators || []);
        } catch (err) {
            saAdminTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--accent);">Gagal memuat data administrator: ${err.message}</td></tr>`;
        }
    }

    function renderAdminTable(admins) {
        if (!saAdminTableBody) return;
        if (admins.length === 0) {
            saAdminTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">Belum ada administrator yang terdaftar. Klik "+ Tambah Administrator Baru".</td></tr>`;
            return;
        }

        saAdminTableBody.innerHTML = admins.map(admin => {
            const formattedDate = admin.createdAt ? new Date(admin.createdAt).toLocaleString('id-ID') : '-';
            return `
                <tr style="border-bottom:1px solid var(--border); transition:background 0.2s;">
                    <td style="padding:0.75rem 1rem; font-family:monospace; color:var(--text-muted); font-size:0.8rem;">${admin.id}</td>
                    <td style="padding:0.75rem 1rem; font-weight:600; color:#f8fafc;">${admin.name}</td>
                    <td style="padding:0.75rem 1rem; color:#60a5fa; font-family:monospace;">${admin.username}</td>
                    <td style="padding:0.75rem 1rem;"><span class="badge" style="background:#1e293b; color:#93c5fd; padding:3px 8px; border-radius:4px;">📹 ${admin.cameraCount || 0} Kamera</span></td>
                    <td style="padding:0.75rem 1rem;"><span class="badge" style="background:#1e293b; color:#86efac; padding:3px 8px; border-radius:4px;">👤 ${admin.userCount || 0} User</span></td>
                    <td style="padding:0.75rem 1rem; font-size:0.8rem; color:var(--text-muted);">${formattedDate}</td>
                    <td style="padding:0.75rem 1rem; text-align:right;">
                        <button class="btn-sm btn-delete" style="background:#ef4444; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.8rem;" onclick="deleteAdmin('${admin.id}', '${admin.username}')">
                            Hapus
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Add Admin Submit
    saAddAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('newAdminName').value.trim();
        const username = document.getElementById('newAdminUsername').value.trim();
        const password = document.getElementById('newAdminPassword').value;

        if (password.length < 4) {
            alert('Password minimal 4 karakter!');
            return;
        }

        try {
            const res = await authFetch('/api/superadmin/admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, username, password })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                alert(`Administrator '${username}' berhasil didaftarkan!`);
                saAddAdminForm.reset();
                formAddAdminBox.style.display = 'none';
                btnToggleAddAdmin.textContent = '+ Tambah Administrator Baru';
                loadAdmins();
            } else {
                alert(data.error || 'Gagal mendaftarkan administrator.');
            }
        } catch (err) {
            alert('Terjadi kesalahan jaringan.');
        }
    });

    // Delete Admin Global Function
    window.deleteAdmin = async function(id, username) {
        if (!confirm(`Apakah Anda yakin ingin menghapus akun Administrator '${username}'? Semua data terkait akun ini akan terputus.`)) {
            return;
        }

        try {
            const res = await authFetch(`/api/superadmin/admins/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                alert(`Administrator '${username}' berhasil dihapus.`);
                loadAdmins();
            } else {
                alert(data.error || 'Gagal menghapus administrator.');
            }
        } catch (err) {
            alert('Terjadi kesalahan jaringan.');
        }
    };

    // Run Auth Check

    async function loadSystemInfo() {
        try {
            const res = await authFetch('/api/superadmin/app-info');
            if (res.ok) {
                const data = await res.json();
                if(saSystemInfoBox) {
                    saSystemInfoBox.innerHTML = `
                        <table style="width:100%; border-collapse:collapse;">
                            <tr><td style="padding:4px 0; color:var(--text-muted); width:150px;">Aplikasi</td><td>: ${data.appName}</td></tr>
                            <tr><td style="padding:4px 0; color:var(--text-muted);">Versi</td><td>: <span style="color:#10b981;">${data.version}</span></td></tr>
                            <tr><td style="padding:4px 0; color:var(--text-muted);">OS / Arsitektur</td><td>: ${data.platform} / ${data.arch}</td></tr>
                            <tr><td style="padding:4px 0; color:var(--text-muted);">Node.js</td><td>: ${data.nodeVersion}</td></tr>
                            <tr><td style="padding:4px 0; color:var(--text-muted);">Direktori App</td><td>: ${data.appDirectory}</td></tr>
                            <tr><td style="padding:4px 0; color:var(--text-muted);">File Database</td><td>: <span style="color:#eab308;">${data.databaseFile}</span></td></tr>
                            <tr><td style="padding:4px 0; color:var(--text-muted);">Config MediaMTX</td><td>: ${data.mediaMtxConfig}</td></tr>
                        </table>
                    `;
                }
            }
        } catch(err) {
            console.error('Gagal memuat info sistem', err);
        }
    }

    if (saBtnFactoryReset) {
        saBtnFactoryReset.addEventListener('click', async () => {
            const conf = confirm('PERINGATAN KRITIS!\n\nApakah Anda yakin ingin melakukan Factory Reset?\nSeluruh pengaturan (User, Kamera, Lisensi) akan kembali ke kondisi awal (default).\nAnda harus login ulang setelah ini.\n\nLanjutkan?');
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

    checkAuth();
});
