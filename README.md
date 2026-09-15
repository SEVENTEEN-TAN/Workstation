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

## 主要入口

- `/`：公开主页
- `/okr`：公开 OKR
- `/admin`：管理后台
- `/preview?id=<草稿版本 ID>`：登录态主页预览
