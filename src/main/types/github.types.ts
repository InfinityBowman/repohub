export type CIStatus = 'success' | 'failure' | 'pending' | 'unknown';
export type PRState = 'open' | 'closed' | 'merged' | 'draft';
export type ReviewStatus = 'approved' | 'changes_requested' | 'review_required' | 'none';

export interface PRInfo {
  number: number;
  title: string;
  state: PRState;
  branch: string;
  baseBranch: string;
  url: string;
  ciStatus: CIStatus;
  reviewStatus: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  repoId?: string;
  repoName?: string;
  repoFullName?: string;
}

export interface GitHubStatus {
  available: boolean;
  authenticated: boolean;
  error?: string;
}

export type TrendingPeriod = 'week' | 'month';

export interface TrendingRepo {
  fullName: string;
  name: string;
  owner: { login: string; avatarUrl: string };
  description: string;
  stargazersCount: number;
  forksCount: number;
  language: string | null;
  topics: string[];
  license: string | null;
  htmlUrl: string;
  homepage: string | null;
  createdAt: string;
  updatedAt: string;
  openIssuesCount: number;
}
