import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// The public directory where static files (index.html, style.css, script.js) will live
const publicDir = path.join(process.cwd(), 'public_html');
app.use(express.static(publicDir));

// HLS Stream Output Directory
const streamDir = path.join(process.cwd(), 'streams');
if (!fs.existsSync(streamDir)) {
  fs.mkdirSync(streamDir, { recursive: true });
}

// Serve HLS files statically
app.use('/streams', express.static(streamDir));

let ffmpegProcess: any = null;

app.post('/api/start-stream', express.json(), (req, res) => {
  const rtspUrl = req.body.rtspUrl;
  
  if (!rtspUrl) {
    return res.status(400).json({ error: 'RTSP URL is required' });
  }

  if (ffmpegProcess) {
    // Already running, return existing stream URL
    return res.json({ streamUrl: '/streams/live.m3u8', message: 'Stream already running' });
  }

  console.log(`[V1] Starting stream for: ${rtspUrl}`);

  // FFmpeg arguments optimized for low CPU/RAM on Armbian STB & RTSP stabilization
  // -fflags +genpts+discardcorrupt : paksa buat ulang timestamp rusak & buang packet cacat
  // -err_detect ignore_err : abaikan error kecil header RTSP
  // -bsf:v h264_mp4toannexb : stabilkan struktur NAL unit
  // -max_muxing_queue_size 1024, -avoid_negative_ts make_zero : cegah overflow antrean & perbaiki non-monotonic DTS
  const args = [
    '-rtsp_transport', 'tcp',
    '-err_detect', 'ignore_err',
    '-fflags', '+genpts+discardcorrupt',
    '-i', rtspUrl,
    '-c:v', 'copy',
    '-bsf:v', 'h264_mp4toannexb',
    '-c:a', 'copy',
    '-max_muxing_queue_size', '1024',
    '-avoid_negative_ts', 'make_zero',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments',
    path.join(streamDir, 'live.m3u8')
  ];

  try {
    ffmpegProcess = spawn('ffmpeg', args);

    ffmpegProcess.stderr.on('data', (data: any) => {
      // ffmpeg writes to stderr
      // console.log(`FFmpeg: ${data}`);
    });

    ffmpegProcess.on('close', (code: number) => {
      console.log(`[V1] FFmpeg process exited with code ${code}`);
      ffmpegProcess = null;
    });

    res.json({ streamUrl: '/streams/live.m3u8', message: 'Stream started' });
  } catch (error) {
    console.error('Failed to start FFmpeg:', error);
    res.status(500).json({ error: 'Failed to start stream' });
  }
});

app.post('/api/stop-stream', (req, res) => {
  if (ffmpegProcess) {
    console.log('[V1] Stopping stream...');
    ffmpegProcess.kill('SIGINT');
    ffmpegProcess = null;
    
    // Clean up streams folder
    try {
      const files = fs.readdirSync(streamDir);
      for (const file of files) {
        fs.unlinkSync(path.join(streamDir, file));
      }
    } catch (e) {
      console.error('Failed to clean up streams:', e);
    }
  }
  res.json({ message: 'Stream stopped' });
});

app.listen(port, () => {
  console.log(`[NVR CCTV V1] Server listening on port ${port}`);
});
