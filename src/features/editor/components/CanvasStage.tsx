import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { defaultPalette } from "../../palette/palette";
import type {
  BeadGrid,
  CanvasSize,
  EditorTool,
  RectSelection,
  ViewTransform,
} from "../../../shared/types/project";
import { EMPTY_CELL } from "../../../shared/types/project";

type HoverInfo = {
  x: number;
  y: number;
  colorIndex: number;
};

type CanvasStageProps = {
  activeTool: EditorTool;
  beadGrid: BeadGrid | null;
  canvas: CanvasSize;
  currentSelection: RectSelection | null;
  themeKey?: string;
  onCellAction: (
    x: number,
    y: number,
    mode?: "paint" | "erase" | "picker" | "fill",
  ) => void;
  onHoverChange: (hover: HoverInfo | null) => void;
  onSelectionChange: (selection: RectSelection | null) => void;
  onSelectionMove: (selection: RectSelection, deltaX: number, deltaY: number) => void;
  onViewportChange: (transform: Partial<ViewTransform>) => void;
  stageViewport: ViewTransform;
  showGrid: boolean;
};

const CANVAS_SIZE = 1600;
const RULER_SIZE = 50;
const GRID_MAJOR_STEP = 10;
const PAPER_PADDING = 0;
const MAX_DEVICE_PIXEL_RATIO = 3;

type StageTheme = {
  frameFill: string;
  rulerFill: string;
  rulerBorder: string;
  rulerText: string;
  paperFill: string;
  gridMajor: string;
  gridMinor: string;
  selectionFill: string;
  selectionStroke: string;
  hoverPaint: string;
  hoverErase: string;
  hoverFill: string;
};

export const CanvasStage = forwardRef<HTMLCanvasElement, CanvasStageProps>(
  function CanvasStage(
    {
      activeTool,
      beadGrid,
      canvas,
      currentSelection,
      themeKey,
      onCellAction,
      onHoverChange,
      onSelectionChange,
      onSelectionMove,
      onViewportChange,
      stageViewport,
      showGrid,
    },
    forwardedRef,
  ) {
    const shellRef = useRef<HTMLDivElement | null>(null);
    const stageSurfaceRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [displaySize, setDisplaySize] = useState({ width: 640, height: 640 });
    const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
    const [selectionRect, setSelectionRect] = useState<RectSelection | null>(currentSelection);
    const [isPanning, setIsPanning] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const panStateRef = useRef<{
      pointerId: number;
      startX: number;
      startY: number;
      originOffsetX: number;
      originOffsetY: number;
    } | null>(null);
    const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const gestureStateRef = useRef<{
      pointerIds: [number, number];
      originScale: number;
      originOffsetX: number;
      originOffsetY: number;
      originDistance: number;
      originMidpoint: { x: number; y: number };
    } | null>(null);
    const selectStateRef = useRef<{
      pointerId: number;
      startCell: { x: number; y: number };
      mode: "create" | "move";
      originSelection: RectSelection | null;
      lastDeltaX: number;
      lastDeltaY: number;
    } | null>(null);
    const stageTheme = useMemo(() => resolveStageTheme(themeKey), [themeKey]);
    const overlayMetrics = useMemo(() => {
      const paperLeft = RULER_SIZE;
      const paperTop = RULER_SIZE;
      const paperRight = CANVAS_SIZE - RULER_SIZE;
      const paperBottom = CANVAS_SIZE - RULER_SIZE;
      const gridWidth = paperRight - paperLeft - PAPER_PADDING * 2;
      const gridHeight = paperBottom - paperTop - PAPER_PADDING * 2;
      const cellWidth = gridWidth / canvas.width;
      const cellHeight = gridHeight / canvas.height;
      const totalScreenScale = Math.max(
        0.01,
        (displaySize.width / CANVAS_SIZE) * stageViewport.scale,
      );

      return {
        paperLeft,
        paperTop,
        paperRight,
        paperBottom,
        gridWidth,
        gridHeight,
        cellWidth,
        cellHeight,
        totalScreenScale,
        visibleCellWidth: cellWidth * totalScreenScale,
        visibleCellHeight: cellHeight * totalScreenScale,
      };
    }, [canvas.height, canvas.width, displaySize.width, stageViewport.scale]);

    useImperativeHandle(
      forwardedRef,
      () => canvasRef.current as HTMLCanvasElement,
      [],
    );

    useLayoutEffect(() => {
      setSelectionRect(currentSelection);
    }, [currentSelection]);

    useLayoutEffect(() => {
      const shellNode = shellRef.current;
      if (!shellNode) {
        return;
      }

      const updateSize = (width: number, height: number) => {
        const usableWidth = Math.max(240, width - 24);
        const usableHeight = Math.max(240, height - 24);
        const scale = Math.min(usableWidth / CANVAS_SIZE, usableHeight / CANVAS_SIZE);

        setDisplaySize({
          width: Math.max(240, Math.floor(CANVAS_SIZE * scale)),
          height: Math.max(240, Math.floor(CANVAS_SIZE * scale)),
        });
      };

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        updateSize(entry.contentRect.width, entry.contentRect.height);
      });

      resizeObserver.observe(shellNode);
      updateSize(shellNode.clientWidth, shellNode.clientHeight);

      return () => resizeObserver.disconnect();
    }, []);

    useLayoutEffect(() => {
      const shellNode = shellRef.current;
      if (!shellNode) {
        return;
      }

      function handleNativeWheel(event: WheelEvent) {
        event.preventDefault();

        const node = shellRef.current;
        if (!node) {
          return;
        }

        const rect = node.getBoundingClientRect();
        const pointerX = event.clientX - rect.left - rect.width / 2;
        const pointerY = event.clientY - rect.top - rect.height / 2;
        const currentScale = stageViewport.scale;
        const scaleDelta = event.deltaY < 0 ? 1.08 : 0.92;
        const nextScale = clampNumber(currentScale * scaleDelta, 0.35, 8);
        const ratio = nextScale / currentScale;

        onViewportChange({
          scale: nextScale,
          offsetX: pointerX - ratio * (pointerX - stageViewport.offsetX),
          offsetY: pointerY - ratio * (pointerY - stageViewport.offsetY),
        });
      }

      shellNode.addEventListener("wheel", handleNativeWheel, { passive: false });

      return () => {
        shellNode.removeEventListener("wheel", handleNativeWheel);
      };
    }, [onViewportChange, stageViewport.offsetX, stageViewport.offsetY, stageViewport.scale]);

    useLayoutEffect(() => {
      draw();
    }, [activeTool, beadGrid, canvas, hoverCell, selectionRect, showGrid, stageTheme, stageViewport]);

    useLayoutEffect(() => {
      function handleKeyDown(event: KeyboardEvent) {
        if (event.code === "Space") {
          setIsSpacePressed(true);
          event.preventDefault();
        }
      }

      function handleKeyUp(event: KeyboardEvent) {
        if (event.code === "Space") {
          setIsSpacePressed(false);
        }
      }

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }, []);

    function draw() {
      const canvasNode = canvasRef.current;
      if (!canvasNode) {
        return;
      }

      const devicePixelRatio =
        typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
      const targetWidth = Math.max(1, Math.round(CANVAS_SIZE * devicePixelRatio));
      const targetHeight = Math.max(1, Math.round(CANVAS_SIZE * devicePixelRatio));

      if (canvasNode.width !== targetWidth || canvasNode.height !== targetHeight) {
        canvasNode.width = targetWidth;
        canvasNode.height = targetHeight;
      }

      const context = canvasNode.getContext("2d");
      if (!context) {
        return;
      }

      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.imageSmoothingEnabled = false;

      const {
        paperLeft,
        paperTop,
        paperRight,
        paperBottom,
        cellWidth,
        cellHeight,
      } = overlayMetrics;
      context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      context.fillStyle = stageTheme.frameFill;
      context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      drawPaper(context, paperLeft, paperTop, paperRight - paperLeft, paperBottom - paperTop);
      drawGridFill(context, beadGrid, cellWidth, cellHeight, paperLeft, paperTop);

      drawSelectionRect(context, selectionRect, cellWidth, cellHeight, paperLeft, paperTop);
      drawHoverCell(context, hoverCell, cellWidth, cellHeight, paperLeft, paperTop);
    }

    function drawPaper(
      context: CanvasRenderingContext2D,
      left: number,
      top: number,
      width: number,
      height: number,
    ) {
      context.fillStyle = stageTheme.paperFill;
      context.fillRect(left, top, width, height);
    }

    function drawGridFill(
      context: CanvasRenderingContext2D,
      grid: BeadGrid | null,
      cellWidth: number,
      cellHeight: number,
      paperLeft: number,
      paperTop: number,
    ) {
      if (!grid) {
        return;
      }

      for (let y = 0; y < grid.height; y += 1) {
        for (let x = 0; x < grid.width; x += 1) {
          const colorIndex = grid.cells[y * grid.width + x];
          if (colorIndex === EMPTY_CELL) {
            continue;
          }

          const color = defaultPalette[colorIndex] ?? defaultPalette[0];
          context.fillStyle = color.hex;
          context.fillRect(
            paperLeft + x * cellWidth,
            paperTop + y * cellHeight,
            cellWidth,
            cellHeight,
          );
        }
      }
    }


    function drawSelectionRect(
      context: CanvasRenderingContext2D,
      selection: RectSelection | null,
      cellWidth: number,
      cellHeight: number,
      paperLeft: number,
      paperTop: number,
    ) {
      if (!selection) {
        return;
      }

      const left = Math.min(selection.startX, selection.endX);
      const top = Math.min(selection.startY, selection.endY);
      const right = Math.max(selection.startX, selection.endX);
      const bottom = Math.max(selection.startY, selection.endY);

      context.save();
      context.fillStyle = stageTheme.selectionFill;
      context.strokeStyle = stageTheme.selectionStroke;
      context.lineWidth = 2;
      context.fillRect(
        paperLeft + left * cellWidth,
        paperTop + top * cellHeight,
        (right - left + 1) * cellWidth,
        (bottom - top + 1) * cellHeight,
      );
      context.strokeRect(
        paperLeft + left * cellWidth + 1,
        paperTop + top * cellHeight + 1,
        (right - left + 1) * cellWidth - 2,
        (bottom - top + 1) * cellHeight - 2,
      );
      context.restore();
    }

    function drawHoverCell(
      context: CanvasRenderingContext2D,
      cell: { x: number; y: number } | null,
      cellWidth: number,
      cellHeight: number,
      paperLeft: number,
      paperTop: number,
    ) {
      if (!cell || activeTool === "select" || activeTool === "pan") {
        return;
      }

      context.save();
      context.strokeStyle =
        activeTool === "erase"
          ? stageTheme.hoverErase
          : activeTool === "fill"
            ? stageTheme.hoverFill
            : stageTheme.hoverPaint;
      context.lineWidth = 2;
      context.strokeRect(
        paperLeft + cell.x * cellWidth + 1,
        paperTop + cell.y * cellHeight + 1,
        Math.max(1, cellWidth - 2),
        Math.max(1, cellHeight - 2),
      );
      context.restore();
    }

    function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
      event.preventDefault();

      const cell = getCellFromPointer(event.clientX, event.clientY);
      if (!cell) {
        return;
      }

      onCellAction(cell.x, cell.y, "picker");
    }

    function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
      activePointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (event.pointerType === "touch" && activePointersRef.current.size >= 2) {
        const gestureState = createGestureState(
          activePointersRef.current,
          stageViewport,
          shellRef.current,
        );
        if (gestureState) {
          panStateRef.current = null;
          selectStateRef.current = null;
          gestureStateRef.current = gestureState;
          setIsPanning(true);
          event.preventDefault();
        }
        return;
      }

      const shouldPan = isSpacePressed || activeTool === "pan" || event.button === 1;

      if (shouldPan) {
        panStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originOffsetX: stageViewport.offsetX,
          originOffsetY: stageViewport.offsetY,
        };
        setIsPanning(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }

      const cell = getCellFromPointer(event.clientX, event.clientY);
      if (!cell) {
        return;
      }

      updateHover(cell);

      if (event.button === 2 || event.altKey) {
        onCellAction(cell.x, cell.y, "picker");
        return;
      }

      if (activeTool === "picker") {
        onCellAction(cell.x, cell.y, "picker");
        return;
      }

      if (activeTool === "fill") {
        onCellAction(cell.x, cell.y, "fill");
        return;
      }

      if (activeTool === "select") {
        const insideExistingSelection = selectionRect
          ? isCellInsideSelection(cell.x, cell.y, selectionRect)
          : false;
        const rect =
          insideExistingSelection && selectionRect
            ? selectionRect
            : {
                startX: cell.x,
                startY: cell.y,
                endX: cell.x,
                endY: cell.y,
              };
        selectStateRef.current = {
          pointerId: event.pointerId,
          startCell: cell,
          mode: insideExistingSelection ? "move" : "create",
          originSelection: selectionRect,
          lastDeltaX: 0,
          lastDeltaY: 0,
        };
        setSelectionRect(rect);
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }

      if (activeTool === "erase") {
        onCellAction(cell.x, cell.y, "erase");
        return;
      }

      onCellAction(cell.x, cell.y, "paint");
    }

    function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
      if (activePointersRef.current.has(event.pointerId)) {
        activePointersRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
      }

      const gestureState = gestureStateRef.current;
      if (gestureState && activePointersRef.current.size >= 2) {
        const nextTransform = resolveGestureTransform(
          gestureState,
          activePointersRef.current,
          shellRef.current,
        );
        if (nextTransform) {
          onViewportChange(nextTransform);
          event.preventDefault();
        }
        return;
      }

      const cell = getCellFromPointer(event.clientX, event.clientY);
      updateHover(cell);

      const panState = panStateRef.current;
      if (panState && panState.pointerId === event.pointerId) {
        onViewportChange({
          offsetX: panState.originOffsetX + (event.clientX - panState.startX),
          offsetY: panState.originOffsetY + (event.clientY - panState.startY),
        });
        return;
      }

      const selectState = selectStateRef.current;
      if (selectState && selectState.pointerId === event.pointerId && cell) {
        if (selectState.mode === "move" && selectState.originSelection) {
          const clampedDelta = clampSelectionDelta(
            selectState.originSelection,
            cell.x - selectState.startCell.x,
            cell.y - selectState.startCell.y,
            canvas.width,
            canvas.height,
          );
          selectState.lastDeltaX = clampedDelta.deltaX;
          selectState.lastDeltaY = clampedDelta.deltaY;
          setSelectionRect({
            startX: selectState.originSelection.startX + clampedDelta.deltaX,
            startY: selectState.originSelection.startY + clampedDelta.deltaY,
            endX: selectState.originSelection.endX + clampedDelta.deltaX,
            endY: selectState.originSelection.endY + clampedDelta.deltaY,
          });
          return;
        }

        setSelectionRect({
          startX: selectState.startCell.x,
          startY: selectState.startCell.y,
          endX: cell.x,
          endY: cell.y,
        });
        return;
      }

      if (!cell || event.buttons !== 1 || activeTool === "picker" || activeTool === "fill") {
        return;
      }

      if (activeTool === "erase") {
        onCellAction(cell.x, cell.y, "erase");
        return;
      }

      if (activeTool === "paint") {
        onCellAction(cell.x, cell.y, "paint");
      }
    }

    function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
      activePointersRef.current.delete(event.pointerId);

      const gestureState = gestureStateRef.current;
      if (gestureState) {
        const [pointerA, pointerB] = gestureState.pointerIds;
        if (
          event.pointerId === pointerA ||
          event.pointerId === pointerB ||
          activePointersRef.current.size < 2
        ) {
          gestureStateRef.current = null;
          setIsPanning(false);
        }
      }

      const panState = panStateRef.current;
      if (panState && panState.pointerId === event.pointerId) {
        panStateRef.current = null;
        setIsPanning(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }

      const selectState = selectStateRef.current;
      if (selectState && selectState.pointerId === event.pointerId) {
        const rect = selectionRect;
        selectStateRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);

        if (
          selectState.mode === "move" &&
          selectState.originSelection &&
          (selectState.lastDeltaX !== 0 || selectState.lastDeltaY !== 0)
        ) {
          onSelectionMove(
            selectState.originSelection,
            selectState.lastDeltaX,
            selectState.lastDeltaY,
          );
          return;
        }

        if (rect && selectState.mode === "create") {
          onSelectionChange(rect);
        }
      }
    }

    function handlePointerLeave() {
      setHoverCell(null);
      onHoverChange(null);
    }

    function updateHover(cell: { x: number; y: number } | null) {
      setHoverCell(cell);

      if (!cell) {
        onHoverChange(null);
        return;
      }

      const colorIndex = beadGrid
        ? beadGrid.cells[cell.y * beadGrid.width + cell.x]
        : EMPTY_CELL;

      onHoverChange({
        x: cell.x,
        y: cell.y,
        colorIndex,
      });
    }

    function getCellFromPointer(clientX: number, clientY: number) {
      const stageNode = stageSurfaceRef.current;
      if (!stageNode) {
        return null;
      }

      const rect = stageNode.getBoundingClientRect();
      const localX = ((clientX - rect.left) / rect.width) * CANVAS_SIZE;
      const localY = ((clientY - rect.top) / rect.height) * CANVAS_SIZE;
      const paperLeft = RULER_SIZE + PAPER_PADDING;
      const paperTop = RULER_SIZE + PAPER_PADDING;
      const paperRight = CANVAS_SIZE - RULER_SIZE - PAPER_PADDING;
      const paperBottom = CANVAS_SIZE - RULER_SIZE - PAPER_PADDING;

      if (
        localX < paperLeft ||
        localY < paperTop ||
        localX > paperRight ||
        localY > paperBottom
      ) {
        return null;
      }

      const normalizedX = (localX - paperLeft) / (paperRight - paperLeft);
      const normalizedY = (localY - paperTop) / (paperBottom - paperTop);

      return {
        x: clampIndex(Math.floor(normalizedX * canvas.width), canvas.width),
        y: clampIndex(Math.floor(normalizedY * canvas.height), canvas.height),
      };
    }

    const stageCursor = isPanning
      ? " canvas-stage-shell--dragging"
      : isSpacePressed
        ? " canvas-stage-shell--pan"
        : activeTool === "pan"
          ? " canvas-stage-shell--pan"
          : activeTool === "picker"
          ? " canvas-stage-shell--picker"
          : activeTool === "erase"
            ? " canvas-stage-shell--erase"
            : activeTool === "fill"
              ? " canvas-stage-shell--fill"
              : activeTool === "select"
                ? " canvas-stage-shell--select"
                : " canvas-stage-shell--paint";

    return (
      <div
        ref={shellRef}
        className={`canvas-stage-shell${stageCursor}`}
        onContextMenu={handleContextMenu}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          ref={stageSurfaceRef}
          className="canvas-stage-surface"
          style={{
            width: `${displaySize.width}px`,
            height: `${displaySize.height}px`,
            transform: `translate(${stageViewport.offsetX}px, ${stageViewport.offsetY}px) scale(${stageViewport.scale})`,
          }}
        >
          <canvas
            ref={canvasRef}
            className="canvas-stage"
            style={{
              width: "100%",
              height: "100%",
            }}
          />
          <svg
            className="canvas-stage-overlay"
            viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
            aria-hidden="true"
          >
            <StageOverlay
              canvas={canvas}
              metrics={overlayMetrics}
              showGrid={showGrid}
              theme={stageTheme}
            />
          </svg>
        </div>
      </div>
    );
  },
);

function clampIndex(value: number, limit: number) {
  return Math.min(limit - 1, Math.max(0, value));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function StageOverlay({
  canvas,
  metrics,
  showGrid,
  theme,
}: {
  canvas: CanvasSize;
  metrics: {
    paperLeft: number;
    paperTop: number;
    paperRight: number;
    paperBottom: number;
    gridWidth: number;
    gridHeight: number;
    cellWidth: number;
    cellHeight: number;
    totalScreenScale: number;
    visibleCellWidth: number;
    visibleCellHeight: number;
  };
  showGrid: boolean;
  theme: StageTheme;
}) {
  const {
    paperLeft,
    paperTop,
    paperRight,
    paperBottom,
    gridWidth,
    gridHeight,
    cellWidth,
    cellHeight,
    totalScreenScale,
    visibleCellWidth,
    visibleCellHeight,
  } = metrics;
  const rulerFontSize = clampNumber(
    clampNumber(Math.min(visibleCellWidth, visibleCellHeight) * 0.52, 10, 24) /
      totalScreenScale,
    12,
    42,
  );
  const minorStroke = clampNumber(
    Math.min(visibleCellWidth, visibleCellHeight) / 26,
    0.95,
    1.35,
  );
  const majorStroke = clampNumber(
    Math.min(visibleCellWidth, visibleCellHeight) / 18,
    1.2,
    1.9,
  );
  const borderThickness = clampNumber(
    Math.min(visibleCellWidth, visibleCellHeight) / 10,
    2.6,
    4.4,
  ) / totalScreenScale;

  return (
    <>
      <rect x={paperLeft} y={0} width={gridWidth} height={RULER_SIZE} fill={theme.rulerFill} />
      <rect
        x={paperLeft}
        y={paperBottom}
        width={gridWidth}
        height={RULER_SIZE}
        fill={theme.rulerFill}
      />
      <rect x={0} y={paperTop} width={RULER_SIZE} height={gridHeight} fill={theme.rulerFill} />
      <rect
        x={paperRight}
        y={paperTop}
        width={RULER_SIZE}
        height={gridHeight}
        fill={theme.rulerFill}
      />
      <rect x={0} y={0} width={RULER_SIZE} height={RULER_SIZE} fill={theme.rulerFill} />
      <rect
        x={paperRight}
        y={0}
        width={RULER_SIZE}
        height={RULER_SIZE}
        fill={theme.rulerFill}
      />
      <rect
        x={0}
        y={paperBottom}
        width={RULER_SIZE}
        height={RULER_SIZE}
        fill={theme.rulerFill}
      />
      <rect
        x={paperRight}
        y={paperBottom}
        width={RULER_SIZE}
        height={RULER_SIZE}
        fill={theme.rulerFill}
      />

      {showGrid
        ? Array.from({ length: canvas.width + 1 }, (_, index) => {
            const x = paperLeft + index * cellWidth;
            const isMajor = index % GRID_MAJOR_STEP === 0;
            return (
              <line
                key={`vx-${index}`}
                x1={x}
                y1={paperTop}
                x2={x}
                y2={paperBottom}
                stroke={isMajor ? theme.gridMajor : theme.gridMinor}
                strokeWidth={isMajor ? majorStroke : minorStroke}
                vectorEffect="non-scaling-stroke"
                shapeRendering="crispEdges"
              />
            );
          })
        : null}

      {showGrid
        ? Array.from({ length: canvas.height + 1 }, (_, index) => {
            const y = paperTop + index * cellHeight;
            const isMajor = index % GRID_MAJOR_STEP === 0;
            return (
              <line
                key={`hy-${index}`}
                x1={paperLeft}
                y1={y}
                x2={paperRight}
                y2={y}
                stroke={isMajor ? theme.gridMajor : theme.gridMinor}
                strokeWidth={isMajor ? majorStroke : minorStroke}
                vectorEffect="non-scaling-stroke"
                shapeRendering="crispEdges"
              />
            );
          })
        : null}

      <rect
        x={paperLeft}
        y={paperTop}
        width={gridWidth}
        height={borderThickness}
        fill={theme.rulerBorder}
      />
      <rect
        x={paperLeft}
        y={paperBottom - borderThickness}
        width={gridWidth}
        height={borderThickness}
        fill={theme.rulerBorder}
      />
      <rect
        x={paperLeft}
        y={paperTop}
        width={borderThickness}
        height={gridHeight}
        fill={theme.rulerBorder}
      />
      <rect
        x={paperRight - borderThickness}
        y={paperTop}
        width={borderThickness}
        height={gridHeight}
        fill={theme.rulerBorder}
      />

      {Array.from({ length: canvas.width }, (_, index) => {
        const centerX = paperLeft + index * cellWidth + cellWidth / 2;
        const label = String(index + 1);
        return (
          <g key={`tx-${index}`}>
            <text
              x={centerX}
              y={RULER_SIZE / 2}
              fill={theme.rulerText}
              fontSize={rulerFontSize}
              fontFamily="IBM Plex Mono, monospace"
              textAnchor="middle"
              dominantBaseline="middle"
              lengthAdjust="spacingAndGlyphs"
            >
              {label}
            </text>
            <text
              x={centerX}
              y={paperBottom + RULER_SIZE / 2}
              fill={theme.rulerText}
              fontSize={rulerFontSize}
              fontFamily="IBM Plex Mono, monospace"
              textAnchor="middle"
              dominantBaseline="middle"
              lengthAdjust="spacingAndGlyphs"
            >
              {label}
            </text>
          </g>
        );
      })}

      {Array.from({ length: canvas.height }, (_, index) => {
        const centerY = paperTop + index * cellHeight + cellHeight / 2;
        const label = String(index + 1);
        return (
          <g key={`ty-${index}`}>
            <text
              x={RULER_SIZE / 2}
              y={centerY}
              fill={theme.rulerText}
              fontSize={rulerFontSize}
              fontFamily="IBM Plex Mono, monospace"
              textAnchor="middle"
              dominantBaseline="middle"
              lengthAdjust="spacingAndGlyphs"
            >
              {label}
            </text>
            <text
              x={paperRight + RULER_SIZE / 2}
              y={centerY}
              fill={theme.rulerText}
              fontSize={rulerFontSize}
              fontFamily="IBM Plex Mono, monospace"
              textAnchor="middle"
              dominantBaseline="middle"
              lengthAdjust="spacingAndGlyphs"
            >
              {label}
            </text>
          </g>
        );
      })}
    </>
  );
}

function isCellInsideSelection(x: number, y: number, selection: RectSelection) {
  const left = Math.min(selection.startX, selection.endX);
  const top = Math.min(selection.startY, selection.endY);
  const right = Math.max(selection.startX, selection.endX);
  const bottom = Math.max(selection.startY, selection.endY);

  return x >= left && x <= right && y >= top && y <= bottom;
}

function clampSelectionDelta(
  selection: RectSelection,
  deltaX: number,
  deltaY: number,
  width: number,
  height: number,
) {
  const left = Math.min(selection.startX, selection.endX);
  const top = Math.min(selection.startY, selection.endY);
  const right = Math.max(selection.startX, selection.endX);
  const bottom = Math.max(selection.startY, selection.endY);

  const minDeltaX = -left;
  const maxDeltaX = width - 1 - right;
  const minDeltaY = -top;
  const maxDeltaY = height - 1 - bottom;

  return {
    deltaX: clampNumber(deltaX, minDeltaX, maxDeltaX),
    deltaY: clampNumber(deltaY, minDeltaY, maxDeltaY),
  };
}

function createGestureState(
  pointers: Map<number, { x: number; y: number }>,
  viewport: ViewTransform,
  shellNode: HTMLDivElement | null,
) {
  const pair = getPointerPair(pointers);
  if (!pair || !shellNode) {
    return null;
  }

  const [firstPointer, secondPointer] = pair;
  const midpoint = getShellRelativeMidpoint(firstPointer[1], secondPointer[1], shellNode);

  return {
    pointerIds: [firstPointer[0], secondPointer[0]] as [number, number],
    originScale: viewport.scale,
    originOffsetX: viewport.offsetX,
    originOffsetY: viewport.offsetY,
    originDistance: getPointerDistance(firstPointer[1], secondPointer[1]),
    originMidpoint: midpoint,
  };
}

function resolveGestureTransform(
  gestureState: {
    pointerIds: [number, number];
    originScale: number;
    originOffsetX: number;
    originOffsetY: number;
    originDistance: number;
    originMidpoint: { x: number; y: number };
  },
  pointers: Map<number, { x: number; y: number }>,
  shellNode: HTMLDivElement | null,
) {
  const [firstId, secondId] = gestureState.pointerIds;
  const firstPointer = pointers.get(firstId);
  const secondPointer = pointers.get(secondId);

  if (!firstPointer || !secondPointer || !shellNode) {
    return null;
  }

  const nextMidpoint = getShellRelativeMidpoint(firstPointer, secondPointer, shellNode);
  const distanceRatio = getPointerDistance(firstPointer, secondPointer) / gestureState.originDistance;
  const nextScale = clampNumber(gestureState.originScale * distanceRatio, 0.35, 8);
  const worldX =
    (gestureState.originMidpoint.x - gestureState.originOffsetX) / gestureState.originScale;
  const worldY =
    (gestureState.originMidpoint.y - gestureState.originOffsetY) / gestureState.originScale;

  return {
    scale: nextScale,
    offsetX: nextMidpoint.x - worldX * nextScale,
    offsetY: nextMidpoint.y - worldY * nextScale,
  };
}

function getPointerPair(pointers: Map<number, { x: number; y: number }>) {
  const items = Array.from(pointers.entries());
  if (items.length < 2) {
    return null;
  }

  return [items[0], items[1]] as const;
}

function getPointerDistance(first: { x: number; y: number }, second: { x: number; y: number }) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getShellRelativeMidpoint(
  first: { x: number; y: number },
  second: { x: number; y: number },
  shellNode: HTMLDivElement,
) {
  const rect = shellNode.getBoundingClientRect();
  return {
    x: (first.x + second.x) / 2 - rect.left - rect.width / 2,
    y: (first.y + second.y) / 2 - rect.top - rect.height / 2,
  };
}

function resolveStageTheme(themeKey?: string): StageTheme {
  if (themeKey === "paper") {
    return {
      frameFill: "#cdd9e5",
      rulerFill: "#f7f9fc",
      rulerBorder: "#bccada",
      rulerText: "#465667",
      paperFill: "#ffffff",
      gridMajor: "rgba(74, 131, 194, 0.72)",
      gridMinor: "rgba(92, 108, 126, 0.3)",
      selectionFill: "rgba(28, 138, 134, 0.18)",
      selectionStroke: "#1c8a86",
      hoverPaint: "#1c8a86",
      hoverErase: "#c34f4f",
      hoverFill: "#d28d2d",
    };
  }

  if (themeKey === "night") {
    return {
      frameFill: "#455264",
      rulerFill: "#d8e0e8",
      rulerBorder: "#8d9dad",
      rulerText: "#253240",
      paperFill: "#ffffff",
      gridMajor: "rgba(83, 157, 228, 0.72)",
      gridMinor: "rgba(107, 123, 140, 0.34)",
      selectionFill: "rgba(79, 194, 180, 0.18)",
      selectionStroke: "#4fc2b4",
      hoverPaint: "#4fc2b4",
      hoverErase: "#f09a9a",
      hoverFill: "#dea63f",
    };
  }

  return {
    frameFill: "#d8c8ae",
    rulerFill: "#f5f2ec",
    rulerBorder: "#c8bca7",
    rulerText: "#5c5045",
    paperFill: "#ffffff",
    gridMajor: "rgba(216, 148, 66, 0.78)",
    gridMinor: "rgba(92, 80, 67, 0.38)",
    selectionFill: "rgba(74, 163, 161, 0.18)",
    selectionStroke: "#2f8f83",
    hoverPaint: "#2f8f83",
    hoverErase: "#c94b4b",
    hoverFill: "#e58a3c",
  };
}
