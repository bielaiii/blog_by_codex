# Markdown 与代码高亮的展示示例

这是一篇专门用来做展示测试的文章，方便确认博客的排版是否稳定。

## 列表

- 无序列表适合记要点
- 有序列表适合写步骤
- 行距应该足够舒展，但不能过松

## 引用

> 好的博客设计不会抢内容的注意力，但也不能弱到没有个性。

## 表格

| 能力 | 当前支持 |
| --- | --- |
| Markdown 文章 | 支持 |
| 时间线列表 | 支持 |
| 代码高亮 | 支持 |
| GitHub Pages 部署 | 支持 |

## 代码块

```ts
type Post = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  file: string;
};

function sortPosts(posts: Post[]) {
  return posts.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}
```

## 内联代码

比如 `posts/` 用来存文章，`#slug` 用来切换路由，`highlight.js` 用来处理高亮。
