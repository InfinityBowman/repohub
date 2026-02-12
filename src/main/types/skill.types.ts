export interface SkillSource {
  id: string;
  owner: string;
  repo: string;
  label: string;
  branch: string;
  skillsDir: string; // subdirectory containing skills, e.g. 'skills' or '' for root
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
  /** Content of all text files in the skill directory, keyed by relative path */
  allTextContent?: Record<string, string>;
}

export interface DirectorySkill {
  source: string; // "owner/repo"
  skillId: string; // "skill-name"
  name: string;
  installs: number;
}
