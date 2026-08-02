import type { ModApi } from '@commandcode/harness';
import * as fs from 'fs';
import { GraphifyCliService } from './cli';
import { extractArgsString, getErrorMessage, isDomainNode } from './types';

const MAX_REPORT_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Extract traversal stats from raw Graphify CLI output.
 */
function extractTraversalStats(output: string): string | null {
  const match = output.match(/Traversal:\s*(\S+)\s+depth=(\d+).*?\|\s*(\d+)\s+nodes\s+found/i);
  if (match) {
    return `${match[1]} depth=${match[2]}, ${match[3]} nodes found in graph.json`;
  }
  const nodeLines = output.split('\n').filter((l) => l.trimStart().startsWith('NODE '));
  if (nodeLines.length > 0) {
    return `${nodeLines.length} nodes matched in graph.json`;
  }
  return null;
}

/**
 * Register all CommandCode Slash Commands for Graphify with instant feed rendering
 */
export function registerSlashCommands(cmd: ModApi, cliService: GraphifyCliService) {

  // /graphify [path] [--with-docs] [--no-gitignore]
  cmd.addCommand({
    name: 'graphify',
    description: 'Build the Graphify knowledge graph (--code-only --mode deep by default, supports --no-gitignore)',
    handler: async (contextInput?: unknown) => {
      const { targetPath, flags } = cliService.parseInput(contextInput);

      // 1. Instant feed entry
      cmd.showEntry?.('graphify_result', {
        title: `Building Knowledge Graph (${targetPath})`,
        content: `⏳ Running Graphify AST parser on '${targetPath}'... Please wait.`,
        type: 'build',
      });
      cmd.ui.notify?.('⏳ Graphify: Building knowledge graph...');
      cmd.ui.setStatus?.({ text: `Graphify: Building...`, icon: '⏳' });

      const res = await cliService.exec([targetPath, ...flags]);
      cliService.refreshStatus();

      if (res.ok) {
        // 2. Final feed entry with build details
        cmd.showEntry?.('graphify_result', {
          title: `Build Successful (${targetPath})`,
          content: res.output || 'Graph built successfully.',
          type: 'build',
        });
        const g = cliService.getGraphData();
        const n = g && Array.isArray(g.nodes) ? g.nodes.filter(isDomainNode).length : 0;
        const e = g && Array.isArray(g.edges) ? g.edges.length : 0;
        cmd.ui.notify?.(`✅ Graphify: Built — ${n} domain nodes, ${e} edges.`);
        return { message: `🕸️ Graphify: Built successfully — ${n} domain nodes, ${e} edges.` };
      } else {
        cmd.showEntry?.('graphify_result', {
          title: `Build Failed (${targetPath})`,
          content: res.error || 'Build failed.',
          type: 'build',
        });
        cmd.ui.notify?.('⚠ Graphify: Build failed.');
        return { message: `⚠ Graphify build failed: ${(res.error || '').split('\n')[0]}` };
      }
    },
  });

  // /graphify-ignore [pattern1] [pattern2] ...
  cmd.addCommand({
    name: 'graphify-ignore',
    description: 'View or add ignore patterns to .graphifyignore in project root',
    handler: async (contextInput?: unknown) => {
      const inputStr = extractArgsString(contextInput).trim();
      const ignorePath = cliService.getGraphifyIgnorePath();

      if (!inputStr) {
        const currentContent = cliService.readGraphifyIgnore();
        if (currentContent !== null) {
          cmd.showEntry?.('graphify_result', {
            title: '.graphifyignore',
            content: currentContent,
            type: 'ignore',
          });
          return { message: `🙈 .graphifyignore content shown above (${ignorePath}).` };
        } else {
          const defaultTemplate = [
            '# .graphifyignore - Custom exclusions for Graphify',
            'node_modules/',
            'dist/',
            'build/',
            '*.min.js',
            '*.generated.*',
            'coverage/',
            '.cache/',
            '',
          ];
          cliService.appendGraphifyIgnore(defaultTemplate);
          const newContent = cliService.readGraphifyIgnore() || '';
          cmd.showEntry?.('graphify_result', {
            title: 'Created default .graphifyignore',
            content: newContent,
            type: 'ignore',
          });
          return { message: `🙈 Created default .graphifyignore at ${ignorePath}` };
        }
      }

      const patterns = inputStr.split(/\s+/).filter((p) => p.trim().length > 0);
      const success = cliService.appendGraphifyIgnore(patterns);
      if (success) {
        cmd.ui.notify?.(`🙈 Added ${patterns.length} pattern(s) to .graphifyignore`);
        const updated = cliService.readGraphifyIgnore() || '';
        cmd.showEntry?.('graphify_result', {
          title: 'Updated .graphifyignore',
          content: updated,
          type: 'ignore',
        });
        return { message: `🙈 Added ${patterns.length} pattern(s) to .graphifyignore. Run /graphify-update to apply.` };
      } else {
        return { message: `⚠ Failed to update .graphifyignore at ${ignorePath}` };
      }
    },
  });

  // /graphify-update [path]
  cmd.addCommand({
    name: 'graphify-update',
    description: 'Clean cache and force a complete rebuild of the knowledge graph',
    handler: async (contextInput?: unknown) => {
      const { targetPath, flags } = cliService.parseInput(contextInput);
      cliService.cleanOutDir();

      // Instant visual confirmation in feed
      cmd.showEntry?.('graphify_result', {
        title: `Rebuilding Knowledge Graph (${targetPath})`,
        content: `🔄 Cleaning cache & running full AST rebuild for '${targetPath}'... Please wait.`,
        type: 'build',
      });
      cmd.ui.notify?.('🔄 Graphify: Cleaning cache and rebuilding...');
      cmd.ui.setStatus?.({ text: `Graphify: Rebuilding...`, icon: '🔄' });

      const res = await cliService.exec([targetPath, ...flags]);
      cliService.refreshStatus();

      if (res.ok) {
        cmd.showEntry?.('graphify_result', {
          title: `Update Successful (${targetPath})`,
          content: res.output || 'Graph updated successfully.',
          type: 'build',
        });
        const g = cliService.getGraphData();
        const n = g && Array.isArray(g.nodes) ? g.nodes.filter(isDomainNode).length : 0;
        const e = g && Array.isArray(g.edges) ? g.edges.length : 0;
        cmd.ui.notify?.(`✅ Graphify: Graph updated — ${n} domain nodes, ${e} edges.`);
        return { message: `🔄 Graphify: Graph updated — ${n} domain nodes, ${e} edges.` };
      } else {
        cmd.showEntry?.('graphify_result', {
          title: `Update Failed (${targetPath})`,
          content: res.error || 'Update failed.',
          type: 'build',
        });
        return { message: `⚠ Graphify update failed: ${(res.error || '').split('\n')[0]}` };
      }
    },
  });

  // /graphify-clean
  cmd.addCommand({
    name: 'graphify-clean',
    description: 'Delete graphify-out/ and reset graph state',
    handler: async () => {
      const success = cliService.cleanOutDir();
      cliService.refreshStatus();
      if (success) {
        cmd.showEntry?.('graphify_result', {
          title: 'Cache Cleared',
          content: '🗑️ Successfully removed graphify-out/ cache directory.',
          type: 'build',
        });
        cmd.ui.notify?.('🗑️ Graphify: Cache cleared.');
        return { message: '🗑️ Graphify: Cache cleared.' };
      } else {
        return { message: '⚠ Graphify: Failed to clean cache.' };
      }
    },
  });

  // /graphify-query <question>
  cmd.addCommand({
    name: 'graphify-query',
    description: 'Query the knowledge graph — the AI will synthesize the result',
    handler: async (contextInput?: unknown) => {
      const question = extractArgsString(contextInput);
      if (!question || !question.trim()) {
        return { message: '⚠ Usage: /graphify-query <question>' };
      }
      const queryStr = question.trim();

      // Instant visual feedback in feed
      cmd.showEntry?.('graphify_result', {
        title: `Query: ${queryStr}`,
        content: `🔍 Querying Graphify knowledge graph for "${queryStr}"...`,
        type: 'query',
      });
      cmd.ui.notify?.(`🔍 Graphify: Querying graph for "${queryStr}"...`);
      cmd.ui.setStatus?.({ text: `Graphify: Querying...`, icon: '🔍' });

      const res = await cliService.exec(['query', queryStr]);
      cliService.refreshStatus();

      if (res.ok) {
        const stats = extractTraversalStats(res.output || '');
        cmd.ui.notify?.(stats
          ? `🕸️ Graph traversal: ${stats} — sending to AI for synthesis...`
          : `🕸️ Graph queried — sending to AI for synthesis...`
        );
        return {
          prompt: `The user asked: "${queryStr}"\n\nBelow is the Graphify knowledge graph subgraph result (traversed from graphify-out/graph.json). Analyze the nodes, edges, and relationships to provide a clear, structured answer to the user's question. Focus on architecture, data flow, and key dependencies:\n\n${res.output}`,
        };
      }
      return { message: `⚠ Graphify query failed: ${(res.error || '').split('\n')[0]}` };
    },
  });

  // /graphify-explain <concept>
  cmd.addCommand({
    name: 'graphify-explain',
    description: 'Explain a symbol, class, or concept — the AI will provide a synthesis',
    handler: async (contextInput?: unknown) => {
      const concept = extractArgsString(contextInput);
      if (!concept || !concept.trim()) {
        return { message: '⚠ Usage: /graphify-explain <concept>' };
      }
      const targetConcept = concept.trim();

      cmd.showEntry?.('graphify_result', {
        title: `Explain: ${targetConcept}`,
        content: `💡 Fetching connections for symbol "${targetConcept}"...`,
        type: 'explain',
      });
      cmd.ui.notify?.(`🔍 Graphify: Looking up "${targetConcept}" in graph...`);
      cmd.ui.setStatus?.({ text: `Graphify: Explaining...`, icon: '🔍' });

      const res = await cliService.exec(['explain', targetConcept]);
      cliService.refreshStatus();

      if (res.ok) {
        const stats = extractTraversalStats(res.output || '');
        cmd.ui.notify?.(stats
          ? `🕸️ Graph: ${stats} for "${targetConcept}" — sending to AI...`
          : `🕸️ Graph: Found "${targetConcept}" — sending to AI...`
        );
        return {
          prompt: `The user wants to understand the symbol/concept "${targetConcept}".\n\nBelow is the Graphify knowledge graph data (from graphify-out/graph.json) showing its connections, imports, calls, and relationships. Provide a clear explanation of what this symbol does, how it connects to the rest of the codebase, and its role in the architecture:\n\n${res.output}`,
        };
      }
      return { message: `⚠ Graphify explain failed: ${(res.error || '').split('\n')[0]}` };
    },
  });

  // /graphify-path <conceptA> <conceptB>
  cmd.addCommand({
    name: 'graphify-path',
    description: 'Trace the shortest path between two concepts — the AI will explain the chain',
    handler: async (contextInput?: unknown) => {
      const argsStr = extractArgsString(contextInput);
      const parts = argsStr.trim().split(/\s+/);
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        return { message: '⚠ Usage: /graphify-path <conceptA> <conceptB>' };
      }
      const [conceptA, conceptB] = parts;

      cmd.showEntry?.('graphify_result', {
        title: `Path: ${conceptA} --> ${conceptB}`,
        content: `🛤️ Tracing shortest relationship path between "${conceptA}" and "${conceptB}"...`,
        type: 'path',
      });
      cmd.ui.notify?.(`🔍 Graphify: Tracing path in graph: ${conceptA} → ${conceptB}...`);
      cmd.ui.setStatus?.({ text: `Graphify: Tracing path...`, icon: '🔍' });

      const res = await cliService.exec(['path', conceptA, conceptB]);
      cliService.refreshStatus();

      if (res.ok) {
        cmd.ui.notify?.(`🕸️ Graph path found — sending to AI for explanation...`);
        return {
          prompt: `The user wants to understand the dependency chain between "${conceptA}" and "${conceptB}".\n\nBelow is the Graphify shortest path result (from graphify-out/graph.json). Explain each step in the chain and what connects these two symbols:\n\n${res.output}`,
        };
      }
      return { message: `⚠ Graphify path failed: ${(res.error || '').split('\n')[0]}` };
    },
  });

  // /graphify-open
  cmd.addCommand({
    name: 'graphify-open',
    description: 'Open the interactive visual graph in your browser',
    handler: async () => {
      const htmlPath = cliService.getOutFilePath('graph.html');
      if (!fs.existsSync(htmlPath)) {
        return { message: '⚠ Graphify: No graph.html yet. Run /graphify first.' };
      }
      const success = await cliService.openInBrowser(htmlPath);
      return { message: success ? `🌐 Graphify: Opened graph.html in browser.` : `🌐 Graphify: file://${htmlPath}` };
    },
  });

  // /graphify-report
  cmd.addCommand({
    name: 'graphify-report',
    description: 'Show the architectural summary report (GRAPH_REPORT.md)',
    handler: async () => {
      const reportPath = cliService.getOutFilePath('GRAPH_REPORT.md');
      try {
        const stat = fs.statSync(reportPath);
        if (stat.size > MAX_REPORT_SIZE_BYTES) {
          return { message: `⚠ Graphify: GRAPH_REPORT.md too large (${(stat.size / 1024 / 1024).toFixed(1)} MB).` };
        }
        const reportContent = fs.readFileSync(reportPath, 'utf-8');
        cmd.showEntry?.('graphify_result', {
          title: 'Architectural Report',
          content: reportContent,
          type: 'report',
        });
        cmd.ui.notify?.('📊 Graphify: Loading architectural report from graph...');
        return {
          prompt: `The user requested the Graphify architectural report (generated from graphify-out/graph.json). Present the following report in a clean, structured format:\n\n${reportContent}`,
        };
      } catch (e: unknown) {
        return { message: `⚠ Graphify: GRAPH_REPORT.md not available: ${getErrorMessage(e)}` };
      }
    },
  });

  // /graphify-nodes [filter]
  cmd.addCommand({
    name: 'graphify-nodes',
    description: 'List top connected domain nodes or filter by keyword',
    handler: async (contextInput?: unknown) => {
      const filter = extractArgsString(contextInput);
      const graphData = cliService.getGraphData();
      if (!graphData || !Array.isArray(graphData.nodes) || graphData.nodes.length === 0) {
        return { message: '⚠ Graphify: No graph data. Run /graphify first.' };
      }
      let nodes = graphData.nodes.filter(isDomainNode);
      const term = (filter || '').trim().toLowerCase();
      if (term) {
        nodes = nodes.filter(
          (n) =>
            (n.id && n.id.toLowerCase().includes(term)) ||
            (n.label && n.label.toLowerCase().includes(term)) ||
            (n.source && n.source.toLowerCase().includes(term)) ||
            (n.source_file && n.source_file.toLowerCase().includes(term))
        );
      }

      nodes = [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0)).slice(0, 30);

      const formatted = nodes
        .map(
          (n) =>
            `• ${n.id} [${n.type || 'concept'}] (deg: ${n.degree || 0}${
              n.community !== undefined ? `, c${n.community}` : ''
            })${n.source || n.source_file ? ` @ ${n.source || n.source_file}` : ''}`
        )
        .join('\n');

      const header = term ? `Domain nodes matching '${term}'` : `Top ${nodes.length} most connected domain nodes`;
      cmd.showEntry?.('graphify_result', {
        title: header,
        content: formatted,
        type: 'nodes',
      });
      cmd.ui.notify?.(`🕸️ Graphify: Filtered ${nodes.length} domain nodes from graph.json`);
      return {
        prompt: `The user wants to see domain graph nodes${term ? ` matching "${term}"` : ''} (data from graphify-out/graph.json). Present the following list clearly:\n\n${header}:\n${formatted}`,
      };
    },
  });

  // /graphify-tree
  cmd.addCommand({
    name: 'graphify-tree',
    description: 'Generate a D3 collapsible tree HTML visualization and open it',
    handler: async () => {
      cmd.showEntry?.('graphify_result', {
        title: 'Generating D3 Tree',
        content: '🌳 Generating collapsible D3 tree visualization...',
        type: 'build',
      });
      cmd.ui.notify?.('🌳 Graphify: Generating collapsible tree...');
      cmd.ui.setStatus?.({ text: 'Graphify: Building tree...', icon: '🌳' });

      const res = await cliService.exec(['tree']);
      cliService.refreshStatus();

      if (res.ok) {
        const treePath = cliService.getOutFilePath('GRAPH_TREE.html');
        if (fs.existsSync(treePath)) {
          await cliService.openInBrowser(treePath);
          cmd.ui.notify?.('🌳 Graphify: Tree opened in browser.');
          return { message: '🌳 Graphify: Collapsible tree generated and opened in browser.' };
        }
        return { message: '🌳 Graphify: Tree generated in graphify-out/GRAPH_TREE.html.' };
      }
      return { message: `⚠ Graphify tree failed: ${(res.error || '').split('\n')[0]}` };
    },
  });

  // /graphify-callflow
  cmd.addCommand({
    name: 'graphify-callflow',
    description: 'Generate a Mermaid architecture/call-flow HTML diagram and open it',
    handler: async () => {
      cmd.showEntry?.('graphify_result', {
        title: 'Generating Call-Flow',
        content: '📊 Generating Mermaid architecture & call-flow diagram...',
        type: 'build',
      });
      cmd.ui.notify?.('📊 Graphify: Generating call-flow diagram...');
      cmd.ui.setStatus?.({ text: 'Graphify: Building call-flow...', icon: '📊' });

      const res = await cliService.exec(['export', 'callflow-html']);
      cliService.refreshStatus();

      if (res.ok) {
        const outDir = cliService.getOutDir();
        try {
          const files = fs.readdirSync(outDir).filter((f: string) => f.includes('callflow') && f.endsWith('.html'));
          if (files.length > 0) {
            const callflowPath = cliService.getOutFilePath(files[0]);
            await cliService.openInBrowser(callflowPath);
            cmd.ui.notify?.('📊 Graphify: Call-flow diagram opened in browser.');
            return { message: `📊 Graphify: Call-flow diagram generated and opened (${files[0]}).` };
          }
        } catch {
          // Ignore
        }
        return { message: '📊 Graphify: Call-flow diagram generated in graphify-out/.' };
      }
      return { message: `⚠ Graphify call-flow failed: ${(res.error || '').split('\n')[0]}` };
    },
  });

  // /graphify-god-nodes [--top N]
  cmd.addCommand({
    name: 'graphify-god-nodes',
    description: 'List the most connected architectural hub nodes (god-nodes)',
    handler: async (contextInput?: unknown) => {
      const argsStr = extractArgsString(contextInput).trim();
      let topN = '15';
      const topMatch = argsStr.match(/(?:--top\s+)?(\d+)/);
      if (topMatch) topN = topMatch[1];

      cmd.showEntry?.('graphify_result', {
        title: `Finding Top ${topN} God-Nodes`,
        content: `🏛️ Calculating top ${topN} architectural hub nodes (god-nodes)...`,
        type: 'nodes',
      });
      cmd.ui.notify?.(`🏛️ Graphify: Finding top ${topN} god-nodes...`);

      const res = await cliService.exec(['god-nodes', '--top', topN]);
      cliService.refreshStatus();

      if (res.ok) {
        cmd.ui.notify?.(`🏛️ Graphify: Found god-nodes from graph.json.`);
        return {
          prompt: `The user wants to see the most connected architectural hub nodes ("god-nodes") in their codebase. Present the following Graphify god-nodes analysis clearly, highlighting which files are the most critical:\n\n${res.output}`,
        };
      }
      return { message: `⚠ Graphify god-nodes failed: ${(res.error || '').split('\n')[0]}` };
    },
  });

  // /graphify-wiki
  cmd.addCommand({
    name: 'graphify-wiki',
    description: 'Generate a structured Markdown wiki from the knowledge graph, organized by communities',
    handler: async () => {
      const graphData = cliService.getGraphData();
      if (!graphData || !Array.isArray(graphData.nodes) || graphData.nodes.length === 0) {
        return { message: '⚠ Graphify: No graph data. Run /graphify first.' };
      }

      cmd.showEntry?.('graphify_result', {
        title: 'Generating Wiki',
        content: '📝 Generating structured Markdown wiki (WIKI.md) by communities...',
        type: 'report',
      });
      cmd.ui.notify?.('📝 Graphify: Generating wiki from graph.json...');

      const domainNodes = graphData.nodes.filter(isDomainNode);

      const communities = new Map<string, typeof graphData.nodes>();
      for (const node of domainNodes) {
        const communityKey = node.community !== undefined ? String(node.community) : '_uncategorized';
        if (!communities.has(communityKey)) {
          communities.set(communityKey, []);
        }
        communities.get(communityKey)!.push(node);
      }

      const sortedCommunities = [...communities.entries()]
        .sort((a, b) => b[1].length - a[1].length);

      const lines: string[] = [];
      lines.push(`# 🕸️ Codebase Knowledge Wiki`);
      lines.push(``);
      lines.push(`> Auto-generated from \`graphify-out/graph.json\` — ${domainNodes.length} domain nodes, ${Array.isArray(graphData.edges) ? graphData.edges.length : 0} edges, ${sortedCommunities.length} communities.`);
      lines.push(``);
      lines.push(`## Table of Contents`);
      lines.push(``);
      for (const [communityKey, nodes] of sortedCommunities) {
        const label = communityKey === '_uncategorized' ? 'Uncategorized' : communityKey;
        lines.push(`- [${label}](#${(label || '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}) (${nodes.length} nodes)`);
      }
      lines.push(``);
      lines.push(`---`);
      lines.push(``);

      for (const [communityKey, nodes] of sortedCommunities) {
        const label = communityKey === '_uncategorized' ? 'Uncategorized' : communityKey;
        const sorted = [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0));
        const hubNode = sorted[0];

        lines.push(`## ${label}`);
        lines.push(``);
        lines.push(`> **Hub**: \`${hubNode ? hubNode.id : 'N/A'}\` (degree ${hubNode ? hubNode.degree || 0 : 0}) — ${nodes.length} nodes in this community.`);
        lines.push(``);

        const displayNodes = sorted.slice(0, 20);
        lines.push(`| Symbol | Type | Degree | Source |`);
        lines.push(`|:---|:---|:---|:---|`);
        for (const n of displayNodes) {
          lines.push(`| \`${n.id}\` | ${n.type || 'concept'} | ${n.degree || 0} | ${n.source || n.source_file || '—'} |`);
        }
        if (nodes.length > 20) {
          lines.push(`| ... | | | *(${nodes.length - 20} more nodes)* |`);
        }
        lines.push(``);
      }

      const wikiContent = lines.join('\n');
      const wikiPath = cliService.getOutFilePath('WIKI.md');
      try {
        fs.writeFileSync(wikiPath, wikiContent, 'utf-8');
        cmd.ui.notify?.(`📝 Graphify: Wiki generated (${sortedCommunities.length} communities) → graphify-out/WIKI.md`);
        return {
          message: `📝 Graphify: Wiki generated — ${sortedCommunities.length} communities, ${domainNodes.length} domain nodes → graphify-out/WIKI.md`,
        };
      } catch (e: unknown) {
        return { message: `⚠ Graphify wiki write failed: ${getErrorMessage(e)}` };
      }
    },
  });
}
