export interface LibrarySection {
  key: "prompts" | "skills" | "connectors";
  volume: "I" | "II" | "III";
  label: string;
  description: string;
  href: string;
  enabled: boolean;
  /** shown on the enabled card, e.g. "8 charted" */
  status?: string;
}

// Single source of truth for the /library hub and the NavBar's section
// links. Lighting up a future section (Skills, Cloud Connectors) is a
// one-line `enabled: true` flip plus its own route folder — no changes to
// the hub or nav components themselves.
export const LIBRARY_SECTIONS: LibrarySection[] = [
  {
    key: "prompts",
    volume: "I",
    label: "Prompts",
    description:
      "Elaborate, structured prompt templates for building, extending, and debugging.",
    href: "/library/prompts",
    enabled: true,
  },
  {
    key: "skills",
    volume: "II",
    label: "Skills",
    description: "Reusable, tool-agnostic agent workflow templates.",
    href: "/library/skills",
    enabled: true,
  },
  {
    key: "connectors",
    volume: "III",
    label: "Cloud Connectors",
    description: "Reference docs for cloud providers — coming soon.",
    href: "/library/connectors",
    enabled: false,
  },
];
