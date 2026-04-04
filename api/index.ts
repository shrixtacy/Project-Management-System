import express from 'express';
import cors from 'cors';
import authRoutes from '../backend/src/routes/auth.js';
import uploadRoutes from '../backend/src/routes/upload.js';

const app = express();

app.use(cors());
app.use(express.json());

// Request logger for Vercel logs
app.use((req, res, next) => {
  console.log(`[Vercel API] ${req.method} ${req.url}`);
  next();
});

// Mount routes on both /api and root paths to handle Vercel rewrites gracefully
app.use('/api/auth', authRoutes as any);
app.use('/api/upload', uploadRoutes as any);
app.use('/auth', authRoutes as any);
app.use('/upload', uploadRoutes as any);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'PMS Backend is running on Vercel.',
    env: {
      hasSupabase: !!process.env.SUPABASE_URL,
      hasCloudinary: !!process.env.CLOUDINARY_CLOUD_NAME
    }
  });
});

// Global Error Handler to prevent HTML 500 pages
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Vercel API Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

export default app;
