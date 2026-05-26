import type {
  BeadGrid,
  CanvasSize,
  DitheringMode,
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
  const offscreen = document.createElement("canvas");
  offscreen.width = options.canvas.width;
  offscreen.height = options.canvas.height;
  const context = offscreen.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("无法初始化离屏画布。");
  }

  const enabledPaletteIndices = normalizeEnabledPaletteIds(options.enabledPaletteIds)
    .map((colorId) => findPaletteIndexById(colorId))
    .filter((index): index is number => index >= 0);

  if (enabledPaletteIndices.length === 0) {
    throw new Error("至少需要启用一种颜色才能生成图纸。");
  }

  context.clearRect(0, 0, offscreen.width, offscreen.height);
  context.fillStyle = "#fffaf3";
  context.fillRect(0, 0, offscreen.width, offscreen.height);
  context.imageSmoothingEnabled = true;

  const baseScale = Math.min(
    offscreen.width / image.width,
    offscreen.height / image.height,
  );
  const drawWidth = image.width * baseScale * options.imageTransform.scale;
  const drawHeight = image.height * baseScale * options.imageTransform.scale;
  const drawX = (offscreen.width - drawWidth) / 2 + options.imageTransform.offsetX / 16;
  const drawY = (offscreen.height - drawHeight) / 2 + options.imageTransform.offsetY / 16;

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  const imageData = context.getImageData(0, 0, offscreen.width, offscreen.height);

  if (options.removeBackground) {
    removeSolidBackground(imageData, options.tolerance);
  }

  return options.dithering === "floyd-steinberg"
    ? quantizeWithDithering(imageData, enabledPaletteIndices)
    : quantizeNearest(imageData, enabledPaletteIndices);
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
  activeTool: "paint" | "erase" | "picker" | "pan";
  activeColorId: string;
  showGrid: boolean;
}) {
  const payload: SerializedProjectFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    project: {
      name: options.name,
      canvas: options.canvas,
      imageTransform: options.imageTransform,
      stageViewport: options.stageViewport,
      processing: options.processing,
      enabledPaletteIds: normalizeEnabledPaletteIds(options.enabledPaletteIds),
      sourceImage: options.sourceImage,
      activeTool: options.activeTool,
      activeColorId: options.activeColorId,
      showGrid: options.showGrid,
      beadGrid: options.beadGrid
        ? {
            width: options.beadGrid.width,
            height: options.beadGrid.height,
            cells: Array.from(options.beadGrid.cells),
          }
        : null,
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

export function exportStagePng(sourceCanvas: HTMLCanvasElement | null) {
  if (!sourceCanvas) {
    throw new Error("当前没有可导出的图纸画布。");
  }

  return sourceCanvas.toDataURL("image/png");
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

  context.fillStyle = "#fffaf3";
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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败。"));
    image.src = src;
  });
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
    const deltaR = data[offset] - background[0];
    const deltaG = data[offset + 1] - background[1];
    const deltaB = data[offset + 2] - background[2];
    const distance = Math.sqrt(deltaR * deltaR + deltaG * deltaG + deltaB * deltaB);

    if (distance <= tolerance) {
      data[offset + 3] = 0;
    }
  }
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

function quantizeNearest(imageData: ImageData, enabledPaletteIndices: number[]): BeadGrid {
  const { width, height, data } = imageData;
  const cells = new Uint16Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const pixelOffset = index * 4;

    if (data[pixelOffset + 3] === 0) {
      cells[index] = EMPTY_CELL;
      continue;
    }

    cells[index] = findNearestPaletteIndex(
      data[pixelOffset],
      data[pixelOffset + 1],
      data[pixelOffset + 2],
      enabledPaletteIndices,
    );
  }

  return { width, height, cells };
}

function quantizeWithDithering(
  imageData: ImageData,
  enabledPaletteIndices: number[],
): BeadGrid {
  const { width, height, data } = imageData;
  const working = new Float32Array(data.length);
  const cells = new Uint16Array(width * height);

  for (let index = 0; index < data.length; index += 1) {
    working[index] = data[index];
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const pixelOffset = index * 4;

      if (working[pixelOffset + 3] === 0) {
        cells[index] = EMPTY_CELL;
        continue;
      }

      const nearestIndex = findNearestPaletteIndex(
        working[pixelOffset],
        working[pixelOffset + 1],
        working[pixelOffset + 2],
        enabledPaletteIndices,
      );
      const paletteColor = defaultPalette[nearestIndex];

      cells[index] = nearestIndex;

      const errorR = working[pixelOffset] - paletteColor.rgb[0];
      const errorG = working[pixelOffset + 1] - paletteColor.rgb[1];
      const errorB = working[pixelOffset + 2] - paletteColor.rgb[2];

      diffuseError(working, width, height, x + 1, y, errorR, errorG, errorB, 7 / 16);
      diffuseError(working, width, height, x - 1, y + 1, errorR, errorG, errorB, 3 / 16);
      diffuseError(working, width, height, x, y + 1, errorR, errorG, errorB, 5 / 16);
      diffuseError(working, width, height, x + 1, y + 1, errorR, errorG, errorB, 1 / 16);
    }
  }

  return { width, height, cells };
}

function diffuseError(
  data: Float32Array,
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

  const offset = (y * width + x) * 4;

  if (data[offset + 3] === 0) {
    return;
  }

  data[offset] += errorR * factor;
  data[offset + 1] += errorG * factor;
  data[offset + 2] += errorB * factor;
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
