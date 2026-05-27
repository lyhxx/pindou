type BrandMarkProps = {
  className?: string;
  alt?: string;
};

export function BrandMark({
  className = "",
  alt = "拼豆工坊品牌图标",
}: BrandMarkProps) {
  return (
    <img
      alt={alt}
      className={`brand-mark ${className}`.trim()}
      decoding="async"
      draggable={false}
      src="/brand/mushroom-logo.svg"
    />
  );
}
