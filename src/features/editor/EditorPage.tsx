import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { PanelCard } from "../../components/ui/PanelCard";
import type { BeadGrid, RectSelection } from "../../shared/types/project";
import { EMPTY_CELL } from "../../shared/types/project";
import { defaultPalette, findPaletteColorById } from "../palette/palette";
import { CreateCanvasModal } from "../home/CreateCanvasModal";
import { CanvasStage } from "./components/CanvasStage";
import { ImagePositionPreview } from "./components/ImagePositionPreview";
import { ImageUploadField } from "./components/ImageUploadField";
import { useEditorStore } from "./editorStore";
import {
  buildColorStats,
  exportColorListText,
  exportFormalPatternPng,
  exportProjectJson,
  parseProjectJson,
} from "./quantizeImage";

type EditorPageProps = {
  onBackHome: () => void;
};

const PROJECT_REPO_URL = "https://github.com/lyhxx/pindou";
const APP_VERSION = __APP_VERSION__;

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
    setCanvasWidthInput(String(canvas.width));
    setCanvasHeightInput(String(canvas.height));
  }, [canvas.height, canvas.width]);

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
    : enabledPaletteIds.length === 0
      ? "请至少启用一种颜色"
      : null;
  const arrangeReason = beadGrid ? null : "生成图纸后可用";
  const exportReason = beadGrid ? null : "当前还没有图纸结果";
  const replaceReason = !beadGrid
    ? "生成图纸后可替换颜色"
    : replaceFromColorId === replaceToColorId
      ? "源颜色和目标颜色不能相同"
      : null;

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
      window.alert(message);
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
          <a
            className="topbar__project-link"
            href={PROJECT_REPO_URL}
            rel="noreferrer"
            target="_blank"
          >
            {`拼豆工坊 v${APP_VERSION}`}
          </a>
        </div>

        <div className="topbar__actions topbar__actions--editor">
          <Button onClick={handleCreateCanvasRequest} size="compact" tone="editor" variant="primary">
            新建
          </Button>
        </div>
      </header>

      <main className="editor-layout">
        <aside className="editor-sidebar">
          <div className="editor-panel-group">
            <PanelCard eyebrow="Step 1" title="画布" tone="editor">
              <div className="control-grid control-grid--double">
                <label className="field">
                  <span>
                    宽度
                    <HelpHint tip="单位是格。输入后按回车或失焦生效。" />
                  </span>
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
                  <span>尺寸</span>
                  <strong>
                    {productWidthCm} x {productHeightCm} cm
                  </strong>
                </div>
              </div>
            </PanelCard>

            <PanelCard
              eyebrow="Step 2"
              title="图片与生成"
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
              <div className="section-headline">
                <strong>{sourceImage ? "已上传图片" : "先上传图片"}</strong>
                <span>{sourceImage ? `${sourceImage.width} x ${sourceImage.height}px` : "未载入"}</span>
              </div>
              <ImageUploadField />
              <ImagePositionPreview
                canvas={canvas}
                imageTransform={imageTransform}
                onImageTransformChange={setImageTransform}
                sourceImage={sourceImage}
              />
              <p className="muted-copy muted-copy--compact">滚轮缩放，拖拽移动。</p>
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
                  <span>
                    抖动
                    <HelpHint tip="开启后会用误差扩散保留渐变细节，但颗粒感会更强。" />
                  </span>
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
                  <span>
                    去背景
                    <HelpHint tip="按四角背景色估算并清除接近背景的像素，适合纯色背景图片。" />
                  </span>
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

              <label className="field">
                <span>
                  背景容差 {processing.tolerance}
                  <HelpHint tip="数值越大，越容易把接近背景色的边缘一起去掉。" />
                </span>
                <input
                  className="field__range"
                  max={100}
                  min={0}
                  onChange={(event) => setTolerance(Number(event.target.value))}
                  type="range"
                  value={processing.tolerance}
                />
              </label>
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
                    title={arrangeReason ?? undefined}
                    tone="editor"
                  >
                    适应绘图
                  </Button>
                  <Button
                    className="stage-tool-button"
                    disabled={!beadGrid}
                    onClick={() => wrapDrawingWithPadding(4)}
                    size="compact"
                    title={arrangeReason ?? undefined}
                    tone="editor"
                  >
                    留白 4 格
                  </Button>
                  <Button
                    className="stage-tool-button"
                    disabled={!beadGrid}
                    onClick={centerDrawing}
                    size="compact"
                    title={arrangeReason ?? undefined}
                    tone="editor"
                  >
                    居中内容
                  </Button>
                </div>
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
                  <strong>进入工作台后开始</strong>
                  <p>在左侧上传图片生成图纸，或直接在当前空白画布上开始绘制。</p>
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
          </footer>
        </section>

        <aside className="editor-sidebar editor-sidebar--right">
          <div className="editor-panel-group">
            <PanelCard eyebrow="Advanced" title="" tone="editor">
              <div className="panel-inline-title">
                <strong>高级颜色</strong>
                <HelpHint tip="全启用表示生成图纸时可从所有颜色里匹配；全禁用会禁用大部分颜色，仅保留当前编辑色，便于快速限定可用色。" />
              </div>
              <div className="current-color current-color--compact current-color--compact-inline current-color--sidebar current-color--sidebar-tight">
                <div
                  className="current-color__swatch current-color__swatch--dense"
                  style={{ background: activeColor.hex }}
                />
                <div className="current-color__meta">
                  <strong>
                    {activeColor.id} {activeColor.name}
                  </strong>
                  <p>
                    可用 {enabledPaletteIds.length}/{defaultPalette.length}
                  </p>
                </div>
              </div>

              <div className="palette-matrix palette-matrix--dense palette-matrix--preview">
                {defaultPalette
                  .slice(0, advancedPaletteOpen ? defaultPalette.length : 15)
                  .map((color) => {
                    const enabled = enabledPaletteIds.includes(color.id);
                    const active = color.id === activeColorId;

                    return (
                      <button
                        key={color.id}
                        className={`palette-swatch palette-swatch--dense${
                          active ? " palette-chip--active" : ""
                        }${enabled ? "" : " palette-chip--disabled"}`}
                        onClick={() => {
                          if (!enabled) {
                            togglePaletteColor(color.id);
                          }
                          setActiveColorId(color.id);
                          applyReplaceSlotColor(color.id);
                        }}
                        title={`${color.id} ${color.name}`}
                        type="button"
                      >
                        <span className="palette-swatch__chip" style={{ background: color.hex }} />
                        <span className="palette-swatch__code">{color.id}</span>
                        <label
                          className="palette-swatch__toggle"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            checked={enabled}
                            onChange={() => togglePaletteColor(color.id)}
                            type="checkbox"
                          />
                        </label>
                      </button>
                    );
                  })}
              </div>

              <div className="inline-actions inline-actions--sidebar">
                <Button
                  onClick={() => setAdvancedPaletteOpen((value) => !value)}
                  size="compact"
                  tone="editor"
                >
                  {advancedPaletteOpen ? "收起" : "展开更多"}
                </Button>
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
                <Button onClick={resetPaletteSelection} size="compact" tone="editor">
                  重置
                </Button>
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
                  先点源或目标，再在上方选色，或切吸管到画布取色。
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
                <DisabledHint reason={replaceReason} />
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
    </div>
  );
}

function HelpHint({ tip }: { tip: string }) {
  return (
    <span className="help-hint" role="note" tabIndex={0} title={tip}>
      ?
    </span>
  );
}

type ConfirmResetModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
            <Button onClick={onClose}>取消</Button>
            <Button onClick={onConfirm} tone="editor" variant="primary">
              继续新建
            </Button>
          </div>
        </footer>
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
