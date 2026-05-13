/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TG_BOT_USERNAME: string;
  readonly VITE_APP_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
