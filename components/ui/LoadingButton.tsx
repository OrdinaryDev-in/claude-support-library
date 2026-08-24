"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";

/** Shared pending/loading affordance for buttons that trigger a server
 * action and wait for the response. Standardizes what every button in this
 * app was already hand-rolling independently (disable + swap the label to a
 * gerund) and adds a spinner, which nothing had before. Pass the button's
 * normal styling via `className` as usual — this only adds the disabled
 * state, `aria-busy`, and the spinner/label swap on top. */
export function LoadingButton({
  pending,
  pendingLabel,
  children,
  disabled,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pending: boolean;
  pendingLabel: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={pending || disabled}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:cursor-default ${className}`}
    >
      {pending && <Spinner />}
      {pending ? pendingLabel : children}
    </button>
  );
}
