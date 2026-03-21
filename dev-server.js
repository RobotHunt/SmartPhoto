// ============================================
// SmartPhoto - Development Server with API Proxy
// Proxies /api/v2 to http://152.136.121.153:8000
// ============================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const BACKEND_HOST = '152.136.121.153';
const BACKEND_PORT = 8000;
const STATIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type, Accept',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;

  // ===== Proxy /api/v2 and /healthz to backend =====
  if (pathname.startsWith('/api/v2') || pathname === '/healthz') {

    // Handle CORS preflight — respond immediately, no proxy needed
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...CORS_HEADERS,
        'access-control-max-age': '86400',
      });
      res.end();
      return;
    }

    // Collect the full request body first, then forward
    const bodyChunks = [];
    req.on('data', (chunk) => bodyChunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(bodyChunks);

      // Build proxy headers — remove hop-by-hop headers
      const proxyHeaders = {};
      for (const [key, val] of Object.entries(req.headers)) {
        if (['host', 'connection', 'keep-alive', 'transfer-encoding'].includes(key.toLowerCase())) continue;
        proxyHeaders[key] = val;
      }
      proxyHeaders['host'] = `${BACKEND_HOST}:${BACKEND_PORT}`;
      if (body.length > 0) {
        proxyHeaders['content-length'] = body.length;
      }

      const proxyOptions = {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
        path: req.url,
        method: req.method,
        headers: proxyHeaders,
      };

      console.log(`  → ${req.method} ${req.url}`);

      const proxyReq = http.request(proxyOptions, (proxyRes) => {
        // Build response headers with CORS
        const responseHeaders = { ...CORS_HEADERS };
        for (const [key, val] of Object.entries(proxyRes.headers)) {
          if (['transfer-encoding', 'connection'].includes(key.toLowerCase())) continue;
          responseHeaders[key] = val;
        }

        res.writeHead(proxyRes.statusCode, responseHeaders);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error(`  ✕ Proxy error: ${err.message}`);
        if (res.headersSent) return; // headers already sent, can't write again
        res.writeHead(502, { 'content-type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ code: -1, message: 'Backend unavailable: ' + err.message }));
      });

      // Set timeout — strategy/generation calls can take 3+ minutes
      proxyReq.setTimeout(360000, () => {
        proxyReq.destroy();
        if (res.headersSent) return;
        res.writeHead(504, { 'content-type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ code: -1, message: 'Backend timeout' }));
      });

      // Write body and end
      if (body.length > 0) {
        proxyReq.write(body);
      }
      proxyReq.end();
    });

    return;
  }

  // ===== Serve static files =====
  let filePath = path.join(STATIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Don't serve dev-server.js or node_modules
  if (pathname.includes('dev-server') || pathname.includes('node_modules')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA fallback — serve index.html for unknown routes
      filePath = path.join(STATIC_DIR, 'index.html');
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  SmartPhoto Dev Server');
  console.log('  ────────────────────────');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Backend: http://${BACKEND_HOST}:${BACKEND_PORT}`);
  console.log('  Proxy:   /api/v2/* → backend');
  console.log('');
});
