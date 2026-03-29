# GitHub Pages 个人博客

这是一个纯静态个人博客模板，适合直接托管到 GitHub Pages。

## 当前结构

- 顶部是 `个人简历 / 分享文章 / 项目` 三个 tab
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

然后在 [C:\Users\amino\Documents\New project\app.js](C:\Users\amino\Documents\New project\app.js) 里的 `posts` 数组增加一条：

```js
{
  slug: "my-new-post",
  tab: "resume",
  title: "我的新文章",
  date: "2026-03-28",
  summary: "这里写归档页显示的预览文字，建议 2 到 3 行长度。",
  tags: ["随笔", "设计"],
  file: "posts/my-new-post.md"
}
```

## 如何归档到不同栏目

由 `tab` 字段控制：

- `tab: "resume"`：归档到 `个人简历`
- `tab: "articles"`：归档到 `分享文章`
- `tab: "projects"`：归档到 `项目`

如果你说的“归档到个人文章中”是默认个人文章区，就把它写成 `tab: "resume"`。

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

## 本地预览

因为页面通过 `fetch` 加载 Markdown 文件，不能直接双击 `index.html` 用 `file://` 方式预览。

如果你继续使用 WSL2，可以在项目目录启动：

```bash
python3 -m http.server 8001
```

然后访问 `http://127.0.0.1:8001`。

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


