import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";
const temporary: string[] = [];
const posix = (value: string) => value.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);

afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function harness(failure = "", legacy = true, managed = false) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "workstation-deploy-test-"));
  temporary.push(directory);
  const repository = path.join(directory, "repo");
  const config = path.join(directory, "config");
  const data = path.join(directory, "data");
  const mocks = path.join(directory, "bin");
  for (const folder of [repository, config, data, mocks, path.join(repository, "deploy")]) mkdirSync(folder, { recursive: true });
  for (const file of ["Dockerfile", "compose.yaml", "deploy/update.sh", "deploy/container.env.example"]) {
    writeFileSync(path.join(repository, file), readFileSync(path.join(root, file)));
  }
  const git = (...args: string[]) => {
    const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  git("init", "--initial-branch=main");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Deployment test");
  git("add", ".");
  git("commit", "-m", "fixture");
  git("remote", "add", "origin", repository);
  writeFileSync(path.join(repository, "uncommitted.txt"), "preserve me");
  writeFileSync(path.join(config, ".env"), `WORKSTATION_DATA_DIR=${posix(data)}\nWORKSTATION_PORT=3001\nSECRET_TEST=preserve-me\n`);
  if (legacy || managed) writeFileSync(path.join(data, "workstation.db"), "mock existing database");
  if (managed) writeFileSync(path.join(config, "current-image"), `workstation-local:${"a".repeat(40)}\n`);
  writeFileSync(path.join(mocks, "docker"), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$MOCK_LOG"
case "$1" in
  info|start|stop) exit 0 ;;
  inspect) printf '%s\\n' "$MOCK_DATA"; exit 0 ;;
  build) [[ "$MOCK_FAIL" != build ]]; exit $? ;;
  run) exit 0 ;;
  compose)
    if [[ " $* " == *" ps "* ]]; then [[ "$MOCK_MANAGED" != 1 ]] || echo managed-app; exit 0; fi
    if [[ " $* " == *" db:backup"* ]]; then
      [[ "$MOCK_FAIL" != backup ]] || exit 1
      mkdir -p "$MOCK_DATA/backups/test-backup"
      echo '{}' > "$MOCK_DATA/backups/test-backup/manifest.json"
      echo /data/backups/test-backup
    elif [[ " $* " == *" prisma migrate deploy"* ]]; then
      [[ "$MOCK_FAIL" != migrate ]] || exit 1
    elif [[ " $* " == *" up "* ]]; then
      [[ "$MOCK_FAIL" != health ]] || exit 1
    fi
    exit 0 ;;
esac
exit 1
`, { mode: 0o755 });
  const log = path.join(directory, "docker.log");
  const result = spawnSync(bash, ["-c", 'export PATH="$MOCK_BIN:$PATH"; bash "$MOCK_SCRIPT" ${MOCK_LEGACY:+--legacy-container Workstation}'], {
    cwd: repository,
    encoding: "utf8",
    timeout: 30_000,
    env: {
      ...process.env,
      WORKSTATION_DEPLOY_DIR: posix(config),
      MOCK_BIN: posix(mocks),
      MOCK_SCRIPT: posix(path.join(repository, "deploy/update.sh")),
      MOCK_LOG: posix(log),
      MOCK_DATA: posix(data),
      MOCK_LEGACY: legacy ? "1" : "",
      MOCK_MANAGED: managed ? "1" : "",
      MOCK_FAIL: failure,
    },
  });
  return { result, repository, config, log: readFileSync(log, "utf8"), git };
}

describe.skipIf(!existsSync(bash))("container deployment failure paths", () => {
  it("builds before stopping, backs up before migration, and preserves local files and secrets", () => {
    const { result, repository, config, log, git } = harness();
    expect(result.status, result.stderr).toBe(0);
    expect(log.indexOf("build --label")).toBeLessThan(log.indexOf("stop Workstation"));
    expect(log.indexOf("db:backup")).toBeLessThan(log.indexOf("run --rm --no-deps app npx prisma migrate deploy"));
    expect(readFileSync(path.join(repository, "uncommitted.txt"), "utf8")).toBe("preserve me");
    expect(readFileSync(path.join(config, ".env"), "utf8")).toContain("SECRET_TEST=preserve-me");
    expect(readFileSync(path.join(config, "current-image"), "utf8")).toBe(`workstation-local:${git("rev-parse", "HEAD")}\n`);
    expect(git("branch", "--show-current")).toBe("main");
    expect(existsSync(path.join(config, "update.lock"))).toBe(false);
  }, 15_000);

  it("does not stop an application when image build fails", () => {
    const { result, log } = harness("build");
    expect(result.status).not.toBe(0);
    expect(log).not.toContain("stop Workstation");
    expect(log).not.toContain("db:backup");
  });

  it("restarts the legacy application when backup fails before migration", () => {
    const { result, log } = harness("backup");
    expect(result.status).not.toBe(0);
    expect(log).toContain("start Workstation");
    expect(log).not.toContain("run --rm --no-deps app npx prisma migrate deploy");
  });

  it.each(["migrate", "health"])("keeps the app stopped after %s failure and retains the old image", (failure) => {
    const { result, config, log } = harness(failure, false, true);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("service remains stopped");
    expect(log).not.toContain("db:restore");
    expect(readFileSync(path.join(config, "current-image"), "utf8")).toBe(`workstation-local:${"a".repeat(40)}\n`);
    expect(readFileSync(path.join(config, "last-update"), "utf8")).toContain("backup=/data/backups/test-backup");
  });

  it("initializes an empty deployment without backing up a nonexistent database", () => {
    const { result, log } = harness("", false);
    expect(result.status, result.stderr).toBe(0);
    expect(log).not.toContain("db:backup");
    expect(log).toContain("run --rm --no-deps app npx prisma migrate deploy");
  });
});
