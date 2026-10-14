/**
 * Copies the MediaPipe Tasks Vision WASM runtime from node_modules into
 * `public/mediapipe-wasm` so it can be served statically, cached by the
 * service worker, and used fully offline. Run automatically before
 * `dev`/`build` (see package.json) so a fresh `npm install` always works.
 */
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dest = join(root, 'public/mediapipe-wasm');

mkdirSync(dest, { recursive: true });

const files = readdirSync(src).filter((f) => f.endsWith('.wasm') || f.endsWith('.js'));
for (const file of files) {
  cpSync(join(src, file), join(dest, file));
}

console.log(`Copied ${files.length} MediaPipe WASM runtime files to public/mediapipe-wasm`);
