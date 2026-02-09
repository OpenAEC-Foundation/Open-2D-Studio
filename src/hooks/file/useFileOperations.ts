import { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAppStore, generateId } from '../../state/appStore';
import {
  showOpenDialog,
  showSaveDialog,
  showExportDialog,
  showExportAllFormatsDialog,
  readProjectFile,
  writeProjectFile,
  exportToSVG,
  exportToDXF,
  exportToIFC,
  showError,
  showInfo,
  showImportDxfDialog,
  parseDXF,
  type ProjectFile,
} from '../../services/file/fileService';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { DEFAULT_PROJECT_INFO } from '../../types/projectInfo';

export function useFileOperations() {
  const setFilePath = useAppStore(s => s.setFilePath);
  const setProjectName = useAppStore(s => s.setProjectName);
  const setModified = useAppStore(s => s.setModified);
  const setPrintDialogOpen = useAppStore(s => s.setPrintDialogOpen);
  const addShapes = useAppStore(s => s.addShapes);

  const handleNew = useCallback(async () => {
    useAppStore.getState().createNewDocument();
  }, []);

  const handleOpen = useCallback(async () => {
    const filePath = await showOpenDialog();
    if (!filePath) return;

    try {
      const project = await readProjectFile(filePath);
      const fileName = filePath.split(/[/\\]/).pop()?.replace('.o2d', '') || 'Untitled';

      // Check if current tab is an empty untitled document — close it after opening
      const s = useAppStore.getState();
      const prevDocId = s.activeDocumentId;
      const isEmptyUntitled = !s.isModified && !s.currentFilePath
        && s.shapes.length === 0 && s.projectName.startsWith('Untitled');

      // Open as a new document tab (or switch to it if already open)
      const docId = generateId();
      s.openDocument(docId, {
        shapes: project.shapes,
        layers: project.layers,
        activeLayerId: project.activeLayerId,
        drawings: project.drawings || [],
        sheets: project.sheets || [],
        activeDrawingId: project.activeDrawingId || (project.drawings?.[0]?.id ?? ''),
        activeSheetId: project.activeSheetId ?? null,
        drawingViewports: project.drawingViewports || {},
        sheetViewports: project.sheetViewports || {},
        filePath,
        projectName: fileName,
        isModified: false,
        projectInfo: project.projectInfo || { ...DEFAULT_PROJECT_INFO },
      });

      // Restore snap settings from project
      if (project.settings) {
        const store = useAppStore.getState();
        store.setGridSize(project.settings.gridSize);
        if (store.gridVisible !== project.settings.gridVisible) store.toggleGrid();
        if (store.snapEnabled !== project.settings.snapEnabled) store.toggleSnap();
      }

      // Restore project-level filled region types (backward compatible)
      if (project.filledRegionTypes && project.filledRegionTypes.length > 0) {
        useAppStore.getState().setProjectFilledRegionTypes(project.filledRegionTypes);
      }
      // Restore project info (backward compatible)
      if (project.projectInfo) {
        useAppStore.getState().setProjectInfo(project.projectInfo);
      }

      // Close the previous empty untitled tab
      if (isEmptyUntitled) {
        useAppStore.getState().closeDocument(prevDocId);
      }
    } catch (err) {
      await showError(`Failed to open file: ${err}`);
    }
  }, []);

  const handleSave = useCallback(async () => {
    const s = useAppStore.getState();
    let filePath = s.currentFilePath;

    if (!filePath) {
      filePath = await showSaveDialog(s.projectName);
      if (!filePath) return;
    }

    try {
      // Collect non-built-in filled region types for saving with project
      const customRegionTypes = s.filledRegionTypes.filter(t => !t.isBuiltIn);
      const project: ProjectFile = {
        version: 2,
        name: s.projectName,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        drawings: s.drawings,
        sheets: s.sheets,
        activeDrawingId: s.activeDrawingId,
        activeSheetId: s.activeSheetId,
        drawingViewports: s.drawingViewports,
        sheetViewports: s.sheetViewports,
        shapes: s.shapes,
        layers: s.layers,
        activeLayerId: s.activeLayerId,
        settings: {
          gridSize: s.gridSize,
          gridVisible: s.gridVisible,
          snapEnabled: s.snapEnabled,
        },
        savedPrintPresets: Object.keys(s.savedPrintPresets).length > 0 ? s.savedPrintPresets : undefined,
        filledRegionTypes: customRegionTypes.length > 0 ? customRegionTypes : undefined,
        projectInfo: {
          ...s.projectInfo,
          erpnext: { ...s.projectInfo.erpnext, apiSecret: '' },
        },
      };

      await writeProjectFile(filePath, project);
      setFilePath(filePath);
      setModified(false);

      const fileName = filePath.split(/[/\\]/).pop()?.replace('.o2d', '') || 'Untitled';
      setProjectName(fileName);
    } catch (err) {
      await showError(`Failed to save file: ${err}`);
    }
  }, [setFilePath, setModified, setProjectName]);

  const handleSaveAs = useCallback(async () => {
    const s = useAppStore.getState();
    const filePath = await showSaveDialog(s.projectName);
    if (!filePath) return;

    try {
      const customRegionTypes = s.filledRegionTypes.filter(t => !t.isBuiltIn);
      const project: ProjectFile = {
        version: 2,
        name: s.projectName,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        drawings: s.drawings,
        sheets: s.sheets,
        activeDrawingId: s.activeDrawingId,
        activeSheetId: s.activeSheetId,
        drawingViewports: s.drawingViewports,
        sheetViewports: s.sheetViewports,
        shapes: s.shapes,
        layers: s.layers,
        activeLayerId: s.activeLayerId,
        settings: {
          gridSize: s.gridSize,
          gridVisible: s.gridVisible,
          snapEnabled: s.snapEnabled,
        },
        savedPrintPresets: Object.keys(s.savedPrintPresets).length > 0 ? s.savedPrintPresets : undefined,
        filledRegionTypes: customRegionTypes.length > 0 ? customRegionTypes : undefined,
        projectInfo: {
          ...s.projectInfo,
          erpnext: { ...s.projectInfo.erpnext, apiSecret: '' },
        },
      };

      await writeProjectFile(filePath, project);
      setFilePath(filePath);
      setModified(false);

      const fileName = filePath.split(/[/\\]/).pop()?.replace('.o2d', '') || 'Untitled';
      setProjectName(fileName);
    } catch (err) {
      await showError(`Failed to save file: ${err}`);
    }
  }, [setFilePath, setModified, setProjectName]);

  const handleExport = useCallback(async () => {
    const s = useAppStore.getState();
    if (s.shapes.length === 0) {
      await showInfo('Nothing to export. Draw some shapes first.');
      return;
    }

    const filePath = await showExportAllFormatsDialog(s.projectName);
    if (!filePath) return;

    try {
      const extension = filePath.split('.').pop()?.toLowerCase();
      let content: string;

      if (extension === 'ifc') {
        const customPatterns = [...s.userPatterns, ...s.projectPatterns];
        content = exportToIFC(s.shapes, s.layers, customPatterns);
      } else if (extension === 'dxf') {
        content = exportToDXF(s.shapes);
      } else if (extension === 'json') {
        content = JSON.stringify({ shapes: s.shapes, layers: s.layers }, null, 2);
      } else {
        content = exportToSVG(s.shapes);
      }

      await writeTextFile(filePath, content);
      await showInfo(`Exported successfully to ${filePath}`);
    } catch (err) {
      await showError(`Failed to export: ${err}`);
    }
  }, []);

  const handleExportSVG = useCallback(async () => {
    const s = useAppStore.getState();
    if (s.shapes.length === 0) { await showInfo('Nothing to export. Draw some shapes first.'); return; }
    const filePath = await showExportDialog('svg', s.projectName);
    if (!filePath) return;
    try {
      await writeTextFile(filePath, exportToSVG(s.shapes));
      await showInfo(`Exported successfully to ${filePath}`);
    } catch (err) { await showError(`Failed to export: ${err}`); }
  }, []);

  const handleExportDXF = useCallback(async () => {
    const s = useAppStore.getState();
    if (s.shapes.length === 0) { await showInfo('Nothing to export. Draw some shapes first.'); return; }
    const filePath = await showExportDialog('dxf', s.projectName);
    if (!filePath) return;
    try {
      await writeTextFile(filePath, exportToDXF(s.shapes));
      await showInfo(`Exported successfully to ${filePath}`);
    } catch (err) { await showError(`Failed to export: ${err}`); }
  }, []);

  const handleExportIFC = useCallback(async () => {
    const s = useAppStore.getState();
    if (s.shapes.length === 0) { await showInfo('Nothing to export. Draw some shapes first.'); return; }
    const filePath = await showExportDialog('ifc', s.projectName);
    if (!filePath) return;
    try {
      const customPatterns = [...s.userPatterns, ...s.projectPatterns];
      await writeTextFile(filePath, exportToIFC(s.shapes, s.layers, customPatterns));
      await showInfo(`Exported successfully to ${filePath}`);
    } catch (err) { await showError(`Failed to export: ${err}`); }
  }, []);

  const handleExportJSON = useCallback(async () => {
    const s = useAppStore.getState();
    if (s.shapes.length === 0) { await showInfo('Nothing to export. Draw some shapes first.'); return; }
    const filePath = await showExportDialog('json', s.projectName);
    if (!filePath) return;
    try {
      await writeTextFile(filePath, JSON.stringify({ shapes: s.shapes, layers: s.layers }, null, 2));
      await showInfo(`Exported successfully to ${filePath}`);
    } catch (err) { await showError(`Failed to export: ${err}`); }
  }, []);

  const handleImportDXF = useCallback(async () => {
    const filePath = await showImportDxfDialog();
    if (!filePath) return;

    try {
      const content = await readTextFile(filePath);
      const s = useAppStore.getState();
      const shapes = parseDXF(content, s.activeLayerId, s.activeDrawingId);
      if (shapes.length === 0) {
        await showInfo('No supported entities found in the DXF file.\n\nSupported entities: LINE, CIRCLE, ARC, ELLIPSE, POLYLINE, LWPOLYLINE, SPLINE, TEXT, MTEXT, POINT, SOLID, 3DFACE, TRACE');
        return;
      }

      // Count shape types for detailed feedback
      const typeCounts: Record<string, number> = {};
      for (const shape of shapes) {
        typeCounts[shape.type] = (typeCounts[shape.type] || 0) + 1;
      }
      const typeBreakdown = Object.entries(typeCounts)
        .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
        .join(', ');

      addShapes(shapes);
      await showInfo(`Imported ${shapes.length} shape(s) from DXF:\n${typeBreakdown}`);
    } catch (err) {
      await showError(`Failed to import DXF: ${err}`);
    }
  }, [addShapes]);

  const handlePrint = useCallback(() => {
    setPrintDialogOpen(true);
  }, [setPrintDialogOpen]);

  const handleExit = useCallback(() => {
    getCurrentWindow().close();
  }, []);

  return { handleNew, handleOpen, handleSave, handleSaveAs, handleExport, handleExportSVG, handleExportDXF, handleExportIFC, handleExportJSON, handleImportDXF, handlePrint, handleExit };
}
