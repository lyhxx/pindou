import { create } from "zustand";
import type {
  BeadGrid,
  CanvasSize,
  DitheringMode,
  EditorTool,
  ProjectState,
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
import { generateBeadGrid } from "./quantizeImage";

type HistoryEntry = {
  beadGrid: BeadGrid | null;
  stageViewport: ViewTransform;
};

type StoredProjectRecord = {
  id: string;
  savedAt: string;
  project: SerializedProjectFile["project"];
};

type StoredProjectLibrary = {
  version: 1;
  currentProjectId: string;
  projects: StoredProjectRecord[];
};

type ProjectListItem = {
  id: string;
  name: string;
  savedAt: string;
  hasSourceImage: boolean;
  hasBeadGrid: boolean;
};

type EditorStoreState = ProjectState & {
  currentProjectId: string;
  projectList: ProjectListItem[];
  recentProjects: string[];
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  lastSavedAt: string | null;
};

type EditorStore = EditorStoreState & {
  setProjectName: (name: string) => void;
  renameCurrentProject: (name: string) => void;
  setCanvasSize: (canvas: CanvasSize) => void;
  setSourceImage: (image: SourceImage | null) => void;
  setBeadGrid: (grid: BeadGrid | null) => void;
  setImageTransform: (transform: Partial<ViewTransform>) => void;
  nudgeImageTransform: (dx: number, dy: number) => void;
  resetImageTransform: () => void;
  setStageViewport: (transform: Partial<ViewTransform>) => void;
  resetStageViewport: () => void;
  setDithering: (mode: DitheringMode) => void;
  setRemoveBackground: (enabled: boolean) => void;
  setTolerance: (tolerance: number) => void;
  setTool: (tool: EditorTool) => void;
  setShowGrid: (showGrid: boolean) => void;
  setActiveColorId: (colorId: string) => void;
  togglePaletteColor: (colorId: string) => void;
  enableAllPaletteColors: () => void;
  resetPaletteSelection: () => void;
  createNewProject: () => void;
  switchProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  importProjectFile: (projectFile: SerializedProjectFile) => void;
  generatePattern: () => Promise<void>;
  paintCell: (x: number, y: number) => void;
  eraseCell: (x: number, y: number) => void;
  pickCellColor: (x: number, y: number) => void;
  undo: () => void;
  redo: () => void;
  saveProject: () => void;
};

const STORAGE_KEY = "pindou.editor.library.v1";

const defaultViewTransform: ViewTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

const initialState: ProjectState = {
  name: "未命名拼豆图",
  canvas: {
    width: 120,
    height: 120,
  },
  sourceImage: null,
  beadGrid: null,
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

const hydratedLibrary = loadStoredLibrary();
const derivedState = deriveStateFromLibrary(hydratedLibrary);

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...derivedState,
  setProjectName: (name) => set((state) => persistLibraryState({ ...state, name })),
  renameCurrentProject: (name) => set((state) => persistLibraryState({ ...state, name })),
  setCanvasSize: (canvas) =>
    set((state) =>
      persistLibraryState({
        ...state,
        canvas,
        beadGrid: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
      }),
    ),
  setSourceImage: (sourceImage) =>
    set((state) =>
      persistLibraryState({
        ...state,
        sourceImage,
        beadGrid: null,
        imageTransform: defaultViewTransform,
        stageViewport: defaultViewTransform,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
      }),
    ),
  setBeadGrid: (beadGrid) => set((state) => persistLibraryState({ ...state, beadGrid })),
  setImageTransform: (transform) =>
    set((state) =>
      persistLibraryState({
        ...state,
        imageTransform: {
          ...state.imageTransform,
          ...transform,
        },
        beadGrid: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
      }),
    ),
  nudgeImageTransform: (dx, dy) =>
    set((state) =>
      persistLibraryState({
        ...state,
        imageTransform: {
          ...state.imageTransform,
          offsetX: state.imageTransform.offsetX + dx,
          offsetY: state.imageTransform.offsetY + dy,
        },
        beadGrid: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
      }),
    ),
  resetImageTransform: () =>
    set((state) =>
      persistLibraryState({
        ...state,
        imageTransform: defaultViewTransform,
        beadGrid: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
      }),
    ),
  setStageViewport: (transform) =>
    set((state) =>
      persistLibraryState({
        ...state,
        stageViewport: {
          ...state.stageViewport,
          ...transform,
        },
      }),
    ),
  resetStageViewport: () =>
    set((state) =>
      persistLibraryState({
        ...state,
        stageViewport: defaultViewTransform,
      }),
    ),
  setDithering: (mode) =>
    set((state) =>
      persistLibraryState({
        ...state,
        processing: {
          ...state.processing,
          dithering: mode,
        },
        beadGrid: null,
      }),
    ),
  setRemoveBackground: (enabled) =>
    set((state) =>
      persistLibraryState({
        ...state,
        processing: {
          ...state.processing,
          removeBackground: enabled,
        },
        beadGrid: null,
      }),
    ),
  setTolerance: (tolerance) =>
    set((state) =>
      persistLibraryState({
        ...state,
        processing: {
          ...state.processing,
          tolerance,
        },
        beadGrid: null,
      }),
    ),
  setTool: (activeTool) => set((state) => persistLibraryState({ ...state, activeTool })),
  setShowGrid: (showGrid) => set((state) => persistLibraryState({ ...state, showGrid })),
  setActiveColorId: (activeColorId) =>
    set((state) => {
      const normalized = normalizeEnabledPaletteIds(state.enabledPaletteIds);

      if (!normalized.includes(activeColorId)) {
        return state;
      }

      return persistLibraryState({ ...state, activeColorId });
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

      return persistLibraryState({
        ...state,
        enabledPaletteIds: nextEnabledPaletteIds,
        activeColorId: nextActiveColorId,
        beadGrid: null,
      });
    }),
  enableAllPaletteColors: () =>
    set((state) =>
      persistLibraryState({
        ...state,
        enabledPaletteIds: [...defaultPaletteIds],
      }),
    ),
  resetPaletteSelection: () =>
    set((state) =>
      persistLibraryState({
        ...state,
        enabledPaletteIds: [...defaultPaletteIds],
        activeColorId: state.activeColorId || defaultPaletteIds[0],
        beadGrid: null,
      }),
    ),
  createNewProject: () => set(() => persistWholeLibrary(createLibraryWithNewProject())),
  switchProject: (projectId) =>
    set((state) => {
      const library = buildLibraryFromState(state);
      if (!library.projects.some((item) => item.id === projectId)) {
        return state;
      }

      return persistWholeLibrary({
        ...library,
        currentProjectId: projectId,
      });
    }),
  deleteProject: (projectId) =>
    set((state) => {
      const library = buildLibraryFromState(state);
      const remaining = library.projects.filter((item) => item.id !== projectId);

      if (remaining.length === 0) {
        return persistWholeLibrary(createLibraryWithNewProject());
      }

      return persistWholeLibrary({
        version: 1,
        currentProjectId:
          library.currentProjectId === projectId ? remaining[0].id : library.currentProjectId,
        projects: remaining,
      });
    }),
  importProjectFile: (projectFile) =>
    set((state) => {
      const library = buildLibraryFromState(state);
      const importedRecord: StoredProjectRecord = {
        id: createProjectId(),
        savedAt: projectFile.savedAt ?? new Date().toISOString(),
        project: normalizeSerializedProject(projectFile.project),
      };

      return persistWholeLibrary({
        version: 1,
        currentProjectId: importedRecord.id,
        projects: [importedRecord, ...library.projects.filter((item) => item.id !== importedRecord.id)],
      });
    }),
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
      persistLibraryState(
        pushHistoryState(currentState, {
          beadGrid,
        }),
      ),
    );
  },
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

      return persistLibraryState(
        pushHistoryState(state, {
          beadGrid: {
            ...nextGrid,
            cells,
          },
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

      return persistLibraryState(
        pushHistoryState(state, {
          beadGrid: {
            ...state.beadGrid,
            cells,
          },
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

      return persistLibraryState({
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

      return persistLibraryState({
        ...state,
        beadGrid: cloneGrid(previous.beadGrid),
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

      return persistLibraryState({
        ...state,
        beadGrid: cloneGrid(next.beadGrid),
        stageViewport: { ...next.stageViewport },
        undoStack,
        redoStack,
        canUndo: true,
        canRedo: redoStack.length > 0,
      });
    }),
  saveProject: () => set((state) => persistLibraryState(state)),
}));

function pushHistoryState(
  state: EditorStoreState,
  patch: Partial<Pick<EditorStoreState, "beadGrid" | "stageViewport">>,
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
  state: Pick<EditorStoreState, "beadGrid" | "stageViewport">,
): HistoryEntry {
  return {
    beadGrid: cloneGrid(state.beadGrid),
    stageViewport: { ...state.stageViewport },
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

function createProjectId() {
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    enabledPaletteIds: nextEnabledPaletteIds,
    activeColorId: nextActiveColorId,
    currentProjectId: createProjectId(),
    projectList: [],
    recentProjects: [],
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    lastSavedAt: null,
  };
}

function createLibraryWithNewProject() {
  const fresh = buildFreshEditorState({ name: createProjectName() });
  const record = serializeProjectState(fresh);

  return {
    version: 1 as const,
    currentProjectId: record.id,
    projects: [record],
  };
}

function serializeProjectState(state: EditorStoreState): StoredProjectRecord {
  const savedAt = new Date().toISOString();

  return {
    id: state.currentProjectId,
    savedAt,
    project: {
      name: state.name,
      canvas: state.canvas,
      sourceImage: state.sourceImage,
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

function deserializeProjectRecord(record: StoredProjectRecord): EditorStoreState {
  const project = normalizeSerializedProject(record.project);

  return {
    ...initialState,
    ...project,
    beadGrid: project.beadGrid
      ? {
          width: project.beadGrid.width,
          height: project.beadGrid.height,
          cells: new Uint16Array(project.beadGrid.cells),
        }
      : null,
    enabledPaletteIds: normalizeEnabledPaletteIds(project.enabledPaletteIds),
    activeColorId: project.activeColorId,
    currentProjectId: record.id,
    projectList: [],
    recentProjects: [],
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    lastSavedAt: record.savedAt,
  };
}

function normalizeSerializedProject(project: SerializedProjectFile["project"]) {
  const enabledPaletteIds = normalizeEnabledPaletteIds(project.enabledPaletteIds);
  const activeColorId = enabledPaletteIds.includes(project.activeColorId)
    ? project.activeColorId
    : enabledPaletteIds[0] ?? findPaletteColorById(defaultPalette[0].id).id;

  return {
    ...project,
    enabledPaletteIds,
    activeColorId,
  };
}

function buildLibraryFromState(state: EditorStoreState): StoredProjectLibrary {
  const currentRecord = serializeProjectState(state);
  const storedLibrary = loadStoredLibrary();
  const existingProjects = storedLibrary?.projects ?? [];
  const filteredExisting = existingProjects.filter((item) => item.id !== currentRecord.id);
  const currentSavedAt = currentRecord.savedAt;
  currentRecord.savedAt = currentSavedAt;

  return {
    version: 1,
    currentProjectId: currentRecord.id,
    projects: dedupeProjectRecords([currentRecord, ...filteredExisting]),
  };
}

function persistLibraryState(state: EditorStoreState) {
  return persistWholeLibrary(buildLibraryFromState(state));
}

function persistWholeLibrary(library: StoredProjectLibrary): EditorStoreState {
  const sanitizedProjects =
    library.projects.length > 0 ? library.projects : createLibraryWithNewProject().projects;
  const normalizedLibrary: StoredProjectLibrary = {
    version: 1,
    currentProjectId:
      sanitizedProjects.find((item) => item.id === library.currentProjectId)?.id ??
      sanitizedProjects[0].id,
    projects: sanitizedProjects.map((item) => ({
      ...item,
      project: normalizeSerializedProject(item.project),
    })),
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedLibrary));
  }

  const currentRecord =
    normalizedLibrary.projects.find((item) => item.id === normalizedLibrary.currentProjectId) ??
    normalizedLibrary.projects[0];
  const currentState = deserializeProjectRecord(currentRecord);
  const projectList = [...normalizedLibrary.projects]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .map((item) => ({
      id: item.id,
      name: item.project.name,
      savedAt: item.savedAt,
      hasSourceImage: Boolean(item.project.sourceImage),
      hasBeadGrid: Boolean(item.project.beadGrid),
    }));

  return {
    ...currentState,
    projectList,
    recentProjects: projectList.slice(0, 6).map((item) => item.name),
    lastSavedAt: currentRecord.savedAt,
  };
}

function loadStoredLibrary(): StoredProjectLibrary | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredProjectLibrary;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.projects)) {
      return null;
    }

    return {
      version: 1,
      currentProjectId: parsed.currentProjectId,
      projects: parsed.projects
        .filter((item) => item?.id && item?.project)
        .map((item) => ({
          ...item,
          project: normalizeSerializedProject(item.project),
        })),
    };
  } catch {
    return null;
  }
}

function deriveStateFromLibrary(library: StoredProjectLibrary | null) {
  if (!library || library.projects.length === 0) {
    return persistWholeLibrary(createLibraryWithNewProject());
  }

  return persistWholeLibrary(library);
}

function dedupeProjectRecords(records: StoredProjectRecord[]) {
  const map = new Map<string, StoredProjectRecord>();

  for (const record of records) {
    map.set(record.id, record);
  }

  return Array.from(map.values()).sort((left, right) =>
    right.savedAt.localeCompare(left.savedAt),
  );
}
