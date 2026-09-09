import express from 'express';
import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_nvr_key_2026';

app.use(express.json());
app.use(cookieParser());

// Paths
const publicDir = path.join(__dirname, 'public');
const streamBaseDir = path.join(publicDir, 'streams');
const dbFile = path.join(__dirname, 'cameras.json');
const settingsFile = path.join(__dirname, 'settings.json');
const dataDir = path.join(__dirname, 'data');
const nvrDbFile = path.join(dataDir, 'nvr.db.json');
const baseStoragePath = process.env.STORAGE_PATH || path.join(__dirname, 'public', 'recordings');

// MediaMTX Paths (~/mediamtx.yml)
const homeDir = os.homedir() || process.env.HOME || '/root';
const mediamtxConfigFile = process.env.MEDIAMTX_CONFIG_PATH || path.join(homeDir, 'mediamtx.yml');

// Ensure directories
[streamBaseDir, dataDir, baseStoragePath].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify([]));
if (!fs.existsSync(settingsFile)) fs.writeFileSync(settingsFile, JSON.stringify({ telegramBotToken: "", telegramChatId: "" }));

function getNvrDb() {
    try { return JSON.parse(fs.readFileSync(nvrDbFile, 'utf8')); }
    catch (e) { return { recordings: [], system_logs: [], users: [] }; }
}
function saveNvrDb(data) {
    fs.writeFileSync(nvrDbFile, JSON.stringify(data, null, 2));
}

// Logger
function sysLog(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
    try {
        const dbData = getNvrDb();
        if (!dbData.system_logs) dbData.system_logs = [];
        dbData.system_logs.push({ id: Date.now(), timestamp, level, message });
        if (dbData.system_logs.length > 1000) dbData.system_logs.shift(); // Keep last 1000 logs
        saveNvrDb(dbData);
    } catch (e) {}
}

// Global Variables
let cameras = [];
let ffProcesses = {}; // { 'cam1': { main: ChildProcess, sub: ChildProcess } }
let reconnectTimers = {};
let cameraStatuses = {}; // camId -> { main: { status, error, lastUpdate }, sub: { status, error, lastUpdate } }
let settings = {};

function getSettings() {
    try { 
        const s = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        if (!s.recordingQuality) s.recordingQuality = 'main';
        if (!s.globalStorageMode) s.globalStorageMode = 'disabled';
        if (!s.mediamtxPort) s.mediamtxPort = 8889;
        if (s.mediamtxHost === undefined) s.mediamtxHost = '';
        return s;
    }
    catch (e) { 
        return { globalStorageMode: 'disabled', globalStoragePath: '', recordingQuality: 'main', mediamtxPort: 8889, mediamtxHost: '' }; 
    }
}
function getCameras() {
    try { return JSON.parse(fs.readFileSync(dbFile, 'utf8')); }
    catch (e) { return []; }
}
function saveCameras(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
    cameras = data;
}

function resolveStoragePath(camPath) {
    if (path.isAbsolute(camPath)) return camPath;
    return path.join(__dirname, camPath);
}

function getActualBaseStoragePath() {
    if (settings.globalStoragePath && settings.globalStoragePath.trim() !== '') {
        return settings.globalStoragePath;
    }
    return baseStoragePath;
}

// Database Initialization
function initDB() {
    if (!fs.existsSync(nvrDbFile)) {
        saveNvrDb({ recordings: [], system_logs: [], users: [] });
    } else {
        // Ensure users array exists
        const data = getNvrDb();
        if (!data.users) {
            data.users = [];
            saveNvrDb(data);
        }
    }
    sysLog('INFO', 'JSON Local Database Initialized');
}

// Auth Middleware
function verifyToken(req, res, next) {
    const token = req.cookies.nvr_auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized' });
        req.userId = decoded.id;
        next();
    });
}

// Auth Endpoints
app.get('/api/auth/status', (req, res) => {
    const dbData = getNvrDb();
    const hasUsers = dbData.users && dbData.users.length > 0;
    
    let authenticated = false;
    const token = req.cookies.nvr_auth_token;
    if (token) {
        try {
            jwt.verify(token, JWT_SECRET);
            authenticated = true;
        } catch (e) {}
    }
    
    res.json({ needSetup: !hasUsers, authenticated });
});

app.post('/api/auth/setup', (req, res) => {
    const dbData = getNvrDb();
    if (dbData.users && dbData.users.length > 0) {
        return res.status(400).json({ error: 'Setup already complete' });
    }
    
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    
    const hashedPassword = bcrypt.hashSync(password, 8);
    const user = { id: Date.now().toString(), username, password: hashedPassword };
    
    dbData.users = [user];
    saveNvrDb(dbData);
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('nvr_auth_token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const dbData = getNvrDb();
    const user = (dbData.users || []).find(u => u.username === username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('nvr_auth_token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('nvr_auth_token');
    res.json({ success: true });
});

app.post('/api/auth/change-password', verifyToken, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    
    const dbData = getNvrDb();
    const userIndex = (dbData.users || []).findIndex(u => u.id === req.userId);
    
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const user = dbData.users[userIndex];
    if (!bcrypt.compareSync(oldPassword, user.password)) {
        return res.status(401).json({ error: 'Password lama salah' });
    }
    
    const hashedPassword = bcrypt.hashSync(newPassword, 8);
    dbData.users[userIndex].password = hashedPassword;
    saveNvrDb(dbData);
    
    res.json({ success: true });
});

// Background Sync Task
function syncRecordingsToDB() {
    const cams = getCameras();
    const dbData = getNvrDb();
    dbData.recordings = [];
    
    for (const cam of cams) {
        if (cam.recordMode !== 'continuous') continue;
        const storageDir = resolveStoragePath(cam.storagePath || path.join(getActualBaseStoragePath(), cam.id));
        if (!fs.existsSync(storageDir)) continue;

        try {
            const dates = fs.readdirSync(storageDir).filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f));
            for (const date of dates) {
                const datePath = path.join(storageDir, date);
                if (fs.lstatSync(datePath).isDirectory()) {
                    const files = fs.readdirSync(datePath).filter(f => f.endsWith('.mp4') || f.endsWith('.ts'));
                    for (const f of files) {
                        const filePath = path.join(datePath, f);
                        const stats = fs.statSync(filePath);
                        dbData.recordings.push({
                            id: `${cam.id}_${f}`,
                            camera_id: cam.id,
                            file_path: filePath,
                            file_size: stats.size,
                            start_time: new Date(stats.mtimeMs).toISOString()
                        });
                    }
                }
            }
        } catch (e) {
            sysLog('ERROR', `Sync failed for ${cam.id}: ${e.message}`);
        }
    }
    saveNvrDb(dbData);
}

// Notification Helper
async function sendTelegramAlert(msg) {
    if (!settings.telegramBotToken || !settings.telegramChatId) return;
    const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ chat_id: settings.telegramChatId, text: `🚨 NVR Alert:\n${msg}` })
        });
    } catch(e) { sysLog('ERROR', `Telegram gagal: ${e.message}`); }
}

// Folders Setup for FFmpeg
function ensureRecordFolders() {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    getCameras().forEach(cam => {
        if (cam.recordMode === 'continuous') {
            const base = resolveStoragePath(cam.storagePath || path.join(getActualBaseStoragePath(), cam.id));
            [today, tomorrow].forEach(date => {
                const d = path.join(base, date);
                if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
            });
        }
    });
}

function sanitizeRtspUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let clean = url.trim();
    if (!clean) return '';
    if (clean.toLowerCase() === 'demo' || clean.toLowerCase() === 'test') return 'demo';

    // If starts with :// (e.g. ://192.168.1.5)
    clean = clean.replace(/^:\/\//, 'rtsp://');

    // If starts with colon before IP/host (e.g. :192.168.1.5/live) without scheme
    if (!/^[a-zA-Z]+:\/\//.test(clean)) {
        if (clean.startsWith(':')) {
            clean = clean.replace(/^:+/, '');
        }
        clean = 'rtsp://' + clean;
    }

    // Parse scheme and rest
    const schemeMatch = clean.match(/^([a-zA-Z]+:\/\/)(.*)$/);
    if (!schemeMatch) return clean;
    const scheme = schemeMatch[1];
    let rest = schemeMatch[2].trim();

    // Clean stray leading colon right after scheme without username, e.g. rtsp://:192.168.1.5/live/ch00_1
    const firstSlash = rest.search(/[\/\?]/);
    const authOrHostPart = firstSlash === -1 ? rest : rest.substring(0, firstSlash);

    if (rest.startsWith(':@')) {
        rest = rest.substring(2);
    } else if (rest.startsWith('@')) {
        rest = rest.substring(1);
    } else if (rest.startsWith(':') && !authOrHostPart.includes('@')) {
        rest = rest.replace(/^:+/, '');
    }

    // Handle stray colon before host when credentials exist: rtsp://admin:pass@:192.168.1.5
    rest = rest.replace(/@:+/, '@');

    // Separate auth credentials from host/port/path
    const atIdx = rest.lastIndexOf('@');
    const userAuth = atIdx !== -1 ? rest.substring(0, atIdx + 1) : '';
    const afterAuth = atIdx !== -1 ? rest.substring(atIdx + 1) : rest;

    const pathIdx = afterAuth.search(/[\/\?]/);
    const hostPort = pathIdx !== -1 ? afterAuth.substring(0, pathIdx) : afterAuth;
    const pathQuery = pathIdx !== -1 ? afterAuth.substring(pathIdx) : '';

    // Check port (standard RTSP port is 554)
    let newHostPort = hostPort;
    if (hostPort.startsWith('[')) {
        // IPv6 bracketed address e.g. [::1]
        const closeBracket = hostPort.indexOf(']');
        if (closeBracket !== -1) {
            const afterBracket = hostPort.substring(closeBracket + 1);
            if (!afterBracket.startsWith(':')) {
                newHostPort = `${hostPort}:554`;
            }
        }
    } else if (!hostPort.includes(':')) {
        // IPv4 or hostname without port, default to :554
        if (hostPort.length > 0) {
            newHostPort = `${hostPort}:554`;
        }
    }

    return `${scheme}${userAuth}${newHostPort}${pathQuery}`;
}

function formatStreamUrl(url) {
    return sanitizeRtspUrl(url);
}

function cleanStreamDir(camId, streamType) {
    try {
        const streamDir = path.join(streamBaseDir, camId);
        if (!fs.existsSync(streamDir)) {
            fs.mkdirSync(streamDir, { recursive: true });
        } else {
            const files = fs.readdirSync(streamDir);
            for (const file of files) {
                if (file.startsWith(streamType)) {
                    try { fs.unlinkSync(path.join(streamDir, file)); } catch (e) {}
                }
            }
        }
    } catch (e) {}
}

// Auto-cleanup segmen .ts lama agar penyimpanan internal STB Armbian tidak membengkak
function autoCleanupTempSegments() {
    try {
        if (!fs.existsSync(streamBaseDir)) return;
        const camDirs = fs.readdirSync(streamBaseDir);
        const now = Date.now();
        // HLS segmen 0.5 detik dengan playlist 2 item (~1 detik active window).
        // File segmen lebih dari 15 detik sudah aman dihapus dari disk.
        const MAX_AGE_MS = 15 * 1000;

        for (const dirName of camDirs) {
            const camDir = path.join(streamBaseDir, dirName);
            try {
                if (!fs.statSync(camDir).isDirectory()) continue;
                const files = fs.readdirSync(camDir);
                for (const file of files) {
                    if (file.endsWith('.ts')) {
                        const filePath = path.join(camDir, file);
                        try {
                            const stat = fs.statSync(filePath);
                            if (now - stat.mtimeMs > MAX_AGE_MS) {
                                fs.unlinkSync(filePath);
                            }
                        } catch (e) {}
                    }
                }
            } catch (e) {}
        }
    } catch (err) {}
}

const detectedCodecs = {};

function probeCodec(url) {
    return new Promise((resolve) => {
        if (!url || typeof url !== 'string') return resolve(null);
        if (url === 'demo') return resolve('h264');
        const cmd = `ffprobe -v error -err_detect ignore_err -rtsp_transport tcp -analyzeduration 1000000 -probesize 1000000 -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${url}"`;
        exec(cmd, { timeout: 3500 }, (err, stdout) => {
            if (err || !stdout) return resolve(null);
            const codec = stdout.trim().toLowerCase();
            resolve(codec);
        });
    });
}

// --- MEDIAMTX CONFIGURATION ENGINE ---
// Auto-Generate ~/mediamtx.yml dan restart MediaMTX via PM2
function syncMediaMtxConfig() {
    try {
        const currentSettings = getSettings();
        const webrtcPort = (currentSettings && currentSettings.mediamtxPort) ? currentSettings.mediamtxPort : 8889;
        const cams = getCameras();
        
        let lines = [
            'api: yes',
            'apiAddress: :9997',
            `webrtcAddress: :${webrtcPort}`,
            'hlsAddress: :8880',
            '',
            'paths:'
        ];
        let activeCount = 0;

        cams.forEach(cam => {
            if (!cam.enabled) return;
            const safeId = (cam.id || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
            if (!safeId) return;

            const mainUrl = formatStreamUrl(cam.mainStreamUrl);
            const subUrl = formatStreamUrl(cam.subStreamUrl);

            if (mainUrl) {
                lines.push(`  ${safeId}:`);
                lines.push(`    source: ${mainUrl}`);
                activeCount++;
            }

            if (subUrl && subUrl !== mainUrl) {
                lines.push(`  ${safeId}_sub:`);
                lines.push(`    source: ${subUrl}`);
                activeCount++;
            }
        });

        if (activeCount === 0) {
            lines.push('  all_others:');
        }

        const yamlContent = lines.join('\n') + '\n';

        // Tulis konfigurasi utama ke ~/mediamtx.yml
        fs.writeFileSync(mediamtxConfigFile, yamlContent, 'utf8');
        sysLog('INFO', `[MediaMTX] Konfigurasi berhasil disinkronkan ke ${mediamtxConfigFile} (${activeCount} stream aktif, WebRTC :${webrtcPort}, HLS :8880)`);

        // Tulis juga salinan di ./mediamtx.yml jika path berbeda
        const localConfig = path.join(__dirname, 'mediamtx.yml');
        if (localConfig !== mediamtxConfigFile) {
            try { fs.writeFileSync(localConfig, yamlContent, 'utf8'); } catch (e) {}
        }

        // Panggil pm2 restart mediamtx agar MediaMTX membaca perubahan secara otomatis
        exec('pm2 restart mediamtx', (err, stdout, stderr) => {
            if (err) {
                sysLog('WARN', `[MediaMTX] Info restart PM2: ${err.message}`);
            } else {
                sysLog('INFO', `[MediaMTX] MediaMTX berhasil di-restart melalui PM2.`);
            }
        });
    } catch (err) {
        sysLog('ERROR', `[MediaMTX] Gagal sinkronisasi mediamtx.yml: ${err.message}`);
    }
}

// --- FFMPEG RECORDING ENGINE (LIGHTWEIGHT STREAM COPY ONLY) ---
// FFmpeg digunakan KHUSUS untuk perekaman lokal/USB dengan -c:v copy -c:a copy
function spawnRecordingFFmpeg(cam) {
    if (!cam || !cam.enabled) return;
    if (cam.recordMode !== 'continuous') return;
    if (settings.globalStorageMode === 'disabled') return;

    const recQuality = settings.recordingQuality || 'main';
    const hasDistinctSub = cam.subStreamUrl && cam.subStreamUrl.trim() && cam.subStreamUrl.trim() !== cam.mainStreamUrl.trim();
    const useSub = recQuality === 'sub' && hasDistinctSub;
    const rawUrl = useSub ? cam.subStreamUrl : cam.mainStreamUrl;
    const sourceUrl = formatStreamUrl(rawUrl);

    if (!sourceUrl) {
        sysLog('WARN', `[${cam.id}] URL RTSP tidak tersedia untuk perekaman.`);
        return;
    }

    stopCameraRecording(cam.id);

    const recBase = resolveStoragePath(cam.storagePath || path.join(getActualBaseStoragePath(), cam.id));
    if (!fs.existsSync(recBase)) {
        fs.mkdirSync(recBase, { recursive: true });
    }

    const segSec = cam.segmentDurationSec || 900;
    const isDemo = sourceUrl === 'demo';

    let inputArgs = [];
    if (isDemo) {
        inputArgs = [
            '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=25',
            '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=44100'
        ];
    } else {
        inputArgs = [
            '-rtsp_transport', 'tcp',
            '-err_detect', 'ignore_err',
            '-fflags', '+genpts+discardcorrupt',
            '-i', sourceUrl
        ];
    }

    // Perintah copy stream ringan (-c:v copy -c:a copy) khusus untuk perekaman lokal/USB
    const args = [
        '-y',
        '-loglevel', 'warning',
        ...inputArgs,
        '-map', '0:v:0',
        ...(isDemo ? ['-c:v', 'libx264', '-preset', 'ultrafast'] : ['-c:v', 'copy']),
        '-map', isDemo ? '1:a:0' : '0:a?',
        ...(isDemo ? ['-c:a', 'aac'] : ['-c:a', 'copy']),
        '-max_muxing_queue_size', '1024',
        '-avoid_negative_ts', 'make_zero',
        '-f', 'segment',
        '-segment_time', segSec.toString(),
        '-segment_format', 'mp4',
        '-reset_timestamps', '1',
        '-strftime', '1',
        path.join(recBase, '%Y-%m-%d', '%H-%M-%S.mp4')
    ];

    sysLog('INFO', `[${cam.id}] Memulai perekaman kontinyu FFmpeg (-c:v copy -c:a copy) [${useSub ? 'SD/Sub' : 'HD/Main'}] -> ${recBase}`);

    const child = spawn('ffmpeg', args);
    child.killedByUser = false;

    child.on('close', (code) => {
        if (ffProcesses[cam.id]) {
            delete ffProcesses[cam.id];
        }

        if (!child.killedByUser) {
            sysLog('WARN', `[${cam.id}] Perekaman FFmpeg berhenti (Code: ${code}). Reconnect otomatis dalam 10 detik...`);
            const timerKey = `rec_${cam.id}`;
            if (reconnectTimers[timerKey]) clearTimeout(reconnectTimers[timerKey]);
            
            reconnectTimers[timerKey] = setTimeout(() => {
                const currentCam = getCameras().find(c => c.id === cam.id);
                if (currentCam && currentCam.enabled && currentCam.recordMode === 'continuous') {
                    spawnRecordingFFmpeg(currentCam);
                }
            }, 10000);
        }
    });

    ffProcesses[cam.id] = child;
}

function stopCameraRecording(camId) {
    const timerKey = `rec_${camId}`;
    if (reconnectTimers[timerKey]) {
        clearTimeout(reconnectTimers[timerKey]);
        delete reconnectTimers[timerKey];
    }

    if (ffProcesses[camId]) {
        try {
            ffProcesses[camId].killedByUser = true;
            ffProcesses[camId].kill('SIGKILL');
        } catch (e) {}
        delete ffProcesses[camId];
    }
}

function startAllStreams() {
    // 1. Auto-generate konfigurasi MediaMTX & restart via PM2
    syncMediaMtxConfig();

    // 2. Bersihkan timer & proses rekaman lama
    Object.keys(reconnectTimers).forEach(key => {
        clearTimeout(reconnectTimers[key]);
        delete reconnectTimers[key];
    });

    Object.values(ffProcesses).forEach(proc => {
        if (proc) {
            proc.killedByUser = true;
            try { proc.kill('SIGKILL'); } catch (e) {}
        }
    });
    ffProcesses = {};
    ensureRecordFolders();

    // 3. Jalankan perekaman FFmpeg khusus kamera continuous
    cameras = getCameras();
    cameras.forEach(cam => {
        if (cam.enabled && cam.recordMode === 'continuous') {
            spawnRecordingFFmpeg(cam);
        }
    });
}

function stopCamera(camId) {
    stopCameraRecording(camId);
    syncMediaMtxConfig();
}

// Retention (Cleaning old files locally)
function runRetention() {
    sysLog('INFO', 'Running retention check...');
    ensureRecordFolders();
    const cams = getCameras();
    let filesDeleted = false;
    
    for (const cam of cams) {
        if (cam.recordMode !== 'continuous') continue;
        const maxDays = cam.maxStorageDays || 7;
        const maxGB = cam.maxFolderSizeGB || 10;
        const base = resolveStoragePath(cam.storagePath || path.join(getActualBaseStoragePath(), cam.id));
        if (!fs.existsSync(base)) continue;

        const limitMs = Date.now() - (maxDays * 86400000);
        
        let allFiles = [];
        const dates = fs.readdirSync(base).filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f));
        dates.forEach(date => {
            const datePath = path.join(base, date);
            if (fs.lstatSync(datePath).isDirectory()) {
                const files = fs.readdirSync(datePath).filter(f => f.endsWith('.mp4'));
                files.forEach(f => {
                    const filePath = path.join(datePath, f);
                    const stats = fs.statSync(filePath);
                    allFiles.push({ path: filePath, size: stats.size, mtime: stats.mtimeMs });
                });
            }
        });

        // 1. Delete by Age
        for (const file of allFiles) {
            if (file.mtime < limitMs) {
                try { 
                    fs.unlinkSync(file.path);
                    filesDeleted = true;
                    sysLog('INFO', `[Retention] Deleted by age (${cam.id}): ${file.path}`);
                } catch(e) {}
            }
        }

        // 2. Delete by Size Limit
        allFiles = allFiles.filter(f => fs.existsSync(f.path));
        let totalSizeBytes = allFiles.reduce((acc, f) => acc + f.size, 0);
        const maxBytes = maxGB * 1024 * 1024 * 1024;

        if (totalSizeBytes > maxBytes) {
            allFiles.sort((a, b) => a.mtime - b.mtime); // Oldest first
            for (const file of allFiles) {
                if (totalSizeBytes <= maxBytes) break;
                try { 
                    fs.unlinkSync(file.path); 
                    totalSizeBytes -= file.size;
                    filesDeleted = true;
                    sysLog('INFO', `[Retention] Deleted by quota (${cam.id}): ${file.path}`);
                } catch(e) {}
            }
        }
        
        // Clean empty folders
        dates.forEach(date => {
            const datePath = path.join(base, date);
            if (fs.existsSync(datePath) && fs.readdirSync(datePath).length === 0) {
                try { fs.rmdirSync(datePath); } catch(e){}
            }
        });
    }
    
    if (filesDeleted) {
        syncRecordingsToDB();
    }
}

// Global Disk Space Protection (<10% free space)
function checkGlobalDiskSpace() {
    try {
        const stats = fs.statfsSync(getActualBaseStoragePath());
        const percent = (stats.blocks - stats.bfree) / stats.blocks;
        if (percent > 0.90) { 
            sysLog('WARN', `Global storage capacity > 90% (${(percent*100).toFixed(1)}%). Executing emergency cleanup.`);
            
            const dbData = getNvrDb();
            let recordings = dbData.recordings.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
            const toDelete = recordings.slice(0, 100);
            
            let deleted = false;
            for (const rec of toDelete) {
                if (fs.existsSync(rec.file_path)) {
                    try {
                        fs.unlinkSync(rec.file_path);
                        deleted = true;
                        sysLog('INFO', `[Emergency Cleanup] Deleted ${rec.file_path}`);
                    } catch(e) {}
                }
            }
            if (deleted) syncRecordingsToDB();
        }
    } catch(e) { sysLog('ERROR', `Disk check failed: ${e.message}`); }
}


// --- REST API ENDPOINTS ---

app.get('/api/cameras', verifyToken, (req, res) => {
    const currentSettings = getSettings();
    const cams = getCameras().map(c => {
        const safeId = (c.id || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
        const hasDistinctSub = c.subStreamUrl && c.subStreamUrl.trim() && c.subStreamUrl.trim() !== c.mainStreamUrl.trim();
        const mainStat = (cameraStatuses[c.id] && cameraStatuses[c.id].main) || { status: c.enabled ? 'online' : 'offline', error: null };
        const subStat = (cameraStatuses[c.id] && cameraStatuses[c.id].sub) || { status: c.enabled ? 'online' : 'offline', error: null };
        return {
            ...c,
            mediaMtxPath: safeId,
            mediaMtxSubPath: hasDistinctSub ? `${safeId}_sub` : safeId,
            mainHls: `/streams/${c.id}/main.m3u8`,
            subHls: hasDistinctSub ? `/streams/${c.id}/sub.m3u8` : `/streams/${c.id}/main.m3u8`,
            status: c.enabled ? 'online' : 'offline',
            error: mainStat.error,
            subStatus: c.enabled ? 'online' : 'offline'
        };
    });
    res.json({ cameras: cams, mediamtxPort: currentSettings.mediamtxPort || 8889, mediamtxHost: currentSettings.mediamtxHost || '' });
});

app.post('/api/cameras', verifyToken, (req, res) => {
    const { id, name, enabled, mainStreamUrl, subStreamUrl, rtspUrl, storagePath, resolution, fps, recordMode, maxStorageDays, maxFolderSizeGB, segmentDurationSec, transcode } = req.body;
    const cams = getCameras();
    
    const rawMainUrl = mainStreamUrl || rtspUrl || "";
    const finalMainUrl = sanitizeRtspUrl(rawMainUrl);
    const finalSubUrl = subStreamUrl ? sanitizeRtspUrl(subStreamUrl) : finalMainUrl;

    const newCam = { 
        id: id || `cam_${Date.now()}`, 
        name: name || "New Camera", 
        enabled: enabled !== undefined ? !!enabled : true,
        mainStreamUrl: finalMainUrl, 
        subStreamUrl: finalSubUrl, 
        transcode: transcode || 'auto',
        resolution: resolution || "1080p",
        fps: fps || 30,
        recordMode: recordMode || 'disabled',
        storagePath: storagePath || path.join(baseStoragePath, `cam_${Date.now()}`),
        maxStorageDays: parseInt(maxStorageDays) || 7,
        maxFolderSizeGB: parseFloat(maxFolderSizeGB) || 10,
        segmentDurationSec: parseInt(segmentDurationSec) || 900
    };
    cams.push(newCam);
    saveCameras(cams);
    
    // Sinkronisasi MediaMTX otomatis
    syncMediaMtxConfig();

    if (newCam.enabled && newCam.recordMode === 'continuous') {
        spawnRecordingFFmpeg(newCam);
    }
    
    sysLog('INFO', `Kamera Ditambahkan: ${newCam.name} (MediaMTX config updated)`);
    res.json({ success: true, camera: newCam });
});

app.put('/api/cameras/:id', verifyToken, (req, res) => {
    const cams = getCameras();
    const index = cams.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({error: 'Not found'});
    
    const { name, enabled, mainStreamUrl, subStreamUrl, rtspUrl, storagePath, resolution, fps, recordMode, maxStorageDays, maxFolderSizeGB, segmentDurationSec, transcode } = req.body;
    
    stopCameraRecording(req.params.id);

    const rawMainUrl = mainStreamUrl !== undefined ? mainStreamUrl : (rtspUrl || cams[index].mainStreamUrl);
    const rawSubUrl = subStreamUrl !== undefined ? subStreamUrl : cams[index].subStreamUrl;
    const finalMainUrl = sanitizeRtspUrl(rawMainUrl);
    const finalSubUrl = rawSubUrl ? sanitizeRtspUrl(rawSubUrl) : finalMainUrl;

    cams[index] = {
        ...cams[index],
        name: name || cams[index].name,
        enabled: enabled !== undefined ? !!enabled : cams[index].enabled,
        mainStreamUrl: finalMainUrl,
        subStreamUrl: finalSubUrl,
        transcode: transcode !== undefined ? transcode : (cams[index].transcode || 'auto'),
        resolution: resolution || cams[index].resolution,
        fps: fps || cams[index].fps,
        recordMode: recordMode || cams[index].recordMode,
        storagePath: storagePath !== undefined ? storagePath : cams[index].storagePath,
        maxStorageDays: parseInt(maxStorageDays) || cams[index].maxStorageDays,
        maxFolderSizeGB: parseFloat(maxFolderSizeGB) || cams[index].maxFolderSizeGB,
        segmentDurationSec: parseInt(segmentDurationSec) || cams[index].segmentDurationSec
    };
    
    saveCameras(cams);

    // Sinkronisasi MediaMTX otomatis
    syncMediaMtxConfig();

    if (cams[index].enabled && cams[index].recordMode === 'continuous') {
        spawnRecordingFFmpeg(cams[index]);
    }

    sysLog('INFO', `Kamera Diperbarui: ${cams[index].name} (MediaMTX config updated)`);
    res.json({ success: true });
});

app.post('/api/cameras/:id/restart', verifyToken, (req, res) => {
    const cams = getCameras();
    const cam = cams.find(c => c.id === req.params.id);
    if (!cam) return res.status(404).json({ error: 'Kamera tidak ditemukan' });

    stopCameraRecording(cam.id);
    syncMediaMtxConfig();

    setTimeout(() => {
        if (cam.enabled && cam.recordMode === 'continuous') {
            spawnRecordingFFmpeg(cam);
        }
        res.json({ success: true, message: `Stream kamera ${cam.name} disinkronkan ke MediaMTX.` });
    }, 500);
});

app.delete('/api/cameras/:id', verifyToken, (req, res) => {
    stopCameraRecording(req.params.id);
    const camStreamDir = path.join(streamBaseDir, req.params.id);
    if (fs.existsSync(camStreamDir)) {
        try { fs.rmSync(camStreamDir, { recursive: true, force: true }); } catch (e) {}
    }
    const cams = getCameras().filter(c => c.id !== req.params.id);
    saveCameras(cams);
    
    // Sinkronisasi MediaMTX otomatis setelah hapus kamera
    syncMediaMtxConfig();

    sysLog('INFO', `Kamera Dihapus: ${req.params.id} (MediaMTX config updated)`);
    res.json({ success: true });
});

// Proxy route for videos outside of standard public dir
app.get('/api/recordings/:camId/:date/:filename', verifyToken, (req, res) => {
    const { camId, date, filename } = req.params;
    const cam = getCameras().find(c => c.id === camId);
    if (!cam) return res.status(404).send('Camera not found');
    
    const base = resolveStoragePath(cam.storagePath || path.join(getActualBaseStoragePath(), cam.id));
    const filePath = path.join(base, date, filename);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

app.get('/api/recordings', verifyToken, (req, res) => {
    try {
        const result = {};
        const dbData = getNvrDb();
        const recordings = dbData.recordings.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
        recordings.forEach(row => {
            const camId = row.camera_id;
            const parts = row.file_path.split(path.sep);
            const filename = parts.pop();
            const date = parts.pop();
            
            if (!result[camId]) result[camId] = {};
            if (!result[camId][date]) result[camId][date] = [];
            result[camId][date].push(filename);
        });
        res.json(result);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.get('/api/storage-options', verifyToken, (req, res) => {
    const options = [];
    options.push({ id: 'disabled', label: 'Nonaktifkan Rekaman (Live View Only) [DEFAULT]', path: '' });
    options.push({ id: 'internal', label: 'SD Card / Internal STB (Tidak Direkomendasikan)', path: path.join(__dirname, 'public', 'recordings') });

    const scanDirs = ['/mnt', '/media'];
    scanDirs.forEach(baseDir => {
        if (fs.existsSync(baseDir)) {
            try {
                const drives = fs.readdirSync(baseDir);
                drives.forEach(drive => {
                    const drivePath = path.join(baseDir, drive);
                    if (fs.lstatSync(drivePath).isDirectory()) {
                        let freeGB = 'Unknown';
                        try {
                            const stats = fs.statfsSync(drivePath);
                            freeGB = (stats.bfree * stats.bsize / (1024**3)).toFixed(1);
                        } catch(e) {}
                        options.push({
                            id: `ext_${drive}`,
                            label: `USB Drive: ${drive} (${freeGB} GB Free)`,
                            path: drivePath
                        });
                    }
                });
            } catch(e) {}
        }
    });
    res.json(options);
});

app.get('/api/settings', verifyToken, (req, res) => {
    res.json(getSettings());
});

app.get('/api/logs', verifyToken, (req, res) => {
    try {
        const dbData = getNvrDb();
        res.json({ logs: dbData.system_logs || [] });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/settings', verifyToken, (req, res) => {
    const prevQuality = settings.recordingQuality;
    const prevStorageMode = settings.globalStorageMode;
    const prevStoragePath = settings.globalStoragePath;

    settings = { ...settings, ...req.body };
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    sysLog('INFO', `Pengaturan Sistem Diperbarui (Storage: ${settings.globalStorageMode}, Recording Quality: ${settings.recordingQuality || 'main'}, MediaMTX Port: ${settings.mediamtxPort || 8889})`);

    syncMediaMtxConfig();

    if (prevQuality !== settings.recordingQuality || prevStorageMode !== settings.globalStorageMode || prevStoragePath !== settings.globalStoragePath) {
        startAllStreams();
    }
    res.json({ success: true, settings });
});

// Streams Middleware with HLS Cache-Control & CORS
app.use('/streams', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Content-Type, Accept');
    if (req.url.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    } else if (req.url.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'public, max-age=60');
    }
    next();
}, express.static(streamBaseDir));

// Serve UI & Static Assets
app.use(express.static(publicDir));

// App Initialization
function boot() {
    initDB();
    settings = getSettings();
    startAllStreams();
    
    syncRecordingsToDB();
    autoCleanupTempSegments();
    setInterval(syncRecordingsToDB, 5 * 60 * 1000); // 5 mins
    setInterval(runRetention, 10 * 60 * 1000); // 10 mins
    setInterval(checkGlobalDiskSpace, 60 * 60 * 1000); // 1 hour
    setInterval(autoCleanupTempSegments, 10 * 1000); // 10 detik auto-cleanup segmen temp .ts

    app.listen(port, "0.0.0.0", () => {
        sysLog('INFO', `NVR Backend berjalan di port ${port}`);
    });
}

boot();
