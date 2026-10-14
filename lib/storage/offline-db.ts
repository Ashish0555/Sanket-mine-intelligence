import type { Turn } from "../../app/ui/conversation";

const DB_NAME = "sanket-offline";
const STORE = "turns";
const VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE))
        database.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTurn(turn: Turn): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database
      .transaction(STORE, "readwrite")
      .objectStore(STORE)
      .put(turn);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}

export async function loadTurns(): Promise<Turn[]> {
  if (typeof indexedDB === "undefined") return [];
  const database = await openDatabase();
  const turns = await new Promise<Turn[]>((resolve, reject) => {
    const request = database.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as Turn[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return turns.sort((a, b) => a.id.localeCompare(b.id));
}

export async function deleteAllTurns(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE, "readwrite").objectStore(STORE).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}
