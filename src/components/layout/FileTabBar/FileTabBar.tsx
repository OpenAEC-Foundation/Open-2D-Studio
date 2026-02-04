/**
 * FileTabBar - Horizontal tab bar for open documents
 * Sloped right-side divider between tabs
 */

import { useCallback } from 'react';
import { useAppStore } from '../../../state/appStore';
import { getDocumentStoreIfExists } from '../../../state/documentStore';

/** Get tab display info — for active doc reads from appStore, for inactive reads from doc store */
function useTabInfo(docId: string, isActive: boolean) {
  // For the active document, read live from appStore (doc store may be stale)
  const activeProjectName = useAppStore((s) => s.projectName);
  const activeIsModified = useAppStore((s) => s.isModified);

  if (isActive) {
    return { name: activeProjectName, isModified: activeIsModified };
  }

  // For inactive documents, read from their doc store (saved on last switch)
  const store = getDocumentStoreIfExists(docId);
  if (!store) return { name: 'Unknown', isModified: false };
  const state = store.getState();
  return { name: state.projectName, isModified: state.isModified };
}

/** Check if a document is modified — reads from appStore for active doc */
function isDocModified(docId: string, activeDocumentId: string, appState: any): boolean {
  if (docId === activeDocumentId) {
    return appState.isModified;
  }
  const store = getDocumentStoreIfExists(docId);
  return store?.getState().isModified ?? false;
}

function TabItem({ docId, index, total }: { docId: string; index: number; total: number }) {
  const activeDocumentId = useAppStore((s) => s.activeDocumentId);
  const documentOrder = useAppStore((s) => s.documentOrder);
  const switchDocument = useAppStore((s) => s.switchDocument);
  const closeDocument = useAppStore((s) => s.closeDocument);

  const isActive = docId === activeDocumentId;
  const { name, isModified } = useTabInfo(docId, isActive);
  const isLast = index === total - 1;

  const bg = isActive ? '#1e1e1e' : '#2b2b2b';
  const barBg = '#2b2b2b';
  const nextDocId = !isLast ? documentOrder[index + 1] : null;
  const nextBg = nextDocId === activeDocumentId ? '#1e1e1e' : barBg;

  const handleMiddleClick = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      if (isDocModified(docId, activeDocumentId, useAppStore.getState())) {
        if (!confirm('This document has unsaved changes. Close anyway?')) return;
      }
      closeDocument(docId);
    }
  }, [closeDocument, docId, activeDocumentId]);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDocModified(docId, activeDocumentId, useAppStore.getState())) {
      if (!confirm('This document has unsaved changes. Close anyway?')) return;
    }
    closeDocument(docId);
  }, [closeDocument, docId, activeDocumentId]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const menu = document.createElement('div');
    menu.className = 'fixed z-[9999] bg-cad-surface border border-cad-border shadow-lg text-xs';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    const items = [
      { label: 'Close', action: () => closeDocument(docId) },
      { label: 'Close Others', action: () => {
        documentOrder.forEach(id => { if (id !== docId) closeDocument(id); });
      }},
      { label: 'Close All', action: () => {
        documentOrder.forEach(id => closeDocument(id));
      }},
    ];

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'px-4 py-1.5 hover:bg-cad-hover cursor-pointer text-cad-text';
      el.textContent = item.label;
      el.onclick = () => { item.action(); menu.remove(); };
      menu.appendChild(el);
    });

    document.body.appendChild(menu);
    const cleanup = () => { menu.remove(); document.removeEventListener('mousedown', cleanup); };
    setTimeout(() => document.addEventListener('mousedown', cleanup), 0);
  }, [closeDocument, documentOrder, docId]);

  return (
    <div
      className="flex items-stretch flex-shrink-0 group cursor-pointer"
      onClick={() => switchDocument(docId)}
      onMouseDown={handleMiddleClick}
      onContextMenu={handleContextMenu}
    >
      <div
        className="flex items-center h-[30px]"
        style={{ backgroundColor: bg }}
      >
        <span
          className={`
            px-3 text-xs select-none
            ${isActive ? 'text-white font-semibold' : 'text-[#888] hover:text-[#bbb]'}
          `}
        >
          {name}{isModified ? ' *' : ''}
        </span>
        <button
          className="w-4 h-4 flex items-center justify-center text-[12px] leading-none opacity-0 group-hover:opacity-100 hover:text-white text-[#888] -mr-1"
          style={{ borderRadius: 0 }}
          onClick={handleClose}
          title="Close"
        >
          ×
        </button>
      </div>
      {/* Sloped right edge — triangle fills create the angled transition */}
      <svg width="14" height="30" viewBox="0 0 14 30" className="flex-shrink-0" style={{ display: 'block' }}>
        <polygon points="0,0 0,30 14,30" fill={bg} />
        <polygon points="0,0 14,0 14,30" fill={nextBg} />
      </svg>
    </div>
  );
}

export function FileTabBar() {
  const documentOrder = useAppStore((s) => s.documentOrder);
  const createNewDocument = useAppStore((s) => s.createNewDocument);

  return (
    <div
      className="flex items-stretch bg-[#2b2b2b] border-b border-[#1e1e1e] h-[30px] min-h-[30px] overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      {documentOrder.map((docId, index) => (
        <TabItem key={docId} docId={docId} index={index} total={documentOrder.length} />
      ))}

      {/* New tab button */}
      <button
        className="flex items-center justify-center w-7 h-full text-[#888] hover:text-white text-sm flex-shrink-0"
        style={{ borderRadius: 0 }}
        onClick={() => createNewDocument()}
        title="New Document (Ctrl+N)"
      >
        +
      </button>
    </div>
  );
}
