import { useEffect, useMemo, useRef } from "react";
import { Button } from "../../components/ui/Button";
import { PanelCard } from "../../components/ui/PanelCard";
import type { BeadGrid, EditorTool } from "../../shared/types/project";
import { EMPTY_CELL } from "../../shared/types/project";
import { defaultPalette, findPaletteColorById } from "../palette/palette";
import { CanvasStage } from "./components/CanvasStage";
import { ImageUploadField } from "./components/ImageUploadField";
import { useEditorStore } from "./editorStore";
import {
  buildColorStats,
  exportColorListText,
  exportFinishedPng,
  exportProjectJson,
  exportStagePng,
  parseProjectJson,
} from "./quantizeImage";

type EditorPageProps = {
  onBackHome: () => void;
};

export function EditorPage({ onBackHome }: EditorPageProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const stageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentProjectId = useEditorStore((state) => state.currentProjectId);
  const projectList = useEditorStore((state) => state.projectList);
  const name = useEditorStore((state) => state.name);
  const recentProjects = useEditorStore((state) => state.recentProjects);
  const canvas = useEditorStore((state) => state.canvas);
  const sourceImage = useEditorStore((state) => state.sourceImage);
  const beadGrid = useEditorStore((state) => state.beadGrid);
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
  const resetPaletteSelection = useEditorStore((state) => state.resetPaletteSelection);
  const createNewProject = useEditorStore((state) => state.createNewProject);
  const renameCurrentProject = useEditorStore((state) => state.renameCurrentProject);
  const switchProject = useEditorStore((state) => state.switchProject);
  const deleteProject = useEditorStore((state) => state.deleteProject);
  const importProjectFile = useEditorStore((state) => state.importProjectFile);
  const generatePattern = useEditorStore((state) => state.generatePattern);
  const paintCell = useEditorStore((state) => state.paintCell);
  const eraseCell = useEditorStore((state) => state.eraseCell);
  const pickCellColor = useEditorStore((state) => state.pickCellColor);
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
        case "g":
          setShowGrid(!useEditorStore.getState().showGrid);
          break;
        case "0":
          resetStageViewport();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [redo, resetStageViewport, setShowGrid, setTool, undo]);

  const activeColor = findPaletteColorById(activeColorId);
  const totalCells = canvas.width * canvas.height;
  const beadSizeMm = 5;
  const productWidthCm = ((canvas.width * beadSizeMm) / 10).toFixed(1);
  const productHeightCm = ((canvas.height * beadSizeMm) / 10).toFixed(1);
  const colorStats = useMemo(() => buildColorStats(beadGrid), [beadGrid]);
  const saveLabel = lastSavedAt ? formatSavedAt(lastSavedAt) : "未保存";
  const enabledCount = enabledPaletteIds.length;

  function handleExportJson() {
    const json = exportProjectJson({
      name,
      canvas,
      beadGrid,
      imageTransform,
      stageViewport,
      processing,
      enabledPaletteIds,
      sourceImage,
      activeTool,
      activeColorId,
      showGrid,
    });

    downloadTextFile(`${sanitizeFileName(name)}.json`, json, "application/json");
  }

  function handleExportPatternPng() {
    const pngUrl = exportStagePng(stageCanvasRef.current);
    downloadUrl(`${sanitizeFileName(name)}-pattern.png`, pngUrl);
  }

  function handleExportFinishedPng() {
    const pngUrl = exportFinishedPng(beadGrid);
    downloadUrl(`${sanitizeFileName(name)}-finished.png`, pngUrl);
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
      const message = error instanceof Error ? error.message : "工程导入失败。";
      window.alert(message);
    } finally {
      event.target.value = "";
    }
  }

  function handleExportColorList() {
    const text = exportColorListText({
      name,
      canvas,
      stats: colorStats,
    });

    downloadTextFile(`${sanitizeFileName(name)}-colors.txt`, text, "text/plain");
  }

  function handleRenameProject() {
    const nextName = window.prompt("输入新的项目名", name)?.trim();
    if (!nextName) {
      return;
    }

    renameCurrentProject(nextName);
  }

  function handleDeleteProject() {
    const confirmed = window.confirm(`确认删除项目“${name}”吗？`);
    if (!confirmed) {
      return;
    }

    deleteProject(currentProjectId);
  }

  return (
    <div className="app-shell app-shell--editor">
      <header className="topbar topbar--editor">
        <div className="topbar__group">
          <Button className="topbar__back" onClick={onBackHome} size="compact">
            返回首页
          </Button>
          <div>
            <p className="topbar__eyebrow">Pattern Editor</p>
            <strong className="topbar__title">{name}</strong>
          </div>
        </div>

        <div className="topbar__status">
          <span className="status-badge status-badge--success">{saveLabel}</span>
          <span className="status-badge">
            {canvas.width} x {canvas.height}
          </span>
        </div>

        <div className="topbar__actions">
          <Button onClick={() => switchProject(currentProjectId)} size="compact">
            {recentProjects[0] ?? "当前项目"}
          </Button>
          <Button onClick={createNewProject} size="compact">
            新建
          </Button>
        </div>
      </header>

      <main className="editor-layout">
        <aside className="editor-sidebar">
          <PanelCard eyebrow="Projects" title="项目">
            <div className="stack-actions">
              <Button onClick={handleRenameProject} size="compact">
                重命名
              </Button>
              <Button onClick={createNewProject} size="compact">
                新建项目
              </Button>
              <Button onClick={handleDeleteProject} size="compact">
                删除项目
              </Button>
            </div>
            <div className="project-list">
              {projectList.map((project) => (
                <button
                  key={project.id}
                  className={`project-list__item${
                    project.id === currentProjectId ? " project-list__item--active" : ""
                  }`}
                  onClick={() => switchProject(project.id)}
                  type="button"
                >
                  <strong>{project.name}</strong>
                  <span>{projectStatusLabel(project)}</span>
                  <small>{formatProjectTime(project.savedAt)}</small>
                </button>
              ))}
            </div>
          </PanelCard>

          <PanelCard eyebrow="Canvas" title="画布">
            <div className="control-grid control-grid--double">
              <label className="field">
                <span>宽度</span>
                <input
                  className="field__input"
                  max={300}
                  min={8}
                  onChange={(event) =>
                    setCanvasSize({
                      ...canvas,
                      width: Number(event.target.value) || 0,
                    })
                  }
                  type="number"
                  value={canvas.width}
                />
              </label>
              <label className="field">
                <span>高度</span>
                <input
                  className="field__input"
                  max={300}
                  min={8}
                  onChange={(event) =>
                    setCanvasSize({
                      ...canvas,
                      height: Number(event.target.value) || 0,
                    })
                  }
                  type="number"
                  value={canvas.height}
                />
              </label>
            </div>
            <p className="muted-copy">单位是格。首版建议控制在 300 x 300 以内。</p>
          </PanelCard>

          <PanelCard eyebrow="Image" title="图片">
            <ImageUploadField />
            {sourceImage ? (
              <div className="meta-card">
                <strong>{sourceImage.name}</strong>
                <span>
                  {sourceImage.width} x {sourceImage.height}px
                </span>
              </div>
            ) : (
              <p className="muted-copy">上传原图后可自动转换为拼豆图纸。</p>
            )}
          </PanelCard>

          <PanelCard eyebrow="Transform" title="定位">
            <label className="field">
              <span>图片缩放 {imageTransform.scale.toFixed(2)}x</span>
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
            <div className="control-grid control-grid--double">
              <label className="field">
                <span>X 偏移</span>
                <input
                  className="field__input"
                  onChange={(event) =>
                    setImageTransform({
                      offsetX: Number(event.target.value) || 0,
                    })
                  }
                  step={4}
                  type="number"
                  value={imageTransform.offsetX}
                />
              </label>
              <label className="field">
                <span>Y 偏移</span>
                <input
                  className="field__input"
                  onChange={(event) =>
                    setImageTransform({
                      offsetY: Number(event.target.value) || 0,
                    })
                  }
                  step={4}
                  type="number"
                  value={imageTransform.offsetY}
                />
              </label>
            </div>
            <div className="inline-actions">
              <Button onClick={() => nudgeImageTransform(-12, 0)} size="compact">
                左移
              </Button>
              <Button onClick={() => nudgeImageTransform(12, 0)} size="compact">
                右移
              </Button>
              <Button onClick={() => nudgeImageTransform(0, -12)} size="compact">
                上移
              </Button>
              <Button onClick={() => nudgeImageTransform(0, 12)} size="compact">
                下移
              </Button>
              <Button onClick={resetImageTransform} size="compact">
                重置
              </Button>
            </div>
          </PanelCard>

          <PanelCard eyebrow="Convert" title="转换">
            <label className="field">
              <span>抖动模式</span>
              <select
                className="field__input"
                onChange={(event) =>
                  setDithering(event.target.value as "none" | "floyd-steinberg")
                }
                value={processing.dithering}
              >
                <option value="none">无抖动</option>
                <option value="floyd-steinberg">Floyd-Steinberg</option>
              </select>
            </label>
            <label className="toggle-row">
              <input
                checked={processing.removeBackground}
                onChange={(event) => setRemoveBackground(event.target.checked)}
                type="checkbox"
              />
              <span>启用纯色背景去除</span>
            </label>
            <label className="field">
              <span>背景容差 {processing.tolerance}</span>
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

          <PanelCard
            eyebrow="Generate"
            title="生成"
            footer={
              <div className="stack-actions">
                <Button
                  disabled={!sourceImage || enabledCount === 0}
                  onClick={() => {
                    void generatePattern();
                  }}
                  size="compact"
                  variant="primary"
                >
                  生成图纸
                </Button>
                <Button
                  disabled={!sourceImage || enabledCount === 0}
                  onClick={() => {
                    void generatePattern();
                  }}
                  size="compact"
                >
                  重新生成
                </Button>
              </div>
            }
          >
            <div className="progress-card">
              <div className="progress-card__meta">
                <strong>状态</strong>
                <span>{beadGrid ? "已生成" : sourceImage ? "待生成" : "待上传"}</span>
              </div>
              <div className="progress-bar">
                <span style={{ width: beadGrid ? "100%" : sourceImage ? "56%" : "8%" }} />
              </div>
              <p>上传图片后点击生成，系统会自动量化成拼豆坐标图纸。</p>
            </div>
          </PanelCard>
        </aside>

        <section className="editor-stage">
          <div className="stage-toolbar">
            <div className="tool-group">
              <Button
                onClick={() => setTool("paint")}
                size="compact"
                variant={activeTool === "paint" ? "primary" : "secondary"}
              >
                画笔
              </Button>
              <Button
                onClick={() => setTool("erase")}
                size="compact"
                variant={activeTool === "erase" ? "primary" : "secondary"}
              >
                橡皮
              </Button>
              <Button
                onClick={() => setTool("picker")}
                size="compact"
                variant={activeTool === "picker" ? "primary" : "secondary"}
              >
                吸色
              </Button>
            </div>
            <div className="tool-group">
              <Button disabled={!canUndo} onClick={undo} size="compact">
                撤销
              </Button>
              <Button disabled={!canRedo} onClick={redo} size="compact">
                重做
              </Button>
              <Button onClick={() => setShowGrid(!showGrid)} size="compact">
                {showGrid ? "隐藏网格" : "显示网格"}
              </Button>
              <Button onClick={resetStageViewport} size="compact">
                复位
              </Button>
            </div>
          </div>

          <div className="stage-frame">
            <div className="stage-frame__canvas">
              <CanvasStage
                ref={stageCanvasRef}
                activeTool={activeTool}
                beadGrid={beadGrid}
                canvas={canvas}
                imageTransform={imageTransform}
                onCellAction={(x, y, mode) => {
                  const resolvedMode =
                    mode ?? (activeTool === "erase" ? "erase" : activeTool === "picker" ? "picker" : "paint");

                  if (resolvedMode === "paint") {
                    paintCell(x, y);
                    return;
                  }

                  if (resolvedMode === "erase") {
                    eraseCell(x, y);
                    return;
                  }

                  pickCellColor(x, y);
                }}
                onViewportChange={setStageViewport}
                showGrid={showGrid}
                sourceImage={sourceImage}
                stageViewport={stageViewport}
              />
            </div>
          </div>

          <footer className="stage-statusbar">
            <span>工具：{toolLabel(activeTool)}</span>
            <span>滚轮缩放，空格或中键平移，右键 / Alt 吸色</span>
            <span>
              视图 {Math.round(stageViewport.scale * 100)}% / {Math.round(stageViewport.offsetX)}, {Math.round(stageViewport.offsetY)}
            </span>
            <span>
              {beadGrid
                ? `图纸 ${beadGrid.width} x ${beadGrid.height}，可直接逐格修稿`
                : sourceImage
                  ? `已载入 ${sourceImage.name}，等待生成图纸`
                  : "尚未上传图片"}
            </span>
          </footer>
        </section>

        <aside className="editor-sidebar editor-sidebar--right">
          <PanelCard eyebrow="Current" title="当前颜色">
            <div className="current-color">
              <div
                className="current-color__swatch"
                style={{ background: activeColor.hex }}
              />
              <div>
                <strong>
                  {activeColor.name} {activeColor.id}
                </strong>
                <p>工具：{toolLabel(activeTool)}</p>
              </div>
            </div>
          </PanelCard>

          <PanelCard
            eyebrow="Palette"
            title="色板"
            footer={
              <div className="inline-actions">
                <Button onClick={enableAllPaletteColors} size="compact">
                  全部启用
                </Button>
                <Button onClick={resetPaletteSelection} size="compact">
                  重置筛色
                </Button>
              </div>
            }
          >
            <div className="palette-summary">
              <span>
                当前启用 {enabledCount} / {defaultPalette.length} 种颜色
              </span>
              <small>停用后的颜色不会参与自动量化。</small>
            </div>
            <div className="palette-grid palette-grid--compact">
              {defaultPalette.map((color) => {
                const enabled = enabledPaletteIds.includes(color.id);
                const active = color.id === activeColorId;

                return (
                  <div
                    key={color.id}
                    className={`palette-chip palette-chip--compact${
                      active ? " palette-chip--active" : ""
                    }${enabled ? "" : " palette-chip--disabled"}`}
                  >
                    <button
                      className="palette-chip__select"
                      disabled={!enabled}
                      onClick={() => setActiveColorId(color.id)}
                      type="button"
                    >
                      <span
                        className="palette-chip__dot"
                        style={{ background: color.hex }}
                      />
                      <span className="palette-chip__meta">
                        <strong>{color.id}</strong>
                        <small>{color.name}</small>
                      </span>
                    </button>
                    <label className="palette-chip__toggle">
                      <input
                        checked={enabled}
                        onChange={() => togglePaletteColor(color.id)}
                        type="checkbox"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </PanelCard>

          <PanelCard eyebrow="Stats" title="颜色统计">
            <div className="stats-list">
              {colorStats.length > 0 ? (
                colorStats.map((item) => (
                  <div key={item.color.id} className="stats-row">
                    <span
                      className="stats-row__dot"
                      style={{ background: item.color.hex }}
                    />
                    <span className="stats-row__name">
                      {item.color.id}
                      <small>
                        {item.color.name} · {(item.ratio * 100).toFixed(1)}%
                      </small>
                    </span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <p className="muted-copy">生成图纸后，这里会显示实际用色数量。</p>
              )}
            </div>
          </PanelCard>

          <PanelCard eyebrow="Summary" title="项目摘要">
            <div className="summary-grid">
              <div>
                <span>画布</span>
                <strong>
                  {canvas.width} x {canvas.height}
                </strong>
              </div>
              <div>
                <span>成品尺寸</span>
                <strong>
                  {productWidthCm} x {productHeightCm} cm
                </strong>
              </div>
              <div>
                <span>颜色数</span>
                <strong>{countUsedColors(beadGrid)} 色</strong>
              </div>
              <div>
                <span>总格数</span>
                <strong>{totalCells.toLocaleString("zh-CN")}</strong>
              </div>
            </div>
          </PanelCard>

          <PanelCard
            className="export-panel"
            eyebrow="Export"
            title="导入导出"
            footer={
              <div className="stack-actions">
                <input
                  ref={importInputRef}
                  accept=".json,application/json"
                  hidden
                  onChange={handleImportProject}
                  type="file"
                />
                <Button onClick={() => importInputRef.current?.click()} size="compact">
                  导入工程 JSON
                </Button>
                <Button disabled={!beadGrid} onClick={handleExportPatternPng} size="compact" variant="primary">
                  导出图纸 PNG
                </Button>
                <Button disabled={!beadGrid} onClick={handleExportFinishedPng} size="compact">
                  导出成品 PNG
                </Button>
                <Button disabled={!beadGrid} onClick={handleExportJson} size="compact">
                  导出工程 JSON
                </Button>
                <Button disabled={!beadGrid} onClick={handleExportColorList} size="compact">
                  导出颜色清单
                </Button>
              </div>
            }
          >
            <p className="muted-copy">图纸、成品、工程文件和颜色清单都可以本地导出。</p>
          </PanelCard>
        </aside>
      </main>
    </div>
  );
}

function toolLabel(tool: EditorTool) {
  switch (tool) {
    case "paint":
      return "画笔";
    case "erase":
      return "橡皮";
    case "picker":
      return "吸色";
    case "pan":
      return "平移";
  }
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

function projectStatusLabel(project: {
  hasBeadGrid: boolean;
  hasSourceImage: boolean;
}) {
  if (project.hasBeadGrid) {
    return "已有图纸";
  }

  if (project.hasSourceImage) {
    return "已上传图片";
  }

  return "空白画布";
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

function formatProjectTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
