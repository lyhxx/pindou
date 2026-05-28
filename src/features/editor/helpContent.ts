export type EditorHelpArticleId =
  | "workspace-overview"
  | "canvas-size"
  | "image-position"
  | "advanced-palette"
  | "edit-tools"
  | "shortcuts"
  | "arrange-tools"
  | "touch-canvas"
  | "touch-image";

export type EditorHelpGroupId = "getting-started" | "image" | "colors" | "canvas" | "shortcuts";

export type EditorHelpArticleSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export type EditorHelpArticle = {
  id: EditorHelpArticleId;
  groupId: EditorHelpGroupId;
  title: string;
  summary: string;
  keywords: string[];
  sections: EditorHelpArticleSection[];
};

export type EditorHelpGroup = {
  id: EditorHelpGroupId;
  title: string;
};

export const editorHelpGroups: EditorHelpGroup[] = [
  { id: "shortcuts", title: "快捷键" },
  { id: "getting-started", title: "开始使用" },
  { id: "image", title: "图片与生成" },
  { id: "colors", title: "颜色与替换" },
  { id: "canvas", title: "画布编辑" },
];

export const editorHelpArticles: EditorHelpArticle[] = [
  {
    id: "workspace-overview",
    groupId: "getting-started",
    title: "工作台总览",
    summary: "左侧准备画布和图片，中间编辑图纸，右侧处理颜色替换与导入导出。",
    keywords: ["工作台", "总览", "布局", "左侧", "中间", "右侧", "开始"],
    sections: [
      {
        title: "工作顺序",
        items: [
          "左侧负责画布尺寸、图片上传、定位缩放和生成参数。",
          "中间是正式画布，用来绘制、吸色、填充、框选和查看结果。",
          "右侧负责高级颜色、批量替换、导入导出和颜色统计。",
          "图片预览区的移动和缩放不会直接改动画布，只有点击“生成图纸”才会更新画布内容。",
        ],
      },
      {
        title: "如何开始",
        paragraphs: [
          "可以先上传图片再生成图纸，也可以直接在空白画布上手工绘制。",
          "如果要清空当前内容重新开始，可以点顶部“新建”，系统会先提醒当前内容将被清空。",
        ],
      },
    ],
  },
  {
    id: "canvas-size",
    groupId: "getting-started",
    title: "画布尺寸",
    summary: "宽度和高度都按格子数计算，输入后按回车或失焦生效。",
    keywords: ["画布", "尺寸", "宽度", "高度", "格子", "大小"],
    sections: [
      {
        title: "尺寸规则",
        items: [
          "宽度和高度表示拼豆格子数量，不是图片像素。",
          "修改尺寸会重建画布，因此属于会影响当前内容的操作。",
          "总格数会同步更新，方便估算拼豆用量。",
          "成品尺寸按 5mm 拼豆估算，显示的是大致厘米尺寸。",
        ],
      },
    ],
  },
  {
    id: "image-position",
    groupId: "image",
    title: "图片定位与缩放",
    summary: "上传后先在预览区摆放图片，再生成图纸；预览调整本身不会覆盖当前画布。",
    keywords: ["图片", "定位", "缩放", "预览", "拖动", "生成"],
    sections: [
      {
        title: "操作方式",
        items: [
          "桌面端可用滚轮缩放图片，用拖拽调整位置。",
          "也可以用上下左右按钮做微调。",
          "“重置定位”会把图片缩放和偏移恢复到默认状态。",
        ],
      },
      {
        title: "何时生效",
        paragraphs: [
          "左侧看到的是生成前的摆放预览，不是最终画布。",
          "只有点击“生成图纸”后，系统才会按当前预览状态重新量化并写入画布。",
        ],
      },
    ],
  },
  {
    id: "advanced-palette",
    groupId: "colors",
    title: "高级颜色与全启用 / 全禁用",
    summary: "这里决定哪些拼豆颜色参与自动匹配，也提供源色和目标色的替换入口。",
    keywords: ["高级颜色", "调色板", "全启用", "全禁用", "可用色", "替换颜色", "吸色"],
    sections: [
      {
        title: "可用色控制",
        items: [
          "勾选表示该颜色允许参与图片转图纸时的自动匹配。",
          "取消勾选后，这个颜色不会被自动生成算法选中。",
          "全启用会放开全部颜色，适合先看完整自动结果。",
          "全禁用用于快速清空选择，再手动只保留少量指定颜色。",
        ],
      },
      {
        title: "颜色替换",
        items: [
          "先点“源”或“目标”，再在颜色列表里点选颜色，就能写入当前槽位。",
          "切到吸色工具后，在画布上点已有颜色，也会写入当前选中的源或目标槽位。",
          "“仅替换边缘”适合快速统一轮廓杂色，不会粗暴替掉整张图的同色区域。",
        ],
      },
    ],
  },
  {
    id: "edit-tools",
    groupId: "canvas",
    title: "编辑工具",
    summary: "画笔、橡皮、移动画布、吸色、填充、框选都直接作用于中间画布。",
    keywords: ["画笔", "橡皮", "移动画布", "吸色", "填充", "框选", "编辑"],
    sections: [
      {
        title: "工具说明",
        items: [
          "画笔：给格子涂上当前颜色。",
          "橡皮：清空当前格子的颜色。",
          "移动画布：拖动画布视图，不改图案内容。",
          "吸色：从画布里取一个已存在的颜色。",
          "填充：把一片连续区域替换成当前颜色。",
          "框选：选中一块区域后复制、移动、清空或粘贴。",
        ],
      },
    ],
  },
  {
    id: "shortcuts",
    groupId: "shortcuts",
    title: "快捷键总览",
    summary: "常用工具、视图和选区操作都支持键盘快捷键，桌面端效率更高。",
    keywords: ["快捷键", "热键", "键盘", "撤销", "重做", "复制", "粘贴", "工具切换"],
    sections: [
      {
        title: "工具切换",
        items: [
          "B 画笔，E 橡皮，H 移动画布，I 吸色，F 填充，V 框选。",
        ],
      },
      {
        title: "编辑操作",
        items: [
          "Ctrl 或 Command + Z 撤销。",
          "Ctrl + Y，或 Shift + Ctrl / Command + Z 重做。",
          "Ctrl 或 Command + C / X / V 支持复制、剪切、粘贴选区。",
          "Esc 取消当前选区。",
        ],
      },
      {
        title: "视图控制",
        items: [
          "G 显示或隐藏网格。",
          "0 复位视图缩放和平移。",
        ],
      },
    ],
  },
  {
    id: "arrange-tools",
    groupId: "canvas",
    title: "视图与画布整理",
    summary: "撤销、重做、网格、复位视图和整理按钮分别影响编辑历史、视图或图案布局。",
    keywords: ["撤销", "重做", "网格", "复位视图", "裁切空白", "留白", "居中"],
    sections: [
      {
        title: "视图控制",
        items: [
          "撤销 / 重做：回退或恢复上一步编辑记录。",
          "显示网格：切换格线显示，方便看清坐标和边界。",
          "复位视图：把画布缩放和平移恢复到默认状态。",
        ],
      },
      {
        title: "整理工具",
        items: [
          "裁切空白：裁掉四周没有用到的空白格，让画布边界贴近图案本体。",
          "留白 4 格：在图案四周补出 4 格空白边距。",
        ],
      },
    ],
  },
  {
    id: "touch-canvas",
    groupId: "canvas",
    title: "画布触控手势",
    summary: "平板上可双指缩放和平移画布，也能切到“移动画布”后单指拖动。",
    keywords: ["触控", "手势", "iPad", "平板", "画布", "双指", "缩放", "平移"],
    sections: [
      {
        title: "中间画布",
        items: [
          "单指按当前工具绘制、填充、框选或吸色。",
          "双指捏合可缩放画布。",
          "双指拖动可平移画布。",
          "也可以切换到“移动画布”工具后单指拖动画布视图。",
        ],
      },
    ],
  },
  {
    id: "touch-image",
    groupId: "image",
    title: "图片预览触控手势",
    summary: "图片预览区支持单指拖动和双指缩放，适合在平板上先摆图再生成。",
    keywords: ["触控", "图片", "预览", "iPad", "缩放", "拖动"],
    sections: [
      {
        title: "图片预览区",
        items: [
          "单指拖动图片位置。",
          "双指捏合缩放图片。",
          "摆放完成后点击“生成图纸”，系统才会把结果写入画布。",
        ],
      },
    ],
  },
];

export const defaultEditorHelpArticleId: EditorHelpArticleId = "workspace-overview";

export const editorHelpArticleMap = Object.fromEntries(
  editorHelpArticles.map((article) => [article.id, article]),
) as Record<EditorHelpArticleId, EditorHelpArticle>;

export const editorHelpLinks = {
  topbar: "workspace-overview",
  canvasSize: "canvas-size",
  imagePosition: "image-position",
  advancedPalette: "advanced-palette",
  toolbar: "edit-tools",
  shortcuts: "shortcuts",
  arrangeTools: "arrange-tools",
  touchCanvas: "touch-canvas",
  touchImage: "touch-image",
} as const satisfies Record<string, EditorHelpArticleId>;

export const editorUiCopy = {
  helpCenterTitle: "帮助中心",
  helpCenterEyebrow: "工作台说明",
  helpCenterSearchPlaceholder: "搜索功能、参数、手势、颜色",
  helpCenterEmptyTitle: "没有匹配的帮助条目",
  helpCenterEmptyText: "换一个关键词，或直接从左侧目录查看完整说明。",
  touchImageNoteTitle: "图片手势",
  touchImageNoteText: "桌面端可滚轮缩放，平板可单指拖动、双指缩放。",
  stageEmptyTitle: "进入工作台后开始制作",
  stageEmptyText: "在左侧上传图片生成图纸，或直接在当前空白画布上开始绘制。",
} as const;

export function buildHelpSearchText(article: EditorHelpArticle) {
  return [
    article.title,
    article.summary,
    article.keywords.join(" "),
    ...article.sections.map((section) =>
      [section.title, section.paragraphs?.join(" ") ?? "", section.items?.join(" ") ?? ""].join(" "),
    ),
  ]
    .join(" ")
    .toLowerCase();
}
