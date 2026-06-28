import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import specRoutes from './routes/specs.js';
import catalogueRoutes from './routes/catalogue.js';
import { errorHandler } from './middleware/error.js';

const app = express();

// Allow any localhost/127.0.0.1 origin in dev (Vite may pick 5173, 5174, …),
// plus an explicit CORS_ORIGIN if set.
const allowedOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl / same-origin / server-to-server
      if (allowedOrigin && origin === allowedOrigin) return cb(null, true);
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    aiProvider: process.env.AI_PROVIDER || 'claude',
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/specs', specRoutes);
app.use('/api/v1/catalogue', catalogueRoutes);

app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`[server] Spec Generator API listening on http://localhost:${port}`);
});
