import type { PaletteColor } from "../../shared/types/project";

export const defaultPalette: PaletteColor[] = [
  { id: "W01", name: "亮白", hex: "#F7F4ED", rgb: [247, 244, 237] },
  { id: "W02", name: "奶油白", hex: "#F1E3C8", rgb: [241, 227, 200] },
  { id: "W03", name: "米杏", hex: "#E7D0AE", rgb: [231, 208, 174] },
  { id: "Y01", name: "浅柠黄", hex: "#F5E57A", rgb: [245, 229, 122] },
  { id: "Y02", name: "向日黄", hex: "#F2C14E", rgb: [242, 193, 78] },
  { id: "Y03", name: "芥末黄", hex: "#D7A628", rgb: [215, 166, 40] },
  { id: "O01", name: "浅橙", hex: "#F2B277", rgb: [242, 178, 119] },
  { id: "O02", name: "南瓜橙", hex: "#E58A3C", rgb: [229, 138, 60] },
  { id: "O03", name: "陶土橙", hex: "#C96A2B", rgb: [201, 106, 43] },
  { id: "R01", name: "珊瑚粉", hex: "#F09A93", rgb: [240, 154, 147] },
  { id: "R02", name: "莓果粉", hex: "#E56D7A", rgb: [229, 109, 122] },
  { id: "R03", name: "正红", hex: "#E04B41", rgb: [224, 75, 65] },
  { id: "R04", name: "砖红", hex: "#B94A43", rgb: [185, 74, 67] },
  { id: "P01", name: "浅粉", hex: "#F4C8D8", rgb: [244, 200, 216] },
  { id: "P02", name: "玫瑰粉", hex: "#DA8DAA", rgb: [218, 141, 170] },
  { id: "P03", name: "豆沙粉", hex: "#BC718C", rgb: [188, 113, 140] },
  { id: "V01", name: "雾紫", hex: "#C8B7DB", rgb: [200, 183, 219] },
  { id: "V02", name: "薰衣草紫", hex: "#A490C5", rgb: [164, 144, 197] },
  { id: "V03", name: "深莓紫", hex: "#7D659A", rgb: [125, 101, 154] },
  { id: "B01", name: "冰蓝", hex: "#CDE7F4", rgb: [205, 231, 244] },
  { id: "B02", name: "天青蓝", hex: "#8EC9E8", rgb: [142, 201, 232] },
  { id: "B03", name: "湖蓝", hex: "#5CA9D6", rgb: [92, 169, 214] },
  { id: "B04", name: "钴蓝", hex: "#3F79B5", rgb: [63, 121, 181] },
  { id: "B05", name: "夜蓝", hex: "#284A73", rgb: [40, 74, 115] },
  { id: "T01", name: "薄荷绿", hex: "#C8EFE7", rgb: [200, 239, 231] },
  { id: "T02", name: "浅湖绿", hex: "#84D6C7", rgb: [132, 214, 199] },
  { id: "T03", name: "孔雀绿", hex: "#4AA3A1", rgb: [74, 163, 161] },
  { id: "T04", name: "深湖绿", hex: "#2F8F83", rgb: [47, 143, 131] },
  { id: "G01", name: "嫩芽绿", hex: "#CFE59A", rgb: [207, 229, 154] },
  { id: "G02", name: "苹果绿", hex: "#9CCB65", rgb: [156, 203, 101] },
  { id: "G03", name: "草地绿", hex: "#6FA44B", rgb: [111, 164, 75] },
  { id: "G04", name: "森林绿", hex: "#4F7A3B", rgb: [79, 122, 59] },
  { id: "N01", name: "沙米", hex: "#D9C2A4", rgb: [217, 194, 164] },
  { id: "N02", name: "焦糖棕", hex: "#B98257", rgb: [185, 130, 87] },
  { id: "N03", name: "胡桃棕", hex: "#8E5E4C", rgb: [142, 94, 76] },
  { id: "N04", name: "深木棕", hex: "#684636", rgb: [104, 70, 54] },
  { id: "N05", name: "咖啡棕", hex: "#4E352B", rgb: [78, 53, 43] },
  { id: "S01", name: "浅暖灰", hex: "#DDD6CB", rgb: [221, 214, 203] },
  { id: "S02", name: "暖灰", hex: "#B7AEA1", rgb: [183, 174, 161] },
  { id: "S03", name: "石墨灰", hex: "#8C847A", rgb: [140, 132, 122] },
  { id: "S04", name: "深灰", hex: "#615A52", rgb: [97, 90, 82] },
  { id: "K01", name: "炭黑", hex: "#2C2925", rgb: [44, 41, 37] },
];

export const defaultPaletteIds = defaultPalette.map((color) => color.id);

export function normalizeEnabledPaletteIds(enabledPaletteIds?: string[]) {
  if (!enabledPaletteIds || enabledPaletteIds.length === 0) {
    return [...defaultPaletteIds];
  }

  const validIds = new Set(defaultPaletteIds);
  const deduped = enabledPaletteIds.filter((id, index) => {
    return validIds.has(id) && enabledPaletteIds.indexOf(id) === index;
  });

  return deduped.length > 0 ? deduped : [...defaultPaletteIds];
}

export function findPaletteIndexById(colorId: string) {
  return defaultPalette.findIndex((item) => item.id === colorId);
}

export function findPaletteColorById(colorId: string) {
  return defaultPalette.find((item) => item.id === colorId) ?? defaultPalette[0];
}
