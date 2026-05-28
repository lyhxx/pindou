import { useEffect, useState } from "react";
import { NotificationViewport } from "../components/ui/NotificationViewport";
import { EditorPage } from "../features/editor/EditorPage";
import { hasStoredEditorProject, useEditorStore } from "../features/editor/editorStore";
import { CreateCanvasModal } from "../features/home/CreateCanvasModal";
import { HomePage } from "../features/home/HomePage";

export function App() {
  const [view, setView] = useState<"home" | "editor">("home");
  const [createCanvasOpen, setCreateCanvasOpen] = useState(false);
  const createNewProject = useEditorStore((state) => state.createNewProject);

  useEffect(() => {
    document.title =
      view === "home"
        ? "拼豆工坊 - 拼豆图纸生成与编辑工具"
        : "拼豆工坊工作台 - 图片转拼豆图纸编辑器";
  }, [view]);

  function handleEnterEditor() {
    if (hasStoredEditorProject()) {
      setView("editor");
      return;
    }

    setCreateCanvasOpen(true);
  }

  function handleCreateCanvas(width: number, height: number) {
    createNewProject({
      canvas: { width, height },
    });
    setCreateCanvasOpen(false);
    setView("editor");
  }

  return (
    <>
      {view === "home" ? (
        <HomePage onEnterEditor={handleEnterEditor} />
      ) : (
        <EditorPage onBackHome={() => setView("home")} />
      )}
      <CreateCanvasModal
        onClose={() => setCreateCanvasOpen(false)}
        onCreate={({ width, height }) => handleCreateCanvas(width, height)}
        open={createCanvasOpen}
      />
      <NotificationViewport />
    </>
  );
}
