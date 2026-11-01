# Pure 风格页面重构

本项目保留 Astro 6 + Tailwind CSS 和已有内容系统，按照 Astro Theme Pure 的视觉方向重构。没有直接安装 astro-pure，也没有将站点替换为官方演示站。

## 保留的内容与地址

- 原有 11 篇文章、64 条碎碎念及全部正文、日期和图片引用。其中 63 条碎碎念公开，1 条维持草稿状态。
- 文章继续使用原有 slug，地址仍为 /{slug}。
- 碎碎念继续使用 /thoughts#编号，目录和分页加载保持兼容。
- 原域名、邮箱、GitHub、头像、个人介绍、友链、项目及技术栈链接。
- /posts、/thoughts、/thoughts/new、/friends、/messages、/about、/rss.xml。
- 原有 GitHub 评论、留言、点赞、在线发布 API 和 Vercel 配置，环境变量不变。

## 新的页面结构

- 居中头像与个人简介、最近文章、最近动态。
- 蓝灰色点缀、清晰的字号层级、统一留白和浅色/深色/跟随系统模式。
- 原生 dialog 搜索，支持 Ctrl/Command + K、键盘导航、搜索历史。
- 手机导航、文章目录、图片灯箱、代码块深浅主题和复制按钮。
- 移除旧页面中的壁纸、浮动装饰及手写字体引用；旧静态资源仍保留在 public 中。
- 安装到桌面的 PWA 名称改为真实博客名，并更新缓存版本。

## 日常维护

- 原来的站点名称、邮箱、社交链接、项目与技术栈：src/consts.ts。
- 共用的个人信息、头像与导航：src/site.config.ts。
- 文章及碎碎念目录保持不变，原有新建脚本继续可用。
- 全站样式：src/styles/global.css。
- build 脚本改为跨平台命令，不再依赖 Unix 的 rm。

## 本地检查

运行 bun run build，再运行 bun run verify:content。
后者检查文章旧地址、全部碎碎念编号、搜索、RSS 和构建后的内部资源链接。
运行 bun dev 后访问终端打印的本地地址。

静态预览不运行 api/ 下的 Vercel Serverless 函数，评论、点赞及发布需要原部署环境。不要在检查过程中提交测试评论或发布内容。

设计参考：https://github.com/cworld1/astro-theme-pure
