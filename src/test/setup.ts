import { vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// sql.js loads its WASM binary via `fs.readFileSync` under Node/jsdom, so the
// test environment needs a real filesystem path instead of the fingerprinted
// browser asset URL that Vite produces for the `?url` import.
vi.mock('../db/sqlWasmUrl', () => ({
  default: fileURLToPath(import.meta.resolve('sql.js/dist/sql-wasm.wasm')),
}));
