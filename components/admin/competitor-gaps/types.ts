// Session 31 (B): types for the competitor-gaps admin UI.

export interface GapRow {
  topic: string;
  competitors: string[];
  category: string;
  competitorUrls: string[];
  ourCoverage: boolean;
}
