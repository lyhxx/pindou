import type {
  BeadGrid,
  CanvasSize,
  RectSelection,
  SerializedProjectFile,
  SourceImage,
  ViewTransform,
} from "../../shared/types/project";
import { EMPTY_CELL } from "../../shared/types/project";
import {
  defaultPalette,
  defaultPaletteIds,
  findPaletteIndexById,
  normalizeEnabledPaletteIds,
} from "../palette/palette";

const BASE_STAGE_SAMPLE_SIZE = 1200;
const MIN_VISIBLE_ALPHA = 24;
const EXPORT_MARGIN = 24;
const EXPORT_RULER_SIZE = 34;
const EXPORT_MIN_CELL_SIZE = 8;
const EXPORT_MAX_CELL_SIZE = 28;
const EXPORT_DRAW_SIZE = 2200;
const EXPORT_MIN_INFO_WIDTH = 960;
const EXPORT_HEADER_HEIGHT = 132;
const EXPORT_FOOTER_MIN_HEIGHT = 176;
const EXPORT_PIXEL_RATIO = 2;
const MAX_EXPORT_BITMAP_SIDE = 16384;
const EXPORT_LEGEND_ITEM_HEIGHT = 44;
const EDGE_CONNECTED_WHITE_LUMA_MIN = 238;
const EDGE_CONNECTED_WHITE_CHROMA_MAX = 24;
const TRIMMABLE_BACKGROUND_COLOR_IDS = new Set(["W01", "W02", "W03", "S01"]);

export async function generateBeadGrid(options: {
  canvas: CanvasSize;
  sourceImage: SourceImage;
  imageTransform: ViewTransform;
  enabledPaletteIds: string[];
}) {
  const image = await loadImage(options.sourceImage.src);
  const sampleSurface = renderSourceToSampleSurface({
    canvas: options.canvas,
    image,
    imageTransform: options.imageTransform,
  });

  const enabledPaletteIndices = normalizeEnabledPaletteIds(options.enabledPaletteIds)
    .map((colorId) => findPaletteIndexById(colorId))
    .filter((index): index is number => index >= 0);

  if (enabledPaletteIndices.length === 0) {
    throw new Error("至少需要启用一种拼豆颜色才能生成图纸。");
  }

  const sampledGrid = sampleGridFromImageData({
    canvas: options.canvas,
    imageData: sampleSurface.imageData,
  });
  const normalizedSampledGrid = stripConnectedNearWhiteBackground(sampledGrid);

  return quantizeNearest(normalizedSampledGrid, enabledPaletteIndices);
}

export async function generatePreviewBeadGrid(options: {
  canvas: CanvasSize;
  sourceImage: SourceImage;
  imageTransform: ViewTransform;
  enabledPaletteIds: string[];
}) {
  return generateBeadGrid({
    ...options,
  });
}

export function buildColorStats(beadGrid: BeadGrid | null) {
  if (!beadGrid) {
    return [];
  }

  const counts = new Map<number, number>();
  let coloredCount = 0;

  for (const colorIndex of beadGrid.cells) {
    if (colorIndex === EMPTY_CELL) {
      continue;
    }

    counts.set(colorIndex, (counts.get(colorIndex) ?? 0) + 1);
    coloredCount += 1;
  }

  if (coloredCount === 0) {
    return [];
  }

  return Array.from(counts.entries())
    .map(([colorIndex, count]) => {
      const color = defaultPalette[colorIndex] ?? defaultPalette[0];

      return {
        colorIndex,
        color,
        count,
        ratio: count / coloredCount,
      };
    })
    .sort((left, right) => right.count - left.count);
}

export function exportColorListText(options: {
  name: string;
  canvas: CanvasSize;
  stats: Array<{
    colorIndex: number;
    color: (typeof defaultPalette)[number];
    count: number;
    ratio: number;
  }>;
}) {
  const lines = [
    `项目：${options.name}`,
    `画布：${options.canvas.width} x ${options.canvas.height}`,
    "",
    "颜色清单",
  ];

  if (options.stats.length === 0) {
    lines.push("暂无颜色数据");
    return lines.join("\n");
  }

  for (const item of options.stats) {
    lines.push(
      `${item.color.id}\t${item.color.name}\t${item.color.hex}\t${item.count}\t${(
        item.ratio * 100
      ).toFixed(1)}%`,
    );
  }

  return lines.join("\n");
}

export function exportProjectJson(options: {
  beadGrid: BeadGrid | null;
  canvas: CanvasSize;
  currentSelection: RectSelection | null;
  name: string;
  processing: {
  };
  sourceImage: SourceImage | null;
  imageTransform: ViewTransform;
  stageViewport: ViewTransform;
  enabledPaletteIds: string[];
  activeTool: "paint" | "erase" | "picker" | "pan" | "fill" | "select";
  activeColorId: string;
  showGrid: boolean;
}) {
  const payload: SerializedProjectFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    project: {
      name: options.name,
      canvas: options.canvas,
      sourceImage: options.sourceImage,
      beadGrid: options.beadGrid
        ? {
            width: options.beadGrid.width,
            height: options.beadGrid.height,
            cells: Array.from(options.beadGrid.cells),
          }
        : null,
      currentSelection: options.currentSelection,
      imageTransform: options.imageTransform,
      stageViewport: options.stageViewport,
      processing: options.processing,
      enabledPaletteIds: normalizeEnabledPaletteIds(options.enabledPaletteIds),
      activeTool: options.activeTool,
      activeColorId: options.activeColorId,
      showGrid: options.showGrid,
    },
  };

  return JSON.stringify(payload, null, 2);
}

export function parseProjectJson(raw: string): SerializedProjectFile {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("工程文件不是有效的 JSON。");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("工程文件结构无效。");
  }

  const projectFile = parsed as Partial<SerializedProjectFile>;

  if (projectFile.version !== 1 || !projectFile.project) {
    throw new Error("暂不支持该工程文件版本。");
  }

  const enabledPaletteIds = normalizeEnabledPaletteIds(projectFile.project.enabledPaletteIds);

  return {
    ...projectFile,
    project: {
      ...projectFile.project,
      enabledPaletteIds,
      activeColorId:
        enabledPaletteIds.includes(projectFile.project.activeColorId ?? "")
          ? projectFile.project.activeColorId ?? defaultPaletteIds[0]
          : enabledPaletteIds[0],
      processing: {
      },
    },
  } as SerializedProjectFile;
}

export function exportStagePng(beadGrid: BeadGrid | null) {
  if (!beadGrid) {
    throw new Error("当前没有可导出的图纸画布。");
  }

  const canvas = renderPatternChart(beadGrid);
  return canvas.toDataURL("image/png");
}

export function exportFormalPatternPng(options: {
  beadGrid: BeadGrid | null;
  name: string;
}) {
  if (!options.beadGrid) {
    throw new Error("当前没有可导出的图纸画布。");
  }

  const canvas = renderFormalPatternChart(options.beadGrid, options.name);
  return canvas.toDataURL("image/png");
}

export function exportFinishedPng(beadGrid: BeadGrid | null) {
  if (!beadGrid) {
    throw new Error("当前没有可导出的成品图。");
  }

  const scale = beadGrid.width <= 80 && beadGrid.height <= 80 ? 32 : 20;
  const canvas = document.createElement("canvas");
  canvas.width = beadGrid.width * scale;
  canvas.height = beadGrid.height * scale;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("无法初始化成品导出画布。");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < beadGrid.height; y += 1) {
    for (let x = 0; x < beadGrid.width; x += 1) {
      const colorIndex = beadGrid.cells[y * beadGrid.width + x];

      if (colorIndex === EMPTY_CELL) {
        continue;
      }

      const color = defaultPalette[colorIndex] ?? defaultPalette[0];
      drawFinishedBead(context, x * scale, y * scale, scale, color.hex);
    }
  }

  return canvas.toDataURL("image/png");
}

export function trimBeadGrid(beadGrid: BeadGrid | null) {
  if (!beadGrid) {
    return null;
  }

  const ignoredCells = buildTrimmableBackgroundMask(beadGrid);
  let minX = beadGrid.width;
  let minY = beadGrid.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < beadGrid.height; y += 1) {
    for (let x = 0; x < beadGrid.width; x += 1) {
      const index = y * beadGrid.width + x;
      if (ignoredCells?.[index]) {
        continue;
      }

      const colorIndex = beadGrid.cells[index];
      if (colorIndex === EMPTY_CELL) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  const nextWidth = maxX - minX + 1;
  const nextHeight = maxY - minY + 1;
  const cells = new Uint16Array(nextWidth * nextHeight);
  cells.fill(EMPTY_CELL);

  for (let y = 0; y < nextHeight; y += 1) {
    for (let x = 0; x < nextWidth; x += 1) {
      cells[y * nextWidth + x] =
        beadGrid.cells[(minY + y) * beadGrid.width + (minX + x)];
    }
  }

  return {
    width: nextWidth,
    height: nextHeight,
    cells,
  };
}

function buildTrimmableBackgroundMask(beadGrid: BeadGrid) {
  const candidateColorIndex = findConnectedBorderBackgroundColor(beadGrid);
  if (candidateColorIndex === null) {
    return null;
  }

  const mask = new Uint8Array(beadGrid.width * beadGrid.height);
  const queue: number[] = [];

  function enqueue(index: number) {
    if (mask[index] || beadGrid.cells[index] !== candidateColorIndex) {
      return;
    }
    mask[index] = 1;
    queue.push(index);
  }

  for (let x = 0; x < beadGrid.width; x += 1) {
    enqueue(x);
    enqueue((beadGrid.height - 1) * beadGrid.width + x);
  }

  for (let y = 1; y < beadGrid.height - 1; y += 1) {
    enqueue(y * beadGrid.width);
    enqueue(y * beadGrid.width + (beadGrid.width - 1));
  }

  while (queue.length > 0) {
    const index = queue.shift()!;
    const x = index % beadGrid.width;
    const y = Math.floor(index / beadGrid.width);

    if (x > 0) {
      enqueue(index - 1);
    }
    if (x + 1 < beadGrid.width) {
      enqueue(index + 1);
    }
    if (y > 0) {
      enqueue(index - beadGrid.width);
    }
    if (y + 1 < beadGrid.height) {
      enqueue(index + beadGrid.width);
    }
  }

  for (let index = 0; index < beadGrid.cells.length; index += 1) {
    if (!mask[index] && beadGrid.cells[index] !== EMPTY_CELL) {
      return mask;
    }
  }

  return null;
}

function findConnectedBorderBackgroundColor(beadGrid: BeadGrid) {
  const borderCounts = new Map<number, number>();
  let occupiedBorderCount = 0;

  function countIndex(index: number) {
    const colorIndex = beadGrid.cells[index];
    if (colorIndex === EMPTY_CELL) {
      return;
    }
    occupiedBorderCount += 1;
    borderCounts.set(colorIndex, (borderCounts.get(colorIndex) ?? 0) + 1);
  }

  for (let x = 0; x < beadGrid.width; x += 1) {
    countIndex(x);
    if (beadGrid.height > 1) {
      countIndex((beadGrid.height - 1) * beadGrid.width + x);
    }
  }

  for (let y = 1; y < beadGrid.height - 1; y += 1) {
    countIndex(y * beadGrid.width);
    if (beadGrid.width > 1) {
      countIndex(y * beadGrid.width + (beadGrid.width - 1));
    }
  }

  if (occupiedBorderCount === 0) {
    return null;
  }

  let winner: number | null = null;
  let winnerCount = 0;
  for (const [colorIndex, count] of borderCounts.entries()) {
    if (count > winnerCount) {
      winner = colorIndex;
      winnerCount = count;
    }
  }

  if (winner === null) {
    return null;
  }

  const winnerColor = defaultPalette[winner];
  if (!winnerColor || !TRIMMABLE_BACKGROUND_COLOR_IDS.has(winnerColor.id)) {
    return null;
  }

  return winnerCount / occupiedBorderCount >= 0.55 ? winner : null;
}

function drawFinishedBead(
  context: CanvasRenderingContext2D,
  left: number,
  top: number,
  size: number,
  hex: string,
) {
  const centerX = left + size / 2;
  const centerY = top + size / 2;
  const radius = size * 0.42;

  context.beginPath();
  context.fillStyle = hex;
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.fillStyle = "rgba(255, 255, 255, 0.18)";
  context.arc(centerX - size * 0.1, centerY - size * 0.1, radius * 0.42, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.fillStyle = "rgba(38, 34, 28, 0.08)";
  context.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
  context.fill();
}

function renderPatternChart(beadGrid: BeadGrid) {
  const maxSide = Math.max(beadGrid.width, beadGrid.height);
  const cellSize = clampNumber(
    Math.floor(EXPORT_DRAW_SIZE / Math.max(1, maxSide)),
    EXPORT_MIN_CELL_SIZE,
    EXPORT_MAX_CELL_SIZE,
  );
  const rulerSize = cellSize >= 18 ? 40 : EXPORT_RULER_SIZE;
  const paperWidth = beadGrid.width * cellSize;
  const paperHeight = beadGrid.height * cellSize;
  const logicalWidth = EXPORT_MARGIN * 2 + rulerSize * 2 + paperWidth;
  const logicalHeight = EXPORT_MARGIN * 2 + rulerSize * 2 + paperHeight;
  const { canvas, context } = createExportCanvas(logicalWidth, logicalHeight);
  if (!context) {
    throw new Error("无法初始化图纸导出画布。");
  }

  const paperLeft = EXPORT_MARGIN + rulerSize;
  const paperTop = EXPORT_MARGIN + rulerSize;
  const paperRight = paperLeft + paperWidth;
  const paperBottom = paperTop + paperHeight;

  context.fillStyle = "#f4efe6";
  context.fillRect(0, 0, logicalWidth, logicalHeight);

  context.fillStyle = "#ffffff";
  context.fillRect(paperLeft, paperTop, paperWidth, paperHeight);

  drawPatternRulers(
    context,
    beadGrid.width,
    beadGrid.height,
    cellSize,
    rulerSize,
    paperLeft,
    paperTop,
    paperRight,
    paperBottom,
  );
  drawPatternCells(context, beadGrid, cellSize, paperLeft, paperTop);
  drawPatternGrid(context, beadGrid.width, beadGrid.height, cellSize, paperLeft, paperTop);

  if (cellSize >= 12) {
    drawPatternCellLabels(context, beadGrid, cellSize, paperLeft, paperTop);
  }

  context.strokeStyle = "#8d806f";
  context.lineWidth = 2;
  context.strokeRect(paperLeft, paperTop, paperWidth, paperHeight);

  return canvas;
}

function renderFormalPatternChart(beadGrid: BeadGrid, name: string) {
  const maxSide = Math.max(beadGrid.width, beadGrid.height);
  const cellSize = clampNumber(
    Math.floor(EXPORT_DRAW_SIZE / Math.max(1, maxSide)),
    EXPORT_MIN_CELL_SIZE,
    EXPORT_MAX_CELL_SIZE,
  );
  const rulerSize = cellSize >= 18 ? 40 : EXPORT_RULER_SIZE;
  const paperWidth = beadGrid.width * cellSize;
  const paperHeight = beadGrid.height * cellSize;
  const colorStats = buildColorStats(beadGrid);
  const baseContentWidth = rulerSize * 2 + paperWidth;
  const infoWidth = Math.max(baseContentWidth, EXPORT_MIN_INFO_WIDTH);
  const legendColumns = getLegendColumnCount(infoWidth - 32, colorStats.length);
  const legendRows = Math.max(1, Math.ceil(Math.max(1, colorStats.length) / legendColumns));
  const footerHeight = Math.max(
    EXPORT_FOOTER_MIN_HEIGHT,
    80 + legendRows * EXPORT_LEGEND_ITEM_HEIGHT,
  );
  const logicalWidth = EXPORT_MARGIN * 2 + infoWidth;
  const logicalHeight =
    EXPORT_MARGIN * 2 + EXPORT_HEADER_HEIGHT + rulerSize * 2 + paperHeight + footerHeight;
  const { canvas, context } = createExportCanvas(logicalWidth, logicalHeight);
  if (!context) {
    throw new Error("无法初始化图纸导出画布。");
  }

  const contentLeft = EXPORT_MARGIN;
  const contentOffsetX = Math.max(0, Math.floor((infoWidth - baseContentWidth) / 2));
  const paperLeft = contentLeft + contentOffsetX + rulerSize;
  const paperTop = EXPORT_MARGIN + EXPORT_HEADER_HEIGHT + rulerSize;
  const paperRight = paperLeft + paperWidth;
  const paperBottom = paperTop + paperHeight;

  context.fillStyle = "#f4efe6";
  context.fillRect(0, 0, logicalWidth, logicalHeight);

  drawFormalPatternHeader(context, {
    name,
    beadGrid,
    colorStats,
    left: contentLeft,
    top: EXPORT_MARGIN,
    width: infoWidth,
    height: EXPORT_HEADER_HEIGHT - 12,
  });

  context.fillStyle = "#ffffff";
  context.fillRect(paperLeft, paperTop, paperWidth, paperHeight);

  drawPatternRulers(
    context,
    beadGrid.width,
    beadGrid.height,
    cellSize,
    rulerSize,
    paperLeft,
    paperTop,
    paperRight,
    paperBottom,
  );
  drawPatternCells(context, beadGrid, cellSize, paperLeft, paperTop);
  drawPatternGrid(context, beadGrid.width, beadGrid.height, cellSize, paperLeft, paperTop);

  if (cellSize >= 12) {
    drawPatternCellLabels(context, beadGrid, cellSize, paperLeft, paperTop);
  }

  context.strokeStyle = "#8d806f";
  context.lineWidth = 2;
  context.strokeRect(paperLeft, paperTop, paperWidth, paperHeight);

  drawFormalPatternFooter(context, {
    beadGrid,
    colorStats,
    left: contentLeft,
    top: paperBottom + rulerSize + 12,
    width: infoWidth,
    height: footerHeight - 12,
    columns: legendColumns,
  });

  return canvas;
}

function createExportCanvas(logicalWidth: number, logicalHeight: number) {
  const canvas = document.createElement("canvas");
  const maxSide = Math.max(logicalWidth, logicalHeight);
  const safePixelRatio = clampNumber(
    Math.floor(Math.min(EXPORT_PIXEL_RATIO, MAX_EXPORT_BITMAP_SIDE / Math.max(1, maxSide)) * 100) / 100,
    1,
    EXPORT_PIXEL_RATIO,
  );

  canvas.width = Math.max(1, Math.round(logicalWidth * safePixelRatio));
  canvas.height = Math.max(1, Math.round(logicalHeight * safePixelRatio));

  const context = canvas.getContext("2d");
  if (context) {
    context.setTransform(safePixelRatio, 0, 0, safePixelRatio, 0, 0);
  }

  return {
    canvas,
    context,
  };
}

function drawPatternRulers(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellSize: number,
  rulerSize: number,
  paperLeft: number,
  paperTop: number,
  paperRight: number,
  paperBottom: number,
) {
  const paperWidth = width * cellSize;
  const paperHeight = height * cellSize;

  context.fillStyle = "#f6f1e8";
  context.fillRect(paperLeft, paperTop - rulerSize, paperWidth, rulerSize);
  context.fillRect(paperLeft, paperBottom, paperWidth, rulerSize);
  context.fillRect(paperLeft - rulerSize, paperTop, rulerSize, paperHeight);
  context.fillRect(paperRight, paperTop, rulerSize, paperHeight);
  context.fillRect(paperLeft - rulerSize, paperTop - rulerSize, rulerSize, rulerSize);
  context.fillRect(paperRight, paperTop - rulerSize, rulerSize, rulerSize);
  context.fillRect(paperLeft - rulerSize, paperBottom, rulerSize, rulerSize);
  context.fillRect(paperRight, paperBottom, rulerSize, rulerSize);

  context.strokeStyle = "#d4c5b3";
  context.lineWidth = 1;
  context.strokeRect(paperLeft, paperTop - rulerSize, paperWidth, rulerSize);
  context.strokeRect(paperLeft, paperBottom, paperWidth, rulerSize);
  context.strokeRect(paperLeft - rulerSize, paperTop, rulerSize, paperHeight);
  context.strokeRect(paperRight, paperTop, rulerSize, paperHeight);

  context.fillStyle = "#5d5145";
  context.font = `${Math.max(10, Math.floor(cellSize * 0.5))}px "IBM Plex Mono", monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (let x = 0; x < width; x += 1) {
    const centerX = paperLeft + x * cellSize + cellSize / 2;
    const label = String(x + 1);
    context.fillText(label, centerX, paperTop - rulerSize / 2);
    context.fillText(label, centerX, paperBottom + rulerSize / 2);
  }

  for (let y = 0; y < height; y += 1) {
    const centerY = paperTop + y * cellSize + cellSize / 2;
    const label = String(y + 1);
    context.fillText(label, paperLeft - rulerSize / 2, centerY);
    context.fillText(label, paperRight + rulerSize / 2, centerY);
  }
}

function drawPatternCells(
  context: CanvasRenderingContext2D,
  beadGrid: BeadGrid,
  cellSize: number,
  paperLeft: number,
  paperTop: number,
) {
  for (let y = 0; y < beadGrid.height; y += 1) {
    for (let x = 0; x < beadGrid.width; x += 1) {
      const colorIndex = beadGrid.cells[y * beadGrid.width + x];
      if (colorIndex === EMPTY_CELL) {
        continue;
      }

      const color = defaultPalette[colorIndex] ?? defaultPalette[0];
      context.fillStyle = color.hex;
      context.fillRect(
        paperLeft + x * cellSize,
        paperTop + y * cellSize,
        cellSize,
        cellSize,
      );
    }
  }
}

function drawPatternGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellSize: number,
  paperLeft: number,
  paperTop: number,
) {
  const paperWidth = width * cellSize;
  const paperHeight = height * cellSize;

  context.save();
  context.lineWidth = 1;

  for (let x = 0; x <= width; x += 1) {
    context.strokeStyle = x % 10 === 0 ? "#d89442" : "rgba(128, 117, 102, 0.38)";
    context.beginPath();
    context.moveTo(paperLeft + x * cellSize, paperTop);
    context.lineTo(paperLeft + x * cellSize, paperTop + paperHeight);
    context.stroke();
  }

  for (let y = 0; y <= height; y += 1) {
    context.strokeStyle = y % 10 === 0 ? "#d89442" : "rgba(128, 117, 102, 0.38)";
    context.beginPath();
    context.moveTo(paperLeft, paperTop + y * cellSize);
    context.lineTo(paperLeft + paperWidth, paperTop + y * cellSize);
    context.stroke();
  }

  context.restore();
}

function drawPatternCellLabels(
  context: CanvasRenderingContext2D,
  beadGrid: BeadGrid,
  cellSize: number,
  paperLeft: number,
  paperTop: number,
) {
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font =
    cellSize >= 24
      ? `${Math.floor(cellSize * 0.42)}px "IBM Plex Mono", monospace`
      : `${Math.max(8, Math.floor(cellSize * 0.48))}px "IBM Plex Mono", monospace`;

  for (let y = 0; y < beadGrid.height; y += 1) {
    for (let x = 0; x < beadGrid.width; x += 1) {
      const colorIndex = beadGrid.cells[y * beadGrid.width + x];
      if (colorIndex === EMPTY_CELL) {
        continue;
      }

      const color = defaultPalette[colorIndex] ?? defaultPalette[0];
      const label = color.id;

      context.fillStyle = getReadableTextColor(color.rgb);
      context.fillText(
        label,
        paperLeft + x * cellSize + cellSize / 2,
        paperTop + y * cellSize + cellSize / 2,
      );
    }
  }
}

function drawFormalPatternHeader(
  context: CanvasRenderingContext2D,
  options: {
    name: string;
    beadGrid: BeadGrid;
    colorStats: ReturnType<typeof buildColorStats>;
    left: number;
    top: number;
    width: number;
    height: number;
  },
) {
  const { name, beadGrid, colorStats, left, top, width, height } = options;
  const filledCount = colorStats.reduce((sum, item) => sum + item.count, 0);
  const generatedAt = new Date().toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  context.fillStyle = "rgba(255, 251, 246, 0.96)";
  context.fillRect(left, top, width, height);
  context.strokeStyle = "#d4c5b3";
  context.lineWidth = 1;
  context.strokeRect(left, top, width, height);

  context.fillStyle = "#3b342c";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.font = '700 24px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
  context.fillText(name, left + 18, top + 16);

  context.fillStyle = "#7a6c5b";
  context.font = '12px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
  context.fillText(
    `图纸 ${beadGrid.width} x ${beadGrid.height}  ·  用色 ${colorStats.length}  ·  实心 ${filledCount}  ·  导出 ${generatedAt}`,
    left + 18,
    top + 54,
  );

  context.strokeStyle = "rgba(141, 128, 111, 0.28)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(left + 18, top + 76);
  context.lineTo(left + width - 18, top + 76);
  context.stroke();

  const topColors = colorStats.slice(0, 3);
  if (topColors.length === 0) {
    return;
  }

  context.fillStyle = "#7a6c5b";
  context.font = '11px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
  context.fillText("主要颜色", left + 18, top + 90);

  topColors.forEach((item, index) => {
    const rowLeft = left + 88 + index * 164;
    const rowTop = top + 84;
    const swatchTop = rowTop + 5;
    const rowCenterY = rowTop + 13;
    context.fillStyle = item.color.hex;
    context.fillRect(rowLeft, swatchTop, 16, 16);
    context.strokeStyle = "rgba(38, 34, 28, 0.12)";
    context.strokeRect(rowLeft, swatchTop, 16, 16);
    context.fillStyle = "#3b342c";
    context.textBaseline = "middle";
    context.font = '600 11px "IBM Plex Mono", monospace';
    context.fillText(item.color.id, rowLeft + 24, rowCenterY);
    context.fillStyle = "#7a6c5b";
    context.font = '10px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
    context.fillText(`${item.color.name} · ${item.count}`, rowLeft + 58, rowCenterY);
    context.textBaseline = "top";
  });
}

function drawFormalPatternFooter(
  context: CanvasRenderingContext2D,
  options: {
    beadGrid: BeadGrid;
    colorStats: ReturnType<typeof buildColorStats>;
    left: number;
    top: number;
    width: number;
    height: number;
    columns: number;
  },
) {
  const { beadGrid, colorStats, left, top, width, height, columns } = options;
  const totalFilled = colorStats.reduce((sum, item) => sum + item.count, 0);
  const totalCells = beadGrid.width * beadGrid.height;

  context.fillStyle = "rgba(255, 251, 246, 0.96)";
  context.fillRect(left, top, width, height);
  context.strokeStyle = "#d4c5b3";
  context.lineWidth = 1;
  context.strokeRect(left, top, width, height);

  context.fillStyle = "#3b342c";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.font = '700 14px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
  context.fillText("颜色与统计", left + 16, top + 12);

  context.fillStyle = "#7a6c5b";
  context.font = '11px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
  context.fillText(
    `总格数 ${totalCells} / 实心格 ${totalFilled} / 空白格 ${totalCells - totalFilled}`,
    left + 16,
    top + 32,
  );

  context.strokeStyle = "rgba(141, 128, 111, 0.28)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(left + 16, top + 50);
  context.lineTo(left + width - 16, top + 50);
  context.stroke();

  const legendTop = top + 58;
  const legendWidth = width - 32;
  const columnGap = 12;
  const columnWidth = (legendWidth - columnGap * (columns - 1)) / columns;

  colorStats.forEach((item, index) => {
    const columnIndex = index % columns;
    const rowIndex = Math.floor(index / columns);
    const itemLeft = left + 16 + columnIndex * (columnWidth + columnGap);
    const itemTop = legendTop + rowIndex * EXPORT_LEGEND_ITEM_HEIGHT;
    const rowCenterY = itemTop + 17;

    if (rowIndex % 2 === 0) {
      context.fillStyle = "rgba(255, 253, 248, 0.72)";
      context.fillRect(itemLeft, itemTop, columnWidth, 34);
    }

    context.fillStyle = item.color.hex;
    context.fillRect(itemLeft + 10, itemTop + 10, 14, 14);
    context.strokeStyle = "rgba(38, 34, 28, 0.16)";
    context.strokeRect(itemLeft + 10, itemTop + 10, 14, 14);

    context.fillStyle = "#3b342c";
    context.textBaseline = "middle";
    context.font = '600 11px "IBM Plex Mono", monospace';
    context.fillText(item.color.id, itemLeft + 32, rowCenterY);

    context.fillStyle = "#7a6c5b";
    context.font = '10px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
    context.fillText(item.color.name, itemLeft + 72, rowCenterY);
    context.textAlign = "right";
    context.fillText(
      `${item.count} / ${(item.ratio * 100).toFixed(1)}%`,
      itemLeft + columnWidth - 10,
      rowCenterY,
    );
    context.textAlign = "left";
    context.textBaseline = "top";

    context.strokeStyle = "rgba(212, 197, 179, 0.42)";
    context.beginPath();
    context.moveTo(itemLeft, itemTop + 34);
    context.lineTo(itemLeft + columnWidth, itemTop + 34);
    context.stroke();
  });
}

function getLegendColumnCount(legendWidth: number, colorCount: number) {
  if (colorCount <= 4) {
    return 1;
  }

  if (legendWidth >= 860 && colorCount > 10) {
    return 3;
  }

  if (legendWidth >= 560 && colorCount > 5) {
    return 2;
  }

  return 1;
}


function getReadableTextColor(rgb: [number, number, number]) {
  const luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  return luminance >= 160 ? "#42372f" : "#fffaf3";
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败。"));
    image.src = src;
  });
}

function renderSourceToSampleSurface(options: {
  canvas: CanvasSize;
  image: HTMLImageElement;
  imageTransform: ViewTransform;
}) {
  const maxGridSide = Math.max(options.canvas.width, options.canvas.height);
  const scaleFactor = Math.max(2, Math.ceil(BASE_STAGE_SAMPLE_SIZE / Math.max(1, maxGridSide)));
  const sampleWidth = Math.max(options.canvas.width * scaleFactor, options.canvas.width);
  const sampleHeight = Math.max(options.canvas.height * scaleFactor, options.canvas.height);
  const offscreen = document.createElement("canvas");
  offscreen.width = sampleWidth;
  offscreen.height = sampleHeight;
  const context = offscreen.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("无法初始化图像采样画布。");
  }

  context.clearRect(0, 0, offscreen.width, offscreen.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, offscreen.width, offscreen.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const baseScale = Math.min(
    offscreen.width / options.image.width,
    offscreen.height / options.image.height,
  );
  const drawWidth = options.image.width * baseScale * options.imageTransform.scale;
  const drawHeight = options.image.height * baseScale * options.imageTransform.scale;
  const drawX =
    (offscreen.width - drawWidth) / 2 + options.imageTransform.offsetX * scaleFactor;
  const drawY =
    (offscreen.height - drawHeight) / 2 + options.imageTransform.offsetY * scaleFactor;

  context.drawImage(options.image, drawX, drawY, drawWidth, drawHeight);

  return {
    scaleFactor,
    imageData: context.getImageData(0, 0, offscreen.width, offscreen.height),
  };
}

export function replaceEdgeColor(
  beadGrid: BeadGrid | null,
  fromColorIndex: number,
  toColorIndex: number,
) {
  if (!beadGrid || fromColorIndex < 0 || toColorIndex < 0 || fromColorIndex === toColorIndex) {
    return beadGrid;
  }

  const nextCells = new Uint16Array(beadGrid.cells);
  let changed = false;
  const { width, height } = beadGrid;
  const exteriorMask = buildExteriorEmptyMask(beadGrid);
  const edgeBandMask = buildEdgeBandMask(beadGrid, exteriorMask, 2);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (nextCells[index] !== fromColorIndex) {
        continue;
      }

      const neighborhood = collectNeighborColors(nextCells, width, height, x, y);
      const sameColorCount = neighborhood.filter((colorIndex) => colorIndex === fromColorIndex).length;
      const touchesExterior = touchesExteriorMask(width, height, x, y, exteriorMask);
      const insideEdgeBand = edgeBandMask[index] === 1;

      if ((touchesExterior || insideEdgeBand) && sameColorCount <= 4) {
        nextCells[index] = toColorIndex;
        changed = true;
      }
    }
  }

  if (!changed) {
    return beadGrid;
  }

  return {
    ...beadGrid,
    cells: nextCells,
  };
}

function buildExteriorEmptyMask(beadGrid: BeadGrid) {
  const { width, height, cells } = beadGrid;
  const mask = new Uint8Array(width * height);
  const queue: number[] = [];
  const borderBackgroundColorIndex = findConnectedBorderBackgroundColor(beadGrid);

  function enqueue(index: number) {
    if (index < 0 || index >= cells.length || mask[index]) {
      return;
    }

    const colorIndex = cells[index];
    const isExterior =
      colorIndex === EMPTY_CELL ||
      (borderBackgroundColorIndex !== null && colorIndex === borderBackgroundColorIndex);

    if (!isExterior) {
      return;
    }

    mask[index] = 1;
    queue.push(index);
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + (width - 1));
  }

  while (queue.length > 0) {
    const index = queue.shift()!;
    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  return mask;
}

function buildEdgeBandMask(
  beadGrid: BeadGrid,
  exteriorMask: Uint8Array,
  depth: number,
) {
  const { width, height, cells } = beadGrid;
  const mask = new Uint8Array(width * height);
  const distance = new Int16Array(width * height);
  distance.fill(-1);
  const queue: number[] = [];

  for (let index = 0; index < cells.length; index += 1) {
    if (cells[index] === EMPTY_CELL) {
      continue;
    }

    const x = index % width;
    const y = Math.floor(index / width);

    if (touchesExteriorMask(width, height, x, y, exteriorMask)) {
      mask[index] = 1;
      distance[index] = 0;
      queue.push(index);
    }
  }

  while (queue.length > 0) {
    const index = queue.shift()!;
    const currentDistance = distance[index];
    if (currentDistance >= depth - 1) {
      continue;
    }

    const x = index % width;
    const y = Math.floor(index / width);
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ] as const;

    for (const [nextX, nextY] of neighbors) {
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
        continue;
      }

      const nextIndex = nextY * width + nextX;
      if (cells[nextIndex] === EMPTY_CELL || distance[nextIndex] !== -1) {
        continue;
      }

      distance[nextIndex] = currentDistance + 1;
      mask[nextIndex] = 1;
      queue.push(nextIndex);
    }
  }

  return mask;
}

function touchesExteriorMask(
  width: number,
  height: number,
  x: number,
  y: number,
  exteriorMask: Uint8Array,
) {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) {
        continue;
      }

      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
        return true;
      }

      if (exteriorMask[nextY * width + nextX]) {
        return true;
      }
    }
  }

  return false;
}

function collectNeighborColors(
  cells: Uint16Array,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const neighbors: number[] = [];
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) {
        continue;
      }
      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
        neighbors.push(EMPTY_CELL);
        continue;
      }
      neighbors.push(cells[nextY * width + nextX]);
    }
  }
  return neighbors;
}

function sampleGridFromImageData(options: {
  canvas: CanvasSize;
  imageData: ImageData;
}) {
  const { canvas, imageData } = options;
  const samples = new Array<
    | {
        r: number;
        g: number;
        b: number;
        a: number;
      }
    | null
  >(canvas.width * canvas.height).fill(null);

  const cellWidth = imageData.width / canvas.width;
  const cellHeight = imageData.height / canvas.height;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const startX = Math.floor(x * cellWidth);
      const endX = Math.max(startX + 1, Math.ceil((x + 1) * cellWidth));
      const startY = Math.floor(y * cellHeight);
      const endY = Math.max(startY + 1, Math.ceil((y + 1) * cellHeight));

      let alphaWeight = 0;
      let weightedR = 0;
      let weightedG = 0;
      let weightedB = 0;
      let visiblePixelCount = 0;
      const histogram = new Map<string, number>();

      for (let sampleY = startY; sampleY < endY; sampleY += 1) {
        for (let sampleX = startX; sampleX < endX; sampleX += 1) {
          const offset = (sampleY * imageData.width + sampleX) * 4;
          const alpha = imageData.data[offset + 3];
          if (alpha < MIN_VISIBLE_ALPHA) {
            continue;
          }

          const weight = alpha / 255;
          const r = imageData.data[offset];
          const g = imageData.data[offset + 1];
          const b = imageData.data[offset + 2];

          alphaWeight += weight;
          weightedR += r * weight;
          weightedG += g * weight;
          weightedB += b * weight;
          visiblePixelCount += 1;

          const key = `${Math.round(r / 16)}-${Math.round(g / 16)}-${Math.round(b / 16)}`;
          histogram.set(key, (histogram.get(key) ?? 0) + 1);
        }
      }

      const index = y * canvas.width + x;

      if (visiblePixelCount === 0 || alphaWeight <= 0.12) {
        samples[index] = null;
        continue;
      }

      const averageColor: [number, number, number] = [
        weightedR / alphaWeight,
        weightedG / alphaWeight,
        weightedB / alphaWeight,
      ];

      const dominantBucket = Array.from(histogram.entries()).sort(
        (left, right) => right[1] - left[1],
      )[0];

      if (dominantBucket && dominantBucket[1] / visiblePixelCount >= 0.52) {
        const [bucketR, bucketG, bucketB] = dominantBucket[0]
          .split("-")
          .map((value) => Number(value) * 16 - 8);
        samples[index] = {
          r: clampChannel(averageColor[0] * 0.35 + bucketR * 0.65),
          g: clampChannel(averageColor[1] * 0.35 + bucketG * 0.65),
          b: clampChannel(averageColor[2] * 0.35 + bucketB * 0.65),
          a: alphaWeight / visiblePixelCount,
        };
        continue;
      }

      samples[index] = {
        r: clampChannel(averageColor[0]),
        g: clampChannel(averageColor[1]),
        b: clampChannel(averageColor[2]),
        a: alphaWeight / visiblePixelCount,
      };
    }
  }

  return {
    width: canvas.width,
    height: canvas.height,
    samples,
  };
}

function stripConnectedNearWhiteBackground(sampledGrid: {
  width: number;
  height: number;
  samples: Array<{ r: number; g: number; b: number; a: number } | null>;
}) {
  const { width, height, samples } = sampledGrid;
  const backgroundMask = new Uint8Array(width * height);
  const queue: number[] = [];

  function enqueue(index: number) {
    if (index < 0 || index >= samples.length || backgroundMask[index]) {
      return;
    }

    const sample = samples[index];
    if (!sample || !isEdgeConnectedWhiteSample(sample)) {
      return;
    }

    backgroundMask[index] = 1;
    queue.push(index);
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + (width - 1));
  }

  if (queue.length === 0) {
    return sampledGrid;
  }

  while (queue.length > 0) {
    const index = queue.shift()!;
    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  const nextSamples = [...samples];
  let changed = false;

  for (let index = 0; index < nextSamples.length; index += 1) {
    if (backgroundMask[index] === 1 && nextSamples[index] !== null) {
      nextSamples[index] = null;
      changed = true;
    }
  }

  if (!changed) {
    return sampledGrid;
  }

  return {
    width,
    height,
    samples: nextSamples,
  };
}

function isEdgeConnectedWhiteSample(sample: { r: number; g: number; b: number; a: number }) {
  const maxChannel = Math.max(sample.r, sample.g, sample.b);
  const minChannel = Math.min(sample.r, sample.g, sample.b);
  const luma = (sample.r + sample.g + sample.b) / 3;
  const chroma = maxChannel - minChannel;

  return luma >= EDGE_CONNECTED_WHITE_LUMA_MIN && chroma <= EDGE_CONNECTED_WHITE_CHROMA_MAX;
}

function quantizeNearest(
  sampledGrid: {
    width: number;
    height: number;
    samples: Array<{ r: number; g: number; b: number; a: number } | null>;
  },
  enabledPaletteIndices: number[],
): BeadGrid {
  const cells = new Uint16Array(sampledGrid.width * sampledGrid.height);

  for (let index = 0; index < sampledGrid.samples.length; index += 1) {
    const sample = sampledGrid.samples[index];
    if (!sample) {
      cells[index] = EMPTY_CELL;
      continue;
    }

    cells[index] = findNearestPaletteIndex(sample.r, sample.g, sample.b, enabledPaletteIndices);
  }

  return {
    width: sampledGrid.width,
    height: sampledGrid.height,
    cells,
  };
}

function findNearestPaletteIndex(
  red: number,
  green: number,
  blue: number,
  enabledPaletteIndices: number[],
) {
  let bestIndex = enabledPaletteIndices[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const index of enabledPaletteIndices) {
    const paletteColor = defaultPalette[index];
    const deltaR = red - paletteColor.rgb[0];
    const deltaG = green - paletteColor.rgb[1];
    const deltaB = blue - paletteColor.rgb[2];
    const distance = deltaR * deltaR + deltaG * deltaG + deltaB * deltaB;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function clampChannel(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
