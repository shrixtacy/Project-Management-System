import { toast } from 'sonner';

/**
 * Downloads a deliverable by opening the Cloudinary URL directly.
 * For raw Cloudinary files, we fetch via the proxy-download endpoint
 * which returns a signed redirect — opened in a new tab to trigger download.
 */
export async function downloadDeliverable(fileUrl: string, originalFileName: string, fileType: string) {
  const loadingToast = toast.loading(`Downloading ${originalFileName}...`);

  try {
    // Build the proxy URL — serverless returns a 302 to a signed Cloudinary URL
    const proxyUrl = `/api/upload/proxy-download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(originalFileName)}`;

    // Fetch the redirect target from the proxy
    const res = await fetch(proxyUrl, { redirect: 'follow' });

    if (!res.ok) {
      let msg = 'Download failed';
      try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
      throw new Error(msg);
    }

    // Get the final blob and force-download it
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = originalFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

    toast.dismiss(loadingToast);
    toast.success('Download complete');
  } catch (err: any) {
    toast.dismiss(loadingToast);
    toast.error(`Download failed: ${err.message || 'Please try again'}`);
  }
}
