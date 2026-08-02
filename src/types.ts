export interface GraphifyNode {
  id: string;
  label?: string;
  type?: string;
  degree?: number;
  community?: number;
  community_name?: string;
  source?: string;
  source_file?: string;
  source_location?: string;
}

export interface GraphifyEdge {
  source: string;
  target: string;
  relation?: string;
  type?: string;
}

export interface GraphifyGraphData {
  nodes?: GraphifyNode[];
  edges?: GraphifyEdge[];
  links?: GraphifyEdge[];
  communities?: Record<string, unknown>;
}

export interface GraphifyCliResult {
  ok: boolean;
  output?: string;
  error?: string;
}

export interface CustomRendererData {
  title?: string;
  content?: string;
  type?: string;
}

/**
 * Safely extract argument string from either an object context ({ args: string | string[] }) or raw string
 */
export function extractArgsString(contextInput: unknown): string {
  if (!contextInput) return '';

  if (typeof contextInput === 'string') {
    return contextInput;
  }

  if (typeof contextInput === 'object' && contextInput !== null) {
    const ctx = contextInput as { args?: unknown };
    if (typeof ctx.args === 'string') {
      return ctx.args;
    }
    if (Array.isArray(ctx.args)) {
      return ctx.args.filter((item) => typeof item === 'string').join(' ');
    }
  }

  return '';
}

/**
 * Safely extract readable error message from any error object
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error occurred';
}

/**
 * Filter out config files, node_modules, and minified artifacts to keep only true domain nodes
 */
export function isDomainNode(node: GraphifyNode): boolean {
  if (!node || typeof node.id !== 'string') return false;

  const file = node.source_file || node.source || '';
  if (file.includes('node_modules') || file.includes('.min.js') || file.includes('dist/')) {
    return false;
  }

  const id = node.id.toLowerCase();

  // Exclude config files, manifests, and tooling noise
  if (
    id === 'mcp' ||
    id.includes('prettier') ||
    id.includes('eslintrc') ||
    id.includes('package_') ||
    id.includes('nest_cli') ||
    id.endsWith('rc')
  ) {
    return false;
  }

  // Exclude minified single-letter functions like t(), o(), i()
  if (/^[a-zA-Z]\(\)$/.test(node.id.trim())) {
    return false;
  }

  return true;
}
