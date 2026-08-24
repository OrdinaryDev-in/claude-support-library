import { z } from "zod";

export const categoryResourceTypeValues = ["prompt", "skill", "connector"] as const;

export const categorySchema = z.object({
  resource_type: z.enum(categoryResourceTypeValues),
  key: z
    .string()
    .trim()
    .min(1, "Key is required.")
    .max(60)
    .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, "Use lowercase letters, numbers, and underscores only (e.g. new_app)."),
  label: z.string().trim().min(1, "Label is required.").max(60),
  color: z.string().trim().min(1, "Color is required.").max(60),
  sort_order: z.coerce.number().int().min(0).max(1000).default(0),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
