import { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../state/appStore';
import { CADRenderer } from '../../engine/renderer/CADRenderer';
import { useCanvasEvents } from '../../hooks/useCanvasEvents';
import { useDrawingKeyboard } from '../../hooks/useDrawingKeyboard';
import { DynamicInput } from '../DynamicInput/DynamicInput';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CADRenderer | null>(null);

  const {
    shapes,
    selectedShapeIds,
    viewport,
    gridVisible,
    gridSize,
    setCanvasSize,
    setMousePosition,
    activeTool,
    drawingPreview,
    currentStyle,
    selectionBox,
    commandPreviewShapes,
  } = useAppStore();

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    rendererRef.current = new CADRenderer(canvas);

    return () => {
      rendererRef.current?.dispose();
    };
  }, []);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        setCanvasSize({ width, height });
        rendererRef.current?.resize(width, height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [setCanvasSize]);

  // Render loop
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.render({
      shapes,
      selectedShapeIds,
      viewport,
      gridVisible,
      gridSize,
      drawingPreview,
      currentStyle,
      selectionBox,
      commandPreviewShapes,
    });
  }, [shapes, selectedShapeIds, viewport, gridVisible, gridSize, drawingPreview, currentStyle, selectionBox, commandPreviewShapes]);

  // Handle mouse events
  const { handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleClick, handleContextMenu } =
    useCanvasEvents(canvasRef);

  // Handle keyboard shortcuts for drawing
  useDrawingKeyboard();

  // Track mouse position
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePosition({ x, y });
      handleMouseMove(e);
    },
    [setMousePosition, handleMouseMove]
  );

  // Cursor based on active tool
  const getCursor = () => {
    switch (activeTool) {
      case 'pan':
        return 'cursor-grab';
      case 'select':
        return 'cursor-default';
      default:
        return 'cursor-crosshair';
    }
  };

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-cad-bg">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${getCursor()}`}
        onMouseDown={handleMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />

      {/* Dynamic Input Tooltip */}
      <DynamicInput />

      {/* Origin indicator */}
      <div className="absolute bottom-4 left-4 text-xs text-cad-text-dim pointer-events-none">
        <div className="flex items-center gap-1">
          <div className="w-8 h-0.5 bg-red-500" />
          <span>X</span>
        </div>
        <div className="flex items-center gap-1 -mt-2">
          <div className="w-0.5 h-8 bg-green-500" />
          <span className="-ml-2 mt-6">Y</span>
        </div>
      </div>
    </div>
  );
}
