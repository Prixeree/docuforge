#!/usr/bin/env node

/**
 * dev-server.js - Ultra-lightweight local static server for DocuForge
 * 
 * Features:
 * - Zero dependencies (uses Node.js native http, fs, path).
 * - Full HTTP 206 Partial Content / Range header streaming for MP4 video clips.
 * - Proper MIME types for .js (ES modules), .wasm, .onnx, .mp4, .mp3, .wav.
 * - CORS headers: Access-Control-Allow-Origin: *
 * - Serves both docuforge UI and docuforge-assets simultaneously.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const ROOT_DIR = '/Volumes/SSD 500gb/Project';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream'
};

const server = http.createServer((req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // URL parsing
  let reqPath = decodeURIComponent(req.url.split('?')[0]);

  // Save example video endpoint
  if (req.method === 'POST' && reqPath === '/api/save-example') {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
    const mode = urlObj.searchParams.get('mode');
    if (!mode) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing mode parameter' }));
      return;
    }

    const outDir = path.join(ROOT_DIR, 'docuforge', 'examples', mode);
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'example.mp4');
    const writeStream = fs.createWriteStream(outFile);

    req.pipe(writeStream);
    writeStream.on('finish', () => {
      const stats = fs.statSync(outFile);
      console.log(`[dev-server] Saved example for ${mode}: ${outFile} (${stats.size} bytes)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, mode, path: outFile, size: stats.size }));
    });
    writeStream.on('error', (err) => {
      console.error(`[dev-server] Error saving example for ${mode}:`, err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/docuforge/index.html';
  } else if (reqPath === '/docuforge' || reqPath === '/docuforge/') {
    reqPath = '/docuforge/index.html';
  }

  const filePath = path.join(ROOT_DIR, reqPath);

  // Path traversal guard
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${reqPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const totalSize = stats.size;

    // HTTP Range Requests for video/audio seeking
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize) {
        res.writeHead(416, {
          'Content-Range': `bytes */${totalSize}`,
          'Content-Type': contentType
        });
        res.end();
        return;
      }

      const chunkSize = (end - start) + 1;
      const stream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[dev-server] DocuForge running at http://localhost:${PORT}/docuforge/`);
  console.log(`[dev-server] Serving assets from http://localhost:${PORT}/docuforge-assets/`);
});
