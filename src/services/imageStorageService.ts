import { auth } from './firebase';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  targetFormat?: 'image/webp' | 'image/jpeg';
}

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
}

export type UploadProgressCallback = (percent: number) => void;
export type UploadCancelRef = { current?: () => void };

// 5MB maximum file size
export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Default visual fallbacks
export const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
export const DEFAULT_STORE_PHOTO = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80';
export const DEFAULT_STORE_BANNER = 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1200&q=80';
export const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80';

/**
 * Validate image file type and size before processing
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported image format. Please select a JPEG, PNG, or WebP photo.',
    };
  }

  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Please choose an image smaller than 5 MB.',
    };
  }

  return { valid: true };
}

/**
 * Client-side high-performance image resize & compression
 * Converts camera/device photos into web-optimized WebP or JPEG blobs in milliseconds.
 * Includes a safety timeout so it never hangs indefinitely.
 */
export async function optimizeImage(
  file: File | Blob,
  options: ImageOptimizationOptions = {}
): Promise<{ blob: Blob; width: number; height: number }> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.85,
    targetFormat = 'image/webp',
  } = options;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Image processing timed out. The image may be corrupt or too large.'));
    }, 6000);

    const cleanup = () => clearTimeout(timeoutId);

    const reader = new FileReader();
    reader.onerror = () => {
      cleanup();
      reject(new Error('Failed to read image file.'));
    };

    reader.onload = () => {
      try {
        const img = new Image();
        img.onerror = () => {
          cleanup();
          reject(new Error('Failed to decode image data. Please verify the file is a valid picture.'));
        };

        img.onload = () => {
          try {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            if (width === 0 || height === 0) {
              cleanup();
              reject(new Error('Invalid image dimensions.'));
              return;
            }

            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = Math.max(1, Math.round(width * ratio));
              height = Math.max(1, Math.round(height * ratio));
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              cleanup();
              reject(new Error('HTML Canvas 2D context unavailable on this device.'));
              return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                cleanup();
                if (blob) {
                  resolve({ blob, width, height });
                } else {
                  canvas.toBlob(
                    (jpegBlob) => {
                      if (jpegBlob) {
                        resolve({ blob: jpegBlob, width, height });
                      } else {
                        reject(new Error('Failed to compress image data into WebP/JPEG.'));
                      }
                    },
                    'image/jpeg',
                    quality
                  );
                }
              },
              targetFormat,
              quality
            );
          } catch (canvasErr: any) {
            cleanup();
            reject(new Error(`Image rendering failed: ${canvasErr?.message || canvasErr}`));
          }
        };

        img.src = reader.result as string;
      } catch (readErr: any) {
        cleanup();
        reject(new Error(`Failed to initialize image decoder: ${readErr?.message || readErr}`));
      }
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Convert a binary Blob to an optimized base64 Data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert image to data URL format.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image stream.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Helper to get Cloudinary configuration from environment variables
 */
export function getCloudinaryConfig(): { cloudName: string; uploadPreset: string } {
  // Direct compile-time access for Vite environment variables
  const rawCloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
  const rawPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

  const cloudName = String(rawCloud).trim().replace(/^["']|["']$/g, '');
  const uploadPreset = String(rawPreset).trim().replace(/^["']|["']$/g, '');

  return { cloudName, uploadPreset };
}

/**
 * Formats Cloudinary / Storage error messages
 */
export function formatStorageError(error: any): string {
  if (!error) return 'Image upload failed. Please try again.';
  const message = error?.message || (typeof error === 'string' ? error : 'Image upload failed.');
  return message;
}

/**
 * Upload an image file to Cloudinary using browser-safe unsigned upload presets,
 * real-time upload progress tracking, and client-side optimization.
 */
export async function uploadImageToStorage(
  file: File | Blob,
  storagePath: string,
  options?: ImageOptimizationOptions,
  onProgress?: UploadProgressCallback,
  cancelRef?: UploadCancelRef,
  customFolder?: string
): Promise<UploadResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required: Please sign in with your Google account to upload photos.');
  }

  const { cloudName, uploadPreset } = getCloudinaryConfig();
  if (!cloudName) {
    throw new Error(
      'Cloudinary configuration missing: VITE_CLOUDINARY_CLOUD_NAME is not set. Please set VITE_CLOUDINARY_CLOUD_NAME in your Vercel Project Environment Variables and trigger a redeploy.'
    );
  }
  if (!uploadPreset) {
    throw new Error(
      'Cloudinary configuration missing: VITE_CLOUDINARY_UPLOAD_PRESET is not set. Please set VITE_CLOUDINARY_UPLOAD_PRESET in your Vercel Project Environment Variables and trigger a redeploy.'
    );
  }

  // Determine Cloudinary folder based on category or storagePath
  let folder = customFolder || 'localcart';
  if (!customFolder) {
    if (storagePath.includes('profile') || storagePath.includes('avatar')) {
      folder = 'localcart/profiles';
    } else if (storagePath.includes('banner')) {
      folder = 'localcart/banners';
    } else if (storagePath.includes('store')) {
      folder = 'localcart/stores';
    } else if (storagePath.includes('product')) {
      folder = 'localcart/products';
    }
  }

  let isCancelled = false;
  let xhrRef: XMLHttpRequest | null = null;

  if (cancelRef) {
    cancelRef.current = () => {
      isCancelled = true;
      if (xhrRef) {
        try {
          xhrRef.abort();
        } catch {}
      }
    };
  }

  // 1. Optimize image client-side first (compress to WebP under limits)
  onProgress?.(10);
  const { blob } = await optimizeImage(file, options);
  if (isCancelled) {
    throw new Error('Image upload was cancelled by user.');
  }
  onProgress?.(25);

  // 2. Perform direct browser upload to Cloudinary using XMLHttpRequest for real progress events
  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef = xhr;

    xhr.upload.onprogress = (event) => {
      if (isCancelled) return;
      if (event.lengthComputable && event.total > 0) {
        // Map progress from 25% to 95%
        const rawPct = event.loaded / event.total;
        const scaledPct = Math.min(95, Math.round(25 + rawPct * 70));
        onProgress?.(scaledPct);
      }
    };

    xhr.onload = () => {
      xhrRef = null;
      if (isCancelled) {
        reject(new Error('Image upload was cancelled by user.'));
        return;
      }

      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
          onProgress?.(100);
          resolve({
            downloadUrl: data.secure_url,
            storagePath: data.public_id || storagePath,
          });
        } else {
          let errMsg = data?.error?.message || `Upload failed with HTTP ${xhr.status}`;
          // Cloudinary responds with "Unknown API key" when the cloud name in the URL does not exist or has a typo
          if (errMsg.toLowerCase().includes('unknown api key')) {
            errMsg = `Cloudinary cloud name "${cloudName}" was not recognized. Please verify that VITE_CLOUDINARY_CLOUD_NAME in Vercel settings matches your Cloudinary cloud name (check for typos like double letters).`;
          } else if (errMsg.toLowerCase().includes('upload preset not found') || (errMsg.toLowerCase().includes('preset') && errMsg.toLowerCase().includes('unsigned'))) {
            errMsg = `Cloudinary upload preset "${uploadPreset}" was not found or is not set to Unsigned mode in Cloudinary Settings.`;
          }
          console.error('Cloudinary upload error response:', data);
          reject(new Error(`Cloudinary upload failed: ${errMsg}`));
        }
      } catch (parseErr: any) {
        reject(new Error(`Failed to parse Cloudinary response: ${parseErr?.message || parseErr}`));
      }
    };

    xhr.onerror = () => {
      xhrRef = null;
      if (isCancelled) {
        reject(new Error('Image upload was cancelled by user.'));
        return;
      }
      reject(new Error('Network error connecting to Cloudinary. Please check your internet connection.'));
    };

    xhr.onabort = () => {
      xhrRef = null;
      reject(new Error('Image upload was cancelled by user.'));
    };

    // Unsigned upload payload: send ONLY file and upload_preset (plus folder)
    // Never send api_key, api_secret, or signatures
    const formData = new FormData();
    const fileName = (file as File).name || `upload_${Date.now()}.webp`;
    formData.append('file', blob, fileName);
    formData.append('upload_preset', uploadPreset);
    if (folder) {
      formData.append('folder', folder);
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
    xhr.open('POST', uploadUrl, true);
    xhr.send(formData);
  });
}

/**
 * Upload Buyer or Seller Profile Avatar
 * Folder: localcart/profiles
 */
export async function uploadUserProfilePhoto(
  file: File,
  onProgress?: UploadProgressCallback,
  cancelRef?: UploadCancelRef
): Promise<UploadResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in with your Google account to update your profile photo.');

  const validation = validateImageFile(file);
  if (!validation.valid) throw new Error(validation.error);

  const path = `users/${uid}/profile/avatar_${Date.now()}`;
  return uploadImageToStorage(
    file,
    path,
    {
      maxWidth: 600,
      maxHeight: 600,
      quality: 0.88,
    },
    onProgress,
    cancelRef,
    'localcart/profiles'
  );
}

/**
 * Upload Seller Store/Business Main Photo
 * Folder: localcart/stores
 */
export async function uploadStorePhoto(
  file: File,
  storeId: string,
  onProgress?: UploadProgressCallback,
  cancelRef?: UploadCancelRef
): Promise<UploadResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in with your Google account to update your store photo.');
  if (!storeId) throw new Error('Store identifier is required.');

  const validation = validateImageFile(file);
  if (!validation.valid) throw new Error(validation.error);

  const path = `stores/${storeId}/store-photo_${Date.now()}`;
  return uploadImageToStorage(
    file,
    path,
    {
      maxWidth: 1000,
      maxHeight: 1000,
      quality: 0.88,
    },
    onProgress,
    cancelRef,
    'localcart/stores'
  );
}

/**
 * Upload Seller Store Banner/Cover Photo
 * Folder: localcart/banners
 */
export async function uploadStoreBanner(
  file: File,
  storeId?: string,
  onProgress?: UploadProgressCallback,
  cancelRef?: UploadCancelRef
): Promise<UploadResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in with your Google account to update your store banner.');

  const validation = validateImageFile(file);
  if (!validation.valid) throw new Error(validation.error);

  const targetId = storeId || uid;
  const path = `stores/${targetId}/banner_${Date.now()}`;
  return uploadImageToStorage(
    file,
    path,
    {
      maxWidth: 1600,
      maxHeight: 900,
      quality: 0.85,
    },
    onProgress,
    cancelRef,
    'localcart/banners'
  );
}

/**
 * Upload Product Image
 * Folder: localcart/products
 */
export async function uploadProductImage(
  file: File,
  storeId: string,
  productId: string,
  isSecondary: boolean = false,
  imageId?: string,
  onProgress?: UploadProgressCallback,
  cancelRef?: UploadCancelRef
): Promise<UploadResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in with your Google account to upload product images.');
  if (!storeId) throw new Error('Store ID required.');
  if (!productId) throw new Error('Product ID required.');

  const validation = validateImageFile(file);
  if (!validation.valid) throw new Error(validation.error);

  const targetId = imageId || (isSecondary ? `img_${Date.now()}` : 'primary');
  const path = `stores/${storeId}/products/${productId}/${targetId}_${Date.now()}`;

  return uploadImageToStorage(
    file,
    path,
    {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.88,
    },
    onProgress,
    cancelRef,
    'localcart/products'
  );
}

/**
 * Safely delete an image file from storage
 * Note: Cloudinary unsigned client-side uploads do not expose API secrets for deletion.
 * This function resolves cleanly to allow seamless UI replacement without errors.
 */
export async function deleteStorageImage(storagePathOrUrl: string): Promise<void> {
  if (!storagePathOrUrl || storagePathOrUrl.startsWith('data:') || storagePathOrUrl.includes('unsplash.com')) {
    return;
  }
  // Client-side delete is a safe no-op since Cloudinary API secrets are kept server-side only
}

/**
 * Cleanup all storage assets associated with a store when deleted
 */
export async function cleanupStoreStorage(storeId: string): Promise<void> {
  if (!storeId) return;
  // Client-side cleanup is a safe no-op
}
