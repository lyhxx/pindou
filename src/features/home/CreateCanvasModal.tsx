import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";

type CreateCanvasModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: { width: number; height: number; presetLabel?: string }) => void;
};

const presets = [
  { label: "练习", width: 48, height: 48, note: "适合小图和试色" },
  { label: "常用", width: 96, height: 96, note: "大多数图片都够用" },
  { label: "创作", width: 160, height: 120, note: "适合较复杂画面" },
];

export function CreateCanvasModal({ open, onClose, onCreate }: CreateCanvasModalProps) {
  const [width, setWidth] = useState("96");
  const [height, setHeight] = useState("96");
  const [selectedPreset, setSelectedPreset] = useState<string>("常用");

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const widthValue = clampDimension(width);
  const heightValue = clampDimension(height);
  const totalCells = widthValue * heightValue;
  const widthCm = ((widthValue * 5) / 10).toFixed(1);
  const heightCm = ((heightValue * 5) / 10).toFixed(1);
  const canCreate = widthValue > 0 && heightValue > 0;

  const summaryLabel = useMemo(() => {
    const preset = presets.find((item) => item.label === selectedPreset);
    if (!preset) {
      return "自定义";
    }

    return `${preset.label} 规格`;
  }, [selectedPreset]);

  if (!open) {
    return null;
  }

  function applyPreset(label: string, presetWidth: number, presetHeight: number) {
    setSelectedPreset(label);
    setWidth(String(presetWidth));
    setHeight(String(presetHeight));
  }

  function handleCreate() {
    if (!canCreate) {
      return;
    }

    onCreate({
      width: widthValue,
      height: heightValue,
      presetLabel: selectedPreset,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label="新建画布"
        className="modal-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-sheet__header">
          <div>
            <p className="modal-sheet__eyebrow">新建画布</p>
            <h2 className="modal-sheet__title">先确定画布，再进入工作台。</h2>
          </div>
          <Button onClick={onClose} size="compact">
            关闭
          </Button>
        </header>

        <div className="modal-sheet__body">
          <section className="modal-sheet__block">
            <div className="modal-sheet__block-head">
              <strong>常用规格</strong>
              <span>先选一个接近的尺寸</span>
            </div>
            <div className="preset-grid">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  className={`preset-card${
                    selectedPreset === preset.label ? " preset-card--active" : ""
                  }`}
                  onClick={() => applyPreset(preset.label, preset.width, preset.height)}
                  type="button"
                >
                  <strong>{preset.label}</strong>
                  <span>
                    {preset.width} x {preset.height}
                  </span>
                  <small>{preset.note}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="modal-sheet__block">
            <div className="modal-sheet__block-head">
              <strong>自定义尺寸</strong>
              <span>范围 1 到 300</span>
            </div>
            <div className="control-grid control-grid--double">
              <label className="field">
                <span>宽度</span>
                <input
                  className="field__input"
                  inputMode="numeric"
                  max={300}
                  min={1}
                  onChange={(event) => {
                    setSelectedPreset("自定义");
                    setWidth(event.target.value);
                  }}
                  type="number"
                  value={width}
                />
              </label>
              <label className="field">
                <span>高度</span>
                <input
                  className="field__input"
                  inputMode="numeric"
                  max={300}
                  min={1}
                  onChange={(event) => {
                    setSelectedPreset("自定义");
                    setHeight(event.target.value);
                  }}
                  type="number"
                  value={height}
                />
              </label>
            </div>
          </section>

          <section className="modal-sheet__block">
            <div className="modal-sheet__block-head">
              <strong>结果预估</strong>
              <span>{summaryLabel}</span>
            </div>
            <div className="summary-grid summary-grid--compact">
              <div>
                <span>总格数</span>
                <strong>{totalCells.toLocaleString("zh-CN")}</strong>
              </div>
              <div>
                <span>成品尺寸</span>
                <strong>
                  {widthCm} x {heightCm} cm
                </strong>
              </div>
            </div>
          </section>
        </div>

        <footer className="modal-sheet__footer">
          <span className="modal-sheet__tip">创建后可继续上传图片并自动转图纸。</span>
          <div className="inline-actions">
            <Button onClick={onClose}>取消</Button>
            <Button disabled={!canCreate} onClick={handleCreate} variant="primary">
              创建画布
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function clampDimension(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(1, Math.min(300, Math.round(parsed)));
}
