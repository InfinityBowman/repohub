/**
 * Scans skill files for hidden content that could be used for
 * agent prompt injection — text invisible to humans but read by AI.
 * Covers SKILL.md, AGENTS.md, rules/, scripts/, and all other text files.
 */

export interface ScanWarning {
  severity: 'high' | 'medium' | 'low';
  type: string;
  message: string;
  details?: string; // extracted hidden content preview
  file?: string; // which file the warning came from
}

// Zero-width and invisible unicode characters
const INVISIBLE_CHARS: Record<string, string> = {
  '\u200B': 'Zero-Width Space',
  '\u200C': 'Zero-Width Non-Joiner',
  '\u200D': 'Zero-Width Joiner',
  '\uFEFF': 'Zero-Width No-Break Space (BOM)',
  '\u200E': 'Left-to-Right Mark',
  '\u200F': 'Right-to-Left Mark',
  '\u202A': 'Left-to-Right Embedding',
  '\u202B': 'Right-to-Left Embedding',
  '\u202C': 'Pop Directional Formatting',
  '\u202D': 'Left-to-Right Override',
  '\u202E': 'Right-to-Left Override',
  '\u2060': 'Word Joiner',
  '\u2061': 'Function Application',
  '\u2062': 'Invisible Times',
  '\u2063': 'Invisible Separator',
  '\u2064': 'Invisible Plus',
  '\u2066': 'Left-to-Right Isolate',
  '\u2067': 'Right-to-Left Isolate',
  '\u2068': 'First Strong Isolate',
  '\u2069': 'Pop Directional Isolate',
  '\u206A': 'Inhibit Symmetric Swapping',
  '\u206B': 'Activate Symmetric Swapping',
  '\u206C': 'Inhibit Arabic Form Shaping',
  '\u206D': 'Activate Arabic Form Shaping',
  '\u206E': 'National Digit Shapes',
  '\u206F': 'Nominal Digit Shapes',
};

const INVISIBLE_CHAR_REGEX = new RegExp(
  `[${Object.keys(INVISIBLE_CHARS).join('')}]`,
  'g',
);

// HTML comment pattern
const HTML_COMMENT_REGEX = /<!--([\s\S]*?)-->/g;

// CSS-hidden elements
const CSS_HIDDEN_REGEX =
  /<[^>]+(?:style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|font-size\s*:\s*0|height\s*:\s*0|width\s*:\s*0|overflow\s*:\s*hidden)[^"']*["']|hidden(?:\s|>))[^>]*>[\s\S]*?<\/[^>]+>/gi;

// HTML hidden attribute
const HIDDEN_ATTR_REGEX = /<[^>]+\bhidden\b[^>]*>([\s\S]*?)<\/[^>]+>/gi;

// Suspicious instruction patterns in hidden content
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|above)/i,
  /forget\s+(?:all\s+)?(?:previous|prior|above)/i,
  /you\s+are\s+now/i,
  /new\s+instructions?/i,
  /system\s*:\s*/i,
  /\bexecute\b.*\b(?:command|script|code)\b/i,
  /\brun\b.*\b(?:rm|del|format|curl|wget|eval)\b/i,
  /\bdownload\b.*\bexecute\b/i,
  /\boverride\b.*\b(?:safety|security|permission)/i,
  /\bbypass\b/i,
  /\bexfiltrate\b/i,
  /\bsend\b.*\b(?:data|info|content)\b.*\bto\b/i,
];

function truncate(s: string, max = 200): string {
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max) + '...';
}

/**
 * Scan a single piece of text content for hidden injection vectors.
 * Optionally tag warnings with a filename.
 */
export function scanSkillContent(rawContent: string, filename?: string): ScanWarning[] {
  const warnings: ScanWarning[] = [];

  // 1. HTML comments
  const comments: string[] = [];
  let match: RegExpExecArray | null;
  HTML_COMMENT_REGEX.lastIndex = 0;
  while ((match = HTML_COMMENT_REGEX.exec(rawContent)) !== null) {
    const content = match[1].trim();
    if (content.length > 0) {
      comments.push(content);
    }
  }

  if (comments.length > 0) {
    const hasInjection = comments.some(c =>
      INJECTION_PATTERNS.some(p => p.test(c)),
    );
    warnings.push({
      severity: hasInjection ? 'high' : 'medium',
      type: 'html-comments',
      message: `${comments.length} hidden HTML comment${comments.length > 1 ? 's' : ''} detected`,
      details: comments.map(c => truncate(c, 120)).join('\n---\n'),
      file: filename,
    });
  }

  // 2. Invisible unicode characters
  INVISIBLE_CHAR_REGEX.lastIndex = 0;
  const invisibleMatches = rawContent.match(INVISIBLE_CHAR_REGEX);
  if (invisibleMatches && invisibleMatches.length > 0) {
    // Count by type
    const counts = new Map<string, number>();
    for (const ch of invisibleMatches) {
      const name = INVISIBLE_CHARS[ch] || `U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    const breakdown = Array.from(counts.entries())
      .map(([name, count]) => `${name} x${count}`)
      .join(', ');

    // Check if there's hidden text between invisible chars
    const isBidi = invisibleMatches.some(ch =>
      ['\u202A', '\u202B', '\u202D', '\u202E', '\u2066', '\u2067'].includes(ch),
    );

    warnings.push({
      severity: isBidi ? 'high' : 'medium',
      type: 'invisible-unicode',
      message: `${invisibleMatches.length} invisible unicode character${invisibleMatches.length > 1 ? 's' : ''} found${isBidi ? ' (includes BiDi overrides)' : ''}`,
      details: breakdown,
      file: filename,
    });
  }

  // 3. CSS-hidden elements
  CSS_HIDDEN_REGEX.lastIndex = 0;
  const cssHiddenMatches = rawContent.match(CSS_HIDDEN_REGEX);
  HIDDEN_ATTR_REGEX.lastIndex = 0;
  const hiddenAttrMatches = rawContent.match(HIDDEN_ATTR_REGEX);
  const totalHidden = (cssHiddenMatches?.length || 0) + (hiddenAttrMatches?.length || 0);

  if (totalHidden > 0) {
    const allHidden = [...(cssHiddenMatches || []), ...(hiddenAttrMatches || [])];
    // Strip tags to see the hidden text
    const hiddenTexts = allHidden
      .map(h => h.replace(/<[^>]+>/g, '').trim())
      .filter(t => t.length > 0);

    const hasInjection = hiddenTexts.some(t =>
      INJECTION_PATTERNS.some(p => p.test(t)),
    );

    warnings.push({
      severity: hasInjection ? 'high' : 'medium',
      type: 'css-hidden',
      message: `${totalHidden} CSS-hidden element${totalHidden > 1 ? 's' : ''} detected`,
      details: hiddenTexts.map(t => truncate(t, 120)).join('\n---\n') || undefined,
      file: filename,
    });
  }

  // 4. Base64 encoded blocks (could hide instructions)
  const base64Regex = /(?:^|[\s"'=])([A-Za-z0-9+/]{40,}={0,2})(?:[\s"']|$)/gm;
  base64Regex.lastIndex = 0;
  const base64Matches: string[] = [];
  while ((match = base64Regex.exec(rawContent)) !== null) {
    // Skip if it looks like a hash or normal code
    const val = match[1];
    try {
      const decoded = atob(val);
      // Only flag if decoded content has readable ASCII
      if (/^[\x20-\x7E\n\r\t]{10,}$/.test(decoded)) {
        const hasInjection = INJECTION_PATTERNS.some(p => p.test(decoded));
        if (hasInjection) {
          base64Matches.push(truncate(decoded, 120));
        }
      }
    } catch {
      // Not valid base64, skip
    }
  }

  if (base64Matches.length > 0) {
    warnings.push({
      severity: 'high',
      type: 'base64-injection',
      message: `${base64Matches.length} base64-encoded suspicious instruction${base64Matches.length > 1 ? 's' : ''} found`,
      details: base64Matches.join('\n---\n'),
      file: filename,
    });
  }

  return warnings;
}

/**
 * Scan all text files in a skill directory for hidden injection vectors.
 * Falls back to scanning just SKILL.md content + description if allTextContent is not available.
 */
export function scanSkillFiles(
  skillContent: string,
  description: string,
  allTextContent?: Record<string, string>,
): ScanWarning[] {
  if (!allTextContent || Object.keys(allTextContent).length === 0) {
    // Fallback: scan just SKILL.md + description
    return scanSkillContent(skillContent + '\n' + (description || ''));
  }

  const warnings: ScanWarning[] = [];
  for (const [filePath, content] of Object.entries(allTextContent)) {
    const fileWarnings = scanSkillContent(content, filePath);
    warnings.push(...fileWarnings);
  }

  // Also scan the description separately (it comes from frontmatter, not file content)
  if (description) {
    const descWarnings = scanSkillContent(description, 'description (frontmatter)');
    warnings.push(...descWarnings);
  }

  return warnings;
}

/**
 * Strip hidden content from markdown before it's fed to an agent or rendered.
 * This returns a cleaned version of the content.
 */
export function stripHiddenContent(rawContent: string): string {
  let cleaned = rawContent;

  // Remove HTML comments
  cleaned = cleaned.replace(HTML_COMMENT_REGEX, '');

  // Remove invisible unicode characters
  cleaned = cleaned.replace(INVISIBLE_CHAR_REGEX, '');

  // Remove CSS-hidden elements
  cleaned = cleaned.replace(CSS_HIDDEN_REGEX, '');
  cleaned = cleaned.replace(HIDDEN_ATTR_REGEX, '');

  return cleaned;
}
