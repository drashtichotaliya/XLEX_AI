(function () {
  'use strict';

  
  let chats        = [];
  let activeChatId = null;
  let isBusy       = false;
  let stopRequested = false;
  let activeAbort   = null;

  
  let inputEl, sendBtn, suggestionCards;
  let newChatBtn, historyBtn;
  let sidebarRecentSection;
  let chatViewEl     = null;
  let landingSection = null;
  let historyPanelEl = null;

  
  function loadChats() {
    try { chats = JSON.parse(localStorage.getItem('xlex_chats') || '[]'); } catch(_) { chats = []; }
  }
  function saveChats() {
    try { localStorage.setItem('xlex_chats', JSON.stringify(chats)); } catch(_) {}
  }

  
  function renderMD(text) {
    let h = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    h = h.replace(/```([\s\S]*?)```/g, (_,c) =>
      `<pre style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;margin:8px 0;overflow-x:auto;font-family:monospace;font-size:13px;"><code>${c.trim()}</code></pre>`);
    h = h.replace(/`([^`]+)`/g,
      '<code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px;">$1</code>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
    h = h.replace(/^[\-\*] (.+)$/gm, '<li style="margin-left:16px;list-style:disc;">$1</li>');
    h = h.replace(/(<li[\s\S]+?<\/li>)/g, '<ul style="margin:8px 0;">$1</ul>');
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;opacity:0.8;">$1</a>');
    h = h.replace(/\n/g, '<br>');
    return h;
  }

  function escText(t) {
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  
  (function injectKeyframes() {
    if (document.getElementById('xlex-keyframes')) return;
    const s = document.createElement('style');
    s.id = 'xlex-keyframes';
    s.textContent = `
      @keyframes xlexBounce {
        0%,100% { transform: translateY(0); opacity:0.4; }
        50%      { transform: translateY(-4px); opacity:1; }
      }
      #xlex-chat-bar input,
      #xlex-chat-bar input:focus,
      #xlex-landing-bar input,
      #xlex-landing-bar input:focus,
      main input[type="text"],
      main input[type="text"]:focus,
      #xlex-history-search,
      #xlex-history-search:focus {
        outline: none !important;
        box-shadow: none !important;
        border: none !important;
        -webkit-appearance: none;
      }
      #xlex-chat-bar:focus-within {
        border-color: rgba(226,194,138,0.4) !important;
        outline: none !important;
      }
      #xlex-chat-input::placeholder { color: rgba(158,158,158,0.6); }

      html.light .xlex-ai-bubble {
        color: #1c1a18 !important;
        background: rgba(0,0,0,0.04) !important;
        border-color: rgba(0,0,0,0.1) !important;
      }
      html.light .xlex-ai-bubble *,
      html.light .xlex-ai-bubble p,
      html.light .xlex-ai-bubble span,
      html.light .xlex-ai-bubble strong,
      html.light .xlex-ai-bubble b,
      html.light .xlex-ai-bubble em,
      html.light .xlex-ai-bubble i,
      html.light .xlex-ai-bubble li,
      html.light .xlex-ai-bubble ul,
      html.light .xlex-ai-bubble ol,
      html.light .xlex-ai-bubble br,
      html.light .xlex-ai-bubble div,
      html.light .xlex-ai-bubble a {
        color: #1c1a18 !important;
      }
      html.light .xlex-ai-bubble pre,
      html.light .xlex-ai-bubble code {
        background: rgba(0,0,0,0.07) !important;
        color: #1c1a18 !important;
      }

      /* DARK MODE: ensure AI bubble text is always visible */
      html.dark .xlex-ai-bubble,
      html:not(.light) .xlex-ai-bubble {
        color: #e5e2e0 !important;
        background: #20201e !important;
        border-color: rgba(255,255,255,0.15) !important;
      }
      html.dark .xlex-ai-bubble *,
      html:not(.light) .xlex-ai-bubble *,
      html.dark .xlex-ai-bubble strong,
      html:not(.light) .xlex-ai-bubble strong,
      html.dark .xlex-ai-bubble em,
      html:not(.light) .xlex-ai-bubble em,
      html.dark .xlex-ai-bubble li,
      html:not(.light) .xlex-ai-bubble li,
      html.dark .xlex-ai-bubble p,
      html:not(.light) .xlex-ai-bubble p,
      html.dark .xlex-ai-bubble a,
      html:not(.light) .xlex-ai-bubble a {
        color: #e5e2e0 !important;
      }
      html.dark .xlex-ai-bubble pre,
      html:not(.light) .xlex-ai-bubble pre,
      html.dark .xlex-ai-bubble code,
      html:not(.light) .xlex-ai-bubble code {
        background: rgba(255,255,255,0.08) !important;
        color: #e5e2e0 !important;
      }

      html.light #xlex-chat-input,
      html.light #xlex-chat-input:focus,
      html.light #xlex-chat-input:not(:placeholder-shown),
      html.light main input[type="text"],
      html.light main input[type="text"]:focus,
      html.light main input[type="text"]:not(:placeholder-shown) {
        color: #1c1a18 !important;
        -webkit-text-fill-color: #1c1a18 !important;
        caret-color: #7a5c18 !important;
      }
      html.dark #xlex-chat-input,
      html.dark #xlex-chat-input:focus {
        color: #e5e2e0 !important;
        -webkit-text-fill-color: #e5e2e0 !important;
        caret-color: #e2c28a !important;
      }
      html:not(.light) #xlex-chat-input {
        color: #e5e2e0 !important;
        -webkit-text-fill-color: #e5e2e0 !important;
      }

      .xlex-file-chip {
        display:inline-flex;align-items:center;gap:6px;
        background:rgba(226,194,138,0.1);border:1px solid rgba(226,194,138,0.25);
        border-radius:20px;padding:4px 10px 4px 8px;font-size:12px;
        color:#e2c28a;max-width:200px;
      }
      .xlex-file-chip span.name {
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;
      }
      .xlex-file-chip button {
        background:none;border:none;cursor:pointer;padding:0;color:#e2c28a;
        opacity:0.6;font-size:14px;line-height:1;flex-shrink:0;
      }
      .xlex-file-chip button:hover { opacity:1; }

      .xlex-edit-btn {
        display:inline-flex;align-items:center;gap:6px;
        margin-top:8px;
        background:rgba(226,194,138,0.15);
        border:1px solid rgba(226,194,138,0.35);
        border-radius:9999px;padding:6px 14px;
        color:#e2c28a;font-size:12px;font-family:Manrope,sans-serif;
        cursor:pointer;transition:background 0.2s,border-color 0.2s;
      }
      .xlex-edit-btn:hover {
        background:rgba(226,194,138,0.28);
        border-color:rgba(226,194,138,0.6);
      }
      html.light .xlex-edit-btn {
        background:rgba(122,92,24,0.12);
        border-color:rgba(122,92,24,0.35);
        color:#7a5c18;
      }
      html.light .xlex-edit-btn:hover {
        background:rgba(122,92,24,0.22);
        border-color:rgba(122,92,24,0.6);
      }

      /* Thumbnail preview for images inside user bubble */
      .xlex-img-thumb {
        max-width:180px;max-height:120px;border-radius:8px;
        margin:6px 2px 0;object-fit:cover;display:inline-block;
        border:1px solid rgba(255,255,255,0.15);
      }
    `;
    document.head.appendChild(s);
  })();

  
  function buildChatView() {
    const main = document.querySelector('main');
    if (!main || document.getElementById('xlex-chat-view')) return;

    chatViewEl = document.createElement('div');
    chatViewEl.id = 'xlex-chat-view';
    Object.assign(chatViewEl.style, {
      display: 'none',
      flexDirection: 'column',
      flex: '1',
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
    });

    /* Scrollable messages wrapper */
    const msgsWrapper = document.createElement('div');
    msgsWrapper.id = 'xlex-msgs-wrapper';
    msgsWrapper.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;padding:96px 24px 8px;display:flex;flex-direction:column;gap:16px;scrollbar-gutter:stable;';
    chatViewEl.appendChild(msgsWrapper);

    const msgsArea = document.createElement('div');
    msgsArea.id = 'xlex-messages';
    msgsArea.style.cssText = 'display:flex;flex-direction:column;gap:16px;flex:1;';
    msgsWrapper.appendChild(msgsArea);

    const filePreviewRow = document.createElement('div');
    filePreviewRow.id = 'xlex-file-preview';
    filePreviewRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:0 4px;min-height:0;';
    msgsWrapper.appendChild(filePreviewRow);



    /* Input bar container - fixed at bottom of chatViewEl */
    const chatBarOuter = document.createElement('div');
    chatBarOuter.style.cssText = 'flex-shrink:0;padding:12px 24px 24px;background:transparent;';

    const chatBar = document.createElement('div');
    chatBar.id = 'xlex-chat-bar';
    chatBar.style.cssText = `
      display:flex;align-items:center;gap:8px;
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.1);
      border-radius:9999px;
      padding:8px 8px 8px 12px;
      max-width:848px;
      margin:0 auto;
      transition:border-color 0.2s;
    `;

    const hiddenFileInput = document.createElement('input');
    hiddenFileInput.type = 'file';
    hiddenFileInput.id   = 'xlex-file-input-chat';
    hiddenFileInput.multiple = true;
    hiddenFileInput.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md';
    hiddenFileInput.style.cssText = 'display:none;';
    hiddenFileInput.addEventListener('change', () => handleFileSelect(hiddenFileInput));
    chatBar.appendChild(hiddenFileInput);

    const attachBtn = document.createElement('button');
    attachBtn.id = 'xlex-attach-btn-chat';
    attachBtn.title = 'Attach files';
    attachBtn.style.cssText = `
      width:36px;height:36px;border-radius:50%;background:transparent;border:none;
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      flex-shrink:0;color:rgba(158,158,158,0.7);transition:color 0.2s,background 0.2s;
    `;
    attachBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;">attach_file</span>';
    attachBtn.addEventListener('mouseenter', () => { attachBtn.style.color='#e2c28a'; attachBtn.style.background='rgba(226,194,138,0.08)'; });
    attachBtn.addEventListener('mouseleave', () => { attachBtn.style.color='rgba(158,158,158,0.7)'; attachBtn.style.background='transparent'; });
    attachBtn.addEventListener('click', () => hiddenFileInput.click());
    chatBar.appendChild(attachBtn);

    const chatInput = document.createElement('input');
    chatInput.id          = 'xlex-chat-input';
    chatInput.type        = 'text';
    chatInput.placeholder = 'Ask XLEX AI';
    const isLightNow = document.documentElement.classList.contains('light');
    chatInput.style.cssText = `
      flex:1;background:transparent;border:none;outline:none;box-shadow:none;
      color:${isLightNow ? '#1c1a18' : '#e5e2e0'};
      font-size:15px;font-family:Manrope,sans-serif;
      caret-color:${isLightNow ? '#7a5c18' : '#e2c28a'};
      -webkit-appearance:none;
      -webkit-text-fill-color:${isLightNow ? '#1c1a18' : '#e5e2e0'};
    `;

    /* Theme changes are handled by CSS rules injected in injectKeyframes() */
    /* We use a lightweight class-based observer only once in init() */

    const chatSend = document.createElement('button');
    chatSend.id = 'xlex-chat-send';
    chatSend.style.cssText = `
      width:44px;height:44px;border-radius:50%;
      background:#e2c28a;border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;transition:opacity 0.2s,transform 0.15s;
    `;
    chatSend.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;color:#1c1a18;font-variation-settings:\'FILL\' 1;">arrow_forward</span>';

    chatBar.appendChild(chatInput);
    chatBar.appendChild(chatSend);
    chatBarOuter.appendChild(chatBar);
    chatViewEl.appendChild(chatBarOuter);

    const footer = main.querySelector('footer');
    if (footer) main.insertBefore(chatViewEl, footer);
    else main.appendChild(chatViewEl);

    chatSend.addEventListener('click', () => {
      if (isBusy) { stopStreaming(); return; }
      const text = chatInput.value.trim();
      if (!text && pendingFiles.length === 0) return;
      chatInput.value = '';
      sendChat(text);
    });

    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = chatInput.value.trim();
        if ((!text && pendingFiles.length === 0) || isBusy) return;
        chatInput.value = '';
        sendChat(text);
      }
    });
  }

  
  let pendingFiles = [];

  function handleFileSelect(fileInput) {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;
    pendingFiles = pendingFiles.concat(files);
    renderFilePreview();
    fileInput.value = '';
  }

  function renderFilePreview() {
    /* Update whichever preview rows exist (chat view + landing) */
    const rows = [
      document.getElementById('xlex-file-preview'),
      document.getElementById('xlex-landing-file-preview'),
    ].filter(Boolean);
    if (!rows.length) return;
    rows.forEach(row => {
      row.innerHTML = '';
      pendingFiles.forEach((f, idx) => {
        const chip = document.createElement('div');
        chip.className = 'xlex-file-chip';

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.style.fontSize = '14px';
        icon.textContent = getFileIcon(f.name);

        const name = document.createElement('span');
        name.className = 'name';
        name.title = f.name;
        name.textContent = f.name;

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove';
        removeBtn.addEventListener('click', () => {
          pendingFiles.splice(idx, 1);
          renderFilePreview();
        });

        chip.appendChild(icon);
        chip.appendChild(name);
        chip.appendChild(removeBtn);
        row.appendChild(chip);
      });
    });
  }

  function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'picture_as_pdf';
    if (['doc','docx'].includes(ext)) return 'description';
    if (['xls','xlsx','csv'].includes(ext)) return 'table_chart';
    if (['mp4','mov','avi','webm'].includes(ext)) return 'videocam';
    if (['mp3','wav','ogg'].includes(ext)) return 'audio_file';
    if (['zip','rar','tar','gz'].includes(ext)) return 'folder_zip';
    return 'attach_file';
  }

  function isImageFile(name) {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
  }

  function isPDFFile(name) {
    return /\.pdf$/i.test(name);
  }

  function patchLandingInputBar() {
    const mainInput = document.querySelector('main input[type="text"]');
    if (!mainInput || document.getElementById('xlex-landing-attach')) return;

    const container = mainInput.closest('div');
    if (!container) return;

    const hiddenFile = document.createElement('input');
    hiddenFile.type = 'file';
    hiddenFile.id = 'xlex-file-input-landing';
    hiddenFile.multiple = true;
    hiddenFile.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md';
    hiddenFile.style.cssText = 'display:none;';
    hiddenFile.addEventListener('change', () => handleFileSelect(hiddenFile));
    container.appendChild(hiddenFile);

    const attachBtn = document.createElement('button');
    attachBtn.id = 'xlex-landing-attach';
    attachBtn.title = 'Attach files';
    attachBtn.style.cssText = `
      width:40px;height:40px;border-radius:50%;background:transparent;border:none;
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      flex-shrink:0;color:rgba(158,158,158,0.7);transition:color 0.2s,background 0.2s;
      margin-right:4px;
    `;
    attachBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;">attach_file</span>';
    attachBtn.addEventListener('mouseenter', () => { attachBtn.style.color='#e2c28a'; attachBtn.style.background='rgba(226,194,138,0.08)'; });
    attachBtn.addEventListener('mouseleave', () => { attachBtn.style.color='rgba(158,158,158,0.7)'; attachBtn.style.background='transparent'; });
    attachBtn.addEventListener('click', () => hiddenFile.click());

    const sendWrapper = container.querySelector('.flex.items-center.gap-2');
    if (sendWrapper) {
      container.insertBefore(attachBtn, sendWrapper);
    } else {
      container.appendChild(attachBtn);
    }

    const pill = mainInput.closest('.relative.flex.items-center');
    const landingPreview = document.createElement('div');
    landingPreview.id = 'xlex-landing-file-preview';
    landingPreview.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:8px 4px 0;min-height:0;';
    if (pill && pill.parentNode) {
      pill.parentNode.insertBefore(landingPreview, pill.nextSibling);
    }
  }

  
  function showStopBtn() {
    const btn = document.getElementById('xlex-chat-send');
    if (!btn) return;
    btn.style.background = '#f87171';
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;color:#1c1a18;font-variation-settings:\'FILL\' 1;">stop</span>';
  }
  function hideStopBtn() {
    const btn = document.getElementById('xlex-chat-send');
    if (!btn) return;
    btn.style.background = '#e2c28a';
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;color:#1c1a18;font-variation-settings:\'FILL\' 1;">arrow_forward</span>';
  }

  function stopStreaming() {
    if (!isBusy) return;
    stopRequested = true;
    if (activeAbort) activeAbort.abort();
  }

  
  function addEditButtonToLastUserMessage() {
    const area = document.getElementById('xlex-messages');
    if (!area) return;

    const rows = Array.from(area.children);
    let lastUserRow = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].style.justifyContent === 'flex-end') {
        lastUserRow = rows[i];
        break;
      }
    }
    if (!lastUserRow) return;
    if (lastUserRow.querySelector('.xlex-edit-btn')) return;

    const bubble = lastUserRow.children[0];
    if (!bubble) return;

    const bubbleClone = bubble.cloneNode(true);
    const chipDiv = bubbleClone.querySelector('div');
    if (chipDiv) chipDiv.remove();
    const originalText = bubbleClone.textContent.trim();

    const editWrapper = document.createElement('div');
    editWrapper.style.cssText = 'display:flex;justify-content:flex-end;margin-top:4px;padding-right:44px;';

    const editBtn = document.createElement('button');
    editBtn.className = 'xlex-edit-btn';
    editBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">edit</span> Edit &amp; Resend';
    editBtn.title = 'Edit this message and resend';

    editBtn.addEventListener('click', () => {
      const ci = document.getElementById('xlex-chat-input');
      if (ci) {
        ci.value = originalText;
        ci.focus();
        ci.selectionStart = ci.selectionEnd = originalText.length;
      }
      editWrapper.remove();
    });

    editWrapper.appendChild(editBtn);

    if (lastUserRow.nextSibling) {
      area.insertBefore(editWrapper, lastUserRow.nextSibling);
    } else {
      area.appendChild(editWrapper);
    }
  }

  
  function showChatView() {
    if (landingSection) landingSection.style.display = 'none';
    if (chatViewEl)     chatViewEl.style.display = 'flex';
    const ci = document.getElementById('xlex-chat-input');
    if (ci) setTimeout(() => ci.focus(), 50);
  }
  function showLanding() {
    if (chatViewEl)     chatViewEl.style.display = 'none';
    if (landingSection) landingSection.style.display = '';
    if (inputEl) inputEl.focus();
  }

  
  function appendMsg(role, html) {
    const area = document.getElementById('xlex-messages');
    if (!area) return null;

    const isUser = role === 'user';
    const row = document.createElement('div');
    row.style.cssText = `display:flex;gap:12px;justify-content:${isUser ? 'flex-end' : 'flex-start'};align-items:flex-start;`;

    if (!isUser) {
      const av = document.createElement('div');
      av.style.cssText = 'width:32px;height:32px;border-radius:50%;background:rgba(226,194,138,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:4px;border:1px solid rgba(226,194,138,0.2);';
      av.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;color:#e2c28a;">auto_awesome</span>';
      row.appendChild(av);
    }

    const bubble = document.createElement('div');
    const isLight = document.documentElement.classList.contains('light');

    if (isUser) {
      bubble.style.cssText = 'max-width:75%;padding:12px 18px;border-radius:20px;background:#e2c28a;color:#1c1a18;font-size:15px;line-height:1.6;';
    } else {
      bubble.className = 'xlex-ai-bubble';
      bubble.style.cssText = 'max-width:75%;padding:12px 18px;border-radius:20px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);font-size:15px;line-height:1.6;';
    }

    bubble.innerHTML = html;
    row.appendChild(bubble);

    if (isUser) {
      const av = document.createElement('div');
      av.style.cssText = 'width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:4px;';
      av.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;color:#9e9e9e;">person</span>';
      row.appendChild(av);
    }

    area.appendChild(row);
    const _mw = document.getElementById('xlex-msgs-wrapper');
    if (_mw) _mw.scrollTop = _mw.scrollHeight;
    const msgsW = document.getElementById('xlex-msgs-wrapper');
    if (msgsW) msgsW.scrollTop = msgsW.scrollHeight;
    return bubble;
  }

  function showTyping() {
    return appendMsg('ai',
      `<div style="display:flex;gap:6px;align-items:center;padding:4px 0;">
        <span style="width:8px;height:8px;border-radius:50%;background:#e2c28a;opacity:0.6;animation:xlexBounce 1.2s infinite 0ms;"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:#e2c28a;opacity:0.6;animation:xlexBounce 1.2s infinite 150ms;"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:#e2c28a;opacity:0.6;animation:xlexBounce 1.2s infinite 300ms;"></span>
      </div>`);
  }

  
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }

  function getMimeType(file) {
    if (file.type) return file.type;
    const ext = file.name.split('.').pop().toLowerCase();
    const map = {
      pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg',
      jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
      svg: 'image/svg+xml', txt: 'text/plain', csv: 'text/csv',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return map[ext] || 'application/octet-stream';
  }

  
  async function buildOpenAIContentArray(userText, attachments) {
    const content = [];

    for (const att of attachments) {
      const mime = att.mimeType || '';

      if (mime.startsWith('image/')) {
        // OpenAI vision format — inline base64 data URL
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${mime};base64,${att.data}`,
            detail: 'auto',       // let the model choose low/high resolution
          },
        });

      } else if (mime === 'application/pdf') {
        // GPT-4o-mini cannot process raw PDF bytes — send extracted text hint
        // The backend should ideally extract PDF text; we flag it here so it can
        content.push({
          type: 'text',
          text: `[PDF attached: "${att.name}" — ${Math.round(att.size / 1024)} KB. Please analyse its content based on the file data provided in the request.]`,
        });

      } else {
        // Other file types — note in the text so the model is aware
        content.push({
          type: 'text',
          text: `[File attached: "${att.name}" (${mime || 'unknown type'}, ${Math.round(att.size / 1024)} KB)]`,
        });
      }
    }

    // User text block — always added last so it reads naturally after media
    if (userText.trim()) {
      content.push({ type: 'text', text: userText });
    } else if (content.length === 0) {
      content.push({ type: 'text', text: 'Please describe what you see.' });
    }

    return content;
  }

  
  async function streamAPI(message, attachments, onToken) {
    activeAbort = new AbortController();
    const tid   = setTimeout(() => activeAbort.abort(), 120000);
    let res;

    let body;
    if (attachments.length > 0) {
      // Build OpenAI-compatible multimodal content array
      const contentArray = await buildOpenAIContentArray(message, attachments);
      body = JSON.stringify({
        message,           // plain text fallback for simple backends
        content: contentArray,  // OpenAI multimodal array — backend forwards this
        attachments: attachments.map(a => ({
          name:     a.name,
          mimeType: a.mimeType,
          size:     a.size,
          data:     a.data,
        })),
      });
    } else {
      body = JSON.stringify({ message });
    }

    try {
      res = await fetch('/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal:  activeAbort.signal,
      });
    } finally {
      clearTimeout(tid);
    }

    if (!res.ok) throw new Error(`Server error ${res.status}`);

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      if (stopRequested) {
        reader.cancel().catch(() => {});
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (stopRequested) break;
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') return;
        try {
          const p = JSON.parse(payload);
          if (p.error) throw new Error(p.error);
          if (p.token) onToken(p.token);
        } catch(e) { if (!e.message?.startsWith('JSON')) throw e; }
      }
    }
  }

  
  async function sendChat(userText) {
    if (isBusy) return;
    if (!userText.trim() && pendingFiles.length === 0) return;
    isBusy        = true;
    stopRequested = false;
    showChatView();
    loadChats();

    const filesToSend = pendingFiles.slice();
    pendingFiles = [];
    renderFilePreview();

    if (!activeChatId) {
      activeChatId = Date.now();
      const title = userText.length > 40 ? userText.slice(0,40) + '\u2026' : userText;
      chats.unshift({ id: activeChatId, title, messages: [] });
      saveChats();
      renderSidebarHistory();
    }

    // Build user bubble — show thumbnails for images, chips for others
    let userBubbleHTML = escText(userText);
    if (filesToSend.length > 0) {
      let mediaHTML = '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;">';
      filesToSend.forEach(f => {
        if (isImageFile(f.name)) {
          const objUrl = URL.createObjectURL(f);
          mediaHTML += `<img class="xlex-img-thumb" src="${objUrl}" alt="${escText(f.name)}" title="${escText(f.name)}">`;
        } else {
          mediaHTML += `
            <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(0,0,0,0.12);border-radius:12px;padding:3px 10px 3px 7px;font-size:12px;">
              <span class="material-symbols-outlined" style="font-size:13px;">${getFileIcon(f.name)}</span>
              <span style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escText(f.name)}</span>
            </div>`;
        }
      });
      mediaHTML += '</div>';
      userBubbleHTML += mediaHTML;
    }
    appendMsg('user', userBubbleHTML);

    const typingBubble = showTyping();
    setInputBusy(true);
    showStopBtn();

    // Convert files to base64 for backend
    let attachments = [];
    if (filesToSend.length > 0) {
      try {
        attachments = await Promise.all(filesToSend.map(async f => ({
          name:     f.name,
          mimeType: getMimeType(f),
          size:     f.size,
          data:     await fileToBase64(f),
        })));
      } catch(e) {
        console.warn('[XLEX] File read error:', e);
      }
    }

    let aiBubble = null;
    try {
      typingBubble?.parentElement?.remove();
      aiBubble = appendMsg('ai', '');

      await streamAPI(userText, attachments, token => {
        aiBubble._raw = (aiBubble._raw || '') + token;
        aiBubble.innerHTML = renderMD(aiBubble._raw);
        if (document.documentElement.classList.contains('light')) {
          aiBubble.style.color = '#1c1a18';
          aiBubble.style.background = 'rgba(0,0,0,0.04)';
          aiBubble.style.border = '1px solid rgba(0,0,0,0.1)';
        }
        const area = document.getElementById('xlex-messages');
        if (area) area.scrollTop = area.scrollHeight;
        const msgsW = document.getElementById('xlex-msgs-wrapper');
    if (msgsW) msgsW.scrollTop = msgsW.scrollHeight;
      });

      if (stopRequested && aiBubble) {
        const stopNote = document.createElement('span');
        stopNote.style.cssText = 'display:block;font-size:11px;opacity:0.45;margin-top:8px;';
        stopNote.textContent = '[Response stopped]';
        aiBubble.appendChild(stopNote);
        addEditButtonToLastUserMessage();
      }

      saveCurrentMessages();
    } catch(err) {
      if (typingBubble?.parentElement) typingBubble.parentElement.remove();
      if (err.name !== 'AbortError' || !stopRequested) {
        appendMsg('ai', `<span style="color:#f87171;">\u274c ${escText(err.message)}</span>`);
      } else {
        addEditButtonToLastUserMessage();
        saveCurrentMessages();
      }
    } finally {
      isBusy        = false;
      stopRequested = false;
      activeAbort   = null;
      hideStopBtn();
      setInputBusy(false);

      const ci = document.getElementById('xlex-chat-input');
      if (ci) {
        ci.disabled = false;
        ci.focus();
      }
    }
  }

  function saveCurrentMessages() {
    if (!activeChatId) return;
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;
    const area = document.getElementById('xlex-messages');
    if (!area) return;
    chat.messages = Array.from(area.children).map(row => {
      const isUser = row.style.justifyContent === 'flex-end';
      const bubble = isUser ? row.children[0] : row.children[1];
      return { role: isUser ? 'user' : 'ai', html: bubble?.innerHTML || '' };
    });
    saveChats();
  }

  function setInputBusy(busy) {
    if (inputEl) inputEl.disabled = busy;
    if (sendBtn) {
      sendBtn.disabled = busy;
      sendBtn.style.opacity = busy ? '0.5' : '';
      sendBtn.style.cursor  = busy ? 'not-allowed' : '';
    }
    const ci = document.getElementById('xlex-chat-input');
    const cs = document.getElementById('xlex-chat-send');
    if (ci) ci.disabled = busy;
    if (cs) {
      cs.style.opacity = '1';
      cs.style.cursor  = 'pointer';
    }
  }

  
  function startNewChat() {
    activeChatId = null;
    const area = document.getElementById('xlex-messages');
    if (area) area.innerHTML = '';
    if (inputEl) inputEl.value = '';
    const ci = document.getElementById('xlex-chat-input');
    if (ci) ci.value = '';
    pendingFiles = [];
    renderFilePreview();
    showLanding();
    closeHistoryPanel();
  }

  
  function buildHistoryPanel() {
    if (document.getElementById('xlex-history-panel')) return;

    historyPanelEl = document.createElement('div');
    historyPanelEl.id = 'xlex-history-panel';
    Object.assign(historyPanelEl.style, {
      display:        'none',
      position:       'fixed',
      inset:          '0',
      zIndex:         '200',
      background:     'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(4px)',
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position:      'absolute',
      top:           '0', left: '0', bottom: '0',
      width:         '320px',
      background:    '#1c1c1a',
      borderRight:   '1px solid rgba(255,255,255,0.08)',
      display:       'flex',
      flexDirection: 'column',
      padding:       '24px 16px',
      gap:           '8px',
      overflowY:     'hidden',
    });

    // ── Header row: title + close ──
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding:0 8px;flex-shrink:0;';
    header.innerHTML = `
      <span style="color:#e5e2e0;font-weight:600;font-size:18px;">History</span>
      <button id="xlex-history-close" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:none;border:none;cursor:pointer;color:#9e9e9e;transition:background 0.2s;" onmouseenter="this.style.background='rgba(255,255,255,0.08)'" onmouseleave="this.style.background='none'">
        <span class="material-symbols-outlined" style="font-size:18px;">close</span>
      </button>`;
    panel.appendChild(header);

    // ── Search bar ──
    const searchWrapper = document.createElement('div');
    searchWrapper.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);margin:0 2px 12px;flex-shrink:0;transition:border-color 0.2s;';
    searchWrapper.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:16px;color:rgba(229,226,224,0.45);flex-shrink:0;">search</span>
      <input id="xlex-history-search"
        type="text"
        placeholder="Search conversations…"
        style="flex:1;background:none;border:none;outline:none;color:#e5e2e0;font-size:13px;caret-color:#e2c28a;"
        autocomplete="off"
      />
      <button id="xlex-history-search-clear" style="display:none;background:none;border:none;cursor:pointer;padding:0;color:rgba(229,226,224,0.4);line-height:1;" title="Clear search">
        <span class="material-symbols-outlined" style="font-size:14px;">close</span>
      </button>`;
    panel.appendChild(searchWrapper);

    // ── Scrollable list ──
    const listEl = document.createElement('div');
    listEl.id = 'xlex-history-list';
    listEl.style.cssText = 'display:flex;flex-direction:column;gap:4px;overflow-y:auto;flex:1;padding-right:2px;';
    panel.appendChild(listEl);

    historyPanelEl.appendChild(panel);
    document.body.appendChild(historyPanelEl);

    // Events
    historyPanelEl.addEventListener('click', e => {
      if (e.target === historyPanelEl) closeHistoryPanel();
    });
    document.getElementById('xlex-history-close').addEventListener('click', closeHistoryPanel);

    // Search input → filter list live
    const searchInput = document.getElementById('xlex-history-search');
    const clearBtn    = document.getElementById('xlex-history-search-clear');

    searchWrapper.addEventListener('focusin', () => {
      searchWrapper.style.borderColor = 'rgba(226,194,138,0.4)';
    });
    searchWrapper.addEventListener('focusout', () => {
      searchWrapper.style.borderColor = 'rgba(255,255,255,0.08)';
    });

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      clearBtn.style.display = q ? 'block' : 'none';
      renderHistoryPanel(q);
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      searchInput.focus();
      renderHistoryPanel('');
    });
  }

  function openHistoryPanel() {
    renderHistoryPanel('');
    if (historyPanelEl) {
      historyPanelEl.style.display = 'block';
      // Reset search on open
      const inp = document.getElementById('xlex-history-search');
      const clr = document.getElementById('xlex-history-search-clear');
      if (inp) { inp.value = ''; inp.focus(); }
      if (clr) clr.style.display = 'none';
    }
  }
  function closeHistoryPanel() {
    if (historyPanelEl) historyPanelEl.style.display = 'none';
  }

  function renderHistoryPanel(searchQuery) {
    const list = document.getElementById('xlex-history-list');
    if (!list) return;
    loadChats();

    const q = (searchQuery || '').trim().toLowerCase();

    // Filter by search query (match against title and first message text)
    const filtered = q
      ? chats.filter(c => {
          const title = (c.title || '').toLowerCase();
          const firstMsg = (c.messages?.[0]?.text || c.messages?.[0]?.content || '').toLowerCase();
          return title.includes(q) || firstMsg.includes(q);
        })
      : chats;

    if (chats.length === 0) {
      list.innerHTML = '<p style="color:rgba(255,255,255,0.35);font-size:13px;text-align:center;padding:24px 8px;">No conversations yet</p>';
      return;
    }

    if (filtered.length === 0) {
      list.innerHTML = `<p style="color:rgba(255,255,255,0.35);font-size:13px;text-align:center;padding:24px 8px;">No results for "<em>${escText(searchQuery)}</em>"</p>`;
      return;
    }

    // Highlight matching text in title
    function highlightMatch(text, query) {
      if (!query) return escText(text);
      const safe = escText(text);
      const safeQ = escText(query);
      return safe.replace(new RegExp(`(${safeQ.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),
        '<mark style="background:rgba(226,194,138,0.3);color:#e2c28a;border-radius:2px;padding:0 1px;">$1</mark>');
    }

    list.innerHTML = '';
    filtered.forEach(c => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:4px;';

      const btn = document.createElement('button');
      btn.style.cssText = `
        flex:1;display:flex;align-items:center;gap:10px;
        padding:10px 12px;border-radius:12px;
        background:${c.id === activeChatId ? 'rgba(255,255,255,0.08)' : 'none'};
        border:none;cursor:pointer;
        color:${c.id === activeChatId ? '#e5e2e0' : 'rgba(229,226,224,0.6)'};
        font-size:13px;text-align:left;
        transition:background 0.15s,color 0.15s;
        overflow:hidden;
      `;
      btn.onmouseenter = () => { btn.style.background='rgba(255,255,255,0.06)'; btn.style.color='#e5e2e0'; };
      btn.onmouseleave = () => { btn.style.background = c.id===activeChatId ? 'rgba(255,255,255,0.08)':'none'; btn.style.color = c.id===activeChatId ? '#e5e2e0':'rgba(229,226,224,0.6)'; };
      btn.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:16px;flex-shrink:0;">chat_bubble</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${highlightMatch(c.title, q)}</span>`;
      btn.addEventListener('click', () => { loadConversation(c.id); closeHistoryPanel(); });

      const delBtn = document.createElement('button');
      delBtn.style.cssText = 'width:28px;height:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:8px;background:none;border:none;cursor:pointer;color:rgba(229,226,224,0.3);transition:color 0.15s,background 0.15s;';
      delBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:15px;">delete</span>';
      delBtn.onmouseenter = () => { delBtn.style.color='#f87171'; delBtn.style.background='rgba(248,113,113,0.1)'; };
      delBtn.onmouseleave = () => { delBtn.style.color='rgba(229,226,224,0.3)'; delBtn.style.background='none'; };
      delBtn.addEventListener('click', () => {
        if (!confirm('Delete this conversation?')) return;
        chats = chats.filter(x => x.id !== c.id);
        if (activeChatId === c.id) startNewChat();
        saveChats();
        const currentSearch = (document.getElementById('xlex-history-search')?.value || '');
        renderHistoryPanel(currentSearch);
        renderSidebarHistory();
      });

      row.appendChild(btn);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
  }

  
  function renderSidebarHistory() {
    if (!sidebarRecentSection) return;
    sidebarRecentSection.querySelectorAll('[data-xlex-dynamic]').forEach(el => el.remove());
    loadChats();

    chats.slice(0, 5).forEach(c => {
      const btn = document.createElement('button');
      btn.setAttribute('data-xlex-dynamic', '1');
      btn.className = 'flex items-center gap-3 px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-all text-left text-sm truncate w-full';
      if (c.id === activeChatId) btn.style.background = 'rgba(255,255,255,0.06)';
      btn.innerHTML = `
        <span class="material-symbols-outlined text-sm">chat_bubble</span>
        <span class="truncate">${escText(c.title)}</span>`;
      btn.addEventListener('click', () => loadConversation(c.id));
      sidebarRecentSection.appendChild(btn);
    });
  }

  
  function loadConversation(id) {
    const chat = chats.find(c => c.id === id);
    if (!chat) return;
    activeChatId = id;
    const area = document.getElementById('xlex-messages');
    if (area) {
      area.innerHTML = '';
      (chat.messages || []).forEach(m => appendMsg(m.role, m.html));
    }
    showChatView();
    renderSidebarHistory();
  }

  
  function wireSuggestions() {
    suggestionCards.forEach(card => {
      card.addEventListener('click', () => {
        const pEl = card.querySelector('p');
        const text = (pEl ? pEl.textContent : card.textContent).trim();
        if (!text) return;
        if (inputEl) inputEl.value = '';
        sendChat(text);
      });
    });
  }

  
  function wireInput() {
    if (!inputEl || !sendBtn) return;

    inputEl.style.cssText += ';outline:none !important;box-shadow:none !important;-webkit-appearance:none;';

    sendBtn.addEventListener('click', () => {
      const text = inputEl.value.trim();
      if (!text || isBusy) return;
      inputEl.value = '';
      sendChat(text);
    });

    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = inputEl.value.trim();
        if (!text || isBusy) return;
        inputEl.value = '';
        sendChat(text);
      }
    });
  }

  
  function wireNavButtons() {
    if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);
    if (historyBtn) historyBtn.addEventListener('click', openHistoryPanel);
  }

  
  function wireKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeHistoryPanel();
        if (isBusy) stopStreaming();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); startNewChat(); }
    });
  }

  
  function init() {
    loadChats();

    inputEl         = document.querySelector('main input[type="text"]');
    sendBtn         = document.querySelector('main button .material-symbols-outlined[style*="FILL"]')?.closest('button');
    suggestionCards = Array.from(document.querySelectorAll('main .grid button'));
    landingSection  = document.querySelector('main .flex-1.flex.flex-col.items-center');

    const navBtns   = document.querySelectorAll('aside nav > button');
    newChatBtn      = navBtns[0] || null;
    historyBtn      = navBtns[1] || null;

    sidebarRecentSection = document.querySelector('aside nav .flex.flex-col.gap-1');

    buildChatView();
    buildHistoryPanel();
    wireInput();
    wireSuggestions();
    wireNavButtons();
    wireKeyboard();
    renderSidebarHistory();
    patchLandingInputBar();

    console.log('[app.js] XLEX AI functionality loaded ✓');
  }

  /* Single global theme observer - updates chat bar and inputs */
  function setupThemeObserver() {
    const updateTheme = () => {
      const isLight = document.documentElement.classList.contains('light');
      const chatInput = document.getElementById('xlex-chat-input');
      const chatBar   = document.getElementById('xlex-chat-bar');
      if (chatInput) {
        chatInput.style.color = isLight ? '#1c1a18' : '#e5e2e0';
        chatInput.style.webkitTextFillColor = isLight ? '#1c1a18' : '#e5e2e0';
        chatInput.style.caretColor = isLight ? '#7a5c18' : '#e2c28a';
      }
      if (chatBar) {
        chatBar.style.background   = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';
        chatBar.style.borderColor  = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)';
      }
    };
    const obs = new MutationObserver(updateTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); setupThemeObserver(); });
  } else {
    init();
    setupThemeObserver();
  }

})();
