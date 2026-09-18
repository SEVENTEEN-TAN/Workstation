# AI Provider Foundation Design

## Scope

This iteration adds the private administration foundation required by the three approved AI-assisted draft flows: project descriptions, weekly updates, and OKR reviews. It does not generate or publish business content yet.

The foundation must support:

- built-in OpenAI-compatible Chat Completions and Anthropic Messages adapters;
- a declarative custom JSON adapter with no executable scripts;
- custom base URL, request endpoint, optional model-list endpoint, headers, request templates, and response paths;
- credentials referenced only by server environment-variable name;
- upstream model discovery with a cached snapshot and manual model entries;
- one default provider/model per approved use case;
- an explicit connection test before a provider may be enabled;
- request audit metadata without prompts, responses, credentials, or raw upstream payloads.

## Data Model

`AiProvider` stores the administrator-owned provider definition. `adapterKind` is `OPENAI_COMPATIBLE`, `ANTHROPIC_MESSAGES`, or `CUSTOM_JSON`. Common fields store the name, base URL, generation endpoint, optional model endpoint, enabled/test state, credential environment-variable name, and cached model IDs. Adapter-specific declarative settings live in validated JSON.

`AiUseCaseSetting` stores one row for each approved use case: `PROJECT_DESCRIPTION`, `WEEKLY_UPDATE`, and `OKR_REVIEW`. Each row points to a tested provider and a model ID.

`AiRequestLog` stores provider, use case, model, latency, token counts when available, outcome, and a sanitized failure reason. It never stores request headers, credentials, source content, generated content, or raw payloads.

## Adapter Contract

Every adapter exposes the same small interface:

```ts
type AiAdapter = {
  buildGenerationRequest(provider, input, credential): Request;
  readGenerationResponse(payload): { text: string; inputTokens: number | null; outputTokens: number | null };
  buildModelRequest(provider, credential): Request | null;
  readModels(payload): string[];
};
```

OpenAI-compatible uses `POST /chat/completions`, `model` plus `messages`, `choices[0].message.content`, optional `GET /models`, and Bearer authorization. Anthropic uses `POST /v1/messages`, `x-api-key`, `anthropic-version`, `content[0].text`, and optional `GET /v1/models`.

The custom adapter recursively renders a JSON request template using only `${model}`, `${system}`, and `${prompt}` placeholders. Headers use literal values plus `${credential}`. Dot-and-index paths such as `choices.0.message.content` extract response text and model IDs. No JavaScript, expressions, or arbitrary code are accepted.

## Network And Credential Safety

- Base URLs must be absolute `http:` or `https:` URLs without embedded credentials.
- Relative endpoints are resolved against the base URL.
- Requests use `AbortSignal.timeout(20_000)` and `redirect: "error"`.
- Credentials are read from `process.env[credentialEnvVar]` only on the server and are never serialized to the browser.
- Admin responses expose only `credentialConfigured: boolean`.
- Connection tests and model discovery return sanitized errors and record only non-sensitive metadata.

Private or localhost URLs remain allowed because local model servers are an explicit use case for custom URLs. This is an administrator-only capability, not a public proxy.

## Administration Flow

`/admin/ai` lists providers, cached/manual models, test state, defaults, and recent request logs. The administrator can create or edit a provider, test it, refresh models, enable it after a successful test, add manual model IDs, and assign defaults by use case.

All APIs use the existing `withAdminSession` guard. Destructive provider deletion is out of scope; providers can be disabled so request logs and defaults retain referential integrity.

## Testing

- Unit tests cover built-in request/response mappings, declarative template rendering and path extraction, URL/header validation, error sanitization, model normalization, and activation rules.
- Service tests cover environment credential lookup, connection testing, model caching, defaults, and request-log redaction.
- Admin contract tests cover protected routes and the complete configuration workflow.
- A fresh SQLite database must apply every migration and seed successfully.

