# 图片替代文本的字段定位

日期：2026-10-02；基线`15ece8d186d20fa267144b7d93c6b690b5e7f712`。本批处理既有B4的图片说明入口，不新增C组能力。业务源码仅改HomeWorkspace、HomepageEditor和HomepageVisualWorkspace；没有协议、样式、依赖、迁移变更。

## 复现、设计与修复

原入口只切字段视图，字段编辑器默认identity，二维码说明属于contact且未渲染；人物图说明虽然存在，仍藏在关闭的高级文案内。4个现有中英文入口必须打开所属任务、展开、聚焦并滚动到字段，且保留当前工作副本。

这是已批准可视化编辑设计中的图片说明/备用字段入口修复，沿用现有任务、details和flush后切视图，不构建新的编辑模式。选择最小链路：入口传目标路径，flush成功后设置字段视图初始路径；footer选择contact，否则保留identity；挂载后展开高级文案并定位。

独立复审进一步发现dirty路径：document捕获导航保护先于链接onClick，把同页fragment当作离开，取消提示后入口回调不可达。实际4组RED均出现confirm、入口未打开，原输入仍能保存。现同origin、pathname、search的同页切换跳过离开确认；真正跨页面仍确认。既有草稿保存/发布与预览flush边界保留。

## 最终证据

| 检查 | 结果 |
| --- | --- |
| [组件RED](component-red.log) | QR中英文2失败，其余14项通过 |
| [第一阶段定向GREEN](component-green.log) | 3文件116项通过，覆盖四个初始字段任务；dirty导航问题由后续Edge补验 |
| [原入口Edge RED](red-results.json) | 4/4不满足展开/聚焦；QR两字段不存在 |
| [dirty Edge RED](dirty-red-results.json) | 4/4误弹离开confirm，取消后入口不能打开，文字保留 |
| [最终Edge GREEN](green-results.json) | 13/13：1440/375宽度×人物图/QR×中英文8组含展开、聚焦、视口几何、编辑与实际保存；4组dirty入口无confirm且保存原文字；跨页面取消仍留页并保留输入 |
| [最终全量](vitest-final.log) | 86文件590项通过 |
| 类型/代码 | typescript-final.log与eslint-final.log对应命令均退出0 |
| [最终构建](build-final.log) | 既有独立已迁移SQLite构建退出0，56页；Build ID `FtKzie28NxXLkA9JkhUXO` |

`verification-summary.json`记录源码、日志摘要及命令退出。截图在每组保存后采集，展示任务选择与保存状态；聚焦、展开和视口定位使用保存前真实DOM几何断言，不把保存后的截图称为仍聚焦的证明。执行者抽查375px二维码English保存截图，正确进入联系与导航，保存提示与任务按钮清晰可见。

## 独立复审

`whole_branch_review_20261002`先确认干净草稿定位链正确，再实际运行导航捕获函数发现dirty入口被阻断；执行者补4组Edge RED后修复。最终复审原Minor完整关闭，无新Critical/Important/Minor。审查者核对13组结果、三个组件源码摘要和Build ID，并独立运行捕获函数确认同页fragment放行，跨页面/查询变化仍提示。没有独立重跑全量或浏览器；真实IME、生产资源及服务器门槛仍排除。

中间诊断保留：最初选择器同时命中人物卡和图片；改选底层图片被卡片遮罩拦截，最终使用既有整张人物卡选择入口。二维码hover转移导致浮层消失，最终先点击微信按钮，通过既有focus-within保持浮层，再选图。首轮GREEN没有等平滑滚动结束且使用错误手机页签名；最终等待实际几何并使用“选中项设置”。上述诊断不冒充业务RED或最终结果。最终所有dialog均取消，不能靠自动接受提示掩盖导航问题。

## 清理与剩余门槛

[cleanup.json](cleanup.json)记录7份本轮隔离数据库副本及sidecar删除，所属Edge/服务结束、3022空闲；run JSON是随后删除前记录，以cleanup为最终状态。前批被自动审批拒绝删除的临时构建库仍保留，未绕过拦截。

[本地AI只读核对](local-ai-readiness.json)确认主项目本地数据库没有WEEKLY_UPDATE默认设置，无法进行已配置真实AI验收。脚本只用readOnly SQLite读取配置状态，不输出环境值/凭据，不请求模型，不修改主项目或生产数据库。用户已收到配置环境与C组范围的澄清请求，尚未据未回复推定授权。

真实系统IME、真实AI及发布范围/服务器/备份/回滚仍未完成，没有合并部署。计划保持23/30，goal active。具体人工门槛见 [manual-gates.md](manual-gates.md)。
