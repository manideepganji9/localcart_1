import {
  storage,
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  auth
} from './firebase';

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
 * Formats Firebase Storage errors into human-readable, actionable guidance.
 */
export function formatStorageError(error: any): string {
  const code = error?.code || '';
  const status = error?.status_ || error?.status;
  const message = error?.message || '';

  if (
    code === 'storage/bucket-not-found' ||
    status === 404 ||
    message.includes('404') ||
    message.includes('bucket does not exist') ||
    message.includes('NoSuchBucket')
  ) {
    return 'Cloud Storage bucket not initialized or not found. Please activate Cloud Storage in the Firebase Console (Build > Storage > Get Started).';
  }

  if (
    code === 'storage/unauthorized' ||
    status === 403 ||
    message.includes('403') ||
    message.includes('permission') ||
    message.includes('unauthorized')
  ) {
    return 'Permission denied: You do not have permission to upload this photo, or your login session expired. Please sign in again.';
  }

  if (code === 'storage/unauthenticated') {
    return 'Authentication required. Please sign in with your Google account to upload photos.';
  }

  if (code === 'storage/quota-exceeded') {
    return 'Firebase Storage quota exceeded. Please check your project usage limits.';
  }

  if (code === 'storage/retry-limit-exceeded') {
    return 'Upload connection timed out or blocked by CORS policy. Please verify your internet connection.';
  }

  if (code === 'storage/invalid-checksum') {
    return 'File upload integrity check failed. Please try uploading again.';
  }

  if (code === 'storage/canceled') {
    return 'Image upload was cancelled.';
  }

  if (message.includes('Failed to fetch') || message.includes('network') || message.includes('CORS')) {
    return 'Network or CORS issue connecting to Firebase Storage. Please verify bucket setup and internet access.';
  }

  return message ? `Failed to upload image: ${message}` : 'Failed to upload image to Firebase Storage.';
}

/**
 * Upload an image file to Firebase Storage using fast, atomic uploadBytes,
 * stage-based progress updates, cancellation support, and explicit error handling.
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

  let isCancelled = false;
  if (cancelRef) {
    cancelRef.current = () => {
      isCancelled = true;
    };
  }

  // Stage 1: Client-side image resize and WebP compression
  onProgress?.(15);
  const { blob } = await optimizeImage(file, options);
  if (isCancelled) {
    throw new Error('Image upload was cancelled by user.');
  }
  onProgress?.(45);

  // Stage 2: Direct atomic upload using uploadBytes
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

    onProgress?.(70);
    const snapshot = await uploadBytes(fileRef, blob, metadata);
    if (isCancelled) {
      throw new Error('Image upload was cancelled by user.');
    }

    // Stage 3: Retrieve permanent, authenticated download URL
    onProgress?.(90);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    onProgress?.(100);

    return {
      downloadUrl,
      storagePath,
    };
  } catch (err: any) {
    if (isCancelled || err?.message?.includes('cancelled')) {
      throw new Error('Image upload was cancelled by user.');
    }
    console.error('Firebase Storage upload failed:', err);
    throw new Error(formatStorageError(err));
  } finally {
    if (cancelRef) {
      cancelRef.current = undefined;
    }
  }
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
