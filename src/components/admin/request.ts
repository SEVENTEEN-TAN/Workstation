import { sanitizeAdminReturnPath } from "./navigation";

export interface AdminRequestIssue {
  path: Array<string | number>;
  message: string;
  code?: string;
}

export class AdminRequestError extends Error {
  readonly status: number;
  readonly issues: AdminRequestIssue[];

  constructor(message: string, status: number, issues: AdminRequestIssue[] = [], options?: ErrorOptions) {
    super(message, options);
    this.name = "AdminRequestError";
    this.status = status;
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readIssues(payload: unknown): AdminRequestIssue[] {
  if (!isRecord(payload) || !Array.isArray(payload.issues)) return [];

  return payload.issues.flatMap((issue) => {
    if (!isRecord(issue) || !Array.isArray(issue.path) || typeof issue.message !== "string") return [];
    const path = issue.path.filter((part): part is string | number => (
      typeof part === "string" || typeof part === "number"
    ));

    return [{
      path,
      message: issue.message,
      ...(typeof issue.code === "string" ? { code: issue.code } : {}),
    }];
  });
}

function readErrorMessage(payload: unknown, issues: AdminRequestIssue[]): string {
  if (issues[0]?.message) return issues[0].message;
  if (isRecord(payload) && typeof payload.error === "string" && payload.error !== "VALIDATION_ERROR") {
    return payload.error;
  }
  return "请求失败，请稍后重试";
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

export async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, init);
  } catch (cause) {
    throw new AdminRequestError("网络请求失败，请稍后重试", 0, [], { cause });
  }

  const payload = await readJson(response);
  if (response.ok) return payload as T;

  const issues = readIssues(payload);
  const error = new AdminRequestError(readErrorMessage(payload, issues), response.status, issues);

  if (response.status === 401 && typeof window !== "undefined") {
    const currentPath = sanitizeAdminReturnPath(`${window.location.pathname}${window.location.search}`);
    window.location.replace(`/admin/login?next=${encodeURIComponent(currentPath)}`);
  }

  throw error;
}
