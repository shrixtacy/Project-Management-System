import JSZip from 'jszip';
import { BACKEND_URL } from '../services/supabaseClient';
import { toast } from 'sonner';

/**
 * Downloads a deliverable securely.
 * Handles both zipped legacy files and modern raw files.
 * Uses a backend proxy to bypass CORS and avoid browser redirects.
 */
export async function downloadDeliverable(fileUrl: string, originalFileName: string, fileType: string) {
  const loadingToast = toast.loading(`Starting download for ${originalFileName}...`);
  
  try {
    console.log(`Starting download for: ${originalFileName} (${fileUrl})`);
    
    // 1. Point to the proxy. The backend proxy will return a 302 Redirect directly to Cloudinary
    // This avoids fetching 40MB files through Vercel Edge Serverless functions.
    const proxyUrl = `${BACKEND_URL}/upload/proxy-download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(originalFileName)}`;
    
    // 2. Trigger browser native download navigation
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = proxyUrl;
    // We optionally add target="_blank" so it doesn't navigate away if it's not a forced download,
    // but Cloudinary 'attachment' header forces a download anyway.
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
    }, 100);
    
    toast.dismiss(loadingToast);
    toast.success('Download initiated');

  } catch (err: any) {
    console.error('Download utility error:', err);
    toast.dismiss(loadingToast);
    toast.error(`Download failed: ${err.message || 'Please try again'}`);
  }
}
