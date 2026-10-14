/// <reference types="vite/client" />

declare module '*.wasm?url' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'sqlite' | 'api';
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
