import { defineConfig } from 'vite';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

const buildVersion = process.env.CAMPUS_BUILD_VERSION ?? new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const devApiTarget = process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8080';

function findClosingBrace(css: string, openIndex: number) {
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  let inComment = false;

  for (let index = openIndex; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];

    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      inComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function unwrapCascadeLayers(css: string): string {
  let result = '';
  let cursor = 0;

  while (cursor < css.length) {
    const layerIndex = css.indexOf('@layer', cursor);

    if (layerIndex === -1) {
      result += css.slice(cursor);
      break;
    }

    result += css.slice(cursor, layerIndex);

    const blockStart = css.indexOf('{', layerIndex);
    const statementEnd = css.indexOf(';', layerIndex);

    if (statementEnd !== -1 && (blockStart === -1 || statementEnd < blockStart)) {
      cursor = statementEnd + 1;
      continue;
    }

    if (blockStart === -1) {
      result += css.slice(layerIndex);
      break;
    }

    const blockEnd = findClosingBrace(css, blockStart);

    if (blockEnd === -1) {
      result += css.slice(layerIndex);
      break;
    }

    result += unwrapCascadeLayers(css.slice(blockStart + 1, blockEnd));
    cursor = blockEnd + 1;
  }

  return result;
}

function normalizeHtmlForWechatWebview(html: string) {
  return html
    .replace(/\s+crossorigin(?=[\s>])/g, '')
    .replace(/(<link rel="stylesheet" href="[^"]+\.css)(?:\?v=[^"]*)?(")/g, `$1?v=${buildVersion}$2`);
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'wechat-webview-html-compat',
      transformIndexHtml(html) {
        return normalizeHtmlForWechatWebview(html);
      },
      generateBundle(_, bundle) {
        for (const asset of Object.values(bundle)) {
          if (asset.type !== 'asset' || !asset.fileName.endsWith('.css') || typeof asset.source !== 'string') {
            continue;
          }

          asset.source = unwrapCascadeLayers(asset.source);
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
      },
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
});
