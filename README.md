# TechBlog

静态博客前端 + Supabase 后端。

## 部署与访问说明

- **GitHub Pages**：默认域名为 `https://<用户名>.github.io/<仓库名>/`，需保证仓库 **Settings → Pages** 中 Source 与分支正确。
- **部分地区无法打开 `github.io`**：属于网络环境限制，单靠前端代码无法根治。可尝试更换网络、代理，或由站长**镜像仓库**到 Gitee / Cloudflare Pages 并绑定域名。页脚有简要说明供访客阅读。
- **首屏性能**：背景音乐仅在**已登录且位于首页**时才会请求配置并加载音频；阅读文章时不会加载 BGM。

## 本地开发

使用任意静态服务器打开根目录 `index.html` 即可（需配置 `js/app.js` 中的 Supabase 密钥）。

## 访问与阅读统计

在 Supabase **SQL Editor** 中执行以下脚本：

- `supabase/article_view_count.sql`：新增 `view_count` 字段与 `increment_article_view` 函数；
- `supabase/site_visit_metrics.sql`：新增网站日访问统计 `site_daily_stats` 与 `track_site_visit` 函数（管理员后台展示近 14 天访问趋势）。

未执行脚本时，前台仍可正常阅读，但后台统计会显示为 0 或不可用。

## 页面「没有更新」时

1. **等待 GitHub Pages**：推送后一般 **1～10 分钟** 内生效，可在仓库 **Actions** 或 **Settings → Pages** 查看部署状态。
2. **强制刷新**：Windows `Ctrl + F5`，Mac `Cmd + Shift + R`；或清掉本站缓存后再打开。
3. **静态资源缓存**：`index.html` 里 CSS/JS 已带 `?v=...`，**以后每次改样式/脚本请把该版本号改一下**再推送，访客才会拿到新文件。

## 文章页看起来「左边只有很窄一条」？

若正文没有使用 `#` 标题，旧版布局在**无目录**时会把正文误放进约 200px 的第一列。请拉取最新代码；若仍异常，务必**递增 `?v=`** 并硬刷新。
