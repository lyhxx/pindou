import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { BrandMark } from "../../components/ui/BrandMark";
import { PanelCard } from "../../components/ui/PanelCard";
import { notifyError } from "../../shared/notifications/notificationStore";
import type { BeadGrid, RectSelection } from "../../shared/types/project";
import { EMPTY_CELL } from "../../shared/types/project";
import { defaultPalette, findPaletteColorById } from "../palette/palette";
import { CreateCanvasModal } from "../home/CreateCanvasModal";
import { CanvasStage } from "./components/CanvasStage";
import { ImagePositionPreview } from "./components/ImagePositionPreview";
import { ImageUploadField } from "./components/ImageUploadField";
import { useEditorStore } from "./editorStore";
import {
  buildHelpSearchText,
  defaultEditorHelpArticleId,
  editorHelpArticleMap,
  editorHelpArticles,
  editorHelpGroups,
  editorHelpLinks,
  editorUiCopy,
  type EditorHelpArticleId,
} from "./helpContent";
import {
  buildColorStats,
  exportColorListText,
  exportFormalPatternPng,
  exportProjectJson,
  generatePreviewBeadGrid,
  parseProjectJson,
} from "./quantizeImage";

type EditorPageProps = {
  onBackHome: () => void;
};

const PROJECT_REPO_URL = "https://github.com/lyhxx/pindou";
const FEEDBACK_EMAIL = "xihons@qq.com";
const APP_VERSION = __APP_VERSION__;
const UPDATE_NOTICE_STORAGE_KEY = "pindou.editor.update-notice.read.v1";
const LATEST_UPDATE_NOTICE = {
  id: `${APP_VERSION}-latest`,
  label: "有更新",
  title: "最新更新",
  summary: "图片处理和画布缩放链路已补强，建议看一下本次变更。",
  items: [
    "去背景升级为按四边连通区域识别，减少误删主体。",
    "高级颜色支持“仅替换边缘”，可快速清理描边杂色。",
    "中间画布滚轮缩放的 passive 报错已修复。",
  ],
} as const;

export function EditorPage({ onBackHome }: EditorPageProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [replaceFromColorId, setReplaceFromColorId] = useState<string>(defaultPalette[0].id);
  const [replaceToColorId, setReplaceToColorId] = useState<string>(defaultPalette[2].id);
  const [replaceSelectionSlot, setReplaceSelectionSlot] = useState<"from" | "to" | null>(null);
  const [canvasWidthInput, setCanvasWidthInput] = useState("120");
  const [canvasHeightInput, setCanvasHeightInput] = useState("120");
  const [advancedPaletteOpen, setAdvancedPaletteOpen] = useState(false);
  const [createCanvasOpen, setCreateCanvasOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [projectInfoOpen, setProjectInfoOpen] = useState(false);
  const [helpCenterOpen, setHelpCenterOpen] = useState(false);
  const [livePreviewEnabled, setLivePreviewEnabled] = useState(false);
  const [previewGrid, setPreviewGrid] = useState<BeadGrid | null>(null);
  const [updateNoticeRead, setUpdateNoticeRead] = useState<Record<string, boolean>>(
    () => loadUpdateNoticeReadState(),
  );
  const [helpCenterArticleId, setHelpCenterArticleId] = useState<EditorHelpArticleId>(
    defaultEditorHelpArticleId,
  );

  const canvas = useEditorStore((state) => state.canvas);
  const sourceImage = useEditorStore((state) => state.sourceImage);
  const beadGrid = useEditorStore((state) => state.beadGrid);
  const currentSelection = useEditorStore((state) => state.currentSelection);
  const imageTransform = useEditorStore((state) => state.imageTransform);
  const stageViewport = useEditorStore((state) => state.stageViewport);
  const processing = useEditorStore((state) => state.processing);
  const enabledPaletteIds = useEditorStore((state) => state.enabledPaletteIds);
  const activeTool = useEditorStore((state) => state.activeTool);
  const activeColorId = useEditorStore((state) => state.activeColorId);
  const showGrid = useEditorStore((state) => state.showGrid);
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const lastSavedAt = useEditorStore((state) => state.lastSavedAt);
  const setCanvasSize = useEditorStore((state) => state.setCanvasSize);
  const setImageTransform = useEditorStore((state) => state.setImageTransform);
  const nudgeImageTransform = useEditorStore((state) => state.nudgeImageTransform);
  const resetImageTransform = useEditorStore((state) => state.resetImageTransform);
  const setStageViewport = useEditorStore((state) => state.setStageViewport);
  const resetStageViewport = useEditorStore((state) => state.resetStageViewport);
  const setDithering = useEditorStore((state) => state.setDithering);
  const setRemoveBackground = useEditorStore((state) => state.setRemoveBackground);
  const setTolerance = useEditorStore((state) => state.setTolerance);
  const setTool = useEditorStore((state) => state.setTool);
  const setShowGrid = useEditorStore((state) => state.setShowGrid);
  const setActiveColorId = useEditorStore((state) => state.setActiveColorId);
  const togglePaletteColor = useEditorStore((state) => state.togglePaletteColor);
  const enableAllPaletteColors = useEditorStore((state) => state.enableAllPaletteColors);
  const disableAllPaletteColors = useEditorStore((state) => state.disableAllPaletteColors);
  const resetPaletteSelection = useEditorStore((state) => state.resetPaletteSelection);
  const createNewProject = useEditorStore((state) => state.createNewProject);
  const importProjectFile = useEditorStore((state) => state.importProjectFile);
  const generatePattern = useEditorStore((state) => state.generatePattern);
  const trimToDrawing = useEditorStore((state) => state.trimToDrawing);
  const wrapDrawingWithPadding = useEditorStore((state) => state.wrapDrawingWithPadding);
  const centerDrawing = useEditorStore((state) => state.centerDrawing);
  const paintCell = useEditorStore((state) => state.paintCell);
  const eraseCell = useEditorStore((state) => state.eraseCell);
  const fillArea = useEditorStore((state) => state.fillArea);
  const fillSelection = useEditorStore((state) => state.fillSelection);
  const eraseSelection = useEditorStore((state) => state.eraseSelection);
  const moveSelection = useEditorStore((state) => state.moveSelection);
  const copySelection = useEditorStore((state) => state.copySelection);
  const cutSelection = useEditorStore((state) => state.cutSelection);
  const pasteSelection = useEditorStore((state) => state.pasteSelection);
  const replaceColor = useEditorStore((state) => state.replaceColor);
  const replaceEdgeColorOnly = useEditorStore((state) => state.replaceEdgeColorOnly);
  const pickCellColor = useEditorStore((state) => state.pickCellColor);
  const setCurrentSelection = useEditorStore((state) => state.setCurrentSelection);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  useEffect(() => {
    document.documentElement.classList.add("app-editor-active");
    document.body.classList.add("app-editor-active");

    return () => {
      document.documentElement.classList.remove("app-editor-active");
      document.body.classList.remove("app-editor-active");
    };
  }, []);

  useEffect(() => {
    function preventBrowserZoom(event: WheelEvent) {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    }

    function preventGestureZoom(event: Event) {
      event.preventDefault();
    }

    document.addEventListener("wheel", preventBrowserZoom, { passive: false });
    document.addEventListener("gesturestart", preventGestureZoom, { passive: false });
    document.addEventListener("gesturechange", preventGestureZoom, { passive: false });
    document.addEventListener("gestureend", preventGestureZoom, { passive: false });

    return () => {
      document.removeEventListener("wheel", preventBrowserZoom);
      document.removeEventListener("gesturestart", preventGestureZoom);
      document.removeEventListener("gesturechange", preventGestureZoom);
      document.removeEventListener("gestureend", preventGestureZoom);
    };
  }, []);

  useEffect(() => {
    setCanvasWidthInput(String(canvas.width));
    setCanvasHeightInput(String(canvas.height));
  }, [canvas.height, canvas.width]);

  useEffect(() => {
    let cancelled = false;

    if (!sourceImage?.src || !livePreviewEnabled) {
      setPreviewGrid(null);
      return;
    }

    void generatePreviewBeadGrid({
      canvas,
      sourceImage,
      imageTransform,
      dithering: processing.dithering,
      removeBackground: processing.removeBackground,
      tolerance: processing.tolerance,
      enabledPaletteIds,
    })
      .then((grid) => {
        if (!cancelled) {
          setPreviewGrid(grid);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewGrid(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    canvas,
    enabledPaletteIds,
    imageTransform,
    processing.dithering,
    processing.removeBackground,
    processing.tolerance,
    sourceImage,
    livePreviewEnabled,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const typingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (typingTarget) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && currentSelection) {
        const hotkey = event.key.toLowerCase();
        if (hotkey === "c") {
          event.preventDefault();
          copySelection(currentSelection);
          return;
        }

        if (hotkey === "x") {
          event.preventDefault();
          cutSelection(currentSelection);
          return;
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteSelection();
        return;
      }

      switch (event.key.toLowerCase()) {
        case "b":
          setTool("paint");
          break;
        case "e":
          setTool("erase");
          break;
        case "i":
          setTool("picker");
          break;
        case "h":
          setTool("pan");
          break;
        case "f":
          setTool("fill");
          break;
        case "v":
          setTool("select");
          break;
        case "g":
          setShowGrid(!useEditorStore.getState().showGrid);
          break;
        case "0":
          resetStageViewport();
          break;
        case "escape":
          clearSelection();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    clearSelection,
    copySelection,
    currentSelection,
    cutSelection,
    pasteSelection,
    redo,
    resetStageViewport,
    setShowGrid,
    setTool,
    undo,
  ]);

  const activeColor = findPaletteColorById(activeColorId);
  const replaceFromColor = findPaletteColorById(replaceFromColorId);
  const replaceToColor = findPaletteColorById(replaceToColorId);
  const totalCells = canvas.width * canvas.height;
  const beadSizeMm = 5;
  const productWidthCm = ((canvas.width * beadSizeMm) / 10).toFixed(1);
  const productHeightCm = ((canvas.height * beadSizeMm) / 10).toFixed(1);
  const colorStats = useMemo(() => buildColorStats(beadGrid), [beadGrid]);
  const saveLabel = lastSavedAt ? formatSavedAt(lastSavedAt) : "未保存";
  const usedColorCount = countUsedColors(beadGrid);
  const selectionInfo = currentSelection ? getSelectionInfo(currentSelection) : null;
  const showSelectionActions = Boolean(currentSelection);
  const exportBaseName = `pindou-${canvas.width}x${canvas.height}`;
  const generationReason = !sourceImage
    ? "请先上传图片"
    : !sourceImage.src
      ? "当前图片未保存在本地缓存中，请重新上传后再生成"
    : enabledPaletteIds.length === 0
      ? "请至少启用一种颜色"
      : null;
  const exportReason = beadGrid ? null : "当前还没有图纸结果";
  const replaceReason = !beadGrid
    ? "生成图纸后可替换颜色"
    : replaceFromColorId === replaceToColorId
      ? "源颜色和目标颜色不能相同"
      : null;

  const hasUnreadUpdateNotice = !updateNoticeRead[LATEST_UPDATE_NOTICE.id];

  useEffect(() => {
    if (!projectInfoOpen || !hasUnreadUpdateNotice) {
      return;
    }

    const nextState = {
      ...updateNoticeRead,
      [LATEST_UPDATE_NOTICE.id]: true,
    };
    setUpdateNoticeRead(nextState);
    persistUpdateNoticeReadState(nextState);
  }, [hasUnreadUpdateNotice, projectInfoOpen, updateNoticeRead]);

  function applyReplaceSlotColor(colorId: string) {
    if (replaceSelectionSlot === "from") {
      setReplaceFromColorId(colorId);
      return;
    }

    if (replaceSelectionSlot === "to") {
      setReplaceToColorId(colorId);
    }
  }

  function commitCanvasSize(dimension: "width" | "height", rawValue: string) {
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed)) {
      setCanvasWidthInput(String(canvas.width));
      setCanvasHeightInput(String(canvas.height));
      return;
    }

    const nextValue = Math.max(1, Math.min(300, Math.round(parsed)));
    setCanvasSize({
      ...canvas,
      [dimension]: nextValue,
    });
  }

  function handleCanvasKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    dimension: "width" | "height",
  ) {
    if (event.key === "Enter") {
      commitCanvasSize(dimension, event.currentTarget.value);
      event.currentTarget.blur();
    }
  }

  function handleExportJson() {
    const json = exportProjectJson({
      name: exportBaseName,
      canvas,
      beadGrid,
      currentSelection,
      imageTransform,
      stageViewport,
      processing,
      enabledPaletteIds,
      sourceImage,
      activeTool,
      activeColorId,
      showGrid,
    });

    downloadTextFile(`${sanitizeFileName(exportBaseName)}.json`, json, "application/json");
  }

  function handleExportPatternPng() {
    const pngUrl = exportFormalPatternPng({
      beadGrid,
      name: exportBaseName,
    });
    downloadUrl(`${sanitizeFileName(exportBaseName)}-pattern.png`, pngUrl);
  }

  async function handleImportProject(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const projectFile = parseProjectJson(text);
      importProjectFile(projectFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : "工程导入失败";
      notifyError("工程导入失败", message);
    } finally {
      event.target.value = "";
    }
  }

  function handleExportColorList() {
    const text = exportColorListText({
      name: exportBaseName,
      canvas,
      stats: colorStats,
    });

    downloadTextFile(`${sanitizeFileName(exportBaseName)}-colors.txt`, text, "text/plain");
  }

  function handleSelectionChange(selection: RectSelection | null) {
    setCurrentSelection(selection);
  }

  function handleCreateCanvasRequest() {
    setConfirmResetOpen(true);
  }

  function handleCreateCanvas(width: number, height: number) {
    createNewProject({
      canvas: { width, height },
    });
    setCreateCanvasOpen(false);
  }

  function openHelpArticle(articleId: EditorHelpArticleId) {
    setHelpCenterArticleId(articleId);
    setHelpCenterOpen(true);
  }

  return (
    <div className="app-shell app-shell--editor">
      <header className="topbar topbar--editor">
        <div className="topbar__group">
          <Button className="topbar__back" onClick={onBackHome} size="compact" tone="editor">
            返回首页
          </Button>
          <span className="topbar__meta topbar__meta--editor">{saveLabel}</span>
        </div>

        <div className="topbar__center">
          <button
            className={`topbar__project-link topbar__project-link--button${
              hasUnreadUpdateNotice ? " topbar__project-link--unread" : ""
            }`}
            onClick={() => setProjectInfoOpen(true)}
            type="button"
          >
            <BrandMark alt="" className="topbar__project-logo" />
            <span className={`topbar__project-link-main-badge${
              hasUnreadUpdateNotice
                ? " topbar__project-link-main-badge--warning"
                : " topbar__project-link-main-badge--success"
            }`}>{`拼豆工坊 v${APP_VERSION}`}</span>
            <span className="topbar__project-link-badge">反馈</span>
          </button>
        </div>

        <div className="topbar__actions topbar__actions--editor">
          <Button onClick={() => openHelpArticle(editorHelpLinks.topbar)} size="compact" tone="editor">
            帮助中心
          </Button>
          <Button onClick={handleCreateCanvasRequest} size="compact" tone="editor" variant="primary">
            新建
          </Button>
        </div>
      </header>

      <main className="editor-layout">
        <aside className="editor-sidebar">
          <div className="editor-panel-group">
            <PanelCard
              eyebrow="Step 1"
              title="画布"
              titleAction={<HelpHint articleId={editorHelpLinks.canvasSize} onOpenArticle={openHelpArticle} />}
              tone="editor"
            >
              <div className="control-grid control-grid--double">
                <label className="field">
                  <span>宽度</span>
                  <input
                    className="field__input"
                    inputMode="numeric"
                    max={300}
                    min={1}
                    onBlur={() => commitCanvasSize("width", canvasWidthInput)}
                    onChange={(event) => setCanvasWidthInput(event.target.value)}
                    onKeyDown={(event) => handleCanvasKeyDown(event, "width")}
                    type="number"
                    value={canvasWidthInput}
                  />
                </label>
                <label className="field">
                  <span>高度</span>
                  <input
                    className="field__input"
                    inputMode="numeric"
                    max={300}
                    min={1}
                    onBlur={() => commitCanvasSize("height", canvasHeightInput)}
                    onChange={(event) => setCanvasHeightInput(event.target.value)}
                    onKeyDown={(event) => handleCanvasKeyDown(event, "height")}
                    type="number"
                    value={canvasHeightInput}
                  />
                </label>
              </div>
              <div className="summary-grid summary-grid--compact summary-grid--editor">
                <div>
                  <span>总格数</span>
                  <strong>{totalCells.toLocaleString("zh-CN")}</strong>
                </div>
                <div>
                  <span>成品尺寸</span>
                  <strong>
                    {productWidthCm} x {productHeightCm} cm
                  </strong>
                </div>
              </div>
            </PanelCard>

            <PanelCard
              eyebrow="Step 2"
              title="图片与生成"
              titleAction={<HelpHint articleId={editorHelpLinks.imagePosition} onOpenArticle={openHelpArticle} />}
              tone="editor"
              footer={
                <div className="stack-actions">
                  <Button
                    disabled={Boolean(generationReason)}
                    onClick={() => {
                      void generatePattern();
                    }}
                    size="compact"
                    tone="editor"
                    variant="primary"
                  >
                    生成图纸
                  </Button>
                  <DisabledHint reason={generationReason} />
                </div>
              }
            >
              <ImageUploadField
                livePreviewEnabled={livePreviewEnabled}
                onLivePreviewChange={setLivePreviewEnabled}
              />
              <ImagePositionPreview
                canvas={canvas}
                imageTransform={imageTransform}
                onImageTransformChange={setImageTransform}
                previewGrid={previewGrid}
                previewMode={livePreviewEnabled ? "generated" : "source"}
                sourceImage={sourceImage}
              />
              <div className="editor-touch-note">
                <strong>{editorUiCopy.touchImageNoteTitle}</strong>
                <span>{editorUiCopy.touchImageNoteText}</span>
              </div>
              <div className="image-controls">
                <div className="image-controls__top">
                  <label className="field">
                    <span>缩放 {imageTransform.scale.toFixed(2)}x</span>
                    <input
                      className="field__range"
                      max={3}
                      min={0.2}
                      onChange={(event) =>
                        setImageTransform({
                          scale: Number(event.target.value),
                        })
                      }
                      step={0.05}
                      type="range"
                      value={imageTransform.scale}
                    />
                  </label>
                  <Button onClick={resetImageTransform} size="compact" tone="editor">
                    重置定位
                  </Button>
                </div>
                <div className="inline-actions inline-actions--tight image-controls__nudge">
                  <Button onClick={() => nudgeImageTransform(0, -2)} size="compact" tone="editor">
                    上
                  </Button>
                  <Button onClick={() => nudgeImageTransform(0, 2)} size="compact" tone="editor">
                    下
                  </Button>
                  <Button onClick={() => nudgeImageTransform(-2, 0)} size="compact" tone="editor">
                    左
                  </Button>
                  <Button onClick={() => nudgeImageTransform(2, 0)} size="compact" tone="editor">
                    右
                  </Button>
                </div>
              </div>
              <div className="control-grid control-grid--double">
                <label className="field">
                  <span>抖动</span>
                  <select
                    className="field__input"
                    onChange={(event) =>
                      setDithering(event.target.value as "none" | "floyd-steinberg")
                    }
                    value={processing.dithering}
                  >
                    <option value="none">关闭</option>
                    <option value="floyd-steinberg">开启</option>
                  </select>
                </label>

                <label className="field">
                  <span>去背景</span>
                  <label className="toggle-row">
                    <input
                      checked={processing.removeBackground}
                      onChange={(event) => setRemoveBackground(event.target.checked)}
                      type="checkbox"
                    />
                    <span>{processing.removeBackground ? "已开启" : "已关闭"}</span>
                  </label>
                </label>
              </div>

              <label
                className={`field${processing.removeBackground ? "" : " field--disabled"}`}
              >
                <span>背景容差 {processing.tolerance}</span>
                <input
                  className="field__range"
                  disabled={!processing.removeBackground}
                  max={100}
                  min={0}
                  onChange={(event) => setTolerance(Number(event.target.value))}
                  type="range"
                  value={processing.tolerance}
                />
              </label>
              <p className="muted-copy muted-copy--compact">
                去背景会优先清掉与四边连通的背景区域，比只按角点取色更稳。
              </p>
            </PanelCard>

          </div>
        </aside>

        <section className="editor-stage">
          <div className="stage-toolbar">
            <div className="stage-toolbar__row">
              <div className="stage-toolbar__left">
                <div className="tool-group">
                  <Button
                    className={`stage-tool-button${
                      activeTool === "paint" ? " stage-tool-button--active" : ""
                    }`}
                    onClick={() => setTool("paint")}
                    size="compact"
                    tone="editor"
                    variant={activeTool === "paint" ? "primary" : "secondary"}
                  >
                    画笔
                  </Button>
                  <Button
                    className={`stage-tool-button${
                      activeTool === "erase" ? " stage-tool-button--active" : ""
                    }`}
                    onClick={() => setTool("erase")}
                    size="compact"
                    tone="editor"
                    variant={activeTool === "erase" ? "primary" : "secondary"}
                  >
                    橡皮
                  </Button>
                  <Button
                    className={`stage-tool-button${
                      activeTool === "pan" ? " stage-tool-button--active" : ""
                    }`}
                    onClick={() => setTool("pan")}
                    size="compact"
                    tone="editor"
                    variant={activeTool === "pan" ? "primary" : "secondary"}
                  >
                    移动画布
                  </Button>
                  <Button
                    className={`stage-tool-button${
                      activeTool === "picker" ? " stage-tool-button--active" : ""
                    }`}
                    onClick={() => setTool("picker")}
                    size="compact"
                    tone="editor"
                    variant={activeTool === "picker" ? "primary" : "secondary"}
                  >
                    吸色
                  </Button>
                  <Button
                    className={`stage-tool-button${
                      activeTool === "fill" ? " stage-tool-button--active" : ""
                    }`}
                    onClick={() => setTool("fill")}
                    size="compact"
                    tone="editor"
                    variant={activeTool === "fill" ? "primary" : "secondary"}
                  >
                    填充
                  </Button>
                  <Button
                    className={`stage-tool-button${
                      activeTool === "select" ? " stage-tool-button--active" : ""
                    }`}
                    onClick={() => setTool("select")}
                    size="compact"
                    tone="editor"
                    variant={activeTool === "select" ? "primary" : "secondary"}
                  >
                    框选
                  </Button>
                </div>
              </div>

              <div className="stage-toolbar__right">
                <div className="tool-group tool-group--utility">
                  <Button className="stage-tool-button" disabled={!canUndo} onClick={undo} size="compact" tone="editor">
                    撤销
                  </Button>
                  <Button className="stage-tool-button" disabled={!canRedo} onClick={redo} size="compact" tone="editor">
                    重做
                  </Button>
                  <Button className="stage-tool-button" onClick={() => setShowGrid(!showGrid)} size="compact" tone="editor">
                    {showGrid ? "隐藏网格" : "显示网格"}
                  </Button>
                  <Button className="stage-tool-button" onClick={resetStageViewport} size="compact" tone="editor">
                    复位视图
                  </Button>
                </div>
                <div className="tool-group tool-group--divider">
                  <Button
                    className="stage-tool-button"
                    disabled={!beadGrid}
                    onClick={trimToDrawing}
                    size="compact"
                    tone="editor"
                  >
                    裁切空白
                  </Button>
                  <Button
                    className="stage-tool-button"
                    disabled={!beadGrid}
                    onClick={() => wrapDrawingWithPadding(4)}
                    size="compact"
                    tone="editor"
                  >
                    留白 4 格
                  </Button>
                  <Button
                    className="stage-tool-button"
                    disabled={!beadGrid}
                    onClick={centerDrawing}
                    size="compact"
                    tone="editor"
                  >
                    居中内容
                  </Button>
                </div>
                <button
                  aria-label="查看工具说明"
                  className="stage-toolbar__help-trigger"
                  onClick={() => openHelpArticle(editorHelpLinks.toolbar)}
                  type="button"
                >
                  ?
                </button>
              </div>
            </div>

            {showSelectionActions ? (
              <div className="stage-toolbar__row stage-toolbar__row--selection">
                <div className="tool-group tool-group--selection">
                  <Button
                    className="stage-tool-button"
                    onClick={() => currentSelection && fillSelection(currentSelection)}
                    size="compact"
                    tone="editor"
                  >
                    填充选区
                  </Button>
                  <Button
                    className="stage-tool-button"
                    onClick={() => currentSelection && eraseSelection(currentSelection)}
                    size="compact"
                    tone="editor"
                  >
                    清空选区
                  </Button>
                  <Button
                    className="stage-tool-button"
                    onClick={() => currentSelection && copySelection(currentSelection)}
                    size="compact"
                    tone="editor"
                  >
                    复制
                  </Button>
                  <Button
                    className="stage-tool-button"
                    onClick={() => currentSelection && cutSelection(currentSelection)}
                    size="compact"
                    tone="editor"
                  >
                    剪切
                  </Button>
                  <Button className="stage-tool-button" onClick={pasteSelection} size="compact" tone="editor">
                    粘贴
                  </Button>
                  <Button
                    className="stage-tool-button"
                    onClick={() => currentSelection && moveSelection(currentSelection, -1, 0)}
                    size="compact"
                    tone="editor"
                  >
                    左移
                  </Button>
                  <Button
                    className="stage-tool-button"
                    onClick={() => currentSelection && moveSelection(currentSelection, 1, 0)}
                    size="compact"
                    tone="editor"
                  >
                    右移
                  </Button>
                  <Button
                    className="stage-tool-button"
                    onClick={() => currentSelection && moveSelection(currentSelection, 0, -1)}
                    size="compact"
                    tone="editor"
                  >
                    上移
                  </Button>
                  <Button
                    className="stage-tool-button"
                    onClick={() => currentSelection && moveSelection(currentSelection, 0, 1)}
                    size="compact"
                    tone="editor"
                  >
                    下移
                  </Button>
                  <Button className="stage-tool-button" onClick={clearSelection} size="compact" tone="editor">
                    取消选区
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="stage-frame">
            <div className="stage-frame__canvas">
              {!sourceImage && !beadGrid ? (
                <div className="stage-empty-state">
                  <strong>{editorUiCopy.stageEmptyTitle}</strong>
                  <p>{editorUiCopy.stageEmptyText}</p>
                </div>
              ) : null}
              <CanvasStage
                activeTool={activeTool}
                beadGrid={beadGrid}
                canvas={canvas}
                currentSelection={currentSelection}
                onCellAction={(x, y, mode) => {
                  const resolvedMode =
                    mode ??
                    (activeTool === "erase"
                      ? "erase"
                      : activeTool === "picker"
                        ? "picker"
                        : activeTool === "fill"
                          ? "fill"
                          : "paint");

                  if (resolvedMode === "paint") {
                    paintCell(x, y);
                    return;
                  }

                  if (resolvedMode === "erase") {
                    eraseCell(x, y);
                    return;
                  }

                  if (resolvedMode === "fill") {
                    fillArea(x, y);
                    return;
                  }

                  if (resolvedMode === "picker" && beadGrid) {
                    const colorIndex = beadGrid.cells[y * beadGrid.width + x];
                    const pickedColor =
                      colorIndex === EMPTY_CELL ? null : defaultPalette[colorIndex] ?? null;
                    if (pickedColor) {
                      applyReplaceSlotColor(pickedColor.id);
                    }
                  }

                  pickCellColor(x, y);
                }}
                onHoverChange={() => {}}
                onSelectionChange={handleSelectionChange}
                onSelectionMove={moveSelection}
                onViewportChange={setStageViewport}
                showGrid={showGrid}
                stageViewport={stageViewport}
              />
            </div>
          </div>

          <footer className="stage-statusbar">
            <span>{`画布 ${canvas.width} x ${canvas.height}`}</span>
            <span>{`视图 ${stageViewport.scale.toFixed(2)}x`}</span>
	            <span>{`已用 ${usedColorCount} 色`}</span>
            {selectionInfo ? <span>{`选区 ${selectionInfo.width} x ${selectionInfo.height}`}</span> : null}
	            <span className="stage-statusbar__hint">平板支持双指缩放/平移，也可切换到“移动画布”。</span>
          </footer>
        </section>

        <aside className="editor-sidebar editor-sidebar--right">
          <div className="editor-panel-group">
            <PanelCard
              eyebrow="调色"
              title="高级颜色"
              titleAction={<HelpHint articleId={editorHelpLinks.advancedPalette} onOpenArticle={openHelpArticle} />}
              tone="editor"
            >
              <div className="current-color current-color--compact current-color--compact-inline current-color--sidebar current-color--sidebar-tight current-color--palette-head">
                <div
                  className="current-color__swatch current-color__swatch--dense current-color__swatch--palette-head"
                  style={{ background: activeColor.hex }}
                />
                <div className="current-color__meta">
                  <strong>
                    {activeColor.id} {activeColor.name}
                  </strong>
                  <p>
                    已启用 {enabledPaletteIds.length}/{defaultPalette.length}
                  </p>
                </div>
              </div>

              <div className="palette-matrix palette-matrix--dense palette-matrix--preview palette-matrix--sidebar">
                {defaultPalette
                  .slice(0, advancedPaletteOpen ? defaultPalette.length : 8)
                  .map((color) => {
                    const enabled = enabledPaletteIds.includes(color.id);
                    const active = color.id === activeColorId;

                    return (
                      <button
                        key={color.id}
                        className={`palette-swatch palette-swatch--dense palette-swatch--sidebar${
                          active ? " palette-chip--active" : ""
                        }${enabled ? "" : " palette-chip--disabled"}`}
                        aria-label={`${color.id} ${color.name}`}
                        onClick={() => {
                          if (!enabled) {
                            togglePaletteColor(color.id);
                          }
                          setActiveColorId(color.id);
                          applyReplaceSlotColor(color.id);
                        }}
                        type="button"
                      >
                        <span className="palette-swatch__chip" style={{ background: color.hex }} />
                        <span className="palette-swatch__meta">
                          <span className="palette-swatch__code">{color.id}</span>
                          <span className="palette-swatch__name">{color.name}</span>
                        </span>
                        <label
                          className="palette-swatch__toggle"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            checked={enabled}
                            onChange={() => togglePaletteColor(color.id)}
                            type="checkbox"
                          />
                          <span className="palette-swatch__toggle-ui" aria-hidden="true">
                            {enabled ? "✓" : ""}
                          </span>
                        </label>
                      </button>
                    );
                  })}
              </div>

              <div className="palette-actions">
                <div className="palette-actions__row palette-actions__row--top">
                  <Button
                    className="palette-actions__expand"
                    onClick={() => setAdvancedPaletteOpen((value) => !value)}
                    size="compact"
                    tone="editor"
                  >
                    {advancedPaletteOpen ? "收起" : "展开更多"}
                  </Button>
                  <Button onClick={resetPaletteSelection} size="compact" tone="editor">
                    重置
                  </Button>
                </div>
                <div className="palette-actions__row palette-actions__row--bottom">
                  <Button
                    onClick={enableAllPaletteColors}
                    size="compact"
                    tone="editor"
                  >
                    全启用
                  </Button>
                  <Button
                    onClick={disableAllPaletteColors}
                    size="compact"
                    tone="editor"
                  >
                    全禁用
                  </Button>
                </div>
              </div>

              <div className="editor-color-tools__replace editor-color-tools__replace--dense editor-color-tools__replace--sidebar">
                <div className="replace-card replace-card--dense">
                  <button
                    className={`replace-card__item replace-card__item--selectable${
                      replaceSelectionSlot === "from" ? " replace-card__item--active" : ""
                    }`}
                    onClick={() =>
                      setReplaceSelectionSlot((current) => (current === "from" ? null : "from"))
                    }
                    type="button"
                  >
                    <span className="replace-card__label">源</span>
                    <strong>
                      {replaceFromColor.id} {replaceFromColor.name}
                    </strong>
                  </button>
                  <div className="replace-card__arrow">-&gt;</div>
                  <button
                    className={`replace-card__item replace-card__item--selectable${
                      replaceSelectionSlot === "to" ? " replace-card__item--active" : ""
                    }`}
                    onClick={() =>
                      setReplaceSelectionSlot((current) => (current === "to" ? null : "to"))
                    }
                    type="button"
                  >
                    <span className="replace-card__label">目标</span>
                    <strong>
                      {replaceToColor.id} {replaceToColor.name}
                    </strong>
                  </button>
                </div>
                <p className="muted-copy muted-copy--compact">
                  先点源或目标，再在上方选色，或切换吸色到画布取色。
                </p>
                <Button
                  disabled={Boolean(replaceReason)}
                  onClick={() => replaceColor(replaceFromColorId, replaceToColorId)}
                  size="compact"
                  tone="editor"
                  variant="primary"
                >
                  替换为目标色
                </Button>
                <Button
                  disabled={Boolean(replaceReason)}
                  onClick={() => replaceEdgeColorOnly(replaceFromColorId, replaceToColorId)}
                  size="compact"
                  tone="editor"
                >
                  仅替换边缘
                </Button>
                <DisabledHint reason={replaceReason} />
                <p className="muted-copy muted-copy--compact">
                  只处理边缘附近和小面积跳色点，不会把整张图里同色区域全部替换掉。
                </p>
              </div>
            </PanelCard>

            <PanelCard
              className="export-panel"
              eyebrow="Export"
              title="导入导出"
              tone="editor"
              footer={
                <div className="export-actions">
                  <input
                    ref={importInputRef}
                    accept=".json,application/json"
                    hidden
                    onChange={handleImportProject}
                    type="file"
                  />
                  <div className="export-actions__primary export-actions__primary--single">
                    <Button
                      disabled={!beadGrid}
                      onClick={handleExportPatternPng}
                      size="compact"
                      tone="editor"
                      variant="primary"
                    >
                      图纸 PNG
                    </Button>
                  </div>
                  <div className="export-actions__secondary export-actions__secondary--inline">
                    <Button onClick={() => importInputRef.current?.click()} size="compact" tone="editor">
                      导入 JSON
                    </Button>
                    <Button disabled={!beadGrid} onClick={handleExportJson} size="compact" tone="editor">
                      导出 JSON
                    </Button>
                    <Button
                      disabled={!beadGrid}
                      onClick={handleExportColorList}
                      size="compact"
                      tone="editor"
                    >
                      颜色清单
                    </Button>
                  </div>
                  <DisabledHint reason={exportReason} />
                </div>
              }
            >
              <div className="export-note">
	                <span>只保留图纸输出和工程文件。</span>
              </div>
            </PanelCard>

            <PanelCard eyebrow="Colors" title="颜色统计" tone="editor">
              <div className="editor-color-tools__head">
                <strong>已用颜色</strong>
	                <span>{usedColorCount} 色</span>
              </div>
              <div className="stats-list stats-list--compact">
                {colorStats.length > 0 ? (
                  colorStats.slice(0, 10).map((item) => (
                    <div key={item.color.id} className="stats-row">
                      <span className="stats-row__dot" style={{ background: item.color.hex }} />
                      <span className="stats-row__name">
                        {item.color.id}
                        <small>
                          {item.color.name} / {(item.ratio * 100).toFixed(1)}%
                        </small>
                      </span>
                      <strong>{item.count}</strong>
                    </div>
                  ))
                ) : (
                  <p className="muted-copy muted-copy--compact">生成图纸后显示颜色统计。</p>
                )}
              </div>
            </PanelCard>
          </div>
        </aside>
      </main>

      <CreateCanvasModal
        onClose={() => setCreateCanvasOpen(false)}
        onCreate={({ width, height }) => handleCreateCanvas(width, height)}
        open={createCanvasOpen}
      />
      <ConfirmResetModal
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          setConfirmResetOpen(false);
          setCreateCanvasOpen(true);
        }}
        open={confirmResetOpen}
      />
      <ProjectInfoModal
        feedbackEmail={FEEDBACK_EMAIL}
        latestUpdateNotice={LATEST_UPDATE_NOTICE}
        latestUpdateRead={!hasUnreadUpdateNotice}
        onClose={() => setProjectInfoOpen(false)}
        open={projectInfoOpen}
        repoUrl={PROJECT_REPO_URL}
        version={APP_VERSION}
      />
      <HelpCenterModal
        activeArticleId={helpCenterArticleId}
        onClose={() => setHelpCenterOpen(false)}
        onSelectArticle={setHelpCenterArticleId}
        open={helpCenterOpen}
      />
    </div>
  );
}

function HelpHint({
  articleId,
  onOpenArticle,
}: {
  articleId: EditorHelpArticleId;
  onOpenArticle: (articleId: EditorHelpArticleId) => void;
}) {
  return (
    <button
      aria-label={`查看${editorHelpArticleMap[articleId].title}说明`}
      className="help-hint"
      onClick={() => onOpenArticle(articleId)}
      type="button"
    >
      ?
    </button>
  );
}

type ConfirmResetModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

type ProjectInfoModalProps = {
  open: boolean;
  onClose: () => void;
  repoUrl: string;
  feedbackEmail: string;
  version: string;
  latestUpdateNotice: {
    label: string;
    title: string;
    summary: string;
    items: readonly string[];
  };
  latestUpdateRead: boolean;
};

type HelpCenterModalProps = {
  open: boolean;
  onClose: () => void;
  activeArticleId: EditorHelpArticleId;
  onSelectArticle: (articleId: EditorHelpArticleId) => void;
};

function ConfirmResetModal({ open, onClose, onConfirm }: ConfirmResetModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label="新建确认"
        className="modal-sheet modal-sheet--confirm"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-sheet__header modal-sheet__header--confirm">
          <div>
            <p className="modal-sheet__eyebrow">新建确认</p>
	            <h2 className="modal-sheet__title modal-sheet__title--confirm">新建会清空当前内容</h2>
          </div>
        </header>

        <div className="modal-sheet__body modal-sheet__body--confirm">
          <p className="modal-sheet__tip">
            当前只保留一份本地缓存。若有需要，请先导出工程文件或图纸，再继续新建。
          </p>
        </div>

        <footer className="modal-sheet__footer">
          <div className="inline-actions">
            <Button onClick={onClose} size="compact" tone="editor">
              取消
            </Button>
            <Button onClick={onConfirm} size="compact" tone="editor" variant="primary">
              继续新建
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function ProjectInfoModal({
  open,
  onClose,
  repoUrl,
  feedbackEmail,
  version,
  latestUpdateNotice,
  latestUpdateRead,
}: ProjectInfoModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!open) {
    return null;
  }

  async function handleCopyEmail() {
    try {
      await navigator.clipboard.writeText(feedbackEmail);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label="项目信息"
        className="modal-sheet modal-sheet--project-info"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-sheet__header">
          <div className="modal-sheet__brand-head">
            <BrandMark className="modal-sheet__brand-mark" />
            <div>
            <p className="modal-sheet__eyebrow">项目信息</p>
            <h2 className="modal-sheet__title">拼豆工坊</h2>
            </div>
          </div>
          <div className="inline-actions inline-actions--tight">
            <span className={`status-badge${latestUpdateRead ? " status-badge--success" : " status-badge--warning"}`}>
              {`v${version}`}
            </span>
            <button
              aria-label="关闭项目信息"
              className="modal-icon-button"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
        </header>

        <div className="modal-sheet__body">
          <div className={`modal-sheet__block modal-sheet__block--update${latestUpdateRead ? "" : " modal-sheet__block--update-unread"}`}>
            <div className="modal-sheet__block-head">
              <strong>{latestUpdateNotice.title}</strong>
              <span>{latestUpdateNotice.summary}</span>
            </div>
            <ul className="touch-help-list">
              {latestUpdateNotice.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="modal-sheet__block">
            <div className="modal-sheet__block-head">
              <strong>查看开源项目</strong>
              <span>查看源码、版本记录与文档</span>
            </div>
            <a href={repoUrl} rel="noreferrer" target="_blank">
              {repoUrl}
            </a>
          </div>

          <div className="modal-sheet__block">
            <div className="modal-sheet__block-head">
              <strong>问题反馈</strong>
              <span>功能问题和使用建议可以发邮件</span>
            </div>
            <div className="modal-sheet__actions">
              <a href={`mailto:${feedbackEmail}`}>{feedbackEmail}</a>
              <Button onClick={() => void handleCopyEmail()} size="compact" tone="editor">
                {copied ? "已复制" : "复制邮箱"}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HelpCenterModal({
  open,
  onClose,
  activeArticleId,
  onSelectArticle,
}: HelpCenterModalProps) {
  const [query, setQuery] = useState("");
  const searchInputId = useId();
  const articleNavRefs = useRef<Partial<Record<EditorHelpArticleId, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredArticles = normalizedQuery
    ? editorHelpArticles.filter((article) => buildHelpSearchText(article).includes(normalizedQuery))
    : editorHelpArticles;
  const activeArticle =
    filteredArticles.find((article) => article.id === activeArticleId) ??
    editorHelpArticleMap[activeArticleId] ??
    editorHelpArticleMap[defaultEditorHelpArticleId];
  const visibleArticleIds = new Set(filteredArticles.map((article) => article.id));
  const groupedArticles = editorHelpGroups
    .map((group) => ({
      group,
      articles: editorHelpArticles.filter(
        (article) => article.groupId === group.id && visibleArticleIds.has(article.id),
      ),
    }))
    .filter((entry) => entry.articles.length > 0);

  useEffect(() => {
    if (!normalizedQuery) {
      return;
    }

    const firstMatchedArticle = filteredArticles[0];
    if (firstMatchedArticle && firstMatchedArticle.id !== activeArticleId) {
      onSelectArticle(firstMatchedArticle.id);
    }
  }, [activeArticleId, filteredArticles, normalizedQuery, onSelectArticle]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const activeNavItem = articleNavRefs.current[activeArticle.id];
    if (!activeNavItem) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      activeNavItem.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeArticle.id, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label="帮助中心"
        className="modal-sheet modal-sheet--help-center"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-sheet__header">
          <div>
            <p className="modal-sheet__eyebrow">{editorUiCopy.helpCenterEyebrow}</p>
            <h2 className="modal-sheet__title">{editorUiCopy.helpCenterTitle}</h2>
          </div>
          <button aria-label="关闭帮助中心" className="modal-icon-button" onClick={onClose} type="button">
            ×
          </button>
        </header>

        <div className="help-center">
          <aside className="help-center__sidebar">
            <label className="help-center__search" htmlFor={searchInputId}>
              <span>搜索</span>
              <input
                id={searchInputId}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={editorUiCopy.helpCenterSearchPlaceholder}
                type="search"
                value={query}
              />
            </label>

            <div className="help-center__quick-links">
              <button
                className={`help-center__quick-link${
                  activeArticle.id === editorHelpLinks.shortcuts ? " help-center__quick-link--active" : ""
                }`}
                onClick={() => onSelectArticle(editorHelpLinks.shortcuts)}
                type="button"
              >
                快捷键
              </button>
              <button
                className={`help-center__quick-link${
                  activeArticle.id === editorHelpLinks.topbar ? " help-center__quick-link--active" : ""
                }`}
                onClick={() => onSelectArticle(editorHelpLinks.topbar)}
                type="button"
              >
                工作台总览
              </button>
              <button
                className={`help-center__quick-link${
                  activeArticle.id === editorHelpLinks.touchCanvas ||
                  activeArticle.id === editorHelpLinks.touchImage
                    ? " help-center__quick-link--active"
                    : ""
                }`}
                onClick={() => onSelectArticle(editorHelpLinks.touchCanvas)}
                type="button"
              >
                触控帮助
              </button>
            </div>

            <div className="help-center__nav">
              {groupedArticles.length > 0 ? (
                groupedArticles.map(({ group, articles }) => (
                  <div key={group.id} className="help-center__nav-group">
                    <p className="help-center__nav-title">{group.title}</p>
                    <div className="help-center__nav-items">
                      {articles.map((article) => (
                        <button
                          key={article.id}
                          className={`help-center__nav-item${
                            activeArticle.id === article.id ? " help-center__nav-item--active" : ""
                          }`}
                          onClick={() => onSelectArticle(article.id)}
                          ref={(node) => {
                            articleNavRefs.current[article.id] = node;
                          }}
                          type="button"
                        >
                          <strong>{renderHighlightedText(article.title, normalizedQuery)}</strong>
                          <span>{renderHighlightedText(article.summary, normalizedQuery)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="help-center__empty">
                  <strong>{editorUiCopy.helpCenterEmptyTitle}</strong>
                  <p>{editorUiCopy.helpCenterEmptyText}</p>
                </div>
              )}
            </div>
          </aside>

          <div className="help-center__content">
            <div className="help-center__article-head">
              <span className="status-badge">
                {editorHelpGroups.find((group) => group.id === activeArticle.groupId)?.title}
              </span>
              <h3>{renderHighlightedText(activeArticle.title, normalizedQuery)}</h3>
              <p>{renderHighlightedText(activeArticle.summary, normalizedQuery)}</p>
            </div>

            <div className="help-center__article-body">
              {activeArticle.sections.map((section) => (
                <section key={section.title} className="help-center__section">
                  <h4>{renderHighlightedText(section.title, normalizedQuery)}</h4>
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph}>{renderHighlightedText(paragraph, normalizedQuery)}</p>
                  ))}
                  {section.items?.length ? (
                    <ul className="touch-help-list">
                      {section.items.map((item) => (
                        <li key={item}>{renderHighlightedText(item, normalizedQuery)}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function DisabledHint({ reason }: { reason: string | null }) {
  if (!reason) {
    return null;
  }

  return <p className="disabled-hint">{reason}</p>;
}

function loadUpdateNoticeReadState() {
  if (typeof window === "undefined") {
    return {} as Record<string, boolean>;
  }

  try {
    const raw = window.localStorage.getItem(UPDATE_NOTICE_STORAGE_KEY);
    if (!raw) {
      return {} as Record<string, boolean>;
    }

    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {} as Record<string, boolean>;
  }
}

function persistUpdateNoticeReadState(state: Record<string, boolean>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(UPDATE_NOTICE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore update-notice persistence failure
  }
}

function renderHighlightedText(text: string, query: string) {
  if (!query) {
    return text;
  }

  const escapedQuery = escapeRegExp(query);
  const matcher = new RegExp(`(${escapedQuery})`, "ig");
  const parts = text.split(matcher);

  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="help-highlight">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countUsedColors(beadGrid: BeadGrid | null) {
  if (!beadGrid) {
    return 0;
  }

  const used = new Set<number>();

  for (const colorIndex of beadGrid.cells) {
    if (colorIndex !== EMPTY_CELL && colorIndex < defaultPalette.length) {
      used.add(colorIndex);
    }
  }

  return used.size;
}

function formatSavedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "本地已保存";
  }

  return `已保存 ${date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}


function getSelectionInfo(selection: RectSelection) {
  const width = Math.abs(selection.endX - selection.startX) + 1;
  const height = Math.abs(selection.endY - selection.startY) + 1;

  return {
    width,
    height,
  };
}

function sanitizeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-");
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  downloadUrl(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadUrl(filename: string, url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

