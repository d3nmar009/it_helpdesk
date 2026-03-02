/**
 * Utility function to get the correct avatar URL for serving images
 * In standalone Next.js production, we need to use API routes to serve uploaded files
 */
export const getAvatarUrl = (avatarPath: string | null | undefined): string | undefined => {
  if (!avatarPath) return undefined;
  
  // If it's already an API URL, return as is
  if (avatarPath.startsWith('/api/avatar/')) {
    return avatarPath;
  }
  
  // If it's an old uploads path, convert to API URL
  if (avatarPath.startsWith('/uploads/avatars/')) {
    const filename = avatarPath.split('/').pop();
    return `/api/avatar/${filename}`;
  }
  
  // For any other path, try to extract filename and use API route
  const filename = avatarPath.split('/').pop();
  if (filename) {
    return `/api/avatar/${filename}`;
  }
  
  return avatarPath;
};

/**
 * Get avatar URL with cache busting for immediate updates
 */
export const getAvatarUrlWithCacheBust = (avatarPath: string | null | undefined): string | undefined => {
  const baseUrl = getAvatarUrl(avatarPath);
  if (!baseUrl) return undefined;
  
  return `${baseUrl}?t=${Date.now()}`;
};
