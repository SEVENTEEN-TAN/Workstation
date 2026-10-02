# 原位预览未回传输入的原生卸载保护

日期：2026-10-02。基线`50237324c221b9994ff1e218c4f1218d2ae8884a`。唯一业务源码为`src/components/public/HomeVisualEditor.tsx`，新增`tests/home-preview-unload.test.ts`。

## 根因与修复

首页iframe在失焦或保存flush时回传文字。在干净草稿中修改并保持焦点，父级仍认为已保存，没有父级beforeunload保护。真实Edge [RED](red-results.json)中刷新没有弹窗，`UNCOMMITTED FOCUSED TEXT`回到`JAVA + AI`。

预览现对input、纯文本粘贴和compositionstart标记未回传输入，在自身beforeunload中触发浏览器原生确认；有效commit回传后清理标记，组合输入尚未完成或提交被拒绝时保留保护。保留原focusout/flush协议，未增加逐键React重绘、依赖、持久化或自动保存。

## 最终验证

| 验证 | 结果 |
| --- | --- |
| [组件RED](component-red.log) | 原组件3失败/2通过，均为输入/组合输入卸载保护缺失 |
| [组件GREEN](component-green.log) | 新5项与既有12项共2文件17项通过 |
| [真实Edge GREEN](green-results.json) | 5/5：未回传文字取消刷新后保留；保存后刷新无多余弹窗；组合输入取消刷新；干净焦点刷新；关闭标签取消后保留 |
| [全量](vitest.log) | 86文件/586项通过 |
| 静态检查 | ESLint与TypeScript退出0；最终runner修正后定向ESLint退出0 |
| [生产构建](build.log) | 前批独立已迁移SQLite构建退出0，56页，Build ID `4IZRneWEjp-FKFncjaSjs` |
| [独立复审](../2026-10-02-whole-branch-review/review.md) | 原Important关闭，无新增Critical/Important；二维码alt定位Minor保留 |

组件测试使用模拟hooks/document运行真实组件effect；浏览器使用真实Windows Edge及隔离库副本。组合事件为模拟，不代替系统IME。浏览器错误列表为空；执行者查看取消刷新截图，文字仍在。命令退出、源码和日志摘要见`verification-summary.json`。

首次GREEN脚本将刷新取消后的reload等待超时当作失败，保留`green-reload-wait-diagnostic.json`与对应日志。最终仅在实际收到并取消beforeunload后接受ERR_ABORTED/超时，随后断言页面和文字仍在；干净/已保存刷新必须真正完成且没有弹窗。

## 清理与范围

[cleanup.json](cleanup.json)记录三次运行的隔离数据库副本均已删除，所属Edge/服务结束，3021空闲。原始run JSON为后续删除前状态，以独立cleanup记录为最终状态。

前批临时构建库删除被自动审批阻止，本轮只用作独立构建/复制来源，未绕过删除拦截，该库继续保留。没有生产数据库操作。

本批覆盖原生刷新/关闭，未扩大为真实IME、Back/Forward、所有组件组合或完整导航验收。取消保留DOM文字，明确接受离开仍会丢弃未保存内容。没有合并、部署或线上验收；F2/F4保持开放，计划23/30。
