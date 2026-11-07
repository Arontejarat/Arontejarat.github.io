/** Demo-only binary storage. Metadata remains in the existing mock DB. */
const DB_NAME = 'niroo-demo-files'
function openFiles(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('ذخیره فایل در مرورگر انجام نشد؛ فضای ذخیره‌سازی را بررسی کنید.'))
  })
}
export async function saveFile(key: string, file: Blob): Promise<void> {
  const db = await openFiles()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite')
      tx.objectStore('files').put(file, key)
      tx.oncomplete = () => resolve()
      tx.onerror = tx.onabort = () => reject(new Error('ذخیره فایل انجام نشد؛ دوباره تلاش کنید.'))
    })
  } finally { db.close() }
}
export async function readFile(key: string): Promise<Blob | undefined> {
  const db = await openFiles()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('files').objectStore('files').get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('دریافت فایل انجام نشد.'))
    })
  } finally { db.close() }
}
