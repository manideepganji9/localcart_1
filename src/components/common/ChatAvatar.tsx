import React, { useState } from 'react';
import { useUserProfile } from '../../services/userProfileCache';

interface ChatAvatarProps {
  userId?: string;
  name: string;
  isCurrentUser?: boolean;
  currentUserAvatar?: string;
  fallbackPhotoUrl?: string;
  sizeClassName?: string;
}

export const ChatAvatar: React.FC<ChatAvatarProps> = ({
  userId,
  name,
  isCurrentUser,
  currentUserAvatar,
  fallbackPhotoUrl,
  sizeClassName = 'w-6 h-6',
}) => {
  const cachedProfile = useUserProfile(userId);
  const [imgError, setImgError] = useState(false);

  // Determine the canonical profile photo URL
  // 1. If this is the current user and we have their active avatar, use it
  // 2. Otherwise use the cached profile photo from Firestore doc(db, 'users', userId)
  // 3. Fallback to passed fallbackPhotoUrl
  const resolvedPhoto =
    (isCurrentUser && currentUserAvatar) ||
    cachedProfile?.avatarUrl ||
    fallbackPhotoUrl ||
    '';

  const initial = (name ? name.trim().charAt(0) : 'U').toUpperCase() || 'U';

  if (resolvedPhoto && !imgError) {
    return (
      <div
        className={`${sizeClassName} rounded-full overflow-hidden border border-white/20 shrink-0 bg-[#222]`}
      >
        <img
          src={resolvedPhoto}
          alt={name}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback: Initials avatar
  return (
    <div
      className={`${sizeClassName} rounded-full overflow-hidden border border-white/20 shrink-0 bg-[#262626] text-[#E5C392] flex items-center justify-center font-semibold text-[10px] select-none`}
      title={name}
    >
      {initial}
    </div>
  );
};
