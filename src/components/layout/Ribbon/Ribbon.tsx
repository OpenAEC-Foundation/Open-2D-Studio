import { useState, useRef, useEffect, memo, useCallback } from 'react';
import {
  MousePointer2,
  Hand,
  Square,
  Circle,
  Type,
  RotateCw,
  FlipHorizontal,
  Scissors,
  ArrowRight,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3X3,
  Trash2,
  Printer,
  Settings,
  ClipboardPaste,
  ChevronDown,
  CheckSquare,
  XSquare,
  Sun,
  Check,
  Palette,
  Search,
  ArrowUpToLine,
  ArrowUp,
  ArrowDown,
  ArrowDownToLine,
  ImageIcon,
} from 'lucide-react';
import type { UITheme } from '../../../state/slices/snapSlice';
import { UI_THEMES } from '../../../state/slices/snapSlice';
import { useAppStore } from '../../../state/appStore';
import {
  LineIcon,
  ArcIcon,
  PolylineIcon,
  SplineIcon,
  EllipseIcon,
  SplitIcon,
  ArrayIcon,
  AlignIcon,
  FilletIcon,
  ChamferIcon,
  ExtendIcon,
  ScaleIcon,
  OffsetIcon,
  HatchIcon,
  CloudIcon,
  LeaderIcon,
  TableIcon,
  StretchIcon,
  BreakIcon,
  JoinIcon,
  PinIcon,
  LengthenIcon,
  ExplodeIcon,
  FilledRegionIcon,
  DetailComponentIcon,
  InsulationIcon,
  AlignedDimensionIcon,
  LinearDimensionIcon,
  AngularDimensionIcon,
  RadiusDimensionIcon,
  DiameterDimensionIcon,
  SteelSectionIcon,
  BeamIcon,
} from '../../shared/CadIcons';
import './Ribbon.css';

/**
 * Custom tooltip component - renders below the hovered element
 */
function RibbonTooltip({ label, shortcut, parentRef }: { label: string; shortcut?: string; parentRef: React.RefObject<HTMLElement> }) {
  const [pos, setPos] = useState<{ x: number; y: number; align: 'center' | 'left' | 'right' } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (parentRef.current) {
      const rect = parentRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const viewportWidth = window.innerWidth;

      // Estimate tooltip width (will be adjusted after render if needed)
      const estimatedTooltipWidth = 150;
      const margin = 8;

      let align: 'center' | 'left' | 'right' = 'center';
      let x = centerX;

      // Check if tooltip would go outside left edge
      if (centerX - estimatedTooltipWidth / 2 < margin) {
        align = 'left';
        x = margin;
      }
      // Check if tooltip would go outside right edge
      else if (centerX + estimatedTooltipWidth / 2 > viewportWidth - margin) {
        align = 'right';
        x = viewportWidth - margin;
      }

      setPos({ x, y: rect.bottom + 4, align });
    }
  }, [parentRef]);

  // Adjust position after tooltip renders to ensure it stays in viewport
  useEffect(() => {
    if (tooltipRef.current && pos) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const margin = 8;

      // Re-check with actual tooltip width
      if (pos.align === 'center') {
        if (tooltipRect.left < margin) {
          setPos({ ...pos, x: margin, align: 'left' });
        } else if (tooltipRect.right > viewportWidth - margin) {
          setPos({ ...pos, x: viewportWidth - margin, align: 'right' });
        }
      }
    }
  }, [pos]);

  if (!pos) return null;

  const transformStyle = pos.align === 'center'
    ? 'translateX(-50%)'
    : pos.align === 'right'
      ? 'translateX(-100%)'
      : 'none';

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        transform: transformStyle,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div className="ribbon-tooltip">
        <span className="ribbon-tooltip-label">{label}</span>
        {shortcut && <span className="ribbon-tooltip-shortcut">{shortcut}</span>}
      </div>
    </div>
  );
}

/**
 * Hook for tooltip show/hide with delay
 */
function useTooltip(delay = 400) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const onEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setShow(true), delay);
  }, [delay]);

  const onLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return { show, ref, onEnter, onLeave };
}

type RibbonTab = 'home' | 'modify' | 'structural' | 'view' | 'tools' | string;

interface RibbonButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  shortcut?: string;
  tooltip?: string;
}

function RibbonButton({ icon, label, onClick, active, disabled, shortcut, tooltip }: RibbonButtonProps) {
  const tt = useTooltip();
  return (
    <>
      <button
        ref={tt.ref}
        className={`ribbon-btn ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={tt.onEnter}
        onMouseLeave={tt.onLeave}
      >
        <span className="ribbon-btn-icon">{icon}</span>
        <span className="ribbon-btn-label">{label}</span>
      </button>
      {tt.show && <RibbonTooltip label={tooltip || label} shortcut={shortcut} parentRef={tt.ref as React.RefObject<HTMLElement>} />}
    </>
  );
}


interface RibbonSmallButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

function RibbonSmallButton({ icon, label, onClick, active, disabled, shortcut }: RibbonSmallButtonProps) {
  const tt = useTooltip();
  return (
    <>
      <button
        ref={tt.ref}
        className={`ribbon-btn small ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={tt.onEnter}
        onMouseLeave={tt.onLeave}
      >
        <span className="ribbon-btn-icon">{icon}</span>
        <span className="ribbon-btn-label">{label}</span>
      </button>
      {tt.show && <RibbonTooltip label={label} shortcut={shortcut} parentRef={tt.ref as React.RefObject<HTMLElement>} />}
    </>
  );
}

function RibbonMediumButton({ icon, label, onClick, active, disabled, shortcut }: RibbonSmallButtonProps) {
  const tt = useTooltip();
  return (
    <>
      <button
        ref={tt.ref}
        className={`ribbon-btn medium ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={tt.onEnter}
        onMouseLeave={tt.onLeave}
      >
        <span className="ribbon-btn-icon">{icon}</span>
        <span className="ribbon-btn-label">{label}</span>
      </button>
      {tt.show && <RibbonTooltip label={label} shortcut={shortcut} parentRef={tt.ref as React.RefObject<HTMLElement>} />}
    </>
  );
}

function RibbonMediumButtonStack({ children }: { children: React.ReactNode }) {
  return <div className="ribbon-btn-medium-stack">{children}</div>;
}

function RibbonGroup({ label, children, noLabels }: { label: string; children: React.ReactNode; noLabels?: boolean }) {
  return (
    <div className={`ribbon-group ${noLabels ? 'no-labels' : ''}`}>
      <div className="ribbon-group-content">{children}</div>
      <div className="ribbon-group-label">{label}</div>
    </div>
  );
}

function RibbonButtonStack({ children }: { children: React.ReactNode }) {
  return <div className="ribbon-btn-stack">{children}</div>;
}

/**
 * Theme Selector - DevExpress-style dropdown for selecting UI theme
 */
interface ThemeSelectorProps {
  currentTheme: UITheme;
  onThemeChange: (theme: UITheme) => void;
}

function ThemeSelector({ currentTheme, onThemeChange }: ThemeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentThemeLabel = UI_THEMES.find(t => t.id === currentTheme)?.label || 'Dark';

  return (
    <div className="ribbon-theme-selector" ref={dropdownRef}>
      <span className="ribbon-theme-label">Theme</span>
      <div className="ribbon-theme-dropdown">
        <button
          className="ribbon-theme-button"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="ribbon-theme-button-content">
            <span className={`ribbon-theme-swatch ${currentTheme}`} />
            <span>{currentThemeLabel}</span>
          </span>
          <ChevronDown size={12} />
        </button>
        {isOpen && (
          <div className="ribbon-theme-menu">
            {UI_THEMES.map((theme) => (
              <button
                key={theme.id}
                className={`ribbon-theme-option ${currentTheme === theme.id ? 'selected' : ''}`}
                onClick={() => {
                  onThemeChange(theme.id);
                  setIsOpen(false);
                }}
              >
                {currentTheme === theme.id ? (
                  <Check size={12} className="checkmark" />
                ) : (
                  <span className="no-check" />
                )}
                <span className={`ribbon-theme-swatch ${theme.id}`} />
                <span>{theme.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface RibbonProps {
  onOpenBackstage: () => void;
}

export const Ribbon = memo(function Ribbon({ onOpenBackstage }: RibbonProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');

  const {
    activeTool,
    switchToDrawingTool,
    switchToolAndCancelCommand,
    dimensionMode,
    setDimensionMode,
    gridVisible,
    toggleGrid,
    whiteBackground,
    toggleWhiteBackground,
    zoomIn,
    zoomOut,
    zoomToFit,
    deleteSelectedShapes,
    selectedShapeIds,
    setPrintDialogOpen,
    setSnapSettingsOpen,
    // Clipboard
    copySelectedShapes,
    cutSelectedShapes,
    pasteShapes,
    hasClipboardContent,

    selectAll,
    deselectAll,
    setFindReplaceDialogOpen,
    editorMode,
    openSectionDialog,
    openBeamDialog,
    setPatternManagerOpen,

    // Draw order
    bringToFront,
    bringForward,
    sendBackward,
    sendToBack,

    // Theme
    uiTheme,
    setUITheme,

    // Extensions
    extensionRibbonTabs,
    extensionRibbonButtons,
  } = useAppStore();

  const builtInTabs: { id: RibbonTab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'modify', label: 'Modify' },
    { id: 'structural', label: 'Structural' },
    { id: 'view', label: 'View' },
    { id: 'tools', label: 'Tools' },
  ];

  const extTabs = extensionRibbonTabs
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((t) => ({ id: t.id as RibbonTab, label: t.label }));

  const tabs = [...builtInTabs, ...extTabs];

  // Helper: render extension buttons injected into a built-in tab
  const builtInTabIds = new Set(builtInTabs.map((t) => t.id));
  const renderExtensionButtonsForTab = (tabId: string) => {
    const btns = extensionRibbonButtons.filter((b) => b.tab === tabId && builtInTabIds.has(b.tab));
    if (btns.length === 0) return null;

    const groups = new Map<string, typeof btns>();
    for (const btn of btns) {
      const group = groups.get(btn.group) || [];
      group.push(btn);
      groups.set(btn.group, group);
    }

    return Array.from(groups.entries()).map(([groupLabel, groupBtns]) => (
      <RibbonGroup key={`ext-${groupLabel}`} label={groupLabel}>
        {groupBtns.map((btn) => {
          const iconContent = btn.icon
            ? <span dangerouslySetInnerHTML={{ __html: btn.icon }} />
            : <Settings size={btn.size === 'small' ? 14 : btn.size === 'medium' ? 18 : 24} />;

          if (btn.size === 'small') {
            return <RibbonSmallButton key={btn.label} icon={iconContent} label={btn.label} onClick={btn.onClick} shortcut={btn.shortcut} />;
          }
          if (btn.size === 'medium') {
            return <RibbonMediumButton key={btn.label} icon={iconContent} label={btn.label} onClick={btn.onClick} shortcut={btn.shortcut} />;
          }
          return <RibbonButton key={btn.label} icon={iconContent} label={btn.label} onClick={btn.onClick} tooltip={btn.tooltip} shortcut={btn.shortcut} />;
        })}
      </RibbonGroup>
    ));
  };

  return (
    <div className="ribbon-container">
      {/* Ribbon Tabs */}
      <div className="ribbon-tabs">
        <button
          className="ribbon-tab file"
          onClick={onOpenBackstage}
        >
          File
        </button>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`ribbon-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ribbon Content */}
      <div className="ribbon-content-container">
        {/* Home Tab */}
        <div className={`ribbon-content ${activeTab === 'home' ? 'active' : ''}`}>
          <div className="ribbon-groups">
            {/* Clipboard Group */}
            <RibbonGroup label="Clipboard">
              <RibbonButton
                icon={<ClipboardPaste size={24} />}
                label="Paste"
                onClick={() => pasteShapes()}
                disabled={!hasClipboardContent()}
                shortcut="Ctrl+V"
              />
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<Scissors size={14} />}
                  label="Cut"
                  onClick={cutSelectedShapes}
                  disabled={selectedShapeIds.length === 0}
                  shortcut="Ctrl+X"
                />
                <RibbonSmallButton
                  icon={<Copy size={14} />}
                  label="Copy"
                  onClick={copySelectedShapes}
                  disabled={selectedShapeIds.length === 0}
                  shortcut="Ctrl+C"
                />
                <RibbonSmallButton
                  icon={<Trash2 size={14} />}
                  label="Delete"
                  onClick={deleteSelectedShapes}
                  disabled={selectedShapeIds.length === 0}
                  shortcut="Del"
                />
              </RibbonButtonStack>
            </RibbonGroup>

            {/* Selection Group */}
            <RibbonGroup label="Selection">
              <RibbonButton
                icon={<MousePointer2 size={24} />}
                label="Select"
                onClick={() => switchToolAndCancelCommand('select')}
                active={activeTool === 'select'}
                shortcut="MD"
              />
              <RibbonButton
                icon={<Hand size={24} />}
                label="Pan"
                onClick={() => switchToolAndCancelCommand('pan')}
                active={activeTool === 'pan'}
              />
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<CheckSquare size={14} />}
                  label="Select All"
                  onClick={selectAll}
                />
                <RibbonSmallButton
                  icon={<XSquare size={14} />}
                  label="Deselect"
                  onClick={deselectAll}
                />
                <RibbonSmallButton
                  icon={<Search size={14} />}
                  label="Find/Replace"
                  onClick={() => setFindReplaceDialogOpen(true)}
                  shortcut="Ctrl+H"
                />
              </RibbonButtonStack>
            </RibbonGroup>

            {/* Draw Group */}
            <RibbonGroup label="Draw" noLabels>
              <RibbonMediumButtonStack>
                <RibbonMediumButton
                  icon={<LineIcon size={18} />}
                  label="Line"
                  onClick={() => switchToDrawingTool('line')}
                  active={activeTool === 'line'}
                  shortcut="LI"
                />
                <RibbonMediumButton
                  icon={<PolylineIcon size={18} />}
                  label="Polyline"
                  onClick={() => switchToDrawingTool('polyline')}
                  active={activeTool === 'polyline'}
                  shortcut="PL"
                />
              </RibbonMediumButtonStack>
              <RibbonMediumButtonStack>
                <RibbonMediumButton
                  icon={<Square size={18} />}
                  label="Rectangle"
                  onClick={() => switchToDrawingTool('rectangle')}
                  active={activeTool === 'rectangle'}
                  shortcut="RC"
                />
                <RibbonMediumButton
                  icon={<Circle size={18} />}
                  label="Circle"
                  onClick={() => switchToDrawingTool('circle')}
                  active={activeTool === 'circle'}
                  shortcut="CI"
                />
              </RibbonMediumButtonStack>
              <RibbonMediumButtonStack>
                <RibbonMediumButton
                  icon={<ArcIcon size={18} />}
                  label="Arc"
                  onClick={() => switchToDrawingTool('arc')}
                  active={activeTool === 'arc'}
                  shortcut="AR"
                />
                <RibbonMediumButton
                  icon={<EllipseIcon size={18} />}
                  label="Ellipse"
                  onClick={() => switchToDrawingTool('ellipse')}
                  active={activeTool === 'ellipse'}
                  shortcut="EL"
                />
              </RibbonMediumButtonStack>
              <RibbonMediumButtonStack>
                <RibbonMediumButton
                  icon={<SplineIcon size={18} />}
                  label="Spline"
                  onClick={() => switchToDrawingTool('spline')}
                  active={activeTool === 'spline'}
                  shortcut="SP"
                />
                <RibbonMediumButton
                  icon={<FilledRegionIcon size={18} />}
                  label="Filled Region"
                  onClick={() => switchToDrawingTool('hatch')}
                  active={activeTool === 'hatch'}
                />
              </RibbonMediumButtonStack>
              <RibbonMediumButtonStack>
                <RibbonMediumButton
                  icon={<Type size={18} />}
                  label="Text"
                  onClick={() => switchToDrawingTool('text')}
                  active={activeTool === 'text'}
                  shortcut="TX"
                />
                <RibbonMediumButton
                  icon={<ImageIcon size={18} />}
                  label="Image"
                  onClick={() => switchToDrawingTool('image')}
                  active={activeTool === 'image'}
                  shortcut="IM"
                />
              </RibbonMediumButtonStack>
            </RibbonGroup>

            {/* Annotate Group */}
            <RibbonGroup label="Annotate">
              <RibbonButton
                icon={<AlignedDimensionIcon size={24} />}
                label="Aligned"
                onClick={() => {
                  setDimensionMode('aligned');
                  switchToDrawingTool('dimension');
                }}
                active={activeTool === 'dimension' && dimensionMode === 'aligned'}
                shortcut="DI"
              />
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<LinearDimensionIcon size={14} />}
                  label="Linear"
                  onClick={() => {
                    setDimensionMode('linear');
                    switchToDrawingTool('dimension');
                  }}
                  active={activeTool === 'dimension' && dimensionMode === 'linear'}
                  shortcut="DL"
                />
                <RibbonSmallButton
                  icon={<AngularDimensionIcon size={14} />}
                  label="Angular"
                  onClick={() => {
                    setDimensionMode('angular');
                    switchToDrawingTool('dimension');
                  }}
                  active={activeTool === 'dimension' && dimensionMode === 'angular'}
                  shortcut="DA"
                />
              </RibbonButtonStack>
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<RadiusDimensionIcon size={14} />}
                  label="Radius"
                  onClick={() => {
                    setDimensionMode('radius');
                    switchToDrawingTool('dimension');
                  }}
                  active={activeTool === 'dimension' && dimensionMode === 'radius'}
                  shortcut="DR"
                />
                <RibbonSmallButton
                  icon={<DiameterDimensionIcon size={14} />}
                  label="Diameter"
                  onClick={() => {
                    setDimensionMode('diameter');
                    switchToDrawingTool('dimension');
                  }}
                  active={activeTool === 'dimension' && dimensionMode === 'diameter'}
                  shortcut="DD"
                />
              </RibbonButtonStack>
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<LeaderIcon size={14} />}
                  label="Leader"
                  onClick={() => {}}
                  disabled={true}
                />
                <RibbonSmallButton
                  icon={<TableIcon size={14} />}
                  label="Table"
                  onClick={() => {}}
                  disabled={true}
                />
                <RibbonSmallButton
                  icon={<CloudIcon size={14} />}
                  label="Cloud"
                  onClick={() => {}}
                  disabled={true}
                />
              </RibbonButtonStack>
            </RibbonGroup>

            {/* Modify Group */}
            <RibbonGroup label="Modify">
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<ArrowRight size={14} />}
                  label="Move"
                  onClick={() => switchToolAndCancelCommand('move')}
                  active={activeTool === 'move'}
                  shortcut="MV"
                />
                <RibbonSmallButton
                  icon={<Copy size={14} />}
                  label="Copy"
                  onClick={() => switchToolAndCancelCommand('copy')}
                  active={activeTool === 'copy'}
                  shortcut="CO"
                />
                <RibbonSmallButton
                  icon={<RotateCw size={14} />}
                  label="Rotate"
                  onClick={() => switchToolAndCancelCommand('rotate')}
                  active={activeTool === 'rotate'}
                  shortcut="RO"
                />
              </RibbonButtonStack>
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<FlipHorizontal size={14} />}
                  label="Mirror"
                  onClick={() => switchToolAndCancelCommand('mirror')}
                  active={activeTool === 'mirror'}
                  shortcut="MM"
                />
                <RibbonSmallButton
                  icon={<ArrayIcon size={14} />}
                  label="Array"
                  onClick={() => switchToolAndCancelCommand('array')}
                  active={activeTool === 'array'}
                />
                <RibbonSmallButton
                  icon={<ScaleIcon size={14} />}
                  label="Scale"
                  onClick={() => switchToolAndCancelCommand('scale')}
                  active={activeTool === 'scale'}
                  shortcut="RE"
                />
              </RibbonButtonStack>
            </RibbonGroup>

            {/* Edit Group */}
            <RibbonGroup label="Edit">
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<Scissors size={14} />}
                  label="Trim"
                  onClick={() => {}}
                  disabled={true}
                />
                <RibbonSmallButton
                  icon={<ExtendIcon size={14} />}
                  label="Extend"
                  onClick={() => {}}
                  disabled={true}
                />
                <RibbonSmallButton
                  icon={<OffsetIcon size={14} />}
                  label="Offset"
                  onClick={() => {}}
                  disabled={true}
                />
              </RibbonButtonStack>
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<FilletIcon size={14} />}
                  label="Fillet"
                  onClick={() => {}}
                  disabled={true}
                />
                <RibbonSmallButton
                  icon={<ChamferIcon size={14} />}
                  label="Chamfer"
                  onClick={() => switchToolAndCancelCommand('chamfer')}
                  active={activeTool === 'chamfer'}
                />
                <RibbonSmallButton
                  icon={<SplitIcon size={14} />}
                  label="Split"
                  onClick={() => {}}
                  disabled={true}
                />
              </RibbonButtonStack>
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<BreakIcon size={14} />}
                  label="Break"
                  onClick={() => {}}
                  disabled={true}
                />
                <RibbonSmallButton
                  icon={<JoinIcon size={14} />}
                  label="Join"
                  onClick={() => {}}
                  disabled={true}
                />
                <RibbonSmallButton
                  icon={<ExplodeIcon size={14} />}
                  label="Explode"
                  onClick={() => {}}
                  disabled={true}
                />
              </RibbonButtonStack>
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<StretchIcon size={14} />}
                  label="Stretch"
                  onClick={() => {}}
                  disabled={true}
                />
                <RibbonSmallButton
                  icon={<LengthenIcon size={14} />}
                  label="Lengthen"
                  onClick={() => {}}
                  disabled={true}
                />
                <RibbonSmallButton
                  icon={<AlignIcon size={14} />}
                  label="Align"
                  onClick={() => {}}
                  disabled={true}
                />
              </RibbonButtonStack>
              <RibbonSmallButton
                icon={<PinIcon size={14} />}
                label="Pin"
                onClick={() => {}}
                disabled={true}
              />
            </RibbonGroup>

            {/* Draw Order Group */}
            <RibbonGroup label="Draw Order">
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<ArrowUpToLine size={14} />}
                  label="Bring Front"
                  onClick={bringToFront}
                  disabled={selectedShapeIds.length === 0}
                />
                <RibbonSmallButton
                  icon={<ArrowUp size={14} />}
                  label="Bring Fwd"
                  onClick={bringForward}
                  disabled={selectedShapeIds.length === 0}
                />
              </RibbonButtonStack>
              <RibbonButtonStack>
                <RibbonSmallButton
                  icon={<ArrowDown size={14} />}
                  label="Send Bwd"
                  onClick={sendBackward}
                  disabled={selectedShapeIds.length === 0}
                />
                <RibbonSmallButton
                  icon={<ArrowDownToLine size={14} />}
                  label="Send Back"
                  onClick={sendToBack}
                  disabled={selectedShapeIds.length === 0}
                />
              </RibbonButtonStack>
            </RibbonGroup>
            {renderExtensionButtonsForTab('home')}
          </div>
        </div>

        {/* Modify Tab */}
        <div className={`ribbon-content ${activeTab === 'modify' ? 'active' : ''}`}>
          <div className="ribbon-groups">
            <RibbonGroup label="Region">
              <RibbonButton
                icon={<HatchIcon size={24} />}
                label="Pattern Manager"
                onClick={() => setPatternManagerOpen(true)}
                tooltip="Manage hatch patterns"
              />
              <RibbonButton
                icon={<InsulationIcon size={24} />}
                label="Insulation"
                onClick={() => {}}
                disabled={true}
              />
              <RibbonButton
                icon={<DetailComponentIcon size={24} />}
                label="Detail Component"
                onClick={() => {}}
                disabled={true}
              />
            </RibbonGroup>

            <RibbonGroup label="Clipboard">
              <RibbonButton
                icon={<Trash2 size={24} />}
                label="Delete"
                onClick={deleteSelectedShapes}
                disabled={selectedShapeIds.length === 0}
              />
            </RibbonGroup>
            {renderExtensionButtonsForTab('modify')}
          </div>
        </div>

        {/* Structural Tab */}
        <div className={`ribbon-content ${activeTab === 'structural' ? 'active' : ''}`}>
          <div className="ribbon-groups">
            <RibbonGroup label="Section">
              <RibbonButton
                icon={<SteelSectionIcon size={24} />}
                label="Section"
                onClick={openSectionDialog}
                disabled={editorMode !== 'drawing'}
                tooltip="Insert structural profile section"
                shortcut="SE"
              />
            </RibbonGroup>

            <RibbonGroup label="Framing">
              <RibbonButton
                icon={<BeamIcon size={24} />}
                label="Beam"
                onClick={openBeamDialog}
                disabled={editorMode !== 'drawing'}
                tooltip="Draw structural beam in plan view"
                shortcut="BE"
              />
            </RibbonGroup>
            {renderExtensionButtonsForTab('structural')}
          </div>
        </div>

        {/* View Tab */}
        <div className={`ribbon-content ${activeTab === 'view' ? 'active' : ''}`}>
          <div className="ribbon-groups">
            <RibbonGroup label="Navigate">
              <RibbonButton
                icon={<Hand size={24} />}
                label="Pan"
                onClick={() => switchToolAndCancelCommand('pan')}
                active={activeTool === 'pan'}
              />
            </RibbonGroup>

            <RibbonGroup label="Zoom">
              <RibbonButton
                icon={<ZoomIn size={24} />}
                label="Zoom In"
                onClick={zoomIn}
              />
              <RibbonButton
                icon={<ZoomOut size={24} />}
                label="Zoom Out"
                onClick={zoomOut}
              />
              <RibbonButton
                icon={<Maximize size={24} />}
                label="Fit All"
                onClick={zoomToFit}
              />
            </RibbonGroup>

            <RibbonGroup label="Display">
              <RibbonButton
                icon={<Grid3X3 size={24} />}
                label="Grid"
                onClick={toggleGrid}
                active={gridVisible}
              />
              <RibbonButton
                icon={<Sun size={24} />}
                label="White Background"
                onClick={toggleWhiteBackground}
                active={whiteBackground}
              />
            </RibbonGroup>

            <RibbonGroup label="Appearance">
              <RibbonButton
                icon={<Palette size={24} />}
                label="Theme"
                onClick={() => {}}
                tooltip="Change UI theme"
              />
              <ThemeSelector
                currentTheme={uiTheme}
                onThemeChange={setUITheme}
              />
            </RibbonGroup>
            {renderExtensionButtonsForTab('view')}
          </div>
        </div>

        {/* Tools Tab */}
        <div className={`ribbon-content ${activeTab === 'tools' ? 'active' : ''}`}>
          <div className="ribbon-groups">
            <RibbonGroup label="Settings">
              <RibbonButton
                icon={<Settings size={24} />}
                label="Snap Settings"
                onClick={() => setSnapSettingsOpen(true)}
              />
            </RibbonGroup>

            <RibbonGroup label="Output">
              <RibbonButton
                icon={<Printer size={24} />}
                label="Print"
                onClick={() => setPrintDialogOpen(true)}
              />
            </RibbonGroup>
            {renderExtensionButtonsForTab('tools')}
          </div>
        </div>

        {/* Extension Tabs — render buttons grouped by group for each extension tab */}
        {extTabs.map((extTab) => {
          const buttonsForTab = extensionRibbonButtons.filter((b) => b.tab === extTab.id);
          const groups = new Map<string, typeof buttonsForTab>();
          for (const btn of buttonsForTab) {
            const group = groups.get(btn.group) || [];
            group.push(btn);
            groups.set(btn.group, group);
          }

          return (
            <div key={extTab.id} className={`ribbon-content ${activeTab === extTab.id ? 'active' : ''}`}>
              <div className="ribbon-groups">
                {Array.from(groups.entries()).map(([groupLabel, btns]) => (
                  <RibbonGroup key={groupLabel} label={groupLabel}>
                    {btns.map((btn) => {
                      const iconContent = btn.icon
                        ? <span dangerouslySetInnerHTML={{ __html: btn.icon }} />
                        : <Settings size={btn.size === 'small' ? 14 : btn.size === 'medium' ? 18 : 24} />;

                      if (btn.size === 'small') {
                        return (
                          <RibbonSmallButton
                            key={btn.label}
                            icon={iconContent}
                            label={btn.label}
                            onClick={btn.onClick}
                            shortcut={btn.shortcut}
                          />
                        );
                      }
                      if (btn.size === 'medium') {
                        return (
                          <RibbonMediumButton
                            key={btn.label}
                            icon={iconContent}
                            label={btn.label}
                            onClick={btn.onClick}
                            shortcut={btn.shortcut}
                          />
                        );
                      }
                      return (
                        <RibbonButton
                          key={btn.label}
                          icon={iconContent}
                          label={btn.label}
                          onClick={btn.onClick}
                          tooltip={btn.tooltip}
                          shortcut={btn.shortcut}
                        />
                      );
                    })}
                  </RibbonGroup>
                ))}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
});
