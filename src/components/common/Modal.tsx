import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'lg',
  showCloseButton = true,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div
          className={`relative transform overflow-hidden rounded-2xl bg-white text-stone-900 text-left shadow-2xl transition-all w-full my-8 ${maxWidthClasses[maxWidth]} border border-stone-200 animate-in zoom-in-95 duration-200`}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between border-b border-stone-100 px-6 py-4.5 bg-stone-50/60">
              <div>
                {title && <h3 className="font-semibold text-lg sm:text-xl tracking-tight text-stone-900">{title}</h3>}
                {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                  onClick={onClose}
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="px-6 py-5 max-h-[calc(85vh-8rem)] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
};
