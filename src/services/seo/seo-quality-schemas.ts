import { z } from "zod";

export const SearchIntentSchema = z.enum([
  "INFORMATIONAL",
  "COMMERCIAL",
  "TRANSACTIONAL",
  "NAVIGATIONAL"
]);
export type SearchIntent = z.infer<typeof SearchIntentSchema>;

export const QualityIssueSeveritySchema = z.enum(["BLOCKER", "WARNING", "SUGGESTION"]);
export type QualityIssueSeverity = z.infer<typeof QualityIssueSeveritySchema>;

export interface QualityIssue {
  category: string;
  severity: QualityIssueSeverity;
  code: string;
  message: string;
  recommendation: string;
}

export interface CategoryScoreResult {
  category: string;
  score: number; // 0 - 100
  weight: number; // Decimal weight summing to 1.0
  evidence: string;
  issues: QualityIssue[];
}

export interface ArticleQualityEvaluationInput {
  title: string;
  content: string; // Markdown or plain text
  metaTitle?: string | null;
  metaDescription?: string | null;
  slug?: string | null;
  focusKeyword?: string | null;
  secondaryKeywords?: string[];
  searchIntent?: SearchIntent;
  outlineObjectives?: string[];
  images?: Array<{ altText: string; isFeatured: boolean }>;
}

export interface ArticleQualityEvaluationReport {
  overallScore: number; // 0 - 100 (weighted aggregate)
  status: "EXCELLENT" | "SATISFACTORY" | "NEEDS_IMPROVEMENT" | "BLOCKED";
  canProceedToReview: boolean;
  blockers: QualityIssue[];
  warnings: QualityIssue[];
  suggestions: QualityIssue[];
  categoryScores: Record<string, CategoryScoreResult>;
  intentSatisfaction: {
    intent: SearchIntent;
    isSatisfied: boolean;
    evidence: string;
  };
  metrics: {
    wordCount: number;
    h1Count: number;
    h2Count: number;
    h3Count: number;
    faqCount: number;
    fleschKincaidGrade: number;
    readingEaseScore: number;
    keywordOccurrences: number;
  };
  disclaimer: string;
  evaluatedAt: string;
}

// ============================================================================
// HELPER PARSERS (Pure Deterministic Functions)
// ============================================================================

export function extractHeadings(markdown: string): Array<{ level: number; text: string }> {
  const lines = markdown.split("\n");
  const headings: Array<{ level: number; text: string }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      headings.push({ level: 1, text: trimmed.slice(2).trim() });
    } else if (trimmed.startsWith("## ")) {
      headings.push({ level: 2, text: trimmed.slice(3).trim() });
    } else if (trimmed.startsWith("### ")) {
      headings.push({ level: 3, text: trimmed.slice(4).trim() });
    }
  }

  return headings;
}

export function computeFleschReadingEase(text: string): { readingEase: number; gradeLevel: number } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { readingEase: 0, gradeLevel: 0 };

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const wordCount = words.length;

  // Syllable counting heuristic
  let syllableCount = 0;
  for (const word of words) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    if (clean.length <= 3) {
      syllableCount += 1;
      continue;
    }
    const matches = clean.match(/[aeiouy]{1,2}/g);
    let count = matches ? matches.length : 1;
    if (clean.endsWith("e") && !clean.endsWith("le") && count > 1) {
      count -= 1;
    }
    syllableCount += Math.max(1, count);
  }

  // Flesch Reading Ease formula: 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = syllableCount / wordCount;
  const readingEase = Math.round(
    Math.max(0, Math.min(100, 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord))
  );

  // Flesch-Kincaid Grade Level formula: 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
  const gradeLevel = Math.max(1, Math.round((0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59) * 10) / 10);

  return { readingEase, gradeLevel };
}

export function detectRepetition(text: string): { repeatedSentences: string[]; repetitionScore: number } {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 25);

  const seen = new Set<string>();
  const repeated = new Set<string>();

  for (const s of sentences) {
    if (seen.has(s)) {
      repeated.add(s);
    }
    seen.add(s);
  }

  const repeatedSentences = Array.from(repeated);
  // Score: 100 if no repetition, -15 per repeated sentence
  const repetitionScore = Math.max(0, 100 - repeatedSentences.length * 20);

  return { repeatedSentences, repetitionScore };
}
