export const OUTSIDE_PALETTE = new Set(['#0f172a', '#38bdf8', '#0b0f14', '#0a0e14', '#e6edf3', '#f1f5f9']);

export function outsidePalette(css) {
  // --deep is an explicitly documented Axiom ground, not an accidental theme
  // default. Its one declaration is approved; raw uses must still use a token.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--deep\s*:\s*#0a0e14\s*;/gi, '');
  return [...new Set((source.match(/#[0-9a-f]{6}\b/gi) || []).map((value) => value.toLowerCase()).filter((value) => OUTSIDE_PALETTE.has(value)))];
}

export function shorterMeasure(heading, body) {
  const value = (token) => /^\d+(?:\.\d+)?ch$/.test(token.trim()) ? Number.parseFloat(token) : NaN;
  return value(heading) > 0 && value(heading) < value(body);
}

export function undersizedTarget({ width, height }, minimum = 44) {
  return width < minimum - 1 / 64 || height < minimum - 1 / 64;
}

// Run in the page: count graphemes on actual rendered lines, not their average.
export function longestHeadingLine(element) {
  const lines = new Map();
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const segmenter = new Intl.Segmenter(element.ownerDocument.documentElement.lang || 'en', { granularity: 'grapheme' });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const range = element.ownerDocument.createRange();
    for (const part of segmenter.segment(node.textContent || '')) {
      range.setStart(node, part.index); range.setEnd(node, part.index + part.segment.length);
      const box = range.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const top = Math.round(box.top);
      lines.set(top, (lines.get(top) || 0) + 1);
    }
  }
  return Math.max(0, ...lines.values());
}
