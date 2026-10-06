# Git 备份与 Docker 恢复

Git 保存源码、Markdown、前端资源和环境构建方法。Docker 镜像在新机器本地构建，不上传 Docker Hub，也不上传 GitHub Release。Windows、WSL、Linux 和 macOS 都可以使用同一份 Compose；需要 Git、可用的 Linux 容器引擎和 Docker Compose v2 或更新版本。

## 提交哪些文件

提交完整项目，尤其是 `Dockerfile`、`.dockerignore`、`compose*.yaml`、`scripts/`、`modules/`、`vendor/`、`posts/`、`snippets/` 和 `data/`。`vendor/` 包含页面需要的本地库、字体和许可证，让博客运行时不依赖 CDN。

`.local/` 保存本机 LAN/SSH 配置和授权公钥，已经被 Git 忽略；`.env` 与镜像/数据卷备份归档也不提交。镜像构建上下文只允许 Dockerfile 与 `.dockerignore`，不包含项目源码、`.git` 或 SSH 密钥。

在当前仓库备份：

```sh
git add .
git commit -m "Backup blog source and reproducible Docker deployment"
git push origin master
```

当前 GitHub 仓库是公开仓库，提交进去的文章和草稿也是公开文件。现有 Pages 工作流仍在推送 `master` 后发布静态站点；Docker 配置本身不会上传 Docker 镜像。

## 新机器从 clone 恢复

Windows 先启动 Docker Desktop 的 Linux 容器引擎；macOS 启动 Docker Desktop；Linux 安装并启动 Docker Engine 和 Compose 插件。

```sh
git clone https://github.com/bielaiii/blog_by_codex.git
cd blog_by_codex
docker compose build blog
docker compose up -d --no-build --pull never --wait
```

打开 `http://127.0.0.1:8000/`。新机器不需要安装 Node.js、npm、Python 或 SSH 服务，这些运行工具由镜像提供。构建首次下载公共 Node 基础镜像和 Debian 工具包；项目镜像只保留在本机。以后有了镜像，启动命令不会拉取或构建镜像。

Dockerfile 固定 Node 版本，安装 Git、Bash、SSH 与 VS Code 连接工具。和当前离线镜像一样，默认不安装可选的 `clang-format`；Markdown 格式化保留，C/C++ 代码格式化会提示缺少工具。依赖包的安全更新可能使日后重建的镜像内容有所变化；若需要完整保留某次镜像，使用下节的 `save/load`。

Linux 使用非 1000 的用户 ID 时，在构建和启动前设置挂载目录的 UID/GID：

```sh
export BLOG_UID=$(id -u)
export BLOG_GID=$(id -g)
docker compose build blog
docker compose up -d --no-build --pull never --wait
```

请用普通用户执行上述命令。原生 Linux 上该用户需要能运行 Docker，并且拥有 clone 的项目目录。Apple Silicon 等 ARM64 机器会构建该机器架构的镜像，Git 中的配置无需改动。

Windows 也可以使用项目脚本：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-image.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-local.ps1
```

WSL/Linux 的脚本入口是 `bash scripts/build-image.sh` 与 `bash scripts/deploy-local.sh`，这些辅助脚本另外使用宿主 Python 3。仅使用上面的原生 Compose 命令不需要宿主 Python。

## 可选：自己保存本地镜像用于完全离线恢复

Git 不保存 Docker 引擎里的镜像。要保留当前环境，并在同一 CPU 架构的新机器上离线恢复，先在旧机器执行：

```sh
docker image save -o /path/to/backup/blog-by-codex-image.tar blog-by-codex:local
```

Windows 可把输出路径替换为 `C:\Backups\blog-by-codex-image.tar`。备份目录需要事先创建，归档可以存到硬盘或自己的备份存储。

新机器取得 Git 项目和这个归档后执行：

```sh
docker image load -i /path/to/backup/blog-by-codex-image.tar
docker compose up -d --no-build --pull never --wait
```

这条恢复路径不下载基础镜像或软件包。Windows/Intel 的 AMD64 镜像与 ARM64 镜像不同；换 CPU 架构时优先在新机器构建，或另备份对应架构镜像。

## 恢复局域网、SSH 和开机启动

这些设置与新机器的 IP、路径和密钥有关，需要在新机器配置一次。默认 clone 后只开放本机网页，不自动开放局域网和 SSH。

Windows 浏览器局域网访问：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-lan.ps1
# 管理员 PowerShell：
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-lan-firewall.ps1 -Service HTTP -Port 8000
```

Windows SSH 源码连接：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-remote.ps1 -PublicKeyFile C:\path\to\mac.pub
# 管理员 PowerShell：
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-lan-firewall.ps1 -Port 2222
```

Windows 登录自动部署：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\switch-local.ps1 -Mode Windows
```

同时启用 Docker Desktop 的登录自动启动。不要把旧机器 `%LOCALAPPDATA%` 中含绝对项目路径的启动配置直接复制过来；运行安装脚本会记录新路径。

Linux/macOS 可用 Compose 环境变量开放局域网 HTTP：

```sh
BLOG_HTTP_BIND=0.0.0.0 BLOG_LAN_EDITOR=true docker compose up -d --no-build --pull never --wait
```

要让配置在后续 Compose 调用时保持一致，将 `BLOG_HTTP_BIND=0.0.0.0` 与 `BLOG_LAN_EDITOR=true` 写进未提交的 `.env`。防火墙与登录启动使用该操作系统自己的设置；容器已经设置 `restart: unless-stopped`，Docker 引擎启动后会恢复运行。

Linux/macOS 还可创建 `.local/authorized_keys`，写入 SSH 公钥，再通过 `BLOG_SSH_BIND=0.0.0.0 docker compose -f compose.yaml -f compose.remote.yaml up -d --no-build --pull never --wait` 启动 SSH。首次启用会生成新的服务器主机密钥，Mac 应按新服务器指纹确认连接。

## 需要保留 SSH 主机密钥和 VS Code 环境时

项目源码由 Git 恢复。SSH 主机密钥和 VS Code Server 保存在 Docker 命名卷 `blog-by-codex-local_blog-remote-home` 中，Git 不保存它们。仅恢复博客功能时不必备份该卷，重新连接会安装 VS Code Server 并生成新的主机密钥。

要保留它们，在旧机器用本地镜像导出卷；下面的 `/absolute/backup` 换为已经存在的备份目录，Windows 使用 `C:\Backups`：

```sh
docker run --rm --pull=never --user 0:0 --entrypoint tar -v blog-by-codex-local_blog-remote-home:/home/blog:ro -v /absolute/backup:/backup blog-by-codex:local -czf /backup/blog-remote-home.tar.gz -C /home/blog .
```

恢复时先构建或加载镜像，创建数据卷，在启用远程访问之前执行：

```sh
docker volume create blog-by-codex-local_blog-remote-home
docker run --rm --pull=never --user 0:0 --entrypoint tar -v blog-by-codex-local_blog-remote-home:/home/blog -v /absolute/backup:/backup:ro blog-by-codex:local -xzf /backup/blog-remote-home.tar.gz -C /home/blog
```

该归档含服务器 SSH 私钥，单独保存在自己的备份存储中，不提交到公开 Git。恢复的卷文件 UID/GID 要与运行容器的用户一致；换用户 ID 时需调整该卷所有权。
