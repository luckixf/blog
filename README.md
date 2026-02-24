# Astro Doge

一个简洁轻量的 Astro 博客主题。

基于 [Astro](https://astro.build) 和 [Tailwind CSS v4](https://tailwindcss.com) 构建，零 JS 框架依赖，开箱即用。

## 预览

![Astro Doge](./preview.webp)

## 特性

- **静态优先** — 默认输出纯静态文件，部署到任何平台
- **暗色模式** — 亮色 / 暗色 / 跟随系统，无闪烁切换
- **文章系统** — Markdown / MDX 支持，阅读时间、字数统计、相关文章推荐
- **碎碎念** — 轻量短内容，显示相对时间和精确时间戳，类似微博/推文
- **评论系统** — 基于 GitHub Issues 的自建评论，支持表情、Markdown、嵌套回复
- **留言板** — 独立留言页面，复用评论组件
- **全站搜索** — `Ctrl+K` 打开，支持模糊搜索和搜索历史
- **代码高亮** — 基于 Expressive Code，支持代码块标题、行高亮
- **GitHub Alerts** — 支持 `[!NOTE]` `[!WARNING]` 等提示框语法
- **标题锚点** — hover 标题显示 `#` 锚点，点击复制直链
- **图片灯箱** — 点击文章图片放大查看
- **目录导航** — 长文自动生成侧边目录
- **友链页面** — 内置友链交换信息面板
- **PWA** — Service Worker + Web App Manifest
- **SEO** — 自动生成 sitemap、robots.txt、RSS、Open Graph meta
- **外链标识** — 外部链接自动追加 `↗` 标记

## 快速开始

### 1. 获取源码

```bash
git clone https://github.com/dogxii/astro-doge.git my-blog
cd my-blog
```

### 2. 安装依赖

推荐使用 [Bun](https://bun.sh)，npm / pnpm / yarn 也可以：

```bash
bun install
```

### 3. 启动开发服务器

```bash
bun dev
```

浏览器打开 `http://localhost:4321` 即可预览。

### 4. 修改配置

**`astro.config.mjs`** — 修改 `site` 为你的域名，`allowHostnames` 控制哪些域名不被标记为外链：

```js
export default defineConfig({
  site: 'https://your-domain.com/',
  // ...
  markdown: {
    remarkPlugins: [
      // ...
      [remarkExternalLinks, { allowHostnames: ['your-domain.com'] }],
    ],
  },
})
```

**`src/consts.ts`** — 修改站点名称、邮箱、描述等：

```ts
export const SITE: Site = {
  NAME: '你的站名',
  EMAIL: 'you@example.com',
  DESCRIPTION: '你的博客描述.',
  // ...
}
```

同文件中还有 `PROJECTS`、`TECH_STACK`、`SOCIALS` 等常量，按需修改。

**`src/components/Header.astro`** — 导航栏链接

**`src/components/Footer.astro`** — 底部版权信息

## 内容管理

### 写文章

```bash
bun new:blog my-first-post
```

或手动在 `src/content/posts/` 下创建 `.md` 文件：

```md
---
title: 文章标题
description: 文章描述
date: 2025-01-01T12:00:00+08:00
slug: my-first-post
draft: false
---

正文内容。
```

| 字段          | 类型          | 说明                         |
| ------------- | ------------- | ---------------------------- |
| `title`       | string        | 文章标题                     |
| `description` | string        | 文章描述                     |
| `date`        | ISO 8601      | 发布时间                     |
| `slug`        | string (可选) | 自定义 URL，不填则使用文件名 |
| `draft`       | boolean       | `true` 时不会被构建          |

### 写碎碎念

```bash
bun t
```

也可以直接带上内容：

```bash
bun t random-name "今天天气不错"
```

或手动在 `src/content/thoughts/` 下创建 `.md` 文件：

```md
---
date: 2025-01-01T10:00:00+08:00
draft: false
tags:
  - dev
---

今天又学到了一个新东西。
```

碎碎念页面会自动按时间倒序排列，显示相对时间、星期、日期和精确到小时分钟的时间戳。

## 评论系统

主题内置了一套基于 **GitHub Issues** 的评论系统。评论数据存储在你指定的 GitHub 仓库的 Issues 中，通过 serverless API 进行读写。

### 创建评论仓库

1. 在 GitHub 上创建一个**公开仓库**（例如 `my-blog-comments`），专门存放评论
2. 空仓库即可，不需要初始化内容

### 创建 GitHub Token

1. 前往 [GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. 点击 **Generate new token**
3. 在 **Repository access** 中选择 **Only select repositories**，选中评论仓库
4. 在 **Permissions** 中，给 **Issues** 设置 **Read and write** 权限
5. 生成并复制 Token

### 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
# GitHub 评论仓库配置
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=your-github-username
GITHUB_REPO=my-blog-comments

# 博主身份验证
OWNER_NAME=你的名字
OWNER_EMAIL=you@example.com
OWNER_TOKEN=your-secret-token
```

| 变量           | 说明                                   |
| -------------- | -------------------------------------- |
| `GITHUB_TOKEN` | Fine-grained Token，用于读写 Issues    |
| `GITHUB_OWNER` | 评论仓库所属的 GitHub 用户名或组织名   |
| `GITHUB_REPO`  | 评论仓库名称                           |
| `OWNER_NAME`   | 博主名称，评论使用此名字时触发身份验证 |
| `OWNER_EMAIL`  | 博主邮箱，同上                         |
| `OWNER_TOKEN`  | 博主验证口令，用于在前端证明博主身份   |

> `.env` 已在 `.gitignore` 中。部署到 Vercel/Netlify 等平台时，需要在平台的环境变量设置中添加这些变量。

### 部署 API 端点

评论系统需要两个 API 端点（`/api/comments` 和 `/api/submit-comment`），因此需要 **SSR** 支持。将 `output` 改为 `server` 或 `hybrid`，并安装对应 adapter：

```bash
bun add @astrojs/vercel
# 或 @astrojs/netlify / @astrojs/cloudflare
```

```js
// astro.config.mjs
import vercel from '@astrojs/vercel'

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  // ...
})
```

然后在 `src/pages/api/` 下实现 `comments.ts` 和 `submit-comment.ts`，使用 GitHub REST API 读写 Issues。

> 如果不需要评论功能，删除 `src/components/Comments.astro`，并移除文章页和留言板页中对它的引用即可。

### 碎碎念在线发布（/thoughts/new）

主题提供了一个网页端碎碎念编辑器，访问 `/thoughts/new` 即可使用，支持实时 Markdown 预览和标签选择。

使用前需要配置环境变量 `THOUGHT_API_TOKEN`（自定义密钥字符串），在页面的 API Token 输入框中填入即可。Token 会保存在浏览器本地。

编辑器调用 `/api/add-thought` 接口，通过 GitHub API 将内容提交到仓库，因此同样需要 SSR 模式和 `GITHUB_TOKEN`、`GITHUB_OWNER` 等环境变量。

> 如果不需要在线发布功能，删除 `src/pages/thoughts/new.astro` 即可，用 `bun t` 在本地创建碎碎念。

### 博主身份验证（Owner Token）

当有人用和博主相同的名称或邮箱发表评论时，前端会弹出输入框要求输入 `OWNER_TOKEN`。验证通过后评论旁显示「博主」标识，Token 会缓存在浏览器 `localStorage` 中。

## 留言板

留言板（`src/pages/messages/`）是一个固定 `slug` 为 `messages` 的评论区，复用评论组件。留言板正常工作的前提是评论系统已配置好。

不需要留言板的话，直接删除 `src/pages/messages/` 目录并移除 `Header.astro` 中的导航链接。

## 构建与部署

### 纯静态部署（默认）

```bash
bun run build
```

构建产物在 `dist/` 目录，可以部署到任何静态托管服务：

- [Vercel](https://vercel.com)
- [Netlify](https://netlify.com)
- [Cloudflare Pages](https://pages.cloudflare.com)
- [GitHub Pages](https://pages.github.com)

> 纯静态模式下评论系统不可用。如需评论和留言板功能，请使用 SSR 模式。

### SSR 部署

安装 adapter 并修改 `astro.config.mjs`（见上方评论系统章节），在部署平台添加环境变量后部署。

详细参考 [Astro 部署文档](https://docs.astro.build/en/guides/deploy/)。

## 项目结构

```
├── public/              # 静态资源
│   ├── fonts/           # 字体文件
│   ├── icons/           # PWA 图标
│   ├── favicon.ico
│   ├── manifest.json
│   └── sw.js
├── scripts/             # 辅助脚本
│   ├── new-blog.ts      # 快速创建文章
│   └── new-thought.ts   # 快速创建碎碎念
├── src/
│   ├── components/      # Astro 组件
│   ├── content/         # 内容集合
│   │   ├── posts/       # 文章
│   │   └── thoughts/    # 碎碎念
│   ├── data/            # 数据文件（表情配置等）
│   ├── layouts/         # 页面布局
│   ├── lib/             # 工具函数、remark/rehype 插件
│   ├── pages/           # 页面路由
│   │   └── api/         # API 端点（评论系统）
│   ├── styles/          # 全局样式
│   ├── consts.ts        # 站点常量配置
│   └── types.ts         # TypeScript 类型定义
├── .env                 # 环境变量（不提交）
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## 自定义

### 换配色

全局样式在 `src/styles/global.css`，配色基于 Tailwind 的 `stone` 色系。想换色系的话，全局替换 `stone` 为 `zinc`、`slate`、`neutral` 等即可。

### 删除不需要的页面

直接删除 `src/pages/` 下对应的目录，然后在 `src/components/Header.astro` 中移除导航链接。

### PWA

修改 `public/manifest.json` 中的 `name`、`short_name`、`icons` 等字段来自定义 PWA 信息。`public/sw.js` 中可以调整缓存策略。

## 环境变量汇总

| 变量                | 必需        | 说明                          |
| ------------------- | ----------- | ----------------------------- |
| `GITHUB_TOKEN`      | 评论/碎碎念 | GitHub Fine-grained Token     |
| `GITHUB_OWNER`      | 评论/碎碎念 | GitHub 用户名或组织名         |
| `GITHUB_REPO`       | 评论        | 评论仓库名称                  |
| `OWNER_NAME`        | 评论        | 博主名称（身份验证用）        |
| `OWNER_EMAIL`       | 评论        | 博主邮箱（身份验证用）        |
| `OWNER_TOKEN`       | 评论        | 博主验证口令                  |
| `THOUGHT_API_TOKEN` | 碎碎念      | 在线发布碎碎念的 API 验证密钥 |

标注为「评论」的变量在使用评论/留言板功能时需要配置，标注为「碎碎念」的在使用在线发布功能（`/thoughts/new`）时需要配置。纯静态 + 本地写作的方式不需要任何环境变量。

## 技术栈

- [Astro](https://astro.build) — 内容驱动的 Web 框架
- [Tailwind CSS v4](https://tailwindcss.com) — 实用优先的 CSS 框架
- [Expressive Code](https://expressive-code.com) — 代码块渲染
- [MDX](https://mdxjs.com) — 在 Markdown 中使用组件

## 致谢

主题设计受 [astro-nano](https://github.com/markhorn-dev/astro-nano) 启发。

## License

[MIT](./LICENSE)
