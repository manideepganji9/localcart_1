import {
  storage,
  storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
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
 * Fast diagnostic probe to check if the Firebase Storage bucket is provisioned and reachable.
 * Simple GET requests to /v0/b/{bucket}/o have Access-Control-Allow-Origin: * so any browser can read the status directly.
 */
export async function verifyBucketStatus(bucketName: string): Promise<{ ok: boolean; status: number; message?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://firebasestorage.googleapis.com/v0/b/${bucketName}/o`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 404) {
      return {
        ok: false,
        status: 404,
        message: `Firebase Cloud Storage is not enabled for project "${auth.app.options.projectId || 'my-localcart'}". The storage bucket "${bucketName}" was not found. Please activate Cloud Storage in the Firebase Console (Build > Storage > Get Started).`,
      };
    }
    return { ok: true, status: res.status };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, status: 408, message: `Storage request timed out while connecting to bucket "${bucketName}".` };
    }
    // Cross-origin or network error; let resumable upload attempt run
    return { ok: true, status: 0 };
  }
}

/**
 * Formats Firebase Storage errors with clear, actionable distinction between:
 * - Uninitialized or non-existent bucket
 * - Storage security rule permissions
 * - CORS / cross-origin preflight policy
 * - Authentication state
 * - Real timeouts
 */
export async function formatDetailedStorageError(error: any, bucketName: string, storagePath: string): Promise<string> {
  const code = error?.code || '';
  const status = error?.status_ || error?.status;
  const message = error?.message || '';
  const serverResponse = error?.serverResponse || error?.customData?.serverResponse || '';

  // 1. Proactively test whether the bucket exists
  const bucketCheck = await verifyBucketStatus(bucketName);
  if (!bucketCheck.ok && bucketCheck.status === 404) {
    return bucketCheck.message!;
  }

  // 2. Permission / Storage Security Rules
  if (
    code === 'storage/unauthorized' ||
    status === 403 ||
    serverResponse.includes('403') ||
    message.includes('permission') ||
    message.includes('unauthorized')
  ) {
    return `Permission denied: Firebase Storage security rules rejected write access to "${storagePath}". Please make sure you are signed in with the authorized account.`;
  }

  if (code === 'storage/unauthenticated') {
    return 'Authentication required: Please sign in with your Google account to upload photos.';
  }

  // 3. Bucket not found
  if (
    code === 'storage/bucket-not-found' ||
    status === 404 ||
    serverResponse.includes('404') ||
    serverResponse.includes('NoSuchBucket')
  ) {
    return `Firebase Cloud Storage bucket "${bucketName}" was not found. Please activate Cloud Storage in the Firebase Console (Build > Storage > Get Started).`;
  }

  // 4. Quota exceeded
  if (code === 'storage/quota-exceeded') {
    return `Storage quota exceeded for Firebase project "${auth.app.options.projectId}". Please check project usage limits in Firebase Console.`;
  }

  // 5. User cancellation
  if (code === 'storage/canceled') {
    return 'Image upload was cancelled.';
  }

  // 6. File integrity checksum
  if (code === 'storage/invalid-checksum') {
    return 'File upload integrity check failed. Please try uploading the image again.';
  }

  // 7. CORS vs Network retry limit
  if (code === 'storage/retry-limit-exceeded') {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `Upload blocked by CORS policy or network policy on bucket "${bucketName}". Please ensure CORS is configured for origin "${origin}".`;
  }

  if (message.includes('CORS') || message.includes('preflight') || message.includes('Failed to fetch')) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `Cross-Origin (CORS) error communicating with Firebase Storage from ${origin}.`;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'No internet connection detected. Please reconnect to the internet and try again.';
  }

  return message ? `Firebase Storage upload failed: ${message}` : 'Failed to complete image upload.';
}

/**
 * Backward-compatible synchronous error formatter
 */
export function formatStorageError(error: any): string {
  const code = error?.code || '';
  const status = error?.status_ || error?.status;
  const message = error?.message || '';

  if (
    code === 'storage/bucket-not-found' ||
    status === 404 ||
    message.includes('404') ||
    message.includes('NoSuchBucket')
  ) {
    return 'Cloud Storage bucket not initialized or not found. Please activate Cloud Storage in the Firebase Console (Build > Storage > Get Started).';
  }

  if (code === 'storage/unauthorized' || status === 403 || message.includes('permission') || message.includes('unauthorized')) {
    return 'Permission denied: Firebase Storage security rules rejected this upload. Please verify your login session.';
  }

  if (code === 'storage/unauthenticated') {
    return 'Authentication required: Please sign in with your Google account.';
  }

  if (code === 'storage/quota-exceeded') {
    return 'Firebase Storage quota exceeded.';
  }

  if (code === 'storage/retry-limit-exceeded') {
    return 'Upload request timed out or blocked by CORS policy.';
  }

  if (code === 'storage/canceled') {
    return 'Image upload was cancelled.';
  }

  return message ? `Upload failed: ${message}` : 'Failed to upload image to Firebase Storage.';
}

/**
 * Upload an image file to Firebase Storage using resumable upload with live byte progress,
 * fast pre-flight bucket validation, cancellation support, and comprehensive error reporting.
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

  const bucketName = (storage.app.options as any).storageBucket || 'my-localcart.firebasestorage.app';

  // Fast pre-flight check: If bucket does not exist, fail immediately with clear instructions
  const bucketCheck = await verifyBucketStatus(bucketName);
  if (!bucketCheck.ok && bucketCheck.status === 404) {
    throw new Error(bucketCheck.message);
  }

  let isCancelled = false;
  if (cancelRef) {
    cancelRef.current = () => {
      isCancelled = true;
    };
  }

  // Stage 1: Client-side image resize & WebP compression (10% - 25%)
  onProgress?.(10);
  const { blob } = await optimizeImage(file, options);
  if (isCancelled) {
    throw new Error('Image upload was cancelled by user.');
  }
  onProgress?.(25);

  // Stage 2: Resumable upload with live byte-level progress
  return new Promise<UploadResult>((resolve, reject) => {
    let uploadTask: UploadTask | null = null;
    let isSettled = false;
    let userCancelled = false;

    const cleanup = () => {
      isSettled = true;
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

      uploadTask = uploadBytesResumable(fileRef, blob, metadata);

      if (cancelRef) {
        cancelRef.current = () => {
          if (!isSettled) {
            userCancelled = true;
            try {
              uploadTask?.cancel();
            } catch {}
            cleanup();
            reject(new Error('Image upload was cancelled by user.'));
          }
        };
      }

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (isSettled) return;
          if (snapshot.totalBytes > 0) {
            const rawPct = snapshot.bytesTransferred / snapshot.totalBytes;
            const scaledPct = Math.min(92, Math.round(25 + rawPct * 67));
            onProgress?.(scaledPct);
          }
        },
        async (error: any) => {
          if (isSettled) return;
          cleanup();

          if (userCancelled) {
            reject(new Error('Image upload was cancelled by user.'));
            return;
          }

          console.error('Firebase Storage upload error:', error);
          const errorMsg = await formatDetailedStorageError(error, bucketName, storagePath);
          reject(new Error(errorMsg));
        },
        async () => {
          if (isSettled) return;
          try {
            onProgress?.(96);
            const downloadUrl = await getDownloadURL(uploadTask!.snapshot.ref);
            onProgress?.(100);
            cleanup();
            resolve({
              downloadUrl,
              storagePath,
            });
          } catch (urlErr: any) {
            cleanup();
            console.error('Failed to get download URL from Firebase Storage:', urlErr);
            const errorMsg = await formatDetailedStorageError(urlErr, bucketName, storagePath);
            reject(new Error(errorMsg));
          }
        }
      );
    } catch (err: any) {
      cleanup();
      if (userCancelled) {
        reject(new Error('Image upload was cancelled by user.'));
        return;
      }
      console.error('Failed to initiate Firebase Storage upload:', err);
      formatDetailedStorageError(err, bucketName, storagePath).then((msg) => reject(new Error(msg)));
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
