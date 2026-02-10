import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RepositoryService } from './RepositoryService';
import type { PRInfo, GitHubStatus, PRState, CIStatus, ReviewStatus } from '../types/github.types';

const execAsync = promisify(exec);

const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

export class GitHubService extends EventEmitter {
  private repositoryService: RepositoryService;
  private prsByRepo = new Map<string, PRInfo | null>();
  private allUserPRs: PRInfo[] = [];
  private lastFetch = 0;
  private _status: GitHubStatus | null = null;

  constructor(repositoryService: RepositoryService) {
    super();
    this.repositoryService = repositoryService;
  }

  async checkAvailability(): Promise<GitHubStatus> {
    if (this._status) return this._status;

    try {
      await execAsync('gh --version', { timeout: 5000 });
    } catch {
      this._status = { available: false, authenticated: false, error: 'gh CLI not installed' };
      return this._status;
    }

    try {
      await execAsync('gh auth status', { timeout: 5000 });
      this._status = { available: true, authenticated: true };
    } catch {
      this._status = {
        available: true,
        authenticated: false,
        error: 'Not authenticated. Run: gh auth login',
      };
    }

    return this._status;
  }

  async getPRForBranch(repoId: string): Promise<PRInfo | null> {
    const repo = this.repositoryService.getById(repoId);
    if (!repo || !repo.gitBranch) return null;

    const cached = this.prsByRepo.get(repoId);
    if (cached !== undefined) return cached;

    return this.fetchPRForBranch(repoId);
  }

  private async fetchPRForBranch(repoId: string): Promise<PRInfo | null> {
    const repo = this.repositoryService.getById(repoId);
    if (!repo || !repo.gitBranch) return null;

    try {
      const { stdout } = await execAsync(
        `gh pr view --json number,title,state,headRefName,baseRefName,url,statusCheckRollup,reviewDecision,createdAt,updatedAt,isDraft 2>/dev/null`,
        { cwd: repo.path, timeout: 10000 },
      );

      const result = stdout.trim();
      if (!result) {
        this.prsByRepo.set(repoId, null);
        return null;
      }

      const data = JSON.parse(result);
      const pr = this.parsePRData(data, repoId, repo.name);
      this.prsByRepo.set(repoId, pr);
      return pr;
    } catch {
      this.prsByRepo.set(repoId, null);
      return null;
    }
  }

  getAllUserPRs(): PRInfo[] {
    return this.allUserPRs;
  }

  async fetchAllUserPRs(maxRepos?: number): Promise<PRInfo[]> {
    const status = await this.checkAvailability();
    if (!status.available || !status.authenticated) return [];

    // Repos are already sorted by lastModified (most recent first) from scan
    let repos = this.repositoryService.getAll();
    if (maxRepos) {
      repos = repos.slice(0, maxRepos);
    }

    const allPRs: PRInfo[] = [];

    // Process repos concurrently in batches to avoid overwhelming gh CLI
    const BATCH_SIZE = 5;
    for (let i = 0; i < repos.length; i += BATCH_SIZE) {
      const batch = repos.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(repo => this.fetchPRsForRepo(repo)));
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          allPRs.push(...result.value);
        }
      }
    }

    this.allUserPRs = allPRs;
    this.lastFetch = Date.now();
    return allPRs;
  }

  private async fetchPRsForRepo(repo: {
    id: string;
    name: string;
    path: string;
    gitBranch?: string;
  }): Promise<PRInfo[]> {
    if (!repo.gitBranch) return [];

    try {
      // Check if it's a git repo with a remote
      const { stdout: remoteOut } = await execAsync('git remote', {
        cwd: repo.path,
        timeout: 3000,
      });

      if (!remoteOut.trim()) return [];

      const { stdout } = await execAsync(
        `gh pr list --author @me --json number,title,state,headRefName,baseRefName,url,statusCheckRollup,reviewDecision,createdAt,updatedAt,isDraft --limit 10 2>/dev/null`,
        { cwd: repo.path, timeout: 10000 },
      );

      const result = stdout.trim();
      if (!result) return [];

      const prs = JSON.parse(result);
      const prInfos: PRInfo[] = [];

      for (const data of prs) {
        const pr = this.parsePRData(data, repo.id, repo.name);

        // Also set the per-branch cache for matching repos
        if (pr.branch === repo.gitBranch) {
          this.prsByRepo.set(repo.id, pr);
        }

        // Detect repo full name from gh
        try {
          const { stdout: nameOut } = await execAsync(
            'gh repo view --json nameWithOwner -q .nameWithOwner',
            { cwd: repo.path, timeout: 5000 },
          );
          pr.repoFullName = nameOut.trim();
        } catch {
          // ignore
        }

        prInfos.push(pr);
      }

      return prInfos;
    } catch {
      return [];
    }
  }

  async refresh(): Promise<void> {
    await this.fetchAllUserPRs();
    this.emitChanged();
  }

  refreshIfNeeded(): void {
    if (Date.now() - this.lastFetch < COOLDOWN_MS) return;

    // Auto-refresh only checks the 5 most recently modified repos for speed
    this.checkAvailability().then(status => {
      if (!status.available || !status.authenticated) return;
      this.fetchAllUserPRs(5).then(() => this.emitChanged());
    });
  }

  async createPR(repoId: string): Promise<{ success: boolean; error?: string }> {
    const repo = this.repositoryService.getById(repoId);
    if (!repo) return { success: false, error: 'Repository not found' };

    try {
      await execAsync('gh pr create --web', {
        cwd: repo.path,
        timeout: 10000,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private parsePRData(data: any, repoId: string, repoName: string): PRInfo {
    let state: PRState = 'open';
    if (data.isDraft) {
      state = 'draft';
    } else if (data.state === 'MERGED') {
      state = 'merged';
    } else if (data.state === 'CLOSED') {
      state = 'closed';
    }

    let ciStatus: CIStatus = 'unknown';
    if (data.statusCheckRollup && data.statusCheckRollup.length > 0) {
      const states = data.statusCheckRollup.map((c: any) => c.conclusion || c.status);
      if (states.some((s: string) => s === 'FAILURE' || s === 'ERROR')) {
        ciStatus = 'failure';
      } else if (states.every((s: string) => s === 'SUCCESS')) {
        ciStatus = 'success';
      } else {
        ciStatus = 'pending';
      }
    }

    let reviewStatus: ReviewStatus = 'none';
    if (data.reviewDecision === 'APPROVED') reviewStatus = 'approved';
    else if (data.reviewDecision === 'CHANGES_REQUESTED') reviewStatus = 'changes_requested';
    else if (data.reviewDecision === 'REVIEW_REQUIRED') reviewStatus = 'review_required';

    return {
      number: data.number,
      title: data.title,
      state,
      branch: data.headRefName,
      baseBranch: data.baseRefName,
      url: data.url,
      ciStatus,
      reviewStatus,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      repoId,
      repoName,
    };
  }

  private emitChanged(): void {
    const prsByRepo: Record<string, PRInfo | null> = {};
    for (const [key, val] of this.prsByRepo) {
      prsByRepo[key] = val;
    }
    this.emit('github:changed', {
      prsByRepo,
      allUserPRs: this.allUserPRs,
    });
  }
}
