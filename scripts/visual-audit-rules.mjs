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

// Run in the browser. A hidden view has computed styles but contributes no
// rendered type; counting it made a compact notice fail another page's ramp.
export function renderedTypeSizes() {
  const sizes = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const style = getComputedStyle(el);
    if (el.getClientRects().length && style.visibility !== 'hidden' &&
        el.children.length === 0 && el.textContent.trim() && style.fontSize) sizes.add(style.fontSize);
  }
  return [...sizes];
}

export function undersizedTarget({ width, height }, minimum = 44) {
  return width < minimum - 1 / 64 || height < minimum - 1 / 64;
}

export function mediaCaptionFits({video, caption, figure, band}) {
  const inside = (inner, outer) => inner.width > 0 && inner.height > 0 && inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
  if (!inside(caption, figure) || !inside(video, figure) || !inside(figure, band)) return false;
  const beside = caption.right <= video.left + 1 || caption.left >= video.right - 1;
  const underneath = caption.top >= video.bottom - 1;
  return beside || (underneath && caption.left >= video.left - 1 && caption.right <= video.right + 1);
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

// Run in the page. Count each reading line, with independent column runs.
export function measureRenderedProse(selector) {
  const out = [];
  const segmenter = new Intl.Segmenter(document.documentElement.lang || "en", { granularity: "grapheme" });
  const range = document.createRange();
  // A prose block is a paragraph, a list item, a quote, a caption — or a
  // div whose content is inline text and nothing else. The Research
  // view's Insider FAQ is a stack of divs: the widest prose on the site,
  // 175 characters to a line, and a sweep that selects only p/li/dd/
  // blockquote/figcaption never saw it.
  // A prose block is an element whose text is its OWN: no block-level
  // descendant, and not a row of columns. A flex row's text is its
  // children's text laid out side by side, and measuring the row measures
  // the whole row as one sentence — 139 characters for a strip of four
  // filter labels.
  const isProse = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display.includes("flex") || cs.display.includes("grid")) return false;
    for (const node of el.querySelectorAll("*")) {
      const d = getComputedStyle(node).display;
      if (d === "block" || d === "flex" || d === "grid" || d === "list-item" ||
          d === "table" || d === "table-row" || d === "table-cell") return false;
    }
    return true;
  };
  for (const el of document.querySelectorAll(selector)) {
    if (!isProse(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 200 || r.height < 8) continue;
    if ((el.textContent || "").trim().length < 120) continue; // labels are not prose
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const rows = new Map();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const { segment, index } of segmenter.segment(node.data)) {
        range.setStart(node, index);
        range.setEnd(node, index + segment.length);
        const { top, width, left, right } = range.getBoundingClientRect();
        if (!width) continue;
        const y = Math.round(top);
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push({ left, right, segment });
      }
    }
    // Text in two columns can share a baseline. The gutter separates runs.
    let longest = 0;
    const gap = Number.parseFloat(cs.fontSize);
    for (const row of rows.values()) {
      row.sort((a, b) => a.left - b.left);
      let run = [], right = -Infinity;
      for (const box of row) {
        if (box.left - right > gap && run.length) {
          longest = Math.max(longest, run.length);
          run = [];
        }
        run.push(box.segment);
        right = box.right;
      }
      longest = Math.max(longest, run.length);
    }
    out.push({
      chars: longest,
      sel: el.tagName.toLowerCase() + "." + (el.className || "").toString().split(" ")[0],
      px: Math.round(parseFloat(cs.fontSize)),
    });
  }
  return out;
}
