(function () {
  'use strict';

  const CONFIG = Object.assign(
    {
      apiEndpoint:    'https://xlex-ai-j4it.onrender.com/chat',                      // POST endpoint
      botName:        'AI Assistant',               // Sidebar title
      botSubtitle:    'XLEX Query assistant', // Status text
      welcomeMessage: 'Hello! I\'m your AI assistant. Ask me anything — I\'m here to help.',
      suggestions: [                                // Quick-start chips
        'What can you do?',
        'What are EV battery degradation factors?',
        'What is the best way to maintain an EV battery?',
      ],
      // Gemini API key (optional — only needed if using direct Gemini API)
      // Leave empty when you have a backend proxy (recommended for production)
      geminiApiKey:   '',
      useGeminiDirect: false,                       // Set true to bypass backend & call Gemini directly
    },
    window.ChatbotConfig || {}
  );

  let isOpen      = false;
  let isWaiting   = false;        // True while API call is in flight
  let msgHistory  = [];           // { role: 'user'|'ai', text, time }
  let typingEl    = null;         // Current typing indicator DOM element

  const ICONS = {
    // Sparkle / AI icon
    ai: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
      <path d="M12 2l2.5 5.5L20 10l-5.5 2.5L12 18l-2.5-5.5L4 10l5.5-2.5z"/>
    </svg>`,
    // Copilot-style sparkle
    sparkle: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74z"/>
      <path d="M19 16l.94 2.06L22 19l-2.06.94L19 22l-.94-2.06L16 19l2.06-.94z"/>
      <path d="M5 4l.72 1.78L7.5 6.5l-1.78.72L5 9l-.72-1.78L2.5 6.5l1.78-.72z"/>
    </svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
    send:  `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
    user:  `<svg viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>`,
  };

  function buildHTML() {
    const wrap = document.createElement('div');
    wrap.id = 'cb-widget-root';
    wrap.innerHTML = `
      <!-- Backdrop overlay (mobile) -->
      <div id="cb-overlay" role="presentation"></div>

      <!-- Floating launcher button -->
      <button id="cb-launcher" aria-label="Open AI Assistant" title="AI Assistant">
        <span id="cb-launcher-icon">${ICONS.sparkle}</span>
        <span class="cb-badge" id="cb-badge" aria-hidden="true"></span>
      </button>

      <!-- Sidebar panel -->
      <aside id="cb-sidebar" role="complementary" aria-label="AI Assistant Chat" aria-hidden="true">

        <!-- Header -->
        <header id="cb-header">
          <div class="cb-header-avatar">${ICONS.sparkle}</div>
          <div class="cb-header-info">
            <h2>${escapeHTML(CONFIG.botName)}</h2>
            <p>${escapeHTML(CONFIG.botSubtitle)}</p>
          </div>
          <div class="cb-header-actions">
            <!-- Clear conversation -->
            <button class="cb-icon-btn" id="cb-clear-btn" aria-label="Clear conversation" title="Clear conversation">
              ${ICONS.trash}
            </button>
            <!-- Close sidebar -->
            <button class="cb-icon-btn" id="cb-close-btn" aria-label="Close chat" title="Close">
              ${ICONS.close}
            </button>
          </div>
        </header>

        <!-- Message list -->
        <section id="cb-messages" aria-live="polite" aria-label="Chat messages">
          ${buildWelcomeHTML()}
        </section>

        <!-- Input area -->
        <footer id="cb-input-area">
          <div class="cb-input-card">
            <textarea
              id="cb-input"
              rows="1"
              placeholder="Message AI Assistant…"
              aria-label="Type your message"
              autocomplete="off"
              spellcheck="true"
              maxlength="4000"
            ></textarea>
            <button id="cb-send" aria-label="Send message" title="Send (Enter)">
              ${ICONS.send}
            </button>
          </div>
          <p class="cb-input-hint">Press <strong>Enter</strong> to send · <strong>Shift+Enter</strong> for new line</p>
        </footer>
      </aside>
    `;
    document.body.appendChild(wrap);
  }

  function buildWelcomeHTML() {
    const chips = CONFIG.suggestions
      .map(s => `<button class="cb-chip" data-text="${escapeAttr(s)}">${escapeHTML(s)}</button>`)
      .join('');

    return `
      <div class="cb-welcome" id="cb-welcome">
        <div class="cb-welcome-icon">${ICONS.sparkle}</div>
        <h3>${escapeHTML(CONFIG.botName)}</h3>
        <p>${escapeHTML(CONFIG.welcomeMessage)}</p>
        <div class="cb-suggestions">${chips}</div>
      </div>
    `;
  }

  function openSidebar() {
    isOpen = true;
    const sidebar  = $('cb-sidebar');
    const overlay  = $('cb-overlay');
    const launcher = $('cb-launcher');

    sidebar.classList.add('cb-open');
    sidebar.setAttribute('aria-hidden', 'false');
    overlay.classList.add('cb-visible');

    // Swap launcher icon to X
    launcher.setAttribute('aria-label', 'Close AI Assistant');
    $('cb-launcher-icon').innerHTML = ICONS.close;

    // Hide notification badge
    $('cb-badge').style.display = 'none';

    // Focus the input
    setTimeout(() => $('cb-input').focus(), 350);
  }

  function closeSidebar() {
    isOpen = false;
    const sidebar  = $('cb-sidebar');
    const overlay  = $('cb-overlay');
    const launcher = $('cb-launcher');

    sidebar.classList.remove('cb-open');
    sidebar.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('cb-visible');

    launcher.setAttribute('aria-label', 'Open AI Assistant');
    $('cb-launcher-icon').innerHTML = ICONS.sparkle;
  }

  function toggleSidebar() {
    isOpen ? closeSidebar() : openSidebar();
  }

  function removeWelcome() {
    const welcome = document.getElementById('cb-welcome');
    if (welcome) welcome.remove();
  }

  function appendMessage(role, text, isError = false) {
    const msgs = $('cb-messages');
    const isUser = role === 'user';

    const msg = document.createElement('div');
    msg.className = `cb-msg ${isUser ? 'cb-user' : 'cb-ai'}${isError ? ' cb-msg-error' : ''}`;

    const avatar = document.createElement('div');
    avatar.className = 'cb-msg-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.innerHTML = isUser ? ICONS.user : ICONS.sparkle;

    const wrap = document.createElement('div');
    wrap.className = 'cb-bubble-wrap';

    const bubble = document.createElement('div');
    bubble.className = 'cb-bubble';
    // Render AI messages as basic markdown (safe)
    bubble.innerHTML = isUser ? escapeHTML(text) : renderMarkdown(text);

    const timestamp = document.createElement('span');
    timestamp.className = 'cb-timestamp';
    timestamp.textContent = getTime();

    wrap.appendChild(bubble);
    wrap.appendChild(timestamp);

    msg.appendChild(avatar);
    msg.appendChild(wrap);
    msgs.appendChild(msg);

    scrollToBottom();
    return msg;
  }

  function showTyping() {
    const msgs = $('cb-messages');
    const wrapper = document.createElement('div');
    wrapper.className = 'cb-msg cb-ai';
    wrapper.id = 'cb-typing-wrapper';
    wrapper.setAttribute('aria-label', 'AI is typing');
    wrapper.innerHTML = `
      <div class="cb-msg-avatar" aria-hidden="true">${ICONS.sparkle}</div>
      <div class="cb-bubble-wrap">
        <div class="cb-typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    msgs.appendChild(wrapper);
    typingEl = wrapper;
    scrollToBottom();
  }

  function hideTyping() {
    if (typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  function scrollToBottom() {
    const msgs = $('cb-messages');
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function sendMessage(text) {
    text = text.trim();
    if (!text || isWaiting) return;

    // Remove welcome card if still showing
    removeWelcome();

    // Render user bubble
    appendMessage('user', text);
    msgHistory.push({ role: 'user', text, time: getTime() });

    // Clear & resize input
    const input = $('cb-input');
    input.value = '';
    autoResizeTextarea(input);

    // Lock UI while waiting
    isWaiting = true;
    $('cb-send').disabled = true;
    input.disabled = true;

    // Show loading dots
    showTyping();

    try {
      const reply = CONFIG.useGeminiDirect
        ? await callGeminiDirect(text)
        : await callBackendAPI(text);

      hideTyping();
      appendMessage('ai', reply);
      msgHistory.push({ role: 'ai', text: reply, time: getTime() });

      // Show badge if sidebar is closed
      if (!isOpen) {
        $('cb-badge').style.display = 'block';
      }
    } catch (err) {
      hideTyping();
      const errMsg = getErrorMessage(err);
      appendMessage('ai', errMsg, true);
      console.error('[Chatbot] API error:', err);
    }

    // Unlock UI
    isWaiting = false;
    $('cb-send').disabled = false;
    input.disabled = false;
    input.focus();
  }

  async function callBackendAPI(message) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 30000); // 30s timeout

    let response;
    try {
      response = await fetch(CONFIG.apiEndpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message }),
        signal:  controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${body || response.statusText}`);
    }

    const data = await response.json();

    // Accept both { answer } and { reply } and { message } shapes
    const reply = data.answer ?? data.reply ?? data.message ?? data.text;
    if (typeof reply !== 'string') {
      throw new Error('Unexpected API response format. Expected { "answer": "..." }');
    }
    return reply;
  }

  async function callGeminiDirect(message) {
    if (!CONFIG.geminiApiKey) {
      throw new Error('Gemini API key not configured. Set window.ChatbotConfig.geminiApiKey.');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.geminiApiKey}`;

    // Build conversation context from history (last 10 turns)
    const recentHistory = msgHistory.slice(-10);
    const contents = recentHistory.map(h => ({
      role:  h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    }));
    // Add current user message
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        contents,
        generationConfig: {
          temperature:     0.8,
          topK:            40,
          topP:            0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error ${response.status}: ${err?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini API');
    return text;
  }

  function clearConversation() {
    msgHistory = [];
    const msgs = $('cb-messages');
    msgs.innerHTML = buildWelcomeHTML();
    // Re-attach chip listeners
    attachChipListeners();
  }

  function attachEventListeners() {
    // Launcher toggle
    $('cb-launcher').addEventListener('click', toggleSidebar);

    // Overlay click → close
    $('cb-overlay').addEventListener('click', closeSidebar);

    // Close button
    $('cb-close-btn').addEventListener('click', closeSidebar);

    // Clear button
    $('cb-clear-btn').addEventListener('click', clearConversation);

    // Send button
    $('cb-send').addEventListener('click', () => {
      sendMessage($('cb-input').value);
    });

    // Keyboard: Enter = send, Shift+Enter = new line
    $('cb-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage($('cb-input').value);
      }
    });

    // Auto-resize textarea as user types
    $('cb-input').addEventListener('input', () => {
      autoResizeTextarea($('cb-input'));
    });

    // Suggestion chips (initial)
    attachChipListeners();

    // Escape key closes sidebar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closeSidebar();
    });
  }

  function attachChipListeners() {
    document.querySelectorAll('.cb-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-text');
        if (text) sendMessage(text);
      });
    });
  }

  function $(id) { return document.getElementById(id); }

  function getTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;');
  }

  function renderMarkdown(text) {
    let html = escapeHTML(text);

    // Code blocks (``` ... ```)
    html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
      `<pre><code>${code.trim()}</code></pre>`
    );

    // Inline code (`...`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold (**text**)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic (*text*)
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Bullet lists (lines starting with - or *)
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function getErrorMessage(err) {
    if (err.name === 'AbortError') {
      return '⏱️ Request timed out. Please try again.';
    }
    if (!navigator.onLine) {
      return '📶 No internet connection. Please check your network.';
    }
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      return '🔌 Unable to reach the server. Make sure the backend is running.';
    }
    if (err.message.startsWith('HTTP 4')) {
      return `⚠️ Client error: ${err.message}`;
    }
    if (err.message.startsWith('HTTP 5')) {
      return '🛠️ Server error. Please try again later.';
    }
    return `❌ Something went wrong: ${err.message}`;
  }

  function init() {
    buildHTML();
    attachEventListeners();
    console.log('[Chatbot] Widget initialized ✓  Endpoint:', CONFIG.apiEndpoint);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(); // End IIFE — no global namespace pollution
