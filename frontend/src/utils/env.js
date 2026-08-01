export const getEnv = () => {
  const metaEnv =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env
      : {};

  return {
    // Prefer VITE_* from .env / Vercel. Fallback matches deployed Render API.
    apiUrl: metaEnv.VITE_API_URL || 'https://fyp-web-1k4k.onrender.com',
    socketUrl: metaEnv.VITE_SOCKET_URL || 'https://fyp-web-1k4k.onrender.com',
  };
};
