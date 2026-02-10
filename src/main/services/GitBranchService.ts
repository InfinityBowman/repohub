import { exec } from 'child_process';
import { promisify } from 'util';
import type { BranchInfo } from '../types/repository.types';

const execAsync = promisify(exec);

const PROTECTED_BRANCHES = new Set(['main', 'master', 'develop']);

export class GitBranchService {
  async listBranches(repoPath: string): Promise<BranchInfo[]> {
    // Get all local branches with tracking info
    const { stdout: branchOutput } = await execAsync(
      "git branch -vv --format='%(refname:short)|%(upstream:short)|%(upstream:track)|%(committerdate:relative)|%(HEAD)'",
      { cwd: repoPath, timeout: 5000 },
    );

    // Get merged branches (try main first, fallback to master)
    let mergedSet = new Set<string>();
    try {
      const { stdout: mergedOutput } = await execAsync('git branch --merged main', {
        cwd: repoPath,
        timeout: 3000,
      });
      mergedSet = this.parseMergedOutput(mergedOutput);
    } catch {
      try {
        const { stdout: mergedOutput } = await execAsync('git branch --merged master', {
          cwd: repoPath,
          timeout: 3000,
        });
        mergedSet = this.parseMergedOutput(mergedOutput);
      } catch {
        // Neither main nor master exists; leave mergedSet empty
      }
    }

    const branches: BranchInfo[] = [];
    for (const line of branchOutput.trim().split('\n')) {
      if (!line.trim()) continue;
      const cleaned = line.replace(/^'|'$/g, '');
      const [name, upstream, _track, lastCommit, head] = cleaned.split('|');
      if (!name) continue;

      branches.push({
        name: name.trim(),
        isCurrent: head?.trim() === '*',
        isMerged: mergedSet.has(name.trim()),
        upstream: upstream?.trim() || undefined,
        lastCommit: lastCommit?.trim() || '',
      });
    }

    return branches;
  }

  async deleteBranches(
    repoPath: string,
    branchNames: string[],
  ): Promise<{ results: { branch: string; success: boolean; error?: string }[] }> {
    const results: { branch: string; success: boolean; error?: string }[] = [];

    for (const branch of branchNames) {
      // Safety: never delete protected branches
      if (PROTECTED_BRANCHES.has(branch)) {
        results.push({ branch, success: false, error: 'Protected branch' });
        continue;
      }

      // Safety: never delete current branch
      try {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
          cwd: repoPath,
          timeout: 3000,
        });
        if (stdout.trim() === branch) {
          results.push({ branch, success: false, error: 'Cannot delete current branch' });
          continue;
        }
      } catch {
        results.push({ branch, success: false, error: 'Could not determine current branch' });
        continue;
      }

      try {
        await execAsync(`git branch -d ${branch}`, {
          cwd: repoPath,
          timeout: 3000,
        });
        results.push({ branch, success: true });
      } catch (err: any) {
        results.push({ branch, success: false, error: err.message });
      }
    }

    return { results };
  }

  private parseMergedOutput(output: string): Set<string> {
    const set = new Set<string>();
    for (const line of output.trim().split('\n')) {
      const name = line.replace(/^\*?\s+/, '').trim();
      if (name) set.add(name);
    }
    return set;
  }
}
