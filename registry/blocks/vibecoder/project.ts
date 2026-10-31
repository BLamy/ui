export const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="./style.css">
<title>My OpenCode app</title>
<main>
  <span class="eyebrow">BUILT IN YOUR BROWSER</span>
  <h1>Make something<br>with OpenCode.</h1>
  <p>This page is served by a real HTTP server inside agent-wasm. Ask OpenCode to edit index.html or style.css, then reload the preview.</p>
  <button id="count">Clicked 0 times</button>
  <output id="status">Checking the app server…</output>
</main>
<script src="./app.js"></script>
</html>`;

export const css = `* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f0e7; color: #22372c; font: 16px/1.6 system-ui; padding: 28px; }
main { max-width: 460px; }
.eyebrow { font: 11px ui-monospace, monospace; letter-spacing: .14em; }
h1 { font-size: clamp(36px, 8vw, 60px); line-height: 1.06; letter-spacing: -.05em; }
p { color: #5e6c61; }
button { background: #244936; color: white; border: 0; border-radius: 99px; padding: 12px 20px; cursor: pointer; font: inherit; }
output { display: block; margin-top: 24px; font: 12px ui-monospace, monospace; }`;

export const script = `let count = 0;
document.querySelector('#count').onclick = (event) => { event.target.textContent = 'Clicked ' + (++count) + ' times'; };
fetch('./api/status').then(response => response.json()).then(data => { document.querySelector('#status').textContent = data.message; });`;

export const server = `const http = require('http');
const fs = require('fs');
const path = require('path');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript' };
const server = http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  if (request.url.split('?')[0] === '/api/status') {
    response.setHeader('Content-Type', 'application/json');
    return response.end(JSON.stringify({ message: 'Port 3000 · service worker → agent-wasm HTTP server' }));
  }
  const file = request.url.split('?')[0] === '/' ? 'index.html' : request.url.split('?')[0].slice(1);
  try {
    response.setHeader('Content-Type', types[path.extname(file)] || 'text/plain');
    response.end(fs.readFileSync(path.join(process.cwd(), file)));
  } catch { response.statusCode = 404; response.end('File not found'); }
});
server.listen(3000, '0.0.0.0');
console.log('App server listening on port 3000');`;
