import type { ChangeEvent } from "react";
import { useEditorStore } from "../editorStore";

export function ImageUploadField() {
  const setSourceImage = useEditorStore((state) => state.setSourceImage);
  const resetImageTransform = useEditorStore((state) => state.resetImageTransform);
  const sourceImage = useEditorStore((state) => state.sourceImage);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const src = await fileToDataUrl(file);
    const dimensions = await getImageDimensions(src);

    setSourceImage({
      name: file.name,
      width: dimensions.width,
      height: dimensions.height,
      src,
    });
    resetImageTransform();
    event.target.value = "";
  }

  return (
    <label className="upload-field">
      <input
        accept="image/*"
        className="upload-field__input"
        onChange={handleFileChange}
        type="file"
      />
      <span className="upload-field__title">
        {sourceImage ? "重新上传图片" : "上传图片"}
      </span>
      <span className="upload-field__description">
        支持本地图像文件，上传后会立刻进入画布定位预览。
      </span>
    </label>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.width,
        height: image.height,
      });
    };
    image.onerror = () => reject(new Error("图片读取失败"));
    image.src = src;
  });
}
