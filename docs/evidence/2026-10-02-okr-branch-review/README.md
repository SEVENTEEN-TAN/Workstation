# OKR 父子工作区分支差异审查

日期：2026-10-02。候选提交 `e1e1bcb805bbd9bd94846ccea6fe9f42f4d0556a`；比较基线 `f0723cfca51e9c287c61a7f4cdf92be3940a5822`。本轮实时查询远端 `main`，仍为该基线。

## 范围和结论

主代理逐项阅读五个工作区文件的完整分支差异：`OkrCycleListWorkspace.tsx`、`OkrCycleWorkspace.tsx`、`ObjectiveWorkspace.tsx`、`ActionItemList.tsx`、`OkrEntityDialog.tsx`。继续追踪公开条件、公开读取、重复行动服务、输入校验、迁移、仪表盘链接以及相关页面/API。关联文件摘要见 [source-manifest.json](source-manifest.json)。摘要用于定位审查版本，不表示其中每个未改文件的全部代码都已审查。

在上述差异范围未确认新增的阻断性缺陷。本轮补齐此前清单中“OKR 父子工作区完整差异审查”的静态部分；不是整个功能分支审查完成，也不是新的浏览器或服务器验收。没有修改业务源码、迁移或数据库。

## 实际核查

| 链路 | 核查结果 |
| --- | --- |
| 周期 → 目标 | 列表、详情和目标页仍使用实际记录 ID；目标详情将 `cycleId` 传入服务，所属周期不匹配时返回不存在。页面继续经过既有后台布局会话检查；所读 OKR 写入 API 均经过 `withAdminSession`。这是源码结论，没有新增真实鉴权请求。 |
| 公开条件 | 周期、目标、KR、复盘提示与 `public-data.ts` 使用同一组函数；未翻译的 KR 会阻断所属目标，而非只隐藏提示；说明允许双语同时缺省，但拒绝单边说明。周期计数现在统计满足展示条件的周期，没有把“设为公开”直接标为发布。 |
| 复盘 | 周期及复盘各自的可见性、四项英文证据仍沿用既有公开读取规则；没有新增“所属目标公开才可公开复盘”的规则。创建及更新服务仍校验目标属于选定周期。后台提示与当前前台读取一致，不将独立复盘的旧语义误认成分支回归。 |
| 深链接 | 行动项和 KR 的新 DOM ID 与仪表盘生成的 fragment 一致；父级已结束或取消时，队列装配跳过相应行动/KR。复用此前真实浏览器定位证据，不把本次源码阅读当成再次点击验收。 |
| 重复行动 | 前端周重复提交所选星期，其余模式显式提交 null；状态单字段 PATCH 的 omitted 星期保持 undefined。服务在事务内读取、归一化及认领源项，完成源项与插入后继一起提交或回滚；重开/删除后继不清除源项生成标记，删除来源外键置空且来源唯一索引保留。 |
| 日期与进度 | 重复日期函数从上海日历取日期、保持既有 UTC 零点存储格式；无截止日期使用同一次完成时间。每周同周剩余日期和下个间隔周沿用既有规则。行动项更新链没有写 KR 数值或进度历史。 |
| 对话框 | 本分支仅增加根元素滚动锁及关闭/卸载恢复原 overflow；`showModal`、Escape、关闭按钮和 children 生命周期沿用既有实现。五个工作区的结构与新增提示不会改变表单提交目标。 |

## 当前定向检查

以候选源码执行以下现有测试，7 文件 / 141 项通过，退出码 0。完整输出见 [verification-vitest.log](verification-vitest.log)。

```powershell
node node_modules/vitest/vitest.mjs run tests/okr-public-readiness.test.ts tests/okr-action-items.test.ts tests/okr-recurrence.test.ts tests/okr-validation.test.ts tests/okr-execution.test.ts tests/overview-queue.test.ts tests/admin-ui-contracts.test.ts
```

- 公开条件 6 项包含实际公开服务筛选与提示呈现；行动项 13 项包含星期保留、跨上海午夜完成时间、删除/重开幂等和失败回滚。
- 日期 6 项、执行状态 6 项、输入 PATCH 2 项、仪表盘队列 13 项覆盖相关逻辑。
- UI 合约 95 项主要是源码约束；不能据此证明实际交互、焦点或布局。浏览器结果仍引用既有 [阶段 3B](../2026-09-23-stage-3b/README.md)、[重复行动工作区](../2026-09-30-recurrence-workspace/README.md) 和 [真实数据库边界](../2026-09-30-recurrence-boundaries/README.md)。
- 差异检查排除原始测试 `.log` 的工具输出结尾空行，保留输出原文；Markdown 和 JSON 均执行标准差异检查。

## 保留的边界

- 普通 OKR 旧表单和 check-in 的全部请求交错、真实输入法、多实例持续压力及所有日期组合没有在本轮重新验收；不增加或改写它们的既有行为。
- 迁移的生产适用性、旧版本回滚兼容性及服务器状态仍待实际预检。
- 本轮是主代理审查，不称独立审查通过。其他模块的整分支审查仍须继续。
- 计划仍为 23/30；C1–C5 待确认，F2/F4 保持未勾选。合并、部署和线上验收未执行。
