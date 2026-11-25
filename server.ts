import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateCoachResponse,
  generateTrainingProgram,
} from './src/services/maloxieEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'maloxie-api' });
});

app.post('/api/ai/coach', (req, res) => {
  try {
    const { question, history, trainingContext } = req.body ?? {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'Please enter a training question for Maloxie AI.' });
      return;
    }

    const answer = generateCoachResponse({
      question,
      history,
      trainingContext,
    });

    res.json({ answer });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Maloxie AI could not complete the request: ${msg}` });
  }
});

app.post('/api/ai/program', (req, res) => {
  try {
    const { goalPrompt, durationWeeks, daysPerWeek, includeDeload, splitPreference, trainingContext } =
      req.body ?? {};

    const program = generateTrainingProgram({
      goalPrompt,
      durationWeeks,
      daysPerWeek,
      includeDeload,
      splitPreference,
      trainingContext,
    });

    res.json({ program });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Maloxie AI could not generate the program: ${msg}` });
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
