// rom-extract.mjs — build BattleShip.o2r in the browser from the player's own ROM.
//
// A YouGame patch listing never ships the ROM-derived archive: the player picks their
// Super Smash Bros. ROM once on yougame.co, the site keeps it in the browser, and the
// build asks for the bytes with YouGame.baseGame(). This module runs Torch (compiled to
// wasm, torch-worker.mjs) on those bytes and caches the result in this origin's IndexedDB
// keyed by recipe + ROM SHA-1, so the second launch skips the ~4 s of extraction.
//
//   db 'opensmash-archives' v1
//     archives  key `${recipe}:${sha1}`  { key, recipe, sha1, bytes: ArrayBuffer, extras: [{path, bytes}], builtAt, ms }

const DB_NAME = 'opensmash-archives';
const DB_VERSION = 1;
export const ARCHIVE_PATH = '/BattleShip.o2r';
// Torch logs ~6500 lines for the US ROM; soft denominator for the progress %.
const EXPECTED_LOG_LINES = 6600;

function openDb() {
  return new Promise((resolve, reject) => {
    let request;
    try { request = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('archives')) db.createObjectStore('archives', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB unavailable'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
  });
}
function idbGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
function idbPut(db, store, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
// URLs resolve against this module, so the worker and the recipe tree are found from any page.
function engineUrl(relative) { return new URL(relative, import.meta.url).href; }

function runTorch({ rom, files, onProgress }) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(engineUrl('torch-worker.mjs'), { type: 'module' });
    const finish = (fn, value) => { worker.terminate(); fn(value); };
    worker.onerror = (event) => finish(reject, new Error(event.message || 'Torch worker failed'));
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress?.(data);
      else if (data.type === 'done') finish(resolve, data);
      else if (data.type === 'error') finish(reject, new Error(data.message));
    };
    worker.postMessage({ rom, recipe: { base: engineUrl('torch/'), version: null, files } }, [rom]);
  });
}

/**
 * The archive bytes for the player's ROM under `recipe`, built and cached if this browser
 * has not done so yet. `getRom` resolves to YouGame.baseGame()'s result ({ sha1, bytes }) or null.
 * @returns {Promise<{source: 'cache'|'built', sha1: string, bytes: ArrayBuffer, extras: Array<{path: string, bytes: ArrayBuffer}>, ms?: number}>}
 */
export async function ensureArchive({ recipe, getRom, setStatus }) {
  const status = (text) => setStatus?.(text);
  status('asking for your ROM…');
  const base = await getRom();
  if (!base || !base.bytes) throw new Error('Pick your Super Smash Bros. ROM on the YouGame page first.');
  const key = `${recipe}:${base.sha1}`;
  let db = null;
  try { db = await openDb(); } catch { /* private window: build every time */ }
  if (db) {
    const cached = await idbGet(db, 'archives', key).catch(() => null);
    if (cached?.bytes) {
      status('assets ready (cached)');
      return { source: 'cache', sha1: base.sha1, bytes: cached.bytes, extras: cached.extras || [] };
    }
  }
  status('reading asset recipe…');
  const listing = await fetch(engineUrl('torch/recipe.json'));
  if (!listing.ok) throw new Error(`fetch torch/recipe.json: ${listing.status}`);
  const { files } = await listing.json();
  status('building assets from your ROM…');
  const started = performance.now();
  const result = await runTorch({
    // Copy: the worker takes ownership of what it is given.
    rom: base.bytes.slice(0),
    files,
    onProgress: ({ lines }) => status(`building assets from your ROM… ${Math.min(99, Math.round((lines / EXPECTED_LOG_LINES) * 100))}%`),
  });
  const ms = performance.now() - started;
  if (db) {
    try {
      await idbPut(db, 'archives', { key, recipe, sha1: base.sha1, bytes: result.archive, extras: result.extras || [], builtAt: Date.now(), ms, timings: result.timings });
    } catch (error) {
      console.warn('[rom-extract] could not cache archive:', error);
    }
  }
  console.warn('[rom-extract] built archive', { ...result.timings, totalMs: Math.round(ms) });
  status(`assets built in ${(ms / 1000).toFixed(1)}s`);
  return { source: 'built', sha1: base.sha1, bytes: result.archive, extras: result.extras || [], ms };
}

/** Writes the archive plus the derived extras (the port stages' select-screen PNGs) into MEMFS. */
export function writeArchive(FS, bytes, extras = []) {
  FS.writeFile(ARCHIVE_PATH, new Uint8Array(bytes));
  for (const extra of extras) {
    const dir = extra.path.substring(0, extra.path.lastIndexOf('/')) || '/';
    FS.mkdirTree(dir);
    FS.writeFile(extra.path, new Uint8Array(extra.bytes));
  }
}
