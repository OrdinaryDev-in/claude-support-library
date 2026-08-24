import { assembleSkillTemplate } from "@/lib/validation/skill-schema";

export interface ExportableSkill {
  slug: string;
  title: string;
  trigger_description: string;
  instructions_body: string;
  required_tools_guidance: string;
  example_usage: string;
  expected_output_notes: string;
}

/** YAML scalar-safe single-line description: collapse whitespace/newlines
 * (frontmatter `description` must be one line) and escape embedded
 * backslashes and quotes so it stays valid inside a double-quoted YAML
 * string. Backslashes must be escaped *before* quotes — doing it in the
 * other order would double-escape the backslash the quote-escaping step
 * just inserted. Author-supplied text (any signed-in author can write
 * trigger_description) reaching an unescaped backslash here could break
 * out of the quoted scalar in the generated file. */
function yamlLine(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

/** Claude Code's actual Agent Skill format: YAML frontmatter (`name` +
 * `description` — `description` is what the agent reads to decide *when*
 * to invoke the skill, so it's the field worth getting right) followed by
 * the instructions as a markdown body. Save as SKILL.md under
 * ~/.claude/skills/<name>/ (or a project's .claude/skills/) to install it. */
export function toClaudeSkillMd(skill: ExportableSkill): string {
  return `---
name: ${skill.slug}
description: "${yamlLine(skill.trigger_description)}"
---

# ${skill.title}

${skill.instructions_body}

## Required Tools / Capabilities

${skill.required_tools_guidance}

## Example Usage

${skill.example_usage}

## Expected Output

${skill.expected_output_notes}
`;
}

/** Codex, a custom GPT's Instructions field, and most other agents don't
 * have a distinct structured skill-file format the way Claude Code
 * does — they just take plain instruction text. This is that: the same
 * assembled template the "Copy skill" button already puts on the
 * clipboard, as a downloadable .md file with a title heading. */
export function toGenericMarkdown(skill: ExportableSkill & { description: string }): string {
  return `# ${skill.title}

${skill.description}

${assembleSkillTemplate(skill)}
`;
}
