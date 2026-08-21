import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Check current model names in Google AI Studio if this one is rejected.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

app.post('/api/assemble', async (req, res) => {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'Server is missing GOOGLE_API_KEY. Set it in your environment variables.'
    });
  }

  const { vertical, persona, region, stage, assets, metrics, core } = req.body || {};

  if (!vertical || !persona) {
    return res.status(400).json({ error: 'vertical and persona are required.' });
  }

  const prompt = `You are the demo assembly engine for a fleet telematics platform's global demo library.

Your job: given a target opportunity, compose the demo that should be delivered. You are selecting and sequencing from an existing modular library, not inventing a new product.

TARGET OPPORTUNITY
Vertical: ${vertical}
Persona in the room: ${persona}
Region: ${region || 'North America'}
Deal stage: ${stage || 'Discovery'}

AVAILABLE VERTICAL OVERLAY (data pack for this vertical)
Asset types: ${(assets || []).join(', ')}
Vertical metrics: ${(metrics || []).join(', ')}

CORE PLATFORM SPINE (shared by every vertical, already built, must be reused not rebuilt)
${(core || []).join(', ')}

Respond with ONLY a JSON object, no markdown fences, no preamble, matching this shape exactly:

{
  "headline": "one short line naming the demo, under 10 words",
  "openingHook": "2 sentences the seller opens with, speaking to this persona's specific anxiety in this vertical",
  "modules": [
    { "title": "short module name", "shows": "what is on screen, one sentence", "answers": "the buyer question this resolves, one sentence" }
  ],
  "proofPoints": ["3 short specific proof points this persona needs to believe the claim"],
  "reusedCore": ["which core spine capabilities this demo reuses unchanged"],
  "cutFromDemo": ["2 things deliberately left out of this demo, and why, each under 15 words"]
}

Give exactly 4 modules, sequenced in delivery order. Be specific to this vertical and persona. Use operational language a seller would actually say, not marketing copy.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          // Forces valid JSON back, so no fence-stripping is needed.
          responseMimeType: 'application/json',
          // gemini-2.5 models are thinking models: reasoning tokens count
          // against this budget. Set thinkingBudget to 0 so the whole
          // allowance goes to the actual JSON output, and keep the ceiling
          // high enough that the object always closes.
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 8192,
          temperature: 0.7
        }
      })
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error('Gemini API error:', upstream.status, detail);
      return res.status(502).json({ error: `Upstream error ${upstream.status}` });
    }

    const data = await upstream.json();

    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason;

    const text = (candidate?.content?.parts || [])
      .map(p => p.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!text) {
      console.error('Empty response. finishReason:', finishReason, JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: `Model returned an empty response (finishReason: ${finishReason || 'unknown'}).` });
    }

    if (finishReason && finishReason !== 'STOP') {
      console.error('Non-STOP finishReason:', finishReason);
    }

    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Parse failure. finishReason:', finishReason, '| length:', cleaned.length, '| tail:', cleaned.slice(-200));
      const hint = finishReason === 'MAX_TOKENS'
        ? 'Response was truncated before the JSON closed. Raise maxOutputTokens in server.js.'
        : 'Model returned unparseable output.';
      return res.status(502).json({ error: hint });
    }

    res.json(parsed);
  } catch (err) {
    console.error('Assembly error:', err);
    res.status(500).json({ error: 'Assembly request failed.' });
  }
});

app.get('/healthz', (req, res) => res.json({ ok: true, keyPresent: !!process.env.GOOGLE_API_KEY, model: MODEL }));

app.listen(PORT, () => {
  console.log(`Demo Composer running on port ${PORT} (Gemini / ${MODEL})`);
});
