import { init, tx } from 'https://cdn.jsdelivr.net/npm/@instantdb/core@latest/+esm';

const APP_ID = 'febfcfa3-45de-4f63-8e1c-4f5f01239331';

// Initialize InstantDB
export const db = init({ appId: APP_ID });

// Export transaction helper
export { tx };

// Safe ID generator that works in file:// protocol (crypto.randomUUID is HTTPS only)
export function id() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
