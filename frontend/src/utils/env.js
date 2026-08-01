export const getEnv = () => {
  const metaEnv =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env
      : {};

  return {
    apiUrl: metaEnv.VITE_API_URL || 'http://localhost:5000',
    socketUrl: metaEnv.VITE_SOCKET_URL || 'http://localhost:5000',
  };
};
