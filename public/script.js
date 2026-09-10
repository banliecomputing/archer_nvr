// script.js - Archer NVR V8.7 Multi-Tenant Controller

document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    let currentUserRole = null;
    let currentUsername = '';
    let cameras = [];
    let currentGridCount = 4;
    let mCurrentGridCount = 1;
    let detectedStorageDevices = [];
    let sysStatsInterval = null;
    let clockInterval = null;
    let hlsPlayers = {};

    // --- References: Auth ---
    const authOverlay = document.getElementById('authOverlay');
    const authForm = document.getElementById('authForm');
    const authUsername = document.getElementById('authUsername');
    const authPassword = document.getElementById('authPassword');
    const authError = document.getElementById('authError');

    // --- References: App Containers ---
    const adminApp = document.getElementById('adminApp');
    const userApp = document.getElementById('userApp');

    // --- References: Admin Elements ---
    const lblAdminName = document.getElementById('lblAdminName');
    const btnLogoutAdmin = document.getElementById('btnLogoutAdmin');
    const videoGrid = document.getElementById('videoGrid');
    const liveClock = document.getElementById('liveClock');
    const btnReloadStreams = document.getElementById('btnReloadStreams');
    const modalCameraList = document.getElementById('modalCameraList');
    const cameraForm = document.getElementById('cameraForm');
    const btnCancelEdit = document.getElementById('btnCancelEdit');
    const btnScrollToForm = document.getElementById('btnScrollToForm');
    const formTitle = document.getElementById('formTitle');
    const globalStorageForm = document.getElementById('globalStorageForm');
    const sysStorageDevice = document.getElementById('sysStorageDevice');
    const btnRefreshStorage = document.getElementById('btnRefreshStorage');
    const storageDevicePreview = document.getElementById('storageDevicePreview');
    const sysCustomStoragePath = document.getElementById('sysCustomStoragePath');
    const sysRecordingQuality = document.getElementById('sysRecordingQuality');
    const systemForm = document.getElementById('systemForm');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const btnRefreshLogs = document.getElementById('btnRefreshLogs');
    const logsContainer = document.getElementById('logsContainer');

    // Admin Users Management Elements
    const btnToggleAddUser = document.getElementById('btnToggleAddUser');
    const boxAddUserForm = document.getElementById('boxAddUserForm');
    const btnCancelAddUser = document.getElementById('btnCancelAddUser');
    const addUserForm = document.getElementById('addUserForm');
    const userTableBody = document.getElementById('userTableBody');

    // Admin Playback Elements
    const selRecCam = document.getElementById('selRecCam');
    const selRecDate = document.getElementById('selRecDate');
    const btnFetchRecordings = document.getElementById('btnFetchRecordings');
    const playbackPlayer = document.getElementById('playbackPlayer');
    const playbackList = document.getElementById('playbackList');
    const pbTitle = document.getElementById('pbTitle');
    const clipCount = document.getElementById('clipCount');

    // --- References: Mobile User Elements ---
    const lblUserMobileName = document.getElementById('lblUserMobileName');
    const btnLogoutUser = document.getElementById('btnLogoutUser');
    const mVideoGrid = document.getElementById('mVideoGrid');
    const btnMRefreshStreams = document.getElementById('btnMRefreshStreams');
    const mSelRecCam = document.getElementById('mSelRecCam');
    const mSelRecDate = document.getElementById('mSelRecDate');
    const mBtnFetchRecordings = document.getElementById('mBtnFetchRecordings');
    const mPlaybackPlayer = document.getElementById('mPlaybackPlayer');
    const mPlaybackList = document.getElementById('mPlaybackList');
    const mCameraCardsList = document.getElementById('mCameraCardsList');
    const mProfileName = document.getElementById('mProfileName');
    const mChangePasswordForm = document.getElementById('mChangePasswordForm');

    // --- Password Peek Handler ---
    function initPasswordPeeks() {
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
    }
    initPasswordPeeks();

    // =========================================================================
    // 1. AUTHENTICATION & ROLE ROUTING
    // =========================================================================
    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/status');
            const data = await res.json();

            if (data.authenticated) {
                currentUserRole = data.role;
                currentUsername = data.username;

                if (currentUserRole === 'superadmin') {
                    // Superadmin dialihkan ke portal khusus superadmin
                    window.location.href = '/superadmin';
                    return;
                }

                authOverlay.style.display = 'none';

                if (currentUserRole === 'administrator') {
                    userApp.style.display = 'none';
                    adminApp.style.display = 'flex';
                    if (lblAdminName) lblAdminName.textContent = currentUsername;
                    initAdminDashboard();
                } else {
                    // Role: User (Mobile Client PWA)
                    adminApp.style.display = 'none';
                    userApp.style.display = 'flex';
                    if (lblUserMobileName) lblUserMobileName.textContent = currentUsername;
                    if (mProfileName) mProfileName.textContent = currentUsername;
                    initMobileUserApp();
                }
            } else {
                authOverlay.style.display = 'flex';
                adminApp.style.display = 'none';
                userApp.style.display = 'none';
            }
        } catch (err) {
            authOverlay.style.display = 'flex';
            adminApp.style.display = 'none';
            userApp.style.display = 'none';
        }
    }

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';
        const username = authUsername.value.trim();
        const password = authPassword.value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                if (data.role === 'superadmin') {
                    window.location.href = '/superadmin';
                } else {
                    checkAuth();
                }
            } else {
                authError.textContent = data.error || 'Username atau password salah.';
            }
        } catch (err) {
            authError.textContent = 'Gagal menghubungi server NVR.';
        }
    });

    async function handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {}
        window.location.reload();
    }

    if (btnLogoutAdmin) btnLogoutAdmin.addEventListener('click', handleLogout);
    if (btnLogoutUser) btnLogoutUser.addEventListener('click', handleLogout);

    // =========================================================================
    // 2. ADMINISTRATOR DASHBOARD LOGIC
    // =========================================================================
    function initAdminDashboard() {
        startLiveClock();
        initNavigation();
        initCameraTabs();
        startSystemMonitoring();
        fetchCameras();
        fetchStorageDevices();
        fetchSystemSettings();
        loadUsersList();

        // Default set date to today
        const today = new Date().toISOString().split('T')[0];
        if (selRecDate) selRecDate.value = today;
    }

    function startLiveClock() {
        if (clockInterval) clearInterval(clockInterval);
        const updateClock = () => {
            const now = new Date();
            if (liveClock) liveClock.textContent = now.toLocaleTimeString('id-ID');
        };
        updateClock();
        clockInterval = setInterval(updateClock, 1000);
    }

    function initNavigation() {
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        const viewPanes = document.querySelectorAll('.view-pane');
        const btnMobileMenu = document.getElementById('btnMobileMenu');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navItems.forEach(n => n.classList.remove('active'));
                viewPanes.forEach(v => v.classList.remove('active'));

                item.classList.add('active');
                const targetId = item.getAttribute('data-target');
                const targetPane = document.getElementById(targetId);
                if (targetPane) targetPane.classList.add('active');

                // Close mobile sidebar if open
                if (sidebar) sidebar.classList.remove('mobile-open');
                if (sidebarOverlay) sidebarOverlay.classList.remove('active');

                if (targetId === 'view-logs') fetchLogs();
                if (targetId === 'view-setting-users') loadUsersList();
                if (targetId === 'view-setting-record') fetchStorageDevices();
            });
        });

        if (btnMobileMenu && sidebar) {
            btnMobileMenu.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
                if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
            });
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                if (sidebar) sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
            });
        }

        // Layout Grid Switcher
        document.querySelectorAll('.grid-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.grid-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = '';
                    b.style.color = '';
                });
                btn.classList.add('active');
                btn.style.background = '#2563eb';
                btn.style.color = 'white';
                currentGridCount = parseInt(btn.getAttribute('data-grid'), 10) || 4;
                renderAdminGrid(currentGridCount);
            });
        });

        if (btnReloadStreams) {
            btnReloadStreams.addEventListener('click', () => {
                fetchCameras();
            });
        }

        if (btnScrollToForm && cameraForm) {
            btnScrollToForm.addEventListener('click', () => {
                resetCameraForm();
                cameraForm.scrollIntoView({ behavior: 'smooth' });
            });
        }
    }

    function initCameraTabs() {
        const ctabBtns = document.querySelectorAll('.ctab-btn');
        const ctabPanes = document.querySelectorAll('.ctab-pane');
        ctabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                ctabBtns.forEach(b => b.classList.remove('active'));
                ctabPanes.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const target = document.getElementById(btn.getAttribute('data-target'));
                if (target) target.classList.add('active');
            });
        });
    }

    // --- Real-time Hardware System Monitor (Armbian STB) ---
    function startSystemMonitoring() {
        if (sysStatsInterval) clearInterval(sysStatsInterval);
        updateHardwareStats();
        sysStatsInterval = setInterval(updateHardwareStats, 3000);
    }

    async function updateHardwareStats() {
        try {
            const res = await fetch('/api/system/stats');
            if (!res.ok) return;
            const data = await res.json();
            if (!data) return;

            // 1. CPU
            const wCpu = document.getElementById('wCpu');
            if (wCpu && data.cpu) {
                wCpu.textContent = `${data.cpu.usagePercent || 0}%`;
                wCpu.style.color = (data.cpu.usagePercent > 85) ? '#ef4444' : '#f8fafc';
            }

            // 2. RAM
            const wRam = document.getElementById('wRam');
            if (wRam && data.ram) {
                const ramPct = data.ram.usagePercent !== undefined ? data.ram.usagePercent : (data.ram.usedPercent || 0);
                wRam.textContent = `${ramPct}%`;
                wRam.style.color = (ramPct > 85) ? '#ef4444' : '#f8fafc';
            }

            // 3. STB Thermal Temperature
            const wTemp = document.getElementById('wTemp');
            if (wTemp && data.temp) {
                const deg = data.temp.celsius || 0;
                wTemp.textContent = `${deg}°C`;
                wTemp.style.color = (deg >= 70) ? '#ef4444' : (deg >= 60 ? '#f59e0b' : '#34d399');
            }

            // 4. Disk Storage
            const wStorage = document.getElementById('wStorage');
            if (wStorage && data.storage) {
                const diskPct = data.storage.percentUsed || 0;
                wStorage.textContent = `${diskPct}%`;
                wStorage.style.color = (diskPct > 90) ? '#ef4444' : '#f8fafc';
            }

            // 5. Network Rx/Tx
            const wNetIf = document.getElementById('wNetIf');
            const wNetDown = document.getElementById('wNetDown');
            const wNetUp = document.getElementById('wNetUp');
            if (data.network) {
                if (wNetIf) wNetIf.textContent = data.network.interface || 'eth0';
                if (wNetDown) wNetDown.textContent = data.network.rxSpeedFormatted || '0 KB/s';
                if (wNetUp) wNetUp.textContent = data.network.txSpeedFormatted || '0 KB/s';
            }
        } catch (err) {
            // silent polling error
        }
    }

    // --- Camera Fetch & Grid Rendering ---
    async function fetchCameras() {
        try {
            const res = await fetch('/api/cameras');
            if (res.status === 401) {
                window.location.reload();
                return;
            }
            const data = await res.json();
            cameras = data.cameras || [];

            renderAdminGrid(currentGridCount);
            renderModalCameraList();
            populateCameraSelects();
        } catch (err) {
            console.error('Gagal memuat kamera:', err);
        }
    }

    function renderAdminGrid(count) {
        if (!videoGrid) return;
        videoGrid.className = `video-grid grid-${count}`;
        destroyHlsPlayers();
        videoGrid.innerHTML = '';

        if (cameras.length === 0) {
            videoGrid.innerHTML = `
                <div class="cam-cell" style="grid-column: 1 / -1; min-height:300px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                    <span style="font-size:2.5rem; margin-bottom:0.75rem;">📹</span>
                    <h3 style="margin:0 0 0.5rem 0;">Belum Ada Kamera Terpasang</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin:0 0 1rem 0;">Tambahkan kamera RTSP pertama Anda untuk memulai live streaming.</p>
                    <button class="btn btn-primary" onclick="document.querySelector('.nav-item[data-target=\\'view-setting-cameras\\']').click()">+ Tambah Kamera Sekarang</button>
                </div>
            `;
            return;
        }

        const displayCams = cameras.slice(0, count);
        displayCams.forEach((cam, idx) => {
            const cell = document.createElement('div');
            cell.className = 'cam-cell';
            cell.id = `cell_${cam.id}`;

            const hlsUrl = `/stream/${cam.mediaMtxPath}/index.m3u8`;
            const videoId = `cam_video_${cam.id}`;

            cell.innerHTML = `
                <video id="${videoId}" class="cam-player-video" autoplay muted playsinline controls></video>
                <div class="cam-overlay">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="cam-title">${cam.name}</span>
                        <span class="badge ${cam.enabled ? 'badge-online' : 'badge-offline'}">${cam.enabled ? 'LIVE' : 'DISABLED'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <span style="font-size:0.7rem; color:#94a3b8; background:rgba(0,0,0,0.6); padding:2px 6px; border-radius:3px; font-family:monospace;">${cam.transcode || 'passthrough'}</span>
                        <button class="btn-sm btn-secondary" style="font-size:0.7rem; padding:2px 6px;" onclick="window.restartCameraStream('${cam.id}')">🔄 Restart</button>
                    </div>
                </div>
            `;

            videoGrid.appendChild(cell);

            if (cam.enabled) {
                initHlsPlayer(videoId, hlsUrl);
            }
        });
    }

    function initHlsPlayer(elementId, hlsUrl) {
        const video = document.getElementById(elementId);
        if (!video) return;

        if (Hls.isSupported()) {
            const hls = new Hls({
                liveSyncDurationCount: 2,
                maxBufferLength: 5,
                enableWorker: true,
                lowLatencyMode: true
            });
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            break;
                    }
                }
            });
            hlsPlayers[elementId] = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = hlsUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(() => {});
            });
        }
    }

    function destroyHlsPlayers() {
        Object.keys(hlsPlayers).forEach(id => {
            if (hlsPlayers[id]) {
                hlsPlayers[id].destroy();
            }
        });
        hlsPlayers = {};
    }

    // --- Camera Management Form & List ---
    function renderModalCameraList() {
        if (!modalCameraList) return;
        modalCameraList.innerHTML = '';

        if (cameras.length === 0) {
            modalCameraList.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">Belum ada kamera terdaftar.</div>';
            return;
        }

        cameras.forEach(cam => {
            const div = document.createElement('div');
            div.className = 'modal-cam-item';
            div.innerHTML = `
                <div>
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
                        <strong>${cam.name}</strong>
                        <span class="badge ${cam.enabled ? 'badge-online' : 'badge-offline'}">${cam.enabled ? 'ACTIVE' : 'OFF'}</span>
                        ${cam.recordMode === 'continuous' ? '<span class="badge" style="background:#dc2626; color:white;">REC</span>' : ''}
                    </div>
                    <small style="color:var(--text-muted); font-family:monospace; display:block;">${cam.mainStreamUrl}</small>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn-sm btn-edit" onclick="window.editCamera('${cam.id}')">Edit</button>
                    <button class="btn-sm btn-secondary" onclick="window.restartCameraStream('${cam.id}')">Restart Stream</button>
                    <button class="btn-sm btn-delete" onclick="window.deleteCamera('${cam.id}')">Hapus</button>
                </div>
            `;
            modalCameraList.appendChild(div);
        });
    }

    window.editCamera = function(id) {
        const cam = cameras.find(c => c.id === id);
        if (!cam) return;

        document.getElementById('camId').value = cam.id;
        document.getElementById('camEnabled').checked = cam.enabled !== false;
        document.getElementById('camName').value = cam.name || '';
        document.getElementById('camMainUrl').value = cam.mainStreamUrl || '';
        document.getElementById('camSubUrl').value = (cam.subStreamUrl && cam.subStreamUrl !== cam.mainStreamUrl) ? cam.subStreamUrl : '';
        document.getElementById('camTranscode').value = cam.transcode || 'auto';
        document.getElementById('camRecordMode').value = cam.recordMode || 'continuous';
        document.getElementById('camSegmentSec').value = cam.segmentDurationSec || 900;
        document.getElementById('camStoragePath').value = cam.storagePath || '';
        document.getElementById('camMaxDays').value = cam.maxStorageDays || 7;
        document.getElementById('camMaxGB').value = cam.maxFolderSizeGB || 10;

        if (formTitle) formTitle.textContent = `Edit Kamera: ${cam.name}`;
        if (btnCancelEdit) btnCancelEdit.style.display = 'inline-block';

        const generalTabBtn = document.querySelector('.ctab-btn[data-target="ctab-general"]');
        if (generalTabBtn) generalTabBtn.click();
        if (cameraForm) cameraForm.scrollIntoView({ behavior: 'smooth' });
    };

    function resetCameraForm() {
        if (!cameraForm) return;
        cameraForm.reset();
        document.getElementById('camId').value = '';
        document.getElementById('camEnabled').checked = true;
        document.getElementById('camTranscode').value = 'auto';
        document.getElementById('camRecordMode').value = 'continuous';
        document.getElementById('camSegmentSec').value = '900';
        document.getElementById('camMaxDays').value = '7';
        document.getElementById('camMaxGB').value = '10';

        if (formTitle) formTitle.textContent = 'Tambah / Edit Kamera';
        if (btnCancelEdit) btnCancelEdit.style.display = 'none';

        const generalTabBtn = document.querySelector('.ctab-btn[data-target="ctab-general"]');
        if (generalTabBtn) generalTabBtn.click();
    }

    if (btnCancelEdit) btnCancelEdit.addEventListener('click', resetCameraForm);

    if (cameraForm) {
        cameraForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('camId').value.trim();
            const payload = {
                name: document.getElementById('camName').value.trim(),
                enabled: document.getElementById('camEnabled').checked,
                mainStreamUrl: document.getElementById('camMainUrl').value.trim(),
                subStreamUrl: document.getElementById('camSubUrl').value.trim(),
                transcode: document.getElementById('camTranscode').value,
                recordMode: document.getElementById('camRecordMode').value,
                segmentDurationSec: parseInt(document.getElementById('camSegmentSec').value, 10) || 900,
                storagePath: document.getElementById('camStoragePath').value.trim(),
                maxStorageDays: parseInt(document.getElementById('camMaxDays').value, 10) || 7,
                maxFolderSizeGB: parseFloat(document.getElementById('camMaxGB').value) || 10
            };

            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/cameras/${id}` : '/api/cameras';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (res.ok) {
                    alert('Kamera berhasil disimpan dan MediaMTX telah disinkronkan!');
                    resetCameraForm();
                    fetchCameras();
                } else {
                    alert(`Gagal menyimpan kamera: ${data.error || 'Unknown error'}`);
                }
            } catch (err) {
                alert('Kesalahan koneksi saat menyimpan kamera.');
            }
        });
    }

    window.restartCameraStream = async function(id) {
        try {
            const res = await fetch(`/api/cameras/${id}/restart`, { method: 'POST' });
            if (res.ok) {
                alert('Stream kamera di-restart.');
                fetchCameras();
            }
        } catch (err) {
            alert('Gagal me-restart stream.');
        }
    };

    window.deleteCamera = async function(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus kamera ini? Konfigurasi stream MediaMTX akan segera diperbarui.')) {
            return;
        }
        try {
            const res = await fetch(`/api/cameras/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('Kamera berhasil dihapus.');
                fetchCameras();
            } else {
                alert('Gagal menghapus kamera.');
            }
        } catch (err) {
            alert('Kesalahan koneksi saat menghapus kamera.');
        }
    };

    // --- Storage Devices & Global Settings ---
    async function fetchStorageDevices() {
        if (!sysStorageDevice) return;
        sysStorageDevice.innerHTML = '<option value="">Memindai drive penyimpanan...</option>';

        try {
            const res = await fetch('/api/system/storage-devices');
            if (!res.ok) throw new Error('Gagal mendeteksi storage');
            const data = await res.json();
            detectedStorageDevices = data.devices || [];

            sysStorageDevice.innerHTML = '';
            const currentPath = data.currentStoragePath || '';

            if (detectedStorageDevices.length === 0) {
                sysStorageDevice.innerHTML = '<option value="">Tidak ada media eksternal (USB/HDD) terdeteksi</option>';
            } else {
                detectedStorageDevices.forEach(dev => {
                    const opt = document.createElement('option');
                    opt.value = dev.mountPath;
                    const icon = dev.category === 'External' ? '🔌 [USB/HDD]' : (dev.category === 'Internal' ? '💽 [Internal]' : '📁 [Kustom]');
                    opt.textContent = `${icon} ${dev.name} • Sisa: ${dev.freeGB} GB (${dev.percentUsed}% terpakai)`;
                    if (dev.selected || dev.mountPath === currentPath) {
                        opt.selected = true;
                    }
                    sysStorageDevice.appendChild(opt);
                });
            }

            const customOpt = document.createElement('option');
            customOpt.value = '__custom__';
            customOpt.textContent = '⚙️ Tentukan Jalur Folder Kustom...';
            sysStorageDevice.appendChild(customOpt);

            if (sysCustomStoragePath) sysCustomStoragePath.value = currentPath;
            renderStoragePreview(sysStorageDevice.value);
        } catch (err) {
            sysStorageDevice.innerHTML = '<option value="">Gagal memindai media penyimpanan</option>';
        }
    }

    function renderStoragePreview(selectedPath) {
        if (!storageDevicePreview) return;
        if (!selectedPath || selectedPath === '__custom__') {
            storageDevicePreview.style.display = 'none';
            return;
        }

        const dev = detectedStorageDevices.find(d => d.mountPath === selectedPath);
        if (!dev) {
            storageDevicePreview.style.display = 'none';
            return;
        }

        storageDevicePreview.style.display = 'block';
        const stPreviewName = document.getElementById('stPreviewName');
        const stPreviewMount = document.getElementById('stPreviewMount');
        const stPreviewCapacity = document.getElementById('stPreviewCapacity');
        const stPreviewFree = document.getElementById('stPreviewFree');
        const stPreviewFill = document.getElementById('stPreviewFill');

        if (stPreviewName) stPreviewName.textContent = `Drive: ${dev.name}`;
        if (stPreviewMount) stPreviewMount.textContent = dev.mountPath;
        if (stPreviewCapacity) stPreviewCapacity.textContent = `Total: ${dev.totalGB} GB (${dev.percentUsed}% terpakai)`;
        if (stPreviewFree) stPreviewFree.textContent = `Sisa: ${dev.freeGB} GB`;
        if (stPreviewFill) {
            stPreviewFill.style.width = `${Math.min(100, Math.max(0, dev.percentUsed))}%`;
            stPreviewFill.style.backgroundColor = dev.percentUsed > 85 ? '#ef4444' : (dev.percentUsed > 65 ? '#f59e0b' : '#3b82f6');
        }
    }

    if (sysStorageDevice) {
        sysStorageDevice.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === '__custom__') {
                if (sysCustomStoragePath) sysCustomStoragePath.focus();
                renderStoragePreview('');
            } else {
                if (sysCustomStoragePath) sysCustomStoragePath.value = val;
                renderStoragePreview(val);
            }
        });
    }

    if (btnRefreshStorage) {
        btnRefreshStorage.addEventListener('click', () => fetchStorageDevices());
    }

    if (globalStorageForm) {
        globalStorageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const storagePath = (sysCustomStoragePath ? sysCustomStoragePath.value : '').trim();
            const recQuality = sysRecordingQuality ? sysRecordingQuality.value : 'main';

            try {
                if (storagePath) {
                    await fetch('/api/system/storage-devices/select', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ storagePath })
                    });
                }

                await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recordingPath: storagePath,
                        recordingQuality: recQuality
                    })
                });

                alert('Pengaturan media penyimpanan dan kualitas rekaman berhasil disimpan!');
                fetchStorageDevices();
            } catch (err) {
                alert('Gagal menyimpan preferensi storage.');
            }
        });
    }

    // --- System & Network Settings Form ---
    async function fetchSystemSettings() {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const s = await res.json();
                const sysNetInterface = document.getElementById('sysNetInterface');
                const sysMediaMtxPort = document.getElementById('sysMediaMtxPort');
                const sysPlayerMode = document.getElementById('sysPlayerMode');
                const sysTgBot = document.getElementById('sysTgBot');
                const sysTgChat = document.getElementById('sysTgChat');
                if (sysNetInterface) sysNetInterface.value = s.netInterface || 'auto';
                if (sysMediaMtxPort) sysMediaMtxPort.value = s.mediamtxPort || 8889;
                if (sysPlayerMode) sysPlayerMode.value = s.playerMode || 'iframe';
                if (sysTgBot) sysTgBot.value = s.telegramBotToken || '';
                if (sysTgChat) sysTgChat.value = s.telegramChatId || '';
                if (sysRecordingQuality) sysRecordingQuality.value = s.recordingQuality || 'main';
            }
        } catch (err) {}
    }

    if (systemForm) {
        systemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                netInterface: document.getElementById('sysNetInterface').value,
                mediamtxPort: parseInt(document.getElementById('sysMediaMtxPort').value, 10) || 8889,
                playerMode: document.getElementById('sysPlayerMode').value,
                telegramBotToken: document.getElementById('sysTgBot').value.trim(),
                telegramChatId: document.getElementById('sysTgChat').value.trim()
            };

            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    alert('Konfigurasi sistem berhasil disimpan dan MediaMTX telah diperbarui.');
                } else {
                    alert('Gagal menyimpan konfigurasi sistem.');
                }
            } catch (err) {
                alert('Terjadi kesalahan koneksi.');
            }
        });
    }

    // --- User Management (Klien Mobile) ---
    if (btnToggleAddUser) {
        btnToggleAddUser.addEventListener('click', () => {
            const isHidden = boxAddUserForm.style.display === 'none';
            boxAddUserForm.style.display = isHidden ? 'block' : 'none';
            btnToggleAddUser.textContent = isHidden ? '✕ Tutup Form' : '+ Buat Akun User Baru';
        });
    }

    if (btnCancelAddUser) {
        btnCancelAddUser.addEventListener('click', () => {
            boxAddUserForm.style.display = 'none';
            btnToggleAddUser.textContent = '+ Buat Akun User Baru';
            addUserForm.reset();
        });
    }

    async function loadUsersList() {
        if (!userTableBody) return;
        try {
            const res = await fetch('/api/admin/users');
            if (!res.ok) throw new Error('Gagal mengambil daftar user');
            const data = await res.json();
            const users = data.users || [];

            if (users.length === 0) {
                userTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Belum ada akun user klien. Klik "+ Buat Akun User Baru".</td></tr>';
                return;
            }

            userTableBody.innerHTML = users.map(u => `
                <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:0.75rem; font-family:monospace; color:var(--text-muted); font-size:0.8rem;">${u.id}</td>
                    <td style="padding:0.75rem; font-weight:600; color:#f8fafc;">${u.name}</td>
                    <td style="padding:0.75rem; color:#60a5fa; font-family:monospace;">${u.username}</td>
                    <td style="padding:0.75rem; font-size:0.8rem; color:var(--text-muted);">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-'}</td>
                    <td style="padding:0.75rem; text-align:right;">
                        <button class="btn-sm btn-delete" onclick="window.deleteUser('${u.id}', '${u.username}')">Hapus</button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            userTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--accent);">Gagal memuat user: ${err.message}</td></tr>`;
        }
    }

    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('newUserName').value.trim();
            const username = document.getElementById('newUserUsername').value.trim();
            const password = document.getElementById('newUserPassword').value;

            if (password.length < 4) {
                alert('Password user minimal 4 karakter!');
                return;
            }

            try {
                const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, username, password })
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    alert(`Akun User '${username}' berhasil dibuat!`);
                    addUserForm.reset();
                    boxAddUserForm.style.display = 'none';
                    btnToggleAddUser.textContent = '+ Buat Akun User Baru';
                    loadUsersList();
                } else {
                    alert(data.error || 'Gagal membuat user.');
                }
            } catch (err) {
                alert('Terjadi kesalahan jaringan.');
            }
        });
    }

    window.deleteUser = async function(id, username) {
        if (!confirm(`Apakah Anda yakin ingin menghapus akun User '${username}'?`)) return;
        try {
            const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('Akun user dihapus.');
                loadUsersList();
            } else {
                alert('Gagal menghapus user.');
            }
        } catch (err) {
            alert('Kesalahan koneksi.');
        }
    };

    // --- Change Password Form ---
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const oldPassword = document.getElementById('oldPassword').value;
            const newPassword = document.getElementById('newPassword').value;

            try {
                const res = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldPassword, newPassword })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert('Password berhasil diperbarui. Silakan login kembali.');
                    handleLogout();
                } else {
                    alert(data.error || 'Gagal memperbarui password.');
                }
            } catch (err) {
                alert('Terjadi kesalahan jaringan.');
            }
        });
    }

    // --- Playback Logic (Admin) ---
    function populateCameraSelects() {
        const selects = [selRecCam, mSelRecCam].filter(Boolean);
        selects.forEach(sel => {
            sel.innerHTML = '';
            if (cameras.length === 0) {
                sel.innerHTML = '<option value="">Belum ada kamera</option>';
            } else {
                cameras.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    sel.appendChild(opt);
                });
            }
        });
    }

    if (btnFetchRecordings) {
        btnFetchRecordings.addEventListener('click', async () => {
            const camId = selRecCam ? selRecCam.value : '';
            const date = selRecDate ? selRecDate.value : '';
            if (!camId || !date) {
                alert('Silakan pilih kamera dan tanggal!');
                return;
            }

            if (playbackList) playbackList.innerHTML = '<li style="padding:1rem; text-align:center; color:var(--text-muted);">Mencari klip rekaman...</li>';

            try {
                const res = await fetch(`/api/recordings?camId=${camId}&date=${date}`);
                const data = await res.json();
                const clips = data.recordings || [];

                if (clipCount) clipCount.textContent = `${clips.length} Klip`;

                if (clips.length === 0) {
                    playbackList.innerHTML = '<li style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">Tidak ada rekaman ditemukan untuk tanggal ini.</li>';
                    return;
                }

                playbackList.innerHTML = clips.map(clip => `
                    <li class="playback-item" data-url="${clip.url}" data-name="${clip.filename}">
                        <div>
                            <strong>${clip.filename}</strong>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${clip.sizeFormatted || ''} &bull; ${clip.time || ''}</div>
                        </div>
                        <span style="color:#60a5fa; font-size:0.9rem;">▶</span>
                    </li>
                `).join('');

                document.querySelectorAll('#playbackList .playback-item').forEach(item => {
                    item.addEventListener('click', () => {
                        document.querySelectorAll('#playbackList .playback-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                        const url = item.getAttribute('data-url');
                        const name = item.getAttribute('data-name');
                        if (playbackPlayer) {
                            playbackPlayer.src = url;
                            playbackPlayer.play().catch(() => {});
                        }
                        if (pbTitle) pbTitle.textContent = `Memutar: ${name}`;
                    });
                });
            } catch (err) {
                playbackList.innerHTML = '<li style="padding:1rem; text-align:center; color:var(--accent);">Gagal memuat rekaman.</li>';
            }
        });
    }

    // --- System Logs Fetch ---
    async function fetchLogs() {
        if (!logsContainer) return;
        logsContainer.textContent = 'Memuat logs...';
        try {
            const res = await fetch('/api/system/logs');
            const data = await res.json();
            const logs = data.logs || [];
            if (logs.length === 0) {
                logsContainer.textContent = 'Belum ada log tercatat.';
            } else {
                logsContainer.innerHTML = logs.map(l => {
                    const time = l.timestamp ? new Date(l.timestamp).toLocaleTimeString('id-ID') : '';
                    const levelColor = l.level === 'ERROR' ? '#f87171' : (l.level === 'WARN' ? '#fbbf24' : '#34d399');
                    return `<div><span style="color:#64748b;">[${time}]</span> <span style="color:${levelColor}; font-weight:600;">[${l.level}]</span> ${l.message}</div>`;
                }).join('');
                logsContainer.scrollTop = logsContainer.scrollHeight;
            }
        } catch (err) {
            logsContainer.textContent = 'Gagal memuat logs.';
        }
    }

    if (btnRefreshLogs) btnRefreshLogs.addEventListener('click', fetchLogs);

    // =========================================================================
    // 3. USER (MOBILE CLIENT PWA) LOGIC
    // =========================================================================
    function initMobileUserApp() {
        initMobileBottomNav();
        fetchCamerasForMobile();

        const today = new Date().toISOString().split('T')[0];
        if (mSelRecDate) mSelRecDate.value = today;

        if (btnMRefreshStreams) {
            btnMRefreshStreams.addEventListener('click', fetchCamerasForMobile);
        }

        // Mobile Grid Buttons
        document.querySelectorAll('.m-grid-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.m-grid-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = '';
                    b.style.color = '';
                });
                btn.classList.add('active');
                btn.style.background = '#10b981';
                btn.style.color = 'white';
                mCurrentGridCount = parseInt(btn.getAttribute('data-mgrid'), 10) || 1;
                renderMobileGrid(mCurrentGridCount);
            });
        });

        // Mobile Playback Search
        if (mBtnFetchRecordings) {
            mBtnFetchRecordings.addEventListener('click', async () => {
                const camId = mSelRecCam ? mSelRecCam.value : '';
                const date = mSelRecDate ? mSelRecDate.value : '';
                if (!camId || !date) {
                    alert('Pilih kamera dan tanggal!');
                    return;
                }

                mPlaybackList.innerHTML = '<li style="padding:1rem; text-align:center; color:var(--text-muted);">Mencari rekaman...</li>';

                try {
                    const res = await fetch(`/api/recordings?camId=${camId}&date=${date}`);
                    const data = await res.json();
                    const clips = data.recordings || [];

                    if (clips.length === 0) {
                        mPlaybackList.innerHTML = '<li style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.8rem;">Tidak ada klip rekaman.</li>';
                        return;
                    }

                    mPlaybackList.innerHTML = clips.map(clip => `
                        <li class="playback-item" data-url="${clip.url}" data-name="${clip.filename}">
                            <div>
                                <strong>${clip.filename}</strong>
                                <div style="font-size:0.7rem; color:var(--text-muted);">${clip.sizeFormatted || ''}</div>
                            </div>
                            <span style="color:#10b981;">▶</span>
                        </li>
                    `).join('');

                    document.querySelectorAll('#mPlaybackList .playback-item').forEach(item => {
                        item.addEventListener('click', () => {
                            document.querySelectorAll('#mPlaybackList .playback-item').forEach(i => i.classList.remove('active'));
                            item.classList.add('active');
                            const url = item.getAttribute('data-url');
                            if (mPlaybackPlayer) {
                                mPlaybackPlayer.src = url;
                                mPlaybackPlayer.play().catch(() => {});
                            }
                        });
                    });
                } catch (err) {
                    mPlaybackList.innerHTML = '<li style="padding:1rem; text-align:center; color:var(--accent);">Gagal memuat klip.</li>';
                }
            });
        }

        // Mobile Change Password
        if (mChangePasswordForm) {
            mChangePasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const oldPassword = document.getElementById('mOldPassword').value;
                const newPassword = document.getElementById('mNewPassword').value;

                try {
                    const res = await fetch('/api/auth/change-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ oldPassword, newPassword })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        alert('Password berhasil diganti. Silakan login kembali.');
                        handleLogout();
                    } else {
                        alert(data.error || 'Gagal mengubah password.');
                    }
                } catch (err) {
                    alert('Terjadi kesalahan jaringan.');
                }
            });
        }
    }

    function initMobileBottomNav() {
        const navItems = document.querySelectorAll('.mobile-bottom-nav .mobile-nav-item');
        const views = document.querySelectorAll('.mobile-view');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navItems.forEach(n => n.classList.remove('active'));
                views.forEach(v => v.classList.remove('active'));

                item.classList.add('active');
                const targetId = item.getAttribute('data-mtarget');
                const targetEl = document.getElementById(targetId);
                if (targetEl) targetEl.classList.add('active');
            });
        });
    }

    async function fetchCamerasForMobile() {
        try {
            const res = await fetch('/api/cameras');
            if (res.status === 401) {
                window.location.reload();
                return;
            }
            const data = await res.json();
            cameras = data.cameras || [];

            renderMobileGrid(mCurrentGridCount);
            renderMobileCameraCards();
            populateCameraSelects();
        } catch (err) {
            console.error('Gagal mengambil kamera mobile', err);
        }
    }

    function renderMobileGrid(count) {
        if (!mVideoGrid) return;
        mVideoGrid.className = `video-grid grid-${count}`;
        mVideoGrid.innerHTML = '';

        if (cameras.length === 0) {
            mVideoGrid.innerHTML = `
                <div class="cam-cell" style="padding:2rem; text-align:center;">
                    <p style="color:var(--text-muted); font-size:0.85rem;">Belum ada kamera yang ditugaskan kepada Anda.</p>
                </div>
            `;
            return;
        }

        const displayCams = cameras.slice(0, count);
        displayCams.forEach(cam => {
            const cell = document.createElement('div');
            cell.className = 'cam-cell';
            const hlsUrl = `/stream/${cam.mediaMtxPath}/index.m3u8`;
            const videoId = `m_vid_${cam.id}`;

            cell.innerHTML = `
                <video id="${videoId}" class="cam-player-video" autoplay muted playsinline controls></video>
                <div class="cam-overlay">
                    <span class="cam-title">${cam.name}</span>
                    <span class="badge ${cam.enabled ? 'badge-online' : 'badge-offline'}">${cam.enabled ? 'LIVE' : 'OFF'}</span>
                </div>
            `;
            mVideoGrid.appendChild(cell);

            if (cam.enabled) {
                initHlsPlayer(videoId, hlsUrl);
            }
        });
    }

    function renderMobileCameraCards() {
        if (!mCameraCardsList) return;
        mCameraCardsList.innerHTML = '';

        if (cameras.length === 0) {
            mCameraCardsList.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">Tidak ada kamera tersedia.</div>';
            return;
        }

        cameras.forEach(cam => {
            const card = document.createElement('div');
            card.className = 'camera-form-section';
            card.style.padding = '1rem';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="font-size:0.95rem; display:block;">${cam.name}</strong>
                        <span style="font-size:0.75rem; color:var(--text-muted);">Mode: ${cam.recordMode === 'continuous' ? 'Rekam Aktif' : 'Live Only'}</span>
                    </div>
                    <span class="badge ${cam.enabled ? 'badge-online' : 'badge-offline'}">${cam.enabled ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
            `;
            mCameraCardsList.appendChild(card);
        });
    }

    // Mulai Eksekusi Autentikasi
    checkAuth();
});
