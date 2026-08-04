import type { ModApi } from '@commandcode/harness';
import { GraphifyCliService } from './cli';
import { isDomainNode } from './types';

/**
 * Register lifecycle hooks and shortcut transformers with strict CommandCode Hooks API compliance
 */
export function registerLifecycleHooks(cmd: ModApi, cliService: GraphifyCliService) {
  cmd.hooks({
    // Input shortcut transformer: "@graph <query>" or "@explain <symbol>"
    transformInput: async (input: string) => {
      const trimmed = (input || '').trim();
      if (trimmed.startsWith('@graph ')) {
        const query = trimmed.substring(7).trim();
        if (!query) return undefined;
        return {
          userPrompt: `Use graphify_query tool to find graph relationships for: "${query}", then answer the prompt.`,
        };
      }
      if (trimmed.startsWith('@explain ')) {
        const concept = trimmed.substring(9).trim();
        if (!concept) return undefined;
        return {
          userPrompt: `Use graphify_explain tool to analyze symbol "${concept}" and explain its connections.`,
        };
      }
      return undefined;
    },

    // Dynamic System Prompt Enrichment Hook
    appendSystemPrompt: async () => {
      const graphData = cliService.getGraphData();
      if (graphData && Array.isArray(graphData.nodes) && graphData.nodes.length > 0) {
        const domainNodes = graphData.nodes.filter(isDomainNode);
        const topNodes = [...domainNodes]
          .sort((a, b) => (b.degree || 0) - (a.degree || 0))
          .slice(0, 10)
          .map((n) => n.id)
          .join(', ');

        const edgeCount = Array.isArray(graphData.edges) ? graphData.edges.length : 0;

        return (
          `\n[Graphify Knowledge Graph Active]\n` +
          `A Graphify knowledge graph is active for this repository (${domainNodes.length} domain nodes, ${edgeCount} edges).\n` +
          `Top central architectural hubs: ${topNodes || 'N/A'}\n` +
          `You MUST use tools 'graphify_query', 'graphify_explain', 'graphify_path', and 'graphify_list_nodes' to inspect codebase relationships and architecture instead of searching manually.`
        );
      }
      return undefined;
    },

    // Session Start initialization hook
    onSessionStart: async () => {
      cliService.refreshStatus();
      const autoBuild = cmd.getFlag?.('auto-build');
      const graphData = cliService.getGraphData();
      if (!graphData && autoBuild) {
        cmd.ui.notify?.('Auto-building Graphify knowledge graph on session start...');
        await cliService.exec(['.']);
        cliService.refreshStatus();
      }
    },
  });
}
