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

备份包含 SQLite 一致性快照、媒体目录、文章附件快照和版本清单。执行恢复前先停止服务。生产环境应在 `.env` 中将 `DATABASE_URL`、`UPLOAD_DIR`、`ARTICLE_ATTACHMENT_DIR` 和 `BACKUP_DIR` 指向发布目录之外的持久化路径。

## 1Panel / Docker 部署

### 环境要求

服务器需要 Linux、Git、Docker 和 Docker Compose v2，并能访问 GitHub、Docker 镜像源和 npm。1Panel 已安装 Docker 时，可直接使用其服务器终端执行以下命令；不需要另建 1Panel Node.js 运行环境，也不需要在宿主机安装 Node.js。仓库的 Dockerfile 使用 Node.js 24，在 Linux 镜像内安装依赖并构建。

### 首次部署

在 **1Panel → 终端 → 服务器终端**执行：

```bash
mkdir -p /usr/local/dev
cd /usr/local/dev
git clone https://github.com/SEVENTEEN-TAN/Workstation.git
cd Workstation
mkdir -p /usr/local/dev/workstation-deploy
chmod 700 /usr/local/dev/workstation-deploy
cp -n deploy/container.env.example /usr/local/dev/workstation-deploy/.env
chmod 600 /usr/local/dev/workstation-deploy/.env
```

已有 `/usr/local/dev/Workstation` 仓库时，跳过克隆，直接进入该目录。通过 1Panel 文件管理编辑 `/usr/local/dev/workstation-deploy/.env`，确认以下配置；已有配置不要用示例覆盖：

```dotenv
WORKSTATION_DATA_DIR=/usr/local/dev/workstation-data
WORKSTATION_BIND=127.0.0.1
WORKSTATION_PORT=3001
BACKUP_RETENTION_DAYS=30
```

这三个 `WORKSTATION_*` 部署项必须是不带引号和空格的纯值，数据目录必须是绝对路径。可选的 AI / GitHub / 知识同步密钥也只放在这个外部 `.env`，不要提交到 GitHub。

然后构建并启动：

```bash
bash /usr/local/dev/Workstation/deploy/update.sh
```

看到 `Updated to ... HTTP health check passed` 表示容器已通过 HTTP 健康检查。容器内部固定监听 `3000`，上述配置将其映射到宿主机 `127.0.0.1:3001`。

在 **1Panel → 网站**创建反向代理并启用 HTTPS。OpenResty 使用宿主机网络时，代理目标为 `http://127.0.0.1:3001`；若在独立容器网络中，需使用它能访问的宿主机地址，并调整 `WORKSTATION_BIND` 和防火墙。容器内的 `127.0.0.1` 指向容器自身。

通过 HTTPS 域名访问 `/admin`，首次无管理员时按页面提示初始化账号。部署脚本只执行数据库迁移，不会运行 `db:seed`、自动创建管理员或导入旧数据库。账号初始化只创建管理员；首次进入 CMS 且没有草稿或发布版本时，应用使用仓库内置的 `bootstrapSiteContent` 创建可编辑草稿，包含默认中英文文案和示例项目，不会自动发布。它不是旧数据库中的内容，使用者应编辑为自己的内容后再发布。不要在正式数据库上运行本地示例数据的 seed 命令。

### 为什么源码之外还有目录

这些目录承担不同用途，并不是多个应用版本：

| 目录 | 来源与用途 |
| --- | --- |
| `/usr/local/dev/Workstation` | `git clone` 创建，保存项目源码和 `deploy/update.sh` |
| `/usr/local/dev/workstation-deploy` | 上面的配置步骤或脚本首次运行创建；保存外部 `.env`、部署用 `compose.yaml`、镜像记录和更新状态 |
| `/usr/local/dev/workstation-data` | 示例配置的默认数据路径，由脚本创建并挂载到容器 `/data` |
| `/usr/local/dev/workstation-managed-data` | 从旧运行环境切换到独立数据目录时选用的自定义路径，不是脚本默认创建的第二份数据 |

实际数据位置以外部 `.env` 的 `WORKSTATION_DATA_DIR` 为准。已采用 `/usr/local/dev/workstation-managed-data` 的部署应保留该值，不能为了匹配示例改回 `workstation-data`；否则应用会连接另一份数据库。数据库、上传文件、文章附件和备份分别保存为数据目录内的 `workstation.db`、`uploads/`、`article-attachments/` 和 `backups/`。

配置与数据独立于代码和镜像保存，升级不用重新初始化。配置目录默认位于仓库的同级目录 `workstation-deploy`，可通过 `WORKSTATION_DEPLOY_DIR` 指定其他位置；改用自定义配置目录后，每次更新都需传入相同的环境变量。清理旧数据目录前，先确认容器挂载和需要保留的文件。

### GitHub 更新后如何升级

将更新合并到 GitHub 的 `main` 后，在 1Panel 服务器终端运行同一条命令：

```bash
bash /usr/local/dev/Workstation/deploy/update.sh
# 也可固定版本：bash /usr/local/dev/Workstation/deploy/update.sh <commit-or-tag>
```

GitHub 更新不会自动部署。脚本默认获取 `origin/main`，在临时 Git worktree 中构建目标提交，不会对源码目录执行 `git pull`、reset 或 checkout；本地未提交修改不会进入镜像。流程为：**构建并验证临时数据库迁移 → 停止旧应用 → 备份已有数据库与文件 → 执行正式迁移 → 切换容器 → HTTP 健康检查**。新装没有数据库时跳过备份；后续升级保留外部 `.env` 和持久化数据，停写、备份及切换期间会短暂停机。

上述命令运行的是服务器源码目录中的安装脚本。如果 GitHub 更新了 `deploy/update.sh` 本身，先确认没有本地脚本定制，再更新安装副本：

```bash
git -C /usr/local/dev/Workstation fetch origin
git -C /usr/local/dev/Workstation restore --source=origin/main -- deploy/update.sh
bash /usr/local/dev/Workstation/deploy/update.sh
```

`git restore` 会覆盖本地 `deploy/update.sh`；外部 `.env` 和数据目录不受影响。部署固定历史版本时应使用与该版本兼容的脚本。

升级成功后还需通过 HTTPS 域名检查主页、后台登录、CMS 预览和上传。HTTP 健康检查只确认首页响应成功。构建失败时旧应用继续运行；正式迁移或健康检查失败后脚本停止应用，应先检查日志和匹配的备份，再决定恢复方式，不要直接启动旧代码。

### 查看日志与普通重启

以下命令使用已经构建的镜像，不拉取代码、不构建、不执行迁移：

```bash
cd /usr/local/dev/workstation-deploy
docker compose --project-name workstation-managed --env-file .env --env-file image.env logs --tail 100 app
docker compose --project-name workstation-managed --env-file .env --env-file image.env up -d --no-build
```

也可在 1Panel 容器页面管理 `workstation-managed` 项目的应用。已切换到该流程后，不要再启动旧的 1Panel Node.js 容器。旧容器切换、备份恢复和回滚的具体步骤见 [docs/deployment.md](docs/deployment.md)；回滚数据库会覆盖当前数据，应先确认匹配的备份。

## Windows Obsidian 同步

部署服务器不能直接读取本机 `F:` 盘。Windows 电脑可扫描本地 Vault 后把 Markdown 快照推送到 WorkStation；同步创建私有索引、差异报告和不可变源修订。为笔记创建发布草稿后，下一次同步只上传该草稿请求的图片嵌入，并自动加入草稿附件映射。

1. 在服务器生成高熵令牌，并仅将其 SHA-256 十六进制摘要写入 `KNOWLEDGE_SYNC_TOKEN_HASH`。
2. 在 Windows 用户环境变量中设置 `KNOWLEDGE_SYNC_URL`、`KNOWLEDGE_SYNC_TOKEN`、`KNOWLEDGE_SYNC_VAULT_ID` 和 `KNOWLEDGE_SYNC_VAULT_PATH`；可选 `KNOWLEDGE_SYNC_IGNORE_PATTERNS` 用逗号或换行分隔。
3. 在包含本项目依赖的 Windows 工作目录执行 `npm run knowledge:sync`，确认首次报告无误后再通过“任务计划程序”定期执行该命令。

生产环境必须使用 HTTPS。令牌、Markdown 正文和本地路径不会打印到客户端日志中。

## GitHub 同步

后台 `/admin/github` 可保存 GitHub 用户名、同步公开仓库与近期公开事件，并选择后续自动化可以引用的项目。同步快照仅供后台使用，不会直接发布到主页、项目或职业动态。

未配置令牌时使用 GitHub 匿名 API；如需更高的请求额度，可在服务器 `.env` 中设置 `GITHUB_TOKEN`。该令牌只在服务端请求 GitHub 时读取，不写入数据库，也不会发送到浏览器。

## 主要入口

- `/`：公开主页
- `/okr`：公开 OKR
- `/admin`：管理后台
- `/admin/github`：GitHub 同步与项目选择
- `/preview?id=<草稿版本 ID>`：登录态主页预览
