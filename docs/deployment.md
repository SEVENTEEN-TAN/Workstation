# Personal Workstation 部署与回滚

本文只描述 WorkStation 的 Linux 原生发布流程。发布目录在 `/opt/personal-workstation`，SQLite、上传文件和备份都在发布目录之外，避免替换版本时丢失数据。

## 路径与前提

- 源码仓库：`https://github.com/SEVENTEEN-TAN/Workstation.git`
- 运行目录：`/opt/personal-workstation`
- 暂存版本：`/opt/personal-workstation-releases/<commit>`
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

1. 在本地待发布提交上运行 `npm test`、`npm run lint`、`npm run db:validate` 和 `npm run build`。
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

备份会生成 SQLite 快照、上传文件、文章附件快照、公开图片和清单。备份完成后确认新目录包含 `workstation.db`、`uploads/`、`article-attachments/`、`public-images/` 和 `manifest.json`。如果数据库正在使用，先确认没有管理员操作，再执行备份。

### 3. Scheduled backups and retention

仓库提供 `deploy/personal-workstation-backup.service` 和 `deploy/personal-workstation-backup.timer` 作为每日备份模板。默认在 03:00 触发，允许 15 分钟随机延迟，并使用 `Persistent=true` 在服务器停机错过周期后补跑。

在服务器上启用前，先确认 `command -v npm` 输出为 `/usr/bin/npm`；若 Node 安装路径不同，需要同步修改 service 中的 `ExecStart`。备份目录必须允许 `personal-workstation` 账号写入：

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
npm ci
npx prisma generate
npm test
npm run lint
npm run db:validate
npm run build
```

在源码目录构建 Linux 原生 standalone 输出，随后组装运行目录：

```bash
release_app=/opt/personal-workstation-releases/<commit>/app
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

`/opt/personal-workstation` 应是指向当前运行目录的符号链接。用临时链接完成替换，再重启服务：

```bash
ln -sfn /opt/personal-workstation-releases/<commit>/app /opt/personal-workstation.next
mv -Tf /opt/personal-workstation.next /opt/personal-workstation
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
3. 将 `/opt/personal-workstation` 指回上一个已验证的 `app` 目录，使用与发布相同的临时符号链接替换方式。
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
