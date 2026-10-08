# Project rules

- Keep the visual palette in semantic CSS tokens and use those tokens for occurrence markers and legends, so palette changes remain presentation-only and consistent.
- Declare browser environment variables in `src/vite-env.d.ts` rather than editing generated integration clients, so generated files remain untouched.