export interface SkillSource {
  id: string;
  owner: string;
  repo: string;
  label: string;
  branch: string;
}

export interface SkillSummary {
  sourceId: string;
  path: string;
  name: string;
  description: string;
  tags: string[];
}

export interface SkillDetail extends SkillSummary {
  version?: string;
  content: string;
  files: string[];
  rawFrontmatter: Record<string, any>;
}
