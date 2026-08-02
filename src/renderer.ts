import type { ModApi } from '@commandcode/harness';
import { CustomRendererData } from './types';

/**
 * ANSI Color Palette & Theme Tokens
 */
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Foreground
  cyan: '\x1b[38;5;51m',
  purple: '\x1b[38;5;141m',
  pink: '\x1b[38;5;206m',
  gold: '\x1b[38;5;220m',
  green: '\x1b[38;5;82m',
  red: '\x1b[38;5;196m',
  blue: '\x1b[38;5;75m',
  gray: '\x1b[38;5;243m',
  lightGray: '\x1b[38;5;248m',
  white: '\x1b[38;5;255m',

  // Badges (Background + Foreground)
  extractedBadge: '\x1b[48;5;28m\x1b[38;5;255m\x1b[1m EXTRACTED \x1b[0m',
  inferredBadge: '\x1b[48;5;172m\x1b[38;5;255m\x1b[1m INFERRED \x1b[0m',
  hubBadge: '\x1b[48;5;93m\x1b[38;5;255m\x1b[1m HUB \x1b[0m',
  nodeBullet: '\x1b[38;5;51m◆\x1b[0m',
  arrowRight: '\x1b[38;5;206m ➔ \x1b[0m',
  arrowLeft: '\x1b[38;5;206m ⬅ \x1b[0m',
};

/**
 * Get category badge based on render data type
 */
function getTypeBadge(type?: string): string {
  switch (type) {
    case 'ignore':
      return '\x1b[48;5;28m\x1b[38;5;255m\x1b[1m 🙈 IGNORE \x1b[0m';
    case 'build':
      return '\x1b[48;5;33m\x1b[38;5;255m\x1b[1m 🛠️ BUILD \x1b[0m';
    case 'query':
      return '\x1b[48;5;93m\x1b[38;5;255m\x1b[1m 🔍 QUERY \x1b[0m';
    case 'explain':
      return '\x1b[48;5;172m\x1b[38;5;255m\x1b[1m 💡 EXPLAIN \x1b[0m';
    case 'path':
      return '\x1b[48;5;125m\x1b[38;5;255m\x1b[1m 🛤️ PATH \x1b[0m';
    case 'report':
      return '\x1b[48;5;30m\x1b[38;5;255m\x1b[1m 📊 REPORT \x1b[0m';
    case 'nodes':
      return '\x1b[48;5;208m\x1b[38;5;255m\x1b[1m 🕸️ NODES \x1b[0m';
    default:
      return '\x1b[48;5;93m\x1b[38;5;255m\x1b[1m 🕸️ GRAPHIFY \x1b[0m';
  }
}

/**
 * Sanitize control characters safely
 */
function sanitizeControlChars(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Format a content line with rich ANSI syntax highlighting & badges
 */
function formatContentLine(line: string, type?: string): string {
  if (!line) return '';

  // Special formatting for .graphifyignore files
  if (type === 'ignore') {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      return `${C.italic}${C.gray}${line}${C.reset}`;
    }
    if (trimmed.startsWith('!')) {
      return `${C.bold}${C.green}${line}${C.reset}`;
    }
    if (trimmed.endsWith('/') || trimmed.includes('*')) {
      return `${C.gold}${line}${C.reset}`;
    }
    return `${C.white}${line}${C.reset}`;
  }

  let formatted = line
    .replace(/\[EXTRACTED\]/g, C.extractedBadge)
    .replace(/\[INFERRED\]/g, C.inferredBadge)
    .replace(/-->/g, C.arrowRight)
    .replace(/<--/g, C.arrowLeft);

  // Format NODE symbol lines nicely
  if (formatted.trimStart().startsWith('NODE ')) {
    formatted = formatted.replace(
      /^(\s*)NODE\s+([^\s]+)/,
      `$1${C.nodeBullet} ${C.bold}${C.white}$2${C.reset}`
    );
  }

  // Highlight file sources src=path
  formatted = formatted.replace(/src=([^\s]+)/g, `${C.gray}src=${C.cyan}$1${C.reset}`);

  // Highlight community=
  formatted = formatted.replace(/community=([^\s\]]+)/g, `${C.gray}community=${C.purple}$1${C.reset}`);

  // Highlight degree=
  formatted = formatted.replace(/(deg(?:ree)?:?\s*)(\d+)/gi, `$1${C.gold}$2${C.reset}`);

  return formatted;
}

/**
 * Register custom TUI renderer for styled Graphify feed entries.
 * Features a badge header and closes elegantly with a bottom corner turning right (╰─).
 */
export function registerGraphifyRenderer(cmd: ModApi) {
  cmd.addRenderer('graphify_result', (data?: CustomRendererData) => {
    if (!data) return [];

    const safeTitle = sanitizeControlChars(data.title || 'GRAPHIFY RESULT');
    const badge = getTypeBadge(data.type);
    const bar = `${C.purple}│${C.reset}`;

    // Line 1: Badge header flush with CommandCode bullet ◼
    const lines: string[] = [
      `${badge}  ${C.bold}${C.white}${safeTitle}${C.reset}`,
      `${bar}`,
    ];

    const rawContent = sanitizeControlChars(data.content);
    const contentLines = rawContent ? rawContent.split('\n') : [];

    for (const rawLine of contentLines) {
      const styledLine = formatContentLine(rawLine, data.type);
      lines.push(`${bar}  ${styledLine}`);
    }

    // Final line: Ends with a smooth bottom corner pointing right (╰─)
    lines.push(`${C.purple}╰─${C.reset}`);
    return lines;
  });
}
