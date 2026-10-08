import React from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-[0_10px_24px_-10px_rgba(39,115,238,0.55)] hover:-translate-y-px hover:bg-brand-600 hover:shadow-[0_14px_30px_-10px_rgba(39,115,238,0.6)] disabled:opacity-50",
  secondary: "bg-surface-3 text-primary hover:bg-surface-4",
  ghost: "text-primary hover:bg-surface-3",
  outline: "border border-border text-primary hover:bg-surface-3",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2",
};

const base =
  "inline-flex items-center justify-center rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

type ButtonProps = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type LinkButtonProps = CommonProps & { href: string } & Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    "href"
  >;

export function Button({ variant = "primary", size = "md", className = "", children, ...props }: ButtonProps) {
  return (
    <button className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({ variant = "primary", size = "md", className = "", href, children, ...props }: LinkButtonProps) {
  return (
    <Link href={href} className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
