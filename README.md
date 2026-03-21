# TechBlog

静态博客前端 + Supabase 后端。

## 部署与访问说明

- **GitHub Pages**：默认域名为 `https://<用户名>.github.io/<仓库名>/`，需保证仓库 **Settings → Pages** 中 Source 与分支正确。
- **部分地区无法打开 `github.io`**：属于网络环境限制，单靠前端代码无法根治。可尝试更换网络、代理，或由站长**镜像仓库**到 Gitee / Cloudflare Pages 并绑定域名。页脚有简要说明供访客阅读。
- **首屏性能**：背景音乐仅在**已登录且位于首页**时才会请求配置并加载音频；阅读文章时不会加载 BGM。

## 本地开发

使用任意静态服务器打开根目录 `index.html` 即可（需配置 `js/app.js` 中的 Supabase 密钥）。

## 文章阅读次数

在 Supabase **SQL Editor** 中执行 `supabase/article_view_count.sql`（新增 `view_count` 字段与 `increment_article_view` 函数），管理后台表格会显示每篇文章阅读次数。未执行脚本时，前台仍可正常阅读，仅统计与后台列可能不可用。

## 飞书文档导入

浏览器无法直接请求 `open.feishu.cn`（CORS），因此通过多个 **CORS 代理**依次尝试（见 `js/app.js` 中 `feishuProxyUrls` / `feishuFetchJson`）。若仍失败，多为代理临时不可用或网络限制，可复制正文到编辑器。飞书应用需具备文档读取权限，Wiki 链接会先解析为云文档 `obj_token`。

## 页面「没有更新」时

1. **等待 GitHub Pages**：推送后一般 **1～10 分钟** 内生效，可在仓库 **Actions** 或 **Settings → Pages** 查看部署状态。
2. **强制刷新**：Windows `Ctrl + F5`，Mac `Cmd + Shift + R`；或清掉本站缓存后再打开。
3. **静态资源缓存**：`index.html` 里 CSS/JS 已带 `?v=...`，**以后每次改样式/脚本请把该版本号改一下**再推送，访客才会拿到新文件。

## 文章页看起来「左边只有很窄一条」？

若正文没有使用 `#` 标题，旧版布局在**无目录**时会把正文误放进约 200px 的第一列。请拉取最新代码；若仍异常，务必**递增 `?v=`** 并硬刷新。
