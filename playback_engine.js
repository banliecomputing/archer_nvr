let recordingsMap = {};
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
        btn.addEventListener('click', (e) => {
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
        scrollArea.style.width = `${widthPercent}%`;

        scale.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            const mark = document.createElement('div');
            mark.className = 'scale-mark';
            mark.textContent = `${i.toString().padStart(2, '0')}:00`;
            scale.appendChild(mark);
        }

        tracks.innerHTML = '';
        // Assume default segment is ~15 mins (900s) if not known
        const chunkDuration = 900; 
        
        currentPlaybackChunks.forEach(chunk => {
            const block = document.createElement('div');
            block.className = 'track-block';
            const leftPercent = (chunk.startSec / 86400) * 100;
            const widthPct = (chunkDuration / 86400) * 100;
            block.style.left = `${leftPercent}%`;
            block.style.width = `${widthPct}%`;
            
            block.addEventListener('click', (e) => {
                e.stopPropagation();
                playChunk(chunk, 0);
            });
            
            tracks.appendChild(block);
        });
    }

    function updateScrubberFromEvent(e) {
        const rect = scrollArea.getBoundingClientRect();
        let x = e.clientX - rect.left;
        if (x < 0) x = 0;
        if (x > rect.width) x = rect.width;
        const pct = (x / rect.width) * 100;
        scrubber.style.left = `${pct}%`;
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
        pbTitle.textContent = `Memutar: ${camName} (${currentPlaybackDate} ${timePart})`;
        
        playbackPlayer.src = `/api/recordings/${currentPlaybackCam}/${currentPlaybackDate}/${chunk.filename}`;
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
    scrollArea.addEventListener('mousedown', (e) => {
        isDraggingScrubber = true;
        updateScrubberFromEvent(e);
    });
    window.addEventListener('mousemove', (e) => {
        if (isDraggingScrubber) updateScrubberFromEvent(e);
    });
    window.addEventListener('mouseup', (e) => {
        if (isDraggingScrubber) {
            isDraggingScrubber = false;
            updateScrubberFromEvent(e);
            seekToScrubberTime();
        }
    });

    // Touch support
    scrollArea.addEventListener('touchstart', (e) => {
        isDraggingScrubber = true;
        updateScrubberFromEvent(e.touches[0]);
    }, {passive: true});
    window.addEventListener('touchmove', (e) => {
        if (isDraggingScrubber) updateScrubberFromEvent(e.touches[0]);
    }, {passive: true});
    window.addEventListener('touchend', (e) => {
        if (isDraggingScrubber) {
            isDraggingScrubber = false;
            seekToScrubberTime();
        }
    });

    playbackPlayer.addEventListener('timeupdate', () => {
        if (isDraggingScrubber) return; 
        if (!currentFileStartSec) return;
        const currentSec = currentFileStartSec + playbackPlayer.currentTime;
        const pct = (currentSec / 86400) * 100;
        scrubber.style.left = `${pct}%`;
    });
    
    playbackPlayer.addEventListener('ended', () => {
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
            
            selRecCam.innerHTML = '<option value="">-- Pilih Kamera --</option>';
            cameras.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id; opt.textContent = c.name;
                selRecCam.appendChild(opt);
            });
            
            selRecDate.innerHTML = '<option>Pilih Kamera Dulu</option>';
            playbackList.innerHTML = '';
        } catch (err) { console.error(err); }
    }

    selRecCam.addEventListener('change', () => {
        const camId = selRecCam.value;
        selRecDate.innerHTML = '';
        
        if (!camId || !recordingsMap[camId]) {
            selRecDate.innerHTML = '<option>Tidak ada rekaman</option>';
            playbackList.innerHTML = '';
            return;
        }

        const dates = Object.keys(recordingsMap[camId]).sort().reverse();
        if (dates.length === 0) {
            selRecDate.innerHTML = '<option>Tidak ada rekaman</option>';
            playbackList.innerHTML = '';
            return;
        }
        
        dates.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d; opt.textContent = d;
            selRecDate.appendChild(opt);
        });
        
        renderPlaybackList();
    });

    selRecDate.addEventListener('change', renderPlaybackList);

    function renderPlaybackList() {
        playbackList.innerHTML = '';
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
            playbackList.innerHTML = '<li>Tidak ada klip</li>';
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
            
            li.innerHTML = `🎥 <span>${timePart}</span>`;
            
            li.addEventListener('click', () => {
                const chunk = currentPlaybackChunks.find(c => c.filename === f);
                if (chunk) {
                    playChunk(chunk, 0);
                }
            });
            
            playbackList.appendChild(li);
        });

        // Update timeline
        renderTimeline();
    }
