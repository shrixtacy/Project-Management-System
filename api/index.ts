import express from 'express';
import cors from 'cors';
import serverless from 'serverless-http';
import authRoutes from '../backend/src/routes/auth';
import uploadRoutes from '../backend/src/routes/upload';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PMS Backend is running on Vercel.' });
});

export default serverless(app);
