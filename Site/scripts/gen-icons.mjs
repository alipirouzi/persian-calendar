// Rasterizes the site's clock mark to PWA icons using Playwright's bundled
// Chromium — no image-processing dependency needed. Rerun: npm run gen:icons
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// safe=1 → full-bleed background with the mark inside the 80% maskable safe zone.
const pageHtml = (size, safe) => `<!doctype html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#f7f5f0"/>
  <g transform="${safe ? 'translate(50 50) scale(0.72) translate(-50 -50)' : ''}">
    <circle cx="50" cy="50" r="40" fill="none" stroke="#2b3446" stroke-width="3.5"/>
    <line x1="50" y1="50" x2="50" y2="27" stroke="#2b3446" stroke-width="5" stroke-linecap="round"/>
    <line x1="50" y1="50" x2="67" y2="50" stroke="#4a6a99" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="2.5" fill="#2b3446"/>
  </g>
</svg></body>`;

mkdirSync(fileURLToPath(new URL('../public/icons/', import.meta.url)), { recursive: true });
const browser = await chromium.launch();
const targets = [
  { file: 'icon-180.png', size: 180, safe: false },
  { file: 'icon-192.png', size: 192, safe: false },
  { file: 'icon-512.png', size: 512, safe: false },
  { file: 'icon-512-maskable.png', size: 512, safe: true },
];
for (const { file, size, safe } of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(pageHtml(size, safe));
  await page.screenshot({ path: fileURLToPath(new URL(`../public/icons/${file}`, import.meta.url)) });
  await page.close();
}
await browser.close();
console.log('icons written to Site/public/icons/');
