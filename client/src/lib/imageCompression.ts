/**
 * Image compression utility for optimizing images before upload
 * Reduces file size while maintaining acceptable quality
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1, default 0.8
  format?: 'webp' | 'jpeg'; // Default: webp for modern browsers, fallback jpeg
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 800,
  maxHeight: 1000,
  quality: 0.75,
  format: 'webp'
};

/**
 * Compress an image file
 * @param file - Image file to compress
 * @param options - Compression options
 * @returns Promise<Blob> compressed image blob
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Calculate new dimensions while maintaining aspect ratio
        if (opts.maxWidth && width > opts.maxWidth) {
          height = (height * opts.maxWidth) / width;
          width = opts.maxWidth;
        }

        if (opts.maxHeight && height > opts.maxHeight) {
          width = (width * opts.maxHeight) / height;
          height = opts.maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          `image/${opts.format}`,
          opts.quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));

      const result = event.target?.result;
      if (typeof result === 'string') {
        img.src = result;
      } else {
        reject(new Error('Failed to read file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => reject(new Error('Failed to load image'));

      const result = event.target?.result;
      if (typeof result === 'string') {
        img.src = result;
      } else {
        reject(new Error('Failed to read file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Estimate compression savings
 */
export function estimateCompressionSavings(
  originalSize: number,
  compressedSize: number
): number {
  if (originalSize === 0) return 0;
  return ((originalSize - compressedSize) / originalSize) * 100;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
