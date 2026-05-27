import type { PropsWithChildren, ReactNode } from "react";

type PanelCardProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  footer?: ReactNode;
  className?: string;
  tone?: "default" | "editor";
  titleAction?: ReactNode;
}>;

export function PanelCard({
  children,
  title,
  eyebrow,
  footer,
  className = "",
  tone = "default",
  titleAction,
}: PanelCardProps) {
  return (
    <section className={`panel-card panel-card--${tone} ${className}`.trim()}>
      <header className="panel-card__header">
        {eyebrow ? <p className="panel-card__eyebrow">{eyebrow}</p> : null}
        <div className="panel-card__title-row">
          <h3 className="panel-card__title">{title}</h3>
          {titleAction ? <div className="panel-card__title-action">{titleAction}</div> : null}
        </div>
      </header>
      <div className="panel-card__body">{children}</div>
      {footer ? <footer className="panel-card__footer">{footer}</footer> : null}
    </section>
  );
}
