// Round 2 files are not scrape rows. Claims, programme wording and the donor
// reconciliation live here so a later CSV cannot overwrite a headline total or
// publish a figure that the sheet itself calls a window rather than a grant.

const text = (en, th, zh) => ({ en, th, zh });

function fail(message) {
  throw new Error(message);
}

const PARTNERS = "https://sciti.nonarkara.org/partners";
const KNOWLEDGE = "https://sciti.nonarkara.org/knowledge";

const SITE = text(
  "This listing is Non’s own site, not an independent evaluation.",
  "รายการนี้มาจากเว็บของนนท์เอง ไม่ใช่การประเมินอิสระ",
  "这条来自 Non 自己的网站，不是独立评估。",
);
const NOT_PROJECT = text(
  "The page lists it. This row does not make it an ASCN project.",
  "หน้านั้นเป็นผู้ลงรายการ แถวนี้ไม่ได้ทำให้เป็นโครงการของ ASCN",
  "页面上列出了它。这一行并不因此把它变成 ASCN 项目。",
);

function note(en, th, zh, extra) {
  const tail = extra || SITE;
  return text(`${en} ${tail.en}`, `${th} ${tail.th}`, `${zh}${tail.zh}`);
}

function programmeItem(spec) {
  return {
    id: spec.id,
    type: spec.type,
    date: spec.date,
    title: spec.title,
    counterpart: spec.counterpart,
    outcome: spec.outcome,
    note: spec.note,
    source: spec.source,
    public: true,
    confidence: "medium",
    selfReported: true,
  };
}

const ORG = {
  jica: text("Japan International Cooperation Agency (JICA)", "สำนักงานความร่วมมือระหว่างประเทศของญี่ปุ่น (JICA)", "日本国际协力机构（JICA）"),
  korea: text("Korea (K-City Network)", "เกาหลี (K-City Network)", "韩国（K-City Network）"),
  uk: text("UK Prosperity Fund", "กองทุนความเจริญของสหราชอาณาจักร", "英国繁荣基金"),
  austria: text("Advantage Austria", "Advantage Austria", "Advantage Austria"),
  china: text("ASEAN-China Centre", "ศูนย์อาเซียน–จีน", "中国—东盟中心"),
  poly: text("Singapore Polytechnic", "สถาบันโพลีเทคนิคสิงคโปร์", "新加坡理工学院"),
  undesa: text("UN Department of Economic and Social Affairs", "กรมกิจการเศรษฐกิจและสังคมแห่งสหประชาชาติ", "联合国经济和社会事务部"),
  govmesh: text("GovInsider and interweave.gov", "GovInsider และ interweave.gov", "GovInsider 与 interweave.gov"),
};

const PROGRAMMES = {
  "U.S.-ASEAN Smart Cities Partnership (USASCP)": { into: "F01", source: PARTNERS, yearIncludes: "2018" },
  "JASCA / Smart JAMP": { into: "hlm2-2020", source: PARTNERS, yearIncludes: "2020" },
  "Seoul National University ASEAN programme": { into: "F10", source: PARTNERS },
  "ASUS Phase II (ASEAN Sustainable Urbanisation Strategy)": { into: "F12", source: PARTNERS, yearIncludes: "2023" },
  "ASCN Showcase at ALGIM Annual Conference": { into: "T08", source: PARTNERS, yearIncludes: "2024" },
  "JICA technical cooperation with DEPA": {
    source: PARTNERS,
    yearIncludes: "2019",
    item: programmeItem({
      id: "jica-depa-2019",
      type: "communication",
      date: "2019",
      title: text(
        "JICA technical cooperation with DEPA",
        "ความร่วมมือทางเทคนิคของ JICA กับ DEPA",
        "JICA 与 DEPA 的技术合作",
      ),
      counterpart: ORG.jica,
      outcome: "partial",
      source: PARTNERS,
      note: note(
        "Non’s site lists a 2019 timeline entry for technical cooperation between JICA and DEPA, and a JICA annual programme in Yokohama. The site states no result.",
        "เว็บของนนท์ลงรายการปี 2019 สำหรับความร่วมมือทางเทคนิคระหว่าง JICA กับ DEPA และโปรแกรมประจำปีของ JICA ที่โยโกฮามา เว็บไม่ได้ระบุผล",
        "Non 的网站列有一条2019年时间线条目，写 JICA 与 DEPA 的技术合作，以及 JICA 在横滨的年度项目。网站没有写出结果。",
      ),
    }),
  },
  "K-City Global Collaboration \u2013 Khon Kaen LRT planning": {
    source: PARTNERS,
    yearIncludes: "2019",
    item: programmeItem({
      id: "kcity-khonkaen-2019",
      type: "communication",
      date: "2019",
      title: text(
        "K-City study for a Khon Kaen light rail",
        "การศึกษา K-City สำหรับรถไฟฟ้ารางเบาขอนแก่น",
        "K-City 对孔敬轻轨的研究",
      ),
      counterpart: ORG.korea,
      outcome: "stalled",
      source: PARTNERS,
      note: note(
        "Non’s site lists technical assistance for a Khon Kaen light-rail plan and marks the status stalled: a study exists, and the site says implementation is blocked. That stalled label is the site’s assessment. The site’s span is 2019–2020. This row uses 2019.",
        "เว็บของนนท์ลงความช่วยเหลือทางเทคนิคสำหรับแผนรถไฟฟ้ารางเบาขอนแก่น และระบุสถานะว่าหยุดค้าง: มีการศึกษาแล้ว และเว็บบอกว่าการลงมือทำติดขัด คำว่าหยุดค้างเป็นการประเมินของเว็บเอง ช่วงบนเว็บคือปี 2019–2020 แถวนี้ใช้ปี 2019",
        "Non 的网站列出孔敬轻轨规划的技术援助，并把状态标为停滞：研究存在，网站称实施受阻。停滞这一标记是网站自己的判断。网站上的时间跨度是2019至2020年。这一行采用2019年。",
      ),
    }),
  },
  "UK Smart City Handbook & Global Future Cities": {
    source: PARTNERS,
    yearIncludes: "2020",
    item: programmeItem({
      id: "uk-handbook-2020",
      type: "course",
      date: "2020",
      title: text(
        "UK Smart City Handbook and Global Future Cities work",
        "คู่มือเมืองอัจฉริยะของสหราชอาณาจักรและงาน Global Future Cities",
        "英国智慧城市手册与全球未来城市工作",
      ),
      counterpart: ORG.uk,
      outcome: "partial",
      source: PARTNERS,
      note: note(
        "Non’s site lists handbook and planning work for Bangkok, Chiang Mai, Khon Kaen and Chonburi, and marks it completed. This row stays partial: that completed label is the site’s own assessment, and a handbook is not recorded here as delivered city infrastructure.",
        "เว็บของนนท์ลงงานคู่มือและงานวางแผนสำหรับกรุงเทพฯ เชียงใหม่ ขอนแก่น และชลบุรี และระบุว่าเสร็จแล้ว แถวนี้ยังเป็นผลบางส่วน: คำว่าเสร็จเป็นการประเมินของเว็บเอง และคู่มือไม่ถูกบันทึกที่นี่ว่าเป็นโครงสร้างของเมืองที่ส่งมอบแล้ว",
        "Non 的网站列出面向曼谷、清迈、孔敬和春武里的手册与规划工作，并标为已完成。这一行仍记为部分完成：已完成是网站自己的判断，手册在这里也不记成已经交付的城市基础设施。",
      ),
    }),
  },
  "Advantage Austria MOU": {
    source: PARTNERS,
    yearIncludes: "2022",
    item: programmeItem({
      id: "austria-mou-2022",
      type: "mou",
      date: "2022",
      title: text(
        "Advantage Austria memorandum",
        "บันทึกความเข้าใจของ Advantage Austria",
        "Advantage Austria 谅解备忘录",
      ),
      counterpart: ORG.austria,
      outcome: "partial",
      source: PARTNERS,
      note: note(
        "Non’s site lists a memorandum on technology exchange. The same site dates it 2020 on the timeline and 2022 on the card. This row uses 2022 and stays partial: the site says visible follow-through is still light.",
        "เว็บของนนท์ลงบันทึกความเข้าใจเรื่องการแลกเปลี่ยนเทคโนโลยี เว็บเดียวกันลงปี 2020 บนเส้นเวลา และปี 2022 บนการ์ด แถวนี้ใช้ปี 2022 และยังเป็นผลบางส่วน: เว็บบอกว่าผลที่ตามมายังบาง",
        "Non 的网站列出一份关于技术交流的备忘录。同一网站在时间线上写成2020年，在卡片上写成2022年。这一行采用2022年，并仍记为部分完成：网站称看得见的后续仍然很少。",
      ),
    }),
  },
  "ASEAN-China Centre Leadership Programme field visit, Nanning": {
    source: PARTNERS,
    yearIncludes: "2019",
    item: programmeItem({
      id: "acc-nanning-2019",
      type: "trip",
      date: "2019",
      title: text(
        "ASEAN-China Centre field visit to Nanning",
        "การเยี่ยมชมภาคสนามของศูนย์อาเซียน–จีนที่หนานหนิง",
        "中国—东盟中心南宁实地访问",
      ),
      counterpart: ORG.china,
      outcome: "partial",
      source: PARTNERS,
      note: note(
        "Non’s site lists a 2019 sponsored visit for ASEAN city leaders to Nanning, covering a smart city, digital urban management and agriculture. It states no measured result.",
        "เว็บของนนท์ลงการเยี่ยมชมที่ได้รับการสนับสนุนปี 2019 สำหรับผู้นำเมืองอาเซียนไปหนานหนิง ครอบคลุมเมืองอัจฉริยะ การจัดการเมืองดิจิทัล และเกษตรกรรม ไม่ได้ระบุผลที่วัดได้",
        "Non 的网站列出2019年一次受资助的访问，东盟城市领导人前往南宁，内容包括智慧城市、数字城市管理和农业。没有写出可衡量的结果。",
      ),
    }),
  },
  "Singapore Polytechnic Digital Twin Lab partnership": {
    source: PARTNERS,
    yearIncludes: "2024",
    item: programmeItem({
      id: "polytechnic-twin-2024",
      type: "communication",
      date: "2024",
      title: text(
        "Singapore Polytechnic digital-twin lab partnership",
        "ความร่วมมือห้องปฏิบัติการดิจิทัลทวินของสถาบันโพลีเทคนิคสิงคโปร์",
        "新加坡理工学院数字孪生实验室合作",
      ),
      counterpart: ORG.poly,
      outcome: "partial",
      source: PARTNERS,
      note: note(
        "Non’s site lists a 2024 timeline entry for a digital-twin lab partnership and states no result.",
        "เว็บของนนท์ลงรายการปี 2024 สำหรับความร่วมมือห้องปฏิบัติการดิจิทัลทวิน และไม่ได้ระบุผล",
        "Non 的网站列有一条2024年时间线条目，写数字孪生实验室合作，没有写出结果。",
      ),
    }),
  },
  "Empowering Digital Transformation in SIDS (Solomon Islands)": {
    source: PARTNERS,
    yearIncludes: "2025",
    item: programmeItem({
      id: "sids-solomon-2025",
      type: "course",
      date: "2025",
      title: text(
        "Digital transformation course for the Solomon Islands",
        "การอบรมการเปลี่ยนผ่านดิจิทัลสำหรับหมู่เกาะโซโลมอน",
        "所罗门群岛数字化转型培训",
      ),
      counterpart: ORG.undesa,
      outcome: "partial",
      source: PARTNERS,
      note: note(
        "Non’s site lists a 2025 capacity-building entry on public-sector digitalisation in the Solomon Islands. The site links a United Nations department and does not state a result.",
        "เว็บของนนท์ลงรายการเสริมศักยภาพปี 2025 เรื่องดิจิทัลภาครัฐในหมู่เกาะโซโลมอน เว็บเชื่อมไปยังหน่วยงานของสหประชาชาติ และไม่ได้ระบุผล",
        "Non 的网站列出2025年一条关于所罗门群岛公共部门数字化的能力建设。网站链接到一个联合国部门，没有写出结果。",
        text(`${NOT_PROJECT.en} ${SITE.en}`, `${NOT_PROJECT.th} ${SITE.th}`, `${NOT_PROJECT.zh}${SITE.zh}`),
      ),
    }),
  },
  "Global Digital Forum + BRICS Cloud Forum": {
    source: PARTNERS,
    yearIncludes: "2025",
    item: programmeItem({
      id: "brics-forum-2025",
      type: "communication",
      date: "2025",
      title: text(
        "Global Digital Forum and BRICS Cloud Forum",
        "Global Digital Forum และ BRICS Cloud Forum",
        "全球数字论坛与金砖云论坛",
      ),
      counterpart: null,
      outcome: "partial",
      source: PARTNERS,
      note: note(
        "Non’s site lists 2025 participation in these forums and names no funder and no result.",
        "เว็บของนนท์ลงการเข้าร่วมเวทีเหล่านี้ในปี 2025 และไม่ได้ระบุผู้ให้ทุนหรือผล",
        "Non 的网站列出2025年参加这些论坛，没有写出资助方，也没有写出结果。",
        text(`${NOT_PROJECT.en} ${SITE.en}`, `${NOT_PROJECT.th} ${SITE.th}`, `${NOT_PROJECT.zh}${SITE.zh}`),
      ),
    }),
  },
  "GovMesh 4.0 (Singapore)": {
    source: KNOWLEDGE,
    yearIncludes: "2026-03",
    item: programmeItem({
      id: "govmesh-2026",
      type: "communication",
      date: "2026-03",
      title: text(
        "GovMesh 4.0 in Singapore",
        "GovMesh 4.0 ที่สิงคโปร์",
        "新加坡 GovMesh 4.0",
      ),
      counterpart: ORG.govmesh,
      outcome: "partial",
      source: KNOWLEDGE,
      note: note(
        "Non’s site lists a March 2026 invitation-only forum in Singapore and says Non spoke.",
        "เว็บของนนท์ลงเวทีเฉพาะผู้ได้รับเชิญที่สิงคโปร์ในเดือนมีนาคม 2026 และบอกว่านนท์ได้พูด",
        "Non 的网站列出2026年3月在新加坡的一场仅限受邀者的论坛，并称 Non 发了言。",
        text(`${NOT_PROJECT.en} ${SITE.en}`, `${NOT_PROJECT.th} ${SITE.th}`, `${NOT_PROJECT.zh}${SITE.zh}`),
      ),
    }),
  },
};

const QUALIFIER_CITIES = text(
  "Several of these cities are ASCN members. The projects are not ASCN-branded.",
  "หลายเมืองในรายการนี้เป็นสมาชิก ASCN โครงการไม่ได้ใช้ชื่อ ASCN",
  "其中若干城市是 ASCN 成员。这些项目并不以 ASCN 为名。",
);

const CLAIMS = [
  {
    id: "actionaid-phantom-2005",
    scope: "general",
    confidence: "high",
    source: "https://www.theguardian.com/business/2005/may/27/development.debt",
    claim: text(
      "A 2005 ActionAid report on 2003 flows classed 61% of aid as phantom: not a real transfer of resources. It names overpriced technical assistance and tying to donor firms as causes. For the United States and France the phantom share was described as high as about 89–90%.",
      "รายงาน ActionAid ปี 2005 เรื่องกระแสปี 2003 จัด 61% ของความช่วยเหลือว่าเป็นความช่วยเหลือที่ไม่อยู่จริง คือไม่มีการโอนทรัพยากรจริง รายงานชี้ความช่วยเหลือทางเทคนิคที่ราคาสูงเกินและการผูกกับบริษัทของประเทศผู้ให้เป็นสาเหตุ สำหรับสหรัฐฯ และฝรั่งเศส สัดส่วนที่ไม่อยู่จริงถูกบรรยายว่าสูงถึงราว 89–90%",
      "ActionAid 2005年一份关于2003年流量的报告把61%的援助定为幽灵援助，也就是并没有真正转移资源。报告把定价过高的技术援助和把援助绑给捐助国企业列为原因。美国和法国的幽灵援助比例被写成高达约89%到90%。",
    ),
  },
  {
    id: "uk-phantom-2005",
    scope: "general",
    confidence: "medium",
    source: "https://www.edms.org.uk/2005-06/312.htm",
    claim: text(
      "A 2005 parliamentary motion, citing ActionAid, put the United Kingdom’s phantom-aid rate at 29%.",
      "ญัตติรัฐสภาปี 2005 ที่อ้าง ActionAid วางอัตราความช่วยเหลือที่ไม่อยู่จริงของสหราชอาณาจักรที่ 29%",
      "2005年一项议会动议引用 ActionAid，把英国的幽灵援助比例写成29%。",
    ),
  },
  {
    id: "oecd-untied-share",
    scope: "general",
    confidence: "high",
    source: "https://www.oecd.org/en/topics/sub-issues/oda-standards/untied-aid.html",
    claim: text(
      "The OECD says the untied share of official development assistance covered by the DAC Recommendation rose from 51% in 2000 to 87% in 2024. For all bilateral assistance the rise was from 34% to 79%.",
      "OECD ระบุว่าสัดส่วนที่ไม่ผูกพันของความช่วยเหลือเพื่อการพัฒนาอย่างเป็นทางการที่คำแนะนำ DAC ครอบคลุม เพิ่มจาก 51% ในปี 2000 เป็น 87% ในปี 2024 สำหรับความช่วยเหลือทวิภาคีทั้งหมด เพิ่มจาก 34% เป็น 79%",
      "经合组织称，受发展援助委员会建议覆盖的官方发展援助中，不捆绑份额从2000年的51%升至2024年的87%。全部双边援助则从34%升至79%。",
    ),
  },
  {
    id: "oecd-untied-back-2022",
    scope: "general",
    confidence: "high",
    source: "https://www.oecd.org/en/topics/sub-issues/oda-standards/untied-aid.html",
    claim: text(
      "The OECD reports that in 2022–23 almost half the value of formally untied contracts went to suppliers in the donor country. Across donors the share ran from 0% to 99%.",
      "OECD รายงานว่าในปี 2022–23 เกือบครึ่งหนึ่งของมูลค่าสัญญาที่ไม่ผูกพันในทางรูปแบบตกแก่ผู้จัดหาในประเทศผู้ให้ ระหว่างผู้ให้ สัดส่วนอยู่ตั้งแต่ 0% ถึง 99%",
      "经合组织称，2022至2023年形式上不捆绑的合同里，近一半金额流向了捐助国供应商。各捐助方的比例从0%到99%。",
    ),
  },
  {
    id: "oecd-untied-back-2019",
    scope: "general",
    confidence: "high",
    source: "https://legalinstruments.oecd.org/public/doc/140/140.en.pdf",
    claim: text(
      "An OECD instrument records that in 2019–20 about half the value of untied contract awards, and about a third of the number of awards, flowed back to donor-country suppliers.",
      "ตราสารของ OECD บันทึกว่าในปี 2019–20 ราวครึ่งหนึ่งของมูลค่าสัญญาที่ไม่ผูกพัน และราวหนึ่งในสามของจำนวนสัญญา ไหลกลับไปยังผู้จัดหาในประเทศผู้ให้",
      "经合组织的一份文书记录，2019至2020年不捆绑合同的金额约有一半、合同件数约有三分之一流回捐助国供应商。",
    ),
  },
  {
    id: "sdg-procurement-2022",
    scope: "general",
    confidence: "medium",
    source: "https://jointsdgfund.org/sites/default/files/2025-03/Procurement%20Localization%20Study-%20Final%20Report%5B22%5D.pdf",
    claim: text(
      "A 2025 UN Joint SDG Fund study, using 2022 data, says 52% of untied contract value went to donor-country suppliers. Suppliers in the poorer countries covered by the rules received about 7% of the value.",
      "การศึกษาของ UN Joint SDG Fund ปี 2025 ที่ใช้ข้อมูลปี 2022 ระบุว่า 52% ของมูลค่าสัญญาที่ไม่ผูกพันตกแก่ผู้จัดหาในประเทศผู้ให้ ผู้จัดหาในประเทศที่ยากจนกว่าซึ่งกฎครอบคลุมได้รับราว 7% ของมูลค่า",
      "2025年联合国联合可持续发展目标基金的一项研究使用2022年数据，称不捆绑合同金额的52%给了捐助国供应商。规则所覆盖的较贫困国家的供应商大约拿到价值的7%。",
    ),
  },
  {
    id: "eurodad-own-firms-2018",
    scope: "general",
    confidence: "high",
    source: "https://www.eurodad.org/development-untied-2018-report",
    claim: text(
      "Eurodad’s 2018 report says more than half of aid procurement went to donors’ own firms. The United States, Australia and the United Kingdom each sent at least 90% to their own firms, while the United Kingdom and Australia reported their aid as fully untied. The report puts the extra cost at 1.95–5.43 billion US dollars, and says firms in the south miss out especially in technical assistance. It puts formally tied aid at 25 billion US dollars.",
      "รายงาน Eurodad ปี 2018 ระบุว่าการจัดซื้อของความช่วยเหลือมากกว่าครึ่งตกแก่บริษัทของประเทศผู้ให้เอง สหรัฐฯ ออสเตรเลีย และสหราชอาณาจักรส่งอย่างน้อย 90% ให้บริษัทของตน ขณะที่สหราชอาณาจักรและออสเตรเลียรายงานว่าความช่วยเหลือไม่ผูกพันทั้งหมด รายงานวางต้นทุนส่วนเพิ่มที่ 1.95–5.43 พันล้านดอลลาร์สหรัฐ และบอกว่าบริษัทในซีกใต้พลาดโดยเฉพาะในความช่วยเหลือทางเทคนิค รายงานวางความช่วยเหลือที่ผูกพันในทางรูปแบบที่ 25 พันล้านดอลลาร์สหรัฐ",
      "Eurodad 2018年的报告称，援助采购有一半以上给了捐助方自己的企业。美国、澳大利亚和英国各自把至少90%给了本国企业，而英国和澳大利亚把援助报告为完全不捆绑。报告把由此增加的成本写成19.5亿至54.3亿美元，并称南方企业尤其在技术援助上拿不到合同。形式上捆绑的援助被写成250亿美元。",
    ),
  },
  {
    id: "japan-peer-2020",
    scope: "general",
    confidence: "high",
    source: "https://www.oecd.org/en/publications/oecd-development-co-operation-peer-reviews-japan-2020_b2229106-en/full-report/component-5.html",
    claim: text(
      "The OECD’s 2020 peer review of Japan says the share of untied contracts going to Japanese firms in least-developed countries has risen since 2012. Untied bilateral assistance fell from 74.6% to 67.2%, with tied loans for adopting Japanese technology, including high-speed rail and metro systems. The review names the difficulty of pursuing development and commercial interests at the same time.",
      "การทบทวนโดยเพื่อนของ OECD ปี 2020 เรื่องญี่ปุ่นระบุว่าสัดส่วนสัญญาที่ไม่ผูกพันที่ตกแก่บริษัทญี่ปุ่นในประเทศพัฒนาน้อยที่สุดสูงขึ้นตั้งแต่ปี 2012 ความช่วยเหลือทวิภาคีที่ไม่ผูกพันลดจาก 74.6% เป็น 67.2% พร้อมสินเชื่อที่ผูกพันเพื่อใช้เทคโนโลยีญี่ปุ่น รวมรถไฟความเร็วสูงและรถไฟฟ้าในเมือง รายงานชี้ความยากของการไล่ตามผลประโยชน์ด้านการพัฒนาและผลประโยชน์ทางการค้าพร้อมกัน",
      "经合组织2020年对日本的同行审议称，在最不发达国家，不捆绑合同流向日本企业的份额自2012年以来上升。不捆绑双边援助从74.6%降到67.2%，其中有为采用日本技术而捆绑的贷款，包括高铁和地铁。审议指出同时追求发展利益和商业利益的困难。",
    ),
  },
  {
    id: "korea-peer-2024",
    scope: "general",
    confidence: "high",
    source: "https://www.oecd.org/en/publications/oecd-development-co-operation-peer-reviews-korea-2024_889c6564-en/full-report/component-10.html",
    claim: text(
      "The OECD’s 2024 peer review of Korea says 70.5% of Korean aid was untied on the books in 2021, while 31% of untied contract value in 2017–21 went to Korean entities. About 90% of tied aid went through KEXIM-EDCF infrastructure.",
      "การทบทวนโดยเพื่อนของ OECD ปี 2024 เรื่องเกาหลีระบุว่า 70.5% ของความช่วยเหลือเกาหลีไม่ผูกพันบนเอกสารในปี 2021 ขณะที่ 31% ของมูลค่าสัญญาที่ไม่ผูกพันในปี 2017–21 ตกแก่หน่วยงานเกาหลี ราว 90% ของความช่วยเหลือที่ผูกพันผ่านโครงสร้างพื้นฐานของ KEXIM-EDCF",
      "经合组织2024年对韩国的同行审议称，2021年韩国援助在账面上有70.5%不捆绑，而2017至2021年不捆绑合同金额的31%给了韩国实体。捆绑援助约有90%经由韩国进出口银行的经济发展合作基金用于基础设施。",
    ),
  },
  {
    id: "usaid-contractors",
    scope: "general",
    confidence: "high",
    source: "https://pages.devex.com/rs/685-KBL-765/images/where-the-united-states-spends-its-development-aid_Sept23.pdf",
    claim: text(
      "A Devex analysis of USAspending says US-based contractors won about 87.6% of USAID contract obligations from 2013 to 2022. All ten largest contractors were US-based. In 2022, 86.1% of assistance was procured in Washington.",
      "การวิเคราะห์ USAspending ของ Devex ระบุว่าผู้รับเหมาที่ตั้งในสหรัฐฯ ได้ราว 87.6% ของภาระผูกพันตามสัญญาของ USAID ตั้งแต่ปี 2013 ถึง 2022 ผู้รับเหมาสิบรายใหญ่สุดตั้งในสหรัฐฯ ทั้งหมด ในปี 2022 มีการจัดซื้อความช่วยเหลือ 86.1% ในวอชิงตัน",
      "Devex 对 USAspending 的分析称，2013至2022年美国本土承包商拿到了美国国际开发署合同义务的约87.6%。前十大承包商都在美国。2022年有86.1%的援助在华盛顿采购。",
    ),
  },
  {
    id: "usaid-local-2024",
    scope: "general",
    confidence: "medium",
    source: "https://www.devex.com/news/devex-newswire-usaid-gets-a-jolt-of-good-news-on-localization-109061",
    claim: text(
      "A Devex report on USAID localisation says direct funding to local partners was 11.2% (1.9 billion US dollars) in fiscal year 2024, or 12.1% when government-to-government aid is included.",
      "รายงาน Devex เรื่องการทำให้ USAID ท้องถิ่นขึ้นระบุว่าเงินตรงถึงพันธมิตรท้องถิ่นอยู่ที่ 11.2% (1.9 พันล้านดอลลาร์สหรัฐ) ในปีงบประมาณ 2024 หรือ 12.1% เมื่อรวมความช่วยเหลือรัฐต่อรัฐ",
      "Devex 关于美国国际开发署本地化的报道称，2024财年直接给本地伙伴的资金为11.2%（19亿美元），把政府对政府援助算进去是12.1%。",
    ),
  },
  {
    id: "dfat-procurement-2025",
    scope: "general",
    confidence: "high",
    source: "https://devpolicy.org/2025-australian-aid-procurement-update-20251121/",
    claim: text(
      "A 2025 Devpolicy review of Australian aid procurement says about 90% of contract value went to Australian-registered firms, which are largely foreign-owned. Commercial contractors delivered 25% of official development assistance in 2023–24, and the ten largest hold about 80% or more.",
      "บททบทวนปี 2025 ของ Devpolicy เรื่องการจัดซื้อความช่วยเหลือออสเตรเลียระบุว่ามูลค่าสัญญาประมาณ 90% ตกแก่บริษัทที่จดทะเบียนในออสเตรเลีย ซึ่งส่วนใหญ่มีเจ้าของเป็นชาวต่างชาติ ผู้รับเหมาเชิงพาณิชย์ส่งมอบ 25% ของความช่วยเหลือเพื่อการพัฒนาอย่างเป็นทางการในปี 2023–24 และสิบรายใหญ่สุดถือราว 80% หรือมากกว่า",
      "Devpolicy 2025年对澳大利亚援助采购的综述称，约90%的合同金额给了在澳大利亚注册的企业，这些企业多数为外资所有。商业承包商在2023至2024年交付了官方发展援助的25%，最大的十家约占80%或更多。",
    ),
  },
  {
    id: "mlit-market",
    scope: "ascn",
    confidence: "high",
    source: "https://www.mlit.go.jp/kokusai/content/001621832.pdf",
    claim: text(
      "Japan’s transport ministry says ASEAN smart cities are an attractive market and that it supports Japanese companies’ entry. The same document describes a 50 billion yen investment window at JOIN and a 200 billion yen loan window at JBIC. Those are finance windows, not a grant.",
      "กระทรวงคมนาคมของญี่ปุ่นระบุว่าเมืองอัจฉริยะอาเซียนเป็นตลาดที่น่าสนใจ และว่ากระทรวงสนับสนุนการเข้ามาของบริษัทญี่ปุ่น เอกสารเดียวกันบรรยายวงเงินลงทุน 50 พันล้านเยนที่ JOIN และวงเงินกู้ 200 พันล้านเยนที่ JBIC วงเงินเหล่านี้เป็นหน้าต่างการเงิน ไม่ใช่เงินให้เปล่า",
      "日本国土交通省称，东盟智慧城市是一个有吸引力的市场，并支持日本企业进入。同一文件描述了 JOIN 的500亿日元投资额度窗口和 JBIC 的2000亿日元贷款额度窗口。这些是融资窗口，不是赠款。",
    ),
  },
  {
    id: "smartjamp-firms",
    scope: "ascn",
    confidence: "high",
    source: "https://www.jasca2021.jp/pdf/SmartJAMP_en.pdf",
    claim: text(
      "Smart JAMP studies of the 26 ASCN cities are carried out by Japanese companies, chosen through a public call. Embassy contact points support Japanese private companies.",
      "การศึกษา Smart JAMP ของ 26 เมือง ASCN ดำเนินการโดยบริษัทญี่ปุ่นที่ได้รับเลือกจากการเปิดเรียกรับ จุดติดต่อของสถานทูตสนับสนุนบริษัทเอกชนญี่ปุ่น",
      "针对26个 ASCN 城市的 Smart JAMP 研究由日本企业经公开征集来做。使馆联络点支持日本私营企业。",
    ),
  },
  {
    id: "cabinet-strategy-2030",
    scope: "general",
    confidence: "high",
    source: "https://www.cas.go.jp/jp/seisakukaigi/keikyou/dai58/siryou6.pdf",
    claim: text(
      "Japan’s Cabinet Infrastructure System Overseas Expansion Strategy 2030 aims to win projects in smart cities and transit-oriented development, using JASCA matching and international standardisation of urban operating systems. This strategy is not an ASCN document.",
      "ยุทธศาสตร์ขยายระบบโครงสร้างพื้นฐานสู่ต่างประเทศปี 2030 ของคณะรัฐมนตรีญี่ปุ่นมุ่งชนะโครงการในเมืองอัจฉริยะและการพัฒนาที่ผูกกับระบบขนส่ง โดยใช้การจับคู่ของ JASCA และการทำให้ระบบปฏิบัติการเมืองเป็นมาตรฐานสากล ยุทธศาสตร์นี้ไม่ใช่เอกสารของ ASCN",
      "日本内阁《基础设施系统海外拓展战略2030》旨在通过 JASCA 对接和城市操作系统的国际标准化，在智慧城市和公共交通导向开发中赢得项目。这份战略不是 ASCN 的文件。",
    ),
  },
  {
    id: "kcity-export-purpose",
    scope: "general",
    confidence: "high",
    source: "https://www.kindkorea.or.kr/business/k_network?lang=en",
    claim: text(
      "K-City Network’s stated purpose includes opportunities for Korean companies to export and contract smart-city technology. It records 61 projects in 29 countries from 2020 to 2026. The programme is not ASCN-branded.",
      "วัตถุประสงค์ที่ K-City Network เขียนไว้รวมโอกาสให้บริษัทเกาหลีส่งออกและรับเหมาเทคโนโลยีเมืองอัจฉริยะ มีบันทึก 61 โครงการใน 29 ประเทศตั้งแต่ปี 2020 ถึง 2026 โปรแกรมนี้ไม่ได้ใช้ชื่อ ASCN",
      "K-City Network 写明的目的包括让韩国企业获得出口和承包智慧城市技术的机会。它记录了2020至2026年在29个国家的61个项目。该计划并不以 ASCN 为名。",
    ),
  },
  {
    id: "kcity-domestic-call",
    scope: "general",
    confidence: "high",
    source: "https://smartcity.go.kr/en/2026/01/28/2026%EB%85%84-k-city-network-%ED%95%B4%EC%99%B8%EC%8B%A4%EC%A6%9D%ED%98%95-%EC%82%AC%EC%97%85-%EA%B3%B5%EB%AA%A8/",
    claim: text(
      "The 2026 K-City Network overseas demonstration call is open only to Korean companies with solutions already proven in Korea. It describes about 3–4 billion won per project, across 6 projects.",
      "การเปิดรับสาธิตต่างประเทศของ K-City Network ปี 2026 เปิดเฉพาะบริษัทเกาหลีที่มีทางออกซึ่งพิสูจน์แล้วในเกาหลี ระบุราว 3–4 พันล้านวอนต่อโครงการ รวม 6 โครงการ",
      "2026年 K-City Network 海外示范征集只对已在韩国验证过方案的韩国企业开放。它写成每个项目约30亿至40亿韩元，共6个项目。",
    ),
  },
  {
    id: "kcity-cumulative",
    scope: "general",
    confidence: "high",
    source: "https://www.kcitynetwork.go.kr/eng/index.do",
    claim: text(
      "K-City Network states cumulative support of 27.7 billion won, 57 projects and 30 partner countries. The stated objective is supporting Korean companies’ overseas expansion. This total covers all countries. It is not added to the Korean fund line.",
      "K-City Network ระบุการสนับสนุนสะสม 27.7 พันล้านวอน 57 โครงการ และ 30 ประเทศหุ้นส่วน วัตถุประสงค์ที่เขียนไว้คือสนับสนุนการขยายต่างประเทศของบริษัทเกาหลี ยอดนี้ครอบคลุมทุกประเทศ ไม่ถูกนำไปบวกในบรรทัดกองทุนเกาหลี",
      "K-City Network 称累计支持277亿韩元、57个项目、30个伙伴国家。写明的目标是支持韩国企业海外拓展。这个总额覆盖所有国家，不计入韩国基金那一行。",
    ),
  },
  {
    id: "kcity-asean-demos",
    scope: "general",
    confidence: "medium",
    source: "https://www.newspim.com/news/view/20240502000262",
    qualifier: QUALIFIER_CITIES,
    claim: text(
      "A 2024 report describes K-City demonstrations in Hue, Jakarta, Puerto Princesa and Siem Reap. The Korean firm GreeGo calls the work a chance to export its platform.",
      "รายงานปี 2024 บรรยายการสาธิต K-City ที่เว้ จาการ์ตา ปูเอร์โตปริงเซซา และเสียมราฐ บริษัทเกาหลี GreeGo เรียกงานนี้ว่าโอกาสส่งออกแพลตฟอร์มของตน",
      "2024年的一篇报道描述了在顺化、雅加达、公主港和暹粒的 K-City 示范。韩国企业 GreeGo 称这是出口其平台的机会。",
    ),
  },
  {
    id: "usascp-export-visits",
    scope: "ascn",
    confidence: "high",
    source: "https://www.usascp.org/programs/business-promotion/",
    claim: text(
      "USASCP expert delegations were described as advancing the relevance of U.S. capabilities and projected opportunities for U.S. export successes. The same programme funded ASCN officials’ travel to trade events, with introductions to U.S. companies.",
      "คณะผู้เชี่ยวชาญของ USASCP ถูกบรรยายว่าแสดงความเกี่ยวข้องของศักยภาพสหรัฐฯ และโอกาสที่คาดว่าจะส่งออกสำเร็จ โปรแกรมเดียวกันสนับสนุนการเดินทางของเจ้าหน้าที่ ASCN ไปงานการค้า พร้อมการแนะนำบริษัทสหรัฐฯ",
      "USASCP 的专家代表团被写成用于展示美国能力的相关性，以及预计中的美国出口机会。同一项目资助 ASCN 官员前往贸易活动，并安排与美国企业见面。",
    ),
  },
  {
    id: "ita-us-exports",
    scope: "ascn",
    confidence: "high",
    source: "https://www.trade.gov/feature-article/ita-connects-smart-city-technology-exporters-southeast-asia",
    claim: text(
      "The International Trade Administration describes its programming under USASCP as work to promote U.S. exports and to advocate for U.S. smart-city solutions.",
      "ฝ่ายบริหารการค้าระหว่างประเทศบรรยายงานภายใต้ USASCP ว่าเป็นงานส่งเสริมการส่งออกของสหรัฐฯ และสนับสนุนทางออกเมืองอัจฉริยะของสหรัฐฯ",
      "美国国际贸易管理局把其在 USASCP 下的工作写成促进美国出口，并为美国智慧城市方案做倡导。",
    ),
  },
  {
    id: "usascp-indo-pacific",
    scope: "ascn",
    confidence: "high",
    source: "https://www.usascp.org/programs/",
    claim: text(
      "USASCP describes itself as a key deliverable of the U.S. Indo-Pacific Strategy.",
      "USASCP บรรยายตนเองว่าเป็นผลส่งมอบสำคัญของยุทธศาสตร์อินโดแปซิฟิกของสหรัฐฯ",
      "USASCP 把自己写成美国印太战略的一项关键成果。",
    ),
  },
  {
    id: "ustda-trade-mission",
    scope: "general",
    confidence: "high",
    source: "https://ustda.gov/event/southeast-asia-climate-smart-transportation-reverse-trade-mission/",
    claim: text(
      "A USTDA reverse trade mission in 2022 brought Southeast Asian transport officials, including officials from Thailand, to the United States to meet U.S. companies. The mission is not branded as ASCN.",
      "คณะการค้าย้อนทางของ USTDA ในปี 2022 พาเจ้าหน้าที่คมนาคมเอเชียตะวันออกเฉียงใต้ รวมเจ้าหน้าที่จากไทย ไปสหรัฐฯ เพื่อพบบริษัทสหรัฐฯ คณะนี้ไม่ได้ใช้ชื่อ ASCN",
      "2022年美国贸易发展署的一次反向贸易代表团把东南亚交通官员，包括泰国官员，带到美国与美国企业见面。这次活动并不以 ASCN 为名。",
    ),
  },
];

function scopeOf(value, id) {
  const raw = String(value || "").trim();
  if (/^ASCN-SPECIFIC\b/i.test(raw)) return "ascn";
  if (/^GENERAL\b/i.test(raw)) return "general";
  fail(`${id || "tied-aid row"} scope must start with GENERAL or ASCN-SPECIFIC`);
}

function confidenceOf(value, id) {
  const match = String(value || "").trim().match(/^(high|medium)\b/i);
  if (!match) fail(`${id || "tied-aid row"} confidence must start with high or medium`);
  return match[1].toLowerCase();
}

export function tiedAidClaims(rows) {
  if (!Array.isArray(rows)) fail("Tied-aid rows must be an array");
  if (rows.length !== CLAIMS.length) {
    fail(`tied-aid.csv has ${rows.length} rows; the public wording covers ${CLAIMS.length}`);
  }
  return rows.map((row, index) => {
    const claim = CLAIMS[index];
    if (row.source_url !== claim.source) {
      fail(`tied-aid row ${index + 1} source is ${row.source_url || "(blank)"}; expected ${claim.source}`);
    }
    const scope = scopeOf(row.scope, claim.id);
    if (scope !== claim.scope) fail(`${claim.id} is ${scope} in the CSV and ${claim.scope} in the wording`);
    const confidence = confidenceOf(row.confidence, claim.id);
    if (confidence !== claim.confidence) fail(`${claim.id} confidence does not match the CSV`);
    const caveat = /not ASCN-branded/i.test(row.scope || "");
    if (caveat !== Boolean(claim.qualifier)) fail(`${claim.id} qualifier does not match the CSV scope note`);
    if (!row.donor || !row.year) fail(`${claim.id} is missing donor or year`);
    const out = {
      id: claim.id,
      scope,
      claim: claim.claim,
      donor: row.donor,
      year: row.year,
      source: row.source_url,
      confidence,
    };
    if (row.figure && !/^n\/a$/i.test(row.figure)) out.figure = row.figure;
    if (claim.qualifier) out.qualifier = claim.qualifier;
    return out;
  });
}

export function programmeRows(rows) {
  if (!Array.isArray(rows) || !rows.length) fail("Programmes CSV has no rows");
  const items = [];
  const merged = [];
  const seen = new Set();
  // Programme titles are typed by hand into a CSV, so "depa" and "DEPA" will
  // both arrive. Keyed on exact wording, the lookup rejected the source CSV the
  // moment the published copy was capitalised — the same wording the inbox
  // itself uses. Match on the folded name so the casing of a name is never what
  // decides whether it is recognised.
  const byName = new Map(Object.entries(PROGRAMMES).map(([key, value]) => [key.trim().toLowerCase(), value]));
  for (const row of rows) {
    const name = row.programme || "";
    const spec = byName.get(name.trim().toLowerCase());
    if (!spec) fail(`No public wording for programme ${name || "(blank)"}`);
    if (seen.has(name.trim().toLowerCase())) fail(`Duplicate programme ${name}`);
    seen.add(name);
    if (row.source_url !== spec.source) fail(`Programme ${name} source is ${row.source_url || "(blank)"}`);
    if (spec.yearIncludes && !(row.year || "").includes(spec.yearIncludes)) {
      fail(`Programme ${name} year is ${row.year || "(blank)"}`);
    }
    if (spec.into) merged.push({ programme: name, into: spec.into, source: row.source_url });
    else items.push(spec.item);
  }
  return { items, merged };
}

const KEPT_AUSTRALIA = text(
  "Australia stays at AUD 21000000 committed: 20000000 in 2019 and 1000000 in 2023. Disbursed stays at AUD 13180000, received by the fund by the end of 2020. Receipt of the 2023 top-up is still not public.",
  "ออสเตรเลียคงที่ AUD 21000000 ที่ให้คำมั่น: 20000000 ในปี 2019 และ 1000000 ในปี 2023 ยอดจ่ายแล้วคงที่ AUD 13180000 ซึ่งกองทุนได้รับภายในสิ้นปี 2020 การรับเงินสมทบปี 2023 ยังไม่เปิดเผย",
  "澳大利亚的承诺仍是 AUD 21000000：2019年20000000，2023年1000000。已拨付仍是 AUD 13180000，即基金在2020年底前收到的金额。2023年追加出资的到账仍然没有公开。",
);
const KEPT_KOREA = text(
  "Korea’s committed line stays at KRW 1500000000000 and is not specific to ASCN. The K-City figure of 27.7 billion won covers all countries. It is a different programme and is not added to that total.",
  "บรรทัดให้คำมั่นของเกาหลีคงที่ KRW 1500000000000 และไม่ได้เจาะจงที่ ASCN ตัวเลข K-City ที่ 27.7 พันล้านวอนครอบคลุมทุกประเทศ เป็นคนละโปรแกรม และไม่ถูกนำไปบวกในยอดนั้น",
  "韩国的承诺一行仍是 KRW 1500000000000，并不专属于 ASCN。K-City 的277亿韩元覆盖所有国家。它是另一个计划，不加进那个总额。",
);
const KEPT_KOREA_ONLY = text(
  "Korea’s committed line stays at KRW 1500000000000 and is not specific to ASCN.",
  "บรรทัดให้คำมั่นของเกาหลีคงที่ KRW 1500000000000 และไม่ได้เจาะจงที่ ASCN",
  "韩国的承诺一行仍是 KRW 1500000000000，并不专属于 ASCN。",
);
const KEPT_US = text(
  "The United States stays at USD 10000000 committed. The donor sheet’s initial figure matches that row. A later self-reported description of the same commitment as over that amount is not added. No disbursed total is public.",
  "สหรัฐฯ คงที่ USD 10000000 ที่ให้คำมั่น ตัวเลขเริ่มต้นในตารางผู้ให้ตรงกับแถวนั้น คำบรรยายในภายหลังที่รายงานเองว่าคำมั่นก้อนเดียวกันมากกว่าจำนวนนี้ไม่ถูกนำไปบวก ไม่มียอดจ่ายแล้วที่เปิดเผย",
  "美国的承诺仍是 USD 10000000。供资表上的初始数字与这一行相符。后来把同一笔承诺自行说成超过该数的说法不计入。没有公开的已拨付总额。",
);
const KEPT_UNKNOWN = text(
  "ASUS, the ASEAN-Korea training programme, Smart JAMP study costs, and the Khon Kaen study stay without a public total, matching the donor sheet.",
  "ASUS โปรแกรมอบรมอาเซียน–เกาหลี ต้นทุนการศึกษา Smart JAMP และการศึกษาขอนแก่น ยังไม่มียอดที่เปิดเผย ตรงกับตารางผู้ให้",
  "ASUS、东盟—韩国培训项目、Smart JAMP 研究费用和孔敬研究仍然没有公开总额，与供资表一致。",
);
const KEPT_DEPA = text(
  "Unsourced personal statements are excluded from public findings.",
  "ไม่รวมถ้อยคำส่วนตัวที่ไม่มีแหล่งอ้างอิงในข้อค้นพบสาธารณะ",
  "没有公开来源的个人陈述不计入公开结论。",
);
const YEN_CONFLICT = text(
  "The partners page states a 250 billion yen fund, also given as 2.4 billion US dollars for ASEAN. The transport ministry document describes a 50 billion yen investment window at JOIN and a 200 billion yen loan window at JBIC. Those windows are not a grant, and they are not added. Japan’s committed and disbursed lines stay without a public grant total.",
  "หน้าพันธมิตรระบุกองทุน 250 พันล้านเยน ซึ่งเขียนด้วยว่า 2.4 พันล้านดอลลาร์สหรัฐสำหรับอาเซียน เอกสารกระทรวงคมนาคมบรรยายวงเงินลงทุน 50 พันล้านเยนที่ JOIN และวงเงินกู้ 200 พันล้านเยนที่ JBIC วงเงินเหล่านี้ไม่ใช่เงินให้เปล่า และไม่ถูกนำไปบวก บรรทัดให้คำมั่นและจ่ายแล้วของญี่ปุ่นยังไม่มียอดเงินให้เปล่าที่เปิดเผย",
  "合作伙伴页面称有一笔2500亿日元的基金，并写成面向东盟的24亿美元。国土交通省的文件描述的是 JOIN 的500亿日元投资额度窗口和 JBIC 的2000亿日元贷款额度窗口。这些窗口不是赠款，也不计入合计。日本的承诺与已拨付两行仍然没有公开的赠款总额。",
);

function isUnknown(value) {
  const text = String(value || "").trim();
  return !text || /^(unknown|n\/a)\b/i.test(text);
}

function httpsOf(value) {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) ? url : "";
}

export function reconcileDonorSheet(rows) {
  if (!Array.isArray(rows) || !rows.length) return { kept: [], conflicts: [] };
  const conflicts = [];
  let sawAustralia = false;
  let sawUs = false;
  let sawKcity = false;
  let sawUnknown = false;
  let sawDepa = false;
  let sawKorea = false;
  for (const row of rows) {
    const programme = row.programme || "";
    const committed = row.committed || "";
    const disbursed = row.disbursed || "";
    const donor = row.donor || "";
    const label = programme || donor || "unnamed row";
    if (/finance windows|not grants/i.test(`${programme} ${committed}`)) {
      const sources = [httpsOf(row.source_url), PARTNERS].filter(Boolean);
      conflicts.push({ text: YEN_CONFLICT, sources: [...new Set(sources)] });
    } else if (/AASCTF|Smart Cities Trust Fund/i.test(programme)) {
      sawAustralia = true;
      if (!/A\$20m/.test(committed) || !/A\$1m/.test(committed) || !/A\$13\.18m/.test(disbursed)) {
        conflicts.push({
          text: text(
            `The donor sheet’s Australian trust-fund row does not state A$20m plus A$1m committed and A$13.18m received by the end of 2020. The archive still shows AUD 21000000 committed and AUD 13180000 disbursed.`,
            `แถวกองทุนทรัสต์ของออสเตรเลียในตารางผู้ให้ไม่ได้ระบุคำมั่น A$20m บวก A$1m และเงินที่ได้รับภายในสิ้นปี 2020 จำนวน A$13.18m คลังยังแสดงคำมั่น AUD 21000000 และยอดจ่ายแล้ว AUD 13180000`,
            `供资表上的澳大利亚信托基金一行并没有写成承诺 A$20m 加 A$1m、以及到2020年底收到 A$13.18m。档案仍显示承诺 AUD 21000000、已拨付 AUD 13180000。`,
          ),
          sources: [httpsOf(row.source_url) || PARTNERS].filter(Boolean),
        });
      }
    } else if (/USASCP/i.test(programme)) {
      sawUs = true;
      if (!/US\$10m/i.test(committed)) {
        conflicts.push({
          text: text(
            "The donor sheet’s USASCP row does not state an initial US$10m. The archive still shows USD 10000000 committed and does not add a second figure.",
            "แถว USASCP ในตารางผู้ให้ไม่ได้ระบุ US$10m เริ่มต้น คลังยังแสดงคำมั่น USD 10000000 และไม่บวกตัวเลขที่สอง",
            "供资表上的 USASCP 一行并没有写成初始 US$10m。档案仍显示承诺 USD 10000000，不加第二笔数字。",
          ),
          sources: [httpsOf(row.source_url) || "https://www.usascp.org/vice-president-announces-usascp-at-6th-asean-u-s-summit/"],
        });
      }
    } else if (/Khon Kaen/i.test(programme)) {
      sawUnknown = true;
      if (!isUnknown(committed) || !isUnknown(disbursed)) {
        conflicts.push({
          text: text(
            "The donor sheet states a figure for the Khon Kaen study. It was not added.",
            "ตารางผู้ให้ระบุตัวเลขสำหรับการศึกษาขอนแก่น ไม่ถูกนำไปบวก",
            "供资表为孔敬研究写了一个数字。没有计入。",
          ),
          sources: [httpsOf(row.source_url) || PARTNERS],
        });
      }
    } else if (/K-City Network/i.test(programme)) {
      sawKcity = true;
      sawKorea = true;
      if (!/27\.7/.test(committed)) {
        conflicts.push({
          text: text(
            "The donor sheet’s K-City row does not state 27.7 billion won. No K-City figure was added to the Korean fund line.",
            "แถว K-City ในตารางผู้ให้ไม่ได้ระบุ 27.7 พันล้านวอน ไม่มีตัวเลข K-City ถูกนำไปบวกในบรรทัดกองทุนเกาหลี",
            "供资表上的 K-City 一行并没有写成277亿韩元。没有任何 K-City 数字被加进韩国基金一行。",
          ),
          sources: [httpsOf(row.source_url) || "https://www.kcitynetwork.go.kr/eng/index.do"],
        });
      }
    } else if (/ASUS/i.test(programme) || /ASPP/i.test(programme) || /Smart JAMP studies/i.test(programme)) {
      sawUnknown = true;
      if (!isUnknown(committed) || !isUnknown(disbursed)) {
        conflicts.push({
          text: text(
            `The donor sheet states a figure for ${label}. It was not added to a donor total.`,
            `ตารางผู้ให้ระบุตัวเลขสำหรับ ${label} ไม่ถูกนำไปบวกในยอดของผู้ให้`,
            `供资表为 ${label} 写了一个数字。没有计入任何供资方合计。`,
          ),
          sources: [httpsOf(row.source_url) || PARTNERS],
        });
      }
    } else if (/DEPA/i.test(donor) || /DEPA/i.test(programme) || /Receipt of donor/i.test(programme)) {
      sawDepa = true;
      if (httpsOf(row.source_url)) {
        conflicts.push({
          text: text(
            "The donor sheet attaches a source to the DEPA receipt line. The archive does not. The line stays an unsourced account.",
            "ตารางผู้ให้ใส่แหล่งให้แถวการรับเงินของ DEPA คลังไม่ใส่ แถวนั้นยังเป็นคำบอกที่ไม่มีแหล่ง",
            "供资表给 DEPA 收款一行附了来源。档案不附。这一行仍是没有出处的说法。",
          ),
          sources: [httpsOf(row.source_url)],
        });
      }
    } else if (/Korea/i.test(donor)) {
      sawKorea = true;
    } else {
      conflicts.push({
        text: text(
          `The donor sheet has a row for ${label}. It was not written over a headline total.`,
          `ตารางผู้ให้มีแถวสำหรับ ${label} ไม่ได้ถูกเขียนทับยอดหัวเรื่อง`,
          `供资表有一行 ${label}。没有用它改写任何标题总额。`,
        ),
        sources: [httpsOf(row.source_url) || PARTNERS],
      });
    }
  }
  const kept = [];
  if (sawAustralia) kept.push(KEPT_AUSTRALIA);
  if (sawKorea || sawKcity) kept.push(sawKcity ? KEPT_KOREA : KEPT_KOREA_ONLY);
  if (sawUs) kept.push(KEPT_US);
  if (sawUnknown) kept.push(KEPT_UNKNOWN);
  if (sawDepa) kept.push(KEPT_DEPA);
  return { kept, conflicts };
}
