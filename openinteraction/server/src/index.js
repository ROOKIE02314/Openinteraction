import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db/database.js';
import interviewRoutes from './routes/interview.js';
import chatRoutes from './routes/chat.js';

const dbPath = process.env.DB_PATH || './data/interview.db';
initDb(dbPath);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/interview', interviewRoutes);
app.use('/api/chat', chatRoutes);

const PORT = process.env.PORT || 3001;

// Only start listening if not imported as module (for testing)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
