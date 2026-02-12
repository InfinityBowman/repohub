import { EventEmitter } from 'events';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import type { SkillSource, SkillSummary, SkillDetail } from '../types/skill.types';

const execFileAsync = promisify(execFile);

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const SKILL_SOURCES: SkillSource[] = [
  { id: 'anthropics', owner: 'anthropics', repo: 'skills', label: 'Anthropic', branch: 'main' },
  { id: 'openai', owner: 'openai', repo: 'codex-universal', label: 'OpenAI', branch: 'main' },
  { id: 'vercel', owner: 'vercel-labs', repo: 'agent-skills', label: 'Vercel', branch: 'main' },
];

export class SkillsService extends EventEmitter {
  private listCache = new Map<string, CacheEntry<SkillSummary[]>>();
  private detailCache = new Map<string, CacheEntry<SkillDetail>>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this.cleanupTimer = setInterval(() => this.cleanCache(), 30 * 60 * 1000);
  }

  shutdown(): void {
    clearInterval(this.cleanupTimer);
  }

  getSources(): SkillSource[] {
    return SKILL_SOURCES;
  }

  async listSkills(sourceId: string): Promise<SkillSummary[]> {
    const cached = this.listCache.get(sourceId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const source = SKILL_SOURCES.find(s => s.id === sourceId);
    if (!source) throw new Error(`Unknown source: ${sourceId}`);

    // List top-level contents of repo
    const contents = await this.ghApi(
      `repos/${source.owner}/${source.repo}/contents?ref=${source.branch}`,
    );
    const items = JSON.parse(contents);

    // Filter to directories only
    const dirs = (items as any[]).filter(
      (item: any) => item.type === 'dir' && !item.name.startsWith('.'),
    );

    // Fetch SKILL.md from each directory in parallel
    const skills: SkillSummary[] = [];
    const fetches = dirs.map(async (dir: any) => {
      try {
        const fileContent = await this.ghApi(
          `repos/${source.owner}/${source.repo}/contents/${dir.name}/SKILL.md?ref=${source.branch}`,
        );
        const fileData = JSON.parse(fileContent);
        const markdown = Buffer.from(fileData.content, 'base64').toString('utf-8');
        const { data: frontmatter } = matter(markdown);

        skills.push({
          sourceId: source.id,
          path: dir.name,
          name: (frontmatter.name as string) || dir.name,
          description: (frontmatter.description as string) || '',
          tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
        });
      } catch {
        // No SKILL.md in this dir — skip
      }
    });

    await Promise.all(fetches);

    // Sort alphabetically by name
    skills.sort((a, b) => a.name.localeCompare(b.name));

    this.listCache.set(sourceId, { data: skills, timestamp: Date.now() });
    return skills;
  }

  async getSkillDetail(sourceId: string, skillPath: string): Promise<SkillDetail> {
    const cacheKey = `${sourceId}:${skillPath}`;
    const cached = this.detailCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const source = SKILL_SOURCES.find(s => s.id === sourceId);
    if (!source) throw new Error(`Unknown source: ${sourceId}`);

    // Fetch SKILL.md content and directory listing in parallel
    const [skillMdRaw, dirListingRaw] = await Promise.all([
      this.ghApi(
        `repos/${source.owner}/${source.repo}/contents/${skillPath}/SKILL.md?ref=${source.branch}`,
      ),
      this.ghApi(
        `repos/${source.owner}/${source.repo}/contents/${skillPath}?ref=${source.branch}`,
      ),
    ]);

    const skillMdData = JSON.parse(skillMdRaw);
    const markdown = Buffer.from(skillMdData.content, 'base64').toString('utf-8');
    const { data: frontmatter, content } = matter(markdown);

    const dirListing = JSON.parse(dirListingRaw);
    const files = (dirListing as any[]).map((item: any) => item.name);

    const detail: SkillDetail = {
      sourceId: source.id,
      path: skillPath,
      name: (frontmatter.name as string) || skillPath,
      description: (frontmatter.description as string) || '',
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      version: frontmatter.version as string | undefined,
      content,
      files,
      rawFrontmatter: frontmatter,
    };

    this.detailCache.set(cacheKey, { data: detail, timestamp: Date.now() });
    return detail;
  }

  async installSkill(
    sourceId: string,
    skillPath: string,
    targetDir: string,
  ): Promise<{ success: boolean; error?: string }> {
    const source = SKILL_SOURCES.find(s => s.id === sourceId);
    if (!source) return { success: false, error: `Unknown source: ${sourceId}` };

    try {
      // List all files in the skill directory (recursive)
      const allFiles = await this.listFilesRecursive(source, skillPath);

      // Create the skill directory in target
      const skillDir = path.join(targetDir, skillPath);
      await fs.mkdir(skillDir, { recursive: true });

      // Download and write each file
      for (const filePath of allFiles) {
        const fileContentRaw = await this.ghApi(
          `repos/${source.owner}/${source.repo}/contents/${filePath}?ref=${source.branch}`,
        );
        const fileData = JSON.parse(fileContentRaw);

        const destPath = path.join(targetDir, filePath);
        const destDir = path.dirname(destPath);
        await fs.mkdir(destDir, { recursive: true });

        if (fileData.encoding === 'base64') {
          const content = Buffer.from(fileData.content, 'base64');
          await fs.writeFile(destPath, content);
        } else {
          // Text content
          await fs.writeFile(destPath, fileData.content, 'utf-8');
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Install failed' };
    }
  }

  private async listFilesRecursive(source: SkillSource, dirPath: string): Promise<string[]> {
    const raw = await this.ghApi(
      `repos/${source.owner}/${source.repo}/contents/${dirPath}?ref=${source.branch}`,
    );
    const items = JSON.parse(raw) as any[];
    const files: string[] = [];

    for (const item of items) {
      if (item.type === 'file') {
        files.push(item.path);
      } else if (item.type === 'dir') {
        const subFiles = await this.listFilesRecursive(source, item.path);
        files.push(...subFiles);
      }
    }

    return files;
  }

  private async ghApi(endpoint: string): Promise<string> {
    const { stdout } = await execFileAsync('gh', ['api', endpoint], {
      timeout: 15_000,
    });
    return stdout;
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.listCache.entries()) {
      if (now - entry.timestamp >= CACHE_TTL) {
        this.listCache.delete(key);
      }
    }
    for (const [key, entry] of this.detailCache.entries()) {
      if (now - entry.timestamp >= CACHE_TTL) {
        this.detailCache.delete(key);
      }
    }
  }
}
