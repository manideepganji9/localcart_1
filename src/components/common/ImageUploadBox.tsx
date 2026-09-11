import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Camera,
  X,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Ban
} from 'lucide-react';
import {
  validateImageFile,
  UploadProgressCallback,
  UploadCancelRef
} from '../../services/imageStorageService';

interface ImageUploadBoxProps {
  id?: string;
  label?: string;
  helperText?: string;
  currentImageUrl?: string;
  onUpload: (
    file: File,
    onProgress?: UploadProgressCallback,
    cancelRef?: UploadCancelRef
  ) => Promise<string | void>;
  onRemove?: () => Promise<void> | void;
  aspectRatio?: 'square' | 'video' | 'banner';
  placeholderText?: string;
  disabled?: boolean;
}

export const ImageUploadBox: React.FC<ImageUploadBoxProps> = ({
  id = 'image-upload',
  label,
  helperText = 'JPG, PNG, or WebP up to 5 MB',
  currentImageUrl,
  onUpload,
  onRemove,
  aspectRatio = 'square',
  placeholderText = 'Select or take a photo',
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<(() => void) | undefined>(undefined);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Clean up object URL on unmount or before setting a new one
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Aspect ratio styling
  const aspectClass =
    aspectRatio === 'video'
      ? 'aspect-video'
      : aspectRatio === 'banner'
      ? 'aspect-[21/9]'
      : 'aspect-square';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Invalid file format.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Revoke previous blob if any
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setUploadProgress(0);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setUploadProgress(0);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await onUpload(
        selectedFile,
        (percent: number) => {
          setUploadProgress(percent);
        },
        cancelRef
      );

      setUploadProgress(100);
      setSuccessMsg('Photo uploaded and synchronized successfully.');
      
      // Revoke preview blob and reset selected file
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.warn('Upload result note:', err);
      // If user cancelled, show gentle status rather than a failure alert
      if (err?.message?.includes('cancelled') || err?.message?.includes('canceled')) {
        setErrorMsg('Upload was cancelled.');
        setTimeout(() => setErrorMsg(null), 3000);
      } else {
        setErrorMsg(err?.message || 'Upload failed. Please check your connection and try again.');
      }
    } finally {
      setIsUploading(false);
      cancelRef.current = undefined;
    }
  };

  const handleCancelUpload = () => {
    if (cancelRef.current) {
      try {
        cancelRef.current();
      } catch (e) {
        console.warn('Error calling cancel callback:', e);
      }
    }
    setIsUploading(false);
    setUploadProgress(0);
    setErrorMsg('Upload was cancelled.');
    setTimeout(() => setErrorMsg(null), 3000);
  };

  const handleCancelSelected = () => {
    if (isUploading) {
      handleCancelUpload();
    }
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveExisting = async () => {
    if (!onRemove || isRemoving) return;
    setIsRemoving(true);
    setErrorMsg(null);
    try {
      await onRemove();
      handleCancelSelected();
      setIsConfirmingRemove(false);
      setSuccessMsg('Photo removed.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to remove photo.');
    } finally {
      setIsRemoving(false);
    }
  };

  const displayImage = previewUrl || currentImageUrl;

  return (
    <div id={`${id}-wrapper`} className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={`${id}-file-input`} className="block text-xs font-semibold text-stone-700">
            {label}
          </label>
          <span className="text-[11px] text-stone-500 font-normal">{helperText}</span>
        </div>
      )}

      {/* Hidden File Input supporting mobile camera & gallery */}
      <input
        ref={fileInputRef}
        id={`${id}-file-input`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {/* Error Alert with Retry button */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start justify-between gap-2 shadow-xs">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
          {selectedFile && !isUploading && (
            <button
              type="button"
              onClick={handleConfirmUpload}
              className="shrink-0 px-2.5 py-1 bg-red-700 hover:bg-red-800 text-white rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Success Alert */}
      {successMsg && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium shadow-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Inline Remove Confirmation Box */}
      {isConfirmingRemove && (
        <div className="p-3 bg-stone-900 text-white text-xs rounded-xl flex items-center justify-between gap-3 shadow-md">
          <span className="text-stone-300 text-[11px]">Remove this photo permanently?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConfirmingRemove(false)}
              disabled={isRemoving}
              className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] rounded-lg transition"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={handleRemoveExisting}
              disabled={isRemoving}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
            >
              {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Image Box */}
      <div className={`relative w-full ${aspectClass} max-w-sm rounded-2xl overflow-hidden border border-stone-200 bg-stone-100/80 group transition shadow-xs`}>
        {displayImage ? (
          <div className="relative w-full h-full">
            <img
              src={displayImage}
              alt="Photo preview"
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                // Graceful fallback if image fails to load
                e.currentTarget.src = 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80';
              }}
            />

            {/* Hover Action controls (when not uploading) */}
            {!isUploading && (
              <div className="absolute inset-0 bg-stone-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                <button
                  type="button"
                  id={`${id}-replace-btn`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isUploading}
                  className="px-3 py-1.5 bg-white/95 hover:bg-white text-stone-900 rounded-xl text-xs font-medium transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-stone-700" />
                  <span>Replace</span>
                </button>

                {onRemove && (
                  <button
                    type="button"
                    id={`${id}-remove-btn`}
                    onClick={() => setIsConfirmingRemove(true)}
                    disabled={disabled || isUploading}
                    className="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-xl text-xs font-medium transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            )}

            {/* Active Uploading or Ready Banner */}
            {selectedFile && (
              <div className="absolute bottom-0 inset-x-0 bg-stone-900/95 backdrop-blur-xs p-3 text-white text-xs space-y-2 border-t border-stone-800">
                {/* Upload Progress Bar */}
                {isUploading && (
                  <div className="w-full bg-stone-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full transition-all duration-200"
                      style={{ width: `${Math.max(5, uploadProgress)}%` }}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="truncate max-w-[150px] text-[11px] text-stone-300 font-mono">
                    {isUploading
                      ? uploadProgress < 100
                        ? `Uploading ${uploadProgress}%`
                        : 'Finalizing...'
                      : selectedFile.name}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {isUploading ? (
                      <button
                        type="button"
                        onClick={handleCancelUpload}
                        className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                        title="Cancel Upload"
                      >
                        <Ban className="h-3.5 w-3.5 text-red-400" />
                        <span>Cancel</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleCancelSelected}
                          className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition"
                          title="Discard preview"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmUpload}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>Upload</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty State: Prompt to select photo */
          <div
            onClick={() => !disabled && fileInputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-stone-200/50 transition"
          >
            <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 flex items-center justify-center text-stone-600 shadow-xs mb-3 group-hover:scale-105 transition-transform">
              <Camera className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-xs font-semibold text-stone-800">{placeholderText}</p>
            <p className="text-[11px] text-stone-500 mt-1">Tap to browse files or snap photo</p>
          </div>
        )}
      </div>

      {/* Button fallback if user prefers standard button */}
      {!displayImage && (
        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800 rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Upload className="h-3.5 w-3.5 text-amber-700" />
            <span>Select Photo</span>
          </button>
        </div>
      )}
    </div>
  );
};
