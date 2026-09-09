self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
    // Basic pass-through for NVR streaming. 
    // We don't cache video streams to avoid memory leaks or stale streams.
});
