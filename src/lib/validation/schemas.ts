import { z } from "zod";

const lineSchema = z.object({
  variantId: z.string().min(1).max(100),
  quantity: z.number().int().min(1).max(99),
});

export const validateCartSchema = z.object({
  lines: z.array(lineSchema).max(50),
  coupon: z.string().max(40).optional(),
});

export const addressSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,17}$/),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(80),
  region: z.string().trim().max(80).optional(),
  country: z.enum(["AE", "SA", "KW", "QA", "BH", "OM"]),
  postalCode: z.string().trim().max(20).optional(),
});

export const checkoutSchema = z.object({
  lines: z.array(lineSchema).min(1).max(50),
  contact: z.object({ email: z.string().trim().email().max(160), phone: z.string().trim().max(30) }),
  address: addressSchema,
  shippingRateId: z.string().min(1).max(60),
  couponCode: z.string().max(40).optional(),
  paymentMethod: z.enum(["mock-paid", "mock-fail", "cod"]),
  idempotencyKey: z.string().min(8).max(80),
  locale: z.enum(["ar", "en"]),
});
