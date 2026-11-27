/**
 * Client-side Image Optimization & Clipboard Service
 * Compresses pasted/dropped/uploaded photos into crisp, fast-syncing Data URLs
 * suitable for inline note storage and real-time collaborative broadcasting.
 */

const MAX_INPUT_BYTES = 15 * 1024 * 1024; // 15 MB input guard
const MAX_DIMENSION_PX = 1400;
const OUTPUT_QUALITY = 0.82;

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo leer la imagen seleccionada.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Formato de imagen no compatible.'));
    img.src = src;
  });
}

export class ImageService {
  /**
   * Processes a pasted, dropped, or uploaded image file and returns an optimized Data URL.
   */
  public static async processImageFile(file: File | Blob): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('El archivo seleccionado no es una imagen válida.');
    }

    if (file.size > MAX_INPUT_BYTES) {
      throw new Error('La imagen supera el límite máximo de 15 MB.');
    }

    const rawDataUrl = await readFileAsDataUrl(file);

    // Keep lightweight SVGs or small animated GIFs untouched
    if (
      (file.type === 'image/gif' || file.type === 'image/svg+xml') &&
      file.size <= 900 * 1024
    ) {
      return rawDataUrl;
    }

    try {
      const img = await loadImageElement(rawDataUrl);
      let { width, height } = img;

      if (width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
        const scale = Math.min(MAX_DIMENSION_PX / width, MAX_DIMENSION_PX / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return rawDataUrl;

      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP when supported for best quality/size ratio, fallback to JPEG
      const webpUrl = canvas.toDataURL('image/webp', OUTPUT_QUALITY);
      if (webpUrl.startsWith('data:image/webp')) {
        return webpUrl;
      }
      return canvas.toDataURL('image/jpeg', OUTPUT_QUALITY);
    } catch {
      return rawDataUrl;
    }
  }

  /**
   * Extracts image files from a ClipboardEvent (e.g. Ctrl+V screenshot or copied photo).
   */
  public static extractImagesFromClipboard(clipboardData: DataTransfer | null): File[] {
    if (!clipboardData) return [];
    const files: File[] = [];

    if (clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i += 1) {
        const item = clipboardData.items[i];
        if (item && item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
    }

    if (files.length === 0 && clipboardData.files) {
      for (let i = 0; i < clipboardData.files.length; i += 1) {
        const f = clipboardData.files[i];
        if (f && f.type.startsWith('image/')) {
          files.push(f);
        }
      }
    }

    return files;
  }

  /**
   * Validates a pasted external image URL (https:// or data:image/).
   */
  public static isValidImageUrl(raw: string): boolean {
    const trimmed = raw.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('data:image/')) return true;
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }
}
