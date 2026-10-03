# Personal Workstation 部署与回滚

推荐 1Panel 使用下面的容器流程；原有 Linux 原生发布流程保留在后半部分。两种方式都将 SQLite、上传文件和备份放在发布目录之外。

## 1Panel 容器部署

需要 Linux、Git、Docker 和 Docker Compose v2，宿主机不需要安装 Node.js。镜像使用 Node.js 24 与 Debian bookworm，在 Linux 中编译 Prisma/argon2 等原生依赖。为了让同一镜像执行迁移、备份和恢复，运行镜像保留 Prisma、tsx 等工具依赖；构建数据库仅在镜像构建的 `/tmp`，不会读取正式数据库，也不执行生产 seed。

### 首次安装与现有运行环境切换

在服务器终端执行一次配置：

```bash
cd /usr/local/dev/Workstation
mkdir -p /usr/local/dev/workstation-deploy
chmod 700 /usr/local/dev/workstation-deploy
cp -n deploy/container.env.example /usr/local/dev/workstation-deploy/.env
chmod 600 /usr/local/dev/workstation-deploy/.env
```

检查 `.env` 中三个部署项：

| 配置 | 默认值 |
| --- | --- |
| `WORKSTATION_DATA_DIR` | `/usr/local/dev/workstation-data` |
| `WORKSTATION_BIND` | `127.0.0.1` |
| `WORKSTATION_PORT` | `3001` |

容器内固定使用 `/data/workstation.db`、`/data/uploads`、`/data/article-attachments` 和 `/data/backups`。AI/GitHub/知识同步等可选密钥只写入这个外部 `.env`，不要提交到 Git；更新不会覆盖它。新安装也可直接执行下面的更新命令，脚本仅在不存在 `.env` 时创建默认配置。

没有旧容器时，一条命令完成构建、迁移与启动：

```bash
bash deploy/update.sh
```

已有 1Panel Node.js 容器 `Workstation` 且挂载同一数据目录时，用显式切换命令：

```bash
bash deploy/update.sh --legacy-container Workstation
```

脚本先构建并验证新镜像的临时数据库迁移，成功后才停止指定的旧容器；不会删除旧容器。旧数据库存在时会先备份，数据库不存在时跳过备份。备份失败且尚未开始迁移时会重启旧容器。首次切换不自动停止未指定的 1Panel 容器；若已手动停止旧容器，就使用不带参数的命令。所有其他访问同一数据库或上传目录的写入程序也必须停止。

启动后在 1Panel 创建反向代理并启用域名 HTTPS，访问 `/admin` 初始化账号。HTTP 公网 IP 会缺少安全上下文 API（例如 `crypto.randomUUID`），生产登录 Cookie 也要求 HTTPS。

如果 OpenResty 使用宿主机网络，代理地址为 `http://127.0.0.1:3001`。如果 OpenResty 在独立容器网络中，它的 `127.0.0.1` 指向自己；需要使用能到达宿主机的地址，并按实际网络调整 `WORKSTATION_BIND`（例如 `0.0.0.0`），在防火墙限制 3001 端口访问。不要把容器内部 3000 与宿主机 3001 混淆。

### 后续更新与普通重启

手动更新默认采用远程 `origin/main`，也可指定提交号或标签：

```bash
cd /usr/local/dev/Workstation
bash deploy/update.sh
# 或固定版本：bash deploy/update.sh <commit-or-tag>
```

脚本只 fetch，不对当前工作目录执行 `git pull`、reset 或 checkout。待发布版本在临时 detached worktree 中构建；本地未提交文件不会进入镜像。更新顺序是：构建与临时迁移验证 → 停止旧应用 → 备份 → 正式迁移 → 切换 → HTTP 健康检查。数据库与文件在停写期间一起备份，不能将运行中的上传文件复制视为原子备份。更新会有短暂维护窗口；脚本保留旧镜像、外部配置与备份，并将状态记录在 `workstation-deploy/last-update`。

以下命令只启动已有镜像，不安装依赖、不迁移、不构建：

```bash
cd /usr/local/dev/workstation-deploy
docker compose --project-name workstation-managed --env-file .env --env-file image.env up -d --no-build
docker compose --project-name workstation-managed --env-file .env --env-file image.env logs --tail 100 app
```

可以在 1Panel 容器页面管理 `workstation-managed` 项目的应用；不要继续重启已停止的旧 `Workstation` 容器，否则会出现端口冲突或两个程序同时写数据库。不要执行 `docker compose down -v` 或删除持久化目录。服务器部署不会因 GitHub 主仓库变化自动上线；运行更新命令才会更新。

### 更新失败与回滚

构建或临时迁移失败时旧应用保持运行；备份失败时仅在正式迁移尚未开始的情况下重启旧应用。正式迁移或健康检查失败后，脚本停止应用，不会自动覆盖数据或启动可能不兼容的新旧代码。检查 `last-update`、容器日志和备份后，再明确选择恢复方案。

若确认数据库结构兼容，只切回旧镜像，保留现有数据：

```bash
cd /usr/local/dev/workstation-deploy
previous_image=workstation-local:<last-update中的previous_image提交号>
WORKSTATION_IMAGE="$previous_image" docker compose --project-name workstation-managed --env-file .env stop app
WORKSTATION_IMAGE="$previous_image" docker compose --project-name workstation-managed --env-file .env up -d --no-build --wait --wait-timeout 120 app
printf '%s\n' "$previous_image" > current-image
printf 'WORKSTATION_IMAGE=%s\n' "$previous_image" > image.env
```

如果需要回滚数据库结构，恢复发布前的同一套数据库和文件。**恢复会覆盖当前数据，丢弃备份之后的变更；先保存故障现场，明确确认选定备份和维护窗口，不可直接复制照做。** 使用 `last-update` 中的旧镜像和 `/data/backups/...` 备份路径：

```bash
# 当前应用及所有其他写入进程必须保持停止
WORKSTATION_IMAGE="$previous_image" docker compose --project-name workstation-managed --env-file .env run --rm --no-deps app npm run db:restore -- --from /data/backups/<selected-backup>
WORKSTATION_IMAGE="$previous_image" docker compose --project-name workstation-managed --env-file .env run --rm --no-deps app npx prisma validate
# 然后执行上面的旧镜像启动与状态记录命令
```

恢复脚本恢复数据库、上传目录和文章附件；`public/images` 使用对应旧镜像中的资源。首次从旧 Node.js 运行环境切换时没有 `previous_image`，应保留旧容器与源码，恢复匹配数据后再由 1Panel 启动它。镜像不要立即清理。

脚本 HTTP 健康检查只能确认 `/` 返回成功，不替代域名 HTTPS、后台登录和上传等人工验收。本地测试若没有 Docker daemon，只能证明脚本失败路径与 Compose 配置；服务器必须实际构建、启动和检查后才算上线。

## Linux 原生发布

运行版本放在 `/opt/personal-workstation/releases`，当前运行版与源码分别通过 `/opt/personal-workstation/current` 和 `/opt/personal-workstation/source` 指向。

## 路径与前提

- 源码仓库：`https://github.com/SEVENTEEN-TAN/Workstation.git`
- 源码目录：`/opt/personal-workstation-releases/<commit>/source`
- 运行版本：`/opt/personal-workstation/releases/<commit>`
- 当前运行版：`/opt/personal-workstation/current`
- 当前源码：`/opt/personal-workstation/source`
- 数据库：`/var/lib/personal-workstation/workstation.db`
- 上传目录：`/var/lib/personal-workstation/uploads`
- 文章附件快照：`/var/lib/personal-workstation/article-attachments`
- 备份目录：`/var/backups/personal-workstation`
- 环境文件：`/etc/personal-workstation.env`
- systemd 服务：`personal-workstation.service`
- 应用监听：`127.0.0.1:3000`

环境文件中必须将 `ARTICLE_ATTACHMENT_DIR` 指向 `/var/lib/personal-workstation/article-attachments`。

每次部署前必须重新核对服务器上的 Node 版本、磁盘空间、服务状态、Nginx 配置和当前 `/opt/personal-workstation` 指向。不要把本文当成当前生产状态的实时记录。

## Windows Obsidian 同步

服务器无法读取 Windows 本机 Vault。为同步生成一次随机令牌，保留原始值仅供 Windows 客户端使用，并把摘要写入服务器环境文件：

```bash
token="$(openssl rand -base64 32 | tr -d '\n' | tr '+/' '-_')"
printf '%s' "$token" | sha256sum | awk '{print "KNOWLEDGE_SYNC_TOKEN_HASH=" $1}'
```

将输出的 `KNOWLEDGE_SYNC_TOKEN_HASH` 写入 `/etc/personal-workstation.env`，不要把 `$token` 写入服务器、仓库或日志。Windows 侧设置以下用户环境变量后，在项目目录运行 `npm run knowledge:sync`：

- `KNOWLEDGE_SYNC_URL`：站点 HTTPS 地址。
- `KNOWLEDGE_SYNC_TOKEN`：上一步保存的原始令牌。
- `KNOWLEDGE_SYNC_VAULT_ID`：后台登记 Vault 的 ID。
- `KNOWLEDGE_SYNC_VAULT_PATH`：本机 Vault 的绝对路径。
- `KNOWLEDGE_SYNC_IGNORE_PATTERNS`：可选，逗号或换行分隔的忽略规则。

首次手动同步并检查后台报告后，可使用 Windows“任务计划程序”按周期执行该命令。默认同步 Markdown 快照和索引元数据；后台为笔记创建发布草稿后，客户端会按请求上传该草稿引用的图片。同步不会改写 Vault 或直接修改公开内容。

## 发布流程

发布顺序为：preflight → backup → clean checkout/build → staged standalone release → migrate → atomic service switch → health checks。

### 1. Preflight

1. 在本地待发布提交上运行 `npm test`、`npm run lint`、`npm run db:validate` 和 `npm run build`；数据库校验与构建使用独立、已迁移的临时 SQLite。
2. 在服务器确认 Node.js 满足项目要求、磁盘空间充足、`personal-workstation.service` 和 Nginx 当前状态可回溯。
3. 记录当前发布目录实际指向的 commit、数据库迁移记录和最近一次备份目录。
4. 确认 `/etc/personal-workstation.env` 只包含运行所需变量，不输出或复制其中的敏感值。

### 2. Backup

在生产环境变量指向持久化路径的前提下执行备份：

```bash
set -a
. /etc/personal-workstation.env
set +a
npm run db:backup
```

备份会生成 SQLite 快照、上传文件、文章附件快照、公开图片和清单。备份完成后确认新目录包含 `workstation.db`、`uploads/`、`article-attachments/`、`public-images/` 和 `manifest.json`。要让数据库与文件匹配，执行前停止应用及其他写入进程，完成后再启动；仅确认没有管理员操作不能保证上传文件快照一致。

### 3. Scheduled backups and retention

仓库提供 `deploy/personal-workstation-backup.service` 和 `deploy/personal-workstation-backup.timer` 作为每日备份模板。默认在 03:00 触发，允许 15 分钟随机延迟，并使用 `Persistent=true` 在服务器停机错过周期后补跑。

在服务器上启用前，先确认 `/opt/personal-workstation/source` 指向当前版本的完整源码，且 `command -v npm` 输出为 `/usr/bin/npm`；若 Node 安装路径不同，需要同步修改 service 中的 `ExecStart`。备份目录必须允许 `personal-workstation` 账号写入：

```bash
install -d -o personal-workstation -g personal-workstation -m 0750 /var/backups/personal-workstation
cp deploy/personal-workstation-backup.service deploy/personal-workstation-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now personal-workstation-backup.timer
systemctl list-timers personal-workstation-backup.timer
```

在 `/etc/personal-workstation.env` 中设置 `BACKUP_RETENTION_DAYS=30` 可调整保留天数，默认 30 天。清理只针对严格匹配时间戳格式的备份目录，且只在本次备份的 `manifest.json` 写入完成后执行；手工复制或手工命名的目录不会被删除。

这些文件只是部署模板，只有在服务器上实际启用并通过 timer 与一次手动备份验证后，生产定时备份才算生效。

### 4. Clean checkout and build

为待发布 commit 创建独立源码目录，并强制核对提交号：

```bash
release_source=/opt/personal-workstation-releases/<commit>/source
git clone https://github.com/SEVENTEEN-TAN/Workstation.git "$release_source"
git -C "$release_source" checkout <commit>
cd "$release_source"
npm ci --include=dev
npx prisma generate
build_db="$(mktemp -p /tmp workstation-build-XXXXXX)"
export DATABASE_URL="file:$build_db"
npx prisma migrate deploy
npm run db:seed
npm test
npm run lint
npm run db:validate
npm run build
```

这里的 `DATABASE_URL` 仅指向本次构建专用的临时 SQLite；生产数据库只在第 5 步迁移。构建后核对并清理 `build_db` 指向的文件及其 SQLite sidecar，不清理其他数据库。

在源码目录构建 Linux 原生 standalone 输出，随后组装运行目录：

```bash
release_app=/opt/personal-workstation/releases/<commit>
mkdir -p "$release_app"
cp -a .next/standalone/. "$release_app/"
cp -a .next/static "$release_app/.next/static"
cp -a public "$release_app/public"
cp -a prisma "$release_app/prisma"
```

运行目录中必须能找到 `server.js`、`.next/static`、`public` 和 `prisma/migrations`。

### 5. Migrate

在切流前，用待发布源码对持久化数据库执行迁移。只包含向后兼容迁移时可以保持旧版本运行；若迁移会让旧版本无法继续读写，先进入维护窗口并停止 `personal-workstation.service`，再执行下面的命令：

```bash
install -d -o personal-workstation -g personal-workstation -m 0750 /var/lib/personal-workstation
if [ ! -e /var/lib/personal-workstation/workstation.db ]; then
  install -o personal-workstation -g personal-workstation -m 0640 /dev/null /var/lib/personal-workstation/workstation.db
fi
set -a
. /etc/personal-workstation.env
set +a
npx prisma migrate deploy
sqlite3 /var/lib/personal-workstation/workstation.db 'PRAGMA integrity_check;'
```

如果 `DATABASE_URL` 是 `file:/var/lib/personal-workstation/workstation.db`，对应检查文件是 `/var/lib/personal-workstation/workstation.db`。`integrity_check` 必须返回 `ok`。

### 6. Atomic service switch

`/opt/personal-workstation/current` 和 `/opt/personal-workstation/source` 应分别指向当前运行目录和完整源码目录。用临时链接完成替换，再重启服务：

```bash
ln -sfn /opt/personal-workstation-releases/<commit>/source /opt/personal-workstation/source.next
mv -Tf /opt/personal-workstation/source.next /opt/personal-workstation/source
ln -sfn /opt/personal-workstation/releases/<commit> /opt/personal-workstation/current.next
mv -Tf /opt/personal-workstation/current.next /opt/personal-workstation/current
systemctl restart personal-workstation.service
```

环境文件由 systemd 读取，应用只监听 `127.0.0.1:3000`。不要把数据库、上传文件或备份放进任何版本目录。

### 7. Health checks

1. 确认 `systemctl is-active personal-workstation.service`。
2. 直接检查 `http://127.0.0.1:3000/`、`/okr` 和 `/admin`。
3. 如 Nginx 配置有变更，先执行 `nginx -t`，通过后执行 `systemctl reload nginx`。
4. 通过 HTTPS 域名再次检查 `/`、`/okr` 和 `/admin`。
5. 查看应用日志和 Nginx 错误日志中的新异常。

## 回滚流程

回滚顺序为：stop service → restore prior release → restore matching database/uploads when schema changed → start → health checks。

1. 先确认故障来自新版本，并记录当前 commit、日志和数据库迁移状态。
2. 停止服务：`systemctl stop personal-workstation.service`。
3. 将 `/opt/personal-workstation/current` 和 `/opt/personal-workstation/source` 指回上一个已验证版本的运行目录与源码目录，使用与发布相同的临时符号链接替换方式。
4. 若新版本改变了数据库结构，或旧代码无法读取当前数据库，从发布前备份恢复同一套数据库和上传文件：

```bash
cd /opt/personal-workstation-releases/<prior-commit>/source
set -a
. /etc/personal-workstation.env
set +a
npm run db:restore -- --from /var/backups/personal-workstation/<backup-directory>
npx prisma validate
sqlite3 /var/lib/personal-workstation/workstation.db 'PRAGMA integrity_check;'
```

恢复会覆盖当前数据库、上传目录和文章附件快照目录，只能在明确选择备份目录后执行。若新版本没有改变结构，优先保留现有数据，只回滚代码。

5. 启动服务并重复上述 health checks。
6. 回滚完成后记录原因、保留的新版本目录和下一次修复计划；不要立即删除发布目录，至少等确认稳定后再清理。
