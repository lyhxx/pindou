import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { defaultPalette } from "../../palette/palette";
import type {
  BeadGrid,
  CanvasSize,
  EditorTool,
  SourceImage,
  ViewTransform,
} from "../../../shared/types/project";
import { EMPTY_CELL } from "../../../shared/types/project";

type CanvasStageProps = {
  activeTool: EditorTool;
  beadGrid: BeadGrid | null;
  canvas: CanvasSize;
  imageTransform: ViewTransform;
  onCellAction: (x: number, y: number, mode?: "paint" | "erase" | "picker") => void;
  onViewportChange: (transform: Partial<ViewTransform>) => void;
  sourceImage: SourceImage | null;
  stageViewport: ViewTransform;
  showGrid: boolean;
};

const CANVAS_SIZE = 1600;
const RULER_SIZE = 28;
const GRID_MAJOR_STEP = 10;
const CELL_LABEL_MIN_SIZE = 14;

export const CanvasStage = forwardRef<HTMLCanvasElement, CanvasStageProps>(
  function CanvasStage(
    {
      activeTool,
      beadGrid,
      canvas,
      imageTransform,
      onCellAction,
      onViewportChange,
      sourceImage,
      stageViewport,
      showGrid,
    },
    forwardedRef,
  ) {
    const shellRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [displaySize, setDisplaySize] = useState({ width: 640, height: 640 });
    const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const panStateRef = useRef<{
      pointerId: number;
      startX: number;
      startY: number;
      originOffsetX: number;
      originOffsetY: number;
    } | null>(null);

    useImperativeHandle(
      forwardedRef,
      () => canvasRef.current as HTMLCanvasElement,
      [],
    );

    useLayoutEffect(() => {
      const shellNode = shellRef.current;
      if (!shellNode) {
        return;
      }

      const updateSize = (width: number, height: number) => {
        const usableWidth = Math.max(240, width - 24);
        const usableHeight = Math.max(240, height - 24);
        const scale = Math.min(
          usableWidth / (canvas.width + 2),
          usableHeight / (canvas.height + 2),
        );

        setDisplaySize({
          width: Math.max(240, Math.floor(canvas.width * scale)),
          height: Math.max(240, Math.floor(canvas.height * scale)),
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
    }, [canvas.height, canvas.width]);

    useEffect(() => {
      if (!sourceImage) {
        imageRef.current = null;
        return;
      }

      const image = new Image();
      image.onload = () => {
        imageRef.current = image;
        draw();
      };
      image.src = sourceImage.src;
    }, [sourceImage]);

    useEffect(() => {
      draw();
    }, [beadGrid, canvas, imageTransform, hoverCell, showGrid, stageViewport, sourceImage]);

    useEffect(() => {
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

      const context = canvasNode.getContext("2d");
      if (!context) {
        return;
      }

      const gridWidth = CANVAS_SIZE - RULER_SIZE;
      const gridHeight = CANVAS_SIZE - RULER_SIZE;
      const cellWidth = gridWidth / canvas.width;
      const cellHeight = gridHeight / canvas.height;

      context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      context.fillStyle = "#f3ece0";
      context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      drawRulers(context, cellWidth, cellHeight, gridWidth, gridHeight);
      drawPaper(context, gridWidth, gridHeight);

      if (imageRef.current && !beadGrid) {
        drawSourceImage(context, imageRef.current, gridWidth, gridHeight);
      }

      drawGridFill(context, beadGrid, cellWidth, cellHeight);

      if (showGrid) {
        drawGridLines(context, cellWidth, cellHeight, gridWidth, gridHeight);
      }

      drawCellLabels(context, beadGrid, cellWidth, cellHeight);
      drawHoverCell(context, hoverCell, cellWidth, cellHeight);
    }

    function drawRulers(
      context: CanvasRenderingContext2D,
      cellWidth: number,
      cellHeight: number,
      gridWidth: number,
      gridHeight: number,
    ) {
      context.fillStyle = "#f7f7f7";
      context.fillRect(RULER_SIZE, 0, gridWidth, RULER_SIZE);
      context.fillRect(0, RULER_SIZE, RULER_SIZE, gridHeight);
      context.fillRect(0, 0, RULER_SIZE, RULER_SIZE);

      context.strokeStyle = "#c8c8c8";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(RULER_SIZE, RULER_SIZE);
      context.lineTo(CANVAS_SIZE, RULER_SIZE);
      context.moveTo(RULER_SIZE, RULER_SIZE);
      context.lineTo(RULER_SIZE, CANVAS_SIZE);
      context.stroke();

      context.fillStyle = "#3f3f3f";
      context.font = "11px IBM Plex Mono, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";

      for (let x = 0; x < canvas.width; x += 1) {
        const centerX = RULER_SIZE + x * cellWidth + cellWidth / 2;
        context.fillText(String(x + 1), centerX, RULER_SIZE / 2);
      }

      for (let y = 0; y < canvas.height; y += 1) {
        const centerY = RULER_SIZE + y * cellHeight + cellHeight / 2;
        context.fillText(String(y + 1), RULER_SIZE / 2, centerY);
      }
    }

    function drawPaper(
      context: CanvasRenderingContext2D,
      gridWidth: number,
      gridHeight: number,
    ) {
      context.fillStyle = "#ffffff";
      context.fillRect(RULER_SIZE, RULER_SIZE, gridWidth, gridHeight);
    }

    function drawSourceImage(
      context: CanvasRenderingContext2D,
      image: HTMLImageElement,
      gridWidth: number,
      gridHeight: number,
    ) {
      const baseScale = Math.min(gridWidth / image.width, gridHeight / image.height);
      const scaledWidth = image.width * baseScale * imageTransform.scale;
      const scaledHeight = image.height * baseScale * imageTransform.scale;
      const left = RULER_SIZE + (gridWidth - scaledWidth) / 2 + imageTransform.offsetX / 16;
      const top = RULER_SIZE + (gridHeight - scaledHeight) / 2 + imageTransform.offsetY / 16;

      context.save();
      context.globalAlpha = 0.78;
      context.drawImage(image, left, top, scaledWidth, scaledHeight);
      context.restore();
    }

    function drawGridFill(
      context: CanvasRenderingContext2D,
      grid: BeadGrid | null,
      cellWidth: number,
      cellHeight: number,
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
            RULER_SIZE + x * cellWidth,
            RULER_SIZE + y * cellHeight,
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
      gridWidth: number,
      gridHeight: number,
    ) {
      context.save();
      context.lineWidth = 1;

      for (let x = 0; x <= canvas.width; x += 1) {
        context.strokeStyle =
          x % GRID_MAJOR_STEP === 0 ? "#f0a14a" : "rgba(140, 140, 140, 0.55)";
        context.beginPath();
        context.moveTo(RULER_SIZE + x * cellWidth, RULER_SIZE);
        context.lineTo(RULER_SIZE + x * cellWidth, RULER_SIZE + gridHeight);
        context.stroke();
      }

      for (let y = 0; y <= canvas.height; y += 1) {
        context.strokeStyle =
          y % GRID_MAJOR_STEP === 0 ? "#f0a14a" : "rgba(140, 140, 140, 0.55)";
        context.beginPath();
        context.moveTo(RULER_SIZE, RULER_SIZE + y * cellHeight);
        context.lineTo(RULER_SIZE + gridWidth, RULER_SIZE + y * cellHeight);
        context.stroke();
      }

      context.restore();
    }

    function drawCellLabels(
      context: CanvasRenderingContext2D,
      grid: BeadGrid | null,
      cellWidth: number,
      cellHeight: number,
    ) {
      if (!grid || Math.min(cellWidth, cellHeight) < CELL_LABEL_MIN_SIZE) {
        return;
      }

      context.font = `${Math.max(8, Math.floor(Math.min(cellWidth, cellHeight) * 0.36))}px IBM Plex Mono, monospace`;
      context.textAlign = "center";
      context.textBaseline = "middle";

      for (let y = 0; y < grid.height; y += 1) {
        for (let x = 0; x < grid.width; x += 1) {
          const colorIndex = grid.cells[y * grid.width + x];
          if (colorIndex === EMPTY_CELL) {
            continue;
          }

          const color = defaultPalette[colorIndex] ?? defaultPalette[0];
          const [r, g, b] = color.rgb;
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          context.fillStyle = luminance > 160 ? "#2a241d" : "#ffffff";
          context.fillText(
            color.id,
            RULER_SIZE + x * cellWidth + cellWidth / 2,
            RULER_SIZE + y * cellHeight + cellHeight / 2,
          );
        }
      }
    }

    function drawHoverCell(
      context: CanvasRenderingContext2D,
      cell: { x: number; y: number } | null,
      cellWidth: number,
      cellHeight: number,
    ) {
      if (!cell) {
        return;
      }

      context.save();
      context.strokeStyle = activeTool === "erase" ? "#c94b4b" : "#4aa3a1";
      context.lineWidth = 2;
      context.strokeRect(
        RULER_SIZE + cell.x * cellWidth + 1,
        RULER_SIZE + cell.y * cellHeight + 1,
        cellWidth - 2,
        cellHeight - 2,
      );
      context.restore();
    }

    function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
      event.preventDefault();

      const shellNode = shellRef.current;
      if (!shellNode) {
        return;
      }

      const rect = shellNode.getBoundingClientRect();
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

    function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
      event.preventDefault();

      const cell = getCellFromPointer(event.clientX, event.clientY);
      if (!cell) {
        return;
      }

      onCellAction(cell.x, cell.y, "picker");
    }

    function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
      const shouldPan =
        isSpacePressed || event.button === 1 || activeTool === "pan";

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

      setHoverCell(cell);

      if (event.button === 2 || event.altKey) {
        onCellAction(cell.x, cell.y, "picker");
        return;
      }

      if (activeTool === "picker") {
        onCellAction(cell.x, cell.y, "picker");
        return;
      }

      if (activeTool === "erase") {
        onCellAction(cell.x, cell.y, "erase");
        return;
      }

      onCellAction(cell.x, cell.y, "paint");
    }

    function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
      const cell = getCellFromPointer(event.clientX, event.clientY);
      setHoverCell(cell);

      const panState = panStateRef.current;
      if (panState && panState.pointerId === event.pointerId) {
        onViewportChange({
          offsetX: panState.originOffsetX + (event.clientX - panState.startX),
          offsetY: panState.originOffsetY + (event.clientY - panState.startY),
        });
        return;
      }

      if (!cell || event.buttons !== 1 || activeTool === "picker") {
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
      const panState = panStateRef.current;
      if (panState && panState.pointerId === event.pointerId) {
        panStateRef.current = null;
        setIsPanning(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    function getCellFromPointer(clientX: number, clientY: number) {
      const canvasNode = canvasRef.current;
      if (!canvasNode) {
        return null;
      }

      const rect = canvasNode.getBoundingClientRect();
      const localX = ((clientX - rect.left) / rect.width) * CANVAS_SIZE;
      const localY = ((clientY - rect.top) / rect.height) * CANVAS_SIZE;

      if (localX < RULER_SIZE || localY < RULER_SIZE) {
        return null;
      }

      const gridWidth = CANVAS_SIZE - RULER_SIZE;
      const gridHeight = CANVAS_SIZE - RULER_SIZE;
      const normalizedX = (localX - RULER_SIZE) / gridWidth;
      const normalizedY = (localY - RULER_SIZE) / gridHeight;

      if (normalizedX < 0 || normalizedY < 0 || normalizedX > 1 || normalizedY > 1) {
        return null;
      }

      return {
        x: clampIndex(Math.floor(normalizedX * canvas.width), canvas.width),
        y: clampIndex(Math.floor(normalizedY * canvas.height), canvas.height),
      };
    }

    const stageCursor = isPanning
      ? " canvas-stage-shell--dragging"
      : isSpacePressed || activeTool === "pan"
        ? " canvas-stage-shell--pan"
        : activeTool === "picker"
          ? " canvas-stage-shell--picker"
          : activeTool === "erase"
            ? " canvas-stage-shell--erase"
            : " canvas-stage-shell--paint";

    return (
      <div
        ref={shellRef}
        className={`canvas-stage-shell${stageCursor}`}
        onContextMenu={handleContextMenu}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => setHoverCell(null)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          className="canvas-stage"
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
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
