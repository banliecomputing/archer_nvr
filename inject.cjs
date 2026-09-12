const fs = require('fs');

let script = fs.readFileSync('public/script.js', 'utf8');
let playback = fs.readFileSync('playback_engine.js', 'utf8');

let target = '    // Mulai Eksekusi Autentikasi';
let newScript = script.replace(target, playback + '\n' + target);

fs.writeFileSync('public/script.js', newScript);
console.log('Injected successfully');
