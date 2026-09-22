# 周报草稿安全阶段 1B 执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. 按整批编写测试、整批实现、整批验证，不在每个小改动后运行测试。

**Goal:** 重复生成不覆盖人工周报，AI 基于当前输入只返回候选，用户明确采用后再保存；切换、刷新、离开和并发保存不静默丢失内容。

**Architecture:** 保留现有周报表与路由，不新增数据库模型。服务端以 `updatedAt` 做乐观并发校验；生成同一周时返回原草稿而不写入；AI 接口接收当前表单快照并只返回候选。客户端改为受控编辑态，以 sessionStorage 作当前浏览器恢复副本，并对切换、关闭和页面离开给出提示。

**Tech Stack:** Next.js 16、React 19、Prisma 6、Zod 4、Vitest 4；不新增依赖。

**Spec:** `docs/2026-09-22-functional-optimization-todo.md` A2、A3；`docs/2026-09-22-functional-plan-review.md` 数据安全边界。

## Global Constraints

- 只保护每周动态工作区，不把 A3 扩张为所有后台表单。
- AI 使用用户当前输入作为来源，即使该输入尚未保存；候选生成不更新数据库。
- 用户采用候选只更新本地表单，仍需点击“保存草稿”才持久化。
- AI 请求期间继续输入时，旧候选不得覆盖新输入；需重新生成或回到原快照。
- 生成同一周直接打开已有草稿并说明未覆盖；已转换周报仍拒绝重新生成。
- 保存使用原记录的 `updatedAt`；其他标签页已保存时返回 409，当前输入和浏览器恢复副本保留。
- sessionStorage 只保存四个编辑字段、草稿 ID 对应键和原始 `updatedAt` 并发版本，不保存来源快照、凭据或 AI 配置。
- 浏览器原生离开提示由浏览器决定文案；页面内切换另行明确提示。

## Interfaces

- `generate(input): Promise<{ created: boolean; draft: WeeklyActivityDraftData }>`：已有 DRAFT 返回 `created: false` 且不查询来源、不 upsert。
- `update(id, { expectedUpdatedAt, titleZh, titleEn, summaryZh, summaryEn })`：事务内重读并比较版本；冲突返回 409。
- `rewriteWithAi(id, { expectedUpdatedAt, ...currentCopy }): Promise<WeeklyAiRewriteCandidate>`：返回 `{ baseUpdatedAt, source, candidate }`，不调用 `updateDraft`。
- `WeeklyActivityWorkspace`：受控 `editing` 状态；AI 比较区、采用按钮、候选过期提示、sessionStorage 恢复及离开保护。

## Review Focus

1. 同一周已有人工修改时，再生成不调用来源聚合或写入。
2. AI prompt 使用当前未保存输入；响应只形成候选，不更新列表或数据库。
3. AI 请求期间继续输入，采用按钮失效，不能覆盖后续编辑。
4. 两个标签页以同一版本保存，第二次返回冲突且第一份内容保留。
5. 保存、取消、切换、刷新和站内链接离开分别处理；保存成功清除恢复副本。
6. 候选请求失败、保存冲突和网络失败均不清空当前输入。

## 阶段步骤

- [x] 增补服务与真实 SQLite 回归：重复生成、候选不落库、当前输入 prompt、版本冲突。
- [x] 完成服务接口、路由请求体和 409 冲突保护。
- [x] 完成受控编辑器、候选对照与采用、浏览器恢复副本和离开提示。
- [x] 集中运行相关用例并修正，再运行整库测试、TypeScript、ESLint。
- [ ] 浏览器验收：已验证恢复副本实存、重复生成不覆盖、AI 未配置失败不清空输入；原生刷新确认、已配置 AI 候选采用及多标签页冲突提示仍待人工验收，保留在 F2。
- [ ] 审查 diff，提交阶段文件，推送 `feat/homepage-visual-editor` 并核对远端 SHA；不合并、不部署。

## 进度证据

- 2026-09-22：阶段起点为已推送提交 `bbd0d13`；工作树干净。
- 2026-09-22：重复生成复用现有草稿；AI 使用当前未保存输入且只返回候选；受控编辑、sessionStorage 恢复、离开保护和 `updatedAt` 乐观并发保护已实现。
- 2026-09-22：整库测试首次仅既有全仓扫描用例在并行负载下超过 5 秒；该用例单独以 188ms 通过，随后整库 72 个文件、458／458 项通过。TypeScript 与 ESLint 均退出码 0。
- 2026-09-22：浏览器确认恢复副本写入 sessionStorage、重复生成提示人工内容未覆盖、AI 未配置失败后当前输入仍在；未声称原生 `beforeunload`、已配置 AI 成功候选或多标签页冲突已完成浏览器验收。
- 2026-09-22：最终复核补出“旧恢复副本在另一标签页保存后刷新”场景；恢复副本现携带原始 `updatedAt`，避免刷新后错误绑定到服务器新版本而绕过 409。
- diff 审查、提交与推送证据待完成后追加。
