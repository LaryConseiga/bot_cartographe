import { z } from "zod";

export const zUserId = z.string().uuid();

export const zUpsertProfile = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1).max(120).nullable().optional(),
  email: z.string().email().nullable().optional(),
  country: z.string().max(8).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  field_of_study: z.string().max(120).nullable().optional(),
  school: z.string().max(160).nullable().optional(),
  graduation_year: z.number().int().min(1950).max(2100).nullable().optional(),
  target_role: z.string().max(120).nullable().optional(),
  target_country: z.string().max(8).nullable().optional(),
  target_sector: z.string().max(120).nullable().optional(),
  willing_to_relocate: z.boolean().nullable().optional(),
  preferred_lang: z.string().max(8).nullable().optional(),
  cv_text: z.string().max(20000).nullable().optional()
});

export const zCreateChat = z.object({
  student_id: z.string().uuid(),
  session_ref: z.string().min(3).max(80).optional()
});

export const zCreateMessage = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(8000)
});

export const zAuthSignup = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  full_name: z.string().min(1).max(120).optional(),
  country: z.string().max(8).optional(),
  city: z.string().max(80).optional(),
  preferred_lang: z.string().max(8).optional()
});

export const zAuthLogin = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128)
});

export const zDevCreateUser = z.object({
  secret: z.string().min(6),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  full_name: z.string().min(1).max(120).optional()
});

