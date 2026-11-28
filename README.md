# Luckixf 的博客

在某个不知名角落里的博客小站。记录土木学习、编程尝试和生活片段。

[访问博客](https://blog.luckixf.top/) · [文章](https://blog.luckixf.top/posts) · [碎碎念](https://blog.luckixf.top/thoughts) · [RSS](https://blog.luckixf.top/rss.xml)

## 设计与技术

页面设计参考 [Astro Theme Pure](https://github.com/cworld1/astro-theme-pure)，采用居中个人简介、简洁文章归档和深浅色主题。本站使用 Astro 6 + Tailwind CSS 4，是在已有博客上进行的独立适配，并未直接安装完整的 astro-pure 主题。

图片预览使用与 Pure 相同的 [medium-zoom](https://github.com/francoischalifour/medium-zoom)，随站点打包。文章、碎碎念、RSS、评论和在线发布沿用本站的内容结构与接口。

## 功能

- Markdown / MDX 文章、按年份归档、目录、代码高亮与复制。
- 碎碎念分页、图片预览、标签、历史编号链接。
- 全站本地搜索，支持 Ctrl / Command + K 和键盘选择。
- 浅色、深色、跟随系统主题，手机导航和屏幕安全区适配。
- 图片懒加载、慢网/失败提示、手动重试与查看原图。
- RSS、sitemap、SEO 元数据及 PWA 离线回退。
- Vercel 上的 GitHub 评论、留言板、点赞和在线发布。

## 本地开发

需要 Node.js 22.12+（推荐 Node.js 24 LTS）和 Bun。

```bash
git clone https://github.com/luckixf/blog.git
cd blog
bun install
bun dev
```

打开终端显示的本地地址，默认是 http://localhost:4321。

```bash
bun run build           # 类型检查与生产构建
bun run verify:content  # 验证文章地址、碎碎念、RSS、搜索与内部资源
bun run verify:media    # 验证 Markdown / HTML 图片属性及原始地址
bun run verify:sw       # 验证离线、超时与缓存行为
bun run preview         # 预览构建产物
```

手机通过同一局域网预览时使用 `bun run dev:network`。

## 写作与配置

文章位于 `src/content/posts/`，碎碎念位于 `src/content/thoughts/`，支持按年月组织文件。

```bash
bun new:blog my-first-post
bun t random-name "今天天气不错"
```

文章头部示例：

```yaml
---
title: 我的文章
description: 一段摘要
date: 2026-11-28T09:00:00+08:00
slug: my-first-post
draft: false
---
```

已发布文章继续使用原有 slug。碎碎念的 `draft: true` 内容不会公开。

| 文件                            | 用途                                   |
| ------------------------------- | -------------------------------------- |
| `src/consts.ts`                 | 博客名称、邮箱、社交链接、项目、技术栈 |
| `src/site.config.ts`            | 头像、个人介绍、导航                   |
| `src/pages/about/index.astro`   | 关于我和关于本站                       |
| `src/pages/friends/index.astro` | 友链和交换信息                         |
| `src/styles/global.css`         | 全站样式及移动端布局                   |
| `astro.config.mjs`              | 站点域名、Markdown 与构建配置          |
| `public/manifest.json`          | PWA 安装信息                           |

图片可以使用 Markdown 或原有 HTML。构建阶段为正文图片添加懒加载与异步解码，并限制其宽度不超过容器。图床仍使用原地址，慢网时可以重试或打开原图；本站不依赖未配置的第三方图片代理。

## 部署

推荐将 [luckixf/blog](https://github.com/luckixf/blog) 连接到 Vercel，构建命令为 `bun run build`，静态输出目录为 `dist`。仓库根目录的 `api/` 与 `vercel.json` 提供动态功能。

本地 `astro dev` / `astro preview` 及纯静态托管不会运行这些 Serverless API；此时评论、点赞、在线发布不可用。动态能力需要保留原部署环境中的 GitHub 仓库、访问令牌等配置，见 [.env.example](./.env.example)、[Vercel 部署指南](./docs/deploy-vercel.md) 和 [API 说明](./docs/api-contract.md)。

主题适配与维护记录见 [页面适配说明](./docs/pure-redesign.md)。

## 致谢与许可

- 当前页面设计参考：[Astro Theme Pure](https://github.com/cworld1/astro-theme-pure)（Apache-2.0）。
- 本站最初基于 [Astro Doge](https://github.com/dogxii/astro-doge)，保留其内容与接口基础；原主题演化自 [astro-nano](https://github.com/markhorn-dev/astro-nano)。
- 碎碎念和留言板的早期交互参考了 [Viki](https://github.com/vikiboss/blog)。
- 图片缩放：[medium-zoom](https://github.com/francoischalifour/medium-zoom)（MIT）。

本站代码沿用 [MIT License](./LICENSE)。文章、个人资料和图片属于各自作者，复用代码时请替换为自己的内容。
