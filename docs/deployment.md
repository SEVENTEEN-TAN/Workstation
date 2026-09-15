# Personal Workstation 部署与回滚

本文只描述 WorkStation 的 Linux 原生发布流程。发布目录在 `/opt/personal-workstation`，SQLite、上传文件和备份都在发布目录之外，避免替换版本时丢失数据。

## 路径与前提

- 源码仓库：`https://github.com/SEVENTEEN-TAN/Workstation.git`
- 运行目录：`/opt/personal-workstation`
- 暂存版本：`/opt/personal-workstation-releases/<commit>`
- 数据库：`/var/lib/personal-workstation/workstation.db`
- 上传目录：`/var/lib/personal-workstation/uploads`
- 备份目录：`/var/backups/personal-workstation`
- 环境文件：`/etc/personal-workstation.env`
- systemd 服务：`personal-workstation.service`
- 应用监听：`127.0.0.1:3000`

每次部署前必须重新核对服务器上的 Node 版本、磁盘空间、服务状态、Nginx 配置和当前 `/opt/personal-workstation` 指向。不要把本文当成当前生产状态的实时记录。

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

备份会生成 SQLite 快照、上传文件、公开图片和清单。备份完成后确认新目录包含 `workstation.db`、`uploads/`、`public-images/` 和 `manifest.json`。如果数据库正在使用，先确认没有管理员操作，再执行备份。

### 3. Clean checkout and build

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

### 4. Migrate

在切流前，用待发布源码对持久化数据库执行迁移。只包含向后兼容迁移时可以保持旧版本运行；若迁移会让旧版本无法继续读写，先进入维护窗口并停止 `personal-workstation.service`，再执行下面的命令：

```bash
set -a
. /etc/personal-workstation.env
set +a
npx prisma migrate deploy
sqlite3 /var/lib/personal-workstation/workstation.db 'PRAGMA integrity_check;'
```

如果 `DATABASE_URL` 是 `file:/var/lib/personal-workstation/workstation.db`，对应检查文件是 `/var/lib/personal-workstation/workstation.db`。`integrity_check` 必须返回 `ok`。

### 5. Atomic service switch

`/opt/personal-workstation` 应是指向当前运行目录的符号链接。用临时链接完成替换，再重启服务：

```bash
ln -sfn /opt/personal-workstation-releases/<commit>/app /opt/personal-workstation.next
mv -Tf /opt/personal-workstation.next /opt/personal-workstation
systemctl restart personal-workstation.service
```

环境文件由 systemd 读取，应用只监听 `127.0.0.1:3000`。不要把数据库、上传文件或备份放进任何版本目录。

### 6. Health checks

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

恢复会覆盖当前数据库和上传目录，只能在明确选择备份目录后执行。若新版本没有改变结构，优先保留现有数据，只回滚代码。

5. 启动服务并重复上述 health checks。
6. 回滚完成后记录原因、保留的新版本目录和下一次修复计划；不要立即删除发布目录，至少等确认稳定后再清理。
