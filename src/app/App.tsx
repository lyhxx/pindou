import { useEffect, useState } from "react";
import { NotificationViewport } from "../components/ui/NotificationViewport";
import { EditorPage } from "../features/editor/EditorPage";
import { HomePage } from "../features/home/HomePage";

export function App() {
  const [view, setView] = useState<"home" | "editor">("home");

  useEffect(() => {
    document.title =
      view === "home"
        ? "拼豆工坊 - 拼豆图纸生成与编辑工具"
        : "拼豆工坊工作台 - 图片转拼豆图纸编辑器";
  }, [view]);

  return (
    <>
      {view === "home" ? (
        <HomePage onEnterEditor={() => setView("editor")} />
      ) : (
        <EditorPage onBackHome={() => setView("home")} />
      )}
      <NotificationViewport />
    </>
  );
}
