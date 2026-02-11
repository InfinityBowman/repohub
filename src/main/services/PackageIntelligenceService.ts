import { EventEmitter } from 'events';
import type { PackageSearchResult, PackageDetail, TypeScriptSupport } from '../types/package.types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT = 10_000; // 10 seconds

export class PackageIntelligenceService extends EventEmitter {
  private searchCache = new Map<string, CacheEntry<PackageSearchResult[]>>();
  private detailCache = new Map<string, CacheEntry<PackageDetail>>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    super();

    // Clean expired cache entries every 30 minutes
    this.cleanupTimer = setInterval(() => this.cleanCache(), 30 * 60 * 1000);
  }

  shutdown(): void {
    clearInterval(this.cleanupTimer);
  }

  async search(query: string, limit = 20): Promise<PackageSearchResult[]> {
    if (!query.trim()) return [];

    const cacheKey = `${query}:${limit}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${limit}`;
    const response = await this.fetchJSON(url);

    const results: PackageSearchResult[] = (response.objects || []).map(
      (obj: any): PackageSearchResult => ({
        name: obj.package?.name || '',
        version: obj.package?.version || '',
        description: obj.package?.description || '',
        keywords: obj.package?.keywords || [],
        publisher: obj.package?.publisher?.username || '',
        date: obj.package?.date || '',
        links: {
          npm: obj.package?.links?.npm,
          homepage: obj.package?.links?.homepage,
          repository: obj.package?.links?.repository,
        },
        score: obj.score?.final || 0,
      }),
    );

    this.searchCache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  }

  async getPackageDetails(packageName: string): Promise<PackageDetail> {
    const cached = this.detailCache.get(packageName);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Fetch packument and downloads in parallel
    const [packument, downloads] = await Promise.all([
      this.fetchJSON(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`),
      this.fetchDownloads(packageName),
    ]);

    const latestVersion = packument['dist-tags']?.latest || '';
    const versionData = packument.versions?.[latestVersion] || {};
    const dist = versionData.dist || {};

    const typescript = this.detectTypeScript(versionData, packageName);
    const repoUrl = this.parseRepoUrl(packument.repository?.url || versionData.repository?.url);

    const detail: PackageDetail = {
      name: packument.name || packageName,
      version: latestVersion,
      description: packument.description || '',
      license: versionData.license || packument.license || 'Unknown',
      typescript,
      unpackedSize: dist.unpackedSize || 0,
      fileCount: dist.fileCount || 0,
      weeklyDownloads: downloads,
      lastPublish: packument.time?.[latestVersion] || '',
      dependencies: Object.keys(versionData.dependencies || {}).length,
      readme: packument.readme || '',
      links: {
        npm: `https://www.npmjs.com/package/${packageName}`,
        homepage: packument.homepage || versionData.homepage,
        repository: repoUrl,
      },
      maintainers: (packument.maintainers || []).map((m: any) => m.name || m),
    };

    this.detailCache.set(packageName, { data: detail, timestamp: Date.now() });
    return detail;
  }

  private detectTypeScript(versionData: any, packageName: string): TypeScriptSupport {
    // Check for built-in types via types/typings field
    if (versionData.types || versionData.typings) {
      return 'built-in';
    }

    // Check if main/exports point to .d.ts
    const main = versionData.main || '';
    if (main.endsWith('.d.ts')) {
      return 'built-in';
    }

    // For @types packages themselves
    if (packageName.startsWith('@types/')) {
      return 'built-in';
    }

    return 'none';
  }

  private parseRepoUrl(url?: string): string | undefined {
    if (!url) return undefined;

    let normalized = url
      .replace(/^git\+/, '')
      .replace(/^git:\/\//, 'https://')
      .replace(/^ssh:\/\/git@/, 'https://')
      .replace(/\.git$/, '');

    if (normalized.startsWith('git@github.com:')) {
      normalized = normalized.replace('git@github.com:', 'https://github.com/');
    }

    // Validate the URL is legitimate
    try {
      const parsed = new URL(normalized);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return undefined;
      }
      return normalized;
    } catch {
      return undefined;
    }
  }

  private async fetchDownloads(packageName: string): Promise<number> {
    try {
      const data = await this.fetchJSON(
        `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`,
      );
      return data.downloads || 0;
    } catch {
      return 0;
    }
  }

  private async fetchJSON(url: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limited by npm registry. Please try again later.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Check your network connection.', { cause: err });
      }
      throw err;
    }
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.searchCache.entries()) {
      if (now - entry.timestamp >= CACHE_TTL) {
        this.searchCache.delete(key);
      }
    }
    for (const [key, entry] of this.detailCache.entries()) {
      if (now - entry.timestamp >= CACHE_TTL) {
        this.detailCache.delete(key);
      }
    }
  }
}
