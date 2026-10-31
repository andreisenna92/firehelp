import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// On Vercel, Nitro auto-detects its preset. Elsewhere (Lovable), build a
// Cloudflare Worker into dist/, which is what Lovable deploys. Dev mode keeps
// Nitro's default dev flow — the custom preset/output only applies to builds.
// Hosted preview builds may run without .env; fall back to the project's
// public (publishable) backend values so the browser client can start.
const FALLBACK_SUPABASE_URL = "https://c--81bb57ea-0a3d-4324-a8f4-33d6e0715eb8-prod.lovable.cloud";
const FALLBACK_SUPABASE_KEY = "sb_publishable_Hl6BL1qmBzTRgyEEMu9O5g_yStldCSO";

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const supabaseUrl = env["VITE_SUPABASE_URL"] || env["SUPABASE_URL"] || FALLBACK_SUPABASE_URL;
  const supabaseKey =
    env["VITE_SUPABASE_PUBLISHABLE_KEY"] || env["SUPABASE_PUBLISHABLE_KEY"] || FALLBACK_SUPABASE_KEY;
  return {
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
  },
  server: { port: 3000, fs: { allow: ["/persist", "/dev-server"] } },
  nitro: command === "build" && !process.env["VERCEL"]
    ? {
        preset: "cloudflare-module",
        output: { dir: "dist", publicDir: "dist/client", serverDir: "dist/server" },
      }
    : {},
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    nitro(),
    viteReact(),
    tailwindcss(),
  ],
  };
});
