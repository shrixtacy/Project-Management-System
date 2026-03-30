import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import uploadRoutes from './routes/upload';

import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PMS Backend is running.' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
