import type { ModApi } from '@commandcode/harness';
import * as fs from 'fs';
import * as path from 'path';
import { extractArgsString, getErrorMessage, GraphifyCliResult, GraphifyGraphData, isDomainNode } from './types';

const MAX_JSON_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB maximum safety limit

export interface ParsedArgs {
  targetPath: string;
  flags: string[];
}

/**
 * Service managing CLI execution, path resolution, staleness detection, and cache management.
 */
export class GraphifyCliService {
  private cmd: ModApi;
  private cachedData: GraphifyGraphData | null = null;
  private lastMtime: number = 0;

  constructor(cmd: ModApi) {
    this.cmd = cmd;
  }

  /**
   * Get workspace root directory safely
   */
  getCwd(): string {
    return this.cmd.cwd || process.cwd();
  }

  /**
   * Get path to graphify-out directory
   */
  getOutDir(): string {
    return path.join(this.getCwd(), 'graphify-out');
  }

  /**
   * Get safe absolute path for a file inside graphify-out/
   */
  getOutFilePath(filename: string): string {
    return path.join(this.getOutDir(), filename);
  }

  /**
   * Get path to .graphifyignore file at workspace root
   */
  getGraphifyIgnorePath(): string {
    return path.join(this.getCwd(), '.graphifyignore');
  }

  /**
   * Read contents of .graphifyignore
   */
  readGraphifyIgnore(): string | null {
    const ignorePath = this.getGraphifyIgnorePath();
    try {
      if (fs.existsSync(ignorePath)) {
        return fs.readFileSync(ignorePath, 'utf-8');
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Append or create patterns in .graphifyignore
   */
  appendGraphifyIgnore(patterns: string[]): boolean {
    const ignorePath = this.getGraphifyIgnorePath();
    try {
      const contentToAppend = patterns.filter((p) => p.trim().length > 0).join('\n') + '\n';
      fs.appendFileSync(ignorePath, contentToAppend, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean/remove existing graphify-out directory for a fresh rebuild
   */
  cleanOutDir(): boolean {
    const outDir = this.getOutDir();
    try {
      if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
      }
      this.invalidateCache();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse target path and flags. Supports --code-only, --mode deep, --no-gitignore, --with-docs.
   */
  parseInput(input?: unknown): ParsedArgs {
    const rawString = extractArgsString(input).trim();

    let codeOnly = true; // DEFAULT: --code-only
    let noGitignore = false;
    let pathToken = '.';

    if (rawString) {
      const tokens = rawString.split(/\s+/);
      for (const token of tokens) {
        if (token === '--with-docs' || token === '--all') {
          codeOnly = false;
        } else if (token === '--code-only' || token === '-c') {
          codeOnly = true;
        } else if (token === '--no-gitignore') {
          noGitignore = true;
        } else if (!token.startsWith('-') && pathToken === '.') {
          pathToken = token;
        }
      }
    }

    const flags: string[] = [];
    if (codeOnly) flags.push('--code-only');
    flags.push('--mode', 'deep');
    if (noGitignore) flags.push('--no-gitignore');

    const resolved = path.resolve(this.getCwd(), pathToken);
    const relative = path.relative(this.getCwd(), resolved);

    let sanitizedPath = resolved;
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      sanitizedPath = this.getCwd();
    }

    return { targetPath: sanitizedPath, flags };
  }

  /**
   * Execute graphify CLI command safely, routing to extract subcommand when building
   */
  async exec(args: string[]): Promise<GraphifyCliResult> {
    const cwd = this.getCwd();

    const knownSubcommands = ['extract', 'query', 'explain', 'path', 'god-nodes', 'tree', 'export', 'clean', 'cluster-only', 'save-result', 'reflect'];
    let finalArgs = [...args];
    if (finalArgs.length > 0 && !knownSubcommands.includes(finalArgs[0])) {
      finalArgs = ['extract', ...finalArgs];
    }

    const runCmd = async (commandName: string, cmdArgs: string[]): Promise<{ returnCode: number; stdout: string; stderr: string }> => {
      try {
        const result = await this.cmd.exec({ command: commandName, args: cmdArgs, cwd });
        const returnCode = result.code !== undefined ? result.code : (result as { exitCode?: number }).exitCode;
        return { returnCode: returnCode ?? 0, stdout: result.stdout || '', stderr: result.stderr || '' };
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; code?: number; exitCode?: number; message?: string };
        const stdout = err.stdout || '';
        const stderr = err.stderr || err.message || getErrorMessage(e);
        const code = err.code ?? err.exitCode ?? 1;
        return { returnCode: code, stdout, stderr };
      }
    };

    let res: { returnCode: number; stdout: string; stderr: string };

    res = await runCmd('graphify', finalArgs);

    if (res.returnCode === 127 || res.stderr.includes('not found') || res.stderr.includes('ENOENT')) {
      res = await runCmd('uvx', ['graphifyy', ...finalArgs]);
    }

    if (res.returnCode === 0) {
      this.invalidateCache();
      let outputText = res.stdout || res.stderr || 'Command executed successfully.';

      if (finalArgs[0] === 'extract') {
        const reportPath = this.getOutFilePath('GRAPH_REPORT.md');
        if (!fs.existsSync(reportPath)) {
          const targetPath = finalArgs[1] || '.';
          try {
            const clusterRes = await runCmd('graphify', ['cluster-only', targetPath]);
            if (clusterRes.returnCode === 0 && clusterRes.stdout) {
              outputText += `\n[graphify cluster] ${clusterRes.stdout.trim()}`;
            }
          } catch {
            // Ignore
          }
        }
      }

      return { ok: true, output: outputText };
    }

    const combinedOutput = `${res.stderr}\n${res.stdout}`;

    if (combinedOutput.includes('no LLM API key found') && !finalArgs.includes('--code-only')) {
      this.cmd.ui.notify?.('No LLM API key detected. Retrying in --code-only mode...');
      
      const fallbackArgs = ['extract', ...finalArgs.filter((a) => a !== '--with-docs' && a !== '--all' && a !== 'extract'), '--code-only', '--mode', 'deep'];
      try {
        const retryRes = await runCmd('graphify', fallbackArgs);
        if (retryRes.returnCode === 0) {
          this.invalidateCache();

          const targetPath = fallbackArgs[1] || '.';
          let clusterText = '';
          try {
            const clusterRes = await runCmd('graphify', ['cluster-only', targetPath]);
            if (clusterRes.returnCode === 0 && clusterRes.stdout) {
              clusterText = `\n[graphify cluster] ${clusterRes.stdout.trim()}`;
            }
          } catch {
            // Ignore
          }

          return {
            ok: true,
            output: `Indexed in --code-only --mode deep (Local AST, no LLM key required).\n\n${retryRes.stdout || retryRes.stderr}${clusterText}`,
          };
        }
      } catch {
        // Ignore
      }
    }

    return { ok: false, error: res.stderr || res.stdout || `Process exited with code ${res.returnCode}` };
  }

  /**
   * Invalidate internal in-memory cache
   */
  invalidateCache(): void {
    this.cachedData = null;
    this.lastMtime = 0;
  }

  /**
   * Load parsed graph JSON using timestamp (mtime) caching and calculate node degrees from links/edges
   */
  getGraphData(): GraphifyGraphData | null {
    const jsonPath = this.getOutFilePath('graph.json');

    try {
      const stat = fs.statSync(jsonPath);

      if (stat.size > MAX_JSON_SIZE_BYTES) {
        return null;
      }

      if (this.cachedData && this.lastMtime === stat.mtimeMs) {
        return this.cachedData;
      }

      const content = fs.readFileSync(jsonPath, 'utf-8');
      const parsed = JSON.parse(content);

      if (typeof parsed === 'object' && parsed !== null) {
        const graphData = parsed as GraphifyGraphData;
        
        const linksList = Array.isArray(graphData.links)
          ? graphData.links
          : Array.isArray(graphData.edges)
          ? graphData.edges
          : [];

        if (Array.isArray(graphData.nodes)) {
          const edgeCounts = new Map<string, number>();
          for (const edge of linksList) {
            if (edge.source) edgeCounts.set(edge.source, (edgeCounts.get(edge.source) || 0) + 1);
            if (edge.target) edgeCounts.set(edge.target, (edgeCounts.get(edge.target) || 0) + 1);
          }

          for (const node of graphData.nodes) {
            const computedDegree = edgeCounts.get(node.id) || 0;
            if (node.degree === undefined || node.degree === 0 || computedDegree > node.degree) {
              node.degree = computedDegree;
            }
          }
        }

        graphData.edges = linksList;

        this.cachedData = graphData;
        this.lastMtime = stat.mtimeMs;
        return this.cachedData;
      }
      return null;
    } catch {
      this.cachedData = null;
      this.lastMtime = 0;
      return null;
    }
  }

  /**
   * Update CommandCode TUI status bar
   */
  refreshStatus(): void {
    const graphData = this.getGraphData();
    if (graphData && Array.isArray(graphData.nodes)) {
      const domainNodes = graphData.nodes.filter(isDomainNode);
      const edgeCount = Array.isArray(graphData.edges) ? graphData.edges.length : 0;
      this.cmd.ui.setStatus?.({
        text: `Graphify: Active (${domainNodes.length} domain nodes, ${edgeCount} edges)`,
        icon: '🕸️',
      });
    } else {
      this.cmd.ui.setStatus?.({
        text: 'Graphify: No Graph (Run /graphify)',
        icon: '🕸️',
      });
    }
  }

  /**
   * Detect if running inside WSL (Windows Subsystem for Linux)
   */
  private isWSL(): boolean {
    try {
      const release = fs.readFileSync('/proc/version', 'utf-8');
      return /microsoft|wsl/i.test(release);
    } catch {
      return false;
    }
  }

  /**
   * Open file in host OS browser — supports WSL, macOS, Linux, and Windows
   */
  async openInBrowser(filePath: string): Promise<boolean> {
    const cwd = this.getCwd();

    if (this.isWSL()) {
      try {
        await this.cmd.exec({ command: 'wslview', args: [filePath], cwd });
        return true;
      } catch {
        // Fallback
      }
      try {
        const winPathResult = await this.cmd.exec({ command: 'wslpath', args: ['-w', filePath], cwd });
        const winPath = (winPathResult.stdout || '').trim();
        if (winPath) {
          await this.cmd.exec({ command: 'cmd.exe', args: ['/c', 'start', '', winPath], cwd });
          return true;
        }
      } catch {
        // Ignore
      }
      return false;
    }

    const platform = process.platform;
    let command = 'xdg-open';
    if (platform === 'darwin') command = 'open';
    else if (platform === 'win32') command = 'start';

    try {
      await this.cmd.exec({ command, args: [filePath], cwd });
      return true;
    } catch {
      return false;
    }
  }
}
