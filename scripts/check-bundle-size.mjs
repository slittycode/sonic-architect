#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const assetsDir = join(process.cwd(), 'dist', 'assets');
const maxChunkBytes = Number(process.env.BUNDLE_MAX_CHUNK_BYTES || 2_900_000);
const maxTotalJsBytes = Number(process.env.BUNDLE_MAX_TOTAL_JS_BYTES || 6_000_000);

const files = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
const sizes = files.map((file) => ({
  file,
  bytes: statSync(join(assetsDir, file)).size,
}));

const largest = sizes.reduce((a, b) => (a.bytes > b.bytes ? a : b), { file: '', bytes: 0 });
const totalJs = sizes.reduce((sum, item) => sum + item.bytes, 0);

if (largest.bytes > maxChunkBytes) {
  console.error(
    `[bundle-budget] Largest chunk ${largest.file} is ${largest.bytes} bytes, above ${maxChunkBytes}`
  );
  process.exit(1);
}

if (totalJs > maxTotalJsBytes) {
  console.error(`[bundle-budget] Total JS ${totalJs} bytes, above ${maxTotalJsBytes}`);
  process.exit(1);
}

console.log(
  `[bundle-budget] OK. Largest chunk: ${largest.file} (${largest.bytes} bytes). Total JS: ${totalJs} bytes.`
);
