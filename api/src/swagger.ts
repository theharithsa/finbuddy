import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'firebase-functions/v2/https';

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>FinBuddy API</title>
<link rel="stylesheet" href="/api/v1/docs/swagger-ui.css"></head><body>
<div id="swagger-ui"></div><script defer src="/api/v1/docs/swagger-ui-bundle.js"></script>
<script defer src="/api/v1/docs/init.js"></script></body></html>`;
const init = "window.SwaggerUIBundle({url:'/api/v1/openapi.json',dom_id:'#swagger-ui',validatorUrl:null,persistAuthorization:false,queryConfigEnabled:false});";
const assets: Record<string, { path: string; mime: string }> = {
  '/docs/swagger-ui.css': { path: require.resolve('swagger-ui-dist/swagger-ui.css'), mime: 'text/css' },
  '/docs/swagger-ui-bundle.js': { path: require.resolve('swagger-ui-dist/swagger-ui-bundle.js'), mime: 'text/javascript' },
};

export async function serveSwagger(path: string, response: Response): Promise<boolean> {
  if (path === '/docs' || path === '/docs/') {
    response.set('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    response.type('html').send(html);
    return true;
  }
  if (path === '/docs/init.js') {
    response.type('text/javascript').send(init);
    return true;
  }
  const asset = Object.hasOwn(assets, path) ? assets[path] : undefined;
  if (!asset) return false;
  response.type(asset.mime);
  await pipeline(createReadStream(asset.path), response);
  return true;
}
