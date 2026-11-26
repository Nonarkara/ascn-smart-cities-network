// The reading measure, stated once, in units that mean the same thing in
// every script.
//
// The anti-slop law gives the measure in characters: 45–75, ideally 60–70.
// A character count is a Latin calibration. Measured on this site at 1440px:
//
//   Latin   64 characters per line (median), 71 at the worst
//   Thai    50 characters per line (median), 67 at the worst
//   Han     38 characters per line (median), 60 at the worst
//
// The three medians are one measure: about 27em of line in each script. A
// Thai line of 75 characters is 40em — longer than the English rule allows
// in Latin letters — and a Chinese line of 75 characters is 75em, nearly
// three measures wide. So the character ceiling cannot police the Thai and
// Chinese pages: a Chinese paragraph that had lost its measure column would
// read as 68 characters, sail under a 75-character ceiling, and run three
// measures wide.
//
// The width does not lie in any script. The design already states the widest
// legitimate prose column as a token — `--measure-paper-a5: 410px`, the A5
// text block — and the body size as `--t-body: 13px`. So the ceiling is
// derived from the design itself: 410 / 13 = 31.54em. No line of prose, in
// any language, may exceed it. Measured over 1,000 prose blocks in three
// languages the widest line is 30.5em, inside the block the design allows.
//
// The character ceiling stays for Latin, where it is the law's own number.
export const READING_CEILING_CHARS = 75;

// The widest prose column the design allows, expressed in em. Read from the
// page's own tokens so the rule follows the design if the tokens move.
export async function paperCeilingEm(page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const px = (value) => {
      const m = /(-?[0-9.]+)px/.exec(value || "");
      return m ? parseFloat(m[1]) : null;
    };
    const paper = px(root.getPropertyValue("--measure-paper-a5"));
    const body = px(root.getPropertyValue("--t-body"));
    if (!paper || !body) return null;
    return paper / body;
  });
}

// What a measured line breaks. A line may be too long in characters (the
// Latin ceiling) or too wide in em (the script-neutral ceiling). Both are
// reported; a line that breaks both is reported once, with both numbers.
export function measureOffenders(found, ceilingEm) {
  const offenders = [];
  for (const f of found) {
    const overChars = f.chars > READING_CEILING_CHARS;
    const overEm = ceilingEm ? f.em > ceilingEm : false;
    if (!overChars && !overEm) continue;
    offenders.push({
      ...f,
      overChars,
      overEm,
      why: [overChars ? `${f.chars} characters` : null, overEm ? `${f.em}em` : null]
        .filter(Boolean).join(", "),
    });
  }
  return offenders;
}
