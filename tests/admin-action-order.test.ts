import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  states: [] as { value: unknown }[],
  cleanups: [] as (() => void)[],
}));

// Exercise the hook's async scheduling without a DOM. Real rendering and alert
// lifetimes are separately exercised by the isolated Edge evidence runner.
vi.mock("react", () => ({
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => (() => void) | void) => {
    const cleanup = effect();
    if (cleanup) harness.cleanups.push(cleanup);
  },
  useState: (initial: unknown) => {
    const state = { value: typeof initial === "function" ? initial() : initial };
    harness.states.push(state);
    return [state.value, (next: unknown) => {
      state.value = typeof next === "function" ? next(state.value) : next;
    }];
  },
}));

import { useAdminAction } from "../src/components/admin/useAdminAction";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const feedback = () => harness.states[1].value;
const busy = () => harness.states[0].value as ReadonlySet<string>;

beforeEach(() => { harness.states.length = 0; harness.cleanups.length = 0; vi.useFakeTimers(); });
afterEach(() => { harness.cleanups.forEach((cleanup) => cleanup()); vi.useRealTimers(); });

describe("admin action feedback ordering", () => {
  it("keeps a newer error after an older success, while returning the older result", async () => {
    const action = useAdminAction(), old = deferred<string>();
    const pending = action.runAction("scan", () => old.promise, "扫描完成");
    await action.runAction("publish", async () => { throw new Error("发布失败"); });
    old.resolve("scanned data");
    expect(await pending).toBe("scanned data");
    expect(feedback()).toMatchObject({ role: "alert", message: "发布失败" });
    vi.advanceTimersByTime(5000);
    expect(feedback()).toMatchObject({ message: "发布失败" });
    expect(busy().size).toBe(0);
  });

  it("does not schedule an old success timer while a newer request is pending", async () => {
    const action = useAdminAction(), old = deferred<string>(), newer = deferred<string>();
    const first = action.runAction("scan", () => old.promise, "扫描完成");
    const second = action.runAction("publish", () => newer.promise, "发布完成");
    old.resolve("scan"); await first;
    expect(feedback()).toBeNull();
    expect(busy().has("publish")).toBe(true);
    newer.reject(new Error("发布失败")); await second;
    vi.advanceTimersByTime(5000);
    expect(feedback()).toMatchObject({ role: "alert", message: "发布失败" });
  });

  it("keeps newer success feedback when an older request fails", async () => {
    const action = useAdminAction(), old = deferred<string>();
    const first = action.runAction("scan", () => old.promise, "扫描完成");
    await action.runAction("review", async () => "reviewed", "已确认变更");
    old.reject(new Error("扫描失败")); expect(await first).toBeUndefined();
    expect(feedback()).toMatchObject({ role: "status", message: "已确认变更" });
    vi.advanceTimersByTime(3999); expect(feedback()).not.toBeNull();
    vi.advanceTimersByTime(1); expect(feedback()).toBeNull();
  });

  it("cancels an existing success timer before a newer failure", async () => {
    const action = useAdminAction();
    await action.runAction("scan", async () => "scan", "扫描完成");
    vi.advanceTimersByTime(3000);
    await action.runAction("publish", async () => { throw new Error("发布失败"); });
    vi.advanceTimersByTime(5000);
    expect(feedback()).toMatchObject({ role: "alert", message: "发布失败" });
  });

  it("keeps duplicate keys deduplicated without invalidating accepted feedback", async () => {
    const action = useAdminAction(), work = deferred<string>(), duplicate = vi.fn();
    const first = action.runAction("publish", () => work.promise, "已发布");
    expect(await action.runAction("publish", duplicate)).toBeUndefined();
    expect(duplicate).not.toHaveBeenCalled();
    work.resolve("article"); expect(await first).toBe("article");
    expect(feedback()).toMatchObject({ message: "已发布" });
    expect(busy().size).toBe(0);
  });
});
