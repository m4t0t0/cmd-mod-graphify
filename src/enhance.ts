import * as fs from 'fs';

type HtmlVariant = 'tree' | 'callflow' | 'graph';

/**
 * Dark theme and animation overrides for the D3 collapsible tree.
 * Converts the light-themed GRAPH_TREE.html to dark, adds hover glow and entrance animation.
 * Preserves the original node color palette (semantically meaningful per community).
 */
const TREE_CSS = `
<style id="graphify-enhance">
  /* Dark theme override */
  body { background: #0f172a !important; color: #e2e8f0 !important; }
  h1 { color: #38bdf8 !important; }
  .controls { margin-top: 16px; }
  button {
    background: #1e293b !important; color: #e2e8f0 !important;
    border: 1px solid #334155 !important; border-radius: 6px !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
    transition: border-color 0.2s, box-shadow 0.2s !important;
  }
  button:hover { border-color: #38bdf8 !important; box-shadow: 0 0 12px rgba(56,189,248,0.25) !important; }
  button:active { background: #0f172a !important; }
  #tree-container {
    background: #1e293b !important; border: 1px solid #334155 !important;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4) !important;
  }
  svg { background: #1e293b !important; }

  /* Fix text halo: original white halo (stroke: #fff) blurs on dark bg.
     Replace with dark halo so text stays crisp. */
  .node text {
    stroke: #1e293b !important;
    stroke-width: 3px !important;
    stroke-opacity: 0.9 !important;
    paint-order: stroke fill !important;
  }

  /* Node text colors: name in light gray, count (bold) in accent blue.
     Override the JS-set inline colors (#343a40 / #0056b3) which were for light bg. */
  .node text tspan { fill: #e2e8f0 !important; }
  .node text tspan[style*="bold"] { fill: #38bdf8 !important; }

  /* Links: slightly softer on dark */
  .link { stroke-opacity: 0.55 !important; }

  /* Node hover glow — only on circle, preserves fill colors */
  .node circle { transition: filter 0.2s; }
  .node:hover circle { filter: drop-shadow(0 0 8px rgba(56,189,248,0.7)); }

  /* Entrance animation */
  @keyframes graphifyFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  h1 { animation: graphifyFadeIn 0.4s ease-out; }
  .controls { animation: graphifyFadeIn 0.4s ease-out 0.1s both; }
  #tree-container { animation: graphifyFadeIn 0.5s ease-out 0.2s both; }
</style>`;

/**
 * Scroll-triggered fade-in and hover effects for the Mermaid callflow.
 * The callflow already has a solid dark theme, so we add motion and interaction polish.
 */
const CALLFLOW_CSS = `
<style id="graphify-enhance">
  /* Entrance animation for page sections */
  @keyframes graphifyFadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  h1 { animation: graphifyFadeIn 0.4s ease-out; }
  .subtitle { animation: graphifyFadeIn 0.4s ease-out 0.1s both; }
  .nav { animation: graphifyFadeIn 0.4s ease-out 0.15s both; }

  /* Mermaid diagram containers: hover glow */
  .mermaid {
    transition: border-color 0.3s, box-shadow 0.3s !important;
  }
  .mermaid:hover {
    border-color: #38bdf8 !important;
    box-shadow: 0 0 20px rgba(56,189,248,0.12) !important;
  }

  /* Cards: hover lift */
  .card {
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s !important;
  }
  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
    border-color: #38bdf8 !important;
  }

  /* Table row hover */
  .call-table tr { transition: background 0.15s; }
  .call-table tr:hover { background: rgba(56,189,248,0.06) !important; }

  /* Scroll-triggered reveal for h2, h3, mermaid, card, grid */
  .reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.5s ease-out, transform 0.5s ease-out; }
  .reveal.is-visible { opacity: 1; transform: translateY(0); }
</style>
<script>
(function() {
  // Mark elements for scroll reveal
  document.querySelectorAll('h2, h3, .mermaid, .card, .grid, .arrow-chain').forEach(el => {
    el.classList.add('reveal');
  });
  // IntersectionObserver for scroll-triggered fade-in
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
})();
</script>`;

/**
 * Entrance animation and interaction polish for the vis-network graph.
 * The graph already has a dark theme. Node/edge colors are semantically meaningful
 * (community colors, relationship types) — we do NOT touch them.
 * Only sidebar, search, and entrance animations are affected.
 */
const GRAPH_CSS = `
<style id="graphify-enhance">
  /* Entrance animation — sidebar only, graph canvas untouched */
  @keyframes graphifySlideIn {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  #sidebar { animation: graphifySlideIn 0.4s ease-out 0.15s both; }

  /* Sidebar border polish */
  #sidebar { border-left-color: #334155 !important; }
  #search:focus { border-color: #38bdf8 !important; box-shadow: 0 0 8px rgba(56,189,248,0.2); }
  .search-item:hover { background: #334155 !important; }
  .neighbor-link { transition: background 0.15s; }
  .neighbor-link:hover { background: #334155 !important; }

  /* Legend items hover */
  .legend-item { transition: background 0.15s, padding-left 0.15s; }

  /* Stats bar */
  #stats { color: #64748b !important; }
</style>`;

const ENHANCEMENTS: Record<HtmlVariant, string> = {
  tree: TREE_CSS,
  callflow: CALLFLOW_CSS,
  graph: GRAPH_CSS,
};

/**
 * Detect the HTML variant from file content.
 */
function detectVariant(content: string, filePath: string): HtmlVariant | null {
  if (filePath.includes('callflow')) return 'callflow';
  if (filePath.includes('GRAPH_TREE')) return 'tree';
  if (filePath.includes('graph.html')) return 'graph';
  if (content.includes('d3.v7') || content.includes('tree-svg')) return 'tree';
  if (content.includes('mermaid')) return 'callflow';
  if (content.includes('vis-network') || content.includes('vis.DataSet')) return 'graph';
  return null;
}

/**
 * Post-process a generated HTML file to inject dark theme, animations, and hover effects.
 * Safe to call on any HTML: if the variant is not recognized, it does nothing.
 * Idempotent: skips files that already have the enhancement marker.
 */
export function enhanceHtml(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;

    const content = fs.readFileSync(filePath, 'utf-8');

    // Skip if already enhanced
    if (content.includes('id="graphify-enhance"')) return false;

    const variant = detectVariant(content, filePath);
    if (!variant) return false;

    const enhancement = ENHANCEMENTS[variant];

    // Inject before </head>
    const closingHead = '</head>';
    const headIdx = content.lastIndexOf(closingHead);
    if (headIdx === -1) return false;

    const enhanced = content.slice(0, headIdx) + '\n' + enhancement + '\n' + content.slice(headIdx);
    fs.writeFileSync(filePath, enhanced, 'utf-8');
    return true;
  } catch {
    return false;
  }
}
