const fs = require('fs');

let script = fs.readFileSync('public/script.js', 'utf8');

// Wrap scrollArea listeners
script = script.replace(/scrollArea\.addEventListener/g, 'if (scrollArea) scrollArea.addEventListener');

// Wrap playbackPlayer listeners
script = script.replace(/playbackPlayer\.addEventListener/g, 'if (playbackPlayer) playbackPlayer.addEventListener');

// Wrap selRecCam
script = script.replace(/selRecCam\.addEventListener/g, 'if (selRecCam) selRecCam.addEventListener');

// Wrap selRecDate
script = script.replace(/selRecDate\.addEventListener/g, 'if (selRecDate) selRecDate.addEventListener');

fs.writeFileSync('public/script.js', script);
console.log('Fixed listeners');
