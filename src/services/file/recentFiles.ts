/**
 * Recent Files (MRU) Service
 *
 * Persists up to 10 recently-opened / saved file paths using
 * @tauri-apps/plugin-store so the list survives across sessions.
 */

import { getSetting, setSetting } from '../../utils/settings';

const STORE_KEY = 'recent-files';
const MAX_RECENT = 10;

export interface RecentFileEntry {
  /** Absolute file path */
  filePath: string;
  /** Display name (file name without extension) */
  name: string;
  /** ISO-8601 timestamp of last access */
  timestamp: string;
}

/**
 * Return the current recent-files list (most-recent first).
 */
export async function getRecentFiles(): Promise<RecentFileEntry[]> {
  return getSetting<RecentFileEntry[]>(STORE_KEY, []);
}

/**
 * Add (or bump) a file to the top of the MRU list.
 * Duplicates (same filePath) are removed before inserting.
 */
export async function addRecentFile(filePath: string, name: string): Promise<void> {
  const list = await getRecentFiles();

  // Remove any existing entry for this path (case-insensitive on Windows)
  const filtered = list.filter(
    (e) => e.filePath.toLowerCase() !== filePath.toLowerCase(),
  );

  const entry: RecentFileEntry = {
    filePath,
    name,
    timestamp: new Date().toISOString(),
  };

  // Prepend and cap at MAX_RECENT
  const updated = [entry, ...filtered].slice(0, MAX_RECENT);
  await setSetting(STORE_KEY, updated);
}

/**
 * Remove a single entry by path.
 */
export async function removeRecentFile(filePath: string): Promise<void> {
  const list = await getRecentFiles();
  const updated = list.filter(
    (e) => e.filePath.toLowerCase() !== filePath.toLowerCase(),
  );
  await setSetting(STORE_KEY, updated);
}

/**
 * Clear the entire MRU list.
 */
export async function clearRecentFiles(): Promise<void> {
  await setSetting(STORE_KEY, []);
}
