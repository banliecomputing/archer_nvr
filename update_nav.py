import re

with open('public/script.js', 'r') as f:
    js = f.read()

# Replace tabBtns and viewPanes logic
nav_logic = """
    // Navigasi Baru
    const navItems = document.querySelectorAll('.nav-item, .nav-subitem');
    const viewPanes = document.querySelectorAll('.view-pane');
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
            if (targetId === 'view-setting-cameras') renderCameraList(cameras);

            if (window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
            }
        });
    });

    // Menangani klik pada layout buttons di sidebar
    const layoutBtns = document.querySelectorAll('.layout-btn');
    layoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Activate Live View Pane
            viewPanes.forEach(p => p.classList.remove('active'));
            document.getElementById('view-live').classList.add('active');
            
            navItems.forEach(i => i.classList.remove('active'));
            btn.classList.add('active');
            // Buka grup parent jika tertutup
            if (btn.closest('.nav-group')) btn.closest('.nav-group').classList.add('open');

            const count = parseInt(btn.getAttribute('data-grid'));
            currentGridCount = count;
            
            videoGrid.className = 'video-grid';
            videoGrid.classList.add(`grid-${count}`);
            
            renderVideoGrid();
            
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
            }
        });
    });
"""

# Find where to replace
# We can replace from "// Referensi Navigasi Tabs Utama & Sidebar" up to "// --- Fetch System Logs ---"
js = re.sub(r'// Referensi Navigasi Tabs Utama & Sidebar.*?// --- Fetch System Logs ---', nav_logic + '\n    // --- Fetch System Logs ---', js, flags=re.DOTALL)

with open('public/script.js', 'w') as f:
    f.write(js)
