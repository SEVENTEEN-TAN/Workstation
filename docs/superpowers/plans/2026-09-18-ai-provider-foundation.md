# AI Provider Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure, provider-neutral AI configuration and invocation infrastructure for the approved project, weekly-update, and OKR-review draft flows.

**Architecture:** Store provider metadata, use-case defaults, cached models, and redacted request logs in Prisma. Route every upstream request through one validated adapter interface with built-in OpenAI-compatible and Anthropic implementations plus a declarative custom JSON implementation.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6, SQLite, Zod 4, Vitest, existing admin UI components.

**Spec:** `docs/superpowers/specs/2026-09-18-ai-provider-foundation-design.md`

## Global Constraints

- Never persist or return credential values; store only the environment-variable name.
- Allow only `http:` and `https:` base URLs without embedded credentials.
- Do not execute scripts or expressions from custom adapter configuration.
- Use a 20-second request timeout and reject redirects.
- Do not store source prompts, generated output, request headers, or raw upstream payloads in logs.
- Limit use cases to `PROJECT_DESCRIPTION`, `WEEKLY_UPDATE`, and `OKR_REVIEW`.

---

### Task 1: Provider Schema And Validation

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260918070000_add_ai_provider_foundation/migration.sql`
- Create: `src/lib/validators/ai-providers.ts`
- Test: `tests/ai-provider-config.test.ts`

**Interfaces:**
- Produces `aiProviderInputSchema`, `aiUseCaseDefaultsSchema`, and normalized provider input types.

- [x] Write failing validation tests for adapter-specific configuration, URLs, endpoints, headers, model IDs, and environment-variable names.
- [x] Run `npm test -- tests/ai-provider-config.test.ts` and confirm the missing-module failure.
- [x] Add the three Prisma models and the smallest matching Zod schemas.
- [x] Run `npm run db:generate` and the targeted tests until green.

### Task 2: Adapter And Safe HTTP Runtime

**Files:**
- Create: `src/lib/ai/adapters.ts`
- Create: `src/lib/ai/declarative-json.ts`
- Create: `src/lib/ai/runtime.ts`
- Test: `tests/ai-adapters.test.ts`

**Interfaces:**
- Produces `getAiAdapter(provider)`, `renderJsonTemplate(value, variables)`, `readJsonPath(value, path)`, `discoverProviderModels(provider, fetcher)`, and `generateAiText(provider, input, fetcher)`.

- [x] Write failing tests for OpenAI-compatible and Anthropic request/response shapes.
- [x] Write failing tests for recursive custom JSON rendering, response-path extraction, model discovery, timeout/redirect options, and credential headers.
- [x] Implement the minimal adapter and runtime functions with no new dependency.
- [x] Run `npm test -- tests/ai-adapters.test.ts` until green.

### Task 3: Provider Administration Service And APIs

**Files:**
- Create: `src/lib/services/ai-providers.ts`
- Create: `src/app/api/admin/ai/providers/route.ts`
- Create: `src/app/api/admin/ai/providers/[id]/route.ts`
- Create: `src/app/api/admin/ai/providers/[id]/test/route.ts`
- Create: `src/app/api/admin/ai/providers/[id]/models/route.ts`
- Create: `src/app/api/admin/ai/defaults/route.ts`
- Test: `tests/ai-provider-service.test.ts`

**Interfaces:**
- Produces `aiProviderService.listState()`, `save(input)`, `update(id, input)`, `test(id, fetcher?)`, `refreshModels(id, fetcher?)`, and `saveDefaults(input)`.

- [x] Write failing service tests for credential lookup, activation after successful test, model caching/manual models, defaults, and redacted errors.
- [x] Implement transactional provider/default persistence and thin authenticated routes.
- [x] Run targeted tests, `npx tsc --noEmit`, and `npm run lint` until green.

### Task 4: Administration Workspace And Release Verification

**Files:**
- Create: `src/components/admin/AiProviderWorkspace.tsx`
- Create: `src/app/admin/(workspace)/ai/page.tsx`
- Modify: `src/components/admin/navigation.ts`
- Modify: `src/components/admin/types.ts`
- Modify: `tests/admin-ui-contracts.test.ts`
- Modify: `docs/product-roadmap.md`

**Interfaces:**
- Consumes the provider state and APIs from Task 3.
- Produces the route-addressable `/admin/ai` configuration workflow.

- [x] Add failing UI contract tests for the navigation item, protected routes, provider form, connection test, model refresh/manual entry, defaults, and log redaction copy.
- [x] Implement the workspace using existing `PageHeader`, `FeedbackCenter`, `ConfirmDialog`, and form styles.
- [x] Verify the workflow in a fresh local SQLite database with `admin/admin`.
- [x] Run the full test suite, lint, type check, Prisma validation/generation, fresh migrations, production build, and `git diff --check`.
- [x] Mark roadmap lines 131-139 complete only after the corresponding behavior is verified.
