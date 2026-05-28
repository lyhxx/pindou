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
const RULER_SIZE = 30;
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
    const stageTheme = useMemo(() => readStageTheme(), [themeKey]);

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

      const paperLeft = RULER_SIZE;
      const paperTop = RULER_SIZE;
      const paperRight = CANVAS_SIZE - RULER_SIZE;
      const paperBottom = CANVAS_SIZE - RULER_SIZE;
      const gridWidth = paperRight - paperLeft - PAPER_PADDING * 2;
      const gridHeight = paperBottom - paperTop - PAPER_PADDING * 2;
      const cellWidth = gridWidth / canvas.width;
      const cellHeight = gridHeight / canvas.height;

      context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      context.fillStyle = stageTheme.frameFill;
      context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      drawRulers(
        context,
        cellWidth,
        cellHeight,
        paperLeft,
        paperTop,
        gridWidth,
        gridHeight,
        stageTheme,
      );
      drawPaper(context, paperLeft, paperTop, paperRight - paperLeft, paperBottom - paperTop);
      drawGridFill(context, beadGrid, cellWidth, cellHeight, paperLeft, paperTop);

      if (showGrid) {
        drawGridLines(context, cellWidth, cellHeight, paperLeft, paperTop, gridWidth, gridHeight);
      }

      drawSelectionRect(context, selectionRect, cellWidth, cellHeight, paperLeft, paperTop);
      drawHoverCell(context, hoverCell, cellWidth, cellHeight, paperLeft, paperTop);
    }

    function drawRulers(
      context: CanvasRenderingContext2D,
      cellWidth: number,
      cellHeight: number,
      paperLeft: number,
      paperTop: number,
      gridWidth: number,
      gridHeight: number,
      theme: StageTheme,
    ) {
      const paperRight = paperLeft + gridWidth;
      const paperBottom = paperTop + gridHeight;

      context.fillStyle = theme.rulerFill;
      context.fillRect(paperLeft, 0, gridWidth, RULER_SIZE);
      context.fillRect(paperLeft, paperBottom, gridWidth, RULER_SIZE);
      context.fillRect(0, paperTop, RULER_SIZE, gridHeight);
      context.fillRect(paperRight, paperTop, RULER_SIZE, gridHeight);
      context.fillRect(0, 0, RULER_SIZE, RULER_SIZE);
      context.fillRect(paperRight, 0, RULER_SIZE, RULER_SIZE);
      context.fillRect(0, paperBottom, RULER_SIZE, RULER_SIZE);
      context.fillRect(paperRight, paperBottom, RULER_SIZE, RULER_SIZE);

      context.strokeStyle = theme.rulerBorder;
      context.lineWidth = 1;
      context.strokeRect(paperLeft, paperTop, gridWidth, gridHeight);

      context.fillStyle = theme.rulerText;
      context.font = "11px IBM Plex Mono, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";

      for (let x = 0; x < canvas.width; x += 1) {
        const centerX = paperLeft + x * cellWidth + cellWidth / 2;
        const label = String(x + 1);
        context.fillText(label, centerX, RULER_SIZE / 2);
        context.fillText(label, centerX, paperBottom + RULER_SIZE / 2);
      }

      for (let y = 0; y < canvas.height; y += 1) {
        const centerY = paperTop + y * cellHeight + cellHeight / 2;
        const label = String(y + 1);
        context.fillText(label, RULER_SIZE / 2, centerY);
        context.fillText(label, paperRight + RULER_SIZE / 2, centerY);
      }
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

    function drawGridLines(
      context: CanvasRenderingContext2D,
      cellWidth: number,
      cellHeight: number,
      paperLeft: number,
      paperTop: number,
      gridWidth: number,
      gridHeight: number,
    ) {
      context.save();
      context.lineWidth = 1;

      for (let x = 0; x <= canvas.width; x += 1) {
        context.strokeStyle = x % GRID_MAJOR_STEP === 0 ? stageTheme.gridMajor : stageTheme.gridMinor;
        context.beginPath();
        const lineX = alignToPixel(paperLeft + x * cellWidth);
        context.moveTo(lineX, paperTop);
        context.lineTo(lineX, paperTop + gridHeight);
        context.stroke();
      }

      for (let y = 0; y <= canvas.height; y += 1) {
        context.strokeStyle = y % GRID_MAJOR_STEP === 0 ? stageTheme.gridMajor : stageTheme.gridMinor;
        context.beginPath();
        const lineY = alignToPixel(paperTop + y * cellHeight);
        context.moveTo(paperLeft, lineY);
        context.lineTo(paperLeft + gridWidth, lineY);
        context.stroke();
      }

      context.restore();
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
      const canvasNode = canvasRef.current;
      if (!canvasNode) {
        return null;
      }

      const rect = canvasNode.getBoundingClientRect();
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
        <canvas
          ref={canvasRef}
          className="canvas-stage"
          style={{
            width: `${displaySize.width}px`,
            height: `${displaySize.height}px`,
            transform: `translate(${stageViewport.offsetX}px, ${stageViewport.offsetY}px) scale(${stageViewport.scale})`,
          }}
        />
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

function alignToPixel(value: number) {
  return Math.round(value) + 0.5;
}

function readStageTheme(): StageTheme {
  if (typeof window === "undefined") {
    return {
      frameFill: "#d8c8ae",
      rulerFill: "#f5f2ec",
      rulerBorder: "#c8bca7",
      rulerText: "#5c5045",
      paperFill: "#ffffff",
      gridMajor: "#e0a04c",
      gridMinor: "rgba(126, 119, 110, 0.42)",
      selectionFill: "rgba(74, 163, 161, 0.18)",
      selectionStroke: "#2f8f83",
      hoverPaint: "#2f8f83",
      hoverErase: "#c94b4b",
      hoverFill: "#e58a3c",
    };
  }

  const style = window.getComputedStyle(document.documentElement);

  return {
    frameFill: style.getPropertyValue("--theme-stage-frame-fill").trim() || "#d8c8ae",
    rulerFill: style.getPropertyValue("--theme-stage-ruler-fill").trim() || "#f5f2ec",
    rulerBorder: style.getPropertyValue("--theme-stage-ruler-border").trim() || "#c8bca7",
    rulerText: style.getPropertyValue("--theme-stage-ruler-text").trim() || "#5c5045",
    paperFill: style.getPropertyValue("--theme-stage-paper-fill").trim() || "#ffffff",
    gridMajor: style.getPropertyValue("--theme-stage-grid-major").trim() || "#e0a04c",
    gridMinor: style.getPropertyValue("--theme-stage-grid-minor").trim() || "rgba(126, 119, 110, 0.42)",
    selectionFill:
      style.getPropertyValue("--theme-stage-selection-fill").trim() || "rgba(74, 163, 161, 0.18)",
    selectionStroke:
      style.getPropertyValue("--theme-stage-selection-stroke").trim() || "#2f8f83",
    hoverPaint: style.getPropertyValue("--theme-stage-hover-paint").trim() || "#2f8f83",
    hoverErase: style.getPropertyValue("--theme-stage-hover-erase").trim() || "#c94b4b",
    hoverFill: style.getPropertyValue("--theme-stage-hover-fill").trim() || "#e58a3c",
  };
}
