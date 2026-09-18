CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "adapter_kind" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "generation_endpoint" TEXT NOT NULL,
    "model_endpoint" TEXT,
    "auth_type" TEXT NOT NULL,
    "auth_header_name" TEXT,
    "auth_scheme" TEXT,
    "credential_env_var" TEXT,
    "adapter_config" JSONB NOT NULL,
    "manual_models" JSONB NOT NULL,
    "cached_models" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_test_status" TEXT NOT NULL DEFAULT 'NEVER',
    "last_tested_at" DATETIME,
    "last_test_error" TEXT,
    "models_refreshed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "ai_use_case_settings" (
    "use_case" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ai_use_case_settings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ai_request_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT,
    "use_case" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "outcome" TEXT NOT NULL,
    "failure_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_request_logs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ai_providers_name_key" ON "ai_providers"("name");
CREATE INDEX "ai_providers_enabled_name_idx" ON "ai_providers"("enabled", "name");
CREATE INDEX "ai_use_case_settings_provider_id_idx" ON "ai_use_case_settings"("provider_id");
CREATE INDEX "ai_request_logs_created_at_idx" ON "ai_request_logs"("created_at");
CREATE INDEX "ai_request_logs_provider_id_use_case_idx" ON "ai_request_logs"("provider_id", "use_case");
