export type TypeScriptSupport = 'built-in' | 'types' | 'none';

export interface PackageSearchResult {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  publisher: string;
  date: string;
  links: {
    npm?: string;
    homepage?: string;
    repository?: string;
  };
  score: number;
}

export interface PackageDetail {
  name: string;
  version: string;
  description: string;
  license: string;
  typescript: TypeScriptSupport;
  unpackedSize: number;
  fileCount: number;
  weeklyDownloads: number;
  lastPublish: string;
  dependencies: number;
  readme: string;
  links: {
    npm: string;
    homepage?: string;
    repository?: string;
  };
  maintainers: string[];
}
