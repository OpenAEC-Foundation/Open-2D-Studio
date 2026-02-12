import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateInfo {
  version: string;
  body: string;
  date?: string;
}

export type UpdateStatus =
  | { kind: 'upToDate' }
  | { kind: 'available'; info: UpdateInfo }
  | { kind: 'downloading'; progress: number }
  | { kind: 'readyToInstall' }
  | { kind: 'error'; message: string };

/**
 * Check for application updates.
 * @param silent If true, suppresses "up to date" messages and swallows errors silently.
 * @param onStatus Optional callback to track download progress.
 * @returns The update info if an update is available, or null if up-to-date / error in silent mode.
 */
export async function checkForUpdates(
  silent: boolean,
  onStatus?: (status: UpdateStatus) => void
): Promise<UpdateInfo | null> {
  try {
    const update = await check();

    if (!update) {
      onStatus?.({ kind: 'upToDate' });
      return null;
    }

    const info: UpdateInfo = {
      version: update.version,
      body: update.body ?? '',
      date: update.date ?? undefined,
    };

    onStatus?.({ kind: 'available', info });
    return info;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!silent) {
      onStatus?.({ kind: 'error', message });
    }
    return null;
  }
}

/**
 * Download and install an available update, then relaunch the app.
 * @param onStatus Callback to track download progress.
 */
export async function downloadAndInstall(
  onStatus?: (status: UpdateStatus) => void
): Promise<void> {
  try {
    const update = await check();

    if (!update) {
      onStatus?.({ kind: 'upToDate' });
      return;
    }

    let totalLength = 0;
    let downloaded = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          totalLength = event.data.contentLength ?? 0;
          downloaded = 0;
          onStatus?.({ kind: 'downloading', progress: 0 });
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          const progress = totalLength > 0 ? Math.round((downloaded / totalLength) * 100) : 0;
          onStatus?.({ kind: 'downloading', progress });
          break;
        case 'Finished':
          onStatus?.({ kind: 'readyToInstall' });
          break;
      }
    });

    await relaunch();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onStatus?.({ kind: 'error', message });
  }
}
