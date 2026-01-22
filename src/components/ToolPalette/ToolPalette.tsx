import {
  MousePointer2,
  Move,
  Minus,
  Square,
  Circle,
  Spline,
  Type,
  ArrowUpRight,
  RotateCw,
  FlipHorizontal,
  Scissors,
  ArrowRight,
  CornerUpRight,
  Copy,
} from 'lucide-react';
import { useAppStore } from '../../state/appStore';
import type { ToolType } from '../../types/geometry';

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, shortcut, active, onClick }: ToolButtonProps) {
  return (
    <button
      className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
        active
          ? 'bg-cad-accent text-white'
          : 'text-cad-text hover:bg-cad-border'
      }`}
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      {icon}
    </button>
  );
}

function ToolDivider() {
  return <div className="h-px bg-cad-border mx-1 my-1" />;
}

function ToolSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[9px] text-cad-text-dim mb-1 uppercase tracking-wider">
        {title}
      </div>
      {children}
    </div>
  );
}

export function ToolPalette() {
  const { activeTool, setActiveTool, setPendingCommand } = useAppStore();

  const selectionTools: { type: ToolType; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { type: 'select', icon: <MousePointer2 size={18} />, label: 'Select', shortcut: 'V' },
    { type: 'pan', icon: <Move size={18} />, label: 'Pan', shortcut: 'H' },
  ];

  const drawTools: { type: ToolType; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { type: 'line', icon: <Minus size={18} />, label: 'Line', shortcut: 'L' },
    { type: 'rectangle', icon: <Square size={18} />, label: 'Rectangle', shortcut: 'R' },
    { type: 'circle', icon: <Circle size={18} />, label: 'Circle', shortcut: 'C' },
    { type: 'arc', icon: <ArrowUpRight size={18} />, label: 'Arc', shortcut: 'A' },
    { type: 'polyline', icon: <Spline size={18} />, label: 'Polyline', shortcut: 'P' },
    { type: 'text', icon: <Type size={18} />, label: 'Text', shortcut: 'T' },
  ];

  // Modify tools trigger commands, not persistent tool modes
  const modifyCommands: { command: string; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { command: 'MOVE', icon: <ArrowRight size={18} />, label: 'Move', shortcut: 'M' },
    { command: 'COPY', icon: <Copy size={18} />, label: 'Copy', shortcut: 'CO' },
    { command: 'ROTATE', icon: <RotateCw size={18} />, label: 'Rotate', shortcut: 'RO' },
    { command: 'MIRROR', icon: <FlipHorizontal size={18} />, label: 'Mirror', shortcut: 'MI' },
    { command: 'TRIM', icon: <Scissors size={18} />, label: 'Trim', shortcut: 'TR' },
    { command: 'FILLET', icon: <CornerUpRight size={18} />, label: 'Fillet', shortcut: 'F' },
  ];

  return (
    <div className="w-12 bg-cad-surface border-r border-cad-border flex flex-col items-center py-2 gap-2">
      {/* Selection Tools */}
      <ToolSection title="Select">
        {selectionTools.map((tool) => (
          <ToolButton
            key={tool.type}
            icon={tool.icon}
            label={tool.label}
            shortcut={tool.shortcut}
            active={activeTool === tool.type}
            onClick={() => setActiveTool(tool.type)}
          />
        ))}
      </ToolSection>

      <ToolDivider />

      {/* Drawing Tools */}
      <ToolSection title="Draw">
        {drawTools.map((tool) => (
          <ToolButton
            key={tool.type}
            icon={tool.icon}
            label={tool.label}
            shortcut={tool.shortcut}
            active={activeTool === tool.type}
            onClick={() => setActiveTool(tool.type)}
          />
        ))}
      </ToolSection>

      <ToolDivider />

      {/* Modify Commands */}
      <ToolSection title="Modify">
        {modifyCommands.map((cmd) => (
          <ToolButton
            key={cmd.command}
            icon={cmd.icon}
            label={cmd.label}
            shortcut={cmd.shortcut}
            active={false}
            onClick={() => setPendingCommand(cmd.command)}
          />
        ))}
      </ToolSection>
    </div>
  );
}
