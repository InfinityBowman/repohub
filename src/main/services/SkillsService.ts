import { EventEmitter } from 'events';
import { app } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import matter from 'gray-matter';
import type { SkillSource, SkillSummary, SkillDetail, DirectorySkill } from '../types/skill.types';

const execFileAsync = promisify(execFile);

const CLONE_TIMEOUT = 60_000; // 60 seconds
const SKILLS_CLI_TIMEOUT = 60_000; // 60 seconds

const SKILL_SOURCES: SkillSource[] = [
  {
    id: 'anthropics',
    owner: 'anthropics',
    repo: 'skills',
    label: 'Anthropic',
    branch: 'main',
    skillsDir: 'skills',
  },
  {
    id: 'openai',
    owner: 'openai',
    repo: 'skills',
    label: 'OpenAI',
    branch: 'main',
    skillsDir: 'skills',
  },
  {
    id: 'vercel',
    owner: 'vercel-labs',
    repo: 'agent-skills',
    label: 'Vercel',
    branch: 'main',
    skillsDir: 'skills',
  },
];

export class SkillsService extends EventEmitter {
  private referencesDir: string;
  private listCache = new Map<string, { data: SkillSummary[]; timestamp: number }>();
  private searchCache = new Map<string, { data: DirectorySkill[]; timestamp: number }>();
  private detailCache = new Map<string, { data: SkillDetail; timestamp: number }>();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly SEARCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  constructor() {
    super();
    this.referencesDir = path.join(app.getPath('userData'), 'skills-reference');
  }

  shutdown(): void {
    // Nothing to clean up
  }

  getSources(): SkillSource[] {
    return SKILL_SOURCES;
  }

  /**
   * Ensure the repo is cloned locally. Pull if it already exists, clone if not.
   */
  private async ensureClone(source: SkillSource): Promise<string> {
    await fs.mkdir(this.referencesDir, { recursive: true });
    const clonePath = path.join(this.referencesDir, source.id);

    try {
      await fs.access(path.join(clonePath, '.git'));
      // Already cloned — pull latest
      await execFileAsync('git', ['pull', '--ff-only'], {
        cwd: clonePath,
        timeout: CLONE_TIMEOUT,
      });
    } catch {
      // Not cloned yet — remove stale dir and clone fresh
      await fs.rm(clonePath, { recursive: true, force: true });
      const repoUrl = `https://github.com/${source.owner}/${source.repo}.git`;
      await execFileAsync(
        'git',
        ['clone', '--depth', '1', '--single-branch', '--branch', source.branch, repoUrl, clonePath],
        { timeout: CLONE_TIMEOUT },
      );
    }

    return clonePath;
  }

  /**
   * Recursively find all SKILL.md files under a directory.
   */
  private async findSkillFiles(dir: string): Promise<string[]> {
    const results: string[] = [];

    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (entry.name === '.git') continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subResults = await this.findSkillFiles(fullPath);
        results.push(...subResults);
      } else if (entry.isFile() && entry.name === 'SKILL.md') {
        results.push(fullPath);
      }
    }

    return results;
  }

  async listSkills(sourceId: string): Promise<SkillSummary[]> {
    // Check cache
    const cached = this.listCache.get(sourceId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const source = SKILL_SOURCES.find(s => s.id === sourceId);
    if (!source) throw new Error(`Unknown source: ${sourceId}`);

    const clonePath = await this.ensureClone(source);
    const skillsRoot = source.skillsDir
      ? path.join(clonePath, source.skillsDir)
      : clonePath;

    const skillFiles = await this.findSkillFiles(skillsRoot);

    const skills: SkillSummary[] = [];
    for (const skillMdPath of skillFiles) {
      try {
        const raw = await fs.readFile(skillMdPath, 'utf-8');
        const { data: frontmatter } = matter(raw);
        const skillDir = path.dirname(skillMdPath);
        // Path relative to the skills root (e.g. '.curated/figma' or 'frontend-design')
        const relativePath = path.relative(skillsRoot, skillDir);
        const dirName = path.basename(skillDir);

        skills.push({
          sourceId: source.id,
          path: relativePath,
          name: (frontmatter.name as string) || dirName,
          description: (frontmatter.description as string) || '',
          tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
        });
      } catch {
        // Skip unparseable files
      }
    }

    skills.sort((a, b) => a.name.localeCompare(b.name));

    this.listCache.set(sourceId, { data: skills, timestamp: Date.now() });
    return skills;
  }

  async getSkillDetail(sourceId: string, skillPath: string): Promise<SkillDetail> {
    const source = SKILL_SOURCES.find(s => s.id === sourceId);
    if (!source) throw new Error(`Unknown source: ${sourceId}`);

    const clonePath = await this.ensureClone(source);
    const skillsRoot = source.skillsDir
      ? path.join(clonePath, source.skillsDir)
      : clonePath;
    const skillDir = path.join(skillsRoot, skillPath);

    // Path traversal check
    if (!skillDir.startsWith(skillsRoot)) {
      throw new Error('Invalid skill path');
    }

    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const raw = await fs.readFile(skillMdPath, 'utf-8');
    const { data: frontmatter, content } = matter(raw);

    // List files and read all text content in the skill directory
    const [files, allTextContent] = await Promise.all([
      this.listSkillFiles(skillDir),
      this.readAllTextFiles(skillDir),
    ]);

    const dirName = path.basename(skillDir);

    return {
      sourceId: source.id,
      path: skillPath,
      name: (frontmatter.name as string) || dirName,
      description: (frontmatter.description as string) || '',
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      version: frontmatter.version as string | undefined,
      content,
      files,
      rawFrontmatter: frontmatter,
      allTextContent,
    };
  }

  async installSkill(
    sourceId: string,
    skillPath: string,
    targetDir: string,
  ): Promise<{ success: boolean; error?: string }> {
    const source = SKILL_SOURCES.find(s => s.id === sourceId);
    if (!source) return { success: false, error: `Unknown source: ${sourceId}` };

    try {
      const clonePath = await this.ensureClone(source);
      const skillsRoot = source.skillsDir
        ? path.join(clonePath, source.skillsDir)
        : clonePath;
      const skillDir = path.join(skillsRoot, skillPath);

      // Path traversal check
      if (!skillDir.startsWith(skillsRoot)) {
        return { success: false, error: 'Invalid skill path' };
      }

      const dirName = path.basename(skillDir);
      const installDir = path.join(targetDir, dirName);

      await this.copyDirRecursive(skillDir, installDir);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Install failed' };
    }
  }

  /**
   * Search the skills.sh directory via their public API.
   */
  async searchDirectory(query: string, limit = 50): Promise<DirectorySkill[]> {
    const cacheKey = `${query}:${limit}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.SEARCH_CACHE_TTL) {
      return cached.data;
    }

    const url = `https://skills.sh/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`skills.sh search failed: ${res.status}`);

    const json = await res.json();
    const skills: DirectorySkill[] = (json.skills || []).map((s: any) => ({
      source: s.source,
      skillId: s.skillId,
      name: s.name || s.skillId,
      installs: s.installs || 0,
    }));

    this.searchCache.set(cacheKey, { data: skills, timestamp: Date.now() });
    return skills;
  }

  /**
   * Use the skills CLI to install a skill to a temp dir, then read SKILL.md for preview.
   */
  async getDirectorySkillDetail(source: string, skillId: string): Promise<SkillDetail> {
    const cacheKey = `${source}:${skillId}`;
    const cached = this.detailCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Install to a temp dir using the skills CLI
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repohub-skill-'));
    try {
      await execFileAsync(
        'npx',
        ['skills', 'add', source, '-s', skillId, '-y'],
        { cwd: tmpDir, timeout: SKILLS_CLI_TIMEOUT },
      );

      // Find the SKILL.md in the temp dir
      const skillFiles = await this.findSkillFiles(tmpDir);
      const skillMdPath = skillFiles.find(f => {
        const dir = path.basename(path.dirname(f));
        return dir === skillId;
      }) || skillFiles[0];

      if (!skillMdPath) {
        throw new Error(`skills CLI did not produce a SKILL.md for ${skillId}`);
      }

      const raw = await fs.readFile(skillMdPath, 'utf-8');
      const { data: frontmatter, content } = matter(raw);
      const skillDir = path.dirname(skillMdPath);
      const [files, allTextContent] = await Promise.all([
        this.listSkillFiles(skillDir),
        this.readAllTextFiles(skillDir),
      ]);

      const detail: SkillDetail = {
        sourceId: source,
        path: skillId,
        name: (frontmatter.name as string) || skillId,
        description: (frontmatter.description as string) || '',
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
        version: frontmatter.version as string | undefined,
        content,
        files,
        rawFrontmatter: frontmatter,
        allTextContent,
      };

      this.detailCache.set(cacheKey, { data: detail, timestamp: Date.now() });
      return detail;
    } finally {
      // Clean up temp dir
      fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Install a directory skill using the skills CLI to the user's chosen directory.
   */
  async installDirectorySkill(
    source: string,
    skillId: string,
    targetDir: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await execFileAsync(
        'npx',
        ['skills', 'add', source, '-s', skillId, '-y'],
        { cwd: targetDir, timeout: SKILLS_CLI_TIMEOUT },
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Install failed' };
    }
  }

  private async listSkillFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === '.git') continue;
      if (entry.isDirectory()) {
        results.push(entry.name + '/');
      } else if (entry.isFile()) {
        results.push(entry.name);
      }
    }

    return results.sort();
  }

  // Extensions that are considered text files for security scanning
  private static TEXT_EXTENSIONS = new Set([
    '.md', '.txt', '.sh', '.bash', '.zsh', '.fish',
    '.py', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
    '.yaml', '.yml', '.json', '.toml', '.ini', '.cfg',
    '.xml', '.html', '.css', '.scss', '.less',
    '.rs', '.go', '.java', '.kt', '.swift', '.rb', '.lua',
    '.c', '.cpp', '.h', '.hpp', '.cs',
    '.r', '.R', '.jl', '.ex', '.exs', '.erl',
    '.vim', '.el', '.clj', '.cljs', '.hs',
    '.dockerfile', '.env', '.gitignore', '.editorconfig',
  ]);

  private static MAX_TEXT_FILE_SIZE = 512 * 1024; // 512 KB per file

  private isTextFile(filename: string): boolean {
    // Files with no extension but known names
    const noExtNames = ['Makefile', 'Dockerfile', 'Jenkinsfile', 'Vagrantfile', 'Rakefile', 'Gemfile', 'LICENSE', 'AGENTS.md'];
    if (noExtNames.includes(filename)) return true;

    const ext = path.extname(filename).toLowerCase();
    if (!ext) return false;
    return SkillsService.TEXT_EXTENSIONS.has(ext);
  }

  /**
   * Recursively read all text files in a skill directory.
   * Returns a map of relative path -> content.
   */
  private async readAllTextFiles(
    dir: string,
    basePath = '',
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subResults = await this.readAllTextFiles(fullPath, relativePath);
        Object.assign(results, subResults);
      } else if (entry.isFile() && this.isTextFile(entry.name)) {
        try {
          const stat = await fs.stat(fullPath);
          if (stat.size <= SkillsService.MAX_TEXT_FILE_SIZE) {
            results[relativePath] = await fs.readFile(fullPath, 'utf-8');
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    return results;
  }

  private async copyDirRecursive(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === '.git') continue;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}
