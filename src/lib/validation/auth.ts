import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(8).max(200),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(1).max(200),
});
export const addressInputSchema = z.object({
  label: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,17}$/),
  line1: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(80),
  country: z.enum(["AE", "SA", "KW", "QA", "BH", "OM"]),
});
