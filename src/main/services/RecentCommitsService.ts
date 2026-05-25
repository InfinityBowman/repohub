import { execFile } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import type { RepositoryService } from './RepositoryService';

const execFileAsync = promisify(execFile);

export interface CommitInfo {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  date: string;
  repoId: string;
  repoName: string;
}

export class RecentCommitsService extends EventEmitter {
  private repositoryService: RepositoryService;
  private commits: CommitInfo[] = [];
  private lastFetch = 0;
  private cacheTtlMs = 30000;

  constructor(repositoryService: RepositoryService) {
    super();
    this.repositoryService = repositoryService;
  }

  async refresh(): Promise<CommitInfo[]> {
    const repos = this.repositoryService
      .getAll()
      .sort((a, b) => b.lastModified - a.lastModified)
      .slice(0, 10);

    const results = await Promise.allSettled(
      repos.map(repo => this.getRepoCommits(repo.id, repo.name, repo.path)),
    );

    const allCommits: CommitInfo[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allCommits.push(...result.value);
      }
    }

    allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.commits = allCommits.slice(0, 20);
    this.lastFetch = Date.now();
    return this.commits;
  }

  async getRecent(): Promise<CommitInfo[]> {
    if (Date.now() - this.lastFetch > this.cacheTtlMs || this.commits.length === 0) {
      await this.refresh();
    }
    return this.commits;
  }

  private async getRepoCommits(
    repoId: string,
    repoName: string,
    repoPath: string,
  ): Promise<CommitInfo[]> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['-C', repoPath, 'log', '--format=%H\t%s\t%an\t%aI', '-n', '5', '--no-merges'],
        { timeout: 3000 },
      );

      return stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const [hash, subject, author, date] = line.split('\t', 4);
          return {
            hash,
            shortHash: hash?.slice(0, 7) ?? '',
            subject: subject ?? '',
            author: author ?? '',
            date: date ?? '',
            repoId,
            repoName,
          };
        });
    } catch {
      return [];
    }
  }
}
