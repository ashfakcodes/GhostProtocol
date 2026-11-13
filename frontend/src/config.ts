export const API_BASE_URL: string = (() => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string') {
    return envUrl.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return window.location.origin;
  }
  return 'http://localhost:8000';
})();

export function getWsUrl(): string {
  if (API_BASE_URL.startsWith('https://')) {
    return API_BASE_URL.replace('https://', 'wss://') + '/ws';
  }
  if (API_BASE_URL.startsWith('http://')) {
    return API_BASE_URL.replace('http://', 'ws://') + '/ws';
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }
  return 'ws://localhost:8000/ws';
}
