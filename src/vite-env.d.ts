/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}


/** Visitario's version (package.json) and the short commit it was built from (empty locally). */
declare const __APP_VERSION__: string
declare const __APP_COMMIT__: string
