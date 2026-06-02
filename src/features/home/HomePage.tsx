import { BrandMark } from "../../components/ui/BrandMark";
import { Button } from "../../components/ui/Button";
import { useTheme } from "../theme/theme";

type HomePageProps = {
  onEnterEditor: () => void;
};

export function HomePage({ onEnterEditor }: HomePageProps) {
  const { themeId } = useTheme();
  const isChildrensDay = themeId === "childrens-day";

  return (
    <div className="app-shell app-shell--home">
      <main className="home-entry">
        <section className={`home-entry__hero${isChildrensDay ? " home-entry__hero--childrens-day" : ""}`}>
          <div className="home-entry__copy">
            {isChildrensDay ? <span className="home-entry__season-badge">61 限定皮肤</span> : null}
            <div className="home-entry__brand-lockup">
              <BrandMark className="home-entry__brand-mark" />
              <span className="home-entry__brand">拼豆工坊</span>
            </div>
            <h1 className="home-entry__title">把图片变成能直接开工的拼豆图纸</h1>
            <p className="home-entry__subtitle">本地转换、手工修正、导出图纸与清单</p>
            <div className="home-entry__actions">
              <Button onClick={onEnterEditor} variant="primary">
                进入工作台
              </Button>
            </div>
          </div>

          <div className="home-entry__visual" aria-hidden="true">
            {isChildrensDay ? (
              <div className="festival-hero">
                <div className="festival-hero__garland">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <span key={index} className={`festival-hero__flag festival-hero__flag--${index % 6}`} />
                  ))}
                </div>
                <div className="festival-hero__stickers">
                  <span className="festival-hero__sticker festival-hero__sticker--star" />
                  <span className="festival-hero__sticker festival-hero__sticker--heart" />
                  <span className="festival-hero__sticker festival-hero__sticker--spark" />
                </div>
              </div>
            ) : null}
            <div className="entry-flow">
              <div className="entry-flow__panel entry-flow__panel--image">
                <div className="entry-flow__thumb entry-flow__thumb--image" />
                <span>原图</span>
              </div>
              <span className="entry-flow__arrow">→</span>
              <div className="entry-flow__panel entry-flow__panel--beads">
                <div className="entry-flow__thumb entry-flow__thumb--beads">
                  {Array.from({ length: 25 }).map((_, index) => (
                    <span key={index} className={`entry-dot entry-dot--${index % 5}`} />
                  ))}
                </div>
                <span>拼豆图</span>
              </div>
              <span className="entry-flow__arrow">→</span>
              <div className="entry-flow__panel entry-flow__panel--pattern">
                <div className="entry-flow__thumb entry-flow__thumb--pattern">
                  <div className="entry-flow__grid" />
                </div>
                <span>图纸</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
