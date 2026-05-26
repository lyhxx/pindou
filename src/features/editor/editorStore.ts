import { create } from "zustand";
import type {
  BeadGrid,
  CanvasSize,
  DitheringMode,
  EditorTool,
  ProjectState,
  RectSelection,
  SerializedProjectFile,
  SourceImage,
  ViewTransform,
} from "../../shared/types/project";
import { EMPTY_CELL } from "../../shared/types/project";
import {
  defaultPalette,
  defaultPaletteIds,
  findPaletteColorById,
  findPaletteIndexById,
  normalizeEnabledPaletteIds,
} from "../palette/palette";
import { generateBeadGrid, trimBeadGrid } from "./quantizeImage";

type HistoryEntry = {
  beadGrid: BeadGrid | null;
  canvas: CanvasSize;
  currentSelection: RectSelection | null;
  stageViewport: ViewTransform;
};

type SelectionClipboard = {
  width: number;
  height: number;
  cells: Uint16Array;
};

type EditorStoreState = ProjectState & {
  selectionClipboard: SelectionClipboard | null;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  lastSavedAt: string | null;
};

type EditorStore = EditorStoreState & {
  setCanvasSize: (canvas: CanvasSize) => void;
  setSourceImage: (image: SourceImage | null) => void;
  setBeadGrid: (grid: BeadGrid | null) => void;
  setCurrentSelection: (selection: RectSelection | null) => void;
  clearSelection: () => void;
  setImageTransform: (transform: Partial<ViewTransform>) => void;
  nudgeImageTransform: (dx: number, dy: number) => void;
  resetImageTransform: () => void;
  setStageViewport: (transform: Partial<ViewTransform>) => void;
  resetStageViewport: () => void;
  fitStageToCanvas: () => void;
  setDithering: (mode: DitheringMode) => void;
  setRemoveBackground: (enabled: boolean) => void;
  setTolerance: (tolerance: number) => void;
  setTool: (tool: EditorTool) => void;
  setShowGrid: (showGrid: boolean) => void;
  setActiveColorId: (colorId: string) => void;
  togglePaletteColor: (colorId: string) => void;
  enableAllPaletteColors: () => void;
  disableAllPaletteColors: () => void;
  resetPaletteSelection: () => void;
  createNewProject: (options?: { name?: string; canvas?: CanvasSize }) => void;
  importProjectFile: (projectFile: SerializedProjectFile) => void;
  generatePattern: () => Promise<void>;
  trimToDrawing: () => void;
  wrapDrawingWithPadding: (padding: number) => void;
  centerDrawing: () => void;
  paintCell: (x: number, y: number) => void;
  eraseCell: (x: number, y: number) => void;
  fillArea: (x: number, y: number) => void;
  fillSelection: (selection: RectSelection) => void;
  eraseSelection: (selection: RectSelection) => void;
  moveSelection: (selection: RectSelection, deltaX: number, deltaY: number) => void;
  copySelection: (selection: RectSelection) => void;
  cutSelection: (selection: RectSelection) => void;
  pasteSelection: () => void;
  replaceColor: (fromColorId: string, toColorId: string) => void;
  pickCellColor: (x: number, y: number) => void;
  undo: () => void;
  redo: () => void;
};
type LegacyStoredProjectRecord = {
  id: string;
  savedAt: string;
  project: SerializedProjectFile["project"];
};

type LegacyStoredProjectLibrary = {
  version: 1;
  currentProjectId: string;
  projects: LegacyStoredProjectRecord[];
};

const STORAGE_KEY = "pindou.editor.document.v1";
const LEGACY_STORAGE_KEY = "pindou.editor.library.v1";

const defaultViewTransform: ViewTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

const MIN_CANVAS_DIMENSION = 1;
const MAX_CANVAS_DIMENSION = 300;

const initialState: ProjectState = {
  name: "未命名拼豆图",
  canvas: {
    width: 120,
    height: 120,
  },
  sourceImage: null,
  beadGrid: null,
  currentSelection: null,
  imageTransform: defaultViewTransform,
  stageViewport: defaultViewTransform,
  processing: {
    removeBackground: false,
    tolerance: 24,
    dithering: "none",
  },
  enabledPaletteIds: [...defaultPaletteIds],
  activeTool: "paint",
  activeColorId: defaultPalette[2].id,
  showGrid: true,
};

const hydratedProject = loadStoredProject();
const derivedState = deriveStateFromProject(hydratedProject);

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...derivedState,
  setCanvasSize: (canvas) =>
    set((state) => {
      const nextCanvas = sanitizeCanvasSize(canvas);
      const nextGrid = resizeGridPreservingContent(state.beadGrid, nextCanvas);

      return mergePersistedState(
        persistProjectState({
          ...state,
          canvas: nextCanvas,
          beadGrid: nextGrid,
          currentSelection: null,
          stageViewport: defaultViewTransform,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
        }),
        {
          selectionClipboard: state.selectionClipboard,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
        },
      );
    }),
  setSourceImage: (sourceImage) =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          sourceImage,
          currentSelection: null,
          imageTransform: defaultViewTransform,
          stageViewport: defaultViewTransform,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
        }),
        {
          selectionClipboard: state.selectionClipboard,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
        },
      ),
    ),
  setBeadGrid: (beadGrid) =>
    set((state) =>
      mergePersistedState(
        persistProjectState({ ...state, beadGrid, currentSelection: null }),
        state,
      ),
    ),
  setCurrentSelection: (currentSelection) =>
    set((state) =>
      mergePersistedState(
        persistProjectState({ ...state, currentSelection }),
        state,
      ),
    ),
  clearSelection: () =>
    set((state) =>
      mergePersistedState(
        persistProjectState({ ...state, currentSelection: null }),
        state,
      ),
    ),
  setImageTransform: (transform) =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          imageTransform: {
            ...state.imageTransform,
            ...transform,
          },
          currentSelection: null,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
        }),
        {
          selectionClipboard: state.selectionClipboard,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
        },
      ),
    ),
  nudgeImageTransform: (dx, dy) =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          imageTransform: {
            ...state.imageTransform,
            offsetX: state.imageTransform.offsetX + dx,
            offsetY: state.imageTransform.offsetY + dy,
          },
          currentSelection: null,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
        }),
        {
          selectionClipboard: state.selectionClipboard,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
        },
      ),
    ),
  resetImageTransform: () =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          imageTransform: defaultViewTransform,
          currentSelection: null,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
        }),
        {
          selectionClipboard: state.selectionClipboard,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
        },
      ),
    ),
  setStageViewport: (transform) =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          stageViewport: {
            ...state.stageViewport,
            ...transform,
          },
        }),
        state,
      ),
    ),
  resetStageViewport: () =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          stageViewport: defaultViewTransform,
        }),
        state,
      ),
    ),
  fitStageToCanvas: () =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          stageViewport: defaultViewTransform,
        }),
        state,
      ),
    ),
  setDithering: (mode) =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          processing: {
            ...state.processing,
            dithering: mode,
          },
          currentSelection: null,
        }),
        state,
      ),
    ),
  setRemoveBackground: (enabled) =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          processing: {
            ...state.processing,
            removeBackground: enabled,
          },
          currentSelection: null,
        }),
        state,
      ),
    ),
  setTolerance: (tolerance) =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          processing: {
            ...state.processing,
            tolerance,
          },
          currentSelection: null,
        }),
        state,
      ),
    ),
  setTool: (activeTool) =>
    set((state) =>
      mergePersistedState(persistProjectState({ ...state, activeTool }), state),
    ),
  setShowGrid: (showGrid) =>
    set((state) =>
      mergePersistedState(persistProjectState({ ...state, showGrid }), state),
    ),
  setActiveColorId: (activeColorId) =>
    set((state) => {
      const normalized = normalizeEnabledPaletteIds(state.enabledPaletteIds);

      if (!normalized.includes(activeColorId)) {
        return state;
      }

      return mergePersistedState(
        persistProjectState({ ...state, activeColorId }),
        state,
      );
    }),
  togglePaletteColor: (colorId) =>
    set((state) => {
      const normalized = normalizeEnabledPaletteIds(state.enabledPaletteIds);
      const isEnabled = normalized.includes(colorId);
      const nextEnabledPaletteIds = isEnabled
        ? normalized.filter((id) => id !== colorId)
        : [...normalized, colorId];

      if (nextEnabledPaletteIds.length === 0) {
        return state;
      }

      const nextActiveColorId = nextEnabledPaletteIds.includes(state.activeColorId)
        ? state.activeColorId
        : nextEnabledPaletteIds[0];

      return mergePersistedState(
        persistProjectState({
          ...state,
          enabledPaletteIds: nextEnabledPaletteIds,
          activeColorId: nextActiveColorId,
          currentSelection: null,
        }),
        state,
      );
    }),
  enableAllPaletteColors: () =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          enabledPaletteIds: [...defaultPaletteIds],
        }),
        state,
      ),
    ),
  disableAllPaletteColors: () =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          enabledPaletteIds: [state.activeColorId],
        }),
        state,
      ),
    ),
  resetPaletteSelection: () =>
    set((state) =>
      mergePersistedState(
        persistProjectState({
          ...state,
          enabledPaletteIds: [...defaultPaletteIds],
          activeColorId: state.activeColorId || defaultPaletteIds[0],
          currentSelection: null,
        }),
        state,
      ),
    ),
  createNewProject: (options) =>
    set(() => {
      const fresh = buildFreshEditorState({
        name: options?.name ?? createProjectName(),
        canvas: options?.canvas,
      });
      return persistProjectState(fresh);
    }),
  importProjectFile: (projectFile) =>
    set(() => persistProjectState(deserializeProjectFile(projectFile))),
  generatePattern: async () => {
    const state = get();

    if (!state.sourceImage) {
      return;
    }

    const beadGrid = await generateBeadGrid({
      canvas: state.canvas,
      sourceImage: state.sourceImage,
      imageTransform: state.imageTransform,
      dithering: state.processing.dithering,
      removeBackground: state.processing.removeBackground,
      tolerance: state.processing.tolerance,
      enabledPaletteIds: state.enabledPaletteIds,
    });

    set((currentState) =>
      persistProjectState(
        pushHistoryState(currentState, {
          beadGrid,
          canvas: state.canvas,
        }),
      ),
    );
  },
  trimToDrawing: () =>
    set((state) => {
      const trimmedGrid = trimBeadGrid(state.beadGrid);
      if (!trimmedGrid) {
        return state;
      }

      if (
        state.beadGrid &&
        trimmedGrid.width === state.beadGrid.width &&
        trimmedGrid.height === state.beadGrid.height
      ) {
        return state;
      }

      return persistProjectState(
        pushHistoryState(state, {
          beadGrid: trimmedGrid,
          canvas: {
            width: trimmedGrid.width,
            height: trimmedGrid.height,
          },
          stageViewport: defaultViewTransform,
        }),
      );
    }),
  wrapDrawingWithPadding: (padding) =>
    set((state) => {
      const normalizedPadding = clampNumber(Math.round(padding), 0, 50);
      const contentBounds = findOccupiedBounds(state.beadGrid);

      if (!contentBounds || !state.beadGrid) {
        return state;
      }

      const contentGrid = cropGridToBounds(state.beadGrid, contentBounds);
      const nextWidth = clampCanvasDimension(contentGrid.width + normalizedPadding * 2);
      const nextHeight = clampCanvasDimension(contentGrid.height + normalizedPadding * 2);
      const offsetX = Math.max(0, Math.floor((nextWidth - contentGrid.width) / 2));
      const offsetY = Math.max(0, Math.floor((nextHeight - contentGrid.height) / 2));
      const nextGrid = createEmptyGrid({
        width: nextWidth,
        height: nextHeight,
      });

      blitGrid(nextGrid, contentGrid, offsetX, offsetY);

      return persistProjectState(
        pushHistoryState(state, {
          beadGrid: nextGrid,
          canvas: {
            width: nextWidth,
            height: nextHeight,
          },
          currentSelection: null,
          stageViewport: defaultViewTransform,
        }),
      );
    }),
  centerDrawing: () =>
    set((state) => {
      const contentBounds = findOccupiedBounds(state.beadGrid);

      if (!contentBounds || !state.beadGrid) {
        return state;
      }

      const contentGrid = cropGridToBounds(state.beadGrid, contentBounds);
      const nextWidth = Math.max(state.canvas.width, contentGrid.width);
      const nextHeight = Math.max(state.canvas.height, contentGrid.height);
      const nextGrid = createEmptyGrid({
        width: nextWidth,
        height: nextHeight,
      });
      const offsetX = Math.max(0, Math.floor((nextWidth - contentGrid.width) / 2));
      const offsetY = Math.max(0, Math.floor((nextHeight - contentGrid.height) / 2));

      blitGrid(nextGrid, contentGrid, offsetX, offsetY);

      const canvasChanged =
        nextWidth !== state.canvas.width || nextHeight !== state.canvas.height;
      const gridChanged =
        nextGrid.width !== state.beadGrid.width ||
        nextGrid.height !== state.beadGrid.height ||
        !typedArraysEqual(nextGrid.cells, state.beadGrid.cells);

      if (!canvasChanged && !gridChanged) {
        return state;
      }

      return persistProjectState(
        pushHistoryState(state, {
          beadGrid: nextGrid,
          canvas: {
            width: nextWidth,
            height: nextHeight,
          },
          currentSelection: null,
          stageViewport: defaultViewTransform,
        }),
      );
    }),
  paintCell: (x, y) =>
    set((state) => {
      const paletteIndex = findPaletteIndexById(state.activeColorId);
      if (paletteIndex < 0) {
        return state;
      }

      const nextGrid = state.beadGrid ?? createEmptyGrid(state.canvas);
      const cells = new Uint16Array(nextGrid.cells);
      const index = y * nextGrid.width + x;

      if (index < 0 || index >= cells.length || cells[index] === paletteIndex) {
        return state;
      }

      cells[index] = paletteIndex;

      return persistProjectState(
        pushHistoryState(state, {
          beadGrid: {
            ...nextGrid,
            cells,
          },
          canvas: state.canvas,
          currentSelection: null,
        }),
      );
    }),
  eraseCell: (x, y) =>
    set((state) => {
      if (!state.beadGrid) {
        return state;
      }

      const cells = new Uint16Array(state.beadGrid.cells);
      const index = y * state.beadGrid.width + x;

      if (index < 0 || index >= cells.length || cells[index] === EMPTY_CELL) {
        return state;
      }

      cells[index] = EMPTY_CELL;

      return persistProjectState(
        pushHistoryState(state, {
          beadGrid: {
            ...state.beadGrid,
            cells,
          },
          canvas: state.canvas,
          currentSelection: null,
        }),
      );
    }),
  fillArea: (x, y) =>
    set((state) => {
      const paletteIndex = findPaletteIndexById(state.activeColorId);
      if (paletteIndex < 0) {
        return state;
      }

      const nextGrid = state.beadGrid ?? createEmptyGrid(state.canvas);
      const cells = new Uint16Array(nextGrid.cells);
      const startIndex = y * nextGrid.width + x;
      const targetColor = cells[startIndex];

      if (startIndex < 0 || startIndex >= cells.length || targetColor === paletteIndex) {
        return state;
      }

      floodFillCells(cells, nextGrid.width, nextGrid.height, x, y, targetColor, paletteIndex);

      return persistProjectState(
        pushHistoryState(state, {
          beadGrid: {
            ...nextGrid,
            cells,
          },
          canvas: state.canvas,
          currentSelection: null,
        }),
      );
    }),
  fillSelection: (selection) =>
    set((state) => {
      const paletteIndex = findPaletteIndexById(state.activeColorId);
      if (paletteIndex < 0) {
        return state;
      }

      const nextGrid = state.beadGrid ?? createEmptyGrid(state.canvas);
      const cells = new Uint16Array(nextGrid.cells);
      const rect = normalizeSelection(selection, nextGrid.width, nextGrid.height);
      let changed = false;

      for (let y = rect.top; y <= rect.bottom; y += 1) {
        for (let x = rect.left; x <= rect.right; x += 1) {
          const index = y * nextGrid.width + x;
          if (cells[index] !== paletteIndex) {
            cells[index] = paletteIndex;
            changed = true;
          }
        }
      }

      if (!changed) {
        return state;
      }

      return persistProjectState(
        pushHistoryState(state, {
          beadGrid: {
            ...nextGrid,
            cells,
          },
          canvas: state.canvas,
          currentSelection: rectSelectionToStored(rect),
        }),
      );
    }),
  eraseSelection: (selection) =>
    set((state) => {
      if (!state.beadGrid) {
        return state;
      }

      const rect = normalizeSelection(selection, state.beadGrid.width, state.beadGrid.height);
      const cells = new Uint16Array(state.beadGrid.cells);
      let changed = false;

      for (let y = rect.top; y <= rect.bottom; y += 1) {
        for (let x = rect.left; x <= rect.right; x += 1) {
          const index = y * state.beadGrid.width + x;
          if (cells[index] !== EMPTY_CELL) {
            cells[index] = EMPTY_CELL;
            changed = true;
          }
        }
      }

      if (!changed) {
        return state;
      }

      return persistProjectState(
        pushHistoryState(state, {
          beadGrid: {
            ...state.beadGrid,
            cells,
          },
          canvas: state.canvas,
          currentSelection: rectSelectionToStored(rect),
        }),
      );
    }),
  moveSelection: (selection, deltaX, deltaY) =>
    set((state) => {
      if (!state.beadGrid) {
        return state;
      }

      const rect = normalizeSelection(selection, state.beadGrid.width, state.beadGrid.height);
      const offsetX = Math.round(deltaX);
      const offsetY = Math.round(deltaY);

      if (offsetX === 0 && offsetY === 0) {
        return state;
      }

      const width = rect.right - rect.left + 1;
      const height = rect.bottom - rect.top + 1;
      const sourceCells = new Uint16Array(width * height);

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          sourceCells[y * width + x] =
            state.beadGrid.cells[(rect.top + y) * state.beadGrid.width + (rect.left + x)];
        }
      }

      const cells = new Uint16Array(state.beadGrid.cells);
      let changed = false;

      for (let y = rect.top; y <= rect.bottom; y += 1) {
        for (let x = rect.left; x <= rect.right; x += 1) {
          const index = y * state.beadGrid.width + x;
          if (cells[index] !== EMPTY_CELL) {
            cells[index] = EMPTY_CELL;
            changed = true;
          }
        }
      }

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const colorIndex = sourceCells[y * width + x];
          if (colorIndex === EMPTY_CELL) {
            continue;
          }

          const targetX = rect.left + x + offsetX;
          const targetY = rect.top + y + offsetY;
          if (
            targetX < 0 ||
            targetY < 0 ||
            targetX >= state.beadGrid.width ||
            targetY >= state.beadGrid.height
          ) {
            continue;
          }

          cells[targetY * state.beadGrid.width + targetX] = colorIndex;
          changed = true;
        }
      }

      if (!changed) {
        return state;
      }

      const movedRect = clampSelectionRect(
        {
          left: rect.left + offsetX,
          top: rect.top + offsetY,
          right: rect.right + offsetX,
          bottom: rect.bottom + offsetY,
        },
        state.beadGrid.width,
        state.beadGrid.height,
      );

      return persistProjectState(
        pushHistoryState(state, {
          beadGrid: {
            ...state.beadGrid,
            cells,
          },
          canvas: state.canvas,
          currentSelection: rectSelectionToStored(movedRect),
        }),
      );
    }),
  copySelection: (selection) =>
    set((state) => {
      if (!state.beadGrid) {
        return state;
      }

      const rect = normalizeSelection(selection, state.beadGrid.width, state.beadGrid.height);
      return persistProjectState({
        ...state,
        selectionClipboard: createClipboardFromSelection(state.beadGrid, rect),
      });
    }),
  cutSelection: (selection) =>
    set((state) => {
      if (!state.beadGrid) {
        return state;
      }

      const rect = normalizeSelection(selection, state.beadGrid.width, state.beadGrid.height);
      const clipboard = createClipboardFromSelection(state.beadGrid, rect);
      const cells = new Uint16Array(state.beadGrid.cells);
      let changed = false;

      for (let y = rect.top; y <= rect.bottom; y += 1) {
        for (let x = rect.left; x <= rect.right; x += 1) {
          const index = y * state.beadGrid.width + x;
          if (cells[index] !== EMPTY_CELL) {
            cells[index] = EMPTY_CELL;
            changed = true;
          }
        }
      }

      if (!changed) {
        return persistProjectState({
          ...state,
          selectionClipboard: clipboard,
        });
      }

      return persistProjectState({
        ...pushHistoryState(state, {
          beadGrid: {
            ...state.beadGrid,
            cells,
          },
          canvas: state.canvas,
          currentSelection: rectSelectionToStored(rect),
        }),
        selectionClipboard: clipboard,
      });
    }),
  pasteSelection: () =>
    set((state) => {
      if (!state.beadGrid || !state.selectionClipboard) {
        return state;
      }

      const clipboard = state.selectionClipboard;
      const baseSelection =
        state.currentSelection ?? {
          startX: 0,
          startY: 0,
          endX: clipboard.width - 1,
          endY: clipboard.height - 1,
        };
      const baseRect = normalizeSelection(baseSelection, state.beadGrid.width, state.beadGrid.height);
      const pasteRect = clampSelectionRect(
        {
          left: baseRect.left + 1,
          top: baseRect.top + 1,
          right: baseRect.left + clipboard.width,
          bottom: baseRect.top + clipboard.height,
        },
        state.beadGrid.width,
        state.beadGrid.height,
      );
      const cells = new Uint16Array(state.beadGrid.cells);
      let changed = false;

      for (let y = 0; y < clipboard.height; y += 1) {
        for (let x = 0; x < clipboard.width; x += 1) {
          const colorIndex = clipboard.cells[y * clipboard.width + x];
          const targetX = pasteRect.left + x;
          const targetY = pasteRect.top + y;

          if (
            colorIndex === EMPTY_CELL ||
            targetX < 0 ||
            targetY < 0 ||
            targetX >= state.beadGrid.width ||
            targetY >= state.beadGrid.height
          ) {
            continue;
          }

          cells[targetY * state.beadGrid.width + targetX] = colorIndex;
          changed = true;
        }
      }

      if (!changed) {
        return state;
      }

      return persistProjectState(
        pushHistoryState(state, {
          beadGrid: {
            ...state.beadGrid,
            cells,
          },
          canvas: state.canvas,
          currentSelection: rectSelectionToStored({
            left: pasteRect.left,
            top: pasteRect.top,
            right: Math.min(state.beadGrid.width - 1, pasteRect.left + clipboard.width - 1),
            bottom: Math.min(state.beadGrid.height - 1, pasteRect.top + clipboard.height - 1),
          }),
        }),
      );
    }),
  replaceColor: (fromColorId, toColorId) =>
    set((state) => {
      if (!state.beadGrid) {
        return state;
      }

      const fromIndex = findPaletteIndexById(fromColorId);
      const toIndex = findPaletteIndexById(toColorId);

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return state;
      }

      const cells = new Uint16Array(state.beadGrid.cells);
      let changed = false;

      for (let index = 0; index < cells.length; index += 1) {
        if (cells[index] === fromIndex) {
          cells[index] = toIndex;
          changed = true;
        }
      }

      if (!changed) {
        return state;
      }

      return persistProjectState(
        pushHistoryState(state, {
          beadGrid: {
            ...state.beadGrid,
            cells,
          },
          canvas: state.canvas,
          currentSelection: state.currentSelection,
        }),
      );
    }),
  pickCellColor: (x, y) =>
    set((state) => {
      if (!state.beadGrid) {
        return state;
      }

      const index = y * state.beadGrid.width + x;
      const colorIndex = state.beadGrid.cells[index];

      if (colorIndex === EMPTY_CELL) {
        return state;
      }

      const color = defaultPalette[colorIndex];
      if (!color) {
        return state;
      }

      return persistProjectState({
        ...state,
        activeColorId: color.id,
        enabledPaletteIds: normalizeEnabledPaletteIds([
          ...state.enabledPaletteIds,
          color.id,
        ]),
      });
    }),
  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) {
        return state;
      }

      const previous = state.undoStack[state.undoStack.length - 1];
      const undoStack = state.undoStack.slice(0, -1);
      const redoEntry = snapshotState(state);
      const redoStack = [...state.redoStack, redoEntry];

      return persistProjectState({
        ...state,
        beadGrid: cloneGrid(previous.beadGrid),
        canvas: previous.canvas,
        currentSelection: previous.currentSelection ? { ...previous.currentSelection } : null,
        stageViewport: { ...previous.stageViewport },
        undoStack,
        redoStack,
        canUndo: undoStack.length > 0,
        canRedo: true,
      });
    }),
  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) {
        return state;
      }

      const next = state.redoStack[state.redoStack.length - 1];
      const redoStack = state.redoStack.slice(0, -1);
      const undoEntry = snapshotState(state);
      const undoStack = [...state.undoStack, undoEntry];

      return persistProjectState({
        ...state,
        beadGrid: cloneGrid(next.beadGrid),
        canvas: next.canvas,
        currentSelection: next.currentSelection ? { ...next.currentSelection } : null,
        stageViewport: { ...next.stageViewport },
        undoStack,
        redoStack,
        canUndo: true,
        canRedo: redoStack.length > 0,
      });
    }),
}));

function pushHistoryState(
  state: EditorStoreState,
  patch: Partial<
    Pick<EditorStoreState, "beadGrid" | "canvas" | "currentSelection" | "stageViewport">
  >,
) {
  const undoStack = [...state.undoStack, snapshotState(state)];

  return {
    ...state,
    ...patch,
    undoStack,
    redoStack: [],
    canUndo: true,
    canRedo: false,
  };
}

function snapshotState(
  state: Pick<EditorStoreState, "beadGrid" | "canvas" | "currentSelection" | "stageViewport">,
): HistoryEntry {
  return {
    beadGrid: cloneGrid(state.beadGrid),
    canvas: { ...state.canvas },
    stageViewport: { ...state.stageViewport },
    currentSelection:
      "currentSelection" in state && state.currentSelection
        ? { ...state.currentSelection }
        : null,
  };
}

function cloneGrid(beadGrid: BeadGrid | null) {
  if (!beadGrid) {
    return null;
  }

  return {
    width: beadGrid.width,
    height: beadGrid.height,
    cells: new Uint16Array(beadGrid.cells),
  };
}

function createEmptyGrid(canvas: CanvasSize): BeadGrid {
  const cells = new Uint16Array(canvas.width * canvas.height);
  cells.fill(EMPTY_CELL);

  return {
    width: canvas.width,
    height: canvas.height,
    cells,
  };
}

function resizeGridPreservingContent(
  beadGrid: BeadGrid | null,
  nextCanvas: CanvasSize,
) {
  if (!beadGrid) {
    return null;
  }

  const nextGrid = createEmptyGrid(nextCanvas);
  const width = Math.min(beadGrid.width, nextCanvas.width);
  const height = Math.min(beadGrid.height, nextCanvas.height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      nextGrid.cells[y * nextCanvas.width + x] = beadGrid.cells[y * beadGrid.width + x];
    }
  }

  return nextGrid;
}

function sanitizeCanvasSize(canvas: CanvasSize) {
  return {
    width: clampCanvasDimension(canvas.width),
    height: clampCanvasDimension(canvas.height),
  };
}

function clampCanvasDimension(value: number) {
  return Math.min(
    MAX_CANVAS_DIMENSION,
    Math.max(MIN_CANVAS_DIMENSION, Math.round(value) || MIN_CANVAS_DIMENSION),
  );
}

function sanitizeProjectName(name: string | undefined) {
  const trimmed = name?.trim();

  if (!trimmed) {
    return "未命名拼豆图";
  }

  if (trimmed === "鏈懡鍚嶆嫾璞嗗浘" || trimmed === "未命名拼豆图") {
    return "未命名拼豆图";
  }

  if (trimmed.startsWith("鏂板缓鎷艰眴鍥") || trimmed.startsWith("新建拼豆图")) {
    const timeMatch = trimmed.match(/(\d{2}:\d{2})/);
    return `新建拼豆图 ${timeMatch?.[1] ?? ""}`.trim();
  }

  return trimmed;
}

function createProjectName() {
  return `新建拼豆图 ${new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function buildFreshEditorState(overrides?: Partial<ProjectState>): EditorStoreState {
  const nextEnabledPaletteIds = normalizeEnabledPaletteIds(overrides?.enabledPaletteIds);
  const nextActiveColorId =
    overrides?.activeColorId && nextEnabledPaletteIds.includes(overrides.activeColorId)
      ? overrides.activeColorId
      : nextEnabledPaletteIds[0] ?? defaultPalette[0].id;

  return {
    ...initialState,
    ...overrides,
    name: sanitizeProjectName(overrides?.name ?? initialState.name),
    canvas: sanitizeCanvasSize(overrides?.canvas ?? initialState.canvas),
    enabledPaletteIds: nextEnabledPaletteIds,
    activeColorId: nextActiveColorId,
    selectionClipboard: null,
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    lastSavedAt: null,
  };
}

function serializeProjectState(state: EditorStoreState): SerializedProjectFile {
  const savedAt = new Date().toISOString();

  return {
    version: 1,
    savedAt,
    project: {
      name: sanitizeProjectName(state.name),
      canvas: state.canvas,
      sourceImage: state.sourceImage,
      currentSelection: state.currentSelection,
      beadGrid: state.beadGrid
        ? {
            width: state.beadGrid.width,
            height: state.beadGrid.height,
            cells: Array.from(state.beadGrid.cells),
          }
        : null,
      imageTransform: state.imageTransform,
      stageViewport: state.stageViewport,
      processing: state.processing,
      enabledPaletteIds: normalizeEnabledPaletteIds(state.enabledPaletteIds),
      activeTool: state.activeTool,
      activeColorId: state.activeColorId,
      showGrid: state.showGrid,
    },
  };
}

function deserializeProjectFile(projectFile: SerializedProjectFile): EditorStoreState {
  const project = normalizeSerializedProject(projectFile.project);

  return {
    ...initialState,
    ...project,
    canvas: sanitizeCanvasSize(project.canvas),
    beadGrid: project.beadGrid
      ? {
          width: project.beadGrid.width,
          height: project.beadGrid.height,
          cells: new Uint16Array(project.beadGrid.cells),
        }
      : null,
    currentSelection: project.currentSelection ?? null,
    enabledPaletteIds: normalizeEnabledPaletteIds(project.enabledPaletteIds),
    activeColorId: project.activeColorId,
    selectionClipboard: null,
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    lastSavedAt: projectFile.savedAt,
  };
}

function normalizeSerializedProject(project: SerializedProjectFile["project"]) {
  const enabledPaletteIds = normalizeEnabledPaletteIds(project.enabledPaletteIds);
  const activeColorId = enabledPaletteIds.includes(project.activeColorId)
    ? project.activeColorId
    : enabledPaletteIds[0] ?? findPaletteColorById(defaultPalette[0].id).id;

  return {
    ...project,
    name: sanitizeProjectName(project.name),
    canvas: sanitizeCanvasSize(project.canvas),
    currentSelection: project.currentSelection ?? null,
    enabledPaletteIds,
    activeColorId,
  };
}

function persistProjectState(state: EditorStoreState) {
  const serialized = serializeProjectState(state);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  }

  const persistedState = deserializeProjectFile(serialized);

  return {
    ...persistedState,
    selectionClipboard: state.selectionClipboard,
    undoStack: state.undoStack,
    redoStack: state.redoStack,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
  };
}

function mergePersistedState(
  nextState: EditorStoreState,
  previousState: Pick<
    EditorStoreState,
    "selectionClipboard" | "undoStack" | "redoStack" | "canUndo" | "canRedo"
  >,
) {
  return {
    ...nextState,
    selectionClipboard: previousState.selectionClipboard,
    undoStack: previousState.undoStack,
    redoStack: previousState.redoStack,
    canUndo: previousState.canUndo,
    canRedo: previousState.canRedo,
  };
}

function loadStoredProject(): SerializedProjectFile | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SerializedProjectFile;
      if (parsed?.version === 1 && parsed?.project) {
        return {
          ...parsed,
          project: normalizeSerializedProject(parsed.project),
        };
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      return null;
    }

    const legacyParsed = JSON.parse(legacyRaw) as LegacyStoredProjectLibrary;
    if (
      !legacyParsed ||
      legacyParsed.version !== 1 ||
      !Array.isArray(legacyParsed.projects) ||
      legacyParsed.projects.length === 0
    ) {
      return null;
    }

    const currentRecord =
      legacyParsed.projects.find((item) => item.id === legacyParsed.currentProjectId) ??
      legacyParsed.projects[0];

    return {
      version: 1,
      savedAt: currentRecord.savedAt,
      project: normalizeSerializedProject(currentRecord.project),
    };
  } catch {
    return null;
  }
}

function deriveStateFromProject(projectFile: SerializedProjectFile | null) {
  if (!projectFile) {
    return persistProjectState(buildFreshEditorState({ name: createProjectName() }));
  }

  return persistProjectState(deserializeProjectFile(projectFile));
}

function floodFillCells(
  cells: Uint16Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  targetColor: number,
  fillColor: number,
) {
  const stack: Array<[number, number]> = [[startX, startY]];

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= width || y >= height) {
      continue;
    }

    const index = y * width + x;
    if (cells[index] !== targetColor) {
      continue;
    }

    cells[index] = fillColor;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

function normalizeSelection(selection: RectSelection, width: number, height: number) {
  return {
    left: Math.max(0, Math.min(selection.startX, selection.endX)),
    top: Math.max(0, Math.min(selection.startY, selection.endY)),
    right: Math.min(width - 1, Math.max(selection.startX, selection.endX)),
    bottom: Math.min(height - 1, Math.max(selection.startY, selection.endY)),
  };
}

function clampSelectionRect(
  rect: { left: number; top: number; right: number; bottom: number },
  width: number,
  height: number,
) {
  const selectionWidth = rect.right - rect.left;
  const selectionHeight = rect.bottom - rect.top;
  const left = clampNumber(rect.left, 0, Math.max(0, width - 1 - selectionWidth));
  const top = clampNumber(rect.top, 0, Math.max(0, height - 1 - selectionHeight));

  return {
    left,
    top,
    right: Math.min(width - 1, left + selectionWidth),
    bottom: Math.min(height - 1, top + selectionHeight),
  };
}

function createClipboardFromSelection(
  beadGrid: BeadGrid,
  rect: { left: number; top: number; right: number; bottom: number },
): SelectionClipboard {
  const width = rect.right - rect.left + 1;
  const height = rect.bottom - rect.top + 1;
  const cells = new Uint16Array(width * height);
  cells.fill(EMPTY_CELL);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells[y * width + x] =
        beadGrid.cells[(rect.top + y) * beadGrid.width + (rect.left + x)];
    }
  }

  return {
    width,
    height,
    cells,
  };
}

function rectSelectionToStored(selection: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}): RectSelection {
  return {
    startX: selection.left,
    startY: selection.top,
    endX: selection.right,
    endY: selection.bottom,
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function findOccupiedBounds(beadGrid: BeadGrid | null) {
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

  return {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
  };
}

function cropGridToBounds(
  beadGrid: BeadGrid,
  bounds: { left: number; top: number; right: number; bottom: number },
) {
  const width = bounds.right - bounds.left + 1;
  const height = bounds.bottom - bounds.top + 1;
  const cropped = createEmptyGrid({ width, height });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cropped.cells[y * width + x] =
        beadGrid.cells[(bounds.top + y) * beadGrid.width + (bounds.left + x)];
    }
  }

  return cropped;
}

function blitGrid(target: BeadGrid, source: BeadGrid, offsetX: number, offsetY: number) {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const colorIndex = source.cells[y * source.width + x];
      if (colorIndex === EMPTY_CELL) {
        continue;
      }

      const targetX = x + offsetX;
      const targetY = y + offsetY;
      if (
        targetX < 0 ||
        targetY < 0 ||
        targetX >= target.width ||
        targetY >= target.height
      ) {
        continue;
      }

      target.cells[targetY * target.width + targetX] = colorIndex;
    }
  }
}

function typedArraysEqual(left: Uint16Array, right: Uint16Array) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

