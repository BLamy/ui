// Serves a folder of downloaded Replay QA recordings (fetch-test-runs.mts) to the docs dev server's
// `?harness=replay-canvas-local&dir=<project>/<test run>`, with CORS. `node tools/replay-canvas/serve-recordings.mjs [dir] [port]`.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join, normalize } from 'node:path';

const root = process.argv[2] ?? join(homedir(), 'Documents/Codex/replay-qa-recordings');
const port = Number(process.argv[3] ?? 4436);
createServer((req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  const headers = { 'access-control-allow-origin': '*' };
  if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile()) { res.writeHead(404, headers); return res.end(); }
  res.writeHead(200, { ...headers, 'content-type': 'application/json' });
  createReadStream(path).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`recordings from ${root} on http://127.0.0.1:${port}`));
