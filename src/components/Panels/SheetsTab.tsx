import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, FileText, LayoutTemplate, Hash } from 'lucide-react';
import { useAppStore, PAPER_SIZES } from '../../state/appStore';
import { DISCIPLINE_PREFIXES } from '../../services/template/sheetTemplateService';
import type { PaperSize, PaperOrientation } from '../../types/geometry';
import type { SheetNumberingScheme } from '../../services/template/sheetTemplateService';

export function SheetsTab() {
  const {
    sheets,
    activeSheetId,
    editorMode,
    addSheet,
    deleteSheet,
    renameSheet,
    switchToSheet,
    switchToDrawingMode,
    setNewSheetDialogOpen,
    renumberAllSheets,
  } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showNewSheetDialog, setShowNewSheetDialog] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [newSheetPaperSize, setNewSheetPaperSize] = useState<PaperSize>('A4');
  const [newSheetOrientation, setNewSheetOrientation] = useState<PaperOrientation>('landscape');
  const [showRenumberDialog, setShowRenumberDialog] = useState(false);
  const [renumberScheme, setRenumberScheme] = useState<SheetNumberingScheme>({
    prefix: 'A',
    separator: '-',
    startNumber: 101,
    digits: 3,
  });

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleConfirmEdit = () => {
    if (editingId && editName.trim()) {
      renameSheet(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleAddSheet = () => {
    addSheet(newSheetName || undefined, newSheetPaperSize, newSheetOrientation);
    setShowNewSheetDialog(false);
    setNewSheetName('');
    setNewSheetPaperSize('A4');
    setNewSheetOrientation('landscape');
  };

  const handleRenumber = () => {
    renumberAllSheets(renumberScheme);
    setShowRenumberDialog(false);
  };

  const getPaperSizeLabel = (sheet: { paperSize: PaperSize; orientation: PaperOrientation }) => {
    const size = PAPER_SIZES[sheet.paperSize];
    const w = sheet.orientation === 'landscape' ? size.height : size.width;
    const h = sheet.orientation === 'landscape' ? size.width : size.height;
    return `${sheet.paperSize} (${w}x${h}mm)`;
  };

  const getSheetNumber = (sheet: { titleBlock: { fields: { id: string; value: string }[] } }) => {
    const numberField = sheet.titleBlock.fields.find(f => f.id === 'number' || f.id === 'sheetNo');
    return numberField?.value || 'No number';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-end px-2 py-1 border-b border-cad-border">
        <div className="flex gap-1">
          <button
            onClick={() => setNewSheetDialogOpen(true)}
            className="p-1 rounded hover:bg-cad-border transition-colors"
            title="New Sheet from Template"
          >
            <LayoutTemplate size={14} />
          </button>
          <button
            onClick={() => setShowNewSheetDialog(true)}
            className="p-1 rounded hover:bg-cad-border transition-colors"
            title="Add Blank Sheet"
          >
            <Plus size={14} />
          </button>
          {sheets.length > 0 && (
            <button
              onClick={() => setShowRenumberDialog(true)}
              className="p-1 rounded hover:bg-cad-border transition-colors"
              title="Renumber Sheets"
            >
              <Hash size={14} />
            </button>
          )}
        </div>
      </div>

      {/* New Sheet Dialog */}
      {showNewSheetDialog && (
        <div className="p-2 border-b border-cad-border bg-cad-surface-elevated">
          <div className="space-y-2">
            <input
              type="text"
              value={newSheetName}
              onChange={(e) => setNewSheetName(e.target.value)}
              placeholder="Sheet name (optional)"
              className="w-full bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text outline-none focus:border-cad-accent"
            />
            <select
              value={newSheetPaperSize}
              onChange={(e) => setNewSheetPaperSize(e.target.value as PaperSize)}
              className="w-full bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text outline-none focus:border-cad-accent"
            >
              {Object.keys(PAPER_SIZES).map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-xs text-cad-text cursor-pointer">
                <input
                  type="radio"
                  name="orientation"
                  checked={newSheetOrientation === 'landscape'}
                  onChange={() => setNewSheetOrientation('landscape')}
                  className="accent-cad-accent"
                />
                Landscape
              </label>
              <label className="flex items-center gap-1 text-xs text-cad-text cursor-pointer">
                <input
                  type="radio"
                  name="orientation"
                  checked={newSheetOrientation === 'portrait'}
                  onChange={() => setNewSheetOrientation('portrait')}
                  className="accent-cad-accent"
                />
                Portrait
              </label>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleAddSheet}
                className="flex-1 px-2 py-1 text-xs bg-cad-accent text-white rounded hover:bg-cad-accent/80"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewSheetDialog(false)}
                className="flex-1 px-2 py-1 text-xs bg-cad-border text-cad-text rounded hover:bg-cad-border/80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renumber Sheets Dialog */}
      {showRenumberDialog && (
        <div className="p-2 border-b border-cad-border bg-cad-surface-elevated">
          <div className="space-y-2">
            <label className="block text-xs text-cad-text-dim">Discipline Prefix:</label>
            <select
              value={renumberScheme.prefix}
              onChange={(e) => setRenumberScheme(prev => ({ ...prev, prefix: e.target.value }))}
              className="w-full bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text outline-none focus:border-cad-accent"
            >
              {Object.entries(DISCIPLINE_PREFIXES).map(([key, { prefix, name }]) => (
                <option key={key} value={prefix}>{prefix} - {name}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-cad-text-dim mb-1">Start Number:</label>
                <input
                  type="number"
                  value={renumberScheme.startNumber}
                  onChange={(e) => setRenumberScheme(prev => ({ ...prev, startNumber: parseInt(e.target.value) || 1 }))}
                  className="w-full bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text outline-none focus:border-cad-accent"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-xs text-cad-text-dim mb-1">Separator:</label>
                <select
                  value={renumberScheme.separator}
                  onChange={(e) => setRenumberScheme(prev => ({ ...prev, separator: e.target.value }))}
                  className="w-full bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text outline-none focus:border-cad-accent"
                >
                  <option value="-">Dash (-)</option>
                  <option value=".">Dot (.)</option>
                  <option value="">None</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-cad-text-dim">
              Preview: {renumberScheme.prefix}{renumberScheme.separator}{String(renumberScheme.startNumber).padStart(renumberScheme.digits, '0')}, {renumberScheme.prefix}{renumberScheme.separator}{String(renumberScheme.startNumber + 1).padStart(renumberScheme.digits, '0')}, ...
            </div>

            <div className="flex gap-1">
              <button
                onClick={handleRenumber}
                className="flex-1 px-2 py-1 text-xs bg-cad-accent text-white rounded hover:bg-cad-accent/80"
              >
                Renumber ({sheets.length} sheets)
              </button>
              <button
                onClick={() => setShowRenumberDialog(false)}
                className="flex-1 px-2 py-1 text-xs bg-cad-border text-cad-text rounded hover:bg-cad-border/80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheets List */}
      <div className="flex-1 overflow-auto p-2">
        {sheets.length === 0 ? (
          <div className="text-xs text-cad-text-dim text-center py-4">
            No sheets yet.
            <br />
            Click + to create one.
          </div>
        ) : (
          <div className="space-y-1">
            {sheets.map((sheet) => (
              <div
                key={sheet.id}
                className={`group flex flex-col gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  sheet.id === activeSheetId && editorMode === 'sheet'
                    ? 'bg-cad-accent/20 border border-cad-accent'
                    : 'hover:bg-cad-border/50 border border-transparent'
                }`}
                onClick={() => switchToSheet(sheet.id)}
                onDoubleClick={() => handleStartEdit(sheet.id, sheet.name)}
              >
                {editingId === sheet.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-cad-bg border border-cad-accent rounded px-1 py-0.5 text-xs text-cad-text outline-none"
                      autoFocus
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConfirmEdit();
                      }}
                      className="p-0.5 rounded hover:bg-cad-border text-green-400"
                      title="Confirm"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelEdit();
                      }}
                      className="p-0.5 rounded hover:bg-cad-border text-red-400"
                      title="Cancel"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {/* Sheet icon */}
                      <FileText size={12} className="text-cad-text-dim" />

                      {/* Sheet name */}
                      <span className="flex-1 text-xs text-cad-text truncate">
                        {sheet.name}
                      </span>

                      {/* Edit button (visible on hover) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(sheet.id, sheet.name);
                        }}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-cad-border text-cad-text-dim hover:text-cad-text transition-all"
                        title="Rename"
                      >
                        <Pencil size={12} />
                      </button>

                      {/* Delete button (visible on hover) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSheet(sheet.id);
                        }}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-cad-border text-cad-text-dim hover:text-red-400 transition-all"
                        title="Delete Sheet"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Sheet number and paper size info */}
                    <span className="text-[10px] text-cad-text-dim ml-5">
                      {getSheetNumber(sheet)} | {getPaperSizeLabel(sheet)}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Back to Drawing button (when in sheet mode) */}
      {editorMode === 'sheet' && (
        <div className="p-2 border-t border-cad-border">
          <button
            onClick={switchToDrawingMode}
            className="w-full px-2 py-1 text-xs bg-cad-border text-cad-text rounded hover:bg-cad-border/80"
          >
            Back to Model Space
          </button>
        </div>
      )}
    </div>
  );
}
