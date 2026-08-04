import type { ModApi } from '@commandcode/harness';
import * as fs from 'fs';
import { GraphifyCliService } from './cli';
import { getErrorMessage, isDomainNode } from './types';
import { enhanceHtml } from './enhance';

const MAX_REPORT_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB safety cap

/**
 * Register Native AI Model Tools for Graphify (including update & clean)
 */
export function registerAiTools(cmd: ModApi, cliService: GraphifyCliService) {
  // Tool: graphify_build
  cmd.addTool({
    schema: {
      name: 'graphify_build',
      description: 'Build or update the Graphify AST knowledge graph for the repository.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Target directory path to parse (defaults to ".")',
          },
        },
        required: [],
      },
    },
    run: async (input: { path?: string }) => {
      const { targetPath, flags } = cliService.parseInput(input.path);
      const res = await cliService.exec([targetPath, ...flags]);
      if (res.ok) {
        cliService.refreshStatus();
        return {
          ok: true,
          content: [{ type: 'text', text: `Graphify build completed for '${targetPath}':\n${res.output}` }],
        };
      }
      return { ok: false, error: res.error };
    },
  });

  // Tool: graphify_update
  cmd.addTool({
    schema: {
      name: 'graphify_update',
      description: 'Clean cache and force a complete rebuild of the Graphify knowledge graph after code modifications.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Target directory path (defaults to ".")',
          },
        },
        required: [],
      },
    },
    run: async (input: { path?: string }) => {
      const { targetPath, flags } = cliService.parseInput(input.path);
      cliService.cleanOutDir();
      const res = await cliService.exec([targetPath, ...flags]);
      if (res.ok) {
        cliService.refreshStatus();
        return {
          ok: true,
          content: [{ type: 'text', text: `Graphify graph updated for '${targetPath}':\n${res.output}` }],
        };
      }
      return { ok: false, error: res.error };
    },
  });

  // Tool: graphify_query
  cmd.addTool({
    schema: {
      name: 'graphify_query',
      description: 'Query the codebase knowledge graph for relevant subgraphs, relationships, and concepts.',
      readOnly: true,
      input_schema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Natural language question about architecture, relationships, or dependencies.',
          },
        },
        required: ['question'],
      },
    },
    run: async (input: { question: string }) => {
      const res = await cliService.exec(['query', input.question || '']);
      if (res.ok) {
        return { ok: true, content: [{ type: 'text', text: res.output || '' }] };
      }
      return { ok: false, error: res.error };
    },
  });

  // Tool: graphify_explain
  cmd.addTool({
    schema: {
      name: 'graphify_explain',
      description: 'Get detailed call/import/inherits connections for a symbol or concept.',
      readOnly: true,
      input_schema: {
        type: 'object',
        properties: {
          concept: {
            type: 'string',
            description: 'Symbol or concept name to explain.',
          },
        },
        required: ['concept'],
      },
    },
    run: async (input: { concept: string }) => {
      const concept = (input.concept || '').trim();
      if (!concept) {
        return { ok: false, error: 'Missing required parameter: concept. Provide a symbol, class, or function name to explain.' };
      }
      const res = await cliService.exec(['explain', concept]);
      if (res.ok) {
        return { ok: true, content: [{ type: 'text', text: res.output || '' }] };
      }
      return { ok: false, error: res.error };
    },
  });

  // Tool: graphify_path
  cmd.addTool({
    schema: {
      name: 'graphify_path',
      description: 'Find the shortest path of relationships between two symbols in the codebase graph.',
      readOnly: true,
      input_schema: {
        type: 'object',
        properties: {
          concept_a: { type: 'string', description: 'Starting symbol or concept.' },
          concept_b: { type: 'string', description: 'Target symbol or concept.' },
        },
        required: ['concept_a', 'concept_b'],
      },
    },
    run: async (input: { concept_a: string; concept_b: string }) => {
      const res = await cliService.exec(['path', input.concept_a || '', input.concept_b || '']);
      if (res.ok) {
        return { ok: true, content: [{ type: 'text', text: res.output || '' }] };
      }
      return { ok: false, error: res.error };
    },
  });

  // Tool: graphify_list_nodes
  cmd.addTool({
    schema: {
      name: 'graphify_list_nodes',
      description: 'List nodes/symbols from the graph, sorted by connection degree or filtered by keyword.',
      readOnly: true,
      input_schema: {
        type: 'object',
        properties: {
          filter: { type: 'string', description: 'Optional search keyword to filter node IDs or labels' },
          limit: { type: 'number', description: 'Max nodes to return (default: 25, max: 100)' },
        },
        required: [],
      },
    },
    run: async (input: { filter?: string; limit?: number }) => {
      const graphData = cliService.getGraphData();
      if (!graphData || !Array.isArray(graphData.nodes)) {
        return { ok: false, error: 'No graph data found. Run graphify_build tool first.' };
      }
      let nodes = graphData.nodes.filter(isDomainNode);

      if (input.filter) {
        const term = input.filter.toLowerCase().trim();
        nodes = nodes.filter(
          (n) => (n.id && n.id.toLowerCase().includes(term)) || (n.label && n.label.toLowerCase().includes(term))
        );
      }

      const limit = Math.min(Math.max(1, Math.floor(input.limit || 25)), 100);
      const sorted = [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0)).slice(0, limit);
      const text = sorted.map((n) => `- ${n.id} (degree: ${n.degree || 0}, source: ${n.source || 'N/A'})`).join('\n');
      return { ok: true, content: [{ type: 'text', text: text || 'No matching domain nodes found.' }] };
    },
  });

  // Tool: graphify_get_report
  cmd.addTool({
    schema: {
      name: 'graphify_get_report',
      description: 'Fetch the architectural summary report generated by Graphify (GRAPH_REPORT.md).',
      readOnly: true,
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    run: async () => {
      const reportPath = cliService.getOutFilePath('GRAPH_REPORT.md');
      try {
        const stat = fs.statSync(reportPath);
        if (stat.size > MAX_REPORT_SIZE_BYTES) {
          return { ok: false, error: `GRAPH_REPORT.md exceeds safety limit (${(stat.size / 1024 / 1024).toFixed(1)} MB).` };
        }
        const content = fs.readFileSync(reportPath, 'utf-8');
        return { ok: true, content: [{ type: 'text', text: content }] };
      } catch (e: unknown) {
        return { ok: false, error: `graphify-out/GRAPH_REPORT.md not found or unreadable: ${getErrorMessage(e)}` };
      }
    },
  });

  // Tool: graphify_god_nodes
  cmd.addTool({
    schema: {
      name: 'graphify_god_nodes',
      description: 'List the most connected architectural hub nodes (god-nodes) in the codebase graph.',
      readOnly: true,
      input_schema: {
        type: 'object',
        properties: {
          top: { type: 'number', description: 'Number of god-nodes to return (default: 15, max: 50)' },
        },
        required: [],
      },
    },
    run: async (input: { top?: number }) => {
      const topN = String(Math.min(Math.max(1, Math.floor(input.top || 15)), 50));
      const res = await cliService.exec(['god-nodes', '--top', topN]);
      if (res.ok) {
        return { ok: true, content: [{ type: 'text', text: res.output || '' }] };
      }
      return { ok: false, error: res.error };
    },
  });

  // Tool: graphify_tree
  cmd.addTool({
    schema: {
      name: 'graphify_tree',
      description: 'Generate a D3 collapsible tree HTML visualization of the codebase graph.',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    run: async () => {
      const res = await cliService.exec(['tree']);
      if (res.ok) {
        const treePath = cliService.getOutFilePath('GRAPH_TREE.html');
        enhanceHtml(treePath);
        return { ok: true, content: [{ type: 'text', text: `Tree generated at graphify-out/GRAPH_TREE.html\n${res.output || ''}` }] };
      }
      return { ok: false, error: res.error };
    },
  });

  // Tool: graphify_callflow
  cmd.addTool({
    schema: {
      name: 'graphify_callflow',
      description: 'Generate a Mermaid-based architecture/call-flow HTML diagram from the graph.',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    run: async () => {
      const res = await cliService.exec(['export', 'callflow-html']);
      if (res.ok) {
        try {
          const outDir = cliService.getOutDir();
          const files = fs.readdirSync(outDir).filter((f: string) => f.includes('callflow') && f.endsWith('.html'));
          if (files.length > 0) enhanceHtml(cliService.getOutFilePath(files[0]));
        } catch { /* ignore */ }
        return { ok: true, content: [{ type: 'text', text: `Call-flow diagram generated in graphify-out/\n${res.output || ''}` }] };
      }
      return { ok: false, error: res.error };
    },
  });
}
