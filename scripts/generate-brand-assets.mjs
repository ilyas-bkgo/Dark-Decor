import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const faviconSvg = await readFile(path.join(publicDir, 'favicon.svg'));
const bronze = '#B38B5D';
const ink = '#111010';
const cream = '#F4EFE7';

async function renderMark(size) {
  return sharp(faviconSvg).resize(size, size).png().toBuffer();
}

async function renderPaddedMark(size, scale, background) {
  const markSize = Math.round(size * scale);
  const mark = await renderMark(markSize);
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: mark, left: Math.floor((size - markSize) / 2), top: Math.floor((size - markSize) / 2) }])
    .png()
    .toBuffer();
}

async function makeIco(sizes) {
  const frames = await Promise.all(sizes.map(renderMark));
  const headerSize = 6 + sizes.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  let offset = headerSize;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frames[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frames[index].length;
  });
  return Buffer.concat([header, ...frames]);
}

await Promise.all([
  writeFile(path.join(publicDir, 'favicon.ico'), await makeIco([16, 32, 48])),
  sharp(faviconSvg).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png')),
  sharp(faviconSvg).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png')),
  sharp(faviconSvg).resize(96, 96).png().toFile(path.join(publicDir, 'favicon-96x96.png')),
  writeFile(path.join(publicDir, 'apple-touch-icon.png'), await renderPaddedMark(180, 0.76, cream)),
  writeFile(path.join(publicDir, 'icon-maskable-512.png'), await renderPaddedMark(512, 0.6, ink)),
]);

const photoPath = path.join(publicDir, 'images/product/product-top-view.jpg');
const productPhoto = await sharp(photoPath)
  .resize(620, 630, { fit: 'cover', position: 'centre' })
  .jpeg({ quality: 88, mozjpeg: true })
  .toBuffer();
const logo = await renderMark(88);
const overlay = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect x="620" width="580" height="630" fill="${ink}"/>
  <rect x="620" width="4" height="630" fill="${bronze}"/>
  <image href="data:image/png;base64,${logo.toString('base64')}" x="872" y="54" width="76" height="76"/>
  <text x="910" y="174" text-anchor="middle" direction="ltr"
    font-family="Noto Sans Arabic, IBM Plex Sans Arabic, sans-serif" font-size="28" font-weight="700" fill="${cream}">Dark Decor</text>
  <text x="910" y="320" text-anchor="middle" direction="rtl" unicode-bidi="plaintext"
    font-family="Noto Sans Arabic, IBM Plex Sans Arabic, sans-serif" font-size="52" font-weight="700" fill="${cream}">حصيرة تجفيف للمطبخ</text>
  <text x="910" y="408" text-anchor="middle" direction="rtl" unicode-bidi="plaintext"
    font-family="Noto Sans Arabic, IBM Plex Sans Arabic, sans-serif" font-size="38" font-weight="600" fill="${bronze}">ابتداءً من 149 درهم</text>
</svg>`);

await sharp({ create: { width: 1200, height: 630, channels: 3, background: ink } })
  .composite([
    { input: productPhoto, left: 0, top: 0 },
    { input: overlay, left: 0, top: 0 },
  ])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(path.join(publicDir, 'og-image.jpg'));

console.log('Generated favicon, app icons, and og-image.jpg.');
