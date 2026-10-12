export interface Segment { start: number; text: string }
export interface Section {
  heading: string;
  points: string[];
  subsections?: { heading: string; points: string[] }[];
  source_timestamp: number;
}
export interface Outline { title: string; sections: Section[] }
export interface SeoMeta { meta_title: string; meta_description: string; keywords: string[]; slug_suggestion: string }
export class TranscriptError extends Error {}
export class LlmError extends Error {}
