/**
 * Locates the sql.js WASM binary. In the browser build, Vite's `?url` import
 * resolves to a fingerprinted static asset URL that the service worker also
 * caches for offline use. This is isolated into its own module so tests can
 * mock it with a plain filesystem path instead (sql.js loads it via
 * `fs.readFileSync` under Node/jsdom).
 */
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export default sqlWasmUrl;
