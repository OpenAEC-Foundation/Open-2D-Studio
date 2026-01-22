import { useState, useRef, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { useAppStore } from '../../state/appStore';

interface MenuItem {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface MenuProps {
  label: string;
  items: MenuItem[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  menuBarHovered: boolean;
}

function Menu({ label, items, isOpen, onOpen, onClose, menuBarHovered }: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        className={`px-3 py-1 text-sm hover:bg-cad-border rounded transition-colors ${
          isOpen ? 'bg-cad-border' : ''
        }`}
        onClick={() => (isOpen ? onClose() : onOpen())}
        onMouseEnter={() => menuBarHovered && onOpen()}
      >
        {label}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-cad-surface border border-cad-border rounded shadow-lg min-w-48 py-1 z-50">
          {items.map((item, index) =>
            item.separator ? (
              <div key={index} className="h-px bg-cad-border my-1" />
            ) : (
              <button
                key={index}
                className={`w-full px-4 py-1.5 text-sm text-left flex justify-between items-center hover:bg-cad-border transition-colors ${
                  item.disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={() => {
                  if (!item.disabled && item.onClick) {
                    item.onClick();
                    onClose();
                  }
                }}
                disabled={item.disabled}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="text-cad-text-dim text-xs ml-4">{item.shortcut}</span>
                )}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    // Check initial maximized state
    appWindow.isMaximized().then(setIsMaximized);

    // Listen for resize events to update maximized state
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [appWindow]);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  return (
    <div className="flex items-center">
      <button
        onClick={handleMinimize}
        className="w-12 h-8 flex items-center justify-center hover:bg-cad-border transition-colors"
        title="Minimize"
      >
        <Minus size={16} />
      </button>
      <button
        onClick={handleMaximize}
        className="w-12 h-8 flex items-center justify-center hover:bg-cad-border transition-colors"
        title={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? <Square size={14} /> : <Maximize2 size={14} />}
      </button>
      <button
        onClick={handleClose}
        className="w-12 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
        title="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const {
    undo,
    redo,
    selectAll,
    deselectAll,
    deleteSelectedShapes,
    selectedShapeIds,
    toggleGrid,
    toggleSnap,
    gridVisible,
    snapEnabled,
    zoomIn,
    zoomOut,
    zoomToFit,
    setActiveTool,
    setPrintDialogOpen,
    setAboutDialogOpen,
  } = useAppStore();

  const handleOpen = (menu: string) => setOpenMenu(menu);
  const handleClose = () => setOpenMenu(null);
  const menuBarHovered = openMenu !== null;

  const fileMenu: MenuItem[] = [
    { label: 'New', shortcut: 'Ctrl+N', onClick: () => console.log('New') },
    { label: 'Open...', shortcut: 'Ctrl+O', onClick: () => console.log('Open') },
    { separator: true },
    { label: 'Save', shortcut: 'Ctrl+S', onClick: () => console.log('Save') },
    { label: 'Save As...', shortcut: 'Ctrl+Shift+S', onClick: () => console.log('Save As') },
    { separator: true },
    { label: 'Export...', onClick: () => console.log('Export') },
    { separator: true },
    { label: 'Print...', shortcut: 'Ctrl+P', onClick: () => setPrintDialogOpen(true) },
    { separator: true },
    { label: 'Exit', shortcut: 'Alt+F4', onClick: () => getCurrentWindow().close() },
  ];

  const editMenu: MenuItem[] = [
    { label: 'Undo', shortcut: 'Ctrl+Z', onClick: undo },
    { label: 'Redo', shortcut: 'Ctrl+Y', onClick: redo },
    { separator: true },
    { label: 'Select All', shortcut: 'Ctrl+A', onClick: selectAll },
    { label: 'Deselect All', shortcut: 'Ctrl+D', onClick: deselectAll },
    { separator: true },
    { label: 'Delete', shortcut: 'Del', onClick: deleteSelectedShapes, disabled: selectedShapeIds.length === 0 },
  ];

  const viewMenu: MenuItem[] = [
    { label: 'Zoom In', shortcut: '+', onClick: zoomIn },
    { label: 'Zoom Out', shortcut: '-', onClick: zoomOut },
    { label: 'Zoom to Fit', shortcut: 'F', onClick: zoomToFit },
    { separator: true },
    { label: `${gridVisible ? '✓ ' : ''}Show Grid`, shortcut: 'G', onClick: toggleGrid },
    { label: `${snapEnabled ? '✓ ' : ''}Snap to Grid`, shortcut: 'S', onClick: toggleSnap },
  ];

  const drawMenu: MenuItem[] = [
    { label: 'Line', shortcut: 'L', onClick: () => setActiveTool('line') },
    { label: 'Polyline', onClick: () => setActiveTool('polyline') },
    { separator: true },
    { label: 'Rectangle', shortcut: 'R', onClick: () => setActiveTool('rectangle') },
    { label: 'Circle', shortcut: 'C', onClick: () => setActiveTool('circle') },
    { separator: true },
    { label: 'Arc', onClick: () => setActiveTool('arc') },
    { label: 'Ellipse', onClick: () => setActiveTool('ellipse') },
  ];

  const modifyMenu: MenuItem[] = [
    { label: 'Move', shortcut: 'M', onClick: () => console.log('Move command') },
    { label: 'Copy', shortcut: 'CO', onClick: () => console.log('Copy command') },
    { label: 'Rotate', shortcut: 'RO', onClick: () => console.log('Rotate command') },
    { label: 'Scale', shortcut: 'SC', onClick: () => console.log('Scale command') },
    { separator: true },
    { label: 'Mirror', shortcut: 'MI', onClick: () => console.log('Mirror command') },
    { label: 'Offset', shortcut: 'O', onClick: () => console.log('Offset command') },
    { separator: true },
    { label: 'Fillet', shortcut: 'F', onClick: () => console.log('Fillet command') },
    { label: 'Chamfer', shortcut: 'CHA', onClick: () => console.log('Chamfer command') },
  ];

  const helpMenu: MenuItem[] = [
    { label: 'Keyboard Shortcuts', onClick: () => console.log('Shortcuts') },
    { separator: true },
    { label: 'About Open 2D Studio', onClick: () => setAboutDialogOpen(true) },
  ];

  return (
    <div className="h-8 bg-cad-surface border-b border-cad-border flex items-center select-none">
      {/* Menu items */}
      <div className="flex items-center px-2 gap-1">
        <Menu
          label="File"
          items={fileMenu}
          isOpen={openMenu === 'file'}
          onOpen={() => handleOpen('file')}
          onClose={handleClose}
          menuBarHovered={menuBarHovered}
        />
        <Menu
          label="Edit"
          items={editMenu}
          isOpen={openMenu === 'edit'}
          onOpen={() => handleOpen('edit')}
          onClose={handleClose}
          menuBarHovered={menuBarHovered}
        />
        <Menu
          label="View"
          items={viewMenu}
          isOpen={openMenu === 'view'}
          onOpen={() => handleOpen('view')}
          onClose={handleClose}
          menuBarHovered={menuBarHovered}
        />
        <Menu
          label="Draw"
          items={drawMenu}
          isOpen={openMenu === 'draw'}
          onOpen={() => handleOpen('draw')}
          onClose={handleClose}
          menuBarHovered={menuBarHovered}
        />
        <Menu
          label="Modify"
          items={modifyMenu}
          isOpen={openMenu === 'modify'}
          onOpen={() => handleOpen('modify')}
          onClose={handleClose}
          menuBarHovered={menuBarHovered}
        />
        <Menu
          label="Help"
          items={helpMenu}
          isOpen={openMenu === 'help'}
          onOpen={() => handleOpen('help')}
          onClose={handleClose}
          menuBarHovered={menuBarHovered}
        />
      </div>

      {/* Draggable area with app title */}
      <div
        className="flex-1 h-full flex items-center justify-center cursor-default"
        onMouseDown={(e) => {
          if (e.button === 0) {
            getCurrentWindow().startDragging();
          }
        }}
        onDoubleClick={() => getCurrentWindow().toggleMaximize()}
      >
        <span className="text-cad-text-dim text-sm font-medium pointer-events-none">
          Open 2D Studio
        </span>
      </div>

      {/* Window controls */}
      <WindowControls />
    </div>
  );
}
