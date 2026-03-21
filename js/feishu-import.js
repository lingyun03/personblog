/* ============================================
   TechBlog - Feishu Document Import (Enhanced)
   Fixes: CORS proxy reliability, error handling, fallback options
   Overrides: window.App.importFromFeishu
   ============================================ */

(function () {
  'use strict';

  /* ===== CORS Proxy Chain ===== */
  var PROXIES = [
    {
      name: 'corsproxy.io (v2)',
      build: function (url) {
        return 'https://corsproxy.io/?' + encodeURIComponent(url);
      }
    },
    {
      name: 'corsproxy.io (v1)',
      build: function (url) {
        return 'https://corsproxy.io/?url=' + encodeURIComponent(url);
      }
    },
    {
      name: 'allorigins',
      build: function (url) {
        return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
      }
    }
  ];

  /**
   * Fetch through CORS proxy chain with automatic fallback
   * @param {string} url - Target URL
   * @param {object} options - Fetch options (method, headers, body)
   * @returns {Promise<Response>}
   */
  async function proxyFetch(url, options) {
    options = options || {};
    var lastError = null;

    for (var i = 0; i < PROXIES.length; i++) {
      var proxy = PROXIES[i];
      try {
        var proxyUrl = proxy.build(url);

        // allorigins only supports GET, skip for POST
        if (options.method && options.method.toUpperCase() === 'POST' && i === 2) {
          continue;
        }

        var resp = await fetch(proxyUrl, {
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body || undefined
        });

        if (resp.ok) {
          return resp;
        }

        lastError = new Error(proxy.name + ' returned HTTP ' + resp.status);
      } catch (e) {
        lastError = e;
        console.warn('[Feishu Import] Proxy ' + proxy.name + ' failed:', e.message);
        continue;
      }
    }

    throw lastError || new Error('所有代理均不可用，请检查网络连接');
  }

  /**
   * Extract document_id from various Feishu URL formats
   */
  function extractDocId(url) {
    // /docx/DOCUMENT_ID
    var docxMatch = url.match(/\/docx\/([a-zA-Z0-9_-]+)/);
    if (docxMatch) return { type: 'docx', id: docxMatch[1] };

    // /wiki/SPACE_ID or /wiki/SPACE_ID?wikiToken=TOKEN
    var wikiMatch = url.match(/\/wiki\/([a-zA-Z0-9_-]+)/);
    if (wikiMatch) return { type: 'wiki', id: wikiMatch[1] };

    return null;
  }

  /**
   * Get tenant_access_token from Feishu
   */
  async function getAccessToken(appId, appSecret) {
    var tokenUrl = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';

    var resp = await proxyFetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret })
    });

    var data = await resp.json();

    if (data.code !== 0) {
      throw new Error('获取 Token 失败: ' + (data.msg || '未知错误') + ' (code: ' + data.code + ')');
    }

    return data.tenant_access_token;
  }

  /**
   * Resolve wiki node to actual document token
   */
  async function resolveWikiToken(token, wikiId) {
    var url = 'https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=' + wikiId;

    var resp = await proxyFetch(url, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });

    var data = await resp.json();

    if (data.code !== 0) {
      throw new Error('解析 Wiki 节点失败: ' + (data.msg || '未知错误') + ' (code: ' + data.code + ')');
    }

    var node = data.data && data.data.node;
    if (!node || !node.obj_token) {
      throw new Error('Wiki 节点未找到对应的文档');
    }

    return node.obj_token;
  }

  /**
   * Get document raw content blocks
   */
  async function getDocumentContent(token, docId) {
    var url = 'https://open.feishu.cn/open-apis/docx/v1/documents/' + docId + '/raw_content';

    var resp = await proxyFetch(url, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });

    var data = await resp.json();

    if (data.code !== 0) {
      throw new Error('获取文档内容失败: ' + (data.msg || '未知错误') + ' (code: ' + data.code + ')');
    }

    return data.data && data.data.items || [];
  }

  /**
   * Parse Feishu blocks to Markdown
   */
  function blocksToMarkdown(blocks) {
    var md = [];
    var inList = false;

    blocks.forEach(function (block) {
      var type = block.block_type;
      var text = extractText(block);

      // Close list if switching away from list type
      if (inList && type !== 4 && type !== 13) {
        md.push('');
        inList = false;
      }

      switch (type) {
        case 1: // Heading 1
          md.push('# ' + text);
          md.push('');
          break;
        case 2: // Heading 2
          md.push('## ' + text);
          md.push('');
          break;
        case 3: // Heading 3
          md.push('### ' + text);
          md.push('');
          break;
        case 4: // Bullet list
          md.push('- ' + text);
          inList = true;
          break;
        case 5: // Ordered list
          md.push('1. ' + text);
          inList = true;
          break;
        case 6: // Code block
          md.push('```');
          md.push(text);
          md.push('```');
          md.push('');
          break;
        case 7: // Quote
          md.push('> ' + text);
          md.push('');
          break;
        case 13: // Toggle / Callout
          md.push('> 💡 ' + text);
          md.push('');
          break;
        case 14: // Divider
          md.push('---');
          md.push('');
          break;
        case 15: // Image
          var imgKey = extractImageKey(block);
          if (imgKey) {
            md.push('![image](https://open.feishu.cn/open-apis/im/v1/images/' + imgKey + ')');
            md.push('');
          }
          break;
        case 17: // Table
          md.push(parseTableBlock(block));
          md.push('');
          break;
        default:
          if (text.trim()) {
            md.push(text);
            md.push('');
          }
      }
    });

    return md.join('\n').trim();
  }

  /**
   * Extract plain text from a block's inline elements
   */
  function extractText(block) {
    var elements = block[block.block_type + '_'] || {};
    var inlines = elements.elements || elements.text_elements || [];
    var parts = [];

    inlines.forEach(function (el) {
      if (el.text_run) {
        var t = el.text_run.content || '';
        // Bold
        if (el.text_run.text_element_style && el.text_run.text_element_style.bold) {
          t = '**' + t + '**';
        }
        // Italic
        if (el.text_run.text_element_style && el.text_run.text_element_style.italic) {
          t = '*' + t + '*';
        }
        // Inline code
        if (el.text_run.text_element_style && el.text_run.text_element_style.code) {
          t = '`' + t + '`';
        }
        // Strikethrough
        if (el.text_run.text_element_style && el.text_run.text_element_style.strikethrough) {
          t = '~~' + t + '~~';
        }
        // Link
        if (el.text_run.text_element_style && el.text_run.text_element_style.link) {
          var link = el.text_run.text_element_style.link;
          t = '[' + t + '](' + (link.url || '') + ')';
        }
        parts.push(t);
      } else if (el.mention_doc) {
        parts.push('[' + (el.mention_doc.title || '文档') + ']()');
      } else if (el.type === 'mention_user') {
        parts.push('@' + (el.user_id || 'user'));
      }
    });

    return parts.join('');
  }

  /**
   * Extract image key from block
   */
  function extractImageKey(block) {
    var img = block['15'] || {};
    return img.image && img.image.token || null;
  }

  /**
   * Parse table block to Markdown table
   */
  function parseTableBlock(block) {
    var table = block['17'] || {};
    var rows = table.table && table.table.rows || [];
    var lines = [];

    rows.forEach(function (row, rowIndex) {
      var cells = row.table_cells || [];
      var cellTexts = cells.map(function (cell) {
        var cellBlocks = cell.cell_blocks || [];
        return cellBlocks.map(function (cb) {
          return extractText(cb);
        }).join(' ');
      });
      lines.push('| ' + cellTexts.join(' | ') + ' |');

      // Add separator after header row
      if (rowIndex === 0) {
        lines.push('| ' + cellTexts.map(function () { return '---'; }).join(' | ') + ' |');
      }
    });

    return lines.join('\n');
  }

  /**
   * Show a detailed error toast with troubleshooting info
   */
  function showError(message, detail) {
    if (window.App && window.App.showToast) {
      window.App.showToast(message + (detail ? '\n' + detail : ''), 'error');
    } else {
      alert(message + (detail ? '\n\n' + detail : ''));
    }
  }

  /**
   * Main import function - overrides window.App.importFromFeishu
   */
  async function importFromFeishu() {
    var urlInput = document.getElementById('feishu-url');
    var appIdInput = document.getElementById('feishu-app-id');
    var appSecretInput = document.getElementById('feishu-app-secret');

    if (!urlInput || !appIdInput || !appSecretInput) {
      showError('飞书导入表单未找到');
      return;
    }

    var url = urlInput.value.trim();
    var appId = appIdInput.value.trim();
    var appSecret = appSecretInput.value.trim();

    // Validation
    if (!url) { showError('请输入飞书文档链接'); return; }
    if (!appId) { showError('请输入 App ID'); return; }
    if (!appSecret) { showError('请输入 App Secret'); return; }

    // Extract document ID
    var docInfo = extractDocId(url);
    if (!docInfo) {
      showError('无法识别文档链接格式', '支持格式:\n• https://xxx.feishu.cn/docx/DOCUMENT_ID\n• https://xxx.feishu.cn/wiki/WIKI_ID');
      return;
    }

    // Show loading state
    var btn = document.querySelector('[onclick*="importFromFeishu"]');
    var originalText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = '导入中...';
    }

    try {
      // Step 1: Get access token
      console.log('[Feishu Import] Step 1: Getting access token...');
      var accessToken = await getAccessToken(appId, appSecret);
      console.log('[Feishu Import] Token obtained successfully');

      // Step 2: Resolve wiki token if needed
      var docId = docInfo.id;
      if (docInfo.type === 'wiki') {
        console.log('[Feishu Import] Step 2: Resolving wiki token...');
        docId = await resolveWikiToken(accessToken, docInfo.id);
        console.log('[Feishu Import] Wiki resolved to:', docId);
      }

      // Step 3: Get document content
      console.log('[Feishu Import] Step 3: Fetching document content...');
      var blocks = await getDocumentContent(accessToken, docId);
      console.log('[Feishu Import] Got', blocks.length, 'blocks');

      if (blocks.length === 0) {
        showError('文档内容为空', '请确认文档有内容且应用有读取权限');
        return;
      }

      // Step 4: Convert to Markdown
      var markdown = blocksToMarkdown(blocks);
      console.log('[Feishu Import] Converted to markdown, length:', markdown.length);

      if (!markdown.trim()) {
        showError('文档转换结果为空', '文档可能只包含不支持的格式');
        return;
      }

      // Step 5: Fill the editor
      var editor = document.getElementById('editor-textarea');
      if (editor) {
        editor.value = markdown;
        // Trigger input event for any listeners
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (window.App && window.App.showToast) {
        window.App.showToast('飞书文档导入成功！共转换 ' + blocks.length + ' 个内容块', 'success');
      }

      // Close the import modal if open
      var modal = document.getElementById('feishu-import-modal');
      if (modal) {
        modal.style.display = 'none';
      }

    } catch (err) {
      console.error('[Feishu Import] Error:', err);

      var errorMsg = '飞书文档导入失败';
      var detail = '';

      if (err.message.indexOf('Failed to fetch') !== -1 || err.message.indexOf('NetworkError') !== -1) {
        detail = '网络请求失败，可能原因:\n1. CORS 代理服务暂时不可用\n2. 网络连接问题\n\n建议: 请稍后重试，或直接复制文档内容粘贴到编辑器中';
      } else if (err.message.indexOf('HTTP') !== -1) {
        detail = err.message + '\n\n建议: 检查 App ID 和 App Secret 是否正确';
      } else if (err.message.indexOf('Token') !== -1) {
        detail = err.message + '\n\n建议: 检查应用凭证是否正确，应用是否已启用';
      } else {
        detail = err.message + '\n\n建议: 请检查文档链接格式和应用权限配置';
      }

      showError(errorMsg, detail);
    } finally {
      // Restore button state
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  }

  /* ===== Override the original importFromFeishu ===== */
  // Wait for App to be defined, then override
  function overrideImport() {
    if (window.App) {
      window.App.importFromFeishu = importFromFeishu;
      console.log('[Feishu Import] Enhanced import module loaded');
    } else {
      // Retry after a short delay
      setTimeout(overrideImport, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', overrideImport);
  } else {
    overrideImport();
  }
})();
