import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'firebase-functions/v2/https';

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>FinBuddy API</title>
<link rel="icon" href="/media/buddy-mark-v2.png"><link rel="stylesheet" href="/api/v1/docs/swagger-ui.css">
<link rel="stylesheet" href="/landing.css"></head><body>
<a class="skip" href="#swagger-ui">Skip to API reference</a>
<header class="header wrap"><a class="wordmark" href="/"><span class="mark" aria-hidden="true"></span>FinBuddy</a>
<nav aria-label="Main"><a href="/docs/technical.html#rest-api">API guide</a><a href="/docs/index.html">Help center</a><a class="button small primary" href="/signin">Sign in</a></nav></header>
<div id="swagger-ui"></div><script defer src="/api/v1/docs/swagger-ui-bundle.js"></script>
<script defer src="/api/v1/docs/init.js"></script></body></html>`;
const init = "window.SwaggerUIBundle({url:'/api/v1/openapi.json',dom_id:'#swagger-ui',validatorUrl:null,persistAuthorization:false,queryConfigEnabled:false});";
const assets: Record<string, { path: string; mime: string }> = {
  '/docs/swagger-ui.css': { path: require.resolve('swagger-ui-dist/swagger-ui.css'), mime: 'text/css' },
  '/docs/swagger-ui-bundle.js': { path: require.resolve('swagger-ui-dist/swagger-ui-bundle.js'), mime: 'text/javascript' },
};

export async function serveSwagger(path: string, response: Response): Promise<boolean> {
  if (path === '/docs' || path === '/docs/') {
    response.set('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
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
