export interface CodeChunk {
  id: string;
  filePath: string;
  relativePath: string;
  language: string;
  constructType: string;
  constructName: string;
  code: string;
  startLine: number;
  endLine: number;
}

export interface IndexedFile {
  path: string;
  contentHash: string;
  lastModified: number;
  chunkIds: string[];
}

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
}

export type IndexState = 'idle' | 'downloading-model' | 'indexing' | 'ready' | 'error';

export interface IndexStatus {
  state: IndexState;
  totalFiles: number;
  indexedFiles: number;
  totalChunks: number;
  currentFile?: string;
  progress: number;
  error?: string;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  minScore?: number;
  languages?: string[];
  directories?: string[];
}
