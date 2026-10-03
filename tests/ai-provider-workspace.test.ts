import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AiProviderWorkspace } from "../src/components/admin/AiProviderWorkspace";
import type { AiProviderData } from "../src/components/admin/types";

function provider(overrides: Partial<AiProviderData> = {}): AiProviderData {
  return {
    id: "provider-1", name: "Local AI", adapterKind: "OPENAI_COMPATIBLE",
    baseUrl: "http://localhost:11434/v1", generationEndpoint: "/chat/completions",
    modelEndpoint: "/models", authType: "NONE", authHeaderName: null, authScheme: null,
    adapterConfig: {}, manualModels: ["local-model"], cachedModels: [], enabled: false,
    lastTestStatus: "NEVER", lastTestedAt: null, modelsRefreshedAt: null,
    credentialConfigured: false, createdAt: "2026-10-03T00:00:00Z", updatedAt: "2026-10-03T00:00:00Z",
    ...overrides,
  };
}

function render(providers: AiProviderData[] = []) {
  return renderToStaticMarkup(createElement(AiProviderWorkspace, {
    initialState: { providers, defaults: [], requestLogs: [] },
  }));
}

function input(html: string, name: string) {
  return html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
}

describe("AI provider workspace", () => {
  it("starts directly in a usable creation form, with advanced controls mounted and logs folded", () => {
    const html = render();
    expect(input(html, "name")).toContain('required=""');
    expect(html).toContain('name="manualModels"');
    expect(html).toMatch(/<details[^>]*><summary>高级配置/);
    expect(html).toMatch(/<details[^>]*><summary>请求日志/);
    expect(input(html, "generationEndpoint")).toContain('required=""');
    expect(html).toMatch(/id="ai-defaults-panel"[^>]*hidden=""/);
    expect(html).toContain('name="defaultProvider.PROJECT_DESCRIPTION"');
    expect(input(html, "enabled")).toContain('disabled=""');
  });

  it("keeps test-before-enable gating for a selected provider", () => {
    expect(input(render([provider()]), "enabled")).toContain('disabled=""');
    const successful = render([provider({ lastTestStatus: "SUCCESS", enabled: true })]);
    expect(input(successful, "enabled")).toContain('checked=""');
    expect(input(successful, "enabled")).not.toContain('disabled=""');
    expect(successful).toContain("无需密钥");
    expect(successful).toMatch(/name="credentialEnvVar"[^>]*value=""/);
  });

  it("retains custom JSON and custom-header fields inside advanced configuration", () => {
    const html = render([provider({
      adapterKind: "CUSTOM_JSON", authType: "CUSTOM_HEADER", authHeaderName: "x-token",
      adapterConfig: { requestTemplate: { prompt: "${prompt}" }, headers: {}, responseTextPath: "result.text" },
    })]);
    for (const field of ["authType", "authHeaderName", "authScheme", "headers", "requestTemplate", "responseTextPath", "inputTokensPath", "outputTokensPath", "modelListPath", "modelIdPath"]) {
      expect(html).toContain(`name="${field}"`);
    }
    expect(html).toContain('value="result.text"');
    expect(html).toContain('value="x-token"');
  });
});
