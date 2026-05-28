import { useEffect, useRef, useState } from "react";
import type {
  BeadGrid,
  CanvasSize,
  SourceImage,
  ViewTransform,
} from "../../../shared/types/project";
import { EMPTY_CELL } from "../../../shared/types/project";
import { defaultPalette } from "../../palette/palette";

type ImagePositionPreviewProps = {
  canvas: CanvasSize;
  imageTransform: ViewTransform;
  onImageTransformChange: (transform: Partial<ViewTransform>) => void;
  previewGrid: BeadGrid | null;
  previewMode: "generated" | "source";
  sourceImage: SourceImage | null;
  themeKey?: string;
};

const PREVIEW_WIDTH = 520;
const PREVIEW_HEIGHT = 360;
const PREVIEW_PADDING = 18;

export function ImagePositionPreview({
  canvas,
  imageTransform,
  onImageTransformChange,
  previewGrid,
  previewMode,
  sourceImage,
  themeKey,
}: ImagePositionPreviewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originOffsetX: number;
    originOffsetY: number;
    boardScale: number;
  } | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{
    pointerIds: [number, number];
    originScale: number;
    originDistance: number;
  } | null>(null);
  const metricsRef = useRef({
    boardLeft: 0,
    boardTop: 0,
    boardWidth: 0,
    boardHeight: 0,
    boardScale: 1,
  });

  useEffect(() => {
    if (!sourceImage?.src) {
      imageRef.current = null;
      drawPreview();
      return;
    }

    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      drawPreview();
    };
    image.src = sourceImage.src;
  }, [sourceImage]);

  useEffect(() => {
    drawPreview();
  }, [canvas.height, canvas.width, imageTransform, previewGrid, previewMode, themeKey]);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!sourceImage?.src) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const scaleDelta = event.deltaY < 0 ? 1.05 : 0.95;
      onImageTransformChange({
        scale: clampScale(imageTransform.scale * scaleDelta),
      });
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, [imageTransform.scale, onImageTransformChange, sourceImage]);

  function drawPreview() {
    const node = canvasRef.current;
    if (!node) {
      return;
    }

    const context = node.getContext("2d");
    if (!context) {
      return;
    }
    const theme = readPreviewTheme();

    context.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    context.fillStyle = theme.frameFill;
    context.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

    const stageWidth = PREVIEW_WIDTH - PREVIEW_PADDING * 2;
    const stageHeight = PREVIEW_HEIGHT - PREVIEW_PADDING * 2;
    const boardScale = Math.min(stageWidth / canvas.width, stageHeight / canvas.height);
    const boardWidth = canvas.width * boardScale;
    const boardHeight = canvas.height * boardScale;
    const boardLeft = (PREVIEW_WIDTH - boardWidth) / 2;
    const boardTop = (PREVIEW_HEIGHT - boardHeight) / 2;
    const cellWidth = boardWidth / canvas.width;
    const cellHeight = boardHeight / canvas.height;

    metricsRef.current = {
      boardLeft,
      boardTop,
      boardWidth,
      boardHeight,
      boardScale,
    };

    context.fillStyle = theme.paperFill;
    context.fillRect(boardLeft, boardTop, boardWidth, boardHeight);

    if (previewMode === "generated" && previewGrid) {
      drawGeneratedPreview(context, previewGrid, boardLeft, boardTop, boardWidth, boardHeight);
    } else if (imageRef.current) {
      const image = imageRef.current;
      const baseScale = Math.min(boardWidth / image.width, boardHeight / image.height);
      const drawWidth = image.width * baseScale * imageTransform.scale;
      const drawHeight = image.height * baseScale * imageTransform.scale;
      const drawLeft =
        boardLeft + (boardWidth - drawWidth) / 2 + imageTransform.offsetX * boardScale;
      const drawTop =
        boardTop + (boardHeight - drawHeight) / 2 + imageTransform.offsetY * boardScale;

      context.save();
      context.drawImage(image, drawLeft, drawTop, drawWidth, drawHeight);
      context.restore();
    } else {
      context.fillStyle = theme.emptyText;
      context.font = '13px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("上传图片后在这里预览定位", PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2);
    }

    for (let x = 0; x <= canvas.width; x += 1) {
      const isMajorLine = x % 10 === 0;
      context.beginPath();
      context.strokeStyle = isMajorLine ? theme.gridMajor : theme.gridMinor;
      context.lineWidth = isMajorLine ? 1.35 : 0.8;
      context.moveTo(boardLeft + x * cellWidth, boardTop);
      context.lineTo(boardLeft + x * cellWidth, boardTop + boardHeight);
      context.stroke();
    }

    for (let y = 0; y <= canvas.height; y += 1) {
      const isMajorLine = y % 10 === 0;
      context.beginPath();
      context.strokeStyle = isMajorLine ? theme.gridMajor : theme.gridMinor;
      context.lineWidth = isMajorLine ? 1.35 : 0.8;
      context.moveTo(boardLeft, boardTop + y * cellHeight);
      context.lineTo(boardLeft + boardWidth, boardTop + y * cellHeight);
      context.stroke();
    }

    context.strokeStyle = theme.outline;
    context.lineWidth = 1.6;
    context.strokeRect(boardLeft, boardTop, boardWidth, boardHeight);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!sourceImage?.src) {
      return;
    }

    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (event.pointerType === "touch" && activePointersRef.current.size >= 2) {
      const pair = getPointerPair(activePointersRef.current);
      if (pair) {
        pinchStateRef.current = {
          pointerIds: [pair[0][0], pair[1][0]],
          originScale: imageTransform.scale,
          originDistance: getPointerDistance(pair[0][1], pair[1][1]),
        };
        dragStateRef.current = null;
        setIsDragging(false);
      }
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originOffsetX: imageTransform.offsetX,
      originOffsetY: imageTransform.offsetY,
      boardScale: metricsRef.current.boardScale,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    const pinchState = pinchStateRef.current;
    if (pinchState) {
      const [firstId, secondId] = pinchState.pointerIds;
      const firstPointer = activePointersRef.current.get(firstId);
      const secondPointer = activePointersRef.current.get(secondId);
      if (firstPointer && secondPointer) {
        const nextScale =
          pinchState.originScale *
          (getPointerDistance(firstPointer, secondPointer) / pinchState.originDistance);
        onImageTransformChange({
          scale: clampScale(nextScale),
        });
        event.preventDefault();
      }
      return;
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = (event.clientX - dragState.startX) / dragState.boardScale;
    const deltaY = (event.clientY - dragState.startY) / dragState.boardScale;

    onImageTransformChange({
      offsetX: roundTransformValue(dragState.originOffsetX + deltaX),
      offsetY: roundTransformValue(dragState.originOffsetY + deltaY),
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    activePointersRef.current.delete(event.pointerId);

    if (pinchStateRef.current) {
      const [firstId, secondId] = pinchStateRef.current.pointerIds;
      if (
        event.pointerId === firstId ||
        event.pointerId === secondId ||
        activePointersRef.current.size < 2
      ) {
        pinchStateRef.current = null;
      }
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    if (!sourceImage?.src) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const scaleDelta = event.deltaY < 0 ? 1.05 : 0.95;
    onImageTransformChange({
      scale: clampScale(imageTransform.scale * scaleDelta),
    });
  }

  return (
    <div
      ref={wrapperRef}
      className={`image-preview${isDragging ? " image-preview--dragging" : ""}`}
    >
      <canvas
        ref={canvasRef}
        className="image-preview__canvas"
        height={PREVIEW_HEIGHT}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        width={PREVIEW_WIDTH}
      />
      <div className="image-preview__hint">
        <span>单指拖动</span>
        <span>双指缩放</span>
      </div>
    </div>
  );
}

function drawGeneratedPreview(
  context: CanvasRenderingContext2D,
  beadGrid: BeadGrid,
  boardLeft: number,
  boardTop: number,
  boardWidth: number,
  boardHeight: number,
) {
  const cellWidth = boardWidth / beadGrid.width;
  const cellHeight = boardHeight / beadGrid.height;

  for (let y = 0; y < beadGrid.height; y += 1) {
    for (let x = 0; x < beadGrid.width; x += 1) {
      const colorIndex = beadGrid.cells[y * beadGrid.width + x];
      if (colorIndex === EMPTY_CELL) {
        continue;
      }

      const color = defaultPalette[colorIndex] ?? defaultPalette[0];
      context.fillStyle = color.hex;
      context.fillRect(
        boardLeft + x * cellWidth,
        boardTop + y * cellHeight,
        cellWidth,
        cellHeight,
      );
    }
  }
}

function clampScale(value: number) {
  return Math.min(3, Math.max(0.2, Number(value.toFixed(2))));
}

function roundTransformValue(value: number) {
  return Number(value.toFixed(2));
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

function readPreviewTheme() {
  if (typeof window === "undefined") {
    return {
      frameFill: "#eadcc7",
      paperFill: "#ffffff",
      emptyText: "#a1917d",
      gridMajor: "rgba(216, 148, 66, 0.78)",
      gridMinor: "rgba(92, 80, 67, 0.38)",
      outline: "rgba(72, 60, 48, 0.82)",
    };
  }

  const style = window.getComputedStyle(document.documentElement);

  return {
    frameFill: style.getPropertyValue("--theme-preview-frame-fill").trim() || "#eadcc7",
    paperFill: style.getPropertyValue("--theme-stage-paper-fill").trim() || "#ffffff",
    emptyText: style.getPropertyValue("--theme-text-muted").trim() || "#a1917d",
    gridMajor:
      style.getPropertyValue("--theme-stage-grid-major").trim() || "rgba(216, 148, 66, 0.78)",
    gridMinor:
      style.getPropertyValue("--theme-stage-grid-minor").trim() || "rgba(92, 80, 67, 0.38)",
    outline: style.getPropertyValue("--theme-preview-outline").trim() || "rgba(72, 60, 48, 0.82)",
  };
}
