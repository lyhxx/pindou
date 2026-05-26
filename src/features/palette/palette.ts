import type { PaletteColor } from "../../shared/types/project";

export const defaultPalette: PaletteColor[] = [
  { id: "C01", name: "奶油白", hex: "#F6E7D0", rgb: [246, 231, 208] },
  { id: "C09", name: "浅木棕", hex: "#A86C4B", rgb: [168, 108, 75] },
  { id: "C18", name: "砖红", hex: "#E85D3F", rgb: [232, 93, 63] },
  { id: "C24", name: "孔雀蓝", hex: "#4AA3A1", rgb: [74, 163, 161] },
  { id: "C30", name: "工坊绿", hex: "#2F8F83", rgb: [47, 143, 131] },
  { id: "C41", name: "暖杏黄", hex: "#F2C14E", rgb: [242, 193, 78] },
  { id: "C53", name: "松木褐", hex: "#7B5642", rgb: [123, 86, 66] },
  { id: "C67", name: "影子灰", hex: "#7A6C5B", rgb: [122, 108, 91] },
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
