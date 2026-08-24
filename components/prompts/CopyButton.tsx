"use client";

import { useState } from "react";

export function CopyButton({ text, label = "prompt" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "Copied to clipboard" : `Copy ${label} to clipboard`}
      className="px-3.5 py-2 rounded-md border text-[13px] font-semibold transition-colors"
      style={{
        borderColor: copied ? "var(--teal)" : "var(--brass)",
        color: copied ? "var(--teal)" : "var(--brass)",
      }}
    >
      {copied ? "✓ Copied" : `Copy ${label}`}
    </button>
  );
}
