#!/usr/bin/env node

/**
 * Sonic Architect CLI
 * Launches the development server and opens Google Chrome
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { platform } from 'os';

// Resolve the project root directory (where the CLI is installed)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Configuration
const PORT = 3000;
const HOST = 'http://localhost:' + PORT;

/**
 * Open URL in Google Chrome
 */
function openChrome(url) {
  let chromePath;
  let args;

  if (platform() === 'darwin') {
    // macOS: use 'open' with bundle ID
    chromePath = 'open';
    args = ['-a', 'Google Chrome', url];
  } else if (platform() === 'win32') {
    chromePath = 'start';
    args = ['""', url];
  } else {
    // Linux - try common Chrome paths
    const linuxPaths = ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];

    for (const path of linuxPaths) {
      try {
        import('fs').then(({ accessSync, constants }) => {
          accessSync(path, constants.X_OK);
          chromePath = path;
          args = [url];
          return;
        });
      } catch (e) {
        // Try next path
      }
    }

    // Fallback to generic 'chrome'
    if (!chromePath) {
      chromePath = 'google-chrome';
      args = [url];
    }
  }

  const browser = spawn(chromePath, args, {
    detached: true,
    stdio: 'ignore',
    shell: platform() === 'win32' ? true : false,
  });

  browser.unref(); // Don't wait for browser to close
  return browser;
}

/**
 * Wait for server to be ready
 */
function waitForServer(url, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const tryConnect = () => {
      attempts++;

      // Simple TCP connection check using Node's http module
      import('http')
        .then(({ get }) => {
          const req = get(url, (res) => {
            if (res.statusCode === 200) {
              resolve();
            } else {
              retry();
            }
          });

          req.on('error', () => {
            retry();
          });

          req.setTimeout(1000, () => {
            req.destroy();
            retry();
          });
        })
        .catch(() => {
          retry();
        });
    };

    const retry = () => {
      if (attempts >= maxAttempts) {
        reject(new Error('Server failed to start after ' + maxAttempts + ' attempts'));
        return;
      }
      setTimeout(tryConnect, 500);
    };

    tryConnect();
  });
}

/**
 * Main entry point
 */
async function main() {
  console.log('🎵 Sonic Architect - Starting development server...\n');

  // Spawn Vite dev server
  const vite = spawn('pnpm', ['dev'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });

  // Handle process exit
  const cleanup = () => {
    console.log('\n👋 Shutting down Sonic Architect...');
    vite.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Wait for server to be ready
  try {
    await waitForServer(HOST);
    console.log(`\n✅ Server ready at ${HOST}`);
    console.log('🌐 Opening Google Chrome...\n');

    // Open Chrome
    openChrome(HOST);
  } catch (error) {
    console.error('❌ Error:', error.message);
    vite.kill();
    process.exit(1);
  }

  // Keep process alive (Vite runs in foreground via stdio: inherit)
  vite.on('close', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch(console.error);
