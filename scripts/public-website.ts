import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Connect, Plugin } from 'vite';

// Firebase serves the static site first and rewrites only these workspace routes.
function publicRoutes(directory: string): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (!request.url || !['GET', 'HEAD'].includes(request.method ?? '')) return next();
    const url = new URL(request.url, 'http://localhost');
    const asset = resolve(directory, '.' + url.pathname);
    const localFile = asset === directory || asset.startsWith(directory + sep);
    if (/^\/(signin|app|finvision)\/?$/.test(url.pathname)) {
      request.url = '/app.html' + url.search;
    } else if (localFile && url.pathname.endsWith('/') && existsSync(join(asset, 'index.html'))) {
      request.url = url.pathname + 'index.html' + url.search;
    } else if (!/^\/(?:api\/|__\/|@|src\/|node_modules\/)/.test(url.pathname) &&
               url.pathname !== '/app.html' && (!localFile || !existsSync(asset))) {
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : readFileSync(join(directory, '404.html')));
      return;
    }
    next();
  };
}

export function publicWebsite(root: string, mode: string): Plugin {
  let assets: string;
  let building = false;
  return {
    name: 'finbuddy-public-website',
    config(_config, environment) {
      if (environment.isPreview) return;
      building = environment.command === 'build';
      const generated = resolve(root, '.generated');
      mkdirSync(generated, { recursive: true });
      assets = mkdtempSync(join(generated, 'site-'));
      try {
        execFileSync(process.platform === 'win32' ? 'python' : 'python3', [
          'scripts/build_public_docs.py', '--hosting', '--output', assets,
          '--environment', mode === 'preprod' ? 'preprod' : 'prod',
        ], { cwd: root, stdio: 'inherit' });
      } catch (error) {
        rmSync(assets, { recursive: true, force: true });
        throw error;
      }
      return { publicDir: assets, appType: 'mpa' };
    },
    configureServer(server) {
      server.middlewares.use(publicRoutes(assets));
      const inputs = ['site', 'public', 'docs/public-guides.json', 'scripts/public_site.py', 'scripts/build_public_docs.py'];
      server.watcher.add(inputs.map(input => resolve(root, input)));
      server.watcher.on('all', (_event, file) => {
        const changed = relative(root, file).split(sep).join('/');
        if (inputs.some(input => changed === input || changed.startsWith(input + '/'))) void server.restart();
      });
      server.httpServer?.once('close', () => rmSync(assets, { recursive: true, force: true }));
    },
    configurePreviewServer(server) {
      server.middlewares.use(publicRoutes(resolve(root, server.config.build.outDir)));
    },
    closeBundle() {
      if (assets && building) rmSync(assets, { recursive: true, force: true });
    },
  };
}
