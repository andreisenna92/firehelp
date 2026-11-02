interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY: string;
  readonly VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}