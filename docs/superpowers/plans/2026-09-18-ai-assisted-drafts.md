# AI Assisted Drafts Implementation Plan

1. Add `AiContentDraft` to Prisma and create its SQLite migration.
2. Add structured generation schemas, JSON parsing, default-provider resolution, and redacted logging tests.
3. Implement project and OKR draft generation, list, discard, and explicit apply services with unit tests.
4. Add weekly AI rewriting to the existing draft service with source preservation tests.
5. Add authenticated API routes and admin UI controls for all three flows.
6. Run targeted tests, full tests, lint, TypeScript, Prisma validation/generation, fresh migration/seed, production build, and diff checks.
7. Mark the roadmap items complete only after end-to-end verification, then commit and push to `main`.
