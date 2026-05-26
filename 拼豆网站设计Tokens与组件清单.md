# 拼豆网站设计 Tokens 与组件清单

## 1. 文档目标

本清单直接为“真实图纸编辑器”实现服务，目标是把视觉与组件约束落到可编码级别。

---

## 2. Tokens 设计原则

- 编辑器优先使用语义变量
- 图纸区域单独一套高对比变量
- 组件尺寸按高密度工作区定义
- 不允许继续使用过大的通用按钮尺寸覆盖整个编辑器

---

## 3. 全局颜色 Tokens

## 3.1 页面与面板

```text
--surface-page: #F5F1E8;
--surface-shell: #EEE4D4;
--surface-panel: #FBF7F0;
--surface-panel-muted: #F4EBDD;
--surface-toolbar: #F8F1E6;
--surface-popup: #FFFDF9;
```

## 3.2 文本

```text
--text-primary: #2A241D;
--text-secondary: #6F6254;
--text-muted: #9B8E80;
--text-inverse: #FFFFFF;
```

## 3.3 边框

```text
--border-soft: rgba(42, 36, 29, 0.08);
--border-default: rgba(42, 36, 29, 0.14);
--border-strong: rgba(42, 36, 29, 0.24);
--border-focus: rgba(232, 93, 63, 0.38);
```

## 3.4 图纸专用

```text
--paper-bg: #FFFFFF;
--paper-grid: #D9D9D9;
--paper-grid-strong: #F0A14A;
--paper-ruler-bg: #F8F8F8;
--paper-ruler-text: #4A4A4A;
--paper-cell-text-dark: #2A241D;
--paper-cell-text-light: #FFFFFF;
--paper-hover: #4AA3A1;
--paper-selection: #E85D3F;
```

## 3.5 功能色

```text
--action-primary: #E85D3F;
--action-primary-hover: #D35135;
--action-secondary: #2F8F83;
--action-secondary-hover: #26776E;
--state-success: #4D9F70;
--state-warning: #D98B2B;
--state-danger: #C94B4B;
```

---

## 4. 字体 Tokens

```text
--font-ui: "HarmonyOS Sans SC", "Noto Sans SC", sans-serif;
--font-mono: "IBM Plex Mono", monospace;
--font-brand: "Smiley Sans", "ZCOOL KuaiLe", sans-serif;
```

---

## 5. 字号 Tokens

```text
--font-size-hero: 40px;
--font-size-h1: 28px;
--font-size-h2: 22px;
--font-size-h3: 18px;
--font-size-h4: 15px;

--font-size-body: 13px;
--font-size-body-sm: 12px;
--font-size-caption: 11px;
--font-size-micro: 10px;
```

编辑器内默认正文字号收紧到 `13px` 左右，不再按展示页密度设计。

---

## 6. 间距 Tokens

```text
--space-2: 2px;
--space-4: 4px;
--space-6: 6px;
--space-8: 8px;
--space-10: 10px;
--space-12: 12px;
--space-16: 16px;
--space-20: 20px;
--space-24: 24px;
--space-32: 32px;
```

编辑器主要使用：

- `6`
- `8`
- `10`
- `12`

避免过多 `20+` 的大间距。

---

## 7. 圆角 Tokens

```text
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 10px;
--radius-xl: 14px;
```

编辑器整体圆角收紧，不再采用过圆的大卡片风格。

---

## 8. 阴影 Tokens

```text
--shadow-xs: 0 1px 4px rgba(42, 36, 29, 0.05);
--shadow-sm: 0 4px 12px rgba(42, 36, 29, 0.07);
--shadow-md: 0 10px 24px rgba(42, 36, 29, 0.09);
```

图纸区域本体不应依赖大阴影。

---

## 9. 布局 Tokens

```text
--topbar-height: 52px;
--statusbar-height: 28px;
--toolbar-height: 40px;
--editor-left-width: 280px;
--editor-right-width: 260px;
--editor-gap: 12px;
--panel-padding: 12px;
--stage-padding: 12px;
```

这一版布局核心原则是：

- 给中间图纸尽可能多空间
- 左右栏够用即可

---

## 10. 图纸绘制 Tokens

```text
--grid-major-step: 10;
--cell-label-min-zoom: 0.9;
--cell-label-font-size: 10px;
--ruler-thickness: 24px;
--hover-stroke-width: 2px;
--selection-stroke-width: 2px;
```

说明：

- 每 10 格一条粗线
- 缩放低于一定值可自动隐藏格内色号
- 顶部与左侧坐标尺厚度固定

---

## 11. 核心组件清单

## 11.1 页面壳层

- `AppShell`
- `EditorShell`
- `EditorTopbar`
- `EditorStatusbar`

## 11.2 左栏组件

- `ProjectPanel`
- `CanvasPanel`
- `ImageUploadPanel`
- `ImageTransformPanel`
- `ProcessingPanel`
- `GeneratePanel`

## 11.3 中间编辑器组件

- `EditorToolbar`
- `EditorStageViewport`
- `EditorRulerCanvas`
- `EditorGridCanvas`
- `EditorOverlayCanvas`

这里至少要把原来的单一 `CanvasStage` 演进成多层职责。

## 11.4 右栏组件

- `CurrentColorPanel`
- `CompactPalettePanel`
- `ColorStatsPanel`
- `ProjectSummaryPanel`
- `ExportPanel`

---

## 12. 组件形态规范

## 12.1 ToolbarButton

用途：

- 工具栏按钮

规范：

- 小尺寸
- 图标优先
- 支持按下态
- 支持选中态

## 12.2 PanelSection

用途：

- 左右栏每个参数区块

规范：

- 小标题
- 紧凑内容
- 统一分组间距

## 12.3 CompactPaletteItem

用途：

- 紧凑色板项

必须包含：

- 色块
- 编号
- 启用状态
- 选中状态

## 12.4 GridCellLabelRenderer

用途：

- 控制格内色号文字绘制

规则：

- 根据缩放决定是否显示
- 根据背景亮度决定文字颜色

## 12.5 RulerRenderer

用途：

- 绘制顶部和左侧编号尺

规则：

- 与主图纸同步
- 但视觉独立清楚

---

## 13. 状态类组件

- `HoverIndicator`
- `SelectionIndicator`
- `AutosaveBadge`
- `ProcessingProgressInline`
- `EmptyStageHint`

这些组件必须为真实编辑问题服务，而不是装饰。

---

## 14. 现有实现需要替换的组件方向

当前实现中，以下组件需要按真实编辑器思路重构：

- `CanvasStage`
  - 从珠子视图改为图纸视图主渲染器
- `EditorPage`
  - 从展示型三栏改为工作型三栏
- `PanelCard`
  - 降低装饰性，变成更紧凑的参数面板容器
- `Button`
  - 增加工具栏尺寸和紧凑尺寸

---

## 15. 开发落地优先级

P0：

- 图纸颜色变量
- 图纸网格变量
- 工具栏小按钮组件
- 图纸舞台布局变量

P1：

- 紧凑色板项
- 坐标尺渲染
- 色号渲染
- 底部状态栏

P2：

- 扩边 / 裁切面板
- 更复杂的导出配置

---

## 16. 结论

这一份 tokens 与组件清单从现在开始只服务一个目标：

`把当前项目从“能演示”推进到“能真实编辑”。`

后续任何组件新增或样式修改，都应该先问一句：

`它是否让图纸更清楚、编辑更高效、工作区更紧凑。`
