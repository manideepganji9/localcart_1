import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, Check, Copy, Loader2, ShieldCheck, ShoppingBag, Store } from 'lucide-react';
import { APP_CONFIG } from '../../constants/config';
import { UserRole } from '../../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRegister?: () => void;
  onSwitchToRegister?: () => void;
  onSuccessRoleSelect?: () => void;
  onSuccess?: (role?: UserRole) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccessRoleSelect,
  onSuccess,
}) => {
  const { signInWithGoogle, isLoading } = useAuth();
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState('');
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setError('');
      setIsUnauthorizedDomain(false);
    }
  }, [isOpen]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError('');
    setIsUnauthorizedDomain(false);
    const res = await signInWithGoogle();
    setSigningIn(false);

    if (res.success) {
      onClose();
      if (res.isNewUser && onSuccessRoleSelect) {
        onSuccessRoleSelect();
      } else if (onSuccess) {
        onSuccess(res.role);
      }
    } else {
      if (res.isUnauthorizedDomain) {
        setIsUnauthorizedDomain(true);
        setUnauthorizedDomain(res.domain || (typeof window !== 'undefined' ? window.location.hostname : ''));
      }
      setError(res.error || 'Google Sign-In failed. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Welcome to LocalCart"
      subtitle="Sign in with your Google account to shop and manage orders"
      maxWidth="md"
    >
      <div className="space-y-6 py-2 text-stone-700">
        {isUnauthorizedDomain ? (
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-stone-800 space-y-3 text-left">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 flex-1">
                <div className="font-semibold text-stone-900 text-sm">Preview Domain Setup Required</div>
                <p className="text-stone-600 leading-relaxed">
                  Google Sign-In requires this domain to be added to Authorized Domains in Firebase:
                </p>
                <div className="flex items-center gap-2 py-1">
                  <code className="bg-white px-2.5 py-1 rounded-md border border-amber-200 text-stone-900 font-mono text-[11px] truncate max-w-[220px]">
                    {unauthorizedDomain || (typeof window !== 'undefined' ? window.location.hostname : '')}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(unauthorizedDomain || window.location.hostname);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-300 rounded-md text-stone-700 text-xs font-medium flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-stone-500">
                  In <strong>Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains</strong>, click &quot;Add domain&quot; and paste this hostname.
                </p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl text-xs bg-red-50 border border-red-200 text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col items-center text-center">
            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mb-2">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-stone-900">For Buyers</span>
            <span className="text-[11px] text-stone-500 mt-0.5">Order directly from local shops</span>
          </div>
          <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col items-center text-center">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mb-2">
              <Store className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-stone-900">For Sellers</span>
            <span className="text-[11px] text-stone-500 mt-0.5">Manage products & orders</span>
          </div>
        </div>

        {/* Real Google Sign In Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingIn || isLoading}
            className="w-full py-3.5 px-5 bg-white hover:bg-stone-50 text-stone-900 font-medium text-sm rounded-xl transition flex items-center justify-center gap-3 border border-stone-300 shadow-xs hover:shadow-sm disabled:opacity-50 cursor-pointer active:scale-[0.99]"
          >
            {signingIn || isLoading ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin text-stone-600" />
                <span className="text-stone-700 font-medium text-sm">Opening Google Sign-In...</span>
              </>
            ) : (
              <>
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span className="font-semibold text-stone-800">
                  Continue with Google
                </span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 pt-2 text-stone-500 text-xs justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Verified authentication via Google Identity Services</span>
        </div>
      </div>
    </Modal>
  );
};
