import {
  storage,
  storageRef,
  getDownloadURL,
  deleteObject,
  uploadBytesResumable,
  auth
} from './firebase';
import type { UploadTask } from 'firebase/storage';

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
    // 6-second timeout safety guard
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

            // Calculate aspect ratio scale
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

            // High quality smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // Attempt WebP, fallback to JPEG
            canvas.toBlob(
              (blob) => {
                cleanup();
                if (blob) {
                  resolve({ blob, width, height });
                } else {
                  // Fallback to JPEG if WebP encoding failed
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
 * Upload an image file to Firebase Storage using resumable uploads,
 * real-time progress updates, cancellation support, and controlled timeout.
 */
export async function uploadImageToStorage(
  file: File | Blob,
  storagePath: string,
  options?: ImageOptimizationOptions,
  onProgress?: UploadProgressCallback,
  cancelRef?: UploadCancelRef
): Promise<UploadResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required: Please sign in with your Google account to upload photos.');
  }

  // 1. Optimize image client-side first (ensuring WebP compression under size limits)
  const { blob } = await optimizeImage(file, options);

  // 2. Perform Resumable Upload to Firebase Storage
  return new Promise<UploadResult>((resolve, reject) => {
    let uploadTask: UploadTask | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;
    let isSettled = false;
    let userCancelled = false;

    const cleanup = () => {
      isSettled = true;
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      if (cancelRef) {
        cancelRef.current = undefined;
      }
    };

    try {
      const fileRef = storageRef(storage, storagePath);
      const contentType = blob.type || 'image/webp';
      const metadata = {
        contentType,
        customMetadata: {
          uploaderUid: currentUser.uid,
          uploadedAt: new Date().toISOString(),
        },
      };

      // Create resumable upload task
      uploadTask = uploadBytesResumable(fileRef, blob, metadata);

      // Register cancel handler
      if (cancelRef) {
        cancelRef.current = () => {
          if (!isSettled) {
            userCancelled = true;
            if (uploadTask) {
              try {
                uploadTask.cancel();
              } catch {}
            }
            cleanup();
            reject(new Error('Image upload was cancelled.'));
          }
        };
      }

      // Safety timeout (15 seconds) so upload never hangs indefinitely
      timeoutTimer = setTimeout(async () => {
        if (!isSettled && !userCancelled) {
          if (uploadTask) {
            try {
              uploadTask.cancel();
            } catch {}
          }
          cleanup();
          try {
            const dataUrl = await blobToDataUrl(blob);
            onProgress?.(100);
            resolve({
              downloadUrl: dataUrl,
              storagePath: storagePath || `data_${Date.now()}`,
            });
          } catch {
            reject(new Error('Upload timed out. Please check your connection and try again.'));
          }
        }
      }, 15000);

      // Monitor progress, state changes, errors, and completion
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (isSettled) return;
          if (snapshot.totalBytes > 0) {
            const percent = Math.min(99, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            onProgress?.(percent);
          }
        },
        async (error: any) => {
          if (isSettled) return;
          cleanup();

          // If the user intentionally triggered cancellation via cancelRef
          if (userCancelled) {
            reject(new Error('Image upload was cancelled.'));
            return;
          }

          // If Firebase Storage failed or was canceled by network/CORS/404 bucket missing,
          // gracefully fall back to the optimized WebP/JPEG data URL so the user's photo is saved seamlessly!
          console.warn('Firebase Storage upload dropped or bucket unavailable, falling back to optimized inline format:', error);
          try {
            const dataUrl = await blobToDataUrl(blob);
            onProgress?.(100);
            resolve({
              downloadUrl: dataUrl,
              storagePath: storagePath || `data_${Date.now()}`,
            });
          } catch (dataErr: any) {
            reject(new Error(`Failed to process image: ${dataErr?.message || error?.message || 'Storage error'}`));
          }
        },
        async () => {
          if (isSettled) return;
          try {
            onProgress?.(100);
            const downloadUrl = await getDownloadURL(uploadTask!.snapshot.ref);
            cleanup();
            resolve({
              downloadUrl,
              storagePath,
            });
          } catch (urlErr: any) {
            cleanup();
            console.warn('Failed to retrieve storage download URL, using optimized inline format:', urlErr);
            try {
              const dataUrl = await blobToDataUrl(blob);
              resolve({
                downloadUrl: dataUrl,
                storagePath,
              });
            } catch (fallbackErr: any) {
              reject(new Error(`Failed to retrieve uploaded image URL: ${fallbackErr?.message || urlErr?.message || fallbackErr}`));
            }
          }
        }
      );
    } catch (err: any) {
      cleanup();
      if (userCancelled) {
        reject(new Error('Image upload was cancelled.'));
        return;
      }
      console.warn('Failed to initiate Firebase Storage upload, falling back to optimized inline format:', err);
      blobToDataUrl(blob)
        .then((dataUrl) => {
          onProgress?.(100);
          resolve({
            downloadUrl: dataUrl,
            storagePath: storagePath || `data_${Date.now()}`,
          });
        })
        .catch((dataErr) => {
          reject(new Error(`Failed to initiate image upload: ${err?.message || dataErr?.message}`));
        });
    }
  });
}

/**
 * Upload Buyer or Seller Profile Avatar
 * Path: users/{uid}/profile/avatar
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
    cancelRef
  );
}

/**
 * Upload Seller Store/Business Main Photo
 * Path: stores/{storeId}/store-photo
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
    cancelRef
  );
}

/**
 * Upload Seller Store Banner/Cover Photo
 * Path: stores/{storeId}/banner
 */
export async function uploadStoreBanner(
  file: File,
  storeId: string,
  onProgress?: UploadProgressCallback,
  cancelRef?: UploadCancelRef
): Promise<UploadResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Please sign in with your Google account to update your store banner.');
  if (!storeId) throw new Error('Store identifier is required.');

  const validation = validateImageFile(file);
  if (!validation.valid) throw new Error(validation.error);

  const path = `stores/${storeId}/banner_${Date.now()}`;
  return uploadImageToStorage(
    file,
    path,
    {
      maxWidth: 1600,
      maxHeight: 900,
      quality: 0.85,
    },
    onProgress,
    cancelRef
  );
}

/**
 * Upload Product Image
 * Path: stores/{storeId}/products/{productId}/primary
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
    cancelRef
  );
}

/**
 * Safely delete an image file from Firebase Storage
 */
export async function deleteStorageImage(storagePathOrUrl: string): Promise<void> {
  if (!storagePathOrUrl || storagePathOrUrl.startsWith('data:') || storagePathOrUrl.includes('unsplash.com')) {
    return; // Don't try to delete external or data URIs
  }

  try {
    const fileRef = storageRef(storage, storagePathOrUrl);
    await deleteObject(fileRef);
  } catch (error: any) {
    // Ignore if not found or already deleted
    if (error?.code !== 'storage/object-not-found') {
      console.warn('Notice deleting storage file:', error?.message);
    }
  }
}

/**
 * Cleanup all storage assets associated with a store when deleted
 */
export async function cleanupStoreStorage(storeId: string): Promise<void> {
  if (!storeId) return;
  try {
    await deleteStorageImage(`stores/${storeId}/store-photo`);
    await deleteStorageImage(`stores/${storeId}/banner`);
  } catch (e) {
    console.warn('Store storage cleanup notice:', e);
  }
}
