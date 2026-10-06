# GitHub Pages 个人博客

这是一个纯静态个人博客模板，适合直接托管到 GitHub Pages。

前端入口是 `app.js`；`modules/editor.js` 负责本地编辑器，`modules/markdown.js` 负责 Markdown 与公式渲染，`modules/data.js` 负责读取和刷新站点数据。浏览器直接加载原生 ES 模块，不需要构建步骤。

## 当前结构

- 顶部是 `个人简历 / 分享文章 / 项目` 三个 tab
- 首次打开默认显示欢迎页，点击 tab 后再进入对应栏目
- 左侧是文章归档列表，只显示标题和预览
- 点击归档卡片后，进入完整文章详情
- 右侧是时间轴，当前文章日期最大，其他日期会缩小并带虚化

## 目录建议

```text
.
├─ index.html
├─ styles.css
├─ app.js
├─ posts/
│  ├─ first-post.md
│  ├─ code-snippet-demo.md
│  ├─ writing-workflow.md
│  └─ project-blueprint.md
└─ assets/
   └─ posts/
```

## 在哪里添加文章

所有文章都放在 `posts/` 目录中。

例如：

- `posts/my-new-post.md`
- `posts/my-project-note.md`

也可以用脚本创建：

```bash
node scripts/new-post.js "我的新文章" --tags CUDA,Scan
```

创建草稿：

```bash
node scripts/new-post.js "还没写完的文章" --draft
```

脚本会生成 Markdown 文件，并刷新 `data/posts.json` 与 `data/post-metadata.json`。

如果你手动新增或修改文章元信息，可以运行：

```bash
node scripts/generate-posts.js
node scripts/generate-post-metadata.js
```

文章可以在文件开头写 frontmatter：

```md
---
title: "我的新文章"
date: 2026-06-14
summary: "这里写归档页显示的预览文字。"
tags: ["CUDA", "Scan"]
tab: articles
layout: single
draft: false
---
```

页面会读取自动生成的 `data/posts.json`。如果你需要集中覆盖标题、摘要、标签或栏目，可以在 `scripts/generate-posts.js` 的 `overrides` 里补配置。

## 草稿和隐藏文章

文章元信息支持两个隐藏配置：

```js
{
  slug: "my-draft",
  tab: "articles",
  title: "还没写完的文章",
  date: "2026-03-28",
  summary: "暂时不会出现在页面上。",
  tags: ["草稿"],
  file: "posts/my-draft.md",
  draft: true
}
```

- `draft: true`：草稿。默认不发布；本地用 `INCLUDE_DRAFTS=true node scripts/generate-posts.js` 可以预览。要在 GitHub Pages 显示全部草稿，设置 `data/site-config.json` 中的 `publishDrafts: true`。
- `hidden: true` 或 `visible: false`：隐藏文章，即使开启 `publishDrafts` 也不会发布。

直接访问被隐藏文章的链接时，页面会回到对应栏目的归档列表。

## 文章目录

文章详情页会根据正文里的 `##` 和 `###` 自动生成目录，显示在正文左侧。窄屏下目录会移动到正文上方。

## 文章布局

默认文章是单列阅读。需要整篇文章使用左右两列时，在 `scripts/generate-posts.js` 的 `overrides` 里给文章加：

```js
layout: "two-column"
```

然后在 Markdown 里用标准 HTML 注释标记每一组左右对照：

```md
<!-- row -->

左侧这一组内容，可以放图、示意、数据变化过程。

<!-- column -->

右侧这一组内容，可以放对应代码、解析、推导。

<!-- row -->

下一组左侧内容。

<!-- column -->

下一组右侧内容。
```

没有配置 `layout` 时会继续使用单列。

## Mermaid 图

文章支持 Mermaid，适合快速画流程图、依赖图和状态图：

````md
```mermaid
graph LR
  A[输入数组] --> B[offset = 1]
  B --> C[offset = 2]
  C --> D[输出]
```
````

Mermaid 适合表达结构关系；如果需要精确几何控制，建议用 LaTeX/TikZ 或 SVG 图片。

## 部署前检查

推送前可以运行：

```bash
node scripts/check-site.js
```

它会检查文章文件、重复 slug、两列文章的 `row/column` 标记、空 Mermaid 块和失效本地图片引用。

## 行内背景高亮

正文里可以用扩展语法给一小段文字加背景色：

```md
==默认高亮==
==blue:蓝色高亮==
==warn:警示高亮==
```

高亮颜色配置在：

- `data/highlight-styles.json`

每个高亮样式都需要同时配置 `background` 和 `text`，确保文字和背景有明显区分。配置按浅色/深色主题拆开：

```json
{
  "blue": {
    "light": {
      "text": "#06245c",
      "background": "rgba(150, 196, 255, 0.66)",
      "border": "rgba(13, 107, 255, 0.2)"
    },
    "dark": {
      "text": "#061835",
      "background": "rgba(190, 218, 255, 0.92)",
      "border": "rgba(190, 218, 255, 0.34)"
    }
  }
}
```

## 如何归档到不同栏目

由 `tab` 字段控制：

- `tab: "resume"`：归档到 `个人简历`
- `tab: "articles"`：归档到 `分享文章`
- `tab: "projects"`：归档到 `项目`

如果你说的“归档到个人文章中”是默认个人文章区，就把它写成 `tab: "resume"`。

## 分享文章的标签筛选

`分享文章` 右侧会自动汇总 `app.js` 中文章元信息里的 `tags` 字段。新增文章时，只要在对应文章对象里写上：

```js
tags: ["Markdown", "代码"]
```

刷新页面后，新标签会自动出现在右侧标签筛选区。默认所有标签都是激活状态；第一次点击某个标签时，会只保留这个标签，后续点击则会在当前激活标签基础上继续多选或取消。右侧搜索框会同时搜索文章标题、摘要、正文和标签，并和标签筛选一起生效；命中文章正文时，左侧归档卡片会显示带高亮的上下文片段。

## 标签颜色怎么配置

特定标签的颜色配置在：

- `data/tag-styles.json`

按标签名配置浅色和深色两套颜色：

```json
{
  "Markdown": {
    "light": {
      "text": "#7c3aed",
      "background": "rgba(124, 58, 237, 0.12)",
      "border": "rgba(124, 58, 237, 0.22)",
      "glow": "rgba(124, 58, 237, 0.14)"
    },
    "dark": {
      "text": "#ddd6fe",
      "background": "rgba(167, 139, 250, 0.18)",
      "border": "rgba(221, 214, 254, 0.28)",
      "glow": "rgba(167, 139, 250, 0.2)"
    }
  }
}
```

没有配置的标签会继续使用默认颜色。

## 是否显示文章日期

文章日期显示开关在：

- `data/site-config.json`

默认关闭：

```json
{
  "showArticleDates": false,
  "showTimelineDates": true,
  "dateSource": "generated",
  "generatedDateField": "createdAt",
  "publishDrafts": false
}
```

把 `showArticleDates` 改成 `true` 后，归档卡片和文章详情会显示日期。右侧时间轴由 `showTimelineDates` 单独控制，默认保持显示日期。

把 `publishDrafts` 改成 `true` 并推送到 `master` 后，GitHub Pages 会显示所有 `draft: true` 的文章及“草稿”标记；改回 `false` 后，下次部署会从站点移除它们。

`dateSource` 可选：

- `generated`：读取 `data/post-metadata.json`，这个文件由 `scripts/generate-post-metadata.js` 从 Git 记录自动生成。
- `metadata`：读取 `app.js` 文章元信息里的 `date` 字段。

`generatedDateField` 可选：

- `createdAt`：文章文件第一次进入 Git 的时间。
- `updatedAt`：文章文件最近一次提交修改的时间。

本仓库已经包含 GitHub Pages workflow。每次 push 到 `master` 时，会自动运行生成脚本并部署静态站点；本地需要手动刷新生成文件时，可以运行：

```bash
node scripts/generate-posts.js
node scripts/generate-post-metadata.js
```

首页的 GitHub 风格更新格子图也读取这份生成文件，按 `updatedAt` 统计 `分享文章` 和 `项目` 两个栏目的更新。

## 在哪里保存图片

建议把文章图片放在：

- `assets/posts/文章slug/图片名`

例如：

- `assets/posts/my-new-post/cover.jpg`
- `assets/posts/my-new-post/screenshot.png`

## Markdown 里怎么插图

因为文章文件在 `posts/` 目录下，所以推荐这样引用图片：

```md
![封面图](../assets/posts/my-new-post/cover.jpg)
```

或：

```md
![截图](../assets/posts/my-new-post/screenshot.png)
```

页面已经支持 Markdown 图片展示，图片会自动按正文宽度显示。

## 文章里怎么添加浮窗注释

浮窗文字统一写在：

- `posts/tooltips.json`

格式示例：

```json
{
  "长期写作": "把写作当成持续整理和复盘的入口，而不是一次性的发布动作。",
  "轻量流程": "保留必要步骤，减少维护负担，让内容更容易持续更新。"
}
```

在文章正文里标识需要浮窗的字：

```md
这是一个[[长期写作]]入口。
```

页面渲染时只会显示“长期写作”，不会显示 `[[` 和 `]]`。鼠标悬停在这几个字上时，会显示 `posts/tooltips.json` 里对应的短文字。

如果页面显示的文字和配置 key 不一样，可以这样写：

```md
这是一个[[写作入口|长期写作]]。
```

页面显示“写作入口”，浮窗读取 `长期写作` 对应的内容。没有用 `[[...]]` 标出来的词不会自动显示浮窗。

## 首页技能菱形怎么修改

首页技能菱形的数据写在：

- `data/skills.json`

每个技能项包含：

```json
{ "label": "C++", "weight": 10 }
```

`weight` 范围建议保持在 `1` 到 `10`：

- `8-10`：中心大字体
- `4-7`：中间过渡字体
- `1-3`：外围小字体

页面会按 `weight` 连续计算字号，不是只有大/小两个档位。权重越大，越靠近菱形中心，字体也越大。

## 本地预览

因为页面通过 `fetch` 加载 Markdown 文件，不能直接双击 `index.html` 用 `file://` 方式预览。

需要使用页面内编辑、保存、删除以及草稿预览时，在项目目录启动：

```bash
node preview-server.js
```

然后访问 `http://127.0.0.1:8000`。本地服务启动时会自动生成包含全部草稿的文章列表；编辑器的“发布状态”可以在“公开”和“草稿”之间切换。

部署工作流会根据 `data/site-config.json` 的 `publishDrafts` 重新生成文章列表和发布文件，默认不会发布草稿。

## Windows 目录部署与 Windows / WSL 启动方式切换

可以把完整项目（包括 `.git`、`modules/`、`vendor/`）放在 Windows 目录，例如 `C:\others\Docker\blog-by-codex`，用 Windows 的 VS Code 和 Git 正常编辑、提交和管理历史。Docker 挂载这个目录，网页编辑器保存的文件也会写回这里。Windows 无需安装 Node.js、npm 或 Python：当前本地镜像 `blog-by-codex:local` 已包含 Node.js、Git 和共享库。Docker Desktop 使用 Linux 容器及其 WSL 2 后端，但 Windows 启动方式不调用 Ubuntu。

在 **Windows PowerShell** 中执行：

```powershell
Set-Location C:\others\Docker\blog-by-codex
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\switch-local.ps1 -Mode Windows
```

此命令部署博客到 `http://127.0.0.1:8000`，安装 Windows 登录启动项，并取消博客的 WSL 登录启动项。镜像缺失时会报错，不会拉取或自动构建。已有本地镜像可以在 Windows 中直接使用；新机器可通过 `docker save` / `docker load` 转移镜像，或者先按下节在 WSL 中制作一次。

以后切换启动方式，只需在同一 Windows 项目目录执行：

```powershell
# 改为从 Ubuntu 部署，并在登录时使用 WSL 启动项
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\switch-local.ps1 -Mode WSL

# 改回 Windows 直接调用 Docker，并更新登录启动项
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\switch-local.ps1 -Mode Windows
```

两种方式使用同一个容器、同一个 `8000` 端口，以及同一份 Windows 项目文件；WSL 模式默认访问 `/mnt/c/others/Docker/blog-by-codex`。切换不复制文件、不清理工作区、不提交或推送 Git，也不会停止其他项目的容器。WSL 模式需要对应发行版的 Docker Desktop 集成。默认发行版和用户为 `Ubuntu-24.04` / `xiang`，可用 `-Distro`、`-WslUser` 调整。

原来 `/home/xiang/blog_by_codex` 的项目目录可以保留，但切换脚本默认继续使用 Windows 工作区，以免编辑内容分叉。若确需部署另一个 WSL 工作区，可显式传入 `-WslProjectPath /home/xiang/blog_by_codex`；该目录的内容需要自行通过 Git 等方式同步。

只启动服务、暂不更改登录启动方式，可执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-local.ps1
```

Windows 登录启动项为 `BlogByCodexWindows.lnk`，日志为 `%LOCALAPPDATA%\BlogByCodexWindows\startup.log`。要取消 Windows 登录启动，可执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows-startup.ps1 -Remove -Mode Windows
```

停止当前博客可执行 `docker stop blog-by-codex-local-blog-1`。文章和 Git 文件保留，下次登录仍会按已安装的启动项启动。Docker Desktop 的 `Start Docker Desktop when you sign in to your computer` 应保持开启；这是登录启动，不是未登录时的系统服务。

## VS Code 连接博客容器与日志

Windows VS Code 安装微软的 **Dev Containers** 扩展后，按 `F1` 执行 **Dev Containers: Attach to Running Container...**，选择 `blog-by-codex-local-blog-1`，再打开容器内的 `/app`。文件仍写回当前挂载的 Windows 或 WSL 工作区；终端和 Git 在容器中运行。

本地镜像提供 `/bin/sh`、Bash、Tar、Gzip、Curl、基础命令和所需共享库。第一次连接时 VS Code 会安装自己的 Server，安装 Server 或扩展可能联网；博客日常启动及页面渲染仍可离线运行。无需为连接容器下载新的 Docker 镜像。

连接失败时，在 VS Code 按 `F1` 执行 **Dev Containers: Show Container Log**；也可执行 **Developer: Open Logs Folder**，查看当前会话的 `window*/exthost/ms-vscode-remote.remote-containers/remoteContainers-*.log`。Windows 日志根目录通常为 `%APPDATA%\Code\logs`。最后的 `Command failed: ... devContainersSpecCLI.js ...` 是失败摘要，真正错误在它前面的日志中。如果看到 `/bin/sh: no such file or directory`，应重新制作本地镜像并部署，只有重启旧容器不能补齐镜像中的文件。

## Git 备份后在新机器恢复 Docker

完整步骤见 [Git 备份与 Docker 恢复](docs/docker-restore.md)。项目已包含可在 Windows、WSL、Linux 和 macOS 构建的 `Dockerfile`；只需 Git、Docker Linux 容器引擎与 Compose，不要求宿主安装 Node.js。

```sh
git clone https://github.com/bielaiii/blog_by_codex.git
cd blog_by_codex
docker compose build blog
docker compose up -d --no-build --pull never --wait
```

首次构建会下载公共基础镜像和工具包，项目镜像只保留在本机，不上传 Docker Hub 或 GitHub Release。之后启动只使用本地镜像。完全离线时可自行用 `docker image save/load` 保存和恢复镜像；Git 保存环境的构建方法，不保存镜像和 Docker 数据卷。新机器的 LAN/SSH/登录启动需按说明重新配置。

## Mac 通过局域网编辑源码与文章

Mac 浏览器可以直接访问 Windows 的局域网 IP，阅读和编辑文章；VS Code 使用 SSH 公钥认证，直接打开博客容器中的 `/app`。不需要在 Windows 安装 SSH 服务，也不需要 Mac 安装 Docker。

### 浏览器直接访问 IP 与端口

在 Windows 项目目录执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-lan.ps1
```

然后在管理员 Windows PowerShell 中执行一次：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-lan-firewall.ps1 -Service HTTP -Port 8000
```

Mac 直接打开 `http://192.168.0.102:8000/`，无需 SSH 隧道。Windows 本机仍用 `http://127.0.0.1:8000/`。两者都是同一个博客，支持草稿预览、创建、保存和删除文章。Windows 的 IP 变化时使用新地址。

此配置将 HTTP 端口绑定到 `0.0.0.0`，允许局域网访问；防火墙只允许私人网络的本地子网。文章编辑不要求登录，适合信任的家庭局域网。服务器不提供 `.git`、`.local` 等隐藏目录，并拒绝来自其他网站的文章写入请求。配置保存在被 Git 忽略的 `.local/lan.json`，Windows 与 WSL 的部署及登录启动均读取它。镜像仍只使用本地镜像。

关闭局域网 HTTP 访问（保留本机网页与 SSH）：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-lan.ps1 -Disable
# 管理员 PowerShell：
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-lan-firewall.ps1 -Service HTTP -Port 8000 -Remove
```

### VS Code 连接容器源码

镜像构建需要 WSL 已安装 `sshd`、`ssh-keygen` 和 `ssh`。在 Windows 项目中准备 Mac 的 SSH 公钥 `.pub` 文件，然后执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-remote.ps1 -PublicKeyFile C:\path\to\mac.pub
```

它创建被 Git 忽略的 `.local/authorized_keys` 和 `.local/remote.json`，加载 `compose.remote.yaml`，重新部署博客。Windows 与 WSL 的部署和登录启动脚本均读取这份配置。默认 SSH 端口是 `2222`，登录用户是 `blog`，只接受配置中的公钥；可用 `-SshPort` 与 `-BindAddress` 调整。源码目录仍使用原有挂载。SSH 主机密钥与 VS Code Server 保存在 Docker 数据卷 `blog-remote-home` 中，切换启动方式或重新部署会继续使用。

在 **管理员 Windows PowerShell** 中运行一次以下命令，允许私人网络的本地子网访问 SSH 端口：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-lan-firewall.ps1 -Port 2222
```

Mac 的 `~/.ssh/config` 添加以下配置（Windows 当前地址为 `192.168.0.102`，地址变化时更新 `HostName`；也可参考 `scripts/mac-ssh-config.example`）：

```sshconfig
Host blog-windows
    HostName 192.168.0.102
    Port 2222
    User blog
    IdentitiesOnly yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

Mac 使用对应公钥的本地私钥完成认证。先在 Mac 终端执行 `ssh blog-windows` 测试登录。Mac VS Code 安装微软 **Remote - SSH** 扩展后，执行 **Remote-SSH: Connect to Host...**，选择 `blog-windows`，平台选择 Linux，再打开 `/app`。编辑直接写回 Windows/WSL 的项目文件，不需要在 Mac 复制源码或通过 Git 同步。

如果不启用局域网 HTTP，也可以通过 SSH 隧道访问博客。另开一个 Mac 终端并保持以下命令运行：

```sh
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18000:127.0.0.1:8000 blog-windows
```

打开 `http://127.0.0.1:18000/`。此端口位于 Mac 本地，连接经过 SSH 隧道到达博客；按 `Ctrl+C` 关闭隧道。Windows 与 Docker Desktop 需要运行。

关闭 SSH 访问（保留源码、主机密钥和开发环境数据卷；局域网 HTTP 独立配置）：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-remote.ps1 -Disable
# 在管理员 PowerShell 中移除对应防火墙规则：
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-lan-firewall.ps1 -Port 2222 -Remove
```

## WSL 目录部署与本地镜像制作

项目现在支持在 Docker Desktop 的 WSL 2 后端运行本地预览服务，保留编辑、保存、删除和草稿预览。浏览器访问 `http://127.0.0.1:8000`；默认只绑定本机回环地址，启用上述局域网配置后也可通过 IP 访问。项目目录挂载到容器中的 `/app`，保存文章会直接写回 WSL 的项目文件，修改前端后刷新页面即可生效。

先在 Docker Desktop 中确认：

- `Settings → General → Start Docker Desktop when you sign in to your computer` 已开启。
- 使用 WSL 2 后端和 Linux 容器，并在 `Settings → Resources → WSL Integration` 中启用项目所在发行版，例如 `Ubuntu-24.04`。

在 WSL 项目目录中首次执行：

```bash
bash scripts/build-local-image.sh
bash scripts/deploy-local.sh
```

构建脚本把 WSL 已安装的 Node.js、Git、Bash、基础命令、CA 证书及其共享库打包导入本地镜像 `blog-by-codex:local`，需要 Linux/WSL 中已有这些工具以及 `python3` 和 `ldd`。这些组件同时支持博客运行和 VS Code Dev Containers 连接。不下载基础镜像、不访问软件包仓库，也不上传项目；镜像仅包含工具，项目通过目录挂载提供。容器配置使用 `pull_policy: never`，部署命令也禁止拉取与构建；镜像不存在时会明确报错。升级 WSL 的 Node.js 或 Git 后，可重新执行以上两条命令更新运行镜像。

如果 WSL 中安装了 `clang-format`，构建时也会将它加入镜像；否则编辑器的代码格式化会保留代码并返回提示。字体、Markdown、代码高亮、Mermaid 和 KaTeX 均随项目放在 `vendor/` 中，页面启动和渲染不依赖 CDN。文章里的外链图片或链接仍可能需要联网。

完整浏览器检查可在已有 Chromium/Chrome 的 WSL 环境执行：

```bash
node scripts/check-browser.mjs
```

脚本使用 Node.js 22+，自动查找 Playwright 缓存中的 Chromium；也可以设置 `CHROME_PATH` 指向浏览器程序。它会阻止所有外部 HTTP 请求，检查首页、栏目切换、文章阅读、主题切换、公式、代码高亮、Mermaid、Snippet，以及临时草稿的保存和删除。维护时重新下载浏览器依赖可执行 `python3 scripts/vendor-assets.py`；日常部署无需执行此脚本。

安装 Windows 登录启动，在 **Windows PowerShell** 执行（按自己的发行版、用户名和项目路径调整）：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "\\wsl.localhost\Ubuntu-24.04\home\xiang\blog_by_codex\scripts\windows-startup.ps1" -Install -Distro "Ubuntu-24.04" -WslUser "xiang" -ProjectPath "/home/xiang/blog_by_codex"
```

安装器会将启动脚本和配置复制到 `%LOCALAPPDATA%\BlogByCodex`，并在当前用户的 Windows 启动目录创建 `BlogByCodex.lnk`。登录后等待 Docker Desktop 就绪，启动 WSL 并执行本地部署；不需要手动打开 WSL 终端。日志写入 `%LOCALAPPDATA%\BlogByCodex\startup.log`。这是登录后的自动启动，不是未登录时的 Windows 系统服务。

`restart: unless-stopped` 同时负责容器异常退出或 Docker 重启后的恢复。登录启动脚本还会再次执行 `compose up`，因此即使上次手动停止了容器，下次登录也会重新启动。要取消登录启动，在 PowerShell 执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\BlogByCodex\windows-startup.ps1" -Remove
```

然后在 WSL 项目目录执行 `docker compose down` 停止并删除项目容器；文章文件保留在项目目录。查看运行状态或日志可执行 `docker compose ps` 和 `docker compose logs --tail=50`。如果刚启用 WSL 集成后出现 Docker socket 权限错误，可重新打开 WSL 终端；部署脚本也支持回退到 Windows 的 `docker.exe`。

默认镜像名和端口分别为 `blog-by-codex:local` 与 `8000`。可在 WSL 中使用 `BLOG_IMAGE`、`BLOG_PORT` 覆盖；如需登录启动也使用这些设置，在项目根目录创建 Compose 的 `.env` 文件。自定义镜像必须包含 `/usr/local/bin/node`、`git` 及所需共享库。

本地部署不会触发 GitHub Pages。仓库现有的 GitHub Pages workflow 仍会在推送到 `master` 时发布；只做本地部署无需推送。

## 编辑器 Snippet

Snippet 保存在项目根目录的 `snippets/` 文件夹中。本地预览服务会递归读取其中所有 `.json` 文件，刷新编辑页即可加载新内容。

有三种使用方式：

- 在编辑区的普通正文位置输入 `/`，打开包含 Markdown 与自定义 Snippet 的智能提示；输入 `\/` 可插入普通斜杠而不唤醒。
- 点击编辑器工具栏的 `Snippet` 按钮。
- 按 `Ctrl + Shift + P`；macOS 使用 `Command + Shift + P`。
- 在编辑区输入 prefix（例如 `align`）后按 `Tab` 直接展开。

插入后，使用 `Tab` 和 `Shift + Tab` 在 `${1}`、`${2}` 等占位符之间移动，`${0}` 是最后的光标位置。

编辑器会自动补全 `()`、`[]`、`{}`、`<>`、引号、反引号和 `$...$`，并把光标放在符号中间。选中文本后输入左侧符号会包裹选区；在空符号对中按退格会同时删除两侧。符号前有奇数个反斜杠时不会自动补全。

格式示例：

```json
{
  "Align equations": {
    "prefix": ["align", "eqalign"],
    "description": "插入可对齐的多行 LaTeX 公式",
    "body": [
      "\\begin{align}",
      "${1:left} &= ${2:right} \\\\",
      "${3:left} &= ${4:right}",
      "\\end{align}",
      "${0}"
    ]
  }
}
```

## 部署到 GitHub Pages

1. 把项目推送到 GitHub 仓库。
2. 打开仓库的 `Settings` -> `Pages`。
3. 在 `Build and deployment` 中选择：
   - `Source`: `Deploy from a branch`
   - `Branch`: 你的主分支，例如 `main` 或 `master`
   - `Folder`: `/ (root)`
4. 保存后等待 GitHub Pages 发布完成。

## 如何让我读取 LaTeX 简历

把你的简历文件放到项目里，建议使用以下路径：

- `resume/source/resume.tex`
- `resume/source/resume.pdf`（可选，用于对照版式）

然后告诉我这两个文件路径，我就可以：

1. 读取 LaTeX 内容并提取简历结构
2. 在网页端复刻关键布局与层级
3. 把第一栏 `个人简历` 填成正式版本

如果你不想移动原文件，也可以直接把 `.tex` 内容贴给我。
