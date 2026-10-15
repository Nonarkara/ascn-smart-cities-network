// Donor totals are added only from these rows. A later public amount with no entry here
// stays in `unassigned` and is not folded into a donor. Overlapping descriptions of the
// same commitment set counts: false so they cannot be added twice.

const text = (en, th, zh) => ({ en, th, zh });

const RECEIVED_2020 = text(
  "Received by the fund by the end of 2020.",
  "กองทุนได้รับภายในสิ้นปี 2020",
  "截至2020年底由基金收到。",
);
const NOT_ASCN = text(
  "Not specific to ASCN.",
  "ไม่ได้เจาะจงที่ ASCN",
  "并不专属于 ASCN。",
);

export const ACCOUNT = {
  label: text(
    "Non’s own account. Not a sourced fact.",
    "คำบอกของนนท์เอง ไม่ใช่ข้อเท็จจริงที่มีแหล่งอ้าง",
    "Non 本人的说法。不是有来源的事实。",
  ),
  text: text(
    "depa never received fund transfers.",
    "depa ไม่เคยได้รับเงินโอน",
    "depa 从未收到过资金划转。",
  ),
};

const DONORS = [
  { id: "united-states", name: text("United States", "สหรัฐฯ", "美国") },
  { id: "australia", name: text("Australia", "ออสเตรเลีย", "澳大利亚") },
  { id: "korea", name: text("Korea", "เกาหลี", "韩国") },
  { id: "japan", name: text("Japan", "ญี่ปุ่น", "日本") },
  { id: "akcf", name: text("ASEAN-Korea Cooperation Fund", "กองทุนความร่วมมืออาเซียน–เกาหลี", "东盟—韩国合作基金") },
  { id: "aus4asean", name: text("Aus4ASEAN Futures", "Aus4ASEAN Futures", "Aus4ASEAN Futures") },
  { id: "jaif", name: text("Japan-ASEAN Integration Fund", "กองทุนบูรณาการญี่ปุ่น–อาเซียน", "日本—东盟一体化基金") },
];

const CONTRIBUTIONS = [
  {
    id: "F01-committed",
    donor: "united-states",
    itemId: "F01",
    kind: "committed",
    amount: 10000000,
    currency: "USD",
    counts: true,
    note: text(
      "Initial commitment announced on 15 November 2018. Added to the committed total.",
      "คำมั่นเริ่มต้นที่ประกาศเมื่อ 15 พฤศจิกายน 2018 นำไปรวมในยอดให้คำมั่น",
      "2018年11月15日宣布的初始承诺。计入承诺合计。",
    ),
  },
  {
    id: "F02-committed",
    donor: "united-states",
    itemId: "F02",
    kind: "committed",
    amount: 10000000,
    currency: "USD",
    over: true,
    counts: false,
    note: text(
      "Not added. The partnership’s own later flyer describes the same commitment as over this amount, and that description is self-reported.",
      "ไม่นำไปรวม ใบปลิวภายหลังของความร่วมมือเองบรรยายคำมั่นก้อนเดียวกันว่ามากกว่าจำนวนนี้ และคำบรรยายนั้นเป็นรายงานเอง",
      "不计入。伙伴关系自己后来的单页把同一笔承诺说成超过此数，该说法是自行报告。",
    ),
  },
  {
    id: "F01-disbursed",
    donor: "united-states",
    itemId: "F01",
    kind: "disbursed",
    amount: null,
    counts: false,
    note: text(
      "No disbursed figure is public.",
      "ไม่มีตัวเลขที่จ่ายแล้วต่อสาธารณะ",
      "没有公开的已拨付数字。",
    ),
  },
  {
    id: "F03-committed",
    donor: "australia",
    itemId: "F03",
    kind: "committed",
    amount: 20000000,
    currency: "AUD",
    counts: true,
    note: text(
      "Commitment of 2 April 2019. Added to the committed total.",
      "คำมั่นวันที่ 2 เมษายน 2019 นำไปรวมในยอดให้คำมั่น",
      "2019年4月2日的承诺。计入承诺合计。",
    ),
  },
  {
    id: "F04-committed",
    donor: "australia",
    itemId: "F04",
    kind: "committed",
    amount: 1000000,
    currency: "AUD",
    counts: true,
    note: text(
      "Additional commitment in June 2023. Added to the committed total.",
      "คำมั่นเพิ่มในเดือนมิถุนายน 2023 นำไปรวมในยอดให้คำมั่น",
      "2023年6月的追加承诺。计入承诺合计。",
    ),
  },
  {
    id: "F03-disbursed",
    donor: "australia",
    itemId: "F03",
    kind: "disbursed",
    amount: 13180000,
    currency: "AUD",
    counts: true,
    limit: RECEIVED_2020,
    note: text(
      "The 2020 progress report says the fund had received this much by the end of 2020. Added to the disbursed total. It is not a figure for later years.",
      "รายงานความคืบหน้าปี 2020 ระบุว่ากองทุนได้รับจำนวนนี้ภายในสิ้นปี 2020 นำไปรวมในยอดจ่ายแล้ว ไม่ใช่ตัวเลขของปีถัดไป",
      "2020年进展报告称基金在2020年底前收到这一金额。计入已拨付合计。它不是其后年份的数字。",
    ),
  },
  {
    id: "F04-disbursed",
    donor: "australia",
    itemId: "F04",
    kind: "disbursed",
    amount: null,
    counts: false,
    note: text(
      "No figure is public for how much of the June 2023 top-up was received.",
      "ไม่มีตัวเลขสาธารณะว่าได้รับเงินสมทบเดือนมิถุนายน 2023 ไปเท่าใด",
      "2023年6月追加出资实际收到多少，没有公开数字。",
    ),
  },
  {
    id: "F09-committed",
    donor: "korea",
    itemId: "F09",
    kind: "committed",
    amount: 1500000000000,
    currency: "KRW",
    counts: true,
    limit: NOT_ASCN,
    note: text(
      "Fund announced in November 2019. Added to the committed total. It is not specific to ASCN, and confidence is medium.",
      "กองทุนที่ประกาศในเดือนพฤศจิกายน 2019 นำไปรวมในยอดให้คำมั่น ไม่ได้เจาะจงที่ ASCN และความเชื่อมั่นอยู่ที่ระดับกลาง",
      "2019年11月宣布的基金。计入承诺合计。并不专属于 ASCN，可信度为中等。",
    ),
  },
  {
    id: "F09-earmark",
    donor: "korea",
    itemId: "F09",
    kind: "committed",
    amount: 300000000000,
    currency: "KRW",
    counts: false,
    note: text(
      "Not added. A news report described this portion as set aside inside the same fund. It is not a second commitment, and it is not specific to ASCN.",
      "ไม่นำไปรวม ข่าวบรรยายว่าส่วนนี้ถูกกันไว้ภายในกองทุนเดียวกัน ไม่ใช่คำมั่นก้อนที่สอง และไม่ได้เจาะจงที่ ASCN",
      "不计入。新闻称这一部分留在同一基金之内。它不是第二笔承诺，也不专属于 ASCN。",
    ),
  },
  {
    id: "F09-disbursed",
    donor: "korea",
    itemId: "F09",
    kind: "disbursed",
    amount: null,
    counts: false,
    note: text(
      "No disbursed figure is public.",
      "ไม่มีตัวเลขที่จ่ายแล้วต่อสาธารณะ",
      "没有公开的已拨付数字。",
    ),
  },
  {
    id: "japan-hlm2",
    donor: "japan",
    itemId: "hlm2-2020",
    kind: "unspecified",
    amount: null,
    counts: false,
    note: text(
      "Smart JAMP was proposed at this meeting. No programme total and no disbursed figure are public.",
      "มีการเสนอ Smart JAMP ในการประชุมนี้ ไม่มียอดของโปรแกรมและไม่มีตัวเลขที่จ่ายแล้วต่อสาธารณะ",
      "Smart JAMP 在这次会议上提出。没有公开的项目总额，也没有已拨付数字。",
    ),
  },
  {
    id: "japan-f07",
    donor: "japan",
    itemId: "F07",
    kind: "unspecified",
    amount: null,
    counts: false,
    note: text(
      "The Bangkok trial states no budget.",
      "การทดลองในกรุงเทพฯ ไม่ระบุงบประมาณ",
      "曼谷试验没有写出预算。",
    ),
  },
  {
    id: "japan-f08",
    donor: "japan",
    itemId: "F08",
    kind: "unspecified",
    amount: null,
    counts: false,
    note: text(
      "The Vientiane study states no budget.",
      "การศึกษาที่เวียงจันทน์ไม่ระบุงบประมาณ",
      "万象研究没有写出预算。",
    ),
  },
  {
    id: "akcf-f10",
    donor: "akcf",
    itemId: "F10",
    kind: "unspecified",
    amount: null,
    counts: false,
    note: text(
      "The programme call states no funding amount.",
      "เอกสารเปิดรับของโครงการไม่ระบุจำนวนเงินทุน",
      "项目征集文件没有写出资助金额。",
    ),
  },
  {
    id: "aus4-toolkit",
    donor: "aus4asean",
    itemId: "financing-toolkit-2024",
    kind: "unspecified",
    amount: null,
    counts: false,
    note: text(
      "The toolkit launch discloses no amount.",
      "การเปิดตัวชุดเครื่องมือไม่เปิดเผยจำนวนเงิน",
      "工具包发布没有披露金额。",
    ),
  },
  {
    id: "aus4-f12",
    donor: "aus4asean",
    itemId: "F12",
    kind: "unspecified",
    amount: null,
    counts: false,
    note: text(
      "The second-phase description discloses no amount.",
      "คำบรรยายระยะที่สองไม่เปิดเผยจำนวนเงิน",
      "第二阶段的描述没有披露金额。",
    ),
  },
  {
    id: "jaif-t04",
    donor: "jaif",
    itemId: "T04",
    kind: "unspecified",
    amount: null,
    counts: false,
    note: text(
      "The meeting page names this fund as a supporter. No amount is public.",
      "หน้าของการประชุมระบุกองทุนนี้เป็นผู้สนับสนุน ไม่มีจำนวนเงินต่อสาธารณะ",
      "会议页面把该基金列为支持方。没有公开金额。",
    ),
  },
];

function fail(message) {
  throw new Error(message);
}

function sum(rows, kind) {
  const counted = rows.filter((row) => row.kind === kind && row.counts && row.amount != null);
  if (!counted.length) return null;
  const currencies = new Set(counted.map((row) => row.currency));
  if (currencies.size !== 1) fail(`${kind} total mixes currencies`);
  const limits = [...new Set(counted.map((row) => row.limit?.en).filter(Boolean))];
  if (limits.length > 1) fail(`${kind} total has conflicting limits`);
  return {
    currency: counted[0].currency,
    amount: counted.reduce((total, row) => total + row.amount, 0),
    includesSelfReported: counted.some((row) => row.selfReported),
    includesMedium: counted.some((row) => row.confidence === "medium"),
    limit: counted.find((row) => row.limit)?.limit || null,
  };
}

function formattedAmount(entry) {
  if (entry.amount == null) return null;
  return `${entry.over ? "over " : ""}${entry.currency} ${entry.amount}`;
}

export function fundingFromItems(items) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const donors = DONORS.map((donor) => {
    const rows = CONTRIBUTIONS.filter((entry) => entry.donor === donor.id && byId.has(entry.itemId)).map((entry) => {
      const item = byId.get(entry.itemId);
      if (!["committed", "disbursed", "unspecified"].includes(entry.kind)) fail(`${entry.id} has an unknown kind`);
      if (entry.counts && (entry.amount == null || entry.kind === "unspecified")) fail(`${entry.id} cannot be added to a total`);
      if (entry.amount != null && (!Number.isInteger(entry.amount) || entry.amount < 0)) fail(`${entry.id} amount is not a public amount`);
      if (entry.amount != null && !/^[A-Z]{3}$/.test(entry.currency || "")) fail(`${entry.id} currency is not a public amount`);
      return {
        id: entry.id,
        itemId: item.id,
        date: item.date,
        kind: entry.kind,
        amount: entry.amount,
        currency: entry.amount == null ? null : entry.currency,
        over: entry.over === true,
        counts: entry.counts === true,
        confidence: item.confidence,
        selfReported: item.selfReported === true,
        source: item.source,
        title: item.title,
        note: entry.note,
        limit: entry.limit || null,
      };
    });
    return {
      id: donor.id,
      name: donor.name,
      committed: sum(rows, "committed"),
      disbursed: sum(rows, "disbursed"),
      rows,
    };
  });

  for (const item of items) {
    if (item.amount == null || typeof item.amount !== "string") continue;
    const entries = CONTRIBUTIONS.filter((entry) => entry.itemId === item.id);
    if (!entries.length) continue;
    if (!entries.some((entry) => formattedAmount(entry) === item.amount)) fail(`${item.id} amount is not in the funding ledger`);
  }

  const unassigned = items.filter((item) => item.amount != null && !CONTRIBUTIONS.some((entry) => entry.itemId === item.id)).map((item) => ({
    itemId: item.id,
    amount: item.amount,
    source: item.source,
    title: item.title,
    confidence: item.confidence,
    selfReported: item.selfReported === true,
  }));

  return { donors, unassigned };
}
