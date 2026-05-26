import { useEffect, useRef, useState } from "react";
import type {
  CanvasSize,
  SourceImage,
  ViewTransform,
} from "../../../shared/types/project";

type ImagePositionPreviewProps = {
  canvas: CanvasSize;
  imageTransform: ViewTransform;
  onImageTransformChange: (transform: Partial<ViewTransform>) => void;
  sourceImage: SourceImage | null;
};

const PREVIEW_WIDTH = 520;
const PREVIEW_HEIGHT = 360;
const PREVIEW_PADDING = 18;

export function ImagePositionPreview({
  canvas,
  imageTransform,
  onImageTransformChange,
  sourceImage,
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
  const metricsRef = useRef({
    boardLeft: 0,
    boardTop: 0,
    boardWidth: 0,
    boardHeight: 0,
    boardScale: 1,
  });

  useEffect(() => {
    if (!sourceImage) {
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
  }, [canvas.height, canvas.width, imageTransform]);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!sourceImage) {
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

    context.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    context.fillStyle = "#eadcc7";
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

    context.fillStyle = "#ffffff";
    context.fillRect(boardLeft, boardTop, boardWidth, boardHeight);

    if (imageRef.current) {
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
      context.fillStyle = "#a1917d";
      context.font = '13px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("上传图片后在这里预览定位", PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2);
    }

    context.strokeStyle = "rgba(126, 119, 110, 0.35)";
    context.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 1) {
      context.beginPath();
      context.moveTo(boardLeft + x * cellWidth, boardTop);
      context.lineTo(boardLeft + x * cellWidth, boardTop + boardHeight);
      context.stroke();
    }

    for (let y = 0; y <= canvas.height; y += 1) {
      context.beginPath();
      context.moveTo(boardLeft, boardTop + y * cellHeight);
      context.lineTo(boardLeft + boardWidth, boardTop + y * cellHeight);
      context.stroke();
    }

    context.strokeStyle = "#b8ab96";
    context.strokeRect(boardLeft, boardTop, boardWidth, boardHeight);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!sourceImage) {
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
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    if (!sourceImage) {
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
        <span>拖拽移动</span>
        <span>滚轮缩放</span>
      </div>
    </div>
  );
}

function clampScale(value: number) {
  return Math.min(3, Math.max(0.2, Number(value.toFixed(2))));
}

function roundTransformValue(value: number) {
  return Number(value.toFixed(2));
}
