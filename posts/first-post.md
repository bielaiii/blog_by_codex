---
title: "把个人博客搭成一个长期写作入口"
date: "2026-03-28"
summary: "从结构、样式和部署方式出发，建立一个能长期维护的静态博客。文章归档页先显示标题和预览，点进去再阅读完整内容。"
tags: ["博客", "GitHub Pages", "Markdown"]
tab: "articles"
layout: "single"
draft: false
---

# 把个人博客搭成一个[[长期写作]]入口

如果博客只是一个展示页，它通常会停在“做完”的状态；如果博客是一个稳定的写作入口，它才更容易持续更新。

这次的目标很明确：

- 可以直接托管在 GitHub Pages
- 首页按时间线展示文章
- 文章本身使用 Markdown 编写
- 代码块有正常高亮
- 风格克制，但不能显得模板化

## 为什么选纯静态

这个项目没有引入额外的构建工具，部署成本会更低。你只需要把仓库推到 GitHub，然后开启 Pages，就可以直接访问。

对于个人博客来说，这种方案的优点很实际：

1. 结构简单，迁移方便
2. 没有服务端维护成本
3. 文章就是普通 Markdown 文件
4. 以后改成别的生成器也容易

## 时间线首页的作用

我不希望首页只是机械地列卡片。时间线更像写作历史，它天然适合博客这种“持续产生内容”的场景。

> 当文章数量变多后，时间线仍然能保持清晰的浏览顺序。

## 一段代码示例

```js
const publish = async (post) => {
  const response = await fetch(post.file);
  const markdown = await response.text();
  return marked.parse(markdown);
};
```

后续你只需要继续往 `posts/` 目录里增加文章，在文章开头的 frontmatter 中填写元信息，再运行生成脚本，就能把博客持续写下去。
