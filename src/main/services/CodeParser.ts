import { readFile } from 'fs/promises'
import { join, extname } from 'path'
import { createHash } from 'crypto'
import { app } from 'electron'
import type { CodeChunk } from '../types/codesearch.types'

type TreeSitterModule = typeof import('web-tree-sitter')
type Parser = InstanceType<TreeSitterModule['default']>
type Language = InstanceType<TreeSitterModule['default']['Language']>

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.swift': 'swift',
}

// Container types: extracted as chunks AND recursed into (e.g. a class contains methods)
const CONTAINER_TYPES: Record<string, string[]> = {
  javascript: ['class_declaration'],
  typescript: ['class_declaration', 'interface_declaration'],
  tsx: ['class_declaration', 'interface_declaration'],
  python: ['class_definition'],
  rust: ['impl_item', 'trait_item', 'mod_item'],
  go: ['type_declaration'],
  java: ['class_declaration', 'interface_declaration', 'enum_declaration'],
  swift: ['class_declaration', 'protocol_declaration', 'struct_declaration', 'enum_declaration'],
}

// Leaf types: extracted as chunks but NOT recursed into
const LEAF_TYPES: Record<string, string[]> = {
  javascript: ['function_declaration', 'method_definition', 'arrow_function'],
  typescript: ['function_declaration', 'method_definition', 'arrow_function', 'type_alias_declaration'],
  tsx: ['function_declaration', 'method_definition', 'arrow_function', 'type_alias_declaration'],
  python: ['function_definition', 'decorated_definition'],
  rust: ['function_item', 'struct_item', 'enum_item'],
  go: ['function_declaration', 'method_declaration'],
  java: ['method_declaration', 'constructor_declaration'],
  swift: ['function_declaration'],
}

function getConstructName(node: any, language: string): string {
  // Try common field names for the construct name
  const nameNode =
    node.childForFieldName('name') ||
    node.childForFieldName('pattern')

  if (nameNode) return nameNode.text

  // For arrow functions assigned to const/let/var, get the variable name
  if (node.type === 'arrow_function' && node.parent) {
    const parent = node.parent
    if (
      parent.type === 'variable_declarator' ||
      parent.type === 'lexical_declaration'
    ) {
      const nameChild = parent.childForFieldName('name')
      if (nameChild) return nameChild.text
    }
  }

  // For export statements, try to get the name of the exported thing
  if (node.type === 'export_statement') {
    const declaration = node.childForFieldName('declaration')
    if (declaration) {
      const name = declaration.childForFieldName('name')
      if (name) return name.text
    }
  }

  return '<anonymous>'
}

function getLeadingComment(node: any): string {
  let prev = node.previousNamedSibling
  if (prev && prev.type === 'comment') {
    return prev.text + '\n'
  }
  return ''
}

export class CodeParser {
  private parser: Parser | null = null
  private languages = new Map<string, Language>()
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return

    const mod = await import('web-tree-sitter')
    // v0.24.x CJS: default export is the Parser class itself (a function)
    // v0.26.x CJS: named exports { Parser, Language }
    const ParserClass = (mod as any).default || (mod as any).Parser
    if (!ParserClass?.init) {
      throw new Error('web-tree-sitter: could not find Parser.init')
    }

    // Locate the tree-sitter WASM file (v0.24 = tree-sitter.wasm, v0.26 = web-tree-sitter.wasm)
    const wasmDir = app.isPackaged
      ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'web-tree-sitter')
      : join(__dirname, '..', '..', 'node_modules', 'web-tree-sitter')
    const wasmPath = join(wasmDir, 'tree-sitter.wasm')

    await ParserClass.init({
      locateFile: () => wasmPath,
    })

    // Language is available on ParserClass after init() in v0.24, or as separate export in v0.26
    const LanguageClass = ParserClass.Language || (mod as any).Language
    if (!LanguageClass?.load) {
      throw new Error('web-tree-sitter: could not find Language.load')
    }

    this.parser = new ParserClass()

    // Preload grammar files
    const grammarsDir = app.isPackaged
      ? join(process.resourcesPath, 'tree-sitter-grammars')
      : join(__dirname, '..', '..', 'resources', 'tree-sitter-grammars')

    const allLanguages = new Set([...Object.keys(CONTAINER_TYPES), ...Object.keys(LEAF_TYPES)])
    for (const lang of allLanguages) {
      try {
        const grammarPath = join(grammarsDir, `tree-sitter-${lang}.wasm`)
        const language = await LanguageClass.load(grammarPath)
        this.languages.set(lang, language)
      } catch {
        console.warn(`CodeParser: grammar not available for ${lang}`)
      }
    }

    this.initialized = true
  }

  getSupportedExtensions(): string[] {
    return Object.keys(EXTENSION_TO_LANGUAGE)
  }

  getLanguageForFile(filePath: string): string | null {
    const ext = extname(filePath).toLowerCase()
    return EXTENSION_TO_LANGUAGE[ext] || null
  }

  async parseFile(filePath: string, relativePath: string, maxFileSize: number): Promise<CodeChunk[]> {
    if (!this.parser) throw new Error('CodeParser not initialized')

    const language = this.getLanguageForFile(filePath)
    if (!language) return this.fallbackChunk(filePath, relativePath, maxFileSize)

    const langObj = this.languages.get(language)
    if (!langObj) return this.fallbackChunk(filePath, relativePath, maxFileSize)

    let content: string
    try {
      content = await readFile(filePath, 'utf-8')
    } catch {
      return []
    }

    if (content.length > maxFileSize) return []

    this.parser.setLanguage(langObj)
    const tree = this.parser.parse(content)
    if (!tree) return []

    const chunks: CodeChunk[] = []
    const containers = CONTAINER_TYPES[language] || []
    const leaves = LEAF_TYPES[language] || []

    this.walkTree(tree.rootNode, containers, leaves, (node) => {
      const comment = getLeadingComment(node)
      const name = getConstructName(node, language)
      const code = comment + node.text

      const constructType = node.type

      const startLine = comment
        ? node.previousNamedSibling?.startPosition?.row ?? node.startPosition.row
        : node.startPosition.row
      const endLine = node.endPosition.row

      // Skip chunks that are too small (< 4 lines) or too large (> 200 lines)
      // 4-line minimum filters out trivial getters, setters, one-liner wrappers
      const lineCount = endLine - startLine + 1
      if (lineCount < 4 || lineCount > 200) return

      const id = createHash('md5')
        .update(`${filePath}:${startLine}:${name}`)
        .digest('hex')
        .slice(0, 16)

      chunks.push({
        id,
        filePath,
        relativePath,
        language,
        constructType,
        constructName: name,
        code: code.slice(0, 4000), // cap individual chunk code size
        startLine: startLine + 1, // 1-based
        endLine: endLine + 1,
      })
    })

    tree.delete()
    return chunks
  }

  private walkTree(
    node: any,
    containers: string[],
    leaves: string[],
    callback: (node: any) => void,
  ): void {
    // Export statements are transparent wrappers — unwrap and recurse into their declaration
    if (node.type === 'export_statement') {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i)
        if (child) this.walkTree(child, containers, leaves, callback)
      }
      return
    }

    if (containers.includes(node.type)) {
      // Container: extract it AND recurse into children to find methods/functions inside
      callback(node)
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i)
        if (child) this.walkTree(child, containers, leaves, callback)
      }
      return
    }

    if (leaves.includes(node.type)) {
      // Leaf: extract it but don't recurse further (avoid nested duplicates)
      callback(node)
      return
    }

    // Not a construct — keep recursing
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child) this.walkTree(child, containers, leaves, callback)
    }
  }

  private async fallbackChunk(
    filePath: string,
    relativePath: string,
    maxFileSize: number,
  ): Promise<CodeChunk[]> {
    let content: string
    try {
      content = await readFile(filePath, 'utf-8')
    } catch {
      return []
    }

    if (content.length > maxFileSize) return []

    // Split by double newlines for unsupported languages
    const blocks = content.split(/\n\s*\n/)
    const chunks: CodeChunk[] = []
    let lineOffset = 0

    for (const block of blocks) {
      const trimmed = block.trim()
      if (!trimmed) {
        lineOffset += block.split('\n').length
        continue
      }

      const lines = block.split('\n')
      if (lines.length < 2) {
        lineOffset += lines.length
        continue
      }

      const ext = extname(filePath).replace('.', '') || 'unknown'
      const id = createHash('md5')
        .update(`${filePath}:${lineOffset}:fallback`)
        .digest('hex')
        .slice(0, 16)

      chunks.push({
        id,
        filePath,
        relativePath,
        language: ext,
        constructType: 'block',
        constructName: '<block>',
        code: trimmed.slice(0, 4000),
        startLine: lineOffset + 1,
        endLine: lineOffset + lines.length,
      })

      lineOffset += lines.length
    }

    return chunks
  }
}
