var SB_URL = 'https://kkilgyvqrrxwrrrfsdru.supabase.co';
var SB_KEY = 'sb_publishable_UC4HLIn8O1T1MZRpp-V5SA_NP3KHWe-';

(function () {
  'use strict';
  var sb = null;
  try { sb = supabase.createClient(SB_URL, SB_KEY); } catch(e) { console.error('Supabase init failed:', e); }
  var isConfigured = sb !== null;
  var currentUser = null;
  var currentProfile = null;
  var currentView = 'home';
  var searchQuery = '';
  var editingArticleId = null;
  var currentArticle = null;
  var bgmSetting = null;
  var navHistory = [];
  var lastArticleNavId = null;
  var homeCache = null;
  var homeCacheAt = 0;
  var HOME_CACHE_TTL = 30000;
  var visitTracked = false;

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function ago(d) {
    var t = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (t < 60) return '刚刚'; if (t < 3600) return Math.floor(t / 60) + ' 分钟前';
    if (t < 86400) return Math.floor(t / 3600) + ' 小时前';
    if (t < 2592000) return Math.floor(t / 86400) + ' 天前';
    return new Date(d).toLocaleDateString('zh-CN');
  }
  function trunc(s, n) { if (!s) return ''; var p = s.replace(/[#*`>\-\[\]()!]/g, '').replace(/\n/g, ' ').trim(); return p.length > n ? p.slice(0, n) + '...' : p; }

  function parsePipeRow(line) {
    var parts = line.split('|');
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var c = parts[i].trim();
      if (c === '' && (i === 0 || i === parts.length - 1)) continue;
      out.push(c);
    }
    return out;
  }
  function isTableSepRow(line) {
    var p = parsePipeRow(line);
    if (!p.length) return false;
    return p.every(function (cell) { return /^[\-:]+$/.test(cell.replace(/\s/g, '')); });
  }
  function parsePipeTable(rows) {
    if (!rows.length) return '';
    var header = parsePipeRow(rows[0]);
    var di = 1;
    if (rows.length > 1 && isTableSepRow(rows[1])) di = 2;
    var html = '<div class="table-wrap"><table class="md-table"><thead><tr>';
    header.forEach(function (c) { html += '<th>' + il(c) + '</th>'; });
    html += '</tr></thead><tbody>';
    for (var r = di; r < rows.length; r++) {
      var cells = parsePipeRow(rows[r]);
      if (!cells.length) continue;
      html += '<tr>';
      cells.forEach(function (c) { html += '<td>' + il(c) + '</td>'; });
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function estimateReadingTime(content) {
    if (!content) return 1;
    var zh = (content.match(/[\u4e00-\u9fff]/g) || []).length;
    var en = content.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(Boolean).length;
    var units = zh / 400 + en / 200;
    return Math.max(1, Math.round(units * 10) / 10);
  }

  function buildTocHtml(items) {
    if (!items.length) return '';
    var h = '<aside class="article-toc" aria-label="文章目录"><div class="toc-title">目录</div><ul class="toc-list">';
    items.forEach(function (it) {
      h += '<li class="toc-item toc-level-' + it.level + '"><a href="#' + esc(it.id) + '">' + esc(it.text) + '</a></li>';
    });
    return h + '</ul></aside>';
  }

  function md(text) {
    if (!text) return { html: '', tocHtml: '' };
    var L = text.split('\n'), H = '', inC = false, cc = '', inL = false, lt = '', inQ = false;
    var fenceLang = '';
    var tocItems = [];
    var hCounter = 0;
    function cb() { if (inL) { H += lt === 'ul' ? '</ul>' : lt === 'task' ? '</ul>' : '</ol>'; inL = false; } if (inQ) { H += '</blockquote>'; inQ = false; } }
    function pushHeading(level, sliceLen, line) {
      var raw = line.slice(sliceLen);
      hCounter++;
      var id = 'heading-' + hCounter;
      if (level <= 4) tocItems.push({ level: level, text: raw.replace(/^\s+/, '').trim(), id: id });
      return '<h' + level + ' id="' + id + '">' + il(raw) + '</h' + level + '>';
    }
    var i = 0;
    while (i < L.length) {
      var l = L[i];
      if (/^\s*```(\w+)?\s*$/.test(l.trim())) {
        var fm = l.trim().match(/^```(\w+)?$/);
        if (inC) {
          var langCls = fenceLang ? ' class="language-' + esc(fenceLang) + '"' : '';
          H += '<pre><code' + langCls + '>' + esc(cc) + '</code></pre>';
          inC = false; cc = ''; fenceLang = '';
        } else {
          cb(); inC = true; fenceLang = (fm && fm[1]) ? fm[1] : '';
        }
        i++; continue;
      }
      if (inC) { cc += (cc ? '\n' : '') + l; i++; continue; }
      if (l.trim().startsWith('|') && l.indexOf('|') !== -1) {
        var j = i, rows = [];
        while (j < L.length && L[j].trim().startsWith('|')) { rows.push(L[j]); j++; }
        if (rows.length >= 2 && isTableSepRow(rows[1])) {
          cb(); H += parsePipeTable(rows); i = j; continue;
        }
      }
      if (!l.trim()) { cb(); i++; continue; }
      if (l.indexOf('###### ') === 0) { cb(); H += pushHeading(6, 7, l); i++; continue; }
      if (l.indexOf('##### ') === 0) { cb(); H += pushHeading(5, 6, l); i++; continue; }
      if (l.indexOf('#### ') === 0) { cb(); H += pushHeading(4, 5, l); i++; continue; }
      if (l.indexOf('### ') === 0) { cb(); H += pushHeading(3, 4, l); i++; continue; }
      if (l.indexOf('## ') === 0) { cb(); H += pushHeading(2, 3, l); i++; continue; }
      if (l.indexOf('# ') === 0) { cb(); H += pushHeading(1, 2, l); i++; continue; }
      if (/^(-{3,}|\*{3,})$/.test(l.trim())) { cb(); H += '<hr>'; i++; continue; }
      if (l.indexOf('> ') === 0) { if (inL) { H += lt === 'ul' || lt === 'task' ? '</ul>' : '</ol>'; inL = false; } if (!inQ) { H += '<blockquote>'; inQ = true; } H += '<p>' + il(l.slice(2)) + '</p>'; i++; continue; }
      var taskm = l.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)$/);
      if (taskm) {
        if (inQ) { H += '</blockquote>'; inQ = false; }
        if (!inL || lt !== 'task') { if (inL) H += lt === 'ul' ? '</ul>' : '</ol>'; H += '<ul class="task-list">'; inL = true; lt = 'task'; }
        var checked = (taskm[2] || '').toLowerCase() === 'x';
        H += '<li class="task-item"><input type="checkbox" disabled ' + (checked ? 'checked' : '') + '> ' + il(taskm[3]) + '</li>';
        i++; continue;
      }
      if (/^[-*+]\s/.test(l)) {
        if (inQ) { H += '</blockquote>'; inQ = false; }
        if (inL && lt === 'task') { H += '</ul>'; inL = false; }
        if (!inL || lt !== 'ul') { if (inL) H += lt === 'ol' ? '</ol>' : ''; H += '<ul>'; inL = true; lt = 'ul'; }
        H += '<li>' + il(l.replace(/^[-*+]\s/, '')) + '</li>';
        i++; continue;
      }
      if (/^\d+\.\s/.test(l)) {
        if (inQ) { H += '</blockquote>'; inQ = false; }
        if (inL && lt === 'task') { H += '</ul>'; inL = false; }
        if (!inL || lt !== 'ol') { if (inL) H += lt === 'ul' ? '</ul>' : ''; H += '<ol>'; inL = true; lt = 'ol'; }
        H += '<li>' + il(l.replace(/^\d+\.\s/, '')) + '</li>';
        i++; continue;
      }
      cb(); H += '<p>' + il(l) + '</p>'; i++;
    }
    if (inC) {
      var langCls2 = fenceLang ? ' class="language-' + esc(fenceLang) + '"' : '';
      H += '<pre><code' + langCls2 + '>' + esc(cc) + '</code></pre>';
    }
    cb();
    return { html: H, tocHtml: buildTocHtml(tocItems) };
  }
  function il(t) {
    function normalizeUrl(u) {
      if (!u) return '#';
      var s = String(u).trim();
      if (!s) return '#';
      if (/^(javascript|data):/i.test(s)) return '#';
      if (/^(#|\/|\.\/|\.\.\/)/.test(s)) return s;
      if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(s)) return s;
      if (s.indexOf('//') === 0) return 'https:' + s;
      if (/^(github\.com|www\.github\.com|github\.io|www\.github\.io)\b/i.test(s)) return 'https://' + s;
      return 'https://' + s;
    }
    t = t.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    t = t.replace(/~~(.+?)~~/g, '<del>$1</del>');
    t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, url) {
      return '<img src="' + normalizeUrl(url) + '" alt="' + alt + '">';
    });
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, text, url) {
      return '<a href="' + normalizeUrl(url) + '" target="_blank" rel="noopener noreferrer">' + text + '</a>';
    });
    t = t.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+)/g, function (_, pre, url) {
      var full = /^https?:\/\//i.test(url) ? url : ('https://' + url);
      return pre + '<a href="' + normalizeUrl(full) + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return t;
  }

  function authErrMsg(e) {
    var m = ((e && e.message) ? e.message : '').toLowerCase();
    if (m.indexOf('email not confirmed') !== -1) return '账号已注册但未激活：请在 Supabase 关闭 Email Confirmations，或改用真实邮箱完成验证。';
    if (m.indexOf('invalid login credentials') !== -1) return '账号或密码错误';
    if (m.indexOf('too many requests') !== -1) return '操作过于频繁，请稍后再试';
    return (e && e.message) ? e.message : '请稍后重试';
  }

  function ensureAuthReady(errEl) {
    if (sb && sb.auth) return true;
    var msg = '登录服务未就绪：请检查网络或 CDN（@supabase/supabase-js）是否可访问，然后刷新页面重试。';
    if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
    else toast(msg, 'error');
    return false;
  }

  function toast(m, t) {
    var c = document.getElementById('toast-container'), e = document.createElement('div');
    e.className = 'toast ' + (t || 'info'); e.textContent = m; c.appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 3000);
  }

  function togglePassword(inputId, btn) {
    var i = document.getElementById(inputId);
    if (!i) return;
    var show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    if (btn) btn.textContent = show ? '隐藏' : '显示';
  }

  function isAdmin() { return !!(currentProfile && currentProfile.role === 'admin'); }
  function canEditArticle(a) { return !!(currentUser && a && (a.author_id === currentUser.id || isAdmin())); }
  function draftKey() { return 'tb_drafts_' + (currentUser ? currentUser.id : 'guest'); }
  function safeFileName(name) {
    return String(name || 'file').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_');
  }

  function sumArticleViews(articles) {
    return (articles || []).reduce(function (acc, a) {
      var vc = typeof a.view_count === 'number' ? a.view_count : parseInt(a.view_count, 10) || 0;
      return acc + vc;
    }, 0);
  }

  function normalizeDayKey(d) {
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    var y = dt.getFullYear();
    var m = String(dt.getMonth() + 1).padStart(2, '0');
    var day = String(dt.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function renderVisitBars(rows) {
    var box = document.getElementById('visit-bars');
    var totalEl = document.getElementById('visit-visual-total');
    if (!box) return;
    var today = new Date();
    var days = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }
    var map = {};
    (rows || []).forEach(function (r) {
      var k = normalizeDayKey(r.day);
      if (k) map[k] = parseInt(r.total_visits, 10) || 0;
    });
    var values = days.map(function (d) { return map[normalizeDayKey(d)] || 0; });
    var maxV = Math.max.apply(null, values.concat([1]));
    var sumV = values.reduce(function (a, b) { return a + b; }, 0);
    if (totalEl) totalEl.textContent = '近 14 天累计访问：' + sumV;
    box.innerHTML = days.map(function (d, idx) {
      var v = values[idx];
      var h = Math.max(8, Math.round((v / maxV) * 110));
      var label = String(d.getMonth() + 1) + '/' + String(d.getDate());
      return '<div class="visit-bar-col" title="' + label + '：' + v + ' 次">' +
        '<div class="visit-bar" style="height:' + h + 'px"></div>' +
        '<div class="visit-bar-value">' + v + '</div>' +
        '<div class="visit-bar-label">' + label + '</div>' +
        '</div>';
    }).join('');
  }

  async function trackSiteVisitIfNeeded() {
    if (!sb || visitTracked) return;
    visitTracked = true;
    var now = Date.now();
    var key = 'tb_last_site_visit_ping';
    var last = 0;
    try { last = parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch (e) {}
    if (now - last < 30 * 60 * 1000) return;
    try {
      await sb.rpc('track_site_visit');
      try { localStorage.setItem(key, String(now)); } catch (_) {}
    } catch (e2) {
      // 没有部署 SQL 时静默跳过，避免影响主流程
    }
  }

  function getDrafts() {
    try { return JSON.parse(localStorage.getItem(draftKey()) || '[]'); } catch (e) { return []; }
  }
  function setDrafts(list) { localStorage.setItem(draftKey(), JSON.stringify(list || [])); }
  function saveDraft() {
    if (!currentUser) { toast('请先登录', 'error'); return; }
    var title = document.getElementById('editor-title').value.trim();
    var tag = document.getElementById('editor-tag').value.trim();
    var content = document.getElementById('editor-content').value.trim();
    if (!title && !content) { toast('草稿内容为空', 'error'); return; }
    var arr = getDrafts();
    arr.unshift({ id: 'd_' + Date.now(), title: title || '未命名草稿', tag: tag || '', content: content || '', updatedAt: Date.now() });
    setDrafts(arr.slice(0, 20));
    toast('草稿已保存', 'success');
  }
  function deleteDraft(id) {
    setDrafts(getDrafts().filter(function (x) { return x.id !== id; }));
    renderDrafts();
  }
  function useDraft(id) {
    var d = getDrafts().find(function (x) { return x.id === id; });
    if (!d) return;
    document.getElementById('editor-title').value = d.title || '';
    document.getElementById('editor-tag').value = d.tag || '';
    document.getElementById('editor-content').value = d.content || '';
    updatePreview();
    document.getElementById('drafts-modal').classList.remove('active');
    toast('草稿已加载', 'success');
  }
  function renderDrafts() {
    var box = document.getElementById('drafts-list');
    if (!box) return;
    var arr = getDrafts();
    if (!arr.length) { box.innerHTML = '<div class="empty-state"><p>暂无草稿</p></div>'; return; }
    box.innerHTML = arr.map(function (d) {
      return '<div class="comment-item"><div class="comment-body"><div class="comment-author">' + esc(d.title) + '</div>' +
      '<div class="comment-time">' + new Date(d.updatedAt).toLocaleString('zh-CN') + '</div></div>' +
      '<button class="btn btn-sm btn-secondary" onclick="window.App.useDraft(\'' + d.id + '\')">使用</button>' +
      '<button class="btn btn-sm btn-danger" onclick="window.App.deleteDraft(\'' + d.id + '\')">删除</button></div>';
    }).join('');
  }
  function openDrafts() { renderDrafts(); document.getElementById('drafts-modal').classList.add('active'); }

  /** 仅登录用户可能播放；访客不请求配置、不加载音频，避免拖慢首屏与浪费流量 */
  function normalizeBgmPayload(v) {
    if (!v) return null;
    if (typeof v === 'string') {
      try { v = JSON.parse(v); } catch (e) { return null; }
    }
    return v && (v.url || v.dataUrl) ? v : null;
  }

  function bgmSrcMatches(player, url) {
    if (!player || !url) return false;
    var a = (player.currentSrc || player.src || '').trim();
    if (!a) return false;
    if (a === url) return true;
    try {
      return new URL(a).href === new URL(url, window.location.href).href;
    } catch (e) {
      return false;
    }
  }

  function applyBgmToPlayer(player, setting) {
    if (!player || !setting || !(setting.url || setting.dataUrl)) return;
    var url = setting.url || setting.dataUrl;
    player.volume = 0.35;
    var tryPlay = function () {
      if (currentUser) player.play().catch(function () {});
    };
    if (bgmSrcMatches(player, url)) {
      tryPlay();
      return;
    }
    var done = false;
    var oncePlay = function () {
      if (done) return;
      done = true;
      tryPlay();
    };
    player.addEventListener('canplay', oncePlay, { once: true });
    player.addEventListener('loadeddata', oncePlay, { once: true });
    player.src = url;
    setTimeout(oncePlay, 400);
  }

  async function loadBackgroundMusic() {
    var player = document.getElementById('global-bgm-player');
    if (!player) return;
    if (!currentUser) {
      player.pause();
      player.removeAttribute('src');
      return;
    }
    var nameEl = document.getElementById('bgm-current-name');
    var remote = null;
    try {
      var r = await sb.from('site_settings').select('value').eq('key', 'background_music').maybeSingle();
      if (!r.error && r.data && r.data.value != null) remote = normalizeBgmPayload(r.data.value);
    } catch (e) {}
    var local = null;
    try { local = normalizeBgmPayload(JSON.parse(localStorage.getItem('tb_background_music') || 'null')); } catch (e2) {}
    function hasBgm(s) { return !!(s && (s.url || s.dataUrl)); }
    var merged = null;
    if (hasBgm(remote)) {
      merged = local ? Object.assign({}, local, remote) : remote;
    } else if (hasBgm(local)) {
      merged = local;
    }
    bgmSetting = merged;
    if (bgmSetting && (bgmSetting.url || bgmSetting.dataUrl)) {
      try { localStorage.setItem('tb_background_music', JSON.stringify(bgmSetting)); } catch (e) {}
      if (nameEl) nameEl.textContent = '当前：' + (bgmSetting.name || '已设置');
      /* 已登录则全站保持播放（不限首页），直至退出账号 */
      applyBgmToPlayer(player, bgmSetting);
    } else {
      player.pause();
      player.removeAttribute('src');
      if (nameEl) nameEl.textContent = '当前：未设置';
    }
  }

  async function saveBackgroundMusic() {
    if (!isAdmin()) { toast('仅管理员可操作', 'error'); return; }
    var inp = document.getElementById('bgm-file-input');
    var file = inp && inp.files && inp.files[0];
    if (!file) { toast('请先选择音频文件', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('音频文件请小于 5MB', 'error'); return; }
    var payload = { name: file.name, updatedAt: Date.now() };
    var uploaded = false;
    try {
      var path = 'bgm/' + Date.now() + '_' + safeFileName(file.name);
      var up = await sb.storage.from('blog-assets').upload(path, file, { upsert: true });
      if (!up.error) {
        var pub = sb.storage.from('blog-assets').getPublicUrl(path);
        payload.url = pub.data && pub.data.publicUrl ? pub.data.publicUrl : '';
        payload.path = path;
        uploaded = !!payload.url;
      }
    } catch (e) {}
    if (!uploaded) {
      var fr = new FileReader();
      fr.onload = async function () {
        payload.dataUrl = fr.result;
        var savedRemote = false;
        try {
          var ret = await sb.from('site_settings').upsert({ key: 'background_music', value: payload }, { onConflict: 'key' });
          if (!ret.error) savedRemote = true;
        } catch (e) {}
        localStorage.setItem('tb_background_music', JSON.stringify(payload));
        bgmSetting = payload;
        await loadBackgroundMusic();
        toast(savedRemote ? '背景音乐已更新' : '已本地启用音乐（请执行 SQL 脚本开启全员同步）', 'success');
      };
      fr.readAsDataURL(file);
      return;
    }
    var savedRemote2 = false;
    try {
      var ret2 = await sb.from('site_settings').upsert({ key: 'background_music', value: payload }, { onConflict: 'key' });
      if (!ret2.error) savedRemote2 = true;
    } catch (e2) {}
    localStorage.setItem('tb_background_music', JSON.stringify(payload));
    bgmSetting = payload;
    await loadBackgroundMusic();
    toast(savedRemote2 ? '背景音乐已更新并全员可用' : '音乐已上传，待配置 site_settings 表后全员生效', 'success');
  }

  async function clearBackgroundMusic() {
    if (!isAdmin()) { toast('仅管理员可操作', 'error'); return; }
    try { await sb.from('site_settings').delete().eq('key', 'background_music'); } catch (e) {}
    localStorage.removeItem('tb_background_music');
    bgmSetting = null;
    await loadBackgroundMusic();
    toast('背景音乐已关闭', 'info');
  }

  var captchaCode = '', CC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function genCaptcha(id) {
    var cv = document.getElementById(id); if (!cv) return '';
    var ctx = cv.getContext('2d'), code = '';
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < 4; i++) {
      var ch = CC[Math.floor(Math.random() * CC.length)]; code += ch; ctx.save();
      ctx.font = (18 + Math.random() * 8) + 'px monospace';
      ctx.fillStyle = 'hsl(' + (180 + Math.random() * 60) + ',80%,70%)';
      ctx.translate(18 + i * 26, 28 + Math.random() * 8);
      ctx.rotate((Math.random() - 0.5) * 0.4); ctx.fillText(ch, 0, 0); ctx.restore();
    }
    for (var j = 0; j < 4; j++) { ctx.beginPath(); ctx.moveTo(Math.random() * cv.width, Math.random() * cv.height); ctx.lineTo(Math.random() * cv.width, Math.random() * cv.height); ctx.strokeStyle = 'rgba(56,189,248,' + (0.2 + Math.random() * 0.3) + ')'; ctx.lineWidth = 1; ctx.stroke(); }
    captchaCode = code; return code;
  }

  function updateBackButton() {
    var b = document.getElementById('nav-back-btn');
    if (b) b.style.display = navHistory.length > 0 ? 'inline-flex' : 'none';
  }

  function goBack() {
    if (navHistory.length === 0) {
      navigate('home', null, { skipHistory: true });
      return;
    }
    var prev = navHistory.pop();
    navigate(prev.view, prev.id, { skipHistory: true });
  }

  function navigate(view, id, opts) {
    opts = opts || {};
    if (!opts.skipHistory) {
      var same = (view === currentView && (view !== 'article' || id === lastArticleNavId));
      if (!same) {
        navHistory.push({ view: currentView, id: lastArticleNavId });
        if (navHistory.length > 40) navHistory.shift();
      }
    }
    lastArticleNavId = (view === 'article') ? id : null;
    currentView = view;
    document.querySelectorAll('.page-view').forEach(function (e) { e.classList.remove('active'); });
    var t = document.getElementById('view-' + view); if (t) t.classList.add('active');
    document.body.classList.toggle('page-auth', view === 'login' || view === 'register');
    updateNav();
    updateBackButton();
    if (view === 'home') renderHome();
    else if (view === 'article') renderArticle(id);
    else if (view === 'admin') renderAdmin();
    else if (view === 'login') {}
    else if (view === 'register') setTimeout(function(){ genCaptcha('register-captcha'); }, 150);
    var mc = document.querySelector('.main-content');
    if (mc) mc.classList.toggle('main-content--article', view === 'article');
    if (currentUser) loadBackgroundMusic();
    window.scrollTo(0, 0);
    try {
      if (history.replaceState) {
        if (view === 'article' && id) {
          var u = new URL(window.location.href);
          u.searchParams.set('article', id);
          history.replaceState({}, '', u.toString());
        } else if (view === 'home') {
          var u2 = new URL(window.location.href);
          u2.searchParams.delete('article');
          history.replaceState({}, '', u2.pathname + (u2.searchParams.toString() ? '?' + u2.searchParams.toString() : '') + u2.hash);
        }
      }
    } catch (e) {}
  }

  function updateNav() {
    var nl = document.getElementById('nav-links'), nu = document.getElementById('nav-user'), na = document.getElementById('nav-auth');
    if (currentUser) {
      nl.style.display = 'flex'; nu.style.display = 'flex'; na.style.display = 'none';
      var al = document.getElementById('nav-admin'); if (al) al.style.display = currentProfile && currentProfile.role === 'admin' ? '' : 'none';
      var wl = document.getElementById('nav-write'); if (wl) wl.style.display = '';
      document.getElementById('user-avatar-btn').textContent = currentProfile ? (currentProfile.avatar || '👤') : '👤';
      document.getElementById('dropdown-name').textContent = currentProfile ? (currentProfile.display_name || '用户') : '用户';
      document.getElementById('dropdown-role').textContent = currentProfile && currentProfile.role === 'admin' ? '管理员' : '作者';
      document.getElementById('dropdown-avatar').textContent = currentProfile ? (currentProfile.avatar || '👤') : '👤';
    } else { nl.style.display = 'none'; nu.style.display = 'none'; na.style.display = 'flex'; }
  }

  async function doRegister() {
    var acc = document.getElementById('reg-account').value.trim();
    var pw = document.getElementById('reg-password').value;
    var pw2 = document.getElementById('reg-password2').value;
    var ci = document.getElementById('reg-captcha').value.trim().toUpperCase();
    var err = document.getElementById('reg-error'); err.classList.remove('show');
    if (!ensureAuthReady(err)) return;
    if (!/^\d{8,10}$/.test(acc)) { err.textContent = '账号必须是 8-10 位数字'; err.classList.add('show'); return; }
    if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(pw)) { err.textContent = '密码至少 8 位，需包含字母和数字'; err.classList.add('show'); return; }
    if (pw !== pw2) { err.textContent = '两次密码不一致'; err.classList.add('show'); return; }
    if (ci !== captchaCode) { err.textContent = '验证码错误'; err.classList.add('show'); genCaptcha('register-captcha'); return; }
    try {
      var role = acc === '12345678' ? 'admin' : 'user';
      var { data, error } = await sb.auth.signUp({
        email: acc + '@techblog.com', password: pw,
        options: { data: { displayName: '用户' + acc.slice(-4), avatar: '👤', bio: '', role: role } }
      });
      if (error) throw error;
      if (data && data.user && !data.session) {
        toast('注册成功，但账号需激活后才能登录', 'info');
        err.textContent = '检测到当前项目开启了邮箱激活，但你使用的是虚拟账号邮箱。请在 Supabase -> Authentication -> Providers 关闭 Email Confirmations。';
        err.classList.add('show');
        navigate('login');
        return;
      }
      toast('注册成功，请登录', 'success');
      navigate('login');
    } catch (e) { err.textContent = '注册失败：' + authErrMsg(e); err.classList.add('show'); }
  }

  async function doLogin() {
    var acc = document.getElementById('login-account').value.trim();
    var pw = document.getElementById('login-password').value;
    var err = document.getElementById('login-error'); err.classList.remove('show');
    if (!ensureAuthReady(err)) return;
    if (!acc || !pw) { err.textContent = '请输入账号和密码'; err.classList.add('show'); return; }
    try {
      var { data, error } = await sb.auth.signInWithPassword({ email: acc + '@techblog.com', password: pw });
      if (error) throw error;
      currentUser = data.user;
      var { data: p } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
      currentProfile = p;
      toast('欢迎回来，' + (currentProfile ? currentProfile.display_name : acc), 'success');
      navigate('home');
    } catch (e) { err.textContent = authErrMsg(e); err.classList.add('show'); }
  }

  async function doLogout() {
    if (!ensureAuthReady()) return;
    await sb.auth.signOut(); currentUser = null; currentProfile = null;
    var player = document.getElementById('global-bgm-player'); if (player) player.pause();
    closeDropdown(); toast('已退出登录', 'info'); navigate('home');
  }

  function toggleDropdown() { document.getElementById('user-dropdown').classList.toggle('show'); }
  function closeDropdown() { document.getElementById('user-dropdown').classList.remove('show'); }

  function openProfile() {
    closeDropdown(); if (!currentProfile) return;
    document.getElementById('profile-name').value = currentProfile.display_name || '';
    document.getElementById('profile-bio').value = currentProfile.bio || '';
    document.getElementById('profile-avatar-preview').textContent = currentProfile.avatar || '👤';
    document.querySelectorAll('.emoji-option').forEach(function (e) { e.classList.toggle('selected', e.dataset.emoji === (currentProfile.avatar || '👤')); });
    document.getElementById('profile-modal').classList.add('active');
  }
  function selectEmoji(em) {
    document.getElementById('profile-avatar-preview').textContent = em;
    document.querySelectorAll('.emoji-option').forEach(function (e) { e.classList.toggle('selected', e.dataset.emoji === em); });
  }
  async function saveProfile() {
    if (!currentUser) return;
    var name = document.getElementById('profile-name').value.trim();
    if (!name) { toast('请输入昵称', 'error'); return; }
    try {
      var { error } = await sb.from('profiles').update({
        display_name: name, bio: document.getElementById('profile-bio').value.trim(),
        avatar: document.getElementById('profile-avatar-preview').textContent
      }).eq('id', currentUser.id);
      if (error) throw error;
      currentProfile.display_name = name;
      currentProfile.bio = document.getElementById('profile-bio').value.trim();
      currentProfile.avatar = document.getElementById('profile-avatar-preview').textContent;
      document.getElementById('profile-modal').classList.remove('active');
      toast('个人信息已更新', 'success'); updateNav();
    } catch (e) { toast('保存失败', 'error'); }
  }

  async function renderHome() {
    var c = document.getElementById('articles-grid'), cn = document.getElementById('articles-count'), si = document.getElementById('search-result-info');
    if (!sb) { c.innerHTML = '<div class="empty-state"><p>数据库未连接</p></div>'; return; }
    c.innerHTML = '<div class="empty-state"><p>加载中...</p></div>';
    try {
      var articles = null;
      if (homeCache && (Date.now() - homeCacheAt) < HOME_CACHE_TTL) {
        articles = homeCache;
      } else {
        var homeRes = await sb.from('articles').select('*, author:profiles(*)').order('created_at', { ascending: false }).limit(200);
        if (homeRes.error) throw homeRes.error;
        articles = homeRes.data || [];
        homeCache = articles;
        homeCacheAt = Date.now();
      }
      var f = articles;
      if (searchQuery) {
        var q = searchQuery.toLowerCase();
        f = articles.filter(function (a) {
          return (a.title || '').toLowerCase().indexOf(q) !== -1 || (a.content || '').toLowerCase().indexOf(q) !== -1 || (a.tag || '').toLowerCase().indexOf(q) !== -1;
        });
        si.textContent = '搜索 "' + searchQuery + '" 找到 ' + f.length + ' 篇文章'; si.classList.add('show');
      } else { si.classList.remove('show'); }
      if (cn) cn.textContent = '（共 ' + f.length + ' 篇）';
      if (!f.length) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>' + (searchQuery ? '没有找到匹配的文章' : '还没有文章，快来写第一篇吧！') + '</p></div>'; return; }
      var aids = f.map(function (a) { return a.id; });
      var lk = [];
      var cm = [];
      if (aids.length) {
        var statRes = await Promise.all([
          sb.from('likes').select('article_id').in('article_id', aids),
          sb.from('comments').select('article_id').in('article_id', aids)
        ]);
        lk = statRes[0].data || [];
        cm = statRes[1].data || [];
      }
      var lc = {}, cc = {};
      (lk || []).forEach(function (l) { lc[l.article_id] = (lc[l.article_id] || 0) + 1; });
      (cm || []).forEach(function (c) { cc[c.article_id] = (cc[c.article_id] || 0) + 1; });
      var h = '';
      f.forEach(function (a) {
        var au = a.author || {};
        h += '<div class="article-card" onclick="window.App.viewArticle(\'' + a.id + '\')">' +
          '<div class="card-meta"><span class="card-tag">' + esc(a.tag || '未分类') + '</span><span>' + ago(a.created_at) + '</span></div>' +
          '<div class="card-title">' + esc(a.title) + '</div>' +
          '<div class="card-excerpt">' + esc(trunc(a.content, 120)) + '</div>' +
          '<div class="card-footer"><div class="card-stats"><span>❤️ ' + (lc[a.id] || 0) + '</span><span>💬 ' + (cc[a.id] || 0) + '</span></div>' +
          '<div class="card-author"><div class="mini-avatar">' + (au.avatar || '👤') + '</div><span>' + esc(au.display_name || '匿名') + '</span></div></div></div>';
      });
      c.innerHTML = h;
    } catch (e) { c.innerHTML = '<div class="empty-state"><p>加载失败，请检查网络后刷新</p></div>'; }
  }

  function onSearch(v) { searchQuery = v.trim(); document.getElementById('search-clear').classList.toggle('show', !!searchQuery); renderHome(); }
  function clearSearch() { document.getElementById('search-input').value = ''; searchQuery = ''; document.getElementById('search-clear').classList.remove('show'); document.getElementById('search-result-info').classList.remove('show'); renderHome(); }

  async function renderArticle(id) {
    var c = document.getElementById('article-detail-content');
    c.innerHTML = '<div class="empty-state"><p>加载中...</p></div>';
    try {
      var { data: a, error } = await sb.from('articles').select('*, author:profiles(*)').eq('id', id).single();
      if (error) throw error;
      sb.rpc('increment_article_view', { article_uuid: id }).catch(function () {});
      var au = a.author || {};
      var promises = [
        sb.from('comments').select('*, author:profiles(*)').eq('article_id', id).order('created_at', { ascending: false }),
        sb.from('likes').select('*', { count: 'exact', head: true }).eq('article_id', id),
        currentUser
          ? sb.from('likes').select('id').eq('article_id', id).eq('user_id', currentUser.id).maybeSingle()
          : Promise.resolve({ data: null }),
        (function () {
          var rq = sb.from('articles').select('id,title,tag').neq('id', id).order('created_at', { ascending: false }).limit(6);
          if (a.tag) rq = rq.eq('tag', a.tag);
          return rq;
        })()
      ];
      var results = await Promise.all(promises);
      var comments = results[0].data || [];
      var likeCount = results[1].count || 0;
      var liked = !!(currentUser && results[2].data);
      var relList = results[3].data || [];
      currentArticle = a;
      var ch = '';
      if (!comments || !comments.length) ch = '<p style="color:var(--text-muted);font-size:0.88rem;">暂无评论</p>';
      else comments.forEach(function (c) {
        var ca = c.author || {};
        ch += '<div class="comment-item"><div class="comment-avatar">' + (ca.avatar || '👤') + '</div><div class="comment-body"><div class="comment-author">' + esc(ca.display_name || '匿名') + '</div><div class="comment-text">' + esc(c.text) + '</div><div class="comment-time">' + ago(c.created_at) + '</div></div></div>';
      });
      var editBtn = canEditArticle(a) ? '<button class="btn btn-sm btn-secondary" onclick="window.App.editArticle(\'' + id + '\')">✏️ 编辑本文</button>' : '';
      var mdx = md(a.content || '');
      var readMin = estimateReadingTime(a.content || '');
      var relatedHtml = '';
      if (relList.length) {
        relatedHtml = '<section class="related-section"><h3 class="related-title">相关阅读</h3><div class="related-list">';
        relList.slice(0, 4).forEach(function (ra) {
          relatedHtml += '<a class="related-link" onclick="window.App.viewArticle(\'' + ra.id + '\')">' + esc(ra.title) + '</a>';
        });
        relatedHtml += '</div></section>';
      }
      var shareBar = '<div class="article-share">' +
        '<button type="button" class="btn btn-sm btn-secondary" onclick="window.App.copyArticleLink()">🔗 复制文章链接</button>' +
        '</div>';
      c.innerHTML = '<button class="back-btn" onclick="window.App.goBack()">← 返回上一页</button>' +
        '<div class="article-detail-layout">' +
        '<div class="article-detail-main">' +
        '<div class="detail-header"><h1 class="detail-title">' + esc(a.title) + '</h1>' +
        '<div class="detail-meta"><span class="meta-author"><span class="meta-avatar">' + (au.avatar || '👤') + '</span>' + esc(au.display_name || '匿名') + '</span>' +
        '<span class="card-tag">' + esc(a.tag || '未分类') + '</span><span>' + ago(a.created_at) + '</span>' +
        '<span class="read-time">约 ' + readMin + ' 分钟阅读</span></div></div>' +
        shareBar +
        '<div class="markdown-body article-markdown">' + mdx.html + '</div>' +
        '<div class="detail-actions"><button class="btn btn-sm ' + (liked ? 'btn-danger' : 'btn-secondary') + '" onclick="window.App.toggleLike(\'' + id + '\')">' + (liked ? '❤️ 已赞 ' : '🤍 赞 ') + likeCount + '</button>' + editBtn +
        '<span style="color:var(--text-muted);font-size:0.88rem;">💬 ' + (comments ? comments.length : 0) + ' 条评论</span></div>' +
        relatedHtml +
        '<div class="comments-section"><h3>💬 评论</h3>' +
        (currentUser ? '<div class="comment-form"><input id="comment-input" placeholder="写下你的评论..." maxlength="500"><button class="btn btn-sm btn-primary" style="width:auto" onclick="window.App.addComment(\'' + id + '\')">发送</button></div>' :
        '<p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem;">登录后即可评论</p>') +
        '<div class="comment-list">' + ch + '</div></div></div>' +
        (mdx.tocHtml || '') +
        '</div>';
    } catch (e) { toast('加载失败', 'error'); navigate('home'); }
  }

  async function toggleLike(aid) {
    if (!currentUser) { toast('请先登录', 'error'); return; }
    try {
      var { data: ex } = await sb.from('likes').select('id').eq('article_id', aid).eq('user_id', currentUser.id).maybeSingle();
      if (ex) { await sb.from('likes').delete().eq('id', ex.id); }
      else { await sb.from('likes').insert({ article_id: aid, user_id: currentUser.id }); }
      renderArticle(aid);
    } catch (e) { toast('操作失败', 'error'); }
  }

  async function addComment(aid) {
    if (!currentUser) return;
    var inp = document.getElementById('comment-input'), txt = inp.value.trim();
    if (!txt) { toast('请输入评论内容', 'error'); return; }
    try {
      var { error } = await sb.from('comments').insert({ text: txt, article_id: aid, author_id: currentUser.id });
      if (error) throw error;
      inp.value = ''; toast('评论成功', 'success'); renderArticle(aid);
    } catch (e) { toast('评论失败', 'error'); }
  }

  async function renderAdmin() {
    if (!currentProfile || currentProfile.role !== 'admin') { navigate('home'); return; }
    try {
      var allRes = await Promise.all([
        sb.from('articles').select('*, author:profiles(*)').order('created_at', { ascending: false }).limit(200),
        sb.from('profiles').select('*', { count: 'exact', head: true }),
        sb.from('comments').select('*', { count: 'exact', head: true })
      ]);
      var articles = allRes[0].data || [];
      var ucount = allRes[1].count || 0;
      var ccount = allRes[2].count || 0;
      var visitRows = [];
      try {
        var visitsRes = await sb.from('site_daily_stats').select('day,total_visits').order('day', { ascending: false }).limit(14);
        visitRows = visitsRes.data || [];
      } catch (eStats) {}
      document.getElementById('stat-articles').textContent = articles ? articles.length : 0;
      document.getElementById('stat-users').textContent = ucount || 0;
      document.getElementById('stat-comments').textContent = ccount || 0;
      var totalViews = sumArticleViews(articles);
      var viewsEl = document.getElementById('stat-views-total');
      if (viewsEl) viewsEl.textContent = String(totalViews);
      renderVisitBars(visitRows.slice().reverse());
      var tb = document.getElementById('admin-tbody');
      if (!articles || !articles.length) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">暂无文章</td></tr>'; return; }
      var h = '';
      articles.forEach(function (a) {
        var au = a.author || {};
        var vc = typeof a.view_count === 'number' ? a.view_count : parseInt(a.view_count, 10) || 0;
        h += '<tr><td class="table-title">' + esc(a.title) + '</td><td><span class="card-tag">' + esc(a.tag || '未分类') + '</span></td>' +
          '<td style="font-size:0.82rem;color:var(--text-muted);">' + esc(au.display_name || '匿名') + '</td>' +
          '<td style="font-size:0.82rem;color:var(--text-muted);">' + ago(a.created_at) + '</td>' +
          '<td style="font-size:0.82rem;color:var(--accent-cyan);text-align:right;">' + vc + '</td>' +
          '<td class="table-actions"><button class="btn btn-sm btn-secondary" onclick="window.App.editArticle(\'' + a.id + '\')">编辑</button>' +
          '<button class="btn btn-sm btn-danger" onclick="window.App.confirmDelete(\'' + a.id + '\')">删除</button></td></tr>';
      });
      tb.innerHTML = h;
      loadBackgroundMusic();
    } catch (e) { toast('加载失败', 'error'); }
  }

  async function openEditor(aid) {
    editingArticleId = aid || null;
    var te = document.getElementById('editor-title'), tg = document.getElementById('editor-tag'), tc = document.getElementById('editor-content');
    if (aid) {
      document.getElementById('editor-modal-title').textContent = '编辑文章';
      var { data: a } = await sb.from('articles').select('*').eq('id', aid).single();
      if (a && !canEditArticle(a)) { toast('你无权编辑该文章', 'error'); return; }
      if (a) { te.value = a.title || ''; tg.value = a.tag || ''; tc.value = a.content || ''; updatePreview(); }
    } else {
      document.getElementById('editor-modal-title').textContent = '写文章';
      te.value = ''; tg.value = ''; tc.value = '';
      document.getElementById('editor-preview').innerHTML = '<div class="markdown-body" style="color:var(--text-muted);text-align:center;padding:3rem;">预览区域</div>';
      updateEditorStats();
    }
    switchTab('edit'); document.getElementById('editor-modal').classList.add('active');
  }
  function closeEditor() {
    var em = document.querySelector('#editor-modal .modal.modal--editor');
    if (em) em.classList.remove('modal--editor-full');
    document.getElementById('editor-modal').classList.remove('active');
    editingArticleId = null;
  }
  function switchTab(t) {
    document.querySelectorAll('.editor-tab').forEach(function (e) { e.classList.toggle('active', e.dataset.tab === t); });
    var editArea = document.getElementById('editor-edit-area');
    var previewArea = document.getElementById('editor-preview');
    if (editArea) editArea.style.display = t === 'edit' ? 'flex' : 'none';
    if (previewArea) {
      previewArea.style.display = t === 'preview' ? 'block' : 'none';
      previewArea.classList.toggle('show', t === 'preview');
    }
    if (t === 'preview') updatePreview();
  }
  function updateEditorStats() {
    var ta = document.getElementById('editor-content');
    if (!ta) return;
    var v = ta.value;
    var lines = v.length ? v.split('\n').length : 1;
    var ch = v.length;
    var elCh = document.getElementById('editor-stat-chars');
    var elLn = document.getElementById('editor-stat-lines');
    var elRd = document.getElementById('editor-stat-read');
    if (elCh) elCh.textContent = String(ch);
    if (elLn) elLn.textContent = String(lines);
    if (elRd) elRd.textContent = v.length ? String(estimateReadingTime(v)) : '0';
  }

  function updatePreview() {
    var raw = document.getElementById('editor-content').value;
    var r = md(raw);
    document.getElementById('editor-preview').innerHTML = '<div class="markdown-body">' + r.html + '</div>';
    updateEditorStats();
  }

  function insertAtCursor(text) {
    var ta = document.getElementById('editor-content');
    if (!ta) return;
    var s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.substring(0, s) + text + ta.value.substring(e);
    ta.focus();
    var pos = s + text.length;
    ta.setSelectionRange(pos, pos);
    updatePreview();
  }

  function insMd(b, a, p) {
    var ta = document.getElementById('editor-content'), s = ta.selectionStart, e = ta.selectionEnd;
    var sel = ta.value.substring(s, e) || p || '';
    ta.value = ta.value.substring(0, s) + b + sel + (a || '') + ta.value.substring(e);
    ta.focus(); ta.setSelectionRange(s + b.length, s + b.length + sel.length); updatePreview();
  }

  function toggleEditorFullscreen() {
    var m = document.querySelector('#editor-modal .modal.modal--editor');
    if (m) m.classList.toggle('modal--editor-full');
  }

  function onEditorKeydown(ev) {
    if (!ev) return;
    if (ev.ctrlKey && (ev.key === 'b' || ev.key === 'B')) { ev.preventDefault(); toolbarAction('bold'); return; }
    if (ev.ctrlKey && (ev.key === 'i' || ev.key === 'I')) { ev.preventDefault(); toolbarAction('italic'); return; }
    if (ev.key === 'Tab') { ev.preventDefault(); insertAtCursor('  '); return; }
  }

  function toolbarAction(act) {
    if (act === 'image') {
      var imageInput = document.getElementById('editor-image-input');
      if (imageInput) imageInput.click();
      return;
    }
    if (act === 'strike') { insMd('~~', '~~', '删除线'); return; }
    if (act === 'task') { insMd('- [ ] ', '', '任务'); return; }
    if (act === 'codepy') { insMd('\n```python\n', '\n```\n', 'print("hello")'); return; }
    if (act === 'codebash') { insMd('\n```bash\n', '\n```\n', 'echo hello'); return; }
    if (act === 'codets') { insMd('\n```typescript\n', '\n```\n', 'const x: number = 1'); return; }
    if (act === 'codejson') { insMd('\n```json\n', '\n```\n', '{\n  "key": "value"\n}'); return; }
    if (act === 'codemermaid') { insMd('\n```mermaid\n', '\n```\n', 'graph LR\n  A-->B'); return; }
    if (act === 'table') {
      var ta = document.getElementById('editor-content');
      var ins = '\n| 列1 | 列2 |\n| --- | --- |\n| 内容A | 内容B |\n';
      var s = ta.selectionStart;
      ta.value = ta.value.substring(0, s) + ins + ta.value.substring(s);
      ta.focus(); ta.setSelectionRange(s + ins.length, s + ins.length); updatePreview(); return;
    }
    var m = {
      h1: ['# ', '', '一级标题'], h2: ['## ', '', '二级标题'], h3: ['### ', '', '三级标题'], h4: ['#### ', '', '四级标题'],
      bold: ['**', '**', '粗体'], italic: ['*', '*', '斜体'], code: ['`', '`', '代码'],
      codeblock: ['\n```js\n', '\n```\n', 'console.log(1)'],
      quote: ['> ', '', '引用'], ul: ['- ', '', '列表项'], ol: ['1. ', '', '列表项'],
      link: ['[', '](https://)', '链接'], image: ['![', '](https://)', '图片'], hr: ['\n---\n', '', '']
    };
    var r = m[act]; if (r) insMd(r[0], r[1], r[2]);
  }

  function copyArticleLink() {
    if (!currentArticle || !currentArticle.id) { toast('无法复制链接', 'error'); return; }
    var url = '';
    try {
      var u = new URL(window.location.href);
      u.searchParams.set('article', currentArticle.id);
      url = u.toString();
    } catch (e) {
      var base = window.location.href.split('#')[0].split('?')[0];
      url = base + '?article=' + encodeURIComponent(currentArticle.id);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast('链接已复制', 'success'); }).catch(function () { prompt('复制链接', url); });
    } else {
      prompt('复制链接', url);
    }
  }

  async function saveArticle() {
    if (!currentUser) { toast('请先登录', 'error'); return; }
    var title = document.getElementById('editor-title').value.trim();
    var tag = document.getElementById('editor-tag').value.trim();
    var content = document.getElementById('editor-content').value.trim();
    if (!title) { toast('请输入文章标题', 'error'); return; }
    if (!content) { toast('请输入文章内容', 'error'); return; }
    try {
      if (editingArticleId) {
        var { data: oldArticle } = await sb.from('articles').select('author_id').eq('id', editingArticleId).single();
        if (oldArticle && !canEditArticle(oldArticle)) { toast('你无权修改该文章', 'error'); return; }
        var { error } = await sb.from('articles').update({ title: title, tag: tag || '未分类', content: content }).eq('id', editingArticleId);
        if (error) throw error; toast('文章已更新', 'success');
      } else {
        var { error: e2 } = await sb.from('articles').insert({ title: title, tag: tag || '未分类', content: content, author_id: currentUser.id });
        if (e2) throw e2; toast('文章发布成功', 'success');
      }
      homeCache = null;
      homeCacheAt = 0;
      setDrafts(getDrafts().filter(function (d) { return d.content !== content || d.title !== title; }));
      closeEditor();
      if (currentView === 'admin') renderAdmin(); else if (currentView === 'home') renderHome();
    } catch (e) { toast('保存失败：' + e.message, 'error'); }
  }
  function editArticle(id) { openEditor(id); }

  function confirmDelete(id) {
    document.getElementById('confirm-overlay').classList.add('active');
    document.getElementById('confirm-delete-btn').onclick = function () { deleteArticle(id); document.getElementById('confirm-overlay').classList.remove('active'); };
  }
  async function deleteArticle(id) {
    try {
      await sb.from('comments').delete().eq('article_id', id);
      await sb.from('likes').delete().eq('article_id', id);
      var { error } = await sb.from('articles').delete().eq('id', id);
      if (error) throw error; toast('文章已删除', 'success');
      homeCache = null;
      homeCacheAt = 0;
      if (currentView === 'admin') renderAdmin(); else navigate('home');
    } catch (e) { toast('删除失败', 'error'); }
  }

  window.App = {
    navigate: navigate, goBack: goBack, viewArticle: function (id) { navigate('article', id); },
    doRegister: doRegister, doLogin: doLogin, doLogout: doLogout,
    togglePassword: togglePassword,
    toggleDropdown: toggleDropdown, openProfile: openProfile,
    selectEmoji: selectEmoji, saveProfile: saveProfile,
    closeEditor: closeEditor, openEditor: openEditor,
    saveArticle: saveArticle, editArticle: editArticle,
    confirmDelete: confirmDelete, toggleLike: toggleLike,
    addComment: addComment, onSearch: onSearch, clearSearch: clearSearch,
    switchEditorTab: switchTab, toolbarAction: toolbarAction,
    updatePreview: updatePreview, updateEditorStats: updateEditorStats,
    toggleEditorFullscreen: toggleEditorFullscreen, onEditorKeydown: onEditorKeydown,
    refreshCaptcha: genCaptcha,
    saveDraft: saveDraft, openDrafts: openDrafts, useDraft: useDraft, deleteDraft: deleteDraft,
    saveBackgroundMusic: saveBackgroundMusic, clearBackgroundMusic: clearBackgroundMusic,
    copyArticleLink: copyArticleLink,
    toast: toast
  };

  document.addEventListener('DOMContentLoaded', async function () {
    if (!isConfigured) {
      document.getElementById('view-home').innerHTML =
        '<div class="auth-container" style="max-width:620px;margin:3rem auto;">' +
        '<h2>⚙️ 数据库配置</h2><p class="auth-subtitle">博客需要连接 Supabase 云数据库</p>' +
        '<div style="text-align:left;background:rgba(15,23,42,0.8);padding:1.5rem;border-radius:8px;margin:1.5rem 0;font-size:0.88rem;line-height:2;color:var(--text-secondary);">' +
        '<p><strong style="color:var(--accent-cyan);">步骤一：</strong>打开 supabase.com 注册</p>' +
        '<p><strong style="color:var(--accent-cyan);">步骤二：</strong>创建项目，区域选 Tokyo</p>' +
        '<p><strong style="color:var(--accent-cyan);">步骤三：</strong>Settings → API 复制 URL 和 key</p>' +
        '<p><strong style="color:var(--accent-cyan);">步骤四：</strong>SQL Editor 执行建表语句</p>' +
        '<p><strong style="color:var(--accent-cyan);">步骤五：</strong>Authentication → 关闭 Email Confirmations</p>' +
        '<p><strong style="color:var(--accent-cyan);">步骤六：</strong>打开 js/app.js 替换前两行配置</p>' +
        '</div></div>';
      document.getElementById('view-home').classList.add('active'); return;
    }
    try {
      var { data: { user } } = await sb.auth.getUser();
      if (user) {
        currentUser = user;
        var { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single();
        currentProfile = p;
      }
    } catch (e) { try { await sb.auth.signOut(); } catch (_) {} }
    var deepArticle = null;
    try { deepArticle = new URLSearchParams(window.location.search).get('article'); } catch (e) {}
    trackSiteVisitIfNeeded();
    if (deepArticle) navigate('article', deepArticle);
    else navigate('home');
    document.addEventListener('click', function (e) {
      var dd = document.getElementById('user-dropdown'), ab = document.getElementById('user-avatar-btn');
      if (dd && ab && !dd.contains(e.target) && !ab.contains(e.target)) closeDropdown();
    });
    document.querySelectorAll('.modal-overlay').forEach(function (o) { o.addEventListener('click', function (e) { if (e.target === o) o.classList.remove('active'); }); });
    var co = document.getElementById('confirm-overlay');
    if (co) co.addEventListener('click', function (e) { if (e.target === co) co.classList.remove('active'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { document.querySelectorAll('.modal-overlay.active').forEach(function (m) { m.classList.remove('active'); }); document.getElementById('confirm-overlay').classList.remove('active'); } });
    var editorImageInput = document.getElementById('editor-image-input');
    if (editorImageInput) {
      editorImageInput.addEventListener('change', async function () {
        var file = editorImageInput.files && editorImageInput.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { toast('图片请小于 2MB', 'error'); editorImageInput.value = ''; return; }
        if (currentUser) {
          try {
            var p = 'images/' + currentUser.id + '/' + Date.now() + '_' + safeFileName(file.name);
            var upi = await sb.storage.from('blog-assets').upload(p, file, { upsert: true });
            if (!upi.error) {
              var pu = sb.storage.from('blog-assets').getPublicUrl(p);
              var url = pu.data && pu.data.publicUrl ? pu.data.publicUrl : '';
              if (url) {
                insMd('![图片](', ')', url);
                toast('图片上传成功', 'success');
                editorImageInput.value = '';
                return;
              }
            }
          } catch (e) {}
        }
        var fr = new FileReader();
        fr.onload = function () { insMd('![本地图片](', ')', fr.result); editorImageInput.value = ''; toast('已使用本地模式插入图片', 'info'); };
        fr.readAsDataURL(file);
      });
    }
  });
})();