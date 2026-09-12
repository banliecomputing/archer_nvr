const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

// 1. Fix getNvrDb and saveNvrDb to use in-memory caching and avoid corrupted file resets
const oldDbFuncs = `function getNvrDb() {
    try {
        if (fs.existsSync(nvrDbFile)) {
            const data = JSON.parse(fs.readFileSync(nvrDbFile, 'utf8'));
            const def = getDefaultDb();
            if (!data.super_settings) data.super_settings = def.super_settings;
            if (!data.administrators || data.administrators.length === 0) data.administrators = def.administrators;
            if (!data.users) data.users = def.users;
            if (!data.cameras) data.cameras = [];
            if (!data.recordings) data.recordings = [];
            if (!data.system_logs) data.system_logs = [];
            if (data.recording_path === undefined) data.recording_path = '';
            return data;
        }
        const initial = getDefaultDb();
        saveNvrDb(initial);
        return initial;
    }
    catch (e) {
        const initial = getDefaultDb();
        saveNvrDb(initial);
        return initial;
    }
}

function saveNvrDb(data) {
    try {
        fs.writeFileSync(nvrDbFile, JSON.stringify(data, null, 2));
        fs.writeFileSync(path.join(dataDir, 'nvr.db.json'), JSON.stringify(data, null, 2));
    } catch(e) {}
}`;

const newDbFuncs = `let cachedDb = null;
function getNvrDb() {
    if (cachedDb) return cachedDb;
    try {
        if (fs.existsSync(nvrDbFile)) {
            const raw = fs.readFileSync(nvrDbFile, 'utf8');
            if (raw.trim() === '') throw new Error('Empty db file');
            const data = JSON.parse(raw);
            const def = getDefaultDb();
            if (!data.super_settings) data.super_settings = def.super_settings;
            if (!data.administrators || data.administrators.length === 0) data.administrators = def.administrators;
            if (!data.users) data.users = def.users;
            if (!data.cameras) data.cameras = [];
            if (!data.recordings) data.recordings = [];
            if (!data.system_logs) data.system_logs = [];
            if (data.recording_path === undefined) data.recording_path = '';
            cachedDb = data;
            return data;
        }
        const initial = getDefaultDb();
        saveNvrDb(initial);
        cachedDb = initial;
        return initial;
    }
    catch (e) {
        console.error('Error reading DB. Returning default but not overwriting:', e);
        const initial = getDefaultDb();
        cachedDb = initial;
        return initial;
    }
}

function saveNvrDb(data) {
    cachedDb = data;
    try {
        const jsonStr = JSON.stringify(data, null, 2);
        fs.writeFileSync(nvrDbFile, jsonStr);
        fs.writeFileSync(path.join(dataDir, 'nvr.db.json'), jsonStr);
    } catch(e) {
        console.error('Error saving DB:', e);
    }
}`;

content = content.replace(oldDbFuncs, newDbFuncs);

// 2. Fix getActualBaseStoragePath to prioritize external drives
const oldGetActual = `function getActualBaseStoragePath() {
    const dbData = getNvrDb();
    if (dbData && dbData.recording_path && dbData.recording_path.trim() !== '') {
        return dbData.recording_path;
    }
    if (settings.globalStoragePath && settings.globalStoragePath.trim() !== '') {
        return settings.globalStoragePath;
    }
    return baseStoragePath;
}`;

const newGetActual = `function getActualBaseStoragePath() {
    const dbData = getNvrDb();
    if (dbData && dbData.recording_path && dbData.recording_path.trim() !== '') {
        return dbData.recording_path;
    }
    if (settings.globalStoragePath && settings.globalStoragePath.trim() !== '') {
        return settings.globalStoragePath;
    }
    
    // Auto-detect and prioritize external drive if no path is configured!
    try {
        const external = detectStorageDevices().filter(d => d.category === 'External' && d.totalGB > 0);
        if (external.length > 0) {
            // Sort by free space descending
            external.sort((a, b) => b.freeGB - a.freeGB);
            return external[0].mountPath;
        }
    } catch(e) {}

    return baseStoragePath;
}`;

content = content.replace(oldGetActual, newGetActual);

// 3. Fix /api/settings error by properly updating dbData.super_settings and removing fs.writeFileSync(settingsFile...)
const oldApiSettings = `    const targetStorage = req.body.recording_path || req.body.globalStoragePath;
    if (targetStorage !== undefined) {
        const dbData = getNvrDb();
        dbData.recording_path = targetStorage;
        saveNvrDb(dbData);
        settings.globalStoragePath = targetStorage;
    }

    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));`;

const newApiSettings = `    const targetStorage = req.body.recording_path || req.body.globalStoragePath;
    const dbData = getNvrDb();
    dbData.super_settings = settings;

    if (targetStorage !== undefined) {
        dbData.recording_path = targetStorage;
        settings.globalStoragePath = targetStorage;
    }
    saveNvrDb(dbData);`;

content = content.replace(oldApiSettings, newApiSettings);

// 4. Fix /api/system/storage-devices/select
const oldApiStorage = `        // 2. Sinkronkan juga ke settings.json
        settings.globalStoragePath = trimmedPath;
        settings.globalStorageMode = 'custom';
        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));`;

const newApiStorage = `        // 2. Sinkronkan juga ke super_settings
        settings.globalStoragePath = trimmedPath;
        settings.globalStorageMode = 'custom';
        dbData.super_settings = settings;
        saveNvrDb(dbData);`;

content = content.replace(oldApiStorage, newApiStorage);

fs.writeFileSync('server.js', content);
console.log('Patched successfully');
