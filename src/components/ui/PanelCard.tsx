import type { PropsWithChildren, ReactNode } from "react";

type PanelCardProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  footer?: ReactNode;
  className?: string;
}>;

export function PanelCard({
  children,
  title,
  eyebrow,
  footer,
  className = "",
}: PanelCardProps) {
  return (
    <section className={`panel-card ${className}`.trim()}>
      <header className="panel-card__header">
        {eyebrow ? <p className="panel-card__eyebrow">{eyebrow}</p> : null}
        <h3 className="panel-card__title">{title}</h3>
      </header>
      <div className="panel-card__body">{children}</div>
      {footer ? <footer className="panel-card__footer">{footer}</footer> : null}
    </section>
  );
}
