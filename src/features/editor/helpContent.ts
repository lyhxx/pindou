export type EditorHelpArticleId =
  | "workspace-overview"
  | "canvas-size"
  | "image-position"
  | "image-dithering"
  | "remove-background"
  | "background-tolerance"
  | "advanced-palette"
  | "edit-tools"
  | "arrange-tools"
  | "touch-canvas"
  | "touch-image";

export type EditorHelpGroupId = "getting-started" | "image" | "colors" | "canvas";

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
  { id: "getting-started", title: "开始使用" },
  { id: "image", title: "图片生成" },
  { id: "colors", title: "颜色与替换" },
  { id: "canvas", title: "画布编辑" },
];

export const editorHelpArticles: EditorHelpArticle[] = [
  {
    id: "workspace-overview",
    groupId: "getting-started",
    title: "工作台总览",
    summary: "先在左侧准备图片和参数，再在中间画布编辑，最后从右侧整理颜色和导出结果。",
    keywords: ["工作台", "入口", "布局", "左侧", "右侧", "导出", "开始"],
    sections: [
      {
        title: "工作顺序",
        items: [
          "左侧负责画布尺寸、图片上传、定位缩放和生成参数。",
          "中间是正式画布，只负责查看、绘制、选择、平移和整理图纸。",
          "右侧负责高级颜色、替换颜色和导入导出。",
          "图片调整不会立刻改画布，只有点击“生成图纸”时才会真正更新画布内容。",
        ],
      },
      {
        title: "空白开始",
        paragraphs: [
          "如果不上传图片，可以直接在当前空白画布上手工绘制。",
          "如果要重新开一个新画布，点击顶部“新建”，系统会先提醒当前内容会被清空。",
        ],
      },
    ],
  },
  {
    id: "canvas-size",
    groupId: "getting-started",
    title: "画布尺寸",
    summary: "画布宽高单位都是格，输入后按回车或失焦生效。",
    keywords: ["画布", "尺寸", "宽度", "高度", "格子", "大小"],
    sections: [
      {
        title: "尺寸规则",
        items: [
          "宽度和高度都按格子数量计算，不是像素。",
          "改尺寸会直接重建画布内容，所以属于高影响操作。",
          "总格数会同步更新，方便估算拼豆数量。",
          "成品尺寸按 5mm 拼豆估算，显示的是大致厘米尺寸。",
        ],
      },
    ],
  },
  {
    id: "image-position",
    groupId: "image",
    title: "图片定位与缩放",
    summary: "上传后先在预览区定位图片，再生成图纸，定位调整本身不会覆盖当前画布。",
    keywords: ["图片", "定位", "缩放", "预览", "拖动", "生成"],
    sections: [
      {
        title: "操作方式",
        items: [
          "桌面端可用滚轮缩放图片，用拖拽调整位置。",
          "也可以用下方上下左右按钮做微调。",
          "“重置定位”会把图片缩放和偏移恢复到默认状态。",
        ],
      },
      {
        title: "更新时机",
        paragraphs: [
          "图片预览只是生成前的摆放区域，不是最终画布。",
          "只有点击“生成图纸”后，系统才会按当前摆放状态重新量化并写入画布。",
        ],
      },
    ],
  },
  {
    id: "image-dithering",
    groupId: "image",
    title: "抖动",
    summary: "开启后会用误差扩散保留渐变层次，但颗粒感会更强。",
    keywords: ["抖动", "误差扩散", "渐变", "颗粒", "量化", "floyd"],
    sections: [
      {
        title: "适用场景",
        items: [
          "适合颜色过渡多、原图渐变明显的照片类素材。",
          "适合想保留明暗层次，但能接受边缘颗粒感更强的情况。",
          "如果希望边界更干净、颜色块更整齐，通常建议关闭抖动。",
        ],
      },
    ],
  },
  {
    id: "remove-background",
    groupId: "image",
    title: "自动去背景",
    summary: "系统会按四角背景色估算背景范围，清掉接近背景色的像素，适合纯色背景图片。",
    keywords: ["去背景", "背景", "抠图", "四角", "边缘", "纯色"],
    sections: [
      {
        title: "工作方式",
        paragraphs: [
          "当前算法用图片四个角的颜色估算背景，再把接近背景的像素视为透明。",
          "它更适合证件照、商品图、纯底海报这类背景较单一的图片。",
        ],
      },
      {
        title: "注意事项",
        items: [
          "如果主体边缘颜色和背景很接近，去背景时可能一起被削掉。",
          "背景复杂、渐变背景、阴影很重的图片，需要配合容差反复试。",
        ],
      },
    ],
  },
  {
    id: "background-tolerance",
    groupId: "image",
    title: "背景容差",
    summary: "数值越大，越容易把接近背景色的边缘一起去掉。",
    keywords: ["容差", "背景容差", "边缘", "去背景", "误删"],
    sections: [
      {
        title: "调节建议",
        items: [
          "容差低时，保留更多边缘细节，但背景可能去不干净。",
          "容差高时，背景去得更彻底，但主体边缘更容易被吃掉。",
          "建议从低值开始慢慢调，边看预览边决定是否继续增大。",
        ],
      },
    ],
  },
  {
    id: "advanced-palette",
    groupId: "colors",
    title: "高级颜色与全启用 / 全禁用",
    summary: "这里决定生成图纸时哪些拼豆颜色可以参与匹配，也能给替换颜色和吸色提供目标色。",
    keywords: ["高级颜色", "调色板", "全启用", "全禁用", "可用色", "替换颜色", "吸色"],
    sections: [
      {
        title: "可用色控制",
        items: [
          "勾选表示该颜色允许参与图片转图纸时的颜色匹配。",
          "取消勾选后，这个颜色不会被自动生成算法选中。",
          "全启用会放开全部颜色，适合先看完整自动结果。",
          "全禁用会快速缩小可用范围，便于只保留少量指定颜色来重新生成。",
        ],
      },
      {
        title: "替换颜色",
        items: [
          "先点“源”或“目标”，再在上方颜色里点击，就能把该颜色写入当前槽位。",
          "切到吸色工具后，在画布上点一个已有颜色，也会写入当前选中的源或目标槽位。",
        ],
      },
    ],
  },
  {
    id: "edit-tools",
    groupId: "canvas",
    title: "编辑工具",
    summary: "画笔、橡皮、移动画布、吸色、填充、框选都直接服务于中间画布编辑。",
    keywords: ["画笔", "橡皮", "移动画布", "吸色", "填充", "框选", "编辑"],
    sections: [
      {
        title: "工具说明",
        items: [
          "画笔：给格子上当前颜色。",
          "橡皮：清空当前格子的颜色。",
          "移动画布：拖动画布视图，不改图案内容。",
          "吸色：从画布里取一个已存在的颜色。",
          "填充：把一片连续区域替换成当前颜色。",
          "框选：选中一块区域后复制、移动、清空。",
        ],
      },
      {
        title: "快捷键",
        items: [
          "B 画笔，E 橡皮，H 移动画布，I 吸色，F 填充，V 框选。",
          "Ctrl 或 Command + Z 撤销，Shift + Ctrl 或 Command + Z 重做。",
          "Ctrl 或 Command + C / X / V 支持复制、剪切、粘贴选区。",
        ],
      },
    ],
  },
  {
    id: "arrange-tools",
    groupId: "canvas",
    title: "视图与画布整理",
    summary: "撤销、重做、网格、复位视图和整理按钮只影响视图或图案布局，不改图片预览区。",
    keywords: ["撤销", "重做", "网格", "复位视图", "适应绘图", "留白", "居中"],
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
          "适应绘图：裁掉四周空白，让图案边缘刚好贴住内容。",
          "留白 4 格：在图案四周补出 4 格空白边距。",
          "居中内容：把当前图案整体移到画布中心。",
        ],
      },
    ],
  },
  {
    id: "touch-canvas",
    groupId: "canvas",
    title: "画布触控手势",
    summary: "平板上可双指缩放和平移画布，也能切换到“移动画布”后单指拖动。",
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
    summary: "图片预览区支持单指拖动和双指缩放，适合 iPad 上先摆好图片再生成。",
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
  dithering: "image-dithering",
  removeBackground: "remove-background",
  tolerance: "background-tolerance",
  advancedPalette: "advanced-palette",
  toolbar: "edit-tools",
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
  touchImageNoteText: "桌面可滚轮缩放，平板可单指拖动、双指缩放。",
  stageEmptyTitle: "进入工作台后开始",
  stageEmptyText: "在左侧上传图片生成图纸，或直接在当前空白画布上开始绘制。",
} as const;

export function buildHelpSearchText(article: EditorHelpArticle) {
  return [
    article.title,
    article.summary,
    article.keywords.join(" "),
    ...article.sections.map((section) => [
      section.title,
      section.paragraphs?.join(" ") ?? "",
      section.items?.join(" ") ?? "",
    ].join(" ")),
  ]
    .join(" ")
    .toLowerCase();
}
