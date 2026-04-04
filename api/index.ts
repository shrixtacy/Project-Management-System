import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

let authRoutes: any = null;
let uploadRoutes: any = null;
let importError: string | null = null;

// Use top-level await to catch import issues at runtime
try {
  const [authMod, uploadMod] = await Promise.all([
    import('../backend/src/routes/auth.js'),
    import('../backend/src/routes/upload.js')
  ]);
  authRoutes = authMod.default;
  uploadRoutes = uploadMod.default;
  console.log('[Vercel API] Routes imported successfully');
} catch (err: any) {
  importError = err.message;
  console.error('[Vercel API] Fatal Import Error:', err);
}

// Request logger
app.use((req, res, next) => {
  console.log(`[Vercel API Request] ${req.method} ${req.url}`);
  next();
});

// Connectivity Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: importError ? 'degraded' : 'ok', 
    message: 'PMS Backend is running on Vercel.',
    importError,
    env: {
      hasSupabase: !!process.env.SUPABASE_URL,
      hasCloudinary: !!process.env.CLOUDINARY_CLOUD_NAME
    }
  });
});

// Only mount routes if they were actually imported
if (authRoutes) app.use(['/api/auth', '/auth'], authRoutes);
if (uploadRoutes) app.use(['/api/upload', '/upload'], uploadRoutes);

// Catch-all for diagnostics
app.use('*', (req, res) => {
  if (importError) {
    return res.status(500).json({ error: 'Backend Initialization Failed', details: importError });
  }
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

export default app;
