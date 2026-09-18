"use client";

import { Bot, KeyRound, LoaderCircle, PlugZap, Plus, RefreshCw, Save, ScrollText } from "lucide-react";
import { useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { adminRequest } from "./request";
import type { AiProviderData, AiProviderStateData, AiUseCaseSettingData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";
import { AI_ADAPTER_KINDS, AI_AUTH_TYPES, AI_USE_CASES } from "../../lib/validators/ai-providers";

type AiUseCase = (typeof AI_USE_CASES)[number];

interface ProviderForm {
  name: string;
  adapterKind: (typeof AI_ADAPTER_KINDS)[number];
  baseUrl: string;
  generationEndpoint: string;
  modelEndpoint: string;
  authType: (typeof AI_AUTH_TYPES)[number];
  authHeaderName: string;
  authScheme: string;
  credentialEnvVar: string;
  manualModels: string;
  enabled: boolean;
  requestTemplate: string;
  headers: string;
  responseTextPath: string;
  inputTokensPath: string;
  outputTokensPath: string;
  modelListPath: string;
  modelIdPath: string;
}

type DefaultSelection = Record<AiUseCase, { providerId: string; model: string }>;

const USE_CASE_LABELS: Record<AiUseCase, string> = {
  PROJECT_DESCRIPTION: "项目说明",
  WEEKLY_UPDATE: "每周动态",
  OKR_REVIEW: "OKR 复盘",
};

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "尚未执行";
}

function customText(provider: AiProviderData | null, key: string) {
  const value = provider?.adapterKind === "CUSTOM_JSON" ? provider.adapterConfig[key] : undefined;
  return typeof value === "string" ? value : "";
}

function createProviderForm(provider?: AiProviderData | null): ProviderForm {
  if (!provider) {
    return {
      name: "",
      adapterKind: "OPENAI_COMPATIBLE",
      baseUrl: "https://api.openai.com/v1",
      generationEndpoint: "/chat/completions",
      modelEndpoint: "/models",
      authType: "BEARER",
      authHeaderName: "",
      authScheme: "Bearer",
      credentialEnvVar: "OPENAI_API_KEY",
      manualModels: "",
      enabled: false,
      requestTemplate: "{\n  \"model\": \"${model}\",\n  \"messages\": [\n    { \"role\": \"system\", \"content\": \"${system}\" },\n    { \"role\": \"user\", \"content\": \"${prompt}\" }\n  ]\n}",
      headers: "{}",
      responseTextPath: "choices.0.message.content",
      inputTokensPath: "usage.input_tokens",
      outputTokensPath: "usage.output_tokens",
      modelListPath: "data",
      modelIdPath: "id",
    };
  }

  return {
    name: provider.name,
    adapterKind: provider.adapterKind,
    baseUrl: provider.baseUrl,
    generationEndpoint: provider.generationEndpoint,
    modelEndpoint: provider.modelEndpoint ?? "",
    authType: provider.authType,
    authHeaderName: provider.authHeaderName ?? "",
    authScheme: provider.authScheme ?? "",
    credentialEnvVar: "",
    manualModels: provider.manualModels.join("\n"),
    enabled: provider.enabled,
    requestTemplate: provider.adapterKind === "CUSTOM_JSON"
      ? JSON.stringify(provider.adapterConfig.requestTemplate ?? {}, null, 2)
      : "{\n  \"model\": \"${model}\",\n  \"messages\": [\n    { \"role\": \"system\", \"content\": \"${system}\" },\n    { \"role\": \"user\", \"content\": \"${prompt}\" }\n  ]\n}",
    headers: provider.adapterKind === "CUSTOM_JSON"
      ? JSON.stringify(provider.adapterConfig.headers ?? {}, null, 2)
      : "{}",
    responseTextPath: customText(provider, "responseTextPath"),
    inputTokensPath: customText(provider, "inputTokensPath"),
    outputTokensPath: customText(provider, "outputTokensPath"),
    modelListPath: customText(provider, "modelListPath"),
    modelIdPath: customText(provider, "modelIdPath"),
  };
}

function initialDefaults(defaults: AiUseCaseSettingData[]): DefaultSelection {
  const byUseCase = new Map(defaults.map((item) => [item.useCase, item]));
  return Object.fromEntries(AI_USE_CASES.map((useCase) => {
    const item = byUseCase.get(useCase);
    return [useCase, { providerId: item?.providerId ?? "", model: item?.model ?? "" }];
  })) as DefaultSelection;
}

function uniqueModels(values: Array<string | undefined>) {
  return [...new Set(values.flatMap((value) => value?.split("\n") ?? []).map((value) => value.trim()).filter(Boolean))];
}

function providerModels(provider: AiProviderData) {
  return uniqueModels([...provider.manualModels, ...provider.cachedModels]);
}

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function upsertProvider(providers: AiProviderData[], provider: AiProviderData) {
  return [...providers.filter((item) => item.id !== provider.id), provider]
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function AiProviderWorkspace({ initialState }: { initialState: AiProviderStateData }) {
  const [state, setState] = useState(initialState);
  const [selectedId, setSelectedId] = useState<string | null>(initialState.providers[0]?.id ?? null);
  const [form, setForm] = useState(() => createProviderForm(initialState.providers[0]));
  const [defaults, setDefaults] = useState(() => initialDefaults(initialState.defaults));
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();

  const editing = state.providers.find((provider) => provider.id === selectedId) ?? null;
  const saving = isBusy("ai:save");
  const testing = selectedId ? isBusy(`ai:test:${selectedId}`) : false;
  const refreshing = selectedId ? isBusy(`ai:models:${selectedId}`) : false;
  const savingDefaults = isBusy("ai:defaults");
  const activeProviders = state.providers.filter((provider) => provider.enabled && provider.lastTestStatus === "SUCCESS");

  function editProvider(provider: AiProviderData | null) {
    setSelectedId(provider?.id ?? null);
    setForm(createProviderForm(provider));
  }

  function updateField<K extends keyof ProviderForm>(key: K, value: ProviderForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const adapterKind = String(data.get("adapterKind")) as ProviderForm["adapterKind"];
    const authType = String(data.get("authType")) as ProviderForm["authType"];
    const credentialValue = String(data.get("credentialEnvVar") ?? "").trim();
    const saved = await runAction("ai:save", async () => {
      let requestTemplate: unknown;
      let headers: unknown;
      if (adapterKind === "CUSTOM_JSON") {
        try {
          requestTemplate = JSON.parse(String(data.get("requestTemplate") ?? "{}"));
          headers = JSON.parse(String(data.get("headers") ?? "{}"));
        } catch {
          throw new Error("请求 JSON 模板或请求头格式无效");
        }
      }

      const payload: Record<string, unknown> = {
        name: data.get("name"),
        adapterKind,
        baseUrl: data.get("baseUrl"),
        generationEndpoint: data.get("generationEndpoint"),
        modelEndpoint: optionalText(data.get("modelEndpoint")),
        authType,
        authHeaderName: optionalText(data.get("authHeaderName")),
        authScheme: optionalText(data.get("authScheme")),
        enabled: data.get("enabled") === "on",
        manualModels: uniqueModels([String(data.get("manualModels") ?? "")]),
        adapterConfig: adapterKind === "CUSTOM_JSON" ? {
          headers,
          requestTemplate,
          responseTextPath: String(data.get("responseTextPath") ?? "").trim(),
          inputTokensPath: optionalText(data.get("inputTokensPath")),
          outputTokensPath: optionalText(data.get("outputTokensPath")),
          modelListPath: optionalText(data.get("modelListPath")),
          modelIdPath: optionalText(data.get("modelIdPath")),
        } : {},
      };
      if (authType === "NONE") payload.credentialEnvVar = null;
      else if (credentialValue || !editing) payload.credentialEnvVar = credentialValue;

      return adminRequest<AiProviderData>(
        editing ? `/api/admin/ai/providers/${editing.id}` : "/api/admin/ai/providers",
        jsonRequest(editing ? "PATCH" : "POST", payload),
      );
    }, editing ? "AI 提供方已保存" : "AI 提供方已创建");
    if (!saved) return;
    setState((current) => ({ ...current, providers: upsertProvider(current.providers, saved) }));
    if (!(saved.enabled && saved.lastTestStatus === "SUCCESS")) {
      setDefaults((current) => Object.fromEntries(AI_USE_CASES.map((useCase) => [
        useCase,
        current[useCase].providerId === saved.id ? { providerId: "", model: "" } : current[useCase],
      ])) as DefaultSelection);
    }
    setSelectedId(saved.id);
    setForm(createProviderForm(saved));
  }

  async function testProvider() {
    if (!editing) return;
    const result = await runAction(`ai:test:${editing.id}`, async () => {
      try {
        const tested = await adminRequest<AiProviderData>(
          `/api/admin/ai/providers/${editing.id}/test`,
          { method: "POST" },
        );
        const nextState = await adminRequest<AiProviderStateData>("/api/admin/ai/providers");
        return { tested, nextState };
      } catch (error) {
        try {
          setState(await adminRequest<AiProviderStateData>("/api/admin/ai/providers"));
        } catch {
          // Keep the original connection error visible even if the state refresh also fails.
        }
        throw error;
      }
    }, "连接测试通过");
    if (!result) return;
    setState(result.nextState);
    setForm(createProviderForm(result.tested));
  }

  async function refreshProviderModels() {
    if (!editing) return;
    const result = await runAction(`ai:models:${editing.id}`, () => adminRequest<{ models: string[] }>(
      `/api/admin/ai/providers/${editing.id}/models`,
      { method: "POST" },
    ), "模型列表已刷新");
    if (!result) return;
    setState((current) => ({
      ...current,
      providers: current.providers.map((provider) => provider.id === editing.id ? {
        ...provider,
        cachedModels: result.models,
        modelsRefreshedAt: new Date().toISOString(),
      } : provider),
    }));
  }

  async function saveDefaultUseCases(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await runAction("ai:defaults", () => adminRequest<AiUseCaseSettingData[]>(
      "/api/admin/ai/defaults",
      jsonRequest("PUT", {
        defaults: AI_USE_CASES.map((useCase) => ({
          useCase,
          providerId: defaults[useCase].providerId,
          model: defaults[useCase].model,
        })),
      }),
    ), "默认用例已保存");
    if (!saved) return;
    setState((current) => ({ ...current, defaults: saved }));
  }

  const models = editing ? providerModels(editing) : uniqueModels([form.manualModels]);

  return (
    <section>
      <PageHeader
        title="AI 配置"
        description="集中管理自定义 AI 服务；所有生成结果后续都先进入私有草稿。"
        action={(
          <button type="button" className={styles.primaryButton} onClick={() => editProvider(null)} disabled={saving || testing || refreshing}>
            <Plus size={17} />新建提供方
          </button>
        )}
      />

      <div className={styles.metrics}>
        <article><span>提供方</span><strong>{state.providers.length}</strong></article>
        <article><span>可调用</span><strong>{activeProviders.length}</strong></article>
        <article><span>默认用例</span><strong>{state.defaults.length} / {AI_USE_CASES.length}</strong></article>
        <article><span>请求日志</span><strong>{state.requestLogs.length}</strong></article>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>PROVIDERS</span><h2>提供方</h2></div>
          <Bot size={18} aria-hidden="true" />
        </div>
        {state.providers.length ? (
          <div>
            {state.providers.map((provider) => (
              <div key={provider.id} className={styles.listRow}>
                <strong>{provider.name}</strong>
                <span>{provider.adapterKind === "OPENAI_COMPATIBLE" ? "OpenAI Compatible" : provider.adapterKind === "ANTHROPIC_MESSAGES" ? "Anthropic Messages" : "Custom JSON"}</span>
                <small>{providerModels(provider).length} 个模型 · {formatDate(provider.lastTestedAt)}</small>
                <span className={provider.enabled ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>
                  {provider.enabled ? "已启用" : provider.lastTestStatus === "SUCCESS" ? "待启用" : provider.lastTestStatus === "FAILED" ? "测试失败" : "未测试"}
                </span>
                <div className={styles.rowActions}>
                  <button type="button" onClick={() => editProvider(provider)}>编辑</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="还没有 AI 提供方" description="先创建一个提供方，配置模型后执行连接测试。" action={null} />
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>{editing ? "EDIT" : "CREATE"}</span><h2>{editing ? "编辑提供方" : "新建提供方"}</h2></div>
          <span className={form.authType === "NONE" || editing?.credentialConfigured ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>
            {editing ? form.authType === "NONE" ? "无需密钥" : editing.credentialConfigured ? "密钥已配置" : "密钥未配置" : "待保存"}
          </span>
        </div>

        <form className={styles.entityForm} onSubmit={saveProvider}>
          <label><span>名称</span><input name="name" required maxLength={80} value={form.name} onChange={(event) => updateField("name", event.target.value)} /></label>
          <label><span>适配协议</span>
            <select name="adapterKind" value={form.adapterKind} onChange={(event) => updateField("adapterKind", event.target.value as ProviderForm["adapterKind"])}>
              {AI_ADAPTER_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </label>
          <label><span>基础 URL</span><input name="baseUrl" required value={form.baseUrl} onChange={(event) => updateField("baseUrl", event.target.value)} /></label>
          <label><span>生成端点</span><input name="generationEndpoint" required value={form.generationEndpoint} onChange={(event) => updateField("generationEndpoint", event.target.value)} /></label>
          <label><span>模型列表端点</span><input name="modelEndpoint" value={form.modelEndpoint} onChange={(event) => updateField("modelEndpoint", event.target.value)} /></label>
          <label><span>认证方式</span>
            <select name="authType" value={form.authType} onChange={(event) => updateField("authType", event.target.value as ProviderForm["authType"])}>
              {AI_AUTH_TYPES.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </label>
          <label><span>自定义认证头</span><input name="authHeaderName" value={form.authHeaderName} onChange={(event) => updateField("authHeaderName", event.target.value)} /></label>
          <label><span>认证前缀</span><input name="authScheme" value={form.authScheme} onChange={(event) => updateField("authScheme", event.target.value)} /></label>
          <label>
            <span>密钥环境变量</span>
            <input name="credentialEnvVar" value={form.credentialEnvVar} onChange={(event) => updateField("credentialEnvVar", event.target.value)} placeholder={editing?.credentialConfigured ? "留空保留当前环境变量" : "OPENAI_API_KEY"} />
          </label>
          <label><span>手工模型（每行一个）</span><textarea name="manualModels" rows={4} value={form.manualModels} onChange={(event) => updateField("manualModels", event.target.value)} /></label>
          <label className={styles.editorLabel}>
            <input type="checkbox" name="enabled" checked={form.enabled} onChange={(event) => updateField("enabled", event.target.checked)} disabled={Boolean(editing && editing.lastTestStatus !== "SUCCESS")} />
            <span><strong>启用提供方</strong><small>连接测试通过后才能启用；修改连接信息会重新进入待测试状态。</small></span>
          </label>

          {form.adapterKind === "CUSTOM_JSON" ? (
            <>
              <label><span>附加请求头 JSON</span><textarea name="headers" required rows={5} value={form.headers} onChange={(event) => updateField("headers", event.target.value)} /></label>
              <label><span>请求 JSON 模板</span><textarea name="requestTemplate" required rows={10} value={form.requestTemplate} onChange={(event) => updateField("requestTemplate", event.target.value)} /></label>
              <label><span>响应文本路径</span><input name="responseTextPath" required value={form.responseTextPath} onChange={(event) => updateField("responseTextPath", event.target.value)} /></label>
              <label><span>输入 Token 路径</span><input name="inputTokensPath" value={form.inputTokensPath} onChange={(event) => updateField("inputTokensPath", event.target.value)} /></label>
              <label><span>输出 Token 路径</span><input name="outputTokensPath" value={form.outputTokensPath} onChange={(event) => updateField("outputTokensPath", event.target.value)} /></label>
              <label><span>模型列表路径</span><input name="modelListPath" value={form.modelListPath} onChange={(event) => updateField("modelListPath", event.target.value)} /></label>
              <label><span>模型 ID 路径</span><input name="modelIdPath" value={form.modelIdPath} onChange={(event) => updateField("modelIdPath", event.target.value)} /></label>
            </>
          ) : (
            <input type="hidden" name="requestTemplate" value={form.requestTemplate} />
          )}

          <div className={styles.entityFormActions}>
            <button type="button" onClick={() => editProvider(editing)} disabled={saving || !editing}>重置</button>
            <button className={styles.primaryButton} disabled={saving || testing || refreshing}>
              {saving ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}
              {saving ? "保存中" : "保存提供方"}
            </button>
          </div>
        </form>

        <div className={styles.rowActions}>
          <button type="button" onClick={testProvider} disabled={!editing || testing || saving || models.length === 0}>
            {testing ? <LoaderCircle className={styles.spin} size={16} /> : <PlugZap size={16} />}
            {testing ? "测试中" : "测试连接"}
          </button>
          <button type="button" onClick={refreshProviderModels} disabled={!editing || refreshing || saving}>
            {refreshing ? <LoaderCircle className={styles.spin} size={16} /> : <RefreshCw size={16} />}
            {refreshing ? "刷新中" : "刷新模型"}
          </button>
        </div>
        {editing ? (
          <p className={styles.mutedCopy}>
            可用模型 {models.length} 个；手工模型与上游缓存会合并去重。缓存更新于 {formatDate(editing.modelsRefreshedAt)}。
          </p>
        ) : null}
        <p className={styles.mutedCopy}><KeyRound size={14} aria-hidden="true" /> 密钥只填写服务器环境变量名，系统不会读取或返回密钥值。</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>DEFAULTS</span><h2>默认用例</h2></div>
          <span>{activeProviders.length} 个可调用提供方</span>
        </div>
        <form className={styles.entityForm} onSubmit={saveDefaultUseCases}>
          {AI_USE_CASES.map((useCase) => {
            const selectedProvider = activeProviders.find((provider) => provider.id === defaults[useCase].providerId);
            const availableModels = selectedProvider ? providerModels(selectedProvider) : [];
            return (
              <div key={useCase} className={styles.compactField}>
                <label><span>{USE_CASE_LABELS[useCase]}</span>
                  <select
                    name={`defaultProvider.${useCase}`}
                    required
                    value={defaults[useCase].providerId}
                    onChange={(event) => setDefaults((current) => ({
                      ...current,
                      [useCase]: { providerId: event.target.value, model: "" },
                    }))}
                  >
                    <option value="">选择提供方</option>
                    {activeProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                  </select>
                </label>
                <label><span>模型</span>
                  <select
                    name={`defaultModel.${useCase}`}
                    required
                    value={defaults[useCase].model}
                    onChange={(event) => setDefaults((current) => ({
                      ...current,
                      [useCase]: { ...current[useCase], model: event.target.value },
                    }))}
                  >
                    <option value="">选择模型</option>
                    {availableModels.map((model) => <option key={model} value={model}>{model}</option>)}
                  </select>
                </label>
              </div>
            );
          })}
          <div className={styles.entityFormActions}>
            <button className={styles.primaryButton} disabled={savingDefaults || activeProviders.length === 0}>
              {savingDefaults ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}
              {savingDefaults ? "保存中" : "保存默认用例"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>AUDIT</span><h2>请求日志</h2></div>
          <ScrollText size={18} aria-hidden="true" />
        </div>
        {state.requestLogs.length ? (
          <div>
            {state.requestLogs.map((log) => {
              const provider = state.providers.find((item) => item.id === log.providerId);
              return (
                <div key={log.id} className={styles.listRow}>
                  <strong>{provider?.name ?? "未知提供方"}</strong>
                  <span>{log.useCase}</span>
                  <small>{log.model} · {log.latencyMs} ms · {log.inputTokens ?? "-"} / {log.outputTokens ?? "-"} Token</small>
                  <span className={log.outcome === "SUCCESS" ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>
                    {log.outcome === "SUCCESS" ? "成功" : "失败"}
                  </span>
                  <time dateTime={log.createdAt}>{formatDate(log.createdAt)}</time>
                </div>
              );
            })}
          </div>
        ) : <p className={styles.mutedCopy}>执行连接测试或生成草稿后，这里会显示最近的请求元数据。</p>}
        <p className={styles.mutedCopy}>日志仅记录模型、耗时、Token 与结果，不会保存提示词、生成内容、请求头或原始响应。</p>
      </section>

      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
