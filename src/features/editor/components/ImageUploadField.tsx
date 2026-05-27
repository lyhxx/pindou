import type { ChangeEvent } from "react";
import { useEditorStore } from "../editorStore";

type ImageUploadFieldProps = {
  livePreviewEnabled: boolean;
  onLivePreviewChange: (enabled: boolean) => void;
};

export function ImageUploadField({
  livePreviewEnabled,
  onLivePreviewChange,
}: ImageUploadFieldProps) {
  const setSourceImage = useEditorStore((state) => state.setSourceImage);
  const resetImageTransform = useEditorStore((state) => state.resetImageTransform);
  const sourceImage = useEditorStore((state) => state.sourceImage);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const src = URL.createObjectURL(file);
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
    <div className="upload-field-row">
      <label className="upload-field">
        <input
          accept="image/*"
          className="upload-field__input"
          onChange={handleFileChange}
          type="file"
        />
        <span className="upload-field__content">
          <span className="upload-field__title">{sourceImage ? "更换图片" : "上传图片"}</span>
          <span className="upload-field__description">PNG / JPG，本地处理</span>
        </span>
      </label>

      <label className="switch-toggle switch-toggle--inline switch-toggle--stacked">
        <input
          checked={livePreviewEnabled}
          onChange={(event) => onLivePreviewChange(event.target.checked)}
          type="checkbox"
        />
        <span className="switch-toggle__track" aria-hidden="true">
          <span className="switch-toggle__thumb" />
        </span>
        <span className="switch-toggle__label switch-toggle__label--stacked">实时预览</span>
      </label>
    </div>
  );
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
