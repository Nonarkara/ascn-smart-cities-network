import { escapeHtml as esc, safeUrl } from "./lib/security.mjs";

const TYPES = ["grant", "trip", "mou", "communication", "course"];
const OUTCOMES = ["delivered", "partial", "stalled", "failed"];
const LANGS = ["en", "th", "zh"];
const $ = (selector) => document.querySelector(selector);

const COPY = {
  en: {
    kicker: "Record",
    title: "ASCN, 2018–2026",
    subtitle: "Inbox and public pages",
    medium: "Medium confidence",
    selfReported: "Self-reported",
    pending: "Pending review",
    funding: "Funding",
    fundingLede: "Totals add only cited amounts. A blank line is a figure the cited rows do not state.",
    committed: "Committed",
    disbursed: "Disbursed",
    notPublic: "— not public",
    breakdown: "Full breakdown",
    conflict: "Conflict",
    keptHeading: "Figures kept",
    notAdded: "Not added to the total.",
    either: "Committed and disbursed",
    moneyHeading: "Where the money went",
    moneyLede: "Claims about ASCN are listed open. General aid statistics sit below them and are not ASCN results.",
    generalStats: "General tied-aid statistics. Not specific to ASCN.",
    generalScope: "General. Not specific to ASCN.",
    ascnScope: "ASCN-specific.",
    noFlow: "No cited source in this record describes tied aid or phantom aid.",
    tiedAid: "Tied aid",
    phantomAid: "Phantom aid",
    byType: "By type",
    byYear: "By year",
    types: { grant: "Grant", trip: "Trip", mou: "MOU", communication: "Communication", course: "Course" },
    outcomes: { delivered: "Delivered", partial: "Partial", stalled: "Stalled", failed: "Failed" },
    outcomeHeading: "Outcomes",
    outcomeLede: "Delivered work and work that stalled or failed are listed with the same weight. A partial result is not counted as a success.",
    filterType: "Type",
    filterYear: "Year",
    filterOutcome: "Outcome",
    filterSearch: "Search",
    all: "All",
    columns: { date: "Date", item: "Item", counterpart: "Counterpart", outcome: "Outcome", source: "Source" },
    none: "No items match.",
    noCounterpart: "No external organisation",
    cleared: "Cleared by Non",
    noMou: "No memorandum of understanding is in this record.",
    noAmount: "No grant amount is public.",
    withheld: "Withheld",
    timeline: "Timeline",
    empty: "The archive has no public items yet.",
    loadError: "The archive data could not load.",
    searchLabel: "Search titles and notes",
    amount: "Amount",
    footnote: "Phone numbers, personal addresses and internal correspondence stay out. Counts are not inflated. Where the trail ends, the outcome says so. Medium confidence is labelled on the row. Self-reported means the figure is the organisation’s own account, including ASEAN’s project totals.",
    countLabel: "Showing",
  },
  th: {
    kicker: "บันทึก",
    title: "ASCN, 2018–2026",
    subtitle: "กล่องจดหมายและหน้าสาธารณะ",
    medium: "ความเชื่อมั่นระดับกลาง",
    selfReported: "รายงานเอง",
    pending: "รอการทบทวน",
    funding: "เงินทุน",
    fundingLede: "ยอดรวมบวกเฉพาะจำนวนที่มีแหล่งอ้าง ช่องว่างคือตัวเลขที่แถวที่อ้างไม่ได้ระบุ",
    committed: "ให้คำมั่น",
    disbursed: "จ่ายแล้ว",
    notPublic: "— ไม่เปิดเผย",
    breakdown: "รายการเต็ม",
    conflict: "ข้อขัดแย้ง",
    keptHeading: "ตัวเลขที่คงไว้",
    notAdded: "ไม่นำไปรวมในยอด",
    either: "ให้คำมั่นและจ่ายแล้ว",
    moneyHeading: "เงินไปที่ใด",
    moneyLede: "ข้อที่เกี่ยวกับ ASCN อยู่ในรายการเปิด สถิติความช่วยเหลือทั่วไปอยู่ด้านล่าง และไม่ใช่ผลของ ASCN",
    generalStats: "สถิติความช่วยเหลือแบบผูกพันทั่วไป ไม่ได้เจาะจงที่ ASCN",
    generalScope: "ทั่วไป ไม่ได้เจาะจงที่ ASCN",
    ascnScope: "เฉพาะ ASCN",
    noFlow: "ไม่มีแหล่งที่อ้างในบันทึกนี้ที่บรรยายความช่วยเหลือแบบผูกพันหรือความช่วยเหลือที่ไม่อยู่จริง",
    tiedAid: "ความช่วยเหลือแบบผูกพัน",
    phantomAid: "ความช่วยเหลือที่ไม่อยู่จริง",
    byType: "ตามประเภท",
    byYear: "ตามปี",
    types: { grant: "ทุน", trip: "การเดินทาง", mou: "บันทึกความเข้าใจ", communication: "การสื่อสาร", course: "การอบรม" },
    outcomes: { delivered: "ส่งมอบแล้ว", partial: "ได้บางส่วน", stalled: "หยุดค้าง", failed: "ไม่เกิดผล" },
    outcomeHeading: "ผลลัพธ์",
    outcomeLede: "งานที่ส่งมอบแล้วกับงานที่หยุดค้างหรือไม่เกิดผลอยู่ในรายการเดียวกัน ผลบางส่วนไม่นับเป็นความสำเร็จ",
    filterType: "ประเภท",
    filterYear: "ปี",
    filterOutcome: "ผลลัพธ์",
    filterSearch: "ค้นหา",
    all: "ทั้งหมด",
    columns: { date: "วันที่", item: "รายการ", counterpart: "องค์กรคู่สัญญา", outcome: "ผลลัพธ์", source: "แหล่งที่มา" },
    none: "ไม่มีรายการที่ตรงกัน",
    noCounterpart: "ไม่มีองค์กรภายนอก",
    cleared: "ผ่านการตรวจโดยนนท์",
    noMou: "ไม่มีบันทึกความเข้าใจในชุดข้อมูลนี้",
    noAmount: "ไม่มีจำนวนเงินทุนที่เปิดเผยต่อสาธารณะ",
    withheld: "งดเผยแพร่",
    timeline: "เส้นเวลา",
    empty: "ยังไม่มีรายการสาธารณะ",
    loadError: "โหลดข้อมูลคลังไม่ได้",
    searchLabel: "ค้นชื่อและบันทึก",
    amount: "จำนวนเงิน",
    footnote: "ไม่ใส่หมายเลขโทรศัพท์ ที่อยู่ส่วนบุคคล และหนังสือภายใน จำนวนไม่ได้ถูกทำให้สูงขึ้น เส้นทางจบที่ใด ผลลัพธ์บอกตามนั้น ความเชื่อมั่นระดับกลางถูกกำกับบนแถว รายงานเองหมายถึงตัวเลขจากองค์กรนั้นเอง รวมยอดโครงการของอาเซียน",
    countLabel: "กำลังแสดง",
  },
  zh: {
    kicker: "记录",
    title: "ASCN, 2018–2026",
    subtitle: "收件箱与公开网页",
    medium: "中等可信度",
    selfReported: "自行报告",
    pending: "待审阅",
    funding: "资金",
    fundingLede: "合计只加有出处的金额。空着的一行是所引记录没有写出的数字。",
    committed: "承诺",
    disbursed: "已拨付",
    notPublic: "— 未公开",
    breakdown: "全部分项",
    conflict: "冲突",
    keptHeading: "保留的数字",
    notAdded: "不计入合计。",
    either: "承诺与拨付",
    moneyHeading: "钱去了哪里",
    moneyLede: "关于 ASCN 的说法列在明处。一般援助统计在其下，不是 ASCN 的结果。",
    generalStats: "一般性捆绑援助统计。并不专属于 ASCN。",
    generalScope: "一般情况。并不专属于 ASCN。",
    ascnScope: "专属于 ASCN。",
    noFlow: "这份记录里没有被引用的来源描述捆绑援助或幽灵援助。",
    tiedAid: "捆绑援助",
    phantomAid: "幽灵援助",
    byType: "按类型",
    byYear: "按年份",
    types: { grant: "资助", trip: "出行", mou: "谅解备忘录", communication: "往来", course: "培训" },
    outcomes: { delivered: "已交付", partial: "部分完成", stalled: "停滞", failed: "未实现" },
    outcomeHeading: "结果",
    outcomeLede: "已交付的和停滞或未实现的放在同一份清单里，分量相同。部分完成不算作成功。",
    filterType: "类型",
    filterYear: "年份",
    filterOutcome: "结果",
    filterSearch: "检索",
    all: "全部",
    columns: { date: "日期", item: "事项", counterpart: "对口机构", outcome: "结果", source: "来源" },
    none: "没有相符的事项",
    noCounterpart: "没有外部机构",
    cleared: "经 Non 核可公开",
    noMou: "这份记录里没有谅解备忘录。",
    noAmount: "没有公开的资助金额。",
    withheld: "未收录",
    timeline: "时间线",
    empty: "还没有可公开的事项",
    loadError: "档案数据未能加载",
    searchLabel: "检索标题和说明",
    amount: "金额",
    footnote: "电话号码、私人地址和内部公函都不收录。数字没有被抬高。线索停在哪里，结果就写到哪里。中等可信度标在该行上。自行报告指数字来自该机构自己的说法，包括东盟的项目总数。",
    countLabel: "显示",
  },
};

const state = { doc: null, lang: "en", type: "all", year: "all", outcome: "all", query: "", error: "" };

function initialLang() {
  try {
    const saved = sessionStorage.getItem("ascn-archive-lang");
    if (LANGS.includes(saved)) return saved;
  } catch { /* Language stays English when storage is blocked. */ }
  return "en";
}

function copy() { return COPY[state.lang]; }

function phrase(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[state.lang] || value.en || "";
}

function yearsOf(items) {
  const years = items.map((item) => Number(String(item.date).slice(0, 4))).filter((year) => Number.isInteger(year));
  const last = Math.max(2026, 2018, ...years);
  return Array.from({ length: last - 2018 + 1 }, (_, index) => 2018 + index);
}

function matches(item) {
  if (state.type !== "all" && item.type !== state.type) return false;
  if (state.year !== "all" && !item.date.startsWith(state.year)) return false;
  if (state.outcome !== "all" && item.outcome !== state.outcome) return false;
  const query = state.query.trim().toLowerCase();
  if (!query) return true;
  const haystack = [item.id, item.date, item.type, item.outcome, item.source, item.confidence,
    item.selfReported ? "self-reported" : "",
    ...LANGS.flatMap((lang) => [item.title?.[lang], item.note?.[lang], item.counterpart?.[lang]])].join("\n").toLowerCase();
  return haystack.includes(query);
}

function sourceCell(item) {
  if (item.source === "cleared by Non") return esc(copy().cleared);
  const href = safeUrl(item.source);
  if (href === "#") return esc(copy().cleared);
  let host = item.source;
  try { host = new URL(href).host.replace(/^www\./, ""); } catch { /* Keep the safe URL text. */ }
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(host)}</a>`;
}

function flagLine(item) {
  const text = copy();
  return [
    item.confidence === "medium" ? `<span class="archive-flag">${esc(text.medium)}</span>` : "",
    item.selfReported ? `<span class="archive-flag">${esc(text.selfReported)}</span>` : "",
  ].join("");
}

function amountLine(item) {
  if (item.amount == null) return "";
  const shown = typeof item.amount === "number" ? new Intl.NumberFormat("en-US").format(item.amount) : String(item.amount);
  return `<p class="archive-amount">${esc(copy().amount)} ${esc(shown)}</p>`;
}

function fillSelect(select, options, selected) {
  const next = options.some((option) => option.value === selected) ? selected : options[0].value;
  select.innerHTML = options.map((option) => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join("");
  select.value = next;
  return next;
}

function renderFilters() {
  const text = copy();
  $("#archive-filter-type").textContent = text.filterType;
  $("#archive-filter-year").textContent = text.filterYear;
  $("#archive-filter-outcome").textContent = text.filterOutcome;
  $("#archive-filter-search").textContent = text.filterSearch;
  const search = $("#archive-search");
  search.setAttribute("aria-label", text.searchLabel);
  search.placeholder = text.searchLabel;
  const items = state.doc?.items || [];
  state.type = fillSelect($("#archive-type"), [{ value: "all", label: text.all }, ...TYPES.map((type) => ({ value: type, label: text.types[type] }))], state.type);
  state.year = fillSelect($("#archive-year"), [{ value: "all", label: text.all }, ...yearsOf(items).map((year) => ({ value: String(year), label: String(year) }))], state.year);
  state.outcome = fillSelect($("#archive-outcome"), [{ value: "all", label: text.all }, ...OUTCOMES.map((outcome) => ({ value: outcome, label: text.outcomes[outcome] }))], state.outcome);
}

function renderCounts(items) {
  const text = copy();
  const typeRows = TYPES.map((type) => `<div><dt>${esc(text.types[type])}</dt><dd>${items.filter((item) => item.type === type).length}</dd></div>`).join("")
    + `<div><dt>${esc(text.medium)}</dt><dd>${items.filter((item) => item.confidence === "medium").length}</dd></div>`
    + `<div><dt>${esc(text.selfReported)}</dt><dd>${items.filter((item) => item.selfReported).length}</dd></div>`;
  const yearRows = yearsOf(items).map((year) => `<div><dt>${year}</dt><dd>${items.filter((item) => item.date.startsWith(String(year))).length}</dd></div>`).join("");
  $("#archive-counts").innerHTML = `<section aria-label="${esc(text.byType)}"><h3 class="label">${esc(text.byType)}</h3><dl>${typeRows}</dl></section><section aria-label="${esc(text.byYear)}"><h3 class="label">${esc(text.byYear)}</h3><dl>${yearRows}</dl></section>`;
}

function renderTimeline(items) {
  const text = copy();
  const years = yearsOf(items);
  const marks = years.map((year) => {
    const count = items.filter((item) => item.date.startsWith(String(year))).length;
    return `<li><span>${year}</span><strong>${count}</strong></li>`;
  }).join("");
  $("#archive-timeline").innerHTML = `<h3 class="label">${esc(text.timeline)}</h3><div class="archive-rule" tabindex="0"><ol>${marks}</ol></div>`;
}

function renderTable(items) {
  const text = copy();
  const rows = items.filter(matches);
  const body = rows.map((item) => `<tr data-id="${esc(item.id)}">
    <td data-label="${esc(text.columns.date)}"><time datetime="${esc(item.date)}">${esc(item.date)}</time></td>
    <td data-label="${esc(text.columns.item)}"><strong>${esc(phrase(item.title))}</strong><span class="archive-kind">${esc(text.types[item.type] || item.type)}</span>${flagLine(item)}</td>
    <td data-label="${esc(text.columns.counterpart)}">${esc(phrase(item.counterpart) || text.noCounterpart)}${amountLine(item)}</td>
    <td data-label="${esc(text.columns.outcome)}"><span class="archive-outcome">${esc(text.outcomes[item.outcome] || item.outcome)}</span><p>${esc(phrase(item.note))}</p></td>
    <td data-label="${esc(text.columns.source)}">${sourceCell(item)}</td>
  </tr>`).join("");
  const empty = `<tr><td class="archive-empty" colspan="5">${esc(items.length ? text.none : text.empty)}</td></tr>`;
  $("#archive-count").textContent = `${text.countLabel} ${rows.length} / ${items.length}`;
  $("#archive-table").innerHTML = `<table class="archive-table"><thead><tr>
    <th>${esc(text.columns.date)}</th><th>${esc(text.columns.item)}</th><th>${esc(text.columns.counterpart)}</th><th>${esc(text.columns.outcome)}</th><th>${esc(text.columns.source)}</th>
  </tr></thead><tbody>${body || empty}</tbody></table>`;
}

function renderOutcomes(items) {
  const text = copy();
  const rows = OUTCOMES.map((outcome) => {
    const matched = items.filter((item) => item.outcome === outcome);
    const titles = matched.map((item) => `<li>${esc(phrase(item.title))}</li>`).join("");
    return `<li><span class="label">${esc(text.outcomes[outcome])}</span><strong>${matched.length}</strong><ul>${titles}</ul></li>`;
  }).join("");
  $("#archive-outcomes").innerHTML = `<h3 id="archive-outcomes-heading">${esc(text.outcomeHeading)}</h3><p>${esc(text.outcomeLede)}</p><ol>${rows}</ol>`;
}

function groupDigits(amount) {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function citedFigure(row) {
  const text = copy();
  if (row.amount == null) return esc(text.notPublic);
  return `${row.over ? "over " : ""}${esc(row.currency)} ${esc(groupDigits(row.amount))}`;
}

function totalFigure(kind, total) {
  const text = copy();
  const body = !total
    ? `<strong class="archive-gap">${esc(text.notPublic)}</strong>`
    : `<strong class="archive-figure">${esc(total.currency)} ${esc(groupDigits(total.amount))}</strong>`
      + (total.includesMedium ? `<span class="archive-flag">${esc(text.medium)}</span>` : "")
      + (total.includesSelfReported ? `<span class="archive-flag">${esc(text.selfReported)}</span>` : "")
      + (total.limit ? `<span class="archive-flag">${esc(phrase(total.limit))}</span>` : "");
  return `<div><span class="label">${esc(kind)}</span>${body}</div>`;
}

function kindLabel(kind) {
  const text = copy();
  if (kind === "disbursed") return text.disbursed;
  if (kind === "unspecified") return text.either;
  return text.committed;
}

function renderFunding() {
  const host = $("#archive-funding");
  const funding = state.doc?.funding;
  if (!host || !funding) {
    if (host) host.innerHTML = "";
    return;
  }
  const text = copy();
  const donors = funding.donors.map((donor) => `<article class="archive-donor">
    <h3>${esc(phrase(donor.name))}</h3>
    ${totalFigure(text.committed, donor.committed)}
    ${totalFigure(text.disbursed, donor.disbursed)}
  </article>`).join("");
  const rows = funding.donors.flatMap((donor) => donor.rows.map((row) => `<li>
    <span class="label">${esc(phrase(donor.name))}</span>
    <span class="label">${esc(kindLabel(row.kind))}</span>
    <strong>${citedFigure(row)}</strong>
    ${row.confidence === "medium" ? `<span class="archive-flag">${esc(text.medium)}</span>` : ""}
    ${row.selfReported ? `<span class="archive-flag">${esc(text.selfReported)}</span>` : ""}
    ${row.amount != null && !row.counts ? `<span class="archive-flag">${esc(text.notAdded)}</span>` : ""}
    <p>${esc(phrase(row.title))}</p>
    <p>${esc(phrase(row.note))}</p>
    <p>${sourceCell(row)}</p>
  </li>`)).join("");
  host.innerHTML = `<h2 class="archive-funding-title" id="archive-funding-title">${esc(text.funding)}</h2><p>${esc(text.fundingLede)}</p><div>${donors}</div>${renderReconciliation()}${rows ? `<details><summary>${esc(text.breakdown)}</summary><ul>${rows}</ul></details>` : ""}`;
}

function renderReconciliation() {
  const rec = state.doc?.reconciliation;
  if (!rec || (!rec.conflicts?.length && !rec.kept?.length)) return "";
  const text = copy();
  const conflicts = (rec.conflicts || []).map((conflict) => `<div class="archive-conflict">
    <p class="label">${esc(text.conflict)}</p>
    <p>${esc(phrase(conflict.text))}</p>
    <p>${(conflict.sources || []).map((source) => sourceCell({ source })).join(" ")}</p>
  </div>`).join("");
  const kept = rec.kept?.length
    ? `<details><summary>${esc(text.keptHeading)}</summary><ul>${rec.kept.map((line) => `<li>${esc(phrase(line))}</li>`).join("")}</ul></details>`
    : "";
  return `${conflicts}${kept}`;
}

function claimItem(claim) {
  const text = copy();
  const scope = claim.scope === "ascn" ? text.ascnScope : text.generalScope;
  const medium = claim.confidence === "medium" ? `<span class="archive-flag">${esc(text.medium)}</span>` : "";
  const figure = [claim.year, claim.figure].filter(Boolean).join(". ");
  const qualifier = claim.qualifier ? `<p>${esc(phrase(claim.qualifier))}</p>` : "";
  return `<li>
    <span class="label">${esc(scope)}</span>
    <span class="label">${esc(claim.donor || "")}</span>
    ${medium}
    <strong>${esc(phrase(claim.claim))}</strong>
    ${figure ? `<p>${esc(figure)}</p>` : ""}
    ${qualifier}
    <p>${sourceCell({ source: claim.source })}</p>
  </li>`;
}

function renderMoney() {
  const host = $("#archive-money");
  if (!host) return;
  const text = copy();
  const cited = state.doc?.money || [];
  const flows = (state.doc?.items || []).filter((item) => item.flow === "tied-aid" || item.flow === "phantom-aid");
  let claims = "";
  if (cited.length) {
    const ascn = cited.filter((claim) => claim.scope === "ascn");
    const general = cited.filter((claim) => claim.scope !== "ascn");
    const open = ascn.length ? `<ul>${ascn.map(claimItem).join("")}</ul>` : "";
    const closed = general.length
      ? `<details><summary>${esc(text.generalStats)}</summary><ul>${general.map(claimItem).join("")}</ul></details>`
      : "";
    claims = `<p>${esc(text.moneyLede)}</p>${open}${closed}`;
  } else if (flows.length) {
    claims = `<ul>${flows.map((item) => `<li>
      <span class="label">${esc(item.flow === "tied-aid" ? text.tiedAid : text.phantomAid)}</span>
      <strong>${esc(phrase(item.title))}</strong>
      <p>${esc(phrase(item.note))}</p>
      <p>${sourceCell(item)}</p>
    </li>`).join("")}</ul>`;
  } else claims = `<p>${esc(text.noFlow)}</p>`;
  const account = state.doc?.account;
  const accountHtml = account ? `<div class="archive-account-block"><p class="label">${esc(phrase(account.label))}</p><p class="archive-account">${esc(phrase(account.text))}</p></div>` : "";
  host.innerHTML = `<h2 class="archive-funding-title" id="archive-money-title">${esc(text.moneyHeading)}</h2>${claims}${accountHtml}`;
}

function renderPending() {
  const text = copy();
  const rows = state.doc?.pending || [];
  const host = $("#archive-pending");
  if (!rows.length) {
    host.innerHTML = "";
    return;
  }
  const items = rows.map((row) => `<li>
    <strong>${esc(phrase(row.title))}</strong>
    ${flagLine(row)}
    <span class="archive-flag">${esc(text.pending)}</span>
    <p>${esc(phrase(row.note))}</p>
    <p>${sourceCell(row)}</p>
  </li>`).join("");
  host.innerHTML = `<h3 class="label">${esc(text.pending)} ${rows.length}</h3><ul>${items}</ul>`;
}

function renderWithheld() {
  const text = copy();
  const rows = state.doc?.withheld || [];
  const reasons = rows.map((row) => `<li>${esc(phrase(row.reason))}</li>`).join("");
  const limits = [
    itemsHave(state.doc.items, "mou") ? "" : `<p>${esc(text.noMou)}</p>`,
    (state.doc.items || []).some((item) => item.amount != null) ? "" : `<p>${esc(text.noAmount)}</p>`,
  ].join("");
  $("#archive-withheld").innerHTML = `${rows.length ? `<h3 class="label">${esc(text.withheld)} ${rows.length}</h3><ul>${reasons}</ul>` : ""}<div class="archive-limits">${limits}<p>${esc(text.footnote)}</p></div>`;
}

function itemsHave(items, type) {
  return (items || []).some((item) => item.type === type);
}

function render() {
  const view = $("#view-archive");
  const text = copy();
  view.lang = state.lang;
  $("#archive-kicker").textContent = text.kicker;
  $("#archive-title").textContent = text.title;
  $("#archive-subtitle").textContent = text.subtitle;
  $("#archive-lede").textContent = state.doc ? phrase(state.doc.coverage) : "";
  document.querySelectorAll("[data-archive-lang]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.archiveLang === state.lang));
  });
  if (state.error) {
    $("#archive-status").hidden = false;
    $("#archive-status").textContent = state.error;
    return;
  }
  $("#archive-status").hidden = true;
  if (!state.doc) return;
  renderFunding();
  renderMoney();
  renderFilters();
  renderCounts(state.doc.items);
  renderTimeline(state.doc.items);
  renderTable(state.doc.items);
  renderOutcomes(state.doc.items);
  renderPending();
  renderWithheld();
}

function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  state.lang = lang;
  try { sessionStorage.setItem("ascn-archive-lang", lang); } catch { /* The switch still applies for this view. */ }
  render();
}

async function init() {
  state.lang = initialLang();
  const view = $("#view-archive");
  view.addEventListener("click", (event) => {
    const button = event.target.closest("[data-archive-lang]");
    if (button) setLang(button.dataset.archiveLang);
  });
  for (const [id, key] of [["#archive-type", "type"], ["#archive-year", "year"], ["#archive-outcome", "outcome"]]) {
    $(id).addEventListener("change", (event) => { state[key] = event.target.value; renderTable(state.doc?.items || []); });
  }
  $("#archive-search").addEventListener("input", (event) => { state.query = event.target.value; renderTable(state.doc?.items || []); });
  try {
    const response = await fetch("data/ascn-archive.json");
    if (!response.ok) throw new Error(copy().loadError);
    const data = await response.json();
    if (!Array.isArray(data.items) || !data.coverage) throw new Error(copy().loadError);
    state.doc = data;
  } catch (error) {
    state.error = error.message || copy().loadError;
  }
  render();
}

init();
