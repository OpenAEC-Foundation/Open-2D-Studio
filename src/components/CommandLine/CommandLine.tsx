import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore, generateId } from '../../state/appStore';
import { parseCoordinateInput } from '../../utils/coordinateParser';
import type { LineShape, RectangleShape, CircleShape } from '../../types/geometry';
import {
  resolveCommandName,
  createInitialCommandState,
  startCommand,
  processCommandInput,
  getCommandPreview,
  type CommandState,
  type CommandInput,
  type CommandResult,
} from '../../commands';

type DrawingOption = 'Undo' | 'Close' | 'Cancel';

export function CommandLine() {
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [messages, setMessages] = useState<string[]>(['Ready']);
  const [commandState, setCommandState] = useState<CommandState>(createInitialCommandState());

  const {
    commandHistory,
    currentCommand,
    setCurrentCommand,
    activeTool,
    drawingPoints,
    isDrawing,
    addDrawingPoint,
    undoDrawingPoint,
    clearDrawingPoints,
    setDrawingPreview,
    addShape,
    updateShape,
    deleteShape,
    shapes,
    selectedShapeIds,
    deselectAll,
    activeLayerId,
    currentStyle,
    setActiveTool,
    pendingCommand,
    setPendingCommand,
    pendingCommandPoint,
    setPendingCommandPoint,
    pendingCommandSelection,
    setPendingCommandSelection,
    setHasActiveModifyCommand,
    setCommandIsSelecting,
    mousePosition,
    viewport,
    setCommandPreviewShapes,
    snapEnabled,
    gridSize,
    setPrintDialogOpen,
  } = useAppStore();

  // Check if we have an active modify command
  const hasActiveCommand = commandState.activeCommand !== null;

  // Get current prompt based on tool, drawing state, or command state
  const getPrompt = useCallback((): string => {
    // If there's an active command, use its prompt
    if (hasActiveCommand) {
      return commandState.prompt;
    }

    switch (activeTool) {
      case 'line':
        if (drawingPoints.length === 0) {
          return 'LINE Specify first point:';
        } else if (drawingPoints.length === 1) {
          return 'Specify next point or [Undo]:';
        } else {
          return 'Specify next point or [Close/Undo]:';
        }

      case 'rectangle':
        if (drawingPoints.length === 0) {
          return 'RECTANG Specify first corner point:';
        } else {
          return 'Specify other corner point:';
        }

      case 'circle':
        if (drawingPoints.length === 0) {
          return 'CIRCLE Specify center point:';
        } else {
          return 'Specify radius or [Diameter]:';
        }

      case 'select':
        return 'Select objects:';

      case 'pan':
        return 'Press Esc or Enter to exit, or click and drag to pan.';

      default:
        return 'Command:';
    }
  }, [activeTool, drawingPoints.length, hasActiveCommand, commandState.prompt]);

  // Get available options based on current state
  const getOptions = useCallback((): string[] => {
    // If there's an active command, use its options
    if (hasActiveCommand) {
      return commandState.options || [];
    }

    if (!isDrawing) return [];

    const options: DrawingOption[] = ['Cancel'];

    if (drawingPoints.length > 0) {
      options.unshift('Undo');
    }

    if (activeTool === 'line' && drawingPoints.length >= 2) {
      options.unshift('Close');
    }

    return options;
  }, [isDrawing, drawingPoints.length, activeTool, hasActiveCommand, commandState.options]);

  // Add message to history
  const addMessage = useCallback((msg: string) => {
    setMessages((prev) => [...prev.slice(-50), msg]); // Keep last 50 messages
  }, []);

  // Apply command result
  const applyCommandResult = useCallback((result: CommandResult) => {
    if (result.message) {
      addMessage(result.message);
    }

    // Add new shapes
    if (result.shapesToAdd) {
      result.shapesToAdd.forEach((shape) => addShape(shape));
    }

    // Update existing shapes
    if (result.shapesToUpdate) {
      result.shapesToUpdate.forEach(({ id, updates }) => updateShape(id, updates));
    }

    // Delete shapes
    if (result.shapesToDelete) {
      result.shapesToDelete.forEach((id) => deleteShape(id));
    }

    // Update command state
    if (result.newState) {
      setCommandState((prev) => ({ ...prev, ...result.newState }));

      // If command ended, deselect and reset
      if (result.newState.phase === 'idle' && result.newState.activeCommand === null) {
        deselectAll();
      }
    }

    // Open print dialog if requested
    if (result.openPrintDialog) {
      setPrintDialogOpen(true);
    }

    // If command should continue (like COPY multiple mode)
    if (!result.continue && result.newState?.activeCommand === null) {
      // Reset to initial state
      setCommandState(createInitialCommandState());
    }
  }, [addMessage, addShape, updateShape, deleteShape, deselectAll]);

  // Create shapes
  const createLine = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const lineShape: LineShape = {
        id: generateId(),
        type: 'line',
        layerId: activeLayerId,
        style: { ...currentStyle },
        visible: true,
        locked: false,
        start,
        end,
      };
      addShape(lineShape);
    },
    [activeLayerId, currentStyle, addShape]
  );

  const createRectangle = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const width = end.x - start.x;
      const height = end.y - start.y;
      const rectShape: RectangleShape = {
        id: generateId(),
        type: 'rectangle',
        layerId: activeLayerId,
        style: { ...currentStyle },
        visible: true,
        locked: false,
        topLeft: {
          x: width > 0 ? start.x : end.x,
          y: height > 0 ? start.y : end.y,
        },
        width: Math.abs(width),
        height: Math.abs(height),
        rotation: 0,
      };
      addShape(rectShape);
    },
    [activeLayerId, currentStyle, addShape]
  );

  const createCircle = useCallback(
    (center: { x: number; y: number }, radius: number) => {
      const circleShape: CircleShape = {
        id: generateId(),
        type: 'circle',
        layerId: activeLayerId,
        style: { ...currentStyle },
        visible: true,
        locked: false,
        center,
        radius,
      };
      addShape(circleShape);
    },
    [activeLayerId, currentStyle, addShape]
  );

  // Handle option click (for drawing tools)
  const handleDrawingOption = useCallback(
    (option: DrawingOption) => {
      switch (option) {
        case 'Undo':
          undoDrawingPoint();
          addMessage('*Undo*');
          break;

        case 'Close':
          if (activeTool === 'line' && drawingPoints.length >= 2) {
            const firstPoint = drawingPoints[0];
            const lastPoint = drawingPoints[drawingPoints.length - 1];
            createLine(lastPoint, firstPoint);
            addMessage('Line closed');
            clearDrawingPoints();
            setDrawingPreview(null);
          }
          break;

        case 'Cancel':
          clearDrawingPoints();
          setDrawingPreview(null);
          addMessage('*Cancel*');
          break;
      }
    },
    [
      activeTool,
      drawingPoints,
      undoDrawingPoint,
      clearDrawingPoints,
      setDrawingPreview,
      createLine,
      addMessage,
    ]
  );

  // Handle option click (for commands)
  const handleCommandOption = useCallback(
    (option: string) => {
      const input: CommandInput = { type: 'option', option };
      const result = processCommandInput(commandState, input, shapes);
      applyCommandResult(result);
    },
    [commandState, shapes, applyCommandResult]
  );

  // Handle option click (generic)
  const handleOption = useCallback(
    (option: string) => {
      if (hasActiveCommand) {
        handleCommandOption(option);
      } else {
        handleDrawingOption(option as DrawingOption);
      }
    },
    [hasActiveCommand, handleCommandOption, handleDrawingOption]
  );

  // Handle command input
  const handleCommand = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      const lowerInput = trimmed.toLowerCase();

      // If there's an active command, process input through command system
      if (hasActiveCommand) {
        let cmdInput: CommandInput;

        // Check if it's an option
        const matchedOption = commandState.options?.find(
          (o) => o.toLowerCase() === lowerInput || o.toLowerCase().startsWith(lowerInput)
        );

        if (matchedOption) {
          cmdInput = { type: 'option', option: matchedOption };
        } else if (trimmed === '') {
          cmdInput = { type: 'enter' };
        } else {
          // Try parsing as number (value)
          const numValue = parseFloat(trimmed);
          if (!isNaN(numValue) && trimmed.match(/^-?[\d.]+$/)) {
            cmdInput = { type: 'value', value: numValue };
          } else {
            // Try parsing as coordinate
            const lastPoint = commandState.basePoint || { x: 0, y: 0 };
            const parsed = parseCoordinateInput(trimmed, lastPoint);
            if (parsed) {
              cmdInput = { type: 'point', point: parsed.point };
            } else {
              // Treat as text
              cmdInput = { type: 'text', text: trimmed };
            }
          }
        }

        const result = processCommandInput(commandState, cmdInput, shapes);
        applyCommandResult(result);
        return;
      }

      // Check for tool/command shortcuts
      const commandName = resolveCommandName(trimmed);
      if (commandName) {
        // Check if it's a drawing tool
        const drawingTools = ['LINE', 'RECTANGLE', 'CIRCLE', 'ARC', 'POLYLINE', 'ELLIPSE'];
        if (drawingTools.includes(commandName)) {
          const toolMap: Record<string, 'line' | 'rectangle' | 'circle' | 'arc' | 'polyline' | 'ellipse'> = {
            LINE: 'line',
            RECTANGLE: 'rectangle',
            CIRCLE: 'circle',
            ARC: 'arc',
            POLYLINE: 'polyline',
            ELLIPSE: 'ellipse',
          };
          setActiveTool(toolMap[commandName] || 'select');
          addMessage(commandName);
          return;
        }

        // Start modify command
        const newState = startCommand(commandName, createInitialCommandState(), selectedShapeIds);
        setCommandState(newState);
        addMessage(commandName);
        return;
      }

      // Legacy tool commands
      if (!isDrawing) {
        switch (lowerInput) {
          case 'l':
          case 'line':
            setActiveTool('line');
            addMessage('LINE');
            return;
          case 'rec':
          case 'rectang':
          case 'rectangle':
            setActiveTool('rectangle');
            addMessage('RECTANG');
            return;
          case 'c':
          case 'circle':
            setActiveTool('circle');
            addMessage('CIRCLE');
            return;
          case 'p':
          case 'pan':
            setActiveTool('pan');
            addMessage('PAN');
            return;
        }
      }

      // Check for drawing options
      switch (lowerInput) {
        case 'u':
        case 'undo':
          if (isDrawing && drawingPoints.length > 0) {
            handleDrawingOption('Undo');
            return;
          }
          break;

        case 'close':
          if (activeTool === 'line' && drawingPoints.length >= 2) {
            handleDrawingOption('Close');
            return;
          }
          break;

        case '':
          // Enter with no input - end drawing or cancel
          if (isDrawing) {
            clearDrawingPoints();
            setDrawingPreview(null);
            addMessage('');
            return;
          }
          break;
      }

      // Try to parse as coordinates for drawing tools
      if (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle') {
        const lastPoint = drawingPoints.length > 0 ? drawingPoints[drawingPoints.length - 1] : null;
        const parsed = parseCoordinateInput(trimmed, lastPoint);

        if (parsed) {
          const point = parsed.point;

          switch (activeTool) {
            case 'line':
              if (drawingPoints.length === 0) {
                addDrawingPoint(point);
                addMessage(`First point: ${point.x.toFixed(2)}, ${point.y.toFixed(2)}`);
              } else {
                const prevPoint = drawingPoints[drawingPoints.length - 1];
                createLine(prevPoint, point);
                addDrawingPoint(point);
                addMessage(`Line to: ${point.x.toFixed(2)}, ${point.y.toFixed(2)}`);
              }
              break;

            case 'rectangle':
              if (drawingPoints.length === 0) {
                addDrawingPoint(point);
                addMessage(`First corner: ${point.x.toFixed(2)}, ${point.y.toFixed(2)}`);
              } else {
                const startPoint = drawingPoints[0];
                createRectangle(startPoint, point);
                clearDrawingPoints();
                setDrawingPreview(null);
                addMessage(`Rectangle created`);
              }
              break;

            case 'circle':
              if (drawingPoints.length === 0) {
                addDrawingPoint(point);
                addMessage(`Center: ${point.x.toFixed(2)}, ${point.y.toFixed(2)}`);
              } else {
                const center = drawingPoints[0];
                let radius: number;

                // Check if input was just a number (radius)
                const radiusValue = parseFloat(trimmed);
                if (!isNaN(radiusValue) && trimmed.match(/^[\d.]+$/)) {
                  radius = radiusValue;
                } else {
                  // Calculate radius from point
                  const dx = point.x - center.x;
                  const dy = point.y - center.y;
                  radius = Math.sqrt(dx * dx + dy * dy);
                }

                createCircle(center, radius);
                clearDrawingPoints();
                setDrawingPreview(null);
                addMessage(`Circle created with radius: ${radius.toFixed(2)}`);
              }
              break;
          }
          return;
        }
      }

      // Unknown command
      if (trimmed) {
        addMessage(`Unknown command: ${trimmed}`);
      }
    },
    [
      hasActiveCommand,
      commandState,
      shapes,
      selectedShapeIds,
      isDrawing,
      activeTool,
      drawingPoints,
      addDrawingPoint,
      clearDrawingPoints,
      setDrawingPreview,
      createLine,
      createRectangle,
      createCircle,
      handleDrawingOption,
      applyCommandResult,
      addMessage,
      setActiveTool,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommand(currentCommand);
      setCurrentCommand('');
      setHistoryIndex(-1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentCommand('');
      }
    } else if (e.key === 'Escape') {
      if (hasActiveCommand) {
        const input: CommandInput = { type: 'escape' };
        const result = processCommandInput(commandState, input, shapes);
        applyCommandResult(result);
        setCommandState(createInitialCommandState());
      } else if (isDrawing) {
        handleDrawingOption('Cancel');
      }
      setCurrentCommand('');
      setHistoryIndex(-1);
    }
  };

  // Watch for pending commands from ToolPalette
  useEffect(() => {
    if (pendingCommand) {
      handleCommand(pendingCommand);
      setPendingCommand(null);
    }
  }, [pendingCommand, handleCommand, setPendingCommand]);

  // Update hasActiveModifyCommand and commandIsSelecting when command state changes
  useEffect(() => {
    setHasActiveModifyCommand(hasActiveCommand);
    setCommandIsSelecting(hasActiveCommand && commandState.phase === 'selecting');
    if (!hasActiveCommand) {
      setCommandPreviewShapes([]);
    }
  }, [hasActiveCommand, commandState.phase, setHasActiveModifyCommand, setCommandIsSelecting, setCommandPreviewShapes]);

  // Update command preview shapes on mouse move
  useEffect(() => {
    if (!hasActiveCommand) {
      return;
    }

    // Convert screen coordinates to world coordinates
    const worldX = (mousePosition.x - viewport.offsetX) / viewport.zoom;
    const worldY = (mousePosition.y - viewport.offsetY) / viewport.zoom;

    // Snap to grid if enabled
    let snappedX = worldX;
    let snappedY = worldY;
    if (snapEnabled) {
      snappedX = Math.round(worldX / gridSize) * gridSize;
      snappedY = Math.round(worldY / gridSize) * gridSize;
    }

    const currentPoint = { x: snappedX, y: snappedY };
    const previewShapes = getCommandPreview(commandState, currentPoint, shapes);
    setCommandPreviewShapes(previewShapes);
  }, [hasActiveCommand, mousePosition, viewport, commandState, shapes, snapEnabled, gridSize, setCommandPreviewShapes]);

  // Process pending points from canvas clicks
  useEffect(() => {
    if (pendingCommandPoint && hasActiveCommand) {
      const input: CommandInput = { type: 'point', point: pendingCommandPoint };
      const result = processCommandInput(commandState, input, shapes);
      applyCommandResult(result);
      setPendingCommandPoint(null);
    }
  }, [pendingCommandPoint, hasActiveCommand, commandState, shapes, applyCommandResult, setPendingCommandPoint]);

  // Process pending selections from canvas clicks during command selection phase
  useEffect(() => {
    if (pendingCommandSelection && hasActiveCommand && commandState.phase === 'selecting') {
      const input: CommandInput = { type: 'selection', ids: pendingCommandSelection };
      const result = processCommandInput(commandState, input, shapes);
      applyCommandResult(result);
      setPendingCommandSelection(null);
    }
  }, [pendingCommandSelection, hasActiveCommand, commandState, shapes, applyCommandResult, setPendingCommandSelection]);

  // Auto-scroll history
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on key press
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      // Focus command line on typing
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const options = getOptions();
  const prompt = getPrompt();

  return (
    <div className="bg-cad-bg border-t border-cad-border flex flex-col">
      {/* Message History */}
      <div
        ref={historyRef}
        className="h-16 overflow-y-auto px-2 py-1 font-mono text-xs text-cad-text-dim"
      >
        {messages.map((msg, i) => (
          <div key={i} className="leading-tight">
            {msg}
          </div>
        ))}
      </div>

      {/* Command Input */}
      <div className="h-8 flex items-center px-2 border-t border-cad-border">
        <span className="text-cad-accent mr-2 font-mono text-sm whitespace-nowrap">
          {prompt}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={currentCommand}
          onChange={(e) => setCurrentCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent border-none outline-none text-cad-text font-mono text-sm min-w-0"
          placeholder={
            hasActiveCommand
              ? 'Enter value, coordinates, or select option'
              : isDrawing
              ? 'Enter coordinates (e.g., 100,50 or @50,25 or @100<45)'
              : ''
          }
          autoComplete="off"
          spellCheck={false}
        />

        {/* Option Buttons */}
        {options.length > 0 && (
          <div className="flex items-center gap-1 ml-2 flex-wrap">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => handleOption(option)}
                className="px-2 py-0.5 text-xs font-mono bg-cad-surface hover:bg-cad-accent hover:text-cad-bg rounded border border-cad-border transition-colors"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
