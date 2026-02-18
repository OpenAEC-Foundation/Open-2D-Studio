/**
 * Blender/Bonsai Watcher Script Generator
 *
 * Generates a Python script that can be run inside Blender to watch
 * the IFC sync file for changes and auto-reload it in Bonsai.
 *
 * The script uses Blender's timer system (bpy.app.timers) to periodically
 * check the file's modification time. When a change is detected, it
 * reloads the IFC project using Bonsai's BIM operators.
 */

/**
 * Generate a Blender Python watcher script for the given IFC file path.
 *
 * @param ifcFilePath - Absolute path to the IFC file to watch.
 *                      Backslashes are escaped for Python string safety.
 * @param pollIntervalSeconds - How often to check for file changes (default 1.0s)
 * @returns The complete Python script as a string
 */
export function generateBlenderWatcherScript(
  ifcFilePath: string,
  pollIntervalSeconds: number = 1.0
): string {
  // Escape backslashes for Python string literal (Windows paths)
  const escapedPath = ifcFilePath.replace(/\\/g, '\\\\');

  return `# =============================================================================
# Open 2D Studio — Bonsai Live Sync Watcher
# =============================================================================
#
# This script watches an IFC file for changes and auto-reloads it in
# Blender/Bonsai. It runs as a persistent timer inside Blender.
#
# HOW TO USE:
#   1. Open Blender with the Bonsai add-on enabled
#   2. Open the Scripting workspace (or any Text Editor area)
#   3. Click "New" to create a new text block, paste this script
#   4. Click "Run Script" (or press Alt+P)
#   5. The watcher will start and print status to the system console
#   6. In Open 2D Studio, enable Bonsai Sync and set the same file path
#   7. Every time the IFC file changes, Bonsai will auto-reload it
#
# TO STOP:
#   Run this in Blender's Python console:
#     bpy.app.timers.unregister(open2d_bonsai_watcher)
#
# =============================================================================

import bpy
import os
import time

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

IFC_FILE_PATH = r"${escapedPath}"
POLL_INTERVAL = ${pollIntervalSeconds.toFixed(1)}  # seconds between file checks

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

_last_mtime = 0.0
_is_first_run = True
_reload_count = 0

# ---------------------------------------------------------------------------
# Core watcher function (called by bpy.app.timers)
# ---------------------------------------------------------------------------

def open2d_bonsai_watcher():
    """Check if the IFC file has been modified and reload if so."""
    global _last_mtime, _is_first_run, _reload_count

    if not os.path.isfile(IFC_FILE_PATH):
        # File does not exist yet — keep polling
        return POLL_INTERVAL

    try:
        current_mtime = os.path.getmtime(IFC_FILE_PATH)
    except OSError:
        # File may be locked during write — retry next tick
        return POLL_INTERVAL

    if _is_first_run:
        # On first run, just record the current mtime without reloading
        _last_mtime = current_mtime
        _is_first_run = False
        print(f"[Open2D Bonsai Sync] Watching: {IFC_FILE_PATH}")
        print(f"[Open2D Bonsai Sync] Poll interval: {POLL_INTERVAL}s")
        return POLL_INTERVAL

    if current_mtime > _last_mtime:
        _last_mtime = current_mtime
        _reload_count += 1
        print(f"[Open2D Bonsai Sync] File changed — reloading (#{_reload_count})...")

        try:
            _reload_ifc()
            print(f"[Open2D Bonsai Sync] Reload complete.")
        except Exception as e:
            print(f"[Open2D Bonsai Sync] Reload error: {e}")

    return POLL_INTERVAL

# ---------------------------------------------------------------------------
# IFC reload logic
# ---------------------------------------------------------------------------

def _reload_ifc():
    """Reload the IFC file in Bonsai."""
    # Check if Bonsai (BlenderBIM) is available
    if not hasattr(bpy.ops, "bim"):
        raise RuntimeError("Bonsai/BlenderBIM add-on is not installed or enabled")

    # Check if a project is already loaded
    ifc_file = None
    try:
        import blenderbim.tool as tool
        ifc_file = tool.Ifc.get()
    except Exception:
        pass

    if ifc_file is None:
        # No project loaded yet — do a fresh load
        bpy.ops.bim.load_project(filepath=IFC_FILE_PATH)
    else:
        # Project already loaded — close and re-open
        # This ensures a clean state with all geometry refreshed
        try:
            bpy.ops.bim.unload_project()
        except Exception:
            pass
        bpy.ops.bim.load_project(filepath=IFC_FILE_PATH)

# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

def _register_watcher():
    """Register the watcher timer, removing any previous instance first."""
    # Unregister if already running (idempotent re-run of the script)
    if bpy.app.timers.is_registered(open2d_bonsai_watcher):
        bpy.app.timers.unregister(open2d_bonsai_watcher)
        print("[Open2D Bonsai Sync] Stopped previous watcher.")

    bpy.app.timers.register(open2d_bonsai_watcher, first_interval=1.0, persistent=True)
    print("[Open2D Bonsai Sync] Watcher started.")
    print(f"[Open2D Bonsai Sync] File: {IFC_FILE_PATH}")

# Start!
_register_watcher()
`;
}
