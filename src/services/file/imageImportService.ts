/**
 * Image Import Service
 *
 * Reads image files from disk and converts them to base64 data URLs
 * for embedding in the canvas as ImageShape objects.
 */

import { readFile } from '@tauri-apps/plugin-fs';

export interface ImportedImage {
  dataUrl: string;
  width: number;
  height: number;
  filePath: string;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return mimeTypes[ext] || 'image/png';
}

/**
 * Convert a Uint8Array to a base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Get image dimensions by loading it into an HTMLImageElement
 */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image for dimension detection'));
    };
    img.src = dataUrl;
  });
}

/**
 * Import an image file from disk.
 * Reads the file as binary, converts to base64 data URL, and determines dimensions.
 */
export async function importImage(filePath: string): Promise<ImportedImage> {
  const bytes = await readFile(filePath);
  const mimeType = getMimeType(filePath);
  const base64 = uint8ArrayToBase64(bytes);
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const { width, height } = await getImageDimensions(dataUrl);

  return {
    dataUrl,
    width,
    height,
    filePath,
  };
}
