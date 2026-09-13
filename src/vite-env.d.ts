/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_MANAGER_PASSWORD: string
  readonly VITE_REQUESTER_PASSWORD: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
