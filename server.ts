import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getFriendlyGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('GEMINI_API_KEY is not configured')) {
    return {
      status: 500,
      message: 'GEMINI_API_KEY is missing. Configure it in Settings > Secrets to awaken the Maloxie Crystal Ball.',
    };
  }
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID') || msg.includes('400')) {
    return {
      status: 400,
      message: 'The Gemini API key appears invalid or lacks permission. Please verify your key in Settings > Secrets.',
    };
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Rate limit reached on the free Gemini tier. Wait a few seconds and ask the Crystal Ball again.',
    };
  }
  return {
    status: 502,
    message: `Maloxie AI could not complete the request: ${msg}`,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'maloxie-api' });
});

app.post('/api/ai/coach', async (req, res) => {
  try {
    const { question, history, trainingContext } = req.body ?? {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'Please enter a training question for Maloxie AI.' });
      return;
    }

    const ai = createGeminiClient();
    const systemInstruction = `You are Maloxie AI, an elite strength and conditioning coach living inside the Maloxie Crystal Ball.
You speak clearly, directly, and practically—grounded in the athlete's real logged training data provided below.
Rules:
1. Reference the athlete's actual exercises, weights, RPEs, weekly volume, sleep, energy, injury/pain notes, and goals whenever relevant.
2. Always respect their preferred display unit (${trainingContext?.preferredUnit || 'kg'}). Weights in raw context are in kg unless noted—convert or state cleanly in ${trainingContext?.preferredUnit || 'kg'}.
3. Watch out for injury/pain notes, poor sleep, or consecutive high-RPE (>8.5) weeks and proactively recommend deload adjustments when fatigue signals appear.
4. Keep answers structured with concise actionable headings or bullet points under 320 words unless they ask for deep detail. Never invent workouts they did not log.`;

    const conversationSummary = Array.isArray(history)
      ? history
          .slice(-6)
          .map((m: { role?: string; content?: string }) => `${m.role === 'user' ? 'Athlete' : 'Maloxie AI'}: ${m.content ?? ''}`)
          .join('\n')
      : '';

    const prompt = `ATHLETE LIVE TRAINING CONTEXT:
${JSON.stringify(trainingContext ?? {}, null, 2)}

${conversationSummary ? `RECENT CONVERSATION:\n${conversationSummary}\n` : ''}
ATHLETE QUESTION:
${question.trim()}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    const answer = response.text?.trim();
    if (!answer) {
      res.status(502).json({ error: 'Maloxie AI returned an empty response. Please try again.' });
      return;
    }

    res.json({ answer });
  } catch (err) {
    const { status, message } = getFriendlyGeminiError(err);
    res.status(status).json({ error: message });
  }
});

app.post('/api/ai/program', async (req, res) => {
  try {
    const { goalPrompt, durationWeeks, daysPerWeek, includeDeload, splitPreference, trainingContext } = req.body ?? {};
    const weeksCount = Math.min(Math.max(Number(durationWeeks) || 4, 2), 8);
    const daysCount = Math.min(Math.max(Number(daysPerWeek) || 4, 2), 6);

    const ai = createGeminiClient();
    const systemInstruction = `You are Maloxie AI, an expert strength programmer. Generate a progressive, realistic ${weeksCount}-week training program (${daysCount} sessions per week) tailored to the athlete's real PRs, recovery, injury notes, and goals.
- Preferred unit: ${trainingContext?.preferredUnit || 'kg'}.
- Include progressive overload across accumulation weeks (e.g. slight weight or rep increases or RPE progression).
- ${includeDeload !== false ? `Make Week ${weeksCount} a structured Deload Week (set isDeload=true, reduce sets by ~40% and target RPE to 6-6.5).` : 'Include recovery guidance if fatigue rises.'}
- Keep exercise muscleGroup strictly one of: Chest, Back, Legs, Shoulders, Arms, Core, Full Body.
- Keep session splitType strictly one of: Push, Pull, Legs, Full Body, Upper, Lower, Custom.`;

    const prompt = `ATHLETE LIVE TRAINING CONTEXT:
${JSON.stringify(trainingContext ?? {}, null, 2)}

PROGRAM REQUEST:
- Goal / Focus: ${typeof goalPrompt === 'string' && goalPrompt.trim() ? goalPrompt.trim() : 'Balanced strength and hypertrophy progression'}
- Split Preference: ${splitPreference || 'Push / Pull / Legs or Upper / Lower'}
- Duration: ${weeksCount} weeks, ${daysCount} training days per week
- Deload Week Included: ${includeDeload !== false ? `Yes (Week ${weeksCount})` : 'No'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Concise program title, max 80 chars' },
            focus: { type: Type.STRING, description: '1-2 sentence summary of progression and deload strategy' },
            durationWeeks: { type: Type.INTEGER },
            deloadWeekNumber: { type: Type.INTEGER, description: 'Week number of deload, or 0 if none' },
            weeks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  weekNumber: { type: Type.INTEGER },
                  isDeload: { type: Type.BOOLEAN },
                  summary: { type: Type.STRING },
                  sessions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        splitType: {
                          type: Type.STRING,
                          enum: ['Push', 'Pull', 'Legs', 'Full Body', 'Upper', 'Lower', 'Custom'],
                        },
                        description: { type: Type.STRING },
                        exercises: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              name: { type: Type.STRING },
                              muscleGroup: {
                                type: Type.STRING,
                                enum: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full Body'],
                              },
                              targetSets: { type: Type.INTEGER },
                              targetReps: { type: Type.STRING },
                              restSeconds: { type: Type.INTEGER },
                              targetRpe: { type: Type.NUMBER },
                              loadGuidance: { type: Type.STRING },
                            },
                            required: ['name', 'muscleGroup', 'targetSets', 'targetReps', 'restSeconds', 'targetRpe', 'loadGuidance'],
                          },
                        },
                      },
                      required: ['name', 'splitType', 'description', 'exercises'],
                    },
                  },
                },
                required: ['weekNumber', 'isDeload', 'summary', 'sessions'],
              },
            },
          },
          required: ['title', 'focus', 'durationWeeks', 'deloadWeekNumber', 'weeks'],
        },
      },
    });

    const raw = (response.text ?? '').trim();
    if (!raw) {
      res.status(502).json({ error: 'Maloxie AI returned an empty program. Please try again.' });
      return;
    }

    const program = JSON.parse(raw);
    res.json({ program });
  } catch (err) {
    const { status, message } = getFriendlyGeminiError(err);
    res.status(status).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Maloxie server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Maloxie server:', err);
  process.exit(1);
});
