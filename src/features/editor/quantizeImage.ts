import type {
  BeadGrid,
  CanvasSize,
  DitheringMode,
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
const EXPORT_HEADER_HEIGHT = 104;
const EXPORT_FOOTER_MIN_HEIGHT = 120;

export async function generateBeadGrid(options: {
  canvas: CanvasSize;
  sourceImage: SourceImage;
  imageTransform: ViewTransform;
  dithering: DitheringMode;
  removeBackground: boolean;
  tolerance: number;
  enabledPaletteIds: string[];
}) {
  const image = await loadImage(options.sourceImage.src);
  const sampleSurface = renderSourceToSampleSurface({
    canvas: options.canvas,
    image,
    imageTransform: options.imageTransform,
  });

  if (options.removeBackground) {
    removeSolidBackground(sampleSurface.imageData, options.tolerance);
  }

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

  const beadGrid =
    options.dithering === "floyd-steinberg"
      ? quantizeWithDithering(sampledGrid, enabledPaletteIndices)
      : quantizeNearest(sampledGrid, enabledPaletteIndices);

  return beadGrid;
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
    removeBackground: boolean;
    tolerance: number;
    dithering: DitheringMode;
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

  let minX = beadGrid.width;
  let minY = beadGrid.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < beadGrid.height; y += 1) {
    for (let x = 0; x < beadGrid.width; x += 1) {
      const colorIndex = beadGrid.cells[y * beadGrid.width + x];
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
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_MARGIN * 2 + rulerSize * 2 + paperWidth;
  canvas.height = EXPORT_MARGIN * 2 + rulerSize * 2 + paperHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法初始化图纸导出画布。");
  }

  const paperLeft = EXPORT_MARGIN + rulerSize;
  const paperTop = EXPORT_MARGIN + rulerSize;
  const paperRight = paperLeft + paperWidth;
  const paperBottom = paperTop + paperHeight;

  context.fillStyle = "#f4efe6";
  context.fillRect(0, 0, canvas.width, canvas.height);

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

  if (cellSize >= 20) {
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
  const legendColumns = colorStats.length > 12 ? 3 : colorStats.length > 6 ? 2 : 1;
  const legendRows = Math.max(1, Math.ceil(Math.max(1, colorStats.length) / legendColumns));
  const footerHeight = Math.max(EXPORT_FOOTER_MIN_HEIGHT, 64 + legendRows * 24);
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_MARGIN * 2 + rulerSize * 2 + paperWidth;
  canvas.height =
    EXPORT_MARGIN * 2 + EXPORT_HEADER_HEIGHT + rulerSize * 2 + paperHeight + footerHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法初始化图纸导出画布。");
  }

  const paperLeft = EXPORT_MARGIN + rulerSize;
  const paperTop = EXPORT_MARGIN + EXPORT_HEADER_HEIGHT + rulerSize;
  const paperRight = paperLeft + paperWidth;
  const paperBottom = paperTop + paperHeight;

  context.fillStyle = "#f4efe6";
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawFormalPatternHeader(context, {
    name,
    beadGrid,
    colorStats,
    left: EXPORT_MARGIN,
    top: EXPORT_MARGIN,
    width: canvas.width - EXPORT_MARGIN * 2,
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

  if (cellSize >= 20) {
    drawPatternCellLabels(context, beadGrid, cellSize, paperLeft, paperTop);
  }

  context.strokeStyle = "#8d806f";
  context.lineWidth = 2;
  context.strokeRect(paperLeft, paperTop, paperWidth, paperHeight);

  drawFormalPatternFooter(context, {
    beadGrid,
    colorStats,
    left: EXPORT_MARGIN,
    top: paperBottom + rulerSize + 12,
    width: canvas.width - EXPORT_MARGIN * 2,
    height: footerHeight - 12,
    columns: legendColumns,
  });

  return canvas;
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
  const labelStep = getRulerLabelStep(cellSize);

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
    if ((x + 1) % labelStep !== 0 && x !== 0 && x !== width - 1) {
      continue;
    }

    const centerX = paperLeft + x * cellSize + cellSize / 2;
    const label = String(x + 1);
    context.fillText(label, centerX, paperTop - rulerSize / 2);
    context.fillText(label, centerX, paperBottom + rulerSize / 2);
  }

  for (let y = 0; y < height; y += 1) {
    if ((y + 1) % labelStep !== 0 && y !== 0 && y !== height - 1) {
      continue;
    }

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
      : `${Math.floor(cellSize * 0.36)}px "IBM Plex Mono", monospace`;

  for (let y = 0; y < beadGrid.height; y += 1) {
    for (let x = 0; x < beadGrid.width; x += 1) {
      const colorIndex = beadGrid.cells[y * beadGrid.width + x];
      if (colorIndex === EMPTY_CELL) {
        continue;
      }

      const color = defaultPalette[colorIndex] ?? defaultPalette[0];
      const label = cellSize >= 24 ? color.id : String(colorIndex + 1);

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
  context.font = '12px "IBM Plex Mono", monospace';
  context.fillText(
    `图纸 ${beadGrid.width} x ${beadGrid.height}    用色 ${colorStats.length}    实心 ${filledCount}`,
    left + 18,
    top + 50,
  );
  context.fillText(`导出 ${generatedAt}`, left + 18, top + 70);

  const topColors = colorStats.slice(0, 2);
  const chipWidth = 118;
  const chipGap = 10;
  const startX =
    left +
    width -
    topColors.length * chipWidth -
    Math.max(0, topColors.length - 1) * chipGap -
    18;

  topColors.forEach((item, index) => {
    const chipLeft = startX + index * (chipWidth + chipGap);
    const chipTop = top + 18;
    context.fillStyle = "#fffdf8";
    context.fillRect(chipLeft, chipTop, chipWidth, 28);
    context.strokeStyle = "#d4c5b3";
    context.strokeRect(chipLeft, chipTop, chipWidth, 28);
    context.fillStyle = item.color.hex;
    context.fillRect(chipLeft + 8, chipTop + 7, 14, 14);
    context.strokeStyle = "rgba(38, 34, 28, 0.12)";
    context.strokeRect(chipLeft + 8, chipTop + 7, 14, 14);
    context.fillStyle = "#3b342c";
    context.font = '600 11px "IBM Plex Mono", monospace';
    context.fillText(item.color.id, chipLeft + 28, chipTop + 7);
    context.fillStyle = "#7a6c5b";
    context.font = '10px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
    context.fillText(String(item.count), chipLeft + 72, chipTop + 8);
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

  const legendTop = top + 58;
  const legendWidth = width - 32;
  const columnGap = 12;
  const columnWidth = (legendWidth - columnGap * (columns - 1)) / columns;

  colorStats.forEach((item, index) => {
    const columnIndex = index % columns;
    const rowIndex = Math.floor(index / columns);
    const itemLeft = left + 16 + columnIndex * (columnWidth + columnGap);
    const itemTop = legendTop + rowIndex * 24;

    context.fillStyle = item.color.hex;
    context.fillRect(itemLeft, itemTop + 4, 12, 12);
    context.strokeStyle = "rgba(38, 34, 28, 0.16)";
    context.strokeRect(itemLeft, itemTop + 4, 12, 12);

    context.fillStyle = "#3b342c";
    context.font = '600 11px "IBM Plex Mono", monospace';
    context.fillText(item.color.id, itemLeft + 18, itemTop + 2);

    context.fillStyle = "#7a6c5b";
    context.font = '10px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
    context.fillText(
      `${item.color.name} / ${item.count} / ${(item.ratio * 100).toFixed(1)}%`,
      itemLeft + 52,
      itemTop + 3,
    );
  });
}

function getRulerLabelStep(cellSize: number) {
  if (cellSize >= 24) {
    return 1;
  }

  if (cellSize >= 16) {
    return 2;
  }

  if (cellSize >= 12) {
    return 5;
  }

  return 10;
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

function removeSolidBackground(imageData: ImageData, tolerance: number) {
  const { width, height, data } = imageData;
  const samples = [
    readPixel(data, width, 0, 0),
    readPixel(data, width, width - 1, 0),
    readPixel(data, width, 0, height - 1),
    readPixel(data, width, width - 1, height - 1),
  ];
  const background = averagePixels(samples);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    if (alpha < MIN_VISIBLE_ALPHA) {
      data[offset + 3] = 0;
      continue;
    }

    const deltaR = data[offset] - background[0];
    const deltaG = data[offset + 1] - background[1];
    const deltaB = data[offset + 2] - background[2];
    const distance = Math.sqrt(deltaR * deltaR + deltaG * deltaG + deltaB * deltaB);

    if (distance <= tolerance) {
      data[offset + 3] = 0;
    }
  }
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

function quantizeWithDithering(
  sampledGrid: {
    width: number;
    height: number;
    samples: Array<{ r: number; g: number; b: number; a: number } | null>;
  },
  enabledPaletteIndices: number[],
): BeadGrid {
  const cells = new Uint16Array(sampledGrid.width * sampledGrid.height);
  const working = sampledGrid.samples.map((sample) => (sample ? { ...sample } : null));

  for (let y = 0; y < sampledGrid.height; y += 1) {
    for (let x = 0; x < sampledGrid.width; x += 1) {
      const index = y * sampledGrid.width + x;
      const sample = working[index];

      if (!sample) {
        cells[index] = EMPTY_CELL;
        continue;
      }

      const nearestIndex = findNearestPaletteIndex(
        sample.r,
        sample.g,
        sample.b,
        enabledPaletteIndices,
      );

      cells[index] = nearestIndex;

      const paletteColor = defaultPalette[nearestIndex];
      const errorR = sample.r - paletteColor.rgb[0];
      const errorG = sample.g - paletteColor.rgb[1];
      const errorB = sample.b - paletteColor.rgb[2];

      diffuseError(
        working,
        sampledGrid.width,
        sampledGrid.height,
        x + 1,
        y,
        errorR,
        errorG,
        errorB,
        7 / 16,
      );
      diffuseError(
        working,
        sampledGrid.width,
        sampledGrid.height,
        x - 1,
        y + 1,
        errorR,
        errorG,
        errorB,
        3 / 16,
      );
      diffuseError(
        working,
        sampledGrid.width,
        sampledGrid.height,
        x,
        y + 1,
        errorR,
        errorG,
        errorB,
        5 / 16,
      );
      diffuseError(
        working,
        sampledGrid.width,
        sampledGrid.height,
        x + 1,
        y + 1,
        errorR,
        errorG,
        errorB,
        1 / 16,
      );
    }
  }

  return {
    width: sampledGrid.width,
    height: sampledGrid.height,
    cells,
  };
}

function diffuseError(
  samples: Array<{ r: number; g: number; b: number; a: number } | null>,
  width: number,
  height: number,
  x: number,
  y: number,
  errorR: number,
  errorG: number,
  errorB: number,
  factor: number,
) {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }

  const sample = samples[y * width + x];
  if (!sample) {
    return;
  }

  sample.r = clampChannel(sample.r + errorR * factor);
  sample.g = clampChannel(sample.g + errorG * factor);
  sample.b = clampChannel(sample.b + errorB * factor);
}

function readPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): [number, number, number] {
  const offset = (y * width + x) * 4;
  return [data[offset], data[offset + 1], data[offset + 2]];
}

function averagePixels(pixels: Array<[number, number, number]>) {
  const total = pixels.reduce<[number, number, number]>(
    (acc, pixel) => {
      acc[0] += pixel[0];
      acc[1] += pixel[1];
      acc[2] += pixel[2];
      return acc;
    },
    [0, 0, 0],
  );

  return [
    total[0] / pixels.length,
    total[1] / pixels.length,
    total[2] / pixels.length,
  ] as [number, number, number];
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
