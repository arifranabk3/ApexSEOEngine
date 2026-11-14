import { z } from "zod";

export const SvgTemplateTypeEnum = z.enum([
  "FEATURED_HERO",
  "TECHNICAL_ARCHITECTURE",
  "PROCESS_FLOWCHART",
  "COMPARISON_CHART",
  "CORE_WEB_VITALS",
  "STEP_BY_STEP_GUIDE"
]);
export type SvgTemplateType = z.infer<typeof SvgTemplateTypeEnum>;

export interface SvgGeneratorOptions {
  title: string;
  subtitle?: string;
  categoryName?: string;
  focusKeyword?: string;
  templateType: SvgTemplateType;
  primaryColor?: string;
  accentColor?: string;
  diagramNodes?: Array<{ label: string; subtext?: string }>;
  comparisonRows?: Array<{ metric: string; optionA: string; optionB: string }>;
  width?: number;
  height?: number;
}

export interface GeneratedSvgAsset {
  svgContent: string;
  filename: string;
  altText: string;
  title: string;
  caption: string;
  width: number;
  height: number;
  templateType: SvgTemplateType;
  fileSizeBytes: number;
}
