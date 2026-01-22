import { Toolbar } from './components/Toolbar/Toolbar';
import { Canvas } from './components/Canvas/Canvas';
import { PropertiesPanel } from './components/Panels/PropertiesPanel';
import { LayersPanel } from './components/Panels/LayersPanel';
import { StatusBar } from './components/StatusBar/StatusBar';
import { CommandLine } from './components/CommandLine/CommandLine';
import { ToolPalette } from './components/ToolPalette/ToolPalette';
import { PrintDialog } from './components/PrintDialog/PrintDialog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppStore } from './state/appStore';

function App() {
  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  const { printDialogOpen, setPrintDialogOpen } = useAppStore();

  return (
    <div className="flex flex-col h-full w-full bg-cad-bg text-cad-text no-select">
      {/* Top Toolbar */}
      <Toolbar />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Tools */}
        <ToolPalette />

        {/* Center - Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Canvas />
          <CommandLine />
        </div>

        {/* Right Panel - Properties & Layers */}
        <div className="w-64 bg-cad-surface border-l border-cad-border flex flex-col">
          <PropertiesPanel />
          <LayersPanel />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar />

      {/* Print Dialog */}
      <PrintDialog
        isOpen={printDialogOpen}
        onClose={() => setPrintDialogOpen(false)}
      />
    </div>
  );
}

export default App;
