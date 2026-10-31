import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../dist/',import.meta.url));
const port = Number(process.env.PORT || 5178);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; frame-src 'none'";
const server = http.createServer(async (req,res) => {
  res.setHeader('Content-Security-Policy',csp);res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname), file = resolve(root,'.'+(pathname==='/' ? '/index.html' : pathname));
    if(!file.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
    const content = await readFile(file);res.setHeader('Content-Type',mime[extname(file)] || 'application/octet-stream');res.writeHead(200);res.end(req.method==='HEAD' ? undefined : content);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Keylane: http://127.0.0.1:${port}`));
