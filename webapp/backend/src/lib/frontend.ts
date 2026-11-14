import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';

const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };

/** Serve only built public assets; API misses must remain JSON 404s. */
export function installFrontend(app: FastifyInstance, directory: string) {
  app.addHook('onReady', async () => { await stat(resolve(directory, 'index.html')); });
  app.setNotFoundHandler(async (request, reply) => {
    const missing = () => reply.code(404).send({ error: 'Not found' });
    if (!['GET', 'HEAD'].includes(request.method)) return missing();
    let path: string;
    try { path = decodeURIComponent(request.url.split('?')[0]); } catch { return missing(); }
    if (path === '/api' || path.startsWith('/api/') || path.includes('\\') || path.includes('\0') || path.split('/').some(part => part.startsWith('.'))) return missing();
    const root = await realpath(directory);
    let file = resolve(root, `.${path}`);
    try {
      file = await realpath(file);
      if (!(await stat(file)).isFile()) throw new Error('not a file');
    } catch {
      if (extname(path)) return missing();
      file = await realpath(resolve(root, 'index.html'));
    }
    if (!file.startsWith(root + sep)) return missing();
    reply.type(types[extname(file)] || 'application/octet-stream');
    return reply.send(createReadStream(file));
  });
}
