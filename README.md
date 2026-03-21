# TechBlog

静态博客前端 + Supabase 后端。

## 部署与访问说明

- **GitHub Pages**：默认域名为 `https://<用户名>.github.io/<仓库名>/`，需保证仓库 **Settings → Pages** 中 Source 与分支正确。
- **部分地区无法打开 `github.io`**：属于网络环境限制，与代码无关。可尝试更换网络、使用可访问 GitHub 的代理，或将站点同步到国内可访问的托管（如 Gitee Pages、Cloudflare Pages 等自定义域名）。
- **首屏性能**：背景音乐仅在**已登录且位于首页**时才会请求配置并加载音频；阅读文章时不会加载 BGM。

## 本地开发

使用任意静态服务器打开根目录 `index.html` 即可（需配置 `js/app.js` 中的 Supabase 密钥）。
