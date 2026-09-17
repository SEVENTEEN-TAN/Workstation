# Personal Workstation

基于 Next.js、TypeScript、Prisma 和 SQLite 的个人工作站，包含公开主页、公开 OKR、单管理员后台、主页 CMS、媒体资源和 OKR 仪表盘。

## 本地运行

```powershell
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

打开 `http://localhost:3000`。首次运行且数据库中没有管理员时，访问 `/admin` 会进入初始化页面。

当前开发数据库已创建本地验收账号：用户名 `admin`，密码 `admin`。该账号只用于本机测试，生产环境请通过首次初始化页面设置至少 12 位的独立密码。

## 常用检查

```powershell
npm test
npm run lint
npm run db:validate
npm run build
```

## 备份与恢复

```powershell
npm run db:backup
npm run db:restore -- --from <备份目录>
```

备份包含 SQLite 一致性快照、媒体目录和版本清单。执行恢复前先停止服务。生产环境应在 `.env` 中将 `DATABASE_URL`、`UPLOAD_DIR` 和 `BACKUP_DIR` 指向发布目录之外的持久化路径。

## 部署与回滚

生产发布、迁移、切流和回滚流程见 [docs/deployment.md](docs/deployment.md)。

## Windows Obsidian 同步

部署服务器不能直接读取本机 `F:` 盘。Windows 电脑可扫描本地 Vault 后把 Markdown 快照推送到 WorkStation；同步创建私有索引、差异报告和不可变源修订。为笔记创建发布草稿后，下一次同步只上传该草稿请求的图片嵌入，并自动加入草稿附件映射。

1. 在服务器生成高熵令牌，并仅将其 SHA-256 十六进制摘要写入 `KNOWLEDGE_SYNC_TOKEN_HASH`。
2. 在 Windows 用户环境变量中设置 `KNOWLEDGE_SYNC_URL`、`KNOWLEDGE_SYNC_TOKEN`、`KNOWLEDGE_SYNC_VAULT_ID` 和 `KNOWLEDGE_SYNC_VAULT_PATH`；可选 `KNOWLEDGE_SYNC_IGNORE_PATTERNS` 用逗号或换行分隔。
3. 在包含本项目依赖的 Windows 工作目录执行 `npm run knowledge:sync`，确认首次报告无误后再通过“任务计划程序”定期执行该命令。

生产环境必须使用 HTTPS。令牌、Markdown 正文和本地路径不会打印到客户端日志中。

## 主要入口

- `/`：公开主页
- `/okr`：公开 OKR
- `/admin`：管理后台
- `/preview?id=<草稿版本 ID>`：登录态主页预览
