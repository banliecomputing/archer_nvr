// script.js - NVR CCTV Dashboard V6

if(document) document.addEventListener('DOMContentLoaded', () => {
    // Referensi Elemen Live
    const videoGrid = document.getElementById('videoGrid');
    const layoutBtns = document.querySelectorAll('.layout-btn');
    const cameraListEl = document.getElementById('cameraList');
    const clockEl = document.getElementById('clock');
    
    // Referensi Navigasi Tabs Utama & Sidebar
    const tabBtns = document.querySelectorAll('.tab-btn');
    const viewPanes = document.querySelectorAll('.view-pane');
    const sidePanels = document.querySelectorAll('.side-panel');

    // Referensi Playback
    const selRecDate = document.getElementById('selRecDate');
    const selRecCam = document.getElementById('selRecCam');
    const playbackList = document.getElementById('playbackList');
    const playbackPlayer = document.getElementById('playbackPlayer');
    const pbTitle = document.getElementById('pbTitle');

    // Referensi Modal
    const modal = document.getElementById('settingsModal');
    const btnSettings = document.getElementById('btnSettings');
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    const stabBtns = document.querySelectorAll('.stab-btn');
    const stabPanes = document.querySelectorAll('.stab-pane');
    
    // Referensi Form Inner Tabs
    const ctabBtns = document.querySelectorAll('.ctab-btn');
    const ctabPanes = document.querySelectorAll('.ctab-pane');
    
    // Referensi Form
    const cameraForm = document.getElementById('cameraForm');
    const btnCancelEdit = document.getElementById('btnCancelEdit');

    // Data State
    let cameras = [];
    let hlsInstances = {}; 
    let liveSyncTimers = {};
    let webrtcConnections = {};
    let mediamtxPort = 8889;
    let mediamtxHost = '';
    let playerMode = 'iframe'; // 'iframe' | 'whep'
    let currentGridCount = 4;
    let recordingsMap = {}; // { 'cam_1': { '2023-10-01': ['15-30-00.mp4'] } }
    let detectedStorageDevices = [];
    let sysMonitorInterval = null;

    // --- Authentication ---
    const authOverlay = document.getElementById('authOverlay');
    const mainApp = document.getElementById('mainApp');
    const authForm = document.getElementById('authForm');
    const authTitle = document.getElementById('authTitle');
    const authError = document.getElementById('authError');
    const authUsername = document.getElementById('authUsername');
    const authPassword = document.getElementById('authPassword');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    
    let isSetupMode = false;

    // --- Password Peek Feature (Intip Password) ---
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
                    btn.title = 'Sembunyikan Password';
                    btn.setAttribute('aria-label', 'Sembunyikan Password');
                } else {
                    input.type = 'password';
                    if (icon) icon.textContent = '👁️';
                    btn.title = 'Intip / Lihat Password';
                    btn.setAttribute('aria-label', 'Lihat Password');
                }
            };
        });
    }

    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/status');
            const data = await res.json();
            
            const authTabs = document.getElementById('authTabs');
            const tabLoginBtn = document.getElementById('tabLoginBtn');
            const tabRegisterBtn = document.getElementById('tabRegisterBtn');
            const confirmGroup = document.getElementById('authConfirmGroup');
            
            if (data.needSetup) {
                isSetupMode = true;
                if (authTabs) authTabs.style.display = 'flex';
                if (tabLoginBtn) tabLoginBtn.style.display = 'none'; // Only allow register
                if (tabRegisterBtn) {
                    if (tabRegisterBtn) tabRegisterBtn.classList.add('active');
                    if (tabRegisterBtn) tabRegisterBtn.style.display = 'block';
                }
                
                if (authTitle) authTitle.style.display = 'block';
                if (authTitle) authTitle.textContent = 'Registrasi Admin Pertama';
                if (authSubmitBtn) authSubmitBtn.textContent = 'Buat Akun & Login';
                if (confirmGroup) confirmGroup.style.display = 'block';
                if (authForm) authForm.style.display = 'block';
                if (authOverlay) authOverlay.style.display = 'flex';
                if (mainApp) mainApp.style.display = 'none';
                initPasswordPeeks();
            } else if (!data.authenticated) {
                isSetupMode = false;
                if (authTabs) authTabs.style.display = 'flex';
                if (tabRegisterBtn) tabRegisterBtn.style.display = 'none'; // Only allow login if already set up
                if (tabLoginBtn) {
                    if (tabLoginBtn) tabLoginBtn.classList.add('active');
                    if (tabLoginBtn) tabLoginBtn.style.display = 'block';
                }
                
                if (authTitle) authTitle.style.display = 'block';
                if (authTitle) authTitle.textContent = 'Login NVR';
                if (authSubmitBtn) authSubmitBtn.textContent = 'Login';
                if (confirmGroup) confirmGroup.style.display = 'none';
                if (authForm) authForm.style.display = 'block';
                if (authOverlay) authOverlay.style.display = 'flex';
                if (mainApp) mainApp.style.display = 'none';
                initPasswordPeeks();
            } else {
                // Authenticated
                if (authOverlay) authOverlay.style.display = 'none';
                if (mainApp) mainApp.style.display = 'flex';
                const lblUsername = document.getElementById('lblUsername');
                if (lblUsername) lblUsername.textContent = data.username || 'Admin';
                initializeApp();
            }
        } catch(e) {
            if (authTitle) authTitle.style.display = 'block';
            if (authTitle) authTitle.textContent = 'Koneksi ke server gagal.';
        }
    }

    if(authForm) authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = authUsername.value.trim();
        const password = authPassword.value;
        const confirmInput = document.getElementById('authPasswordConfirm');

        if (isSetupMode && confirmInput) {
            const confirmVal = confirmInput.value;
            if (password !== confirmVal) {
                if (authError) authError.textContent = 'Password dan konfirmasi password tidak sama!';
                return;
            }
            if (password.length < 4) {
                if (authError) authError.textContent = 'Password minimal 4 karakter!';
                return;
            }
        }

        const endpoint = isSetupMode ? '/api/auth/setup' : '/api/auth/login';
        if (authError) authError.textContent = '';
        
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                if (authOverlay) authOverlay.style.display = 'none';
                if (mainApp) mainApp.style.display = 'flex';
                initializeApp();
            } else {
                if (authError) authError.textContent = data.error || 'Login gagal';
            }
        } catch(e) {
            if (authError) authError.textContent = 'Terjadi kesalahan sistem.';
        }
    });

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        if(btnLogout) btnLogout.addEventListener('click', async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.reload();
            } catch(e) {
                console.error(e);
            }
        });
    }

    // Wrap initial fetching in initializeApp
    function initializeApp() {
        initPasswordPeeks();
        fetchCameras();
        setInterval(fetchCameras, 30000); // refresh 30s
        startSystemMonitoring(); // Armbian Real-time System Monitoring (CPU, RAM, Suhu STB, Storage, Network)
    }

    // Initialize password peeks immediately for login/setup overlay
    initPasswordPeeks();

    // Start with checkAuth instead of fetching directly
    checkAuth();

    // Referensi Mobile Menu
    var btnMobileMenu = document.getElementById('btnMobileMenu');
    var sidebar = document.querySelector('.sidebar');
    var sidebarOverlay = document.getElementById('sidebarOverlay');

    if (btnMobileMenu) {
        if(btnMobileMenu) btnMobileMenu.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                // Mobile behavior: slide in/out
                if (sidebar) sidebar.classList.toggle('open');
                if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
            } else {
                // Desktop behavior: collapse sidebar
                if (sidebar) sidebar.classList.toggle('collapsed');
            }
        });
    }
    
    function closeMobileMenu() {
        if (window.innerWidth <= 768) {
            if (sidebar) sidebar.classList.remove('open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        }
    }

    if (sidebarOverlay) {
        if(sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileMenu);
    }

    // --- Manajemen Waktu ---
    setInterval(() => {
        const now = new Date();
        if (clockEl) clockEl.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
    }, 1000);

    /* OLD TAB NAV REMOVED */
    // Navigasi Baru
    const navItems = document.querySelectorAll('.nav-item, .nav-subitem');
    var btnMobileMenu = document.getElementById('btnMobileMenu');
    var sidebar = document.getElementById('sidebar');
    var sidebarOverlay = document.getElementById('sidebarOverlay');

    if(btnMobileMenu) {
        if(btnMobileMenu) btnMobileMenu.addEventListener('click', () => {
            if (sidebar) sidebar.classList.add('mobile-open');
            if (sidebarOverlay) sidebarOverlay.classList.add('active');
        });
    }

    if(sidebarOverlay) {
        if(sidebarOverlay) sidebarOverlay.addEventListener('click', () => {
            if (sidebar) sidebar.classList.remove('mobile-open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        });
    }

    window.toggleNavGroup = function(headerEl) {
        headerEl.parentElement.classList.toggle('open');
    };

    navItems.forEach(item => {
        if(item) item.addEventListener('click', (e) => {
            e.preventDefault();
            // khusus untuk layout-btn live view
            if(item.classList.contains('layout-btn')) return;

            navItems.forEach(i => i.classList.remove('active'));
            viewPanes.forEach(p => p.classList.remove('active'));
            
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if(targetEl) targetEl.classList.add('active');
            
            if (targetId === 'view-playback') fetchRecordings();
            if (targetId === 'view-logs') fetchLogs();
            if (targetId === 'view-setting-record') fetchStorageOptions();
            if (targetId === 'view-setting-cameras') fetchCameras(); // or renderModalList if we keep the same logic

            if (window.innerWidth <= 768) {
                if (sidebar) sidebar.classList.remove('mobile-open');
                if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            }
        });
    });


    // --- Fetch System Logs ---
    const btnRefreshLogs = document.getElementById('btnRefreshLogs');
    if (btnRefreshLogs) {
        if(btnRefreshLogs) btnRefreshLogs.addEventListener('click', fetchLogs);
    }

    async function fetchLogs() {
        const logsContainer = document.getElementById('logsContainer');
        try {
            const res = await fetch('/api/logs'); // Need to implement this in server.js
            const data = await res.json();
            if (logsContainer) logsContainer.innerHTML = data.logs.map(log => 
                `<div><span style="color:#8fbcbb;">[${log.timestamp}]</span> <span style="color:${log.level === 'ERROR' ? '#bf616a' : log.level === 'WARN' ? '#ebcb8b' : '#a3be8c'}">[${log.level}]</span> ${log.message}</div>`
            ).join('');
            if (logsContainer) logsContainer.scrollTop = logsContainer.scrollHeight;
        } catch(e) {
            if (logsContainer) logsContainer.innerHTML = 'Gagal memuat log sistem.';
        }
    }

    // --- Fetch Storage Options ---
    async function fetchStorageOptions() {
        try {
            const resOpt = await fetch('/api/storage-options');
            const options = await resOpt.json();
            
            const selectEl = document.getElementById('globalStorageMode');
            if (selectEl) selectEl.innerHTML = '';
            
            options.forEach(opt => {
                const optionEl = document.createElement('option');
                if (optionEl) optionEl.value = opt.id === 'disabled' ? 'disabled' : opt.path;
                if (optionEl) optionEl.textContent = opt.label;
                if (selectEl) selectEl.appendChild(optionEl);
            });
            
            // fetch current global settings
            const resSet = await fetch('/api/settings');
            const currentSettings = await resSet.json();
            
            if (currentSettings.globalStorageMode === 'disabled') {
                if (selectEl) selectEl.value = 'disabled';
            } else if (currentSettings.globalStoragePath) {
                if (selectEl) selectEl.value = currentSettings.globalStoragePath;
            }

            const recQuality = currentSettings.recordingQuality || 'main';
            const globRecEl = document.getElementById('globalRecordingQuality');
            if (globRecEl) globRecEl.value = recQuality;
            const sysRecEl = document.getElementById('sysRecordingQuality');
            if (sysRecEl) sysRecEl.value = recQuality;

        } catch (e) {
            console.error('Failed to fetch storage options:', e);
        }
    }

    const globalStorageForm = document.getElementById('globalStorageForm');
    if (globalStorageForm) {
        if(globalStorageForm) globalStorageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const val = document.getElementById('globalStorageMode').value;
            const recQ = document.getElementById('globalRecordingQuality')?.value || 'main';
            const payload = {
                globalStorageMode: val === 'disabled' ? 'disabled' : 'enabled',
                globalStoragePath: val === 'disabled' ? '' : val,
                recordingQuality: recQ
            };
            try {
                await fetch('/api/settings', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                const sysRecEl = document.getElementById('sysRecordingQuality');
                if (sysRecEl) sysRecEl.value = recQ;

                alert('Preferensi Storage & Kualitas Rekaman Berhasil Disimpan!');
            } catch(e) {
                alert('Gagal menyimpan preferensi storage.');
            }
        });
    }

    // --- Fetch Data ---
    async function fetchCameras() {
        try {
            const res = await fetch('/api/cameras');
            if (res.status === 401) {
                window.location.reload();
                return;
            }
            const data = await res.json();
            cameras = data.cameras || [];
            if (data.mediamtxPort) mediamtxPort = data.mediamtxPort;
            if (data.mediamtxHost !== undefined) mediamtxHost = data.mediamtxHost;
            updateCameraSidebar();
            renderGrid(currentGridCount);
            renderModalList();
        } catch (err) {
            console.error('Gagal mengambil data kamera:', err);
        }
    }

    function updateCameraSidebar() {
        const lblActiveCams = document.getElementById('lblActiveCams');
        const menuCameraList = document.getElementById('menuCameraList');
        
        let activeCount = cameras.filter(c => c.enabled).length;
        if (lblActiveCams) lblActiveCams.textContent = `${activeCount} Kamera Aktif`;

        if (menuCameraList) {
            if (menuCameraList) menuCameraList.innerHTML = '';
            if (cameras.length === 0) {
                if (menuCameraList) menuCameraList.innerHTML = '<span style="padding: 0.5rem 1.5rem 0.5rem 3rem; color:var(--text-muted); font-size:0.8rem; display:block;">Belum ada kamera</span>';
                return;
            }
            cameras.forEach(cam => {
                const a = document.createElement('a');
                a.href = '#';
                a.className = 'nav-subitem';
                if (a) a.innerHTML = `<span style="color:${cam.enabled ? 'var(--success)' : 'var(--accent)'}; margin-right:5px;">●</span> ${cam.name}`;
                if(a) a.addEventListener('click', (e) => {
                    e.preventDefault();
                    // switch to view-live 1x1
                    const layoutBtn1 = document.querySelector('.layout-btn[data-grid="1"]');
                    if (layoutBtn1) layoutBtn1.click();
                    setTimeout(() => {
                        document.querySelectorAll('.nav-subitem').forEach(i => i.classList.remove('active'));
                        a.classList.add('active');
                    }, 100);
                });
                if (menuCameraList) menuCameraList.appendChild(a);
            });
        }
        
        // legacy
        if(cameraListEl) {
            if (cameraListEl) cameraListEl.innerHTML = '';
            cameras.forEach(cam => {
                const li = document.createElement('li');
                if (!cam.enabled) li.classList.add('disabled');
                if (li) li.innerHTML = `<span class="pulse-dot ${cam.enabled ? '' : 'offline'}"></span> ${cam.name}`;
                if (cameraListEl) cameraListEl.appendChild(li);
            });
        }
    }

    // --- Grid Layout & Dual Stream ---
    layoutBtns.forEach(btn => {
        if(btn) btn.addEventListener('click', (e) => {
            layoutBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentGridCount = parseInt(e.currentTarget.getAttribute('data-grid'));
            renderGrid(currentGridCount);
            if (window.innerWidth <= 768) {
                closeMobileMenu();
            }
        });
    });

    function getMediaMtxStreamUrl(cam, streamType = 'main') {
        const safeId = (cam.id || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
        
        let path = cam.mediaMtxPath || safeId;
        if (streamType === 'sub') {
            if (cam.mediaMtxSubPath) {
                path = cam.mediaMtxSubPath;
            } else if (cam.subStreamUrl && cam.subStreamUrl !== cam.mainStreamUrl) {
                path = `${safeId}_sub`;
            }
        }
        return `/stream/${path}/stream.m3u8`;
    }

    function cleanupCameraPlayer(camId) {
        if (webrtcConnections[camId]) {
            try { webrtcConnections[camId].close(); } catch(e) {}
            delete webrtcConnections[camId];
        }
        if (hlsInstances[camId]) {
            try { hlsInstances[camId].destroy(); } catch(e) {}
            delete hlsInstances[camId];
        }
        if (liveSyncTimers[camId]) {
            clearInterval(liveSyncTimers[camId]);
            delete liveSyncTimers[camId];
        }
    }

    function cleanupAllPlayers() {
        Object.keys(webrtcConnections).forEach(id => cleanupCameraPlayer(id));
        webrtcConnections = {};
        Object.keys(hlsInstances).forEach(id => cleanupCameraPlayer(id));
        hlsInstances = {};
        Object.values(liveSyncTimers).forEach(t => clearInterval(t));
        liveSyncTimers = {};
    }

    function renderGrid(count) {
        cleanupAllPlayers();

        if (videoGrid) videoGrid.innerHTML = '';
        videoGrid.className = `video-grid grid-${count}`;

        // Create an array of active cameras only
        const activeCameras = cameras.filter(c => c.enabled);

        for (let i = 0; i < count; i++) {
            const cell = document.createElement('div');
            cell.className = 'cam-cell';
            cell.id = `cell-${i}`;

            if (activeCameras[i]) {
                const cam = activeCameras[i];
                const isSingle = count === 1;
                const initialStreamType = isSingle ? 'main' : 'sub';
                const streamUrl = getMediaMtxStreamUrl(cam, initialStreamType);

                cell.dataset.camId = cam.id;
                cell.dataset.streamType = initialStreamType;

                if (cell) cell.innerHTML = `
                    <div class="cam-player-wrapper" id="player-wrapper-${cam.id}"></div>
                    
                    <!-- Camera State Overlay -->
                    <div class="cam-state-overlay" id="state-overlay-${cam.id}">
                        <div class="state-spinner"></div>
                        <div class="state-title">Menghubungkan MediaMTX...</div>
                        <div class="state-subtitle">${cam.name} &bull; ${streamUrl}</div>
                        <div class="state-engine-tag">⚡ MediaMTX WebRTC V8.2 (&lt;0.5s Latency)</div>
                        <button class="btn-retry" onclick="retryStream('${cam.id}')" style="display:none;" id="btn-retry-${cam.id}">Coba Ulang</button>
                    </div>

                    <div class="cam-overlay">
                        <div class="cam-info">
                            <span class="pulse-dot" id="dot-${cam.id}"></span>
                            <span class="cam-name">${cam.name}</span>
                            <span class="cam-stream-tag" id="tag-${cam.id}">${initialStreamType === 'main' ? 'HD' : 'SD'}</span>
                            <span class="cam-webrtc-badge" title="WebRTC Low-Latency Live View">&bull; WebRTC</span>
                        </div>
                        <div class="cam-controls">
                            <!-- Live View Selector (HD / SD) -->
                            <div class="cam-quality-picker">
                                <select class="quality-select" id="quality-${cam.id}" onchange="changeCameraQuality('${cam.id}', this.value, '${cell.id}')" title="Pilih Kualitas Stream (Live View)">
                                    <option value="main" ${initialStreamType === 'main' ? 'selected' : ''}>HD / Main</option>
                                    <option value="sub" ${initialStreamType === 'sub' ? 'selected' : ''}>SD / Sub</option>
                                </select>
                            </div>
                            <button class="btn-icon" onclick="retryStream('${cam.id}')" title="Restart Stream">🔄</button>
                            <button class="btn-icon" onclick="toggleFullscreen('${cam.id}', 'cell-${i}')" title="Fullscreen (Main Stream)">⛶</button>
                        </div>
                    </div>
                `;
                if (videoGrid) videoGrid.appendChild(cell);

                initMediaMtxPlayer(cam.id, initialStreamType, cell, 0);

                if(cell) cell.addEventListener('fullscreenchange', () => {
                    handleFullscreenChange(cam.id, cell);
                });
            } else {
                if (cell) cell.innerHTML = `
                    <div class="cam-empty">
                        <span style="font-size: 1.8rem; opacity: 0.4;">✖</span>
                        <span>CH ${i + 1} &bull; NO SIGNAL</span>
                    </div>
                `;
                if (videoGrid) videoGrid.appendChild(cell);
            }
        }
    }

    async function initMediaMtxPlayer(camId, streamType, cellElement, retryCount = 0) {
        const cam = cameras.find(c => c.id === camId);
        if (!cam) return;

        const wrapper = cellElement.querySelector(`#player-wrapper-${camId}`);
        if (!wrapper) return;

        const pulseDot = cellElement.querySelector(`#dot-${camId}`) || cellElement.querySelector('.pulse-dot');
        const stateOverlay = cellElement.querySelector(`#state-overlay-${camId}`);
        const stateTitle = stateOverlay ? stateOverlay.querySelector('.state-title') : null;
        const stateSubtitle = stateOverlay ? stateOverlay.querySelector('.state-subtitle') : null;
        const btnRetry = cellElement.querySelector(`#btn-retry-${camId}`);
        const spinner = stateOverlay ? stateOverlay.querySelector('.state-spinner') : null;

        const streamUrl = getMediaMtxStreamUrl(cam, streamType);
        const iframeUrl = streamUrl; // Use exactly as requested: http://[IP_STB]:8889/[camera_id]

        cleanupCameraPlayer(camId);

        const setOverlayState = (mode, title, subtitle) => {
            if (!stateOverlay) return;
            if (mode === 'hidden') {
                stateOverlay.classList.add('hidden');
                if (stateOverlay) stateOverlay.style.display = 'none';
                if (pulseDot) pulseDot.classList.remove('offline');
            } else if (mode === 'loading') {
                stateOverlay.classList.remove('hidden');
                if (stateOverlay) stateOverlay.style.display = 'flex';
                if (spinner) spinner.style.display = 'block';
                if (btnRetry) btnRetry.style.display = 'none';
                if (stateTitle) stateTitle.textContent = title || 'Menghubungkan MediaMTX...';
                if (stateSubtitle && subtitle) if (stateSubtitle) stateSubtitle.textContent = subtitle;
            } else if (mode === 'error') {
                stateOverlay.classList.remove('hidden');
                if (stateOverlay) stateOverlay.style.display = 'flex';
                if (spinner) spinner.style.display = 'none';
                if (btnRetry) btnRetry.style.display = 'inline-block';
                if (stateTitle) stateTitle.textContent = title || 'Stream MediaMTX Tidak Tersedia';
                if (stateSubtitle && subtitle) if (stateSubtitle) stateSubtitle.textContent = subtitle;
                if (pulseDot) pulseDot.classList.add('offline');
            }
        };

        function isLocalNetwork() {
            const host = window.location.hostname;
            return host === 'localhost' || 
                   host === '127.0.0.1' || 
                   host.startsWith('192.168.') || 
                   host.startsWith('10.') || 
                   /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
                   host.endsWith('.local');
        }

        if (!isLocalNetwork()) {
            setOverlayState('error', 'Akses Stream Dibatasi', 'Streaming video langsung dibatasi demi keamanan & aturan Cloudflare. Gunakan jaringan lokal atau aplikasi P2P khusus untuk melihat stream dari luar.');
            if (btnRetry) btnRetry.style.display = 'none'; // Sembunyikan tombol retry untuk error ini
            return;
        }

        setOverlayState('loading', 'Menghubungkan HLS Stream...', streamUrl);

        renderHlsPlayer();

        function renderHlsPlayer() {
            if (wrapper) wrapper.innerHTML = `
                <video 
                    id="player-${camId}" 
                    class="cam-player-video" 
                    autoplay 
                    muted 
                    playsinline
                    style="width: 100%; height: 100%; object-fit: cover; border: none;">
                </video>
            `;
            const video = wrapper.querySelector('video');
            
            if (Hls.isSupported()) {
                const hls = new Hls({
                    manifestLoadingTimeOut: 20000,
                    manifestLoadingMaxRetry: 3,
                    levelLoadingTimeOut: 20000,
                    levelLoadingMaxRetry: 3
                });
                
                hls.loadSource(streamUrl);
                hls.attachMedia(video);
                
                hls.on(Hls.Events.MANIFEST_PARSED, function() {
                    video.play().catch(e => console.warn('Auto-play prevented', e));
                    setOverlayState('hidden');
                });
                
                hls.on(Hls.Events.ERROR, function(event, data) {
                    if (data.fatal) {
                        switch(data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                hls.recoverMediaError();
                                break;
                            default:
                                setOverlayState('error', 'Gagal Memuat HLS Stream', data.details);
                                hls.destroy();
                                break;
                        }
                    }
                });
                
                // Save instance for cleanup
                hlsInstances[camId] = hls;
                
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                if (video) video.src = streamUrl;
                if(video) video.addEventListener('loadedmetadata', function() {
                    video.play().catch(e => console.warn('Auto-play prevented', e));
                    setOverlayState('hidden');
                });
                if(video) video.addEventListener('error', function() {
                    setOverlayState('error', 'Gagal Memuat Stream (Native)', 'Unsupported Format');
                });
            } else {
                setOverlayState('error', 'Browser Tidak Mendukung HLS', 'Gunakan browser modern');
            }
        }
    }

    window.changeCameraQuality = function(camId, targetType, cellId) {
        const cell = document.getElementById(cellId) || document.querySelector(`.cam-cell[data-cam-id="${camId}"]`);
        if (!cell) return;
        const cam = cameras.find(c => c.id === camId);
        if (!cam) return;

        cell.dataset.streamType = targetType;
        
        const tag = cell.querySelector(`#tag-${camId}`);
        if (tag) tag.textContent = targetType === 'main' ? 'HD' : 'SD';

        const qSelect = cell.querySelector(`#quality-${camId}`);
        if (qSelect && qSelect.value !== targetType) {
            if (qSelect) qSelect.value = targetType;
        }

        console.log(`[MediaMTX Switch] Kamera ${cam.name} beralih ke stream ${targetType.toUpperCase()}`);
        initMediaMtxPlayer(camId, targetType, cell, 0);
    };

    window.toggleFullscreen = function(camId, cellId) {
        const cell = document.getElementById(cellId);
        if (!cell) return;
        if (!document.fullscreenElement) {
            if (cell.requestFullscreen) cell.requestFullscreen();
            else if (cell.webkitRequestFullscreen) cell.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    };

    function handleFullscreenChange(camId, cell) {
        const isFull = !!document.fullscreenElement;
        const currentType = cell.dataset.streamType;
        const nextType = isFull ? 'main' : (currentGridCount === 1 ? 'main' : 'sub');
        
        if (currentType !== nextType) {
            cell.dataset.streamType = nextType;
            const tag = cell.querySelector(`#tag-${camId}`);
            if (tag) tag.textContent = nextType === 'main' ? 'HD' : 'SD';
            const qSelect = cell.querySelector(`#quality-${camId}`);
            if (qSelect) qSelect.value = nextType;
            initMediaMtxPlayer(camId, nextType, cell, 0);
        }
    }

    window.retryStream = async function(camId) {
        try {
            const cell = document.querySelector(`.cam-cell[data-cam-id="${camId}"]`);
            if (cell) {
                const overlay = cell.querySelector('.cam-state-overlay');
                if (overlay) overlay.classList.remove('hidden');
                const btn = cell.querySelector('.btn-retry');
                if (btn) btn.style.display = 'none';
                const spinner = cell.querySelector('.state-spinner');
                if (spinner) spinner.style.display = 'block';
                const title = cell.querySelector('.state-title');
                if (title) title.textContent = 'Menyinkronkan stream...';
            }

            await fetch(`/api/cameras/${camId}/restart`, { method: 'POST' });
            setTimeout(() => {
                const updatedCell = document.querySelector(`.cam-cell[data-cam-id="${camId}"]`);
                const cam = cameras.find(c => c.id === camId);
                if (updatedCell && cam) {
                    const currentType = updatedCell.dataset.streamType || 'sub';
                    initMediaMtxPlayer(camId, currentType, updatedCell, 0);
                }
            }, 800);
        } catch (e) {
            console.error('Gagal restart stream:', e);
        }
    };


    // --- Playback Management ---
    let currentZoom = 24; // hours
    let currentPlaybackDate = '';
    let currentPlaybackCam = '';
    let currentPlaybackChunks = []; // array of { startSec, duration, filename }
    let currentFileStartSec = 0;

    const timelineContainer = document.getElementById('timelineContainer');
    const scrollArea = document.getElementById('timelineScrollArea');
    const scale = document.getElementById('timelineScale');
    const tracks = document.getElementById('timelineTracks');
    const scrubber = document.getElementById('timelineScrubber');
    let isDraggingScrubber = false;

    // Zoom Buttons
    document.querySelectorAll('.z-btn').forEach(btn => {
        if(btn) btn.addEventListener('click', (e) => {
            document.querySelectorAll('.z-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentZoom = parseInt(e.target.getAttribute('data-zoom'));
            renderTimeline();
        });
    });

    function parseTimeToSeconds(filename) {
        const parts = filename.replace('.mp4','').replace('.ts','').split('-');
        if (parts.length === 3) {
            return parseInt(parts[0])*3600 + parseInt(parts[1])*60 + parseInt(parts[2]);
        }
        return 0;
    }

    function renderTimeline() {
        const widthPercent = (24 / currentZoom) * 100;
        if (scrollArea) scrollArea.style.width = `${widthPercent}%`;

        if (scale) scale.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            const mark = document.createElement('div');
            mark.className = 'scale-mark';
            if (mark) mark.textContent = `${i.toString().padStart(2, '0')}:00`;
            if (scale) scale.appendChild(mark);
        }

        if (tracks) tracks.innerHTML = '';
        // Assume default segment is ~15 mins (900s) if not known
        const chunkDuration = 900; 
        
        currentPlaybackChunks.forEach(chunk => {
            const block = document.createElement('div');
            block.className = 'track-block';
            const leftPercent = (chunk.startSec / 86400) * 100;
            const widthPct = (chunkDuration / 86400) * 100;
            block.style.left = `${leftPercent}%`;
            block.style.width = `${widthPct}%`;
            
            if(block) block.addEventListener('click', (e) => {
                e.stopPropagation();
                playChunk(chunk, 0);
            });
            
            if (tracks) tracks.appendChild(block);
        });
    }

    function updateScrubberFromEvent(e) {
        const rect = scrollArea.getBoundingClientRect();
        let x = e.clientX - rect.left;
        if (x < 0) x = 0;
        if (x > rect.width) x = rect.width;
        const pct = (x / rect.width) * 100;
        if (scrubber) scrubber.style.left = `${pct}%`;
    }

    function seekToScrubberTime() {
        if (!currentPlaybackCam || !currentPlaybackDate || currentPlaybackChunks.length === 0) return;
        
        const pct = parseFloat(scrubber.style.left);
        const targetSec = (pct / 100) * 86400;
        
        const chunkDuration = 900;
        let foundChunk = currentPlaybackChunks.find(c => targetSec >= c.startSec && targetSec < c.startSec + chunkDuration);
        
        if (!foundChunk) {
            foundChunk = currentPlaybackChunks.slice().reverse().find(c => c.startSec <= targetSec);
        }
        
        if (foundChunk) {
            let offset = targetSec - foundChunk.startSec;
            if (offset < 0) offset = 0;
            playChunk(foundChunk, offset);
        }
    }

    function playChunk(chunk, offsetSec) {
        const camObj = cameras.find(c => c.id === currentPlaybackCam);
        const camName = camObj ? camObj.name : currentPlaybackCam;
        
        currentFileStartSec = chunk.startSec;
        const timePart = chunk.filename.replace('.mp4', '').replace('.ts', '').replace(/-/g, ':');
        if (pbTitle) pbTitle.textContent = `Memutar: ${camName} (${currentPlaybackDate} ${timePart})`;
        
        if (playbackPlayer) playbackPlayer.src = `/api/recordings/${currentPlaybackCam}/${currentPlaybackDate}/${chunk.filename}`;
        playbackPlayer.load();
        
        playbackPlayer.onloadedmetadata = () => {
            if (offsetSec > playbackPlayer.duration) offsetSec = 0;
            playbackPlayer.currentTime = offsetSec;
            playbackPlayer.play();
        };
        
        if (window.innerWidth <= 768) {
            closeMobileMenu();
        }
    }

    // Interactive scrubber events
    if(scrollArea) scrollArea.addEventListener('mousedown', (e) => {
        isDraggingScrubber = true;
        updateScrubberFromEvent(e);
    });
    if(window) window.addEventListener('mousemove', (e) => {
        if (isDraggingScrubber) updateScrubberFromEvent(e);
    });
    if(window) window.addEventListener('mouseup', (e) => {
        if (isDraggingScrubber) {
            isDraggingScrubber = false;
            updateScrubberFromEvent(e);
            seekToScrubberTime();
        }
    });

    // Touch support
    if(scrollArea) scrollArea.addEventListener('touchstart', (e) => {
        isDraggingScrubber = true;
        updateScrubberFromEvent(e.touches[0]);
    }, {passive: true});
    if(window) window.addEventListener('touchmove', (e) => {
        if (isDraggingScrubber) updateScrubberFromEvent(e.touches[0]);
    }, {passive: true});
    if(window) window.addEventListener('touchend', (e) => {
        if (isDraggingScrubber) {
            isDraggingScrubber = false;
            seekToScrubberTime();
        }
    });

    if(playbackPlayer) playbackPlayer.addEventListener('timeupdate', () => {
        if (isDraggingScrubber) return; 
        if (!currentFileStartSec) return;
        const currentSec = currentFileStartSec + playbackPlayer.currentTime;
        const pct = (currentSec / 86400) * 100;
        if (scrubber) scrubber.style.left = `${pct}%`;
    });
    
    if(playbackPlayer) playbackPlayer.addEventListener('ended', () => {
        const currentIndex = currentPlaybackChunks.findIndex(c => c.startSec === currentFileStartSec);
        if (currentIndex !== -1 && currentIndex + 1 < currentPlaybackChunks.length) {
            const nextChunk = currentPlaybackChunks[currentIndex + 1];
            playChunk(nextChunk, 0);
        }
    });

    async function fetchRecordings() {
        try {
            const res = await fetch('/api/recordings');
            recordingsMap = await res.json(); 
            
            if (selRecCam) selRecCam.innerHTML = '<option value="">-- Pilih Kamera --</option>';
            cameras.forEach(c => {
                const opt = document.createElement('option');
                if (opt) opt.value = c.id; if (opt) opt.textContent = c.name;
                if (selRecCam) selRecCam.appendChild(opt);
            });
            
            if (selRecDate) selRecDate.innerHTML = '<option>Pilih Kamera Dulu</option>';
            if (playbackList) playbackList.innerHTML = '';
        } catch (err) { console.error(err); }
    }

    if(selRecCam) selRecCam.addEventListener('change', () => {
        const camId = selRecCam.value;
        if (selRecDate) selRecDate.innerHTML = '';
        
        if (!camId || !recordingsMap[camId]) {
            if (selRecDate) selRecDate.innerHTML = '<option>Tidak ada rekaman</option>';
            if (playbackList) playbackList.innerHTML = '';
            return;
        }

        const dates = Object.keys(recordingsMap[camId]).sort().reverse();
        if (dates.length === 0) {
            if (selRecDate) selRecDate.innerHTML = '<option>Tidak ada rekaman</option>';
            if (playbackList) playbackList.innerHTML = '';
            return;
        }
        
        dates.forEach(d => {
            const opt = document.createElement('option');
            if (opt) opt.value = d; if (opt) opt.textContent = d;
            if (selRecDate) selRecDate.appendChild(opt);
        });
        
        renderPlaybackList();
    });

    if(selRecDate) selRecDate.addEventListener('change', renderPlaybackList);

    function renderPlaybackList() {
        if (playbackList) playbackList.innerHTML = '';
        currentPlaybackChunks = [];
        
        const camId = selRecCam.value;
        const date = selRecDate.value;
        
        if (!camId || !date || !recordingsMap[camId] || !recordingsMap[camId][date]) {
            renderTimeline();
            return;
        }

        currentPlaybackCam = camId;
        currentPlaybackDate = date;

        let files = recordingsMap[camId][date];
        files.sort(); 

        if(files.length === 0) {
            if (playbackList) playbackList.innerHTML = '<li>Tidak ada klip</li>';
            renderTimeline();
            return;
        }

        const camObj = cameras.find(c => c.id === camId);
        const camName = camObj ? camObj.name : camId;

        // Process files for timeline
        files.forEach(f => {
            currentPlaybackChunks.push({
                startSec: parseTimeToSeconds(f),
                duration: 900,
                filename: f
            });
        });
        
        // Sort for list (descending)
        const sortedDesc = [...files].reverse();

        sortedDesc.forEach(f => {
            const li = document.createElement('li');
            const timePart = f.replace('.mp4', '').replace('.ts', '').replace(/-/g, ':');
            
            if (li) li.innerHTML = `🎥 <span>${timePart}</span>`;
            
            if(li) li.addEventListener('click', () => {
                const chunk = currentPlaybackChunks.find(c => c.filename === f);
                if (chunk) {
                    playChunk(chunk, 0);
                }
            });
            
            if (playbackList) playbackList.appendChild(li);
        });

        // Update timeline
        renderTimeline();
    }

    // --- Modal Management (Settings) ---
    // replaced with nav routes

    if(btnCloseSettings && modal) btnCloseSettings.addEventListener('click', () => {
        if (modal) modal.classList.remove('active');
        resetForm();
    });

    // Main Modal Tabs
    stabBtns.forEach(btn => {
        if(btn) btn.addEventListener('click', (e) => {
            stabBtns.forEach(b => b.classList.remove('active'));
            stabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.getAttribute('data-target')); if (target) target.classList.add('active');
        });
    });

    // Inner Camera Tabs
    ctabBtns.forEach(btn => {
        if(btn) btn.addEventListener('click', (e) => {
            ctabBtns.forEach(b => b.classList.remove('active'));
            ctabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.getAttribute('data-target')); if (target) target.classList.add('active');
        });
    });

    // --- Armbian Real-time System Monitoring Engine ---
    async function updateSystemStats() {
        try {
            const res = await fetch('/api/system/stats');
            if (!res.ok) return;
            const data = await res.json();
            if (!data) return;

            // 1. CPU Usage (%)
            const topCpuVal = document.getElementById('topCpuVal');
            const sideCpuTemp = document.getElementById('sideCpuTemp');
            let cpuPct = 0;
            if (data.cpu) {
                cpuPct = data.cpu.usagePercent || 0;
                if (topCpuVal) topCpuVal.textContent = `${cpuPct}%`;
            }

            // 2. RAM Usage (%)
            const topRamVal = document.getElementById('topRamVal');
            const sideRam = document.getElementById('sideRam');
            if (data.ram) {
                const ramPct = (data.ram.usagePercent !== undefined ? data.ram.usagePercent : data.ram.usedPercent) || 0;
                if (topRamVal) topRamVal.textContent = `${ramPct}%`;
                if (sideRam) sideRam.textContent = `${ramPct}% (${data.ram.usedMB}MB / ${data.ram.totalMB}MB)`;
            }

            // 3. Suhu STB (°C)
            if (data.temp && sideCpuTemp) {
                const deg = data.temp.celsius || 0;
                if (sideCpuTemp) sideCpuTemp.textContent = `${cpuPct}% | ${deg}°C`;
            }

            // 4. Storage Utama
            const sideStorageIf = document.getElementById('sideStorageIf');
            const sideStorage = document.getElementById('sideStorage');
            if (data.storage) {
                const diskPct = data.storage.percentUsed || 0;
                const freeGB = data.storage.freeGB || 0;
                if (sideStorageIf) sideStorageIf.textContent = data.storage.path || 'Root';
                if (sideStorage) sideStorage.textContent = `${diskPct}% (${freeGB}GB sisa)`;
            }

            // 5. Interface Jaringan & Kecepatan
            const topNetVal = document.getElementById('topNetVal');
            const sideNetIf = document.getElementById('sideNetIf');
            const sideNetStatus = document.getElementById('sideNetStatus');
            if (data.network) {
                const ifName = data.network.interface || data.network.iface || 'eth0';
                const rxRate = data.network.rxSpeedFormatted || data.network.downSpeed || '0 KB/s';
                const txRate = data.network.txSpeedFormatted || data.network.upSpeed || '0 KB/s';
                
                if (topNetVal) topNetVal.textContent = `↓ ${rxRate} ↑ ${txRate}`;
                if (sideNetIf) sideNetIf.textContent = ifName;
                if (sideNetStatus) sideNetStatus.textContent = `↓ ${rxRate} | ↑ ${txRate}`;
            }
        } catch(err) {
            // Polling gagal secara anggun tanpa mengganggu UI
        }
    }

    function startSystemMonitoring() {
        if (sysMonitorInterval) clearInterval(sysMonitorInterval);
        updateSystemStats();
        // Polling statistik real-time setiap 3 detik
        sysMonitorInterval = setInterval(updateSystemStats, 3000);
    }

    // --- Auto-Detect & Konfigurasi Media Penyimpanan Rekaman (USB/HDD) ---
    async function fetchStorageDevices() {
        const selEl = document.getElementById('sysStorageDevice');
        const customInput = document.getElementById('sysCustomStoragePath');
        if (!selEl) return;

        try {
            if (selEl) selEl.innerHTML = '<option value="">Memindai drive penyimpanan...</option>';
            const res = await fetch('/api/system/storage-devices');
            if (!res.ok) throw new Error('Gagal memuat daftar perangkat penyimpanan');
            const data = await res.json();
            detectedStorageDevices = data.devices || [];

            if (selEl) selEl.innerHTML = '';
            const currentPath = data.currentStoragePath || '';

            if (detectedStorageDevices.length === 0) {
                if (selEl) selEl.innerHTML = '<option value="">Tidak ada media eksternal terdeteksi</option>';
            } else {
                detectedStorageDevices.forEach(dev => {
                    const opt = document.createElement('option');
                    if (opt) opt.value = dev.mountPath;
                    const icon = dev.category === 'External' ? '🔌 [USB/HDD]' : (dev.category === 'Internal' ? '💽 [Internal]' : '📁 [Kustom]');
                    if (opt) opt.textContent = `${icon} ${dev.name} • Sisa: ${dev.freeGB} GB (${dev.percentUsed}% terpakai)`;
                    if (dev.selected || dev.mountPath === currentPath) {
                        opt.selected = true;
                    }
                    if (selEl) selEl.appendChild(opt);
                });
            }

            const customOpt = document.createElement('option');
            if (customOpt) customOpt.value = '__custom__';
            if (customOpt) customOpt.textContent = '⚙️ Tentukan Jalur Folder Kustom...';
            if (selEl) selEl.appendChild(customOpt);

            if (customInput) {
                if (customInput) customInput.value = currentPath;
            }

            renderStoragePreview(selEl.value);
        } catch(err) {
            if (selEl) selEl.innerHTML = '<option value="">Gagal memindai perangkat</option>';
        }
    }

    function renderStoragePreview(selectedPath) {
        const previewBox = document.getElementById('storageDevicePreview');
        if (!previewBox) return;

        if (!selectedPath || selectedPath === '__custom__') {
            if (previewBox) previewBox.style.display = 'none';
            return;
        }

        const dev = detectedStorageDevices.find(d => d.mountPath === selectedPath);
        if (!dev) {
            if (previewBox) previewBox.style.display = 'none';
            return;
        }

        if (previewBox) previewBox.style.display = 'block';
        const nameEl = document.getElementById('stPreviewName');
        const mountEl = document.getElementById('stPreviewMount');
        const capEl = document.getElementById('stPreviewCapacity');
        const freeEl = document.getElementById('stPreviewFree');
        const fillEl = document.getElementById('stPreviewFill');

        if (nameEl) nameEl.textContent = `Drive: ${dev.name}`;
        if (mountEl) mountEl.textContent = dev.mountPath;
        if (capEl) capEl.textContent = `Total: ${dev.totalGB} GB (${dev.percentUsed}% Terpakai)`;
        if (freeEl) freeEl.textContent = `Sisa: ${dev.freeGB} GB`;
        if (fillEl) {
            fillEl.style.width = `${Math.min(100, Math.max(0, dev.percentUsed))}%`;
            fillEl.style.backgroundColor = dev.percentUsed > 85 ? '#ef4444' : (dev.percentUsed > 65 ? '#f59e0b' : '#3b82f6');
        }
    }

    // Storage selection change listener
    const sysStorageSelect = document.getElementById('sysStorageDevice');
    if (sysStorageSelect) {
        if(sysStorageSelect) sysStorageSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const customInput = document.getElementById('sysCustomStoragePath');
            if (val === '__custom__') {
                if (customInput) {
                    customInput.focus();
                }
                renderStoragePreview('');
            } else {
                if (customInput) {
                    if (customInput) customInput.value = val;
                }
                renderStoragePreview(val);
            }
        });
    }

    const btnRefreshStorage = document.getElementById('btnRefreshStorage');
    if (btnRefreshStorage) {
        if(btnRefreshStorage) btnRefreshStorage.addEventListener('click', () => {
            fetchStorageDevices();
        });
    }

    const sysCustomStorageInput = document.getElementById('sysCustomStoragePath');
    if (sysCustomStorageInput) {
        if(sysCustomStorageInput) sysCustomStorageInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            const matched = detectedStorageDevices.find(d => d.mountPath === val);
            if (matched) {
                if (sysStorageSelect) sysStorageSelect.value = matched.mountPath;
                renderStoragePreview(matched.mountPath);
            } else {
                if (sysStorageSelect) sysStorageSelect.value = '__custom__';
                renderStoragePreview('');
            }
        });
    }

    async function fetchSystemSettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            const el_sysTgBot = document.getElementById('sysTgBot'); if (el_sysTgBot) el_sysTgBot.value = data.telegramBotToken || '';
            const el_sysTgChat = document.getElementById('sysTgChat'); if (el_sysTgChat) el_sysTgChat.value = data.telegramChatId || '';
            const el_sysP2pServer = document.getElementById('sysP2pServer'); if (el_sysP2pServer) el_sysP2pServer.value = data.p2pServer || '';
            
            const recQ = data.recordingQuality || 'main';
            const sysRecEl = document.getElementById('sysRecordingQuality');
            if (sysRecEl) sysRecEl.value = recQ;
            const globRecEl = document.getElementById('globalRecordingQuality');
            if (globRecEl) globRecEl.value = recQ;

            const mPort = data.mediamtxPort || 8889;
            const sysPortEl = document.getElementById('sysMediaMtxPort');
            if (sysPortEl) sysPortEl.value = mPort;
            mediamtxPort = mPort;

            const mHost = data.mediamtxHost || '';
            const sysHostEl = document.getElementById('sysMediaMtxHost');
            if (sysHostEl) sysHostEl.value = mHost;
            mediamtxHost = mHost;

            const sysShowTopMonitor = data.showTopMonitor !== undefined ? data.showTopMonitor : false;
            const topMonEl = document.getElementById('sysShowTopMonitor');
            if (topMonEl) topMonEl.checked = sysShowTopMonitor;
            const compactBar = document.getElementById('sysMonitorBarCompact');
            if (compactBar) compactBar.style.display = sysShowTopMonitor ? 'flex' : 'none';

            const sysNetInterface = data.netInterface || 'auto';
            const netIfEl = document.getElementById('sysNetInterface');
            if (netIfEl) netIfEl.value = sysNetInterface;

            const pMode = data.playerMode || 'iframe';
            const sysPlayerEl = document.getElementById('sysPlayerMode');
            if (sysPlayerEl) sysPlayerEl.value = pMode;
            playerMode = pMode;

            if (data.recordingPath) {
                const customInput = document.getElementById('sysCustomStoragePath');
                if (customInput) customInput.value = data.recordingPath;
            }
        } catch(e) {}
    }

    const systemForm = document.getElementById('systemForm'); if(systemForm) systemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const recQ = document.getElementById('sysRecordingQuality')?.value || 'main';
        const mPort = parseInt(document.getElementById('sysMediaMtxPort')?.value || '8889', 10);
        const mHost = (document.getElementById('sysMediaMtxHost')?.value || '').trim();
        const pMode = document.getElementById('sysPlayerMode')?.value || 'iframe';
        const showTop = document.getElementById('sysShowTopMonitor')?.checked || false;
        const netIf = document.getElementById('sysNetInterface')?.value || 'auto';
        const chosenStorage = (document.getElementById('sysCustomStoragePath')?.value || '').trim();

        // 1. Simpan Jalur Penyimpanan Rekaman (USB/HDD) jika ditentukan
        if (chosenStorage) {
            try {
                const storageRes = await fetch('/api/system/storage-devices/select', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ storagePath: chosenStorage })
                });
                const storageData = await storageRes.json();
                if (!storageRes.ok) {
                    alert(`Peringatan Penyimpanan: ${storageData.error || 'Gagal mengatur jalur penyimpanan'}`);
                }
            } catch(stErr) {
                console.warn('Gagal menyimpan storage:', stErr);
            }
        }

        // 2. Simpan Pengaturan Sistem & MediaMTX
        const payload = {
            recordingQuality: recQ,
            mediamtxPort: mPort,
            mediamtxHost: mHost,
            playerMode: pMode,
            showTopMonitor: showTop,
            netInterface: netIf,
            recordingPath: chosenStorage,
            p2pServer: document.getElementById('sysP2pServer').value,
            telegramBotToken: document.getElementById('sysTgBot').value,
            telegramChatId: document.getElementById('sysTgChat').value
        };

        await fetch('/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        mediamtxPort = mPort;
        mediamtxHost = mHost;
        playerMode = pMode;
        
        const compactBar = document.getElementById('sysMonitorBarCompact');
        if (compactBar) compactBar.style.display = showTop ? 'flex' : 'none';

        const globRecEl = document.getElementById('globalRecordingQuality');
        if (globRecEl) globRecEl.value = recQ;

        // Segera perbarui monitoring bar
        updateSystemStats();

        alert('Pengaturan Sistem, MediaMTX, dan Media Penyimpanan Rekaman berhasil disimpan!');
        renderGrid(currentGridCount);
    });

    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        if(changePasswordForm) changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const oldPassword = document.getElementById('oldPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            
            try {
                const res = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ oldPassword, newPassword })
                });
                const data = await res.json();
                
                if (res.ok && data.success) {
                    alert('Password berhasil diubah. Silakan login kembali.');
                    await fetch('/api/auth/logout', { method: 'POST' });
                    window.location.reload();
                } else {
                    alert(data.error || 'Gagal mengubah password');
                }
            } catch(e) {
                alert('Terjadi kesalahan saat mengubah password');
            }
        });
    }

    function renderModalList() {
        const list = document.getElementById('modalCameraList');
        if (list) list.innerHTML = '';
        if (cameras.length === 0) { if (list) list.innerHTML = '<div style="padding:1rem;">Belum ada kamera</div>'; return; }

        cameras.forEach(cam => {
            const div = document.createElement('div');
            div.className = 'modal-camera-item';
            if (!cam.enabled) div.style.opacity = '0.5';
            
            if (div) div.innerHTML = `
                <div>
                    <strong>${cam.name}</strong> 
                    ${!cam.enabled ? '<span class="badge" style="background:var(--text-muted);">OFF</span>' : ''}
                    ${cam.recordMode === 'continuous' ? '<span class="badge" style="background:var(--accent);">REC</span>' : ''}
                    <br>
                    <small style="color:var(--text-muted);">${cam.mainStreamUrl}</small>
                </div>
                <div class="cam-actions">
                    <button class="btn-sm btn-edit" onclick="editCamera('${cam.id}')">Edit</button>
                    <button class="btn-sm btn-delete" onclick="deleteCamera('${cam.id}')">Hapus</button>
                </div>
            `;
            if (list) list.appendChild(div);
        });
    }

    window.editCamera = function(id) {
        const cam = cameras.find(c => c.id === id);
        if (cam) {
            const el_camId = document.getElementById('camId'); if (el_camId) el_camId.value = cam.id;
            const el2_camEnabled = document.getElementById('camEnabled'); if (el2_camEnabled) el2_camEnabled.checked = cam.enabled;
            const el_camName = document.getElementById('camName'); if (el_camName) el_camName.value = cam.name;
            
            const el_camMainUrl = document.getElementById('camMainUrl'); if (el_camMainUrl) el_camMainUrl.value = cam.mainStreamUrl;
            const el_camSubUrl = document.getElementById('camSubUrl'); if (el_camSubUrl) el_camSubUrl.value = cam.subStreamUrl !== cam.mainStreamUrl ? cam.subStreamUrl : '';
            if (document.getElementById('camTranscode')) {
                const el_camTranscode = document.getElementById('camTranscode'); if (el_camTranscode) el_camTranscode.value = cam.transcode || 'auto';
            }
            
            const el_camRecordMode = document.getElementById('camRecordMode'); if (el_camRecordMode) el_camRecordMode.value = cam.recordMode;
            const el_camStoragePath = document.getElementById('camStoragePath'); if (el_camStoragePath) el_camStoragePath.value = cam.storagePath.includes('public/recordings') ? '' : cam.storagePath;
            const el_camMaxDays = document.getElementById('camMaxDays'); if (el_camMaxDays) el_camMaxDays.value = cam.maxStorageDays;
            const el_camMaxGB = document.getElementById('camMaxGB'); if (el_camMaxGB) el_camMaxGB.value = cam.maxFolderSizeGB;
            const el_camSegmentSec = document.getElementById('camSegmentSec'); if (el_camSegmentSec) el_camSegmentSec.value = cam.segmentDurationSec;

            const formTitle = document.getElementById('formTitle'); if(formTitle) if (formTitle) formTitle.textContent = `Edit Kamera: ${cam.name}`;
            if (btnCancelEdit) btnCancelEdit.style.display = 'block';
            
            // Switch to General Tab automatically
            ctabBtns[0].click();
        }
    };

    function resetForm() {
        cameraForm.reset();
        const el_camId = document.getElementById('camId'); if (el_camId) el_camId.value = '';
        if (document.getElementById('camTranscode')) {
            const el_camTranscode = document.getElementById('camTranscode'); if (el_camTranscode) el_camTranscode.value = 'auto';
        }
        const formTitle = document.getElementById('formTitle'); if(formTitle) if (formTitle) formTitle.textContent = "Tambah / Edit Kamera";
        if (btnCancelEdit) btnCancelEdit.style.display = 'none';
        ctabBtns[0].click();
    }

    if(btnCancelEdit) btnCancelEdit.addEventListener('click', resetForm);

    if(cameraForm) cameraForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('camId').value;
        const payload = {
            name: document.getElementById('camName').value,
            enabled: document.getElementById('camEnabled').checked,
            mainStreamUrl: document.getElementById('camMainUrl').value,
            subStreamUrl: document.getElementById('camSubUrl').value,
            transcode: document.getElementById('camTranscode') ? document.getElementById('camTranscode').value : 'auto',
            recordMode: document.getElementById('camRecordMode').value,
            storagePath: document.getElementById('camStoragePath').value,
            maxStorageDays: document.getElementById('camMaxDays').value,
            maxFolderSizeGB: document.getElementById('camMaxGB').value,
            segmentDurationSec: document.getElementById('camSegmentSec').value
        };

        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/cameras/${id}` : '/api/cameras';
            
            await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            resetForm();
            fetchCameras();
        } catch (err) { alert('Gagal menyimpan kamera'); }
    });

    window.deleteCamera = async function(id) {
        if(confirm('Yakin ingin menghapus kamera ini? Semua pengaturan akan dihapus (File MP4 di disk tetap aman).')) {
            try {
                await fetch(`/api/cameras/${id}`, { method: 'DELETE' });
                fetchCameras();
            } catch (err) { alert('Gagal menghapus kamera'); }
        }
    };

    // Mulai eksekusi sudah ditangani oleh checkAuth()
});
