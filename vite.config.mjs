import { defineConfig } from 'vite';

function socialMetadata() {
  let siteUrl;

  return {
    name: 'dark-decor-social-metadata',
    configResolved(config) {
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
      if (!siteUrl) return html;
      const tags = [
        `<meta property="og:url" content="${siteUrl}/" />`,
        `<meta property="og:image" content="${siteUrl}/og-image.jpg" />`,
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        '<meta property="og:image:alt" content="حصيرة تجفيف للمطبخ من Dark Decor" />',
      ].join('\n    ');
      return html.replace('</head>', `    ${tags}\n  </head>`);
    },
  };
}

export default defineConfig({
  plugins: [socialMetadata()],
});
