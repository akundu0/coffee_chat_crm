/**
 * storageService.js
 *
 * Thin promise-based adapter over chrome.storage.local. The rest of
 * the codebase (contactService.js) depends on the small adapter
 * interface below rather than on chrome.* directly, so tests can
 * swap in `createInMemoryAdapter()` and never touch a real browser API.
 *
 * Adapter interface:
 *   get(key: string) => Promise<any|undefined>
 *   set(key: string, value: any) => Promise<void>
 *   remove(key: string) => Promise<void>
 */

const STORE_KEY = 'coffeeChatCrm.contacts.v1';

/**
 * Wraps chrome.storage.local (MV3 service-worker friendly).
 * @param {typeof chrome.storage.local} storageArea
 */
export function createChromeStorageAdapter(storageArea) {
  return {
    async get(key) {
      const result = await storageArea.get(key);
      return result[key];
    },
    async set(key, value) {
      await storageArea.set({ [key]: value });
    },
    async remove(key) {
      await storageArea.remove(key);
    }
  };
}

/**
 * A dependency-free in-memory adapter with the same shape, used in
 * unit tests and available for local development outside a browser.
 */
export function createInMemoryAdapter(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    async get(key) {
      return store.get(key);
    },
    async set(key, value) {
      store.set(key, value);
    },
    async remove(key) {
      store.delete(key);
    }
  };
}

export const CONTACTS_STORE_KEY = STORE_KEY;
