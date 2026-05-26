import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "default" | "compact";
type ButtonTone = "default" | "editor";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    tone?: ButtonTone;
  }
>;

export function Button({
  children,
  className = "",
  variant = "secondary",
  size = "default",
  tone = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`button button--${variant} button--${size} button--tone-${tone} ${className}`.trim()}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
