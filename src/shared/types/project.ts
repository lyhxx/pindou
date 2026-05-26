export type EditorTool = "paint" | "erase" | "picker" | "pan" | "fill" | "select";

export type DitheringMode = "none" | "floyd-steinberg";

export type CanvasSize = {
  width: number;
  height: number;
};

export type ViewTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type RectSelection = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type PaletteColor = {
  id: string;
  name: string;
  hex: string;
  rgb: [number, number, number];
};

export type BeadGrid = {
  width: number;
  height: number;
  cells: Uint16Array;
};

export type SerializedBeadGrid = {
  width: number;
  height: number;
  cells: number[];
};

export const EMPTY_CELL = 65535;

export type SourceImage = {
  name: string;
  width: number;
  height: number;
  src: string;
};

export type ProcessingSettings = {
  removeBackground: boolean;
  tolerance: number;
  dithering: DitheringMode;
};

export type ProjectState = {
  name: string;
  canvas: CanvasSize;
  sourceImage: SourceImage | null;
  beadGrid: BeadGrid | null;
  currentSelection: RectSelection | null;
  imageTransform: ViewTransform;
  stageViewport: ViewTransform;
  processing: ProcessingSettings;
  enabledPaletteIds: string[];
  activeTool: EditorTool;
  activeColorId: string;
  showGrid: boolean;
};

export type SerializedProjectFile = {
  version: 1;
  savedAt: string;
  project: {
    name: string;
    canvas: CanvasSize;
    sourceImage: SourceImage | null;
    beadGrid: SerializedBeadGrid | null;
    currentSelection: RectSelection | null;
    imageTransform: ViewTransform;
    stageViewport: ViewTransform;
    processing: ProcessingSettings;
    enabledPaletteIds: string[];
    activeTool: EditorTool;
    activeColorId: string;
    showGrid: boolean;
  };
};
