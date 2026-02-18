/**
 * IFC Panel - Displays the generated IFC4 STEP file content
 *
 * Features:
 * - Read-only text area showing the full IFC STEP file
 * - Copy to clipboard button
 * - Export as .ifc file (browser download)
 * - File size and entity count display
 * - Auto-generate toggle
 */

import { memo, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../../state/appStore';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const IfcPanel = memo(function IfcPanel() {
  const ifcContent = useAppStore((s) => s.ifcContent);
  const ifcAutoGenerate = useAppStore((s) => s.ifcAutoGenerate);
  const ifcEntityCount = useAppStore((s) => s.ifcEntityCount);
  const ifcFileSize = useAppStore((s) => s.ifcFileSize);
  const regenerateIFC = useAppStore((s) => s.regenerateIFC);
  const setIfcAutoGenerate = useAppStore((s) => s.setIfcAutoGenerate);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to top when content changes
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.scrollTop = 0;
    }
  }, [ifcContent]);

  const handleCopy = useCallback(async () => {
    if (!ifcContent) return;
    try {
      await navigator.clipboard.writeText(ifcContent);
    } catch {
      // Fallback: select all text in textarea
      if (textAreaRef.current) {
        textAreaRef.current.select();
        document.execCommand('copy');
      }
    }
  }, [ifcContent]);

  const handleExport = useCallback(() => {
    if (!ifcContent) return;
    const blob = new Blob([ifcContent], { type: 'application/x-step' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model.ifc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [ifcContent]);

  const handleManualRegenerate = useCallback(() => {
    regenerateIFC();
  }, [regenerateIFC]);

  const lineCount = ifcContent ? ifcContent.split('\n').length : 0;

  return (
    <div className="flex flex-col h-full bg-cad-bg text-cad-text">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-cad-border bg-cad-surface flex-shrink-0">
        {/* Auto-generate toggle */}
        <label className="flex items-center gap-1 text-xs text-cad-text-dim cursor-pointer select-none">
          <input
            type="checkbox"
            checked={ifcAutoGenerate}
            onChange={(e) => setIfcAutoGenerate(e.target.checked)}
            className="w-3 h-3 accent-cad-accent"
          />
          Auto
        </label>

        {/* Manual regenerate button */}
        <button
          type="button"
          onClick={handleManualRegenerate}
          className="px-2 py-0.5 text-xs rounded border border-cad-border hover:bg-cad-hover hover:border-cad-accent transition-colors"
          title="Regenerate IFC model"
        >
          Regenerate
        </button>

        <div className="flex-1" />

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          disabled={!ifcContent}
          className="px-2 py-0.5 text-xs rounded border border-cad-border hover:bg-cad-hover hover:border-cad-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Copy IFC content to clipboard"
        >
          Copy
        </button>

        {/* Export button */}
        <button
          type="button"
          onClick={handleExport}
          disabled={!ifcContent}
          className="px-2 py-0.5 text-xs rounded border border-cad-border hover:bg-cad-hover hover:border-cad-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Export as .ifc file"
        >
          Export .ifc
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 px-2 py-1 border-b border-cad-border bg-cad-surface flex-shrink-0 text-[10px] text-cad-text-dim">
        <span>Entities: {ifcEntityCount}</span>
        <span>Lines: {lineCount}</span>
        <span>Size: {formatFileSize(ifcFileSize)}</span>
        <span>Format: IFC4 (ISO 16739-1:2018)</span>
      </div>

      {/* IFC Content */}
      <div className="flex-1 overflow-hidden">
        {ifcContent ? (
          <textarea
            ref={textAreaRef}
            readOnly
            value={ifcContent}
            className="w-full h-full bg-cad-bg text-cad-text font-mono text-[11px] leading-[1.4] p-2 resize-none border-none outline-none"
            spellCheck={false}
            wrap="off"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-cad-text-dim">
            <div className="text-center">
              <p className="mb-2">No IFC content generated yet.</p>
              <p className="text-[10px]">Add structural elements (walls, beams, slabs, etc.)</p>
              <p className="text-[10px]">to the canvas and the IFC model will be generated automatically.</p>
              <button
                type="button"
                onClick={handleManualRegenerate}
                className="mt-3 px-3 py-1 text-xs rounded border border-cad-border hover:bg-cad-hover hover:border-cad-accent transition-colors"
              >
                Generate Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
