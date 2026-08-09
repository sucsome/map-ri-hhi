const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'share_hhi_data');
const PORT = process.env.PORT || 8000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.geojson': 'application/json',
  '.pmtiles': 'application/vnd.pmtiles',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.normalize(path.join(ROOT, urlPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (err2, stat2) => {
        if (err2 || !stat2.isFile()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        sendFile(indexPath, stat2, req, res);
      });
      return;
    }

    if (!stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    sendFile(filePath, stat, req, res);
  });
});

function sendFile(filePath, stat, req, res) {
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;

    if (isNaN(start) || start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      res.end();
      return;
    }

    const finalEnd = Math.min(end, stat.size - 1);
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${finalEnd}/${stat.size}`,
      'Content-Length': finalEnd - start + 1,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath, { start, end: finalEnd }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT}`);
});
