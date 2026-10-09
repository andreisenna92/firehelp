# Project rules

- Keep the visual palette in semantic CSS tokens and use those tokens for occurrence markers and legends, so palette changes remain presentation-only and consistent.
- Declare browser environment variables in `src/vite-env.ts` rather than editing generated integration clients, so generated files remain untouched and automated checks include the declarations.- Record changes to key tables in public.audit_log through database triggers, so the history of changes stays in the database even if a page or screen changes.
