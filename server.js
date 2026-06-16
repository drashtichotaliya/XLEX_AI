require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const axios   = require('axios');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));  // large enough for PDFs + images

// Serve all static files from the same directory as server.js
app.use(express.static(path.join(__dirname)));

// ── Config ───────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

// ── System prompt ───────────────────────────────────────────
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ||
  'You are a helpful EV battery expert assistant. Provide clear, accurate, and concise answers about electric vehicle batteries, including their chemistry, maintenance, lifespan, charging practices, and degradation factors. You can also read and analyse any files, PDFs, or images the user shares. Format your responses clearly with markdown when helpful.';

// ── Conversation context (in-memory, per-session) ───────────
const conversationHistory = new Map();



// ── Build Gemini parts array from attachments ───────────────
// Gemini uses "parts" with inlineData for images, text for everything else
async function buildGeminiParts(userText, attachments) {
  const parts = [];

  for (const att of attachments) {
    const mime = att.mimeType || '';
    const name = att.name     || 'file';
    const data = att.data     || '';

    if (
      mime.startsWith('image/') || 
      mime === 'application/pdf' ||
      mime.includes('wordprocessingml') ||
      mime.includes('spreadsheetml') ||
      mime.includes('msword') ||
      mime.includes('ms-excel')
    ) {
      parts.push({
        inlineData: {
          mimeType: mime,
          data:     data,
        },
      });

    } else if (
      mime === 'text/plain' || mime === 'text/csv' || mime === 'text/markdown' ||
      name.match(/\.(txt|csv|md|json|js|ts|py|html|css|xml|yaml|yml)$/i)
    ) {
      try {
        const decoded  = Buffer.from(data, 'base64').toString('utf8');
        const truncated = decoded.length > 12000
          ? decoded.slice(0, 12000) + '\n\n[... file truncated for length ...]'
          : decoded;
        parts.push({ text: `The user attached a file named "${name}". Here is its content:\n\n${truncated}` });
      } catch (_) {
        parts.push({ text: `[Attached file: "${name}" — could not decode content]` });
      }

    } else {
      parts.push({ text: `[The user attached a file named "${name}" (${mime || 'unknown type'}) — this file type cannot be read directly.]` });
    }
  }

  // User text always last
  if (userText && userText.trim()) {
    parts.push({ text: userText.trim() });
  } else if (parts.length === 0) {
    parts.push({ text: 'Please describe what you see.' });
  }

  return parts;
}

// ── Convert history format: OpenAI → Gemini ─────────────────
function toGeminiHistory(history) {
  return history.map(msg => ({
    role:  msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }],
  }));
}

// ── POST /chat  (SSE streaming via Gemini) ───────────────────
app.post('/chat', async (req, res) => {
  const { message, content, attachments, sessionId } = req.body;

  const hasText        = message     && typeof message === 'string' && message.trim();
  const hasContent     = Array.isArray(content)     && content.length > 0;
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (!hasText && !hasContent && !hasAttachments) {
    return res.status(400).json({ error: 'Message, content, or attachments are required.' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not set. Add it to your .env file.',
    });
  }

  // Session history
  const sid = sessionId || 'default';
  if (!conversationHistory.has(sid)) conversationHistory.set(sid, []);
  const history = conversationHistory.get(sid);
  const recentHistory = history.slice(-10);

  // Build user parts for Gemini
  let userParts;
  if (hasAttachments) {
    userParts = await buildGeminiParts(message || '', attachments);
  } else if (hasContent) {
    // Convert OpenAI content array → Gemini parts
    userParts = (Array.isArray(content) ? content : []).map(block => {
      if (block.type === 'text') return { text: block.text };
      if (block.type === 'image_url') {
        // Extract base64 from data URI
        const match = (block.image_url?.url || '').match(/^data:([^;]+);base64,(.+)$/);
        if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
      }
      return { text: JSON.stringify(block) };
    });
  } else {
    userParts = [{ text: message.trim() }];
  }

  // Gemini request body
  const geminiBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      ...toGeminiHistory(recentHistory),
      { role: 'user', parts: userParts },
    ],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature:     0.7,
    },
  };

  // ── SSE headers ──────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const geminiResponse = await axios.post(
      GEMINI_API_URL,
      geminiBody,
      {
        headers:      { 'Content-Type': 'application/json' },
        responseType: 'stream',
        timeout:      60000,
      }
    );

    let fullAnswer = '';
    let buffer     = '';

    geminiResponse.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload);
          const token  = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (token) {
            fullAnswer += token;
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }
        } catch (_) { /* skip malformed chunks */ }
      }
    });

    geminiResponse.data.on('end', () => {
      // Save to history
      const historyText = hasText
        ? message.trim()
        : (hasAttachments ? attachments.map(a => `[file: ${a.name}]`).join(', ') : '[content]');
      history.push({ role: 'user',      content: historyText });
      history.push({ role: 'assistant', content: fullAnswer });
      res.write('data: [DONE]\n\n');
      res.end();
    });

    geminiResponse.data.on('error', (err) => {
      console.error('[Server] Gemini stream error:', err.message);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });

  } catch (err) {
    console.error('[Server] Gemini error:', err.response?.data || err.message);

    if (!res.headersSent) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        return res.status(401).json({ error: 'Invalid Gemini API key.' });
      }
      if (err.response?.status === 429) {
        return res.status(429).json({ error: 'Rate limit reached. Please wait and try again.' });
      }
      if (err.code === 'ECONNABORTED') {
        return res.status(504).json({ error: 'Request timed out.' });
      }
      return res.status(500).json({
        error: err.response?.data?.error?.message || err.message || 'Internal server error',
      });
    }

    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── Health check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    model:   GEMINI_MODEL,
    port:    PORT,
    apiKey:  GEMINI_API_KEY ? '✓ Set' : '✗ Missing',
  });
});

// ── Catch-all → serve index.html ────────────────────────────
app.get('*', (req, res) => {
  const htmlPath = path.join(__dirname, 'index.html');
  fs.readFile(htmlPath, 'utf8', (err, html) => {
    if (err) { return res.status(500).send('Could not load index.html'); }
    if (!html.includes('src="app.js"') && !html.includes("src='app.js'")) {
      html = html.replace('</body>', '  <script src="app.js"></script>\n</body>');
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ XLEX AI Server running at http://localhost:${PORT}`);
  console.log(`   Model:   ${GEMINI_MODEL}`);
  console.log(`   API Key: ${GEMINI_API_KEY ? '✓ Loaded from .env' : '✗ NOT SET — add GEMINI_API_KEY to .env'}`);
  console.log('');
});
