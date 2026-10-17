/** Shared with the Apple Notes block (same database): a folder added in either app shows in both.
    IndexedDB can structured-clone directory handles; JSON/localStorage cannot. */
export interface SavedFolder { path: string; name: string; handle: FileSystemDirectoryHandle }

function folderStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('apple-notes-folders', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('folders', { keyPath: 'path' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('folders', mode);
      const operation = action(transaction.objectStore('folders'));
      transaction.oncomplete = () => { db.close(); resolve(operation.result); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error ?? operation.error); };
    };
  });
}

export const loadFolders = () => folderStore<SavedFolder[]>('readonly', (store) => store.getAll());
export const rememberFolder = (folder: SavedFolder) => folderStore('readwrite', (store) => store.put(folder));
export const forgetFolder = (path: string) => folderStore('readwrite', (store) => store.delete(path));
