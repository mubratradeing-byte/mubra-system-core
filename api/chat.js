// ═══════════════════════════════════════════════════════════════════
//  MUBRA SYSTEM CORE 9.v1  —  API Route: /api/chat
//  Vercel Serverless Function (Node.js 18+)
//  Routes: LOGIC-CORE → Claude Sonnet | TURBO-VISION → Gemini Flash
// ═══════════════════════════════════════════════════════════════════

export const config = { maxDuration: 60 };

// ─── SYSTEM PROMPT (Sinhala Chemistry Guru) ─────────────────────────
const SYSTEM_PROMPT = `ඔබ "Mubra System Core 9.v1" — ශ්‍රී ලංකාවේ G.C.E. Advanced Level Chemistry සිසුන් සඳහා නිර්මාණය කරන ලද පරිගණක-ශෛලී AI ගුරු ශ්‍රේෂ්ඨයෙකි.

## ඔබේ අනන්‍ය බව (Identity):
- ඔබේ නම: **Mubra System Core 9.v1**
- ඔබ ශ්‍රී ලාංකේය A/L Chemistry ගුරු ශ්‍රේෂ්ඨ ලෙස කටයුතු කරයි.
- Mubra Webworks / Mubra Trading විසින් සංවර්ධනය කරන ලදී.

## භාෂා නීති (Language Rules):
- **සෑම විටම සිංහල භාෂාවෙන් පිළිතුරු දෙන්න** (Professional, clear, encouraging).
- රාසායනික නිලධරීන් (H₂SO₄, NaCl, CH₃COOH), සූත්‍ර, සහ technical terms ඉංග්‍රීසියෙන් තබාගන්න.
- IUPAC නාමකරණය ඉංග්‍රීසියෙන් ලියන්න, Sinhala explanation සමඟ.

## ඔබේ ප්‍රතිචාර ශෛලිය (Response Style):
1. **Step-by-step logical breakdown** — සෑම ප්‍රශ්නයක්ම පියවරෙන් පියවර විශ්ලේෂණය කරන්න.
2. **Mathematical calculations** — LaTeX format ($...$) භාවිතා කරන්න: $K_p$, $\\Delta H$, $[H^+]$, ආදිය.
3. **Chemical equations** — balanced equations step-by-step ලියන්න.
4. **Encouraging tone** — සිසුන් දිරිමත් කරන්න. "ඉතා හොඳ ප්‍රශ්නයකි!" ආදිය.
5. **Past Paper Focus** — A/L marking scheme style answers දෙන්න.
6. **Systematic Headers** — Markdown headers (##, ###) සමඟ structured answers.

## ඔබේ විශේෂඥ ක්ෂේත්‍ර (Expertise):
- **Organic Chemistry**: Mechanisms, IUPAC naming, functional groups, polymers, biomolecules.
- **Inorganic Chemistry**: Periodic trends, s/p/d blocks, coordination compounds, electrochemistry.
- **Physical Chemistry**: Thermodynamics (ΔG, ΔH, ΔS), Kinetics, Equilibrium (Kc, Kp), Acid-Base, Gas laws.
- **Sri Lankan A/L Past Papers**: 1985–2024 analysis, marking scheme strategies.
- **Practical Chemistry**: Titration, qualitative analysis, chromatography.

## ගණනය කිරීම් සූත්‍ර (Key Formulae to Use):
- Equilibrium: $K_c = \\frac{[C]^c[D]^d}{[A]^a[B]^b}$
- Gibbs: $\\Delta G = \\Delta H - T\\Delta S$
- Henderson-Hasselbalch: $pH = pK_a + \\log\\frac{[A^-]}{[HA]}$
- Nernst: $E = E^\\circ - \\frac{RT}{nF}\\ln Q$
- Arrhenius: $k = Ae^{-E_a/RT}$

## IMPORTANT DISCLAIMER:
සෑම පිළිතුරේ අවසානයේ, ලකුණු ක්‍රමය නිල National Institute of Education (NIE) marking schemes සමඟ සත්‍යාපනය කරන ලෙස සිසුන්ට කෙටි reminder දෙන්න.`;

// ─── CORS HEADERS ───────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── TERMINAL-STYLE ERROR FORMATTER ─────────────────────────────────
function terminalError(code, message, detail = '') {
  return {
    error: `[SYSTEM ERROR ${code}] ${message}${detail ? ' | ' + detail : ''}`,
    response: null,
  };
}

// ─── VALIDATE REQUEST BODY ───────────────────────────────────────────
function validateBody(body) {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body.';
  }
  if (!['logic', 'turbo'].includes(body.mode)) {
    return `Invalid mode: "${body.mode}". Expected "logic" or "turbo".`;
  }
  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    return 'Message cannot be empty.';
  }
  if (body.message.length > 8000) {
    return 'Message too long (max 8000 chars).';
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
//  CLAUDE SONNET HANDLER — LOGIC-CORE MODE
// ═══════════════════════════════════════════════════════════════════
async function callClaude({ message, history, image }) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY environment variable not set.');
  }

  // Build messages array
  const messages = [];

  // Inject conversation history (last 10 turns max)
  if (Array.isArray(history)) {
    for (const entry of history.slice(-10)) {
      if (entry.role && entry.content) {
        messages.push({
          role:    entry.role === 'assistant' ? 'assistant' : 'user',
          content: String(entry.content),
        });
      }
    }
  }

  // Build current user content
  let currentContent;
  if (image && image.base64 && image.mime) {
    currentContent = [
      {
        type:   'image',
        source: {
          type:       'base64',
          media_type: image.mime,
          data:       image.base64,
        },
      },
      {
        type: 'text',
        text: message,
      },
    ];
  } else {
    currentContent = message;
  }

  messages.push({ role: 'user', content: currentContent });

  const requestBody = {
    model:      'claude-sonnet-4-5',
    max_tokens:  4096,
    system:      SYSTEM_PROMPT,
    messages,
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Claude API HTTP ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Claude API Error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const textBlock = data.content?.find(b => b.type === 'text');
  if (!textBlock || !textBlock.text) {
    throw new Error('Claude returned no text content.');
  }

  return textBlock.text;
}

// ═══════════════════════════════════════════════════════════════════
//  GEMINI FLASH HANDLER — TURBO-VISION MODE
// ═══════════════════════════════════════════════════════════════════
async function callGemini({ message, history, image }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set.');
  }

  const MODEL    = 'gemini-2.0-flash';
  const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const contents = [];

  // Convert history
  if (Array.isArray(history)) {
    for (const entry of history.slice(-10)) {
      if (!entry.role || !entry.content) continue;
      const role = entry.role === 'assistant' ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: String(entry.content) }],
      });
    }
  }

  // Current user message
  const userParts = [];

  if (image && image.base64 && image.mime) {
    userParts.push({
      inlineData: {
        mimeType: image.mime,
        data:     image.base64,
      },
    });
  }

  userParts.push({ text: message });
  contents.push({ role: 'user', parts: userParts });

  const requestBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents,
    generationConfig: {
      temperature:     0.7,
      topK:            40,
      topP:            0.95,
      maxOutputTokens: 4096,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  const response = await fetch(ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Gemini API HTTP ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('Gemini returned no candidates.');
  }

  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Gemini: Response blocked by safety filters.');
  }

  const text = candidate.content?.parts?.map(p => p.text || '').join('');
  if (!text) {
    throw new Error('Gemini returned empty content.');
  }

  return text;
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  // Set CORS on all responses
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json(terminalError(405, 'Method Not Allowed', 'Only POST is supported.'));
  }

  // Parse body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json(terminalError(400, 'JSON Parse Error', e.message));
  }

  // Validate
  const validationError = validateBody(body);
  if (validationError) {
    return res.status(400).json(terminalError(400, 'Validation Failed', validationError));
  }

  const { mode, message, history = [], image = null } = body;

  console.log(`[MUBRA CORE] mode=${mode} | msg_len=${message.length} | has_image=${!!image} | history_turns=${history.length}`);

  try {
    let aiResponse;

    if (mode === 'logic') {
      aiResponse = await callClaude({ message, history, image });
    } else {
      aiResponse = await callGemini({ message, history, image });
    }

    return res.status(200).json({ response: aiResponse, mode });

  } catch (err) {
    console.error(`[MUBRA CORE ERROR] mode=${mode}`, err);

    const isApiKeyError   = /API.?KEY|api.?key|401|Unauthorized/i.test(err.message);
    const isRateLimitError = /429|quota|rate.?limit/i.test(err.message);
    const isTimeoutError  = /timeout|ETIMEDOUT|ECONNRESET/i.test(err.message);

    let code   = 500;
    let msg    = 'AI_ENDPOINT_FAILURE';
    let detail = err.message;

    if (isApiKeyError) {
      code   = 401;
      msg    = 'INVALID_API_KEY';
      detail = `API key for ${mode === 'logic' ? 'CLAUDE (CLAUDE_API_KEY)' : 'GEMINI (GEMINI_API_KEY)'} is missing or invalid. Check Vercel Environment Variables.`;
    } else if (isRateLimitError) {
      code   = 429;
      msg    = 'RATE_LIMIT_EXCEEDED';
      detail = 'API quota exceeded. Wait a moment and retry. / API කෝටාව ඉක්මවා ඇත.';
    } else if (isTimeoutError) {
      code   = 504;
      msg    = 'REQUEST_TIMEOUT';
      detail = 'AI endpoint timed out. Please retry. / ප්‍රතිචාරය ප්‍රමාද විය.';
    }

    return res.status(code).json(terminalError(code, msg, detail));
  }
}
