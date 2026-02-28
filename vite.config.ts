import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite dev-server plugin: handles /api/claude in local `pnpm dev` so the
 * Claude chat panel and analysis work without needing `vercel dev`.
 * In production the real Vercel Edge Function at api/claude.ts takes over.
 */
function claudeDevProxy() {
  return {
    name: 'claude-dev-proxy',
    apply: 'serve' as const,
    configureServer(server: {
      ssrLoadModule: (path: string) => Promise<Record<string, unknown>>;
      middlewares: {
        use: (
          path: string,
          handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void
        ) => void;
      };
    }) {
      server.middlewares.use('/api/claude', async (req, res, next) => {
        try {
          // Load the edge function via Vite's SSR transform (handles TypeScript)
          const mod = await server.ssrLoadModule('/api/claude.ts');
          const handler = mod.default as (request: Request) => Promise<Response>;

          // Collect body
          const chunks: Buffer[] = [];
          for await (const chunk of req as unknown as AsyncIterable<Buffer>) {
            chunks.push(chunk);
          }
          const bodyText = Buffer.concat(chunks).toString('utf-8');

          // Build a Web API Request from the Node IncomingMessage
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value);
            else if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
          }
          const webReq = new Request(`http://localhost${req.url ?? '/'}`, {
            method: req.method ?? 'GET',
            headers,
            body: req.method !== 'GET' && req.method !== 'HEAD' && bodyText ? bodyText : undefined,
          });

          const webRes = await handler(webReq);

          // Write status + headers
          res.statusCode = webRes.status;
          webRes.headers.forEach((value, key) => res.setHeader(key, value));

          // Stream the response body
          if (webRes.body) {
            const reader = webRes.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!res.writableEnded) res.write(value);
            }
          }
          if (!res.writableEnded) res.end();
        } catch (err) {
          next();
          console.error('[claude-dev-proxy]', err);
        }
      });
    },
  };
}

/**
 * Vite dev-server plugin: handles /api/openai in local `pnpm dev` so the
 * OpenAI provider works without needing `vercel dev`.
 * In production the real Vercel Edge Function at api/openai.ts takes over.
 */
function openaiDevProxy() {
  return {
    name: 'openai-dev-proxy',
    apply: 'serve' as const,
    configureServer(server: {
      ssrLoadModule: (path: string) => Promise<Record<string, unknown>>;
      middlewares: {
        use: (
          path: string,
          handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void
        ) => void;
      };
    }) {
      server.middlewares.use('/api/openai', async (req, res, next) => {
        try {
          const mod = await server.ssrLoadModule('/api/openai.ts');
          const handler = mod.default as (request: Request) => Promise<Response>;

          const chunks: Buffer[] = [];
          for await (const chunk of req as unknown as AsyncIterable<Buffer>) {
            chunks.push(chunk);
          }
          const bodyText = Buffer.concat(chunks).toString('utf-8');

          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value);
            else if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
          }
          const webReq = new Request(`http://localhost${req.url ?? '/'}`, {
            method: req.method ?? 'GET',
            headers,
            body: req.method !== 'GET' && req.method !== 'HEAD' && bodyText ? bodyText : undefined,
          });

          const webRes = await handler(webReq);

          res.statusCode = webRes.status;
          webRes.headers.forEach((value, key) => res.setHeader(key, value));

          if (webRes.body) {
            const reader = webRes.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!res.writableEnded) res.write(value);
            }
          }
          if (!res.writableEnded) res.end();
        } catch (err) {
          next();
          console.error('[openai-dev-proxy]', err);
        }
      });
    },
  };
}

/**
 * Vite dev-server plugin: handles /api/azure-openai in local `pnpm dev` so the
 * Azure OpenAI provider works without needing `vercel dev`.
 * In production the real Vercel Edge Function at api/azure-openai.ts takes over.
 */
function azureOpenaiDevProxy() {
  return {
    name: 'azure-openai-dev-proxy',
    apply: 'serve' as const,
    configureServer(server: {
      ssrLoadModule: (path: string) => Promise<Record<string, unknown>>;
      middlewares: {
        use: (
          path: string,
          handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void
        ) => void;
      };
    }) {
      server.middlewares.use('/api/azure-openai', async (req, res, next) => {
        try {
          const mod = await server.ssrLoadModule('/api/azure-openai.ts');
          const handler = mod.default as (request: Request) => Promise<Response>;

          const chunks: Buffer[] = [];
          for await (const chunk of req as unknown as AsyncIterable<Buffer>) {
            chunks.push(chunk);
          }
          const bodyText = Buffer.concat(chunks).toString('utf-8');

          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value);
            else if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
          }
          const webReq = new Request(`http://localhost${req.url ?? '/'}`, {
            method: req.method ?? 'GET',
            headers,
            body: req.method !== 'GET' && req.method !== 'HEAD' && bodyText ? bodyText : undefined,
          });

          const webRes = await handler(webReq);

          res.statusCode = webRes.status;
          webRes.headers.forEach((value, key) => res.setHeader(key, value));

          if (webRes.body) {
            const reader = webRes.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!res.writableEnded) res.write(value);
            }
          }
          if (!res.writableEnded) res.end();
        } catch (err) {
          next();
          console.error('[azure-openai-dev-proxy]', err);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss(), claudeDevProxy(), openaiDevProxy(), azureOpenaiDevProxy()],
    build: {
      // Keep per-chunk warning threshold generous; @google/genai is legitimately large
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Google Generative AI SDK into its own vendor chunk
            'vendor-google-genai': ['@google/genai'],
            // Lucide icons (large) into its own chunk
            'vendor-lucide': ['lucide-react'],
          },
        },
      },
    },
    define: {
      // Expose VITE_GEMINI_API_KEY to the client if it's set in environment.
      // In test mode, inject an empty string so unit tests never hit real APIs.
      'import.meta.env.VITE_GEMINI_API_KEY':
        mode === 'test' ? JSON.stringify('') : JSON.stringify(env.GEMINI_API_KEY),
    },
    optimizeDeps: {
      include: ['essentia.js'], // Pre-bundle essentia.js for better compatibility
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './vitest.setup.ts',
    },
  };
});
