import type { PropsWithChildren, ReactNode } from "react";

type PanelCardProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  footer?: ReactNode;
  className?: string;
  tone?: "default" | "editor";
}>;

export function PanelCard({
  children,
  title,
  eyebrow,
  footer,
  className = "",
  tone = "default",
}: PanelCardProps) {
  return (
    <section className={`panel-card panel-card--${tone} ${className}`.trim()}>
      <header className="panel-card__header">
        {eyebrow ? <p className="panel-card__eyebrow">{eyebrow}</p> : null}
        <h3 className="panel-card__title">{title}</h3>
      </header>
      <div className="panel-card__body">{children}</div>
      {footer ? <footer className="panel-card__footer">{footer}</footer> : null}
    </section>
  );
}
