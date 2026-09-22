# 数据可靠性阶段 1A 执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. 按阶段实施和集中测试，不在每个小改动之后运行测试。

**Goal:** 阻止三类草稿生成不合法的职业动态，并让后台 OKR 显示与前台过滤规则一致的公开条件说明。

**Architecture:** 复用职业动态现有校验器；服务入口及转换事务内都校验，事务内以重新读取的草稿构造动态。将 OKR 公开判断提取为无数据库依赖的共享函数，前台过滤和后台说明调用同一实现。

**Tech Stack:** Next.js 16、React 19、Prisma 6、SQLite、Zod 4、Vitest 4；不新增依赖。

**Spec:** `docs/2026-09-22-functional-optimization-todo.md` A1、A4；`docs/2026-09-22-functional-plan-review.md` 执行边界；主项目保留原始详细审查，功能分支保存完整编号清单及审查摘要。

## Global Constraints

- 当前分支 `feat/homepage-visual-editor`，起点 `926790e`；保留已有首页和弹窗修复。
- 当前目标授权分阶段开发、测试、推送功能分支；不合并 main，不部署，不修复现有生产数据。
- 草稿保留 4000 字编辑能力；动态标题 120 字、摘要 1000 字；不静默截断。
- 转换保持 PRIVATE、非精选；动态创建与草稿状态更新在同一事务中。
- 公开过滤政策保持不变，包括可选说明必须中英文成对、复盘四项英文齐全。
- 此批 A4 仅覆盖 OKR；能力证据等其他模块的公开原因说明仍未完成。
- 用户要求优先：按完整阶段编写回归用例、实施，再集中回归；不逐字段测试。

## Review Focus

1. 超长英文摘要同样会损坏动态列表：三种转换分别覆盖中英文 1000/1001/4000 字。
2. 初次读取合法、事务重读超长：拒绝创建，保留草稿。
3. 事务重读时已转换：拒绝重复创建；创建失败不能更新状态。
4. 周期私密或缺英文时，子目标自身完整也不能宣称满足公开条件。
5. 可选说明只写英文与只写中文都不完整；全部留空允许公开；KR 缺项说明精确到标题。

## 文件与接口

- 修改 `src/lib/validators/career-activities.ts`：沿用 `careerActivityInputSchema.parse(input)`，补充字段限长中文提示。
- 修改 `src/lib/services/{weekly-activity-drafts,okr-milestone-drafts,career-timeline-drafts}.ts`：保留 `convert(id)` 和 `convertDraft(id, activity)` 接口，转换前及事务内调用目标校验器，事务内覆盖为最新草稿字段。
- 新建 `src/lib/okr/public-readiness.ts`：`getCyclePublicIssues(cycle): string[]`、`getKeyResultPublicIssues(keyResult): string[]`、`getObjectivePublicIssues(objective, cycle): string[]`、`getReviewPublicIssues(review, cycle): string[]`。
- 修改 `src/lib/services/public-data.ts`：以共享函数返回空数组作为公开条件，保持排序和输出字段不变。
- 新建 `src/components/admin/okr/PublicReadiness.tsx`：只展示缺项或“满足前台展示条件”，不宣称线上已发布。
- 修改 OKR 三个工作区与后台样式：周期计数按实际条件统计；周期、目标、复盘和 KR 展示原因；保留已有编辑入口。
- 新建 `tests/draft-conversion-validation.test.ts`、`tests/draft-conversion-transaction.test.ts`、`tests/okr-public-readiness.test.ts`，复用现有服务测试进行回归；事务用例仅操作自动创建的临时 SQLite 数据库。

## 阶段步骤

- [x] 编写整批回归用例，明确无效数据拒绝且不调用写入、事务重读保护及公开原因与过滤结果一致。
- [x] 集中运行该批用例一次，记录现状失败，不使用源码字符串断言代替行为验证。
- [x] 完成三类转换校验与 OKR 共享规则、后台展示的整批改动。
- [x] 集中执行新用例、三个草稿服务、公开数据相关用例，再执行完整测试、类型与 lint 检查。
- [x] 审查 diff 与回归结果；无未处理的 Critical／Important 自查问题；浏览器验收尚未完成，不勾选 F2 或 D2。
- [x] 记录具体结果、提交 scoped files，推送 `feat/homepage-visual-editor` 并核对远端提交；不推送 main。

关键断言示例（测试中使用真实服务，仓库仅作为外部边界）：

```ts
await expect(service.convert("draft-1")).rejects.toThrow("中文摘要不能超过 1000 字");
expect(repo.convertDraft).not.toHaveBeenCalled();
expect(getObjectivePublicIssues(objective, { visibility: "PRIVATE", nameEn: "Q3" }))
  .toContain("所属周期：当前设为私密");
```

集中验证入口：

```powershell
.\node_modules\.bin\vitest.cmd run tests/draft-conversion-validation.test.ts tests/okr-public-readiness.test.ts tests/weekly-activity-drafts.test.ts tests/okr-milestone-drafts.test.ts tests/career-timeline-drafts.test.ts tests/public-data.test.ts
npm test
.\node_modules\.bin\tsc.cmd --noEmit
npm run lint
```

## 后续阶段映射（不是新增范围授权）

| 批次 | TODO | 内容 |
| --- | --- | --- |
| 1A | A1、A4 的 OKR 部分 | 本计划 |
| 1B | A2、A3、A4 剩余 | 周报候选采纳、未保存输入保护、其他模块公开原因 |
| 2 | B1–B9 | 真实预览、数据归属、协议生命周期、原位文字／链接／图片、三栏与设备切换、保存发布和备用表单；先修订 R2–R6 |
| 3 | D1–D5、E2、E3 | 重复行动、已有弹窗验收、知识与简历入口、项目同步、转换后定位和展示去向 |
| 4 | E1 | 准确统计、可直达处理的仪表盘 |
| 待确认 | C1–C5 | 撤销、区块编排、模板及新增选择能力；确认前不实施 |
| 每阶段 | F1–F4 | 回归、浏览器验收、交付状态分层；上线需另行确认 |

## 进度证据

- 2026-09-22：确认主项目仅有两份未跟踪范围文档，功能工作树干净；两份文档已保存，不改写历史计划。
- 独立检索尝试均未收到可执行任务正文，未产生有效审查或代码；本阶段由主代理接手，不声称独立复审通过。
- 2026-09-22：红灯验证为 27 项行为失败及 1 个缺失模块；完成实现后，针对性回归 71／71 通过，真实临时 SQLite 事务用例 9／9 通过。
- 2026-09-22：最终整库测试 71 个文件、452 项全部通过；TypeScript 检查与 ESLint 均以退出码 0 完成。未进行浏览器或线上验收。
- 2026-09-22：阶段 1A 已提交并推送到 `feat/homepage-visual-editor`，远端核对提交为 `bbd0d13`；未合并、未部署。
