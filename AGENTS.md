# Project rules

- Keep the visual palette in semantic CSS tokens and use those tokens for occurrence markers and legends, so palette changes remain presentation-only and consistent.
- Declare browser environment variables in `src/vite-env.ts` rather than editing generated integration clients, so generated files remain untouched and automated checks include the declarations.
- Record changes to key tables in public.audit_log through database triggers, so the history of changes stays in the database even if a page or screen changes.
- In `vite.config.ts`, apply the Nitro custom preset/output (`cloudflare-module` → `dist/`) only when `command === "build"`; applying it in dev breaks Nitro's dev entry. Keep `server.fs.allow` covering `/persist`, since node_modules real paths live there and Vite otherwise silently refuses to serve them.
- The FireHelp brand mascot is "Mimo", a golden lion tamarin firefighter; the logo and mascot art come from `src/assets/mimo-*.webp` imported directly (not CDN pointers, which the local dev server does not serve).
