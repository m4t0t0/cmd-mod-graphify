import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { enhanceHtml } from '../enhance.ts';

const FIXTURES = path.resolve(import.meta.dirname ?? __dirname, '../../example-demo/graphify-out');
const TMP = path.resolve(import.meta.dirname ?? __dirname, '../../.test-tmp');

function setup() {
  fs.mkdirSync(TMP, { recursive: true });
}

function teardown() {
  fs.rmSync(TMP, { recursive: true, force: true });
}

function copyFixture(name: string): string {
  const src = path.join(FIXTURES, name);
  const dst = path.join(TMP, name);
  let content = fs.readFileSync(src, 'utf-8');
  // Strip any existing enhancement so tests always start from clean state
  content = content.replace(/\n<style id="graphify-enhance">[\s\S]*?<\/style>\n/g, '\n');
  content = content.replace(/\n<script>\n\(function\(\)\{[\s\S]*?\}\)\(\);\n<\/script>\n/g, '\n');
  fs.writeFileSync(dst, content, 'utf-8');
  return dst;
}

describe('enhanceHtml', () => {
  beforeEach(setup);
  afterEach(teardown);

  describe('variant detection', () => {
    it('detects GRAPH_TREE.html as tree variant', () => {
      const fp = copyFixture('GRAPH_TREE.html');
      const result = enhanceHtml(fp);
      assert.equal(result, true);
      const content = fs.readFileSync(fp, 'utf-8');
      assert.ok(content.includes('Dark theme override'), 'should inject tree dark theme CSS');
    });

    it('detects callflow HTML as callflow variant', () => {
      const fp = copyFixture('example-demo-callflow.html');
      const result = enhanceHtml(fp);
      assert.equal(result, true);
      const content = fs.readFileSync(fp, 'utf-8');
      assert.ok(content.includes('graphifyFadeIn'), 'should inject callflow animation CSS');
      assert.ok(content.includes('IntersectionObserver'), 'should inject scroll reveal JS');
    });

    it('detects graph.html as graph variant', () => {
      const fp = copyFixture('graph.html');
      const result = enhanceHtml(fp);
      assert.equal(result, true);
      const content = fs.readFileSync(fp, 'utf-8');
      assert.ok(content.includes('graphifySlideIn'), 'should inject graph sidebar animation CSS');
    });
  });

  describe('injection correctness', () => {
    it('injects CSS before </head>', () => {
      const fp = copyFixture('GRAPH_TREE.html');
      enhanceHtml(fp);
      const content = fs.readFileSync(fp, 'utf-8');
      const markerIdx = content.indexOf('id="graphify-enhance"');
      const headCloseIdx = content.indexOf('</head>');
      assert.ok(markerIdx > 0, 'marker should exist');
      assert.ok(markerIdx < headCloseIdx, 'marker should be before </head>');
    });

    it('preserves original HTML content', () => {
      const fp = copyFixture('GRAPH_TREE.html');
      const original = fs.readFileSync(fp, 'utf-8');
      enhanceHtml(fp);
      const enhanced = fs.readFileSync(fp, 'utf-8');
      // Original content should still be present
      assert.ok(enhanced.includes('tree-svg'), 'should preserve SVG element');
      assert.ok(enhanced.includes('d3.v7'), 'should preserve D3 script');
      assert.ok(enhanced.includes('Expand All'), 'should preserve buttons');
      // Enhanced should be larger
      assert.ok(enhanced.length > original.length, 'enhanced file should be larger');
    });

    it('preserves callflow Mermaid script', () => {
      const fp = copyFixture('example-demo-callflow.html');
      enhanceHtml(fp);
      const content = fs.readFileSync(fp, 'utf-8');
      assert.ok(content.includes('mermaid.min.js'), 'should preserve Mermaid CDN script');
      assert.ok(content.includes('mermaid.init'), 'should preserve Mermaid init');
    });

    it('preserves graph vis-network script', () => {
      const fp = copyFixture('graph.html');
      enhanceHtml(fp);
      const content = fs.readFileSync(fp, 'utf-8');
      assert.ok(content.includes('vis-network'), 'should preserve vis-network script');
      assert.ok(content.includes('RAW_NODES'), 'should preserve node data');
    });
  });

  describe('idempotency', () => {
    it('skips already enhanced files', () => {
      const fp = copyFixture('GRAPH_TREE.html');
      const first = enhanceHtml(fp);
      assert.equal(first, true);
      const sizeAfterFirst = fs.statSync(fp).size;

      const second = enhanceHtml(fp);
      assert.equal(second, false, 'second call should return false');
      const sizeAfterSecond = fs.statSync(fp).size;
      assert.equal(sizeAfterSecond, sizeAfterFirst, 'file size should not change on second call');
    });

    it('injects enhancement marker exactly once', () => {
      const fp = copyFixture('GRAPH_TREE.html');
      enhanceHtml(fp);
      enhanceHtml(fp); // no-op
      enhanceHtml(fp); // no-op
      const content = fs.readFileSync(fp, 'utf-8');
      const matches = content.match(/id="graphify-enhance"/g);
      assert.equal(matches?.length, 1, 'marker should appear exactly once');
    });
  });

  describe('edge cases', () => {
    it('returns false for non-existent file', () => {
      const result = enhanceHtml(path.join(TMP, 'does-not-exist.html'));
      assert.equal(result, false);
    });

    it('returns false for file without </head>', () => {
      const fp = path.join(TMP, 'no-head.html');
      fs.writeFileSync(fp, '<html><body>hello</body></html>');
      const result = enhanceHtml(fp);
      assert.equal(result, false);
    });

    it('returns false for unrecognized HTML', () => {
      const fp = path.join(TMP, 'unknown.html');
      fs.writeFileSync(fp, '<html><head><title>test</title></head><body>hello</body></html>');
      const result = enhanceHtml(fp);
      assert.equal(result, false);
    });

    it('returns false for empty file', () => {
      const fp = path.join(TMP, 'empty.html');
      fs.writeFileSync(fp, '');
      const result = enhanceHtml(fp);
      assert.equal(result, false);
    });

    it('detects tree by d3.v7 content when filename is generic', () => {
      const fp = path.join(TMP, 'custom.html');
      let treeSrc = fs.readFileSync(path.join(FIXTURES, 'GRAPH_TREE.html'), 'utf-8');
      treeSrc = treeSrc.replace(/\n<style id="graphify-enhance">[\s\S]*?<\/style>\n/g, '\n');
      fs.writeFileSync(fp, treeSrc);
      const result = enhanceHtml(fp);
      assert.equal(result, true);
    });

    it('detects callflow by mermaid content when filename is generic', () => {
      const fp = path.join(TMP, 'custom.html');
      let callflowSrc = fs.readFileSync(path.join(FIXTURES, 'example-demo-callflow.html'), 'utf-8');
      callflowSrc = callflowSrc.replace(/\n<style id="graphify-enhance">[\s\S]*?<\/style>\n/g, '\n');
      callflowSrc = callflowSrc.replace(/\n<script>\n\(function\(\)\{[\s\S]*?\}\)\(\);\n<\/script>\n/g, '\n');
      fs.writeFileSync(fp, callflowSrc);
      const result = enhanceHtml(fp);
      assert.equal(result, true);
    });

    it('detects graph by vis-network content when filename is generic', () => {
      const fp = path.join(TMP, 'custom.html');
      let graphSrc = fs.readFileSync(path.join(FIXTURES, 'graph.html'), 'utf-8');
      graphSrc = graphSrc.replace(/\n<style id="graphify-enhance">[\s\S]*?<\/style>\n/g, '\n');
      fs.writeFileSync(fp, graphSrc);
      const result = enhanceHtml(fp);
      assert.equal(result, true);
    });
  });

  describe('CSS content validation', () => {
    it('tree enhancement includes dark theme colors', () => {
      const fp = copyFixture('GRAPH_TREE.html');
      enhanceHtml(fp);
      const css = fs.readFileSync(fp, 'utf-8');
      assert.ok(css.includes('#0f172a'), 'should use dark background color');
      assert.ok(css.includes('#38bdf8'), 'should use accent color');
      assert.ok(css.includes('drop-shadow'), 'should have hover glow effect');
    });

    it('callflow enhancement includes scroll reveal', () => {
      const fp = copyFixture('example-demo-callflow.html');
      enhanceHtml(fp);
      const content = fs.readFileSync(fp, 'utf-8');
      assert.ok(content.includes('IntersectionObserver'), 'should have scroll observer');
      assert.ok(content.includes('.reveal'), 'should have reveal class');
    });

    it('graph enhancement includes sidebar animation', () => {
      const fp = copyFixture('graph.html');
      enhanceHtml(fp);
      const css = fs.readFileSync(fp, 'utf-8');
      assert.ok(css.includes('graphifySlideIn'), 'should have sidebar slide animation');
      assert.ok(css.includes('#38bdf8'), 'should use accent color for focus');
    });
  });
});
