import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    nitro(
      process.env.VERCEL
        ? {}
        : {
            preset: "cloudflare-module",
            output: { dir: "dist", publicDir: "dist/client", serverDir: "dist/server" },
          },
    ),
    viteReact(),
    tailwindcss(),
  ],
});
