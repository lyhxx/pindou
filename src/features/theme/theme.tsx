import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

export type ThemeId = "atelier" | "paper" | "night" | "childrens-day";

type ThemeOption = {
  id: ThemeId;
  label: string;
  description: string;
};

type ThemeContextValue = {
  themeId: ThemeId;
  setThemeId: (themeId: ThemeId) => void;
  themeOptions: ThemeOption[];
};

const STORAGE_KEY = "pindou.ui.theme.v1";
const DEFAULT_THEME_ID: ThemeId = "atelier";

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "atelier",
    label: "工坊暖白",
    description: "偏手作工作台，保留现有暖白基调。",
  },
  {
    id: "paper",
    label: "纸面冷白",
    description: "更克制的工具感，界面更清爽。",
  },
  {
    id: "night",
    label: "夜间深色",
    description: "降低眩光，适合长时间修图。",
  },
  {
    id: "childrens-day",
    label: "61 儿童节",
    description: "限定节日皮肤，加入贴纸和彩旗感装饰。",
  },
];

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeId, setThemeId] = useState<ThemeId>(() => readStoredTheme());

  useLayoutEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    persistTheme(themeId);
  }, [themeId]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      setThemeId,
      themeOptions: THEME_OPTIONS,
    }),
    [themeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return value;
}

export function initializeTheme() {
  if (typeof document === "undefined") {
    return;
  }

  applyTheme(readStoredTheme());
}

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_ID;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isThemeId(raw) ? raw : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

function persistTheme(themeId: ThemeId) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, themeId);
  } catch {
    // ignore theme persistence failure
  }
}

function applyTheme(themeId: ThemeId) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = themeId;
  document.documentElement.style.colorScheme = themeId === "night" ? "dark" : "light";
}

function isThemeId(value: string | null): value is ThemeId {
  return (
    value === "atelier" ||
    value === "paper" ||
    value === "night" ||
    value === "childrens-day"
  );
}
