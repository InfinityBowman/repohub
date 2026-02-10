import { EventEmitter } from 'events';
import { readFile, stat, readdir, access } from 'fs/promises';
import { join, relative, extname, basename } from 'path';
import { createHash } from 'crypto';
import { app } from 'electron';
import { watch } from 'chokidar';
import { LocalIndex } from 'vectra';
import { CodeParser } from './CodeParser';
import type { ConfigService } from './ConfigService';
import type { RepositoryService } from './RepositoryService';
import type {
  CodeChunk,
  IndexedFile,
  IndexStatus,
  IndexState,
  SearchOptions,
  SearchResult,
} from '../types/codesearch.types';

// Separate electron-store for indexed files state
import Store from 'electron-store';

const BATCH_SIZE = 10;

export class CodeSearchService extends EventEmitter {
  private configService: ConfigService;
  private repositoryService: RepositoryService;
  private codeParser: CodeParser;
  private vectraIndex: LocalIndex;
  private indexedFiles = new Map<string, IndexedFile>();
  private stateStore: Store<Record<string, IndexedFile>>;
  private watcher: ReturnType<typeof watch> | null = null;
  private pipeline: any = null;
  private indexPath: string;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private activeReindexing = new Map<string, Promise<void>>();

  private status: IndexStatus = {
    state: 'idle',
    totalFiles: 0,
    indexedFiles: 0,
    totalChunks: 0,
    progress: 0,
  };

  constructor(configService: ConfigService, repositoryService: RepositoryService) {
    super();
    this.configService = configService;
    this.repositoryService = repositoryService;
    this.codeParser = new CodeParser();

    this.indexPath = join(app.getPath('userData'), 'code-search-index');
    this.vectraIndex = new LocalIndex(this.indexPath);

    this.stateStore = new Store<Record<string, IndexedFile>>({
      name: 'code-search-files',
      defaults: {},
    });
  }

  async initialize(): Promise<void> {
    // Restore indexed files state
    const stored = this.stateStore.store;
    for (const [path, file] of Object.entries(stored)) {
      this.indexedFiles.set(path, file);
    }

    // Ensure vectra index exists and is readable
    const exists = await this.vectraIndex.isIndexCreated();
    if (!exists) {
      await this.vectraIndex.createIndex({ version: 1 });
    }

    // Validate the index is not corrupted
    try {
      const stats = await this.vectraIndex.getIndexStats();
      this.status.totalChunks = stats.items;
    } catch {
      // Index is corrupted or empty — recreate it and clear stale file state
      console.warn('CodeSearch: index corrupted, recreating');
      try {
        await this.vectraIndex.createIndex({ version: 1 });
      } catch {
        // createIndex may fail if directory still exists, ignore
      }
      this.indexedFiles.clear();
      this.stateStore.clear();
    }

    this.status.indexedFiles = this.indexedFiles.size;
    if (this.indexedFiles.size > 0) {
      this.status.state = 'ready';
    }

    await this.codeParser.initialize();
  }

  async ensureModel(): Promise<void> {
    if (this.pipeline) return;

    this.updateStatus({ state: 'downloading-model' });

    try {
      const { pipeline, env } = await import('@huggingface/transformers');
      // Redirect model cache to a writable directory — in a packaged app the
      // default cache lands inside app.asar which native ONNX runtime can't read
      env.cacheDir = join(app.getPath('userData'), 'huggingface-cache');
      // Force ONNX runtime to use Node.js backend
      env.backends.onnx.wasm!.proxy = false;

      this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        dtype: 'fp32',
        progress_callback: (progress: any) => {
          this.emit('model-progress', {
            status: progress.status || 'loading',
            progress: progress.progress || 0,
            loaded: progress.loaded || 0,
            total: progress.total || 0,
          });
        },
      });

      if (this.indexedFiles.size > 0) {
        this.updateStatus({ state: 'ready' });
      } else {
        this.updateStatus({ state: 'idle' });
      }
    } catch (error: any) {
      this.updateStatus({ state: 'error', error: error.message });
      throw error;
    }
  }

  async startIndexing(directories?: string[]): Promise<void> {
    const config = this.configService.get();
    const dirs = directories || [config.scanDirectory];

    if (!dirs.length || !dirs[0]) return;

    await this.ensureModel();

    this.updateStatus({ state: 'indexing', progress: 0 });

    try {
      // Collect all files
      const excludePatterns = config.codeSearchExcludePatterns || [];
      const allFiles: string[] = [];
      for (const dir of dirs) {
        const files = await this.walkDirectory(dir, excludePatterns);
        allFiles.push(...files);
      }

      this.updateStatus({ totalFiles: allFiles.length, indexedFiles: 0 });

      let processedCount = 0;
      const baseDir = dirs[0];

      for (const filePath of allFiles) {
        try {
          const fileHash = await this.hashFile(filePath);
          const existing = this.indexedFiles.get(filePath);

          // Skip if unchanged
          if (existing && existing.contentHash === fileHash) {
            processedCount++;
            this.updateStatus({
              indexedFiles: processedCount,
              progress: Math.round((processedCount / allFiles.length) * 100),
            });
            continue;
          }

          // Remove old chunks if file was previously indexed
          if (existing) {
            await this.removeFileChunks(existing.chunkIds);
          }

          const relativePath = relative(baseDir, filePath);
          this.updateStatus({ currentFile: relativePath });

          const maxFileSize = config.codeSearchMaxFileSize || 1_048_576;
          const chunks = await this.codeParser.parseFile(filePath, relativePath, maxFileSize);

          let insertedIds: string[] = [];
          if (chunks.length > 0) {
            insertedIds = await this.embedAndInsertChunks(chunks);
          }

          // Store indexed file record with only successfully inserted chunk IDs
          const fileStat = await stat(filePath);
          const indexedFile: IndexedFile = {
            path: filePath,
            contentHash: fileHash,
            lastModified: fileStat.mtimeMs,
            chunkIds: insertedIds,
          };
          this.indexedFiles.set(filePath, indexedFile);
          this.stateStore.set(filePath, indexedFile);

          processedCount++;

          this.updateStatus({
            indexedFiles: processedCount,
            progress: Math.round((processedCount / allFiles.length) * 100),
          });
        } catch {
          // Skip file on error
          processedCount++;
        }

        // Yield to event loop between files
        await new Promise(r => setImmediate(r));
      }

      // Get final accurate chunk count
      let finalChunks = this.status.totalChunks;
      try {
        const stats = await this.vectraIndex.getIndexStats();
        finalChunks = stats.items;
      } catch {
        // Use current estimate
      }

      this.updateStatus({
        state: 'ready',
        progress: 100,
        totalChunks: finalChunks,
        currentFile: undefined,
      });

      // Start file watching now that model is loaded and indexing is done
      this.startWatching();
    } catch (error: any) {
      this.updateStatus({ state: 'error', error: error.message });
    }
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    if (!options.query.trim()) return [];

    if (!this.pipeline) {
      await this.ensureModel();
    }

    const limit = options.limit ?? 20;
    const minScore = options.minScore ?? 0.2;

    // Validate directory filters are within scan directory
    if (options.directories?.length) {
      const scanDir = this.configService.get().scanDirectory;
      if (scanDir) {
        options.directories = options.directories.filter(dir => dir.startsWith(scanDir));
      }
    }

    // Generate query embedding
    const output = await this.pipeline(options.query, {
      pooling: 'mean',
      normalize: true,
    });
    const queryVector = Array.from(output.data as Float32Array);

    // Query vectra
    let results: any[];
    try {
      results = await this.vectraIndex.queryItems(queryVector, options.query, limit * 2);
    } catch (error: any) {
      // Index may be corrupted — report and return empty
      console.error('CodeSearch: query failed (index may be corrupted):', error.message);
      this.updateStatus({ state: 'error', error: 'Search index corrupted. Please reindex.' });
      return [];
    }

    // Filter and map results
    const searchResults: SearchResult[] = [];
    for (const result of results) {
      if (result.score < minScore) continue;

      const metadata = result.item.metadata as any;
      const chunk: CodeChunk = {
        id: result.item.id,
        filePath: metadata.filePath,
        relativePath: metadata.relativePath,
        language: metadata.language,
        constructType: metadata.constructType,
        constructName: metadata.constructName,
        code: metadata.code,
        startLine: metadata.startLine,
        endLine: metadata.endLine,
      };

      // Apply language filter
      if (options.languages?.length && !options.languages.includes(chunk.language)) {
        continue;
      }

      // Apply directory filter
      if (options.directories?.length) {
        const matchesDir = options.directories.some(dir => chunk.filePath.startsWith(dir));
        if (!matchesDir) continue;
      }

      searchResults.push({ chunk, score: result.score });
      if (searchResults.length >= limit) break;
    }

    return searchResults;
  }

  getStatus(): IndexStatus {
    return { ...this.status };
  }

  async reindexFile(filePath: string): Promise<void> {
    const config = this.configService.get();
    const scanDir = config.scanDirectory;

    if (!scanDir || !filePath.startsWith(scanDir)) return;
    if (!this.pipeline) return; // Don't index if model not loaded

    // Check exclude patterns
    const relativePath = relative(scanDir, filePath);
    if (this.matchesExcludePattern(relativePath, config.codeSearchExcludePatterns || [])) {
      return;
    }

    // Remove old chunks
    const existing = this.indexedFiles.get(filePath);
    if (existing) {
      await this.removeFileChunks(existing.chunkIds);
    }

    try {
      const chunks = await this.codeParser.parseFile(
        filePath,
        relativePath,
        config.codeSearchMaxFileSize || 1_048_576,
      );

      let insertedIds: string[] = [];
      if (chunks.length > 0) {
        insertedIds = await this.embedAndInsertChunks(chunks);
      }

      const fileHash = await this.hashFile(filePath);
      const fileStat = await stat(filePath);
      const indexedFile: IndexedFile = {
        path: filePath,
        contentHash: fileHash,
        lastModified: fileStat.mtimeMs,
        chunkIds: insertedIds,
      };
      this.indexedFiles.set(filePath, indexedFile);
      this.stateStore.set(filePath, indexedFile);

      this.updateStatus({
        state: 'ready',
        indexedFiles: this.indexedFiles.size,
      });
    } catch {
      // File may have been deleted or be unreadable
    }
  }

  async removeFile(filePath: string): Promise<void> {
    const existing = this.indexedFiles.get(filePath);
    if (!existing) return;

    await this.removeFileChunks(existing.chunkIds);
    this.indexedFiles.delete(filePath);
    this.stateStore.delete(filePath);

    this.updateStatus({
      indexedFiles: this.indexedFiles.size,
    });
  }

  startWatching(): void {
    const config = this.configService.get();
    const scanDir = config.scanDirectory;
    if (!scanDir || !config.codeSearchEnabled) return;
    if (!this.pipeline) return; // Don't watch until model is loaded

    const extensions = this.codeParser.getSupportedExtensions();
    const globs = extensions.map(ext => `**/*${ext}`);

    this.watcher = watch(globs, {
      cwd: scanDir,
      ignored: config.codeSearchExcludePatterns || [],
      ignoreInitial: true,
      persistent: true,
    });

    this.watcher.on('add', relativePath => {
      this.debouncedReindex(join(scanDir, relativePath));
    });

    this.watcher.on('change', relativePath => {
      this.debouncedReindex(join(scanDir, relativePath));
    });

    this.watcher.on('unlink', relativePath => {
      this.removeFile(join(scanDir, relativePath));
    });
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  shutdown(): void {
    this.stopWatching();
  }

  // --- Private helpers ---

  private debouncedReindex(filePath: string): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      filePath,
      setTimeout(async () => {
        this.debounceTimers.delete(filePath);

        // Wait for any in-progress reindexing of this file to finish first
        const inProgress = this.activeReindexing.get(filePath);
        if (inProgress) await inProgress;

        const promise = this.reindexFile(filePath);
        this.activeReindexing.set(filePath, promise);
        try {
          await promise;
        } finally {
          this.activeReindexing.delete(filePath);
        }
      }, 1000),
    );
  }

  private async embedAndInsertChunks(chunks: CodeChunk[]): Promise<string[]> {
    const insertedIds: string[] = [];

    try {
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const texts = batch.map(
          c => `${c.language} ${c.constructType} ${c.constructName}\n${c.code}`,
        );

        const output = await this.pipeline(texts, {
          pooling: 'mean',
          normalize: true,
        });

        await this.vectraIndex.beginUpdate();
        try {
          for (let j = 0; j < batch.length; j++) {
            const chunk = batch[j];
            const vectorData = output[j].data as Float32Array;
            const vector = Array.from(vectorData);

            await this.vectraIndex.upsertItem({
              id: chunk.id,
              vector,
              metadata: {
                filePath: chunk.filePath,
                relativePath: chunk.relativePath,
                language: chunk.language,
                constructType: chunk.constructType,
                constructName: chunk.constructName,
                code: chunk.code,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
              },
            });
            insertedIds.push(chunk.id);
          }
          await this.vectraIndex.endUpdate();
        } catch (error) {
          this.vectraIndex.cancelUpdate();
          throw error;
        }

        // Yield between batches
        if (i + BATCH_SIZE < chunks.length) {
          await new Promise(r => setImmediate(r));
        }
      }
    } catch (error) {
      // Rollback successfully inserted chunks from prior batches
      if (insertedIds.length > 0) {
        await this.removeFileChunks(insertedIds).catch(() => {});
      }
      throw error;
    }

    return insertedIds;
  }

  private async removeFileChunks(chunkIds: string[]): Promise<void> {
    if (chunkIds.length === 0) return;

    await this.vectraIndex.beginUpdate();
    try {
      for (const id of chunkIds) {
        try {
          await this.vectraIndex.deleteItem(id);
        } catch {
          // Item may not exist
        }
      }
      await this.vectraIndex.endUpdate();
    } catch {
      this.vectraIndex.cancelUpdate();
    }

    // Update total chunks count
    try {
      const stats = await this.vectraIndex.getIndexStats();
      this.status.totalChunks = stats.items;
    } catch {
      // Ignore
    }
  }

  private async walkDirectory(dir: string, excludePatterns: string[]): Promise<string[]> {
    const files: string[] = [];
    const supportedExtensions = new Set(this.codeParser.getSupportedExtensions());

    const walk = async (currentDir: string, inheritedIgnoreRules: string[]): Promise<void> => {
      let entries;
      try {
        entries = await readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      // Read .gitignore in this directory and merge with inherited rules
      const localRules = await this.readGitignore(currentDir);
      const allIgnoreRules = [...inheritedIgnoreRules, ...localRules];

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const relativePath = relative(dir, fullPath);

        // Skip hidden directories (except we already handle .git via exclude patterns)
        if (entry.isDirectory() && entry.name.startsWith('.')) {
          continue;
        }

        if (this.matchesExcludePattern(relativePath, excludePatterns)) {
          continue;
        }

        if (this.matchesGitignore(entry.name, relativePath, entry.isDirectory(), allIgnoreRules)) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(fullPath, allIgnoreRules);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (supportedExtensions.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    await walk(dir, []);
    return files;
  }

  private async readGitignore(dir: string): Promise<string[]> {
    try {
      const gitignorePath = join(dir, '.gitignore');
      await access(gitignorePath);
      const content = await readFile(gitignorePath, 'utf-8');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    } catch {
      return [];
    }
  }

  private matchesGitignore(
    name: string,
    relativePath: string,
    isDir: boolean,
    rules: string[],
  ): boolean {
    for (const rule of rules) {
      // Skip negation patterns (complex to handle properly)
      if (rule.startsWith('!')) continue;

      let pattern = rule;
      // Directory-only pattern (trailing /)
      const dirOnly = pattern.endsWith('/');
      if (dirOnly && !isDir) continue;
      pattern = pattern.replace(/\/$/, '');

      // If pattern has no slash, match against basename only
      if (!pattern.includes('/')) {
        if (this.simpleGlobMatch(pattern, name)) return true;
      } else {
        // Match against relative path
        if (this.simpleGlobMatch(pattern, relativePath)) return true;
      }
    }
    return false;
  }

  private globToRegexStr(pattern: string): string {
    return pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '<<GLOBSTAR>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<GLOBSTAR>>/g, '.*')
      .replace(/\?/g, '[^/]');
  }

  private simpleGlobMatch(pattern: string, text: string): boolean {
    try {
      return new RegExp(`^${this.globToRegexStr(pattern)}$`).test(text);
    } catch {
      return false;
    }
  }

  private matchesExcludePattern(relativePath: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      try {
        const rs = this.globToRegexStr(pattern);
        const regex = new RegExp(`^${rs}$|/${rs}$|^${rs}/|/${rs}/`);
        if (regex.test(relativePath) || regex.test('/' + relativePath)) {
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }

  private async hashFile(filePath: string): Promise<string> {
    const content = await readFile(filePath, 'utf-8');
    return createHash('md5').update(content).digest('hex');
  }

  private updateStatus(partial: Partial<IndexStatus>): void {
    this.status = { ...this.status, ...partial };
    this.emit('status-changed', { ...this.status });
  }
}
