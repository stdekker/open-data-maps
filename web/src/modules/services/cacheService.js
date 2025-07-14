const DB_NAME = 'app_cache';
const DB_VERSION = 1;
const STORE_NAME = 'bag_data';

let db;

/**
 * Initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.errorCode);
            reject('Error opening IndexedDB.');
        };
    });
}

/**
 * Gets a value from the IndexedDB store.
 * @param {string} key - The key of the item to retrieve.
 * @returns {Promise<any>} A promise that resolves with the stored value, or undefined if not found.
 */
export async function get(key) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject('Error getting data from IndexedDB.');
        };
    });
}

/**
 * Sets a value in the IndexedDB store.
 * @param {string} key - The key of the item to set.
 * @param {any} value - The value to store.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function set(key, value) {
    const database = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            console.error('Failed to set data in IndexedDB:', event.target.error);
            reject('Error setting data in IndexedDB.');
        };
    });
} 