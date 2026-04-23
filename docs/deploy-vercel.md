# Deploy To Vercel

这份模板默认是静态站点，但仓库根目录已经带了 `api/` 和 `vercel.json`，所以可以直接部署到 Vercel，开启评论、留言板、碎碎念点赞和 `/thoughts/new` 在线发布。

## 适合什么场景

- 你想保留 Astro 静态构建体验
- 你不想自己额外写后端
- 你接受把评论和点赞数据存进 GitHub

如果你只需要纯静态博客，不必看这篇文档，直接部署 `dist/` 即可。

## 1. 准备 GitHub 仓库

你可以用一套仓库存所有数据，也可以拆开：

- `COMMENTS_REPO`
  评论和留言板使用的仓库，推荐单独建一个
- `LIKES_REPO`
  点赞数据仓库，可选；不配时会回退到 `COMMENTS_REPO`，再回退到 `GITHUB_REPO`
- `CONTENT_REPO`
  `/thoughts/new` 在线发布写入的内容仓库
- `GITHUB_REPO`
  通用回退仓库。如果你想最省事，可以只配它

所有仓库变量都使用 `owner/repo` 格式。

## 2. 创建 GitHub Token

推荐使用 Fine-grained Personal Access Token。

至少给对应仓库这些权限：

- `Issues: Read and write`
  评论、留言板、点赞数据需要
- `Contents: Read and write`
  `/thoughts/new` 在线发布需要

如果评论仓库、点赞仓库、内容仓库不是同一个，记得在 Token 的仓库范围里全部选上。

## 3. 在 Vercel 配置环境变量

最少需要：

| 变量                | 必填 | 说明                                     |
| ------------------- | ---- | ---------------------------------------- |
| `SITE_URL`          | 是   | 线上站点地址，例如 `https://example.com` |
| `GITHUB_TOKEN`      | 是   | 上一步创建的 Token                       |
| `THOUGHT_API_TOKEN` | 否   | 只在启用 `/thoughts/new` 时需要          |

按功能补充：

| 功能                   | 变量                                                      |
| ---------------------- | --------------------------------------------------------- |
| 评论 / 留言板          | `COMMENTS_REPO` 或 `GITHUB_REPO`                          |
| 点赞                   | `LIKES_REPO` 或 `COMMENTS_REPO` 或 `GITHUB_REPO`          |
| 在线发布碎碎念         | `CONTENT_REPO` 或 `GITHUB_REPO`                           |
| 博主身份校验           | `OWNER_NAME`、`OWNER_EMAIL`、`OWNER_TOKEN`                |
| 前端提示博主输入 token | `PUBLIC_OWNER_NAME`，以及可选的 `PUBLIC_OWNER_EMAIL`      |
| 时区与内容目录         | `SITE_TIMEZONE`、`CONTENT_BRANCH`、`THOUGHTS_CONTENT_DIR` |

如果你想先跑通最小配置，常见做法是：

```env
SITE_URL=https://your-domain.com
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxx
GITHUB_REPO=yourname/blog-data
CONTENT_REPO=yourname/your-blog
THOUGHT_API_TOKEN=replace-this-with-a-random-secret
OWNER_NAME=Your Name
OWNER_EMAIL=you@example.com
OWNER_TOKEN=replace-this-with-another-secret
PUBLIC_OWNER_NAME=Your Name
SITE_TIMEZONE=Asia/Shanghai
```

## 4. 导入到 Vercel

1. 在 Vercel 导入你的博客仓库
2. Framework Preset 选择 `Astro`
3. 保持默认 Build Command 为 `bun run build` 或让 Vercel 自动识别
4. 把上面的环境变量填进去
5. 部署

模板已经自带 [vercel.json](../vercel.json)，无需再手动补 `api/` 路由配置。

## 5. 部署后检查

优先确认这几项：

- 首页和文章页能正常静态访问
- `https://your-domain.com/api/add-thought` 能返回 JSON
- 留言板页面可以正常加载评论区
- 碎碎念页点赞按钮点击后能更新状态
- `/thoughts/new` 输入正确 token 后可以创建新文件

## 常见问题

### 评论区显示“接口已部署但环境变量未配置完成”

通常是这些问题之一：

- `GITHUB_TOKEN` 没配
- `COMMENTS_REPO` / `GITHUB_REPO` 没配
- 仓库格式不是 `owner/repo`
- Token 没有对应仓库的 `Issues` 写权限

### `/thoughts/new` 提示 token 无效

先确认：

- Vercel 中的 `THOUGHT_API_TOKEN` 已配置
- 页面里输入的 token 与环境变量完全一致
- `CONTENT_REPO` 或 `GITHUB_REPO` 已配置
- Token 对内容仓库有 `Contents: Read and write`

### 点赞按钮提示“接口尚未配置完成”

说明 `api/likes.ts` 已经部署，但：

- `GITHUB_TOKEN` 未配置，或
- `LIKES_REPO` / `COMMENTS_REPO` / `GITHUB_REPO` 都没配，或
- Token 没有对应仓库的 `Issues` 权限

## 不用 Vercel 可以吗

可以。

如果你只是想保留前端页面，把动态能力接到你自己的服务上，直接按 [API Contract](./api-contract.md) 实现相同接口即可。
