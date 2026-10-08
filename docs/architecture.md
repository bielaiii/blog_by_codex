# 架构与写入约定

浏览器使用原生 ES 模块，发布结果仍是静态文件。Node.js 预览服务额外提供本地写作 API；公开站点不包含这个服务。

## 内容来源

- `posts/*.md`：文章正文和 frontmatter，是标题、摘要、日期、标签、栏目、布局及发布状态的来源。
- `posts/projects/*.json`：可选项目展示数据，由 frontmatter 的 `visual` 字段引用。阅读页和预览都会展示项目图示与 Markdown 正文。
- `shared/post-model.mjs`：浏览器、生成器、编辑器和命令行工具共用的解析、校验、序列化、草稿模板及布局标记规则。支持字符串、布尔值和行内字符串数组；不支持完整 YAML 的嵌套对象或多行值。
- `data/catalog.json`：派生快照，包含文章索引、日期元数据和全文搜索文本。一次读取即可取得同一版本的数据。`data/posts.json` 和 `data/post-metadata.json` 保留为兼容导出，不应手动编辑。

文章身份始终是文件名（去掉 `.md`），大小写和下划线都保留。只在创建文章时生成和去重 slug；更新、删除必须精确命中已有文件。frontmatter 中的可选 `slug` 必须与文件名一致，不能用它隐式重命名文章。

## 前端职责

`app.js` 协调启动和页面切换；`router.js`、`state.js` 管理导航与临时状态；`archive-view.js` 管理列表、分页与标签筛选；`welcome-view.js` 管理首页可视化；`toc-view.js` 管理目录；`project-view.js` 管理项目图示。

`article-renderer.js` 是阅读页与编辑预览共用的渲染流程，调用 `markdown.js` 处理 Markdown、两列布局和公式，再处理高亮、术语提示、代码块、资源路径和 Mermaid。Mermaid 操作排队执行；每个视图和预览拥有取消信号，过期的异步结果不能继续更新 DOM。离开编辑器时清理预览任务和 ResizeObserver。编辑器导航会检查未保存内容。

全文搜索使用生成快照里的搜索文本，输入有短暂防抖，不会为每个字符重新请求所有正文。关键文章索引加载失败时明确显示错误；不会显示硬编码的过期示例文章。

## 写入与冲突

`scripts/lib/post-service.mjs` 负责创建、读取、更新和删除；HTTP 和 `new-post.js` 共用它。创建请求必须明确提供布尔值 `draft`。更新、删除必须提供读取时取得的 SHA-256 `version`；缺少版本返回 428，内容已改变返回 409，原文不被覆盖。

所有写入和生成器通过 `.local/content.lock` 串行处理，多个进程也使用同一把锁。服务先计算并校验下一版索引，再保存事务日志和写入文件。文章及索引通过临时文件和重命名替换；统一快照最后提交。提交失败会恢复文章和索引；下次启动或写入会恢复未提交的事务。已提交快照中的操作 ID 可避免恢复过程撤销成功的写入。锁拥有者退出后可以清理遗留锁。

保存接口直接返回新的快照和文章版本，编辑器不需要再次请求两个索引才能确认保存成功。未经这些工具的文件编辑不会取得锁，但后续版本校验可以发现正文变化；手动修改后应重新生成索引。

## 编辑权限

直接运行 Node 服务，从本机回环地址访问时可编辑。局域网读者默认只读，草稿不会进入其索引，也不能直接下载草稿正文。设置 `BLOG_LAN_EDITOR=true` 后可通过编辑口令解锁；Docker 的本机端口转发可能也需要口令。设置 `BLOG_EDITOR_ENABLED=false` 关闭全部写入能力。

服务生成 `.local/editor-token`，权限为 0600，也可用 `BLOG_EDITOR_TOKEN` 指定至少 24 个字符的口令。口令验证后设置 HttpOnly、SameSite=Strict 会话 Cookie，12 小时或服务重启后失效。页面能力声明与写入接口使用同一套权限判断。跨站请求及非允许的 Host 会被拒绝；自定义域名可通过 `BLOG_ALLOWED_HOSTS` 指定（逗号分隔）。本机回环地址的直接调用者属于受信任作者，服务不应部署成公网写作后台。

## 发布资源

`build-site.js` 从 Markdown 源文件生成公开索引，不受本地草稿预览索引影响。它收集 Markdown 图片、普通和引用式附件链接、HTML 的 `src`、`href`、`poster` 和 `srcset`；CSS/SVG/HTML 资源的依赖也会继续收集。资源必须位于 `assets/` 或 `posts/`，不得越出项目目录或引用未发布的 Markdown。相对路径按引用文件所在目录解释，阅读和预览按同样规则解析。缺失资源使检查和发布失败。

发布目录先在临时目录完成，再整体重命名。只复制前端、公共内容及其依赖，不包含写入服务、私有配置、口令或未发布文章的索引和搜索文本。

## 验证

```bash
node scripts/generate-posts.js
node scripts/check-site.js
node --test tests/architecture.test.mjs
node scripts/check-browser-suite.mjs
```

最后一项需要 Chromium/Chrome（自动查找 Playwright 缓存，也可设置 `CHROME_PATH`）。回归使用临时项目副本，检查本机编辑、口令解锁和静态站点子路径；不会改动现有文章。
