import { useState } from "react";
import { NotificationViewport } from "../components/ui/NotificationViewport";
import { EditorPage } from "../features/editor/EditorPage";
import { HomePage } from "../features/home/HomePage";

export function App() {
  const [view, setView] = useState<"home" | "editor">("home");

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
