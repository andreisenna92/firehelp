import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// On Vercel, Nitro auto-detects its preset. Elsewhere (Lovable), build a
// Cloudflare Worker into dist/, which is what Lovable deploys. Dev mode keeps
// Nitro's default dev flow — the custom preset/output only applies to builds.
export default defineConfig(({ command }) => ({
  server: { port: 3000 },
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
}));
