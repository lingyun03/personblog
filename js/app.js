/* ============================================
   TechBlog - Main Application Logic
   ============================================ */

(function () {
  'use strict';

  // ---- Storage Helpers ----
  const DB = {
    get(key, fallback = []) {
      try { return JSON.parse(localStorage.getItem(key)) || fallback; }
      catch { return fallback; }
    },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
    remove(key) { localStorage.removeItem(key); }
  };

  // ---- Data Access ----
  function getUsers() { return DB.get('tb_users', []); }
  function setUsers(u) { DB.set('tb_users', u); }
  function getArticles() { return DB.get('tb_articles', []); }
  function setArticles(a) { DB.set('tb_articles', a); }
  function getComments(articleId) { return DB.get(`tb_comments_${articleId}`, []); }
  function setComments(articleId, c) { DB.set(`tb_comments_${articleId}`, c); }
  function getLikes(articleId) { return DB.get(`tb_likes_${articleId}`, []); }
  function setLikes(articleId, l) { DB.set(`tb_likes_${articleId}`, l); }
  function getCurrentUser() { return DB.get('tb_current_user', null); }
  function setCurrentUser(u) { DB.set('tb_current_user', u); }
  function logoutUser() { DB.remove('tb_current_user'); }

  // ---- Seed default admin ----
  (function seedAdmin() {
    const users = getUsers();
    if (!users.find(u => u.account === '88888888')) {
      users.push({
        account: '88888888',
        password: 'admin888',
        role: 'admin',
        createdAt: new Date().toISOString()
      });
      setUsers(users);
    }
    // Seed sample articles
    const articles = getArticles();
    if (articles.length === 0) {
      const now = new Date().toISOString();
      setArticles([
        {
          id: 'a1', title: '探索量子计算的未来',
          content: '量子计算是计算机科学中最令人兴奋的前沿领域之一。与经典计算机使用比特（0或1）不同，量子计算机使用量子比特（qubit），它可以同时处于0和1的叠加态。\n\n这种特性使得量子计算机在处理某些特定问题时具有指数级的速度优势。例如，在密码学、药物发现、材料科学和优化问题等领域，量子计算有望带来革命性的突破。\n\n目前，Google、IBM、微软等科技巨头都在大力投资量子计算研究。虽然我们距离通用量子计算机还有很长的路要走，但每一步进展都令人振奋。',
          tag: '科技前沿', author: '88888888', createdAt: now, updatedAt: now
        },
        {
          id: 'a2', title: '人工智能与创意产业的融合',
          content: '人工智能正在深刻改变创意产业的面貌。从AI绘画到音乐生成，从自动写作到视频创作，AI工具正在成为创作者的得力助手。\n\n然而，这也引发了关于原创性、版权和人类创造力的深刻讨论。AI究竟是创意的威胁，还是创意的延伸？\n\n答案可能介于两者之间。最成功的案例往往是人类与AI协作的结果——人类提供创意方向和审美判断，AI提供执行能力和无限变体。这种协作模式正在定义创意产业的新范式。',
          tag: 'AI', author: '88888888', createdAt: now, updatedAt: now
        },
        {
          id: 'a3', title: 'Web3.0：去中心化的互联网愿景',
          content: 'Web3.0代表着互联网的下一个演进阶段，其核心理念是去中心化、用户所有权和互操作性。\n\n在Web3.0的世界里，用户不再只是平台的"产品"，而是真正拥有自己的数据和数字资产。区块链技术为这一愿景提供了技术基础，智能合约使得去中心化应用（DApp）成为可能。\n\n尽管目前Web3.0仍处于早期阶段，面临着可扩展性、用户体验和监管等方面的挑战，但它所代表的去中心化理念正在影响着整个科技行业的发展方向。',
          tag: '区块链', author: '88888888', createdAt: now, updatedAt: now
        }
      ]);
    }
  })();

  // ---- Utility ----
  function genId() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }

  function formatDate(iso) {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} 天前`;
    return formatDate(iso);
  }

  // ---- Toast ----
  function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ---- Router ----
  function navigate(view, params = {}) {
    document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${view}`);
    if (target) target.classList.add('active');

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-view="${view}"]`);
    if (activeLink) activeLink.classList.add('active');

    // View-specific rendering
    switch (view) {
      case 'home': renderHome(); break;
      case 'article': renderArticleDetail(params.id); break;
      case 'admin': renderAdmin(); break;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- Auth UI ----
  function updateAuthUI() {
    const user = getCurrentUser();
    const authLinks = document.getElementById('nav-auth');
    const userLinks = document.getElementById('nav-user');
    const adminLink = document.getElementById('nav-admin');

    if (user) {
      authLinks.style.display = 'none';
      userLinks.style.display = 'flex';
      document.getElementById('user-avatar').textContent = user.account.slice(-2);
      document.getElementById('user-name').textContent = user.account;
      adminLink.style.display = user.role === 'admin' ? 'inline-flex' : 'none';
    } else {
      authLinks.style.display = 'flex';
      userLinks.style.display = 'none';
      adminLink.style.display = 'none';
    }
  }

  // ---- Registration ----
  function handleRegister(e) {
    e.preventDefault();
    const account = document.getElementById('reg-account').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const errEl = document.getElementById('reg-error');

    // Validate account: 8-10 digits
    if (!/^\d{8,10}$/.test(account)) {
      errEl.textContent = '账号必须为 8 到 10 位纯数字';
      errEl.classList.add('show');
      return;
    }

    // Validate password: min 8 chars, must contain both letters and numbers
    if (password.length < 8) {
      errEl.textContent = '密码长度不能少于 8 位';
      errEl.classList.add('show');
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      errEl.textContent = '密码必须同时包含字母和数字';
      errEl.classList.add('show');
      return;
    }

    if (password !== confirm) {
      errEl.textContent = '两次输入的密码不一致';
      errEl.classList.add('show');
      return;
    }

    // Check duplicate
    const users = getUsers();
    if (users.find(u => u.account === account)) {
      errEl.textContent = '该账号已被注册';
      errEl.classList.add('show');
      return;
    }

    users.push({
      account,
      password,
      role: 'user',
      createdAt: new Date().toISOString()
    });
    setUsers(users);

    errEl.classList.remove('show');
    showToast('注册成功，请登录', 'success');
    navigate('login');
  }

  // ---- Login ----
  function handleLogin(e) {
    e.preventDefault();
    const account = document.getElementById('login-account').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');

    const users = getUsers();
    const user = users.find(u => u.account === account && u.password === password);

    if (!user) {
      errEl.textContent = '账号或密码错误';
      errEl.classList.add('show');
      return;
    }

    errEl.classList.remove('show');
    setCurrentUser({ account: user.account, role: user.role });
    showToast(`欢迎回来，${user.account}`, 'success');
    updateAuthUI();
    navigate('home');
  }

  function handleLogout() {
    logoutUser();
    updateAuthUI();
    showToast('已退出登录', 'info');
    navigate('home');
  }

  // ---- Home / Articles List ----
  function renderHome() {
    const articles = getArticles().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const user = getCurrentUser();
    const grid = document.getElementById('articles-grid');
    const emptyState = document.getElementById('articles-empty');

    if (articles.length === 0) {
      grid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    grid.innerHTML = articles.map(a => {
      const likes = getLikes(a.id);
      const comments = getComments(a.id);
      const isLiked = user && likes.includes(user.account);
      return `
        <div class="article-card" onclick="App.goArticle('${a.id}')">
          <div class="card-meta">
            <span class="card-tag">${escapeHtml(a.tag || '未分类')}</span>
            <span>${formatDate(a.createdAt)}</span>
          </div>
          <div class="card-title">${escapeHtml(a.title)}</div>
          <div class="card-excerpt">${escapeHtml(a.content.slice(0, 150))}...</div>
          <div class="card-footer">
            <div class="card-stats">
              <span class="${isLiked ? 'liked' : ''}">❤ ${likes.length}</span>
              <span>💬 ${comments.length}</span>
            </div>
            <span style="font-size:0.8rem;color:var(--text-muted)">@${escapeHtml(a.author)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ---- Article Detail ----
  function renderArticleDetail(id) {
    const articles = getArticles();
    const article = articles.find(a => a.id === id);
    if (!article) {
      showToast('文章不存在', 'error');
      navigate('home');
      return;
    }

    const user = getCurrentUser();
    const likes = getLikes(id);
    const comments = getComments(id);
    const isLiked = user && likes.includes(user.account);

    document.getElementById('detail-title').textContent = article.title;
    document.getElementById('detail-meta').innerHTML = `
      <span class="card-tag">${escapeHtml(article.tag || '未分类')}</span>
      <span>作者：@${escapeHtml(article.author)}</span>
      <span>发布于 ${formatDate(article.createdAt)}</span>
      ${article.updatedAt !== article.createdAt ? `<span>更新于 ${formatDate(article.updatedAt)}</span>` : ''}
    `;
    document.getElementById('detail-content').textContent = article.content;

    // Actions
    const actionsEl = document.getElementById('detail-actions');
    if (user) {
      actionsEl.style.display = 'flex';
      actionsEl.innerHTML = `
        <button class="btn btn-sm ${isLiked ? 'btn-danger' : 'btn-secondary'}" onclick="App.toggleLike('${id}')">
          ${isLiked ? '❤ 已点赞' : '🤍 点赞'} (${likes.length})
        </button>
        ${user.role === 'admin' ? `
          <button class="btn btn-sm btn-secondary" onclick="App.editArticle('${id}')">✏️ 编辑</button>
          <button class="btn btn-sm btn-danger" onclick="App.confirmDelete('${id}')">🗑️ 删除</button>
        ` : ''}
      `;
    } else {
      actionsEl.style.display = 'none';
    }

    // Comments
    renderComments(id, user);
  }

  function renderComments(articleId, user) {
    const comments = getComments(articleId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const listEl = document.getElementById('comment-list');
    const formEl = document.getElementById('comment-form');

    if (user) {
      formEl.style.display = 'flex';
      formEl.onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById('comment-input');
        const text = input.value.trim();
        if (!text) return;

        const comments = getComments(articleId);
        comments.push({
          id: genId(),
          author: user.account,
          text,
          createdAt: new Date().toISOString()
        });
        setComments(articleId, comments);
        input.value = '';
        renderComments(articleId, user);
        showToast('评论成功', 'success');
      };
    } else {
      formEl.style.display = 'none';
    }

    if (comments.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="padding:2rem"><p>暂无评论，来说点什么吧 ✨</p></div>';
      return;
    }

    listEl.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-avatar">${c.author.slice(-2)}</div>
        <div class="comment-body">
          <div class="comment-author">@${escapeHtml(c.author)}</div>
          <div class="comment-text">${escapeHtml(c.text)}</div>
          <div class="comment-time">${timeAgo(c.createdAt)}</div>
        </div>
      </div>
    `).join('');
  }

  // ---- Like ----
  function toggleLike(articleId) {
    const user = getCurrentUser();
    if (!user) { showToast('请先登录', 'error'); return; }

    let likes = getLikes(articleId);
    const idx = likes.indexOf(user.account);
    if (idx > -1) {
      likes.splice(idx, 1);
    } else {
      likes.push(user.account);
    }
    setLikes(articleId, likes);
    renderArticleDetail(articleId);
  }

  // ---- Admin Panel ----
  function renderAdmin() {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
      showToast('无权限访问', 'error');
      navigate('home');
      return;
    }

    const articles = getArticles().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const users = getUsers();

    // Stats
    document.getElementById('stat-articles').textContent = articles.length;
    document.getElementById('stat-users').textContent = users.length;
    const totalLikes = articles.reduce((sum, a) => sum + getLikes(a.id).length, 0);
    document.getElementById('stat-likes').textContent = totalLikes;
    const totalComments = articles.reduce((sum, a) => sum + getComments(a.id).length, 0);
    document.getElementById('stat-comments').textContent = totalComments;

    // Table
    const tbody = document.getElementById('admin-tbody');
    if (articles.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted)">暂无文章</td></tr>';
      return;
    }

    tbody.innerHTML = articles.map(a => `
      <tr>
        <td class="table-title">${escapeHtml(a.title)}</td>
        <td><span class="card-tag">${escapeHtml(a.tag || '未分类')}</span></td>
        <td style="color:var(--text-muted);font-size:0.82rem">${formatDate(a.createdAt)}</td>
        <td style="color:var(--text-muted)">❤ ${getLikes(a.id).length} &nbsp; 💬 ${getComments(a.id).length}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-secondary" onclick="App.editArticle('${a.id}')">编辑</button>
            <button class="btn btn-sm btn-danger" onclick="App.confirmDelete('${a.id}')">删除</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // ---- Article Editor (Modal) ----
  function openEditor(articleId = null) {
    const modal = document.getElementById('editor-modal');
    const title = document.getElementById('editor-title');
    const tag = document.getElementById('editor-tag');
    const content = document.getElementById('editor-content');
    const heading = document.getElementById('editor-heading');

    if (articleId) {
      const article = getArticles().find(a => a.id === articleId);
      if (!article) return;
      heading.textContent = '编辑文章';
      title.value = article.title;
      tag.value = article.tag || '';
      content.value = article.content;
      modal.dataset.editId = articleId;
    } else {
      heading.textContent = '发布新文章';
      title.value = '';
      tag.value = '';
      content.value = '';
      delete modal.dataset.editId;
    }

    modal.classList.add('active');
  }

  function closeEditor() {
    document.getElementById('editor-modal').classList.remove('active');
  }

  function saveArticle() {
    const modal = document.getElementById('editor-modal');
    const title = document.getElementById('editor-title').value.trim();
    const tag = document.getElementById('editor-tag').value.trim();
    const content = document.getElementById('editor-content').value.trim();

    if (!title) { showToast('请输入文章标题', 'error'); return; }
    if (!content) { showToast('请输入文章内容', 'error'); return; }

    const user = getCurrentUser();
    const articles = getArticles();
    const now = new Date().toISOString();

    if (modal.dataset.editId) {
      const idx = articles.findIndex(a => a.id === modal.dataset.editId);
      if (idx > -1) {
        articles[idx].title = title;
        articles[idx].tag = tag || '未分类';
        articles[idx].content = content;
        articles[idx].updatedAt = now;
      }
      showToast('文章已更新', 'success');
    } else {
      articles.push({
        id: genId(),
        title,
        tag: tag || '未分类',
        content,
        author: user.account,
        createdAt: now,
        updatedAt: now
      });
      showToast('文章已发布', 'success');
    }

    setArticles(articles);
    closeEditor();
    renderAdmin();
  }

  // ---- Delete Article ----
  function confirmDelete(articleId) {
    document.getElementById('confirm-overlay').classList.add('active');
    document.getElementById('confirm-yes').onclick = () => {
      deleteArticle(articleId);
      document.getElementById('confirm-overlay').classList.remove('active');
    };
    document.getElementById('confirm-no').onclick = () => {
      document.getElementById('confirm-overlay').classList.remove('active');
    };
  }

  function deleteArticle(articleId) {
    let articles = getArticles();
    articles = articles.filter(a => a.id !== articleId);
    setArticles(articles);
    showToast('文章已删除', 'success');

    // Check current view
    const detailView = document.getElementById('view-article');
    if (detailView.classList.contains('active')) {
      navigate('home');
    } else {
      renderAdmin();
    }
  }

  // ---- Public API ----
  window.App = {
    navigate,
    goArticle: (id) => navigate('article', { id }),
    toggleLike,
    editArticle: (id) => openEditor(id),
    confirmDelete,
    openNewArticle: () => openEditor(),
    closeEditor,
    saveArticle,
    handleRegister,
    handleLogin,
    handleLogout
  };

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    // Particles
    const canvas = document.getElementById('particles-canvas');
    if (canvas) new ParticleBackground(canvas);

    // Auth forms
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Nav brand
    document.querySelector('.nav-brand').addEventListener('click', () => navigate('home'));

    // Nav links
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
      link.addEventListener('click', () => navigate(link.dataset.view));
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', handleLogout);

    // Init UI
    updateAuthUI();
    navigate('home');
  });

})();
