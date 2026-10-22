import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
// the server has no login, so by default it only accepts connections from this machine
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = path.resolve(
  process.env.DATA_DIR || path.join(here, '..', 'data'),
);
const baseUrl = `http://localhost:${PORT}`;

const app = createApp({ dataDir: DATA_DIR, baseUrl });

http.createServer(app.handler).listen(PORT, HOST, () => {
  console.log(`rrweb issue server: ${baseUrl}  (data: ${DATA_DIR})`);
});
