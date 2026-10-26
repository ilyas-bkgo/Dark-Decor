import { defineConfig } from 'vite';

function socialMetadata() {
  let siteUrl;
  let pixelId;

  return {
    name: 'dark-decor-social-metadata',
    configResolved(config) {
      pixelId = config.env.VITE_META_PIXEL_ID?.trim() ?? '';
      const configuredUrl = config.env.VITE_SITE_URL?.trim();
      if (!configuredUrl) return;

      let parsedUrl;
      try {
        parsedUrl = new URL(configuredUrl);
      } catch {
        throw new Error('VITE_SITE_URL must be an absolute http(s) URL.');
      }
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('VITE_SITE_URL must be an absolute http(s) URL.');
      }
      siteUrl = parsedUrl.origin;
    },
    transformIndexHtml(html) {
      const withPixelId = html.replaceAll('__DARK_DECOR_META_PIXEL_ID__', JSON.stringify(pixelId));
      if (!siteUrl) return withPixelId;
      const tags = [
        `<meta property="og:url" content="${siteUrl}/" />`,
        `<meta property="og:image" content="${siteUrl}/og-image.jpg" />`,
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        '<meta property="og:image:alt" content="حصيرة تجفيف للمطبخ من Dark Decor" />',
      ].join('\n    ');
      return withPixelId.replace('</head>', `    ${tags}\n  </head>`);
    },
  };
}

export default defineConfig({
  plugins: [socialMetadata()],
});
