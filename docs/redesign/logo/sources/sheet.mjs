import { chromium } from '/home/user/FindBarberNearYou/node_modules/playwright/index.mjs';
import fs from 'fs';
const dir = process.cwd();
const concepts = JSON.parse(process.argv[2]);
const b = await chromium.launch();
for (const [num, slug] of concepts) {
  const row = (mode, bg, fg) => {
    const ic = `concept-${num}-${slug}-icon-${mode}.svg`, fu = `concept-${num}-${slug}-full-${mode}.svg`;
    return `<section style="background:${bg};color:${fg}">
      <div class=r>
        <figure><img src="${ic}" width=16 height=16><figcaption>16</figcaption></figure>
        <figure><img src="${ic}" width=32 height=32><figcaption>32</figcaption></figure>
        <figure><canvas class=loupe data-src="${ic}" width=192 height=192></canvas><figcaption>32 px ×6 (pixels)</figcaption></figure>
        <figure><img src="${ic}" width=64 height=64><figcaption>64</figcaption></figure>
        <figure><img src="${ic}" width=256 height=256><figcaption>256</figcaption></figure>
      </div>
      <div class=r>
        <figure><img src="${fu}" style="height:40px"><figcaption>complet, 40 px</figcaption></figure>
        <figure><img src="${fu}" style="height:24px"><figcaption>24 px</figcaption></figure>
        <figure><canvas class=loupe2 data-src="${fu}" width=10 height=160></canvas><figcaption>40 px ×4 (pixels)</figcaption></figure>
      </div>
      <div class=r><nav style="display:flex;align-items:center;gap:24px;padding:12px 16px;border-radius:12px;background:${mode==='light'?'#FFFFFF':'#121A33'};font:600 15px Figtree, system-ui">
        <img src="${fu}" style="height:32px"><span style="margin-left:auto">Rechercher</span><span>Connexion</span></nav>
        <span style="font:13px system-ui;opacity:.7">contexte en-tête (32 px)</span></div>
    </section>`;
  };
  const html = `<!doctype html><meta charset=utf-8><style>
    body{margin:0;font:12px system-ui} section{padding:20px 24px} .r{display:flex;align-items:flex-end;gap:28px;margin-bottom:18px;flex-wrap:wrap}
    figure{margin:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px} figcaption{opacity:.7}
    canvas{image-rendering:pixelated}</style>
    ${row('light', '#F6F7FB', '#0C1428')}${row('dark', '#0A1024', '#EDF1FA')}
    <script>
    async function go(){
      for (const cv of document.querySelectorAll('canvas.loupe')) {
        const im = new Image(); im.src = cv.dataset.src; await im.decode();
        const s = document.createElement('canvas'); s.width = s.height = 32; s.getContext('2d').drawImage(im, 0, 0, 32, 32);
        const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, 192, 192);
      }
      for (const cv of document.querySelectorAll('canvas.loupe2')) {
        const im = new Image(); im.src = cv.dataset.src; await im.decode();
        const w = Math.round(im.naturalWidth * 40 / im.naturalHeight);
        const s = document.createElement('canvas'); s.width = w; s.height = 40; s.getContext('2d').drawImage(im, 0, 0, w, 40);
        cv.width = w * 4; cv.height = 160; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, w * 4, 160);
      }
      document.body.dataset.done = 1;
    }
    go();</script>`;
  fs.writeFileSync(`${dir}/_sheet-${num}.html`, html);
  const p = await b.newPage({ viewport: { width: 1100, height: 600 }, deviceScaleFactor: 1 });
  await p.goto(`file://${dir}/_sheet-${num}.html`);
  await p.waitForSelector('body[data-done]');
  await p.screenshot({ path: `${dir}/planche-concept-${num}-${slug}.png`, fullPage: true });
  await p.close();
}
await b.close();
