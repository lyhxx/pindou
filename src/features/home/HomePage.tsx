import { Button } from "../../components/ui/Button";
import { PanelCard } from "../../components/ui/PanelCard";
import { useEditorStore } from "../editor/editorStore";

type HomePageProps = {
  onEnterEditor: () => void;
};

const quickActions = [
  {
    title: "新建空白画布",
    description: "从尺寸开始搭一张新的拼豆图。",
  },
  {
    title: "上传图片转图纸",
    description: "本地处理原图，快速生成拼豆方案。",
  },
  {
    title: "打开最近工程",
    description: "继续上一轮的排版、修图和导出。",
  },
];

const featureCards = [
  "纯前端本地处理",
  "画布尺寸自由调整",
  "自动去背景与抖动",
  "颜色统计与图纸导出",
];

export function HomePage({ onEnterEditor }: HomePageProps) {
  const recentProjects = useEditorStore((state) => state.recentProjects);
  const projectList = useEditorStore((state) => state.projectList);
  const switchProject = useEditorStore((state) => state.switchProject);
  const createNewProject = useEditorStore((state) => state.createNewProject);

  function handleOpenProject(projectId: string) {
    switchProject(projectId);
    onEnterEditor();
  }

  function handleCreateProject() {
    createNewProject();
    onEnterEditor();
  }

  return (
    <div className="app-shell">
      <header className="topbar topbar--home">
        <div className="brand-lockup">
          <span className="brand-lockup__badge">Craft Lab</span>
          <strong className="brand-lockup__title">拼豆工坊</strong>
        </div>
        <div className="topbar__actions">
          <Button onClick={onEnterEditor}>{recentProjects[0] ?? "进入编辑器"}</Button>
          <Button variant="primary" onClick={handleCreateProject}>
            开始制作
          </Button>
        </div>
      </header>

      <main className="home-page">
        <section className="hero">
          <div className="hero__content">
            <p className="hero__eyebrow">纯前端 · 本地处理 · 无需登录</p>
            <h1 className="hero__title">把图片变成一张能真正开工的拼豆图纸。</h1>
            <p className="hero__description">
              上传图片后，在浏览器里完成定位、量化、去背景、抖动处理和局部修正，
              最后直接导出图纸、工程文件和颜色清单。
            </p>
            <div className="hero__actions">
              <Button variant="primary" onClick={onEnterEditor}>
                上传图片开始
              </Button>
              <Button onClick={handleCreateProject}>新建画布</Button>
            </div>
          </div>

          <div className="hero__visual">
            <div className="bead-showcase">
              <div className="bead-showcase__board">
                {Array.from({ length: 72 }).map((_, index) => (
                  <span key={index} className={`bead bead--${index % 6}`} />
                ))}
              </div>
              <div className="bead-showcase__note">
                <strong>工作台预览</strong>
                <span>原图定位 -&gt; 量化配色 -&gt; 手动修正 -&gt; 导出图纸</span>
              </div>
            </div>
          </div>
        </section>

        <section className="home-grid">
          <PanelCard title="快速入口" eyebrow="Quick Actions">
            <div className="quick-actions">
              {quickActions.map((item, index) => (
                <button
                  key={item.title}
                  className="quick-action"
                  onClick={index === 0 ? handleCreateProject : onEnterEditor}
                  type="button"
                >
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </PanelCard>

          <PanelCard title="核心能力" eyebrow="Capabilities">
            <div className="feature-grid">
              {featureCards.map((item) => (
                <div key={item} className="feature-chip">
                  {item}
                </div>
              ))}
            </div>
          </PanelCard>
        </section>

        <PanelCard title="项目列表" eyebrow="Projects">
          {projectList.length > 0 ? (
            <div className="project-list">
              {projectList.map((project) => (
                <button
                  key={project.id}
                  className="project-list__item"
                  onClick={() => handleOpenProject(project.id)}
                  type="button"
                >
                  <strong>{project.name}</strong>
                  <span>
                    {project.hasBeadGrid
                      ? "已有图纸"
                      : project.hasSourceImage
                        ? "已上传图片"
                        : "空白画布"}
                  </span>
                  <small>
                    {new Date(project.savedAt).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted-copy">还没有项目，先新建一个画布开始。</p>
          )}
        </PanelCard>
      </main>
    </div>
  );
}
