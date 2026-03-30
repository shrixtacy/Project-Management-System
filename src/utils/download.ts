import JSZip from 'jszip';
import { BACKEND_URL } from '../services/supabaseClient';
import { toast } from 'sonner';

/**
 * Downloads a deliverable securely.
 * Handles both zipped legacy files and modern raw files.
 * Uses a backend proxy to bypass CORS and avoid browser redirects.
 */
export async function downloadDeliverable(fileUrl: string, originalFileName: string, fileType: string) {
  const loadingToast = toast.loading(`Preparing ${originalFileName}...`);
  
  try {
    console.log(`Starting download for: ${originalFileName} (${fileUrl})`);
    
    // 1. Fetch the file via the backend proxy
    const proxyUrl = `${BACKEND_URL}/upload/proxy-download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(originalFileName)}`;
    
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
        let errorMsg = 'Failed to fetch from storage';
        try {
            const errBody = await response.json();
            errorMsg = errBody.error || errorMsg;
        } catch (e) { /* ignore parse error */ }
        throw new Error(errorMsg);
    }

    const blob = await response.blob();
    
    // 2. Detective work: Is it a zip? Use magic numbers
    // Legacy files were often zips containing the real file
    const buffer = await blob.slice(0, 4).arrayBuffer();
    const header = new Uint8Array(buffer);
    const isZip = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;

    let finalBlob = blob;

    if (isZip) {
      console.log('Zip signature detected. Attempting to extract...');
      try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(blob);
        const files = Object.keys(contents.files);
        // Find the first actual file (not a directory)
        const firstFile = files.find(name => !contents.files[name].dir);
        if (firstFile) {
          finalBlob = await contents.files[firstFile].async('blob');
          console.log(`Extracted: ${firstFile}`);
        }
      } catch (zipErr) {
        console.warn('Failed to unzip file, serving original zip instead.', zipErr);
      }
    }

    // 3. Trigger immediate browser download (no redirection)
    const blobUrl = window.URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobUrl;
    a.download = originalFileName;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
    }, 100);
    
    toast.dismiss(loadingToast);
    toast.success('Download started');

  } catch (err: any) {
    console.error('Download utility error:', err);
    toast.dismiss(loadingToast);
    toast.error(`Download failed: ${err.message || 'Please try again'}`);
    
    // We REMOVED the automated redirect to prevent the broken "new tab" experience.
    // The user should stay on the page and be informed of the error.
  }
}
