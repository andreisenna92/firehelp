import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// On Vercel, Nitro auto-detects its preset. Elsewhere (Lovable), build a
// Cloudflare Worker into dist/, which is what Lovable deploys.
const lovableBuild = !process.env["VERCEL"];

export default defineConfig({
  server: { port: 3000 },
  nitro: lovableBuild
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
});
