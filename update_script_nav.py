import re

with open('public/script.js', 'r') as f:
    js = f.read()

nav_logic = """
    // Navigasi Baru
    const navItems = document.querySelectorAll('.nav-item, .nav-subitem');
    const btnMobileMenu = document.getElementById('btnMobileMenu');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if(btnMobileMenu) {
        btnMobileMenu.addEventListener('click', () => {
            sidebar.classList.add('mobile-open');
            sidebarOverlay.classList.add('active');
        });
    }

    if(sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        });
    }

    window.toggleNavGroup = function(headerEl) {
        headerEl.parentElement.classList.toggle('open');
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
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
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
            }
        });
    });
"""

# We don't want to break the script entirely, we can just append it before the end, and comment out the old `tabBtns` and `layoutBtns`.
js = js.replace("""    // --- Navigasi Tabs Utama ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            viewPanes.forEach(p => p.classList.remove('active'));
            sidePanels.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            
            if (targetId === 'view-live') {
                document.getElementById('side-live').classList.add('active');
            } else if (targetId === 'view-playback') {
                document.getElementById('side-playback').classList.add('active');
                fetchRecordings();
            } else if (targetId === 'view-storage') {
                document.getElementById('side-storage').classList.add('active');
                fetchStorageOptions();
            } else if (targetId === 'view-logs') {
                document.getElementById('side-logs').classList.add('active');
                fetchLogs();
            } else if (targetId === 'view-sysmonitor') {
                document.getElementById('side-sysmonitor').classList.add('active');
            }
            
            if (window.innerWidth <= 768) {
                // Jangan tutup otomatis saat pindah tab agar user bisa memilih opsi
            }
        });
    });""", "    /* OLD TAB NAV REMOVED */" + nav_logic)

# Replace old layoutBtns logic
js = js.replace("""    // --- Grid Layout & Dual Stream ---
    layoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            layoutBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const count = parseInt(btn.getAttribute('data-grid'));
            currentGridCount = count;
            
            videoGrid.className = 'video-grid';
            videoGrid.classList.add(`grid-${count}`);
            
            renderVideoGrid();
            
            if (window.innerWidth <= 768) {
                // Auto tutup menu di mobile
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
            }
        });
    });""", """    // --- Grid Layout & Dual Stream ---
    layoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            layoutBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Activate Live View Pane
            viewPanes.forEach(p => p.classList.remove('active'));
            document.getElementById('view-live').classList.add('active');
            
            navItems.forEach(i => i.classList.remove('active'));
            btn.classList.add('active');
            
            if (btn.closest('.nav-group')) btn.closest('.nav-group').classList.add('open');
            
            const count = parseInt(btn.getAttribute('data-grid'));
            currentGridCount = count;
            
            videoGrid.className = 'video-grid';
            videoGrid.classList.add(`grid-${count}`);
            
            renderVideoGrid();
            
            if (window.innerWidth <= 768) {
                // Auto tutup menu di mobile
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
            }
        });
    });""")

# Remove old Modal Open Logic (btnSettings)
js = js.replace("""    // --- Modal Management (Settings) ---
    btnSettings.addEventListener('click', () => {
        modal.classList.add('active');
        fetchSystemSettings();
        fetchStorageDevices();
        renderModalList();
    });""", """    // --- Modal Management (Settings) ---
    // replaced with nav routes""")

# In `fetchCameras` we used to call renderModalList() when modal was open, we can just call it
js = js.replace("""        if (modal.classList.contains('active')) {
            renderModalList();
        }""", """        renderModalList();""")

with open('public/script.js', 'w') as f:
    f.write(js)
