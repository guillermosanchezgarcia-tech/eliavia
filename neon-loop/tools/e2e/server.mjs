// Uso: node tools/e2e/server.mjs <carpeta-web-exportada> [puerto]
// Servidor estático mínimo con respaldo a index.html (SPA), solo para pruebas locales.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const root = process.argv[2];
const port = Number(process.argv[3] ?? 8099);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.png': 'image/png', '.ico': 'image/x-icon', '.css': 'text/css' };
createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const file = join(root, path === '/' ? 'index.html' : path);
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    const data = await readFile(join(root, 'index.html'));
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(data);
  }
}).listen(port, () => console.log('listo', port));
