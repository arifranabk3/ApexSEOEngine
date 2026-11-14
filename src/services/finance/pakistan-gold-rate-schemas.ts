import { z } from "zod";

// ============================================================================
// 1. SUPPORTED CITIES & PURITY ENUMS
// ============================================================================

export const SupportedCitySlugSchema = z.enum([
  "islamabad",
  "rawalpindi",
  "karachi",
  "lahore",
  "peshawar",
  "faisalabad",
  "multan",
  "quetta"
]);
export type SupportedCitySlug = z.infer<typeof SupportedCitySlugSchema>;

export const CITY_DISPLAY_NAMES: Record<SupportedCitySlug, string> = {
  islamabad: "Islamabad",
  rawalpindi: "Rawalpindi",
  karachi: "Karachi",
  lahore: "Lahore",
  peshawar: "Peshawar",
  faisalabad: "Faisalabad",
  multan: "Multan",
  quetta: "Quetta"
};

// ============================================================================
// 2. SARAFA.PK RAW API RESPONSE SCHEMA
// ============================================================================

export const SarafaRatesObjectSchema = z.object({
  gold_24k: z.number().nullable().optional(),
  pathoor_24k: z.number().nullable().optional(),
  gold_22k: z.number().nullable().optional(),
  gold_21k: z.number().nullable().optional(),
  gold_18k: z.number().nullable().optional()
}).passthrough();

export const SarafaCityDataSchema = z.object({
  city: z.string().optional(),
  slug: z.string().optional(),
  metal: z.string().optional(),
  rate_24k_tola: z.number().nullable().optional(),
  adjustment: z.number().nullable().optional(),
  adjustment_percent: z.number().nullable().optional(),
  currency: z.string().default("PKR"),
  last_updated: z.string().optional(),
  rates: z.object({
    tola: SarafaRatesObjectSchema.optional(),
    gram_10: SarafaRatesObjectSchema.optional()
  }).passthrough().optional()
}).passthrough();

export const SarafaApiResponseSchema = z.union([
  SarafaCityDataSchema,
  z.array(SarafaCityDataSchema),
  z.object({
    status: z.string().optional(),
    code: z.number().optional(),
    data: z.union([SarafaCityDataSchema, z.array(SarafaCityDataSchema)]).optional()
  }).passthrough()
]);

// ============================================================================
// 3. NORMALIZED DOMAIN MODELS FOR APEX DASHBOARD
// ============================================================================

export const PurityPriceDetailSchema = z.object({
  purity: z.enum(["24K", "22K", "21K", "18K"]),
  label: z.string(),
  perTolaPkr: z.number().nullable(),
  per10GramsPkr: z.number().nullable(),
  perGramPkr: z.number().nullable(), // Derived from 10g / 10 when 10g available
  isDerivedGramPrice: z.boolean().default(true)
});
export type PurityPriceDetail = z.infer<typeof PurityPriceDetailSchema>;

export const PakistanGoldRatesResultSchema = z.object({
  citySlug: SupportedCitySlugSchema,
  cityName: z.string(),
  currency: z.literal("PKR"),
  rates: z.object({
    "24K": PurityPriceDetailSchema,
    "22K": PurityPriceDetailSchema,
    "21K": PurityPriceDetailSchema,
    "18K": PurityPriceDetailSchema
  }),
  pathoor24kPerTola: z.number().nullable().optional(),
  providerTimestamp: z.string(),
  cachedAt: z.string(),
  expiresAt: z.string(),
  isStale: z.boolean().default(false),
  staleReason: z.string().optional(),
  remainingDailyQuota: z.number().nullable(),
  providerAttribution: z.string(),
  providerUrl: z.string(),
  disclaimer: z.string()
});
export type PakistanGoldRatesResult = z.infer<typeof PakistanGoldRatesResultSchema>;

export const DISCLAIMER_TEXT =
  "Rates sourced directly from Sarafa.pk bullion market feeds. Spot bullion benchmark rates do not include jeweler making charges, wastage, or regional retail commissions. Verify with your local Sarafa association prior to commercial execution.";
