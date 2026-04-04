import express from 'express';
import cors from 'cors';
import authRoutes from '../backend/src/routes/auth';
import uploadRoutes from '../backend/src/routes/upload';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes as any);
app.use('/api/upload', uploadRoutes as any);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PMS Backend is running on Vercel.' });
});

export default app;
