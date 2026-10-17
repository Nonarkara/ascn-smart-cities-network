// Public-page wording for rows in public/records.csv. The CSV summary is never copied:
// titles, notes and counterparts below are the only text that can be published.
// F06, M05 and F11 are not separate items; MERGE patches the inbox record they repeat.

const org = (en, th, zh) => ({ en, th, zh });
const text = (en, th, zh) => ({ en, th, zh });

const MLIT = org(
  "Ministry of Land, Infrastructure, Transport and Tourism (Japan)",
  "กระทรวงที่ดิน โครงสร้างพื้นฐาน การขนส่ง และการท่องเที่ยว (ญี่ปุ่น)",
  "日本国土交通省",
);
const ASEAN = org("ASEAN Secretariat", "สำนักเลขาธิการอาเซียน", "东盟秘书处");
const STATE = org("U.S. Department of State", "กระทรวงการต่างประเทศสหรัฐฯ", "美国国务院");
const DFAT = org(
  "Australia Department of Foreign Affairs and Trade",
  "กระทรวงการต่างประเทศและการค้าออสเตรเลีย",
  "澳大利亚外交贸易部",
);
const ADB = org("Asian Development Bank", "ธนาคารพัฒนาเอเชีย", "亚洲开发银行");
const KMOLIT = org(
  "Ministry of Land, Infrastructure and Transport (Korea)",
  "กระทรวงที่ดิน โครงสร้างพื้นฐาน และการขนส่ง (เกาหลี)",
  "韩国国土交通部",
);
const SMFA = org(
  "Ministry of Foreign Affairs (Singapore)",
  "กระทรวงการต่างประเทศ (สิงคโปร์)",
  "新加坡外交部",
);
const AKCF = org("ASEAN-Korea Cooperation Fund", "กองทุนความร่วมมืออาเซียน–เกาหลี", "东盟—韩国合作基金");
const SNU = org("Seoul National University", "มหาวิทยาลัยแห่งชาติโซล", "首尔大学");
const AUS4 = org("Aus4ASEAN Futures", "Aus4ASEAN Futures", "Aus4ASEAN Futures");
const NZ = org(
  "Ministry of Foreign Affairs and Trade (New Zealand)",
  "กระทรวงการต่างประเทศและการค้า (นิวซีแลนด์)",
  "新西兰外交贸易部",
);

export const SCRAPE_ALIAS = {
  F06: "hlm2-2020",
  M05: "hlm6-2024",
  F11: "financing-toolkit-2024",
};

export const MERGE = {
  F06: {
    outcome: "partial",
    counterpart: MLIT,
    title: text(
      "2nd ASEAN-Japan Smart Cities Network High Level Meeting (Smart JAMP proposed)",
      "การประชุมระดับสูงเครือข่ายเมืองอัจฉริยะอาเซียน–ญี่ปุ่น ครั้งที่ 2 (มีการเสนอ Smart JAMP)",
      "第2届东盟—日本智慧城市网络高层会议（提出 Smart JAMP）",
    ),
    note: text(
      "Japan’s land and transport ministry proposed Smart JAMP at the December 2020 high-level meeting: studies and help forming projects. No programme budget is public. A later letter in this inbox only adds that a presentation was given.",
      "กระทรวงที่ดินและขนส่งของญี่ปุ่นเสนอ Smart JAMP ในการประชุมระดับสูงเดือนธันวาคม 2020 เป็นการศึกษาและการช่วยจัดรูปโครงการ ไม่มีงบประมาณของโปรแกรมที่เปิดเผย จดหมายภายหลังในกล่องนี้บอกเพิ่มเพียงว่ามีการนำเสนอ",
      "日本国土交通省在2020年12月的高层会议上提出 Smart JAMP：开展研究并协助形成项目。没有公开的项目总预算。此收件箱里后来的信只补充说做过一次介绍。",
    ),
  },
  M05: {
    outcome: "partial",
    note: text(
      "A public summary record of the October 2024 meeting says the high-level meetings would continue and that Japan would compile Smart JAMP case studies. The case studies are only promised here. This inbox does not confirm that a Thai panel was delivered.",
      "บันทึกสรุปสาธารณะของการประชุมเดือนตุลาคม 2024 ระบุว่าการประชุมระดับสูงจะดำเนินต่อ และญี่ปุ่นจะรวบรวมกรณีศึกษา Smart JAMP กรณีศึกษาเป็นเพียงคำมั่นในบันทึกนี้ กล่องจดหมายนี้ไม่ได้ยืนยันว่าไทยขึ้นเวทีแล้ว",
      "2024年10月会议的公开纪要写明高层会议将继续，日本将汇编 Smart JAMP 案例。案例在这里只是一项承诺。此收件箱不能确认泰方发言已经完成。",
    ),
  },
  F11: {
    outcome: "partial",
    selfReported: true,
    counterpart: AUS4,
    note: text(
      "The financing toolkit was launched in Jakarta. The public confirmation is ASEAN’s own 2025 monitoring report, so this row is self-reported. No financing deal after the launch is visible, and no amount is disclosed.",
      "ชุดเครื่องมือการเงินเปิดตัวที่จาการ์ตา แหล่งที่ยืนยันต่อสาธารณะคือรายงานติดตามของอาเซียนเองในปี 2025 จึงจัดแถวนี้เป็นรายงานเอง ไม่ปรากฏข้อตกลงด้านการเงินหลังการเปิดตัว และไม่มีการเปิดเผยจำนวนเงิน",
      "融资工具包在雅加达发布。公开确认来自东盟自己的2025年监测报告，因此本行标为自行报告。发布之后未见融资协议，金额也未披露。",
    ),
  },
};

export const PENDING = {
  E01: {
    counterpart: DFAT,
    title: text(
      "Mid-term review of the ASEAN Australia Smart Cities Trust Fund (2022)",
      "รายงานทบทวนกลางทางของกองทุนเมืองอัจฉริยะอาเซียน–ออสเตรเลีย (2022)",
      "东盟澳大利亚智慧城市信托基金中期审查（2022）",
    ),
    note: text(
      "Pending review. The full text has not been read, so this row states no findings.",
      "รอการทบทวน ยังไม่ได้อ่านข้อความฉบับเต็ม จึงไม่ระบุข้อค้นพบในแถวนี้",
      "待审阅。全文尚未读过，所以这一行不陈述任何结论。",
    ),
  },
};

const argued = (en, th, zh) => text(
  `${en} This is a published argument, not an ASEAN project result.`,
  `${th} นี่เป็นข้อถกเถียงที่ตีพิมพ์แล้ว ไม่ใช่ผลของโครงการอาเซียน`,
  `${zh}这是已发表的论点，不是东盟项目的结果。`,
);

export const SCRAPE = {
  F01: {
    type: "grant",
    outcome: "delivered",
    publicAmount: true,
    counterpart: STATE,
    title: text(
      "U.S.–ASEAN Smart Cities Partnership announced",
      "ประกาศความร่วมมือเมืองอัจฉริยะสหรัฐ–อาเซียน",
      "美国—东盟智慧城市伙伴关系宣布成立",
    ),
    note: text(
      "The partnership was announced on 15 November 2018 with an initial commitment of USD 10000000. This is the launch, not the later call for pilot cities.",
      "ความร่วมมือประกาศเมื่อ 15 พฤศจิกายน 2018 พร้อมเงินเริ่มต้น USD 10000000 นี่คือการเปิดตัว ไม่ใช่การเปิดรับเมืองนำร่องในภายหลัง",
      "伙伴关系于2018年11月15日宣布，初始承诺为 USD 10000000。这是启动，不是后来的试点城市征集。",
    ),
  },
  F02: {
    type: "grant",
    outcome: "partial",
    publicAmount: true,
    selfReported: true,
    counterpart: STATE,
    title: text(
      "U.S.–ASEAN Smart Cities Partnership: later portfolio claim",
      "ความร่วมมือเมืองอัจฉริยะสหรัฐ–อาเซียน: ข้ออ้างขนาดพอร์ตในภายหลัง",
      "美国—东盟智慧城市伙伴关系：后来的组合规模说法",
    ),
    note: text(
      "The partnership’s own 2024 flyer says that since 2018 it has committed over USD 10000000 to more than 20 projects. That figure is self-reported, not an independent audit.",
      "ใบปลิวปี 2024 ของความร่วมมือเองระบุว่าตั้งแต่ปี 2018 ได้ให้เงินกว่า USD 10000000 แก่โครงการมากกว่า 20 โครงการ ตัวเลขนี้เป็นรายงานเอง ไม่ใช่การตรวจสอบอิสระ",
      "伙伴关系自己的2024年单页称，自2018年以来已向20多个项目承诺超过 USD 10000000。该数字是自行报告，不是独立审计。",
    ),
  },
  F03: {
    type: "grant",
    outcome: "delivered",
    publicAmount: true,
    counterpart: ADB,
    title: text(
      "ASEAN Australia Smart Cities Trust Fund established",
      "จัดตั้งกองทุนเมืองอัจฉริยะอาเซียน–ออสเตรเลีย",
      "设立东盟澳大利亚智慧城市信托基金",
    ),
    note: text(
      "Australia’s foreign ministry committed AUD 20000000 (about USD 13940000) on 2 April 2019, through the Asian Development Bank. AUD 13180000 had been received by the end of 2020. The fund was scheduled to close by 30 June 2024.",
      "กระทรวงการต่างประเทศออสเตรเลียให้คำมั่น AUD 20000000 (ราว USD 13940000) เมื่อ 2 เมษายน 2019 ผ่านธนาคารพัฒนาเอเชีย ภายในสิ้นปี 2020 ได้รับแล้ว AUD 13180000 กองทุนกำหนดปิดภายใน 30 มิถุนายน 2024",
      "澳大利亚外交贸易部于2019年4月2日通过亚洲开发银行承诺 AUD 20000000（约 USD 13940000）。到2020年底已实际收到 AUD 13180000。基金原定于2024年6月30日前关闭。",
    ),
  },
  F04: {
    type: "grant",
    outcome: "delivered",
    publicAmount: true,
    counterpart: ADB,
    title: text(
      "Additional Australian contribution to the ASEAN Australia Smart Cities Trust Fund",
      "เงินสมทบเพิ่มจากออสเตรเลียให้กองทุนเมืองอัจฉริยะอาเซียน–ออสเตรเลีย",
      "澳大利亚对东盟澳大利亚智慧城市信托基金的追加出资",
    ),
    note: text(
      "Australia committed an additional AUD 1000000 in June 2023. This row records that top-up only.",
      "ออสเตรเลียให้คำมั่นเพิ่ม AUD 1000000 ในเดือนมิถุนายน 2023 แถวนี้บันทึกเฉพาะเงินสมทบก้อนนั้น",
      "澳大利亚于2023年6月追加承诺 AUD 1000000。这一行只记录这笔追加。",
    ),
  },
  F05: {
    type: "grant",
    outcome: "stalled",
    counterpart: ADB,
    title: text(
      "ASEAN Australia Smart Cities Trust Fund reported as closing",
      "กองทุนเมืองอัจฉริยะอาเซียน–ออสเตรเลียถูกรายงานว่ากำลังปิด",
      "东盟澳大利亚智慧城市信托基金据报正在关闭",
    ),
    note: text(
      "The Asian Development Bank’s 2025 urban financing report says the fund is closing, with money to be returned or reused. This row does not state a remaining balance. Confidence is medium.",
      "รายงานการเงินเมืองปี 2025 ของธนาคารพัฒนาเอเชียระบุว่ากองทุนกำลังปิด และเงินจะถูกคืนหรือนำไปใช้ใหม่ แถวนี้ไม่ระบุยอดคงเหลือ ความเชื่อมั่นอยู่ที่ระดับกลาง",
      "亚洲开发银行2025年城市融资报告称该基金正在关闭，资金将退回或改作他用。这一行不写剩余余额。可信度为中等。",
    ),
  },
  F07: {
    type: "grant",
    outcome: "partial",
    selfReported: true,
    counterpart: MLIT,
    title: text(
      "Smart JAMP trial of AI illegal-parking detection in Bangkok",
      "การทดลอง Smart JAMP ตรวจจับการจอดรถผิดกฎหมายด้วยเอไอในกรุงเทพฯ",
      "Smart JAMP 在曼谷试验用人工智能发现违停",
    ),
    note: text(
      "Japan’s own study says a two-day trial in November 2024, about 15 hours in all, detected 524 illegally parked vehicles. It is a pilot, not a deployment, and the operating model is unresolved. The count is self-reported. This is not the Phuket traffic study.",
      "รายงานของญี่ปุ่นเองระบุว่าการทดลองสองวันในเดือนพฤศจิกายน 2024 รวมราว 15 ชั่วโมง ตรวจพบรถจอดผิดกฎหมาย 524 คัน เป็นการนำร่อง ไม่ใช่การติดตั้งถาวร และรูปแบบการเดินระบบยังไม่จบ ตัวเลขเป็นรายงานเอง ไม่ใช่การศึกษาจราจรที่ภูเก็ต",
      "日本自己的研究报告称，2024年11月两天、合计约15小时的试验发现524辆违停车辆。这是试点，不是部署，运营方式也未解决。数字是自行报告。这不是普吉的交通研究。",
    ),
  },
  F08: {
    type: "grant",
    outcome: "partial",
    counterpart: MLIT,
    title: text(
      "Smart JAMP feasibility study for a tourism app in Vientiane",
      "การศึกษาความเป็นไปได้ Smart JAMP สำหรับแอปท่องเที่ยวในเวียงจันทน์",
      "Smart JAMP 万象旅游应用可行性研究",
    ),
    note: text(
      "A 2024 study describes a prototype tourism app for Vientiane, after earlier master-plan and feasibility work. No programme budget is stated, and a prototype is not a city service.",
      "รายงานปี 2024 บรรยายแอปท่องเที่ยวต้นแบบสำหรับเวียงจันทน์ หลังงานแผนหลักและการศึกษาความเป็นไปได้ก่อนหน้า ไม่มีงบประมาณของโปรแกรม และต้นแบบไม่ใช่บริการของเมือง",
      "2024年的研究描述了万象的旅游应用原型，此前已有总体规划和可行性工作。没有写出项目预算，原型也不是城市服务。",
    ),
  },
  F09: {
    type: "grant",
    outcome: "partial",
    publicAmount: true,
    counterpart: KMOLIT,
    title: text(
      "Korean overseas infrastructure and smart-city fund announced in Busan",
      "กองทุนโครงสร้างพื้นฐานและเมืองอัจฉริยะต่างประเทศของเกาหลีที่ประกาศในปูซาน",
      "韩国在釜山宣布的海外基础设施与智慧城市基金",
    ),
    note: text(
      "A news report of the November 2019 Busan meeting says Korea announced a fund of KRW 1500000000000 for overseas plants, infrastructure and smart cities, with KRW 300000000000 described as set aside for overseas smart-city projects. The fund is not specific to ASCN. Confidence is medium.",
      "ข่าวการประชุมที่ปูซานในเดือนพฤศจิกายน 2019 ระบุว่าเกาหลีประกาศกองทุน KRW 1500000000000 สำหรับโรงงาน โครงสร้างพื้นฐาน และเมืองอัจฉริยะในต่างประเทศ และบรรยายว่ากัน KRW 300000000000 ไว้สำหรับโครงการเมืองอัจฉริยะต่างประเทศ กองทุนไม่ได้เจาะจงที่ ASCN ความเชื่อมั่นอยู่ที่ระดับกลาง",
      "关于2019年11月釜山会议的新闻称，韩国宣布设立 KRW 1500000000000 的基金，用于海外工厂、基础设施和智慧城市，并称其中 KRW 300000000000 拨给海外智慧城市项目。该基金并不专属于 ASCN。可信度为中等。",
    ),
  },
  F10: {
    type: "course",
    outcome: "partial",
    counterpart: AKCF,
    title: text(
      "ASEAN Smart City Professional Program, 2023–2027",
      "โครงการผู้เชี่ยวชาญเมืองอัจฉริยะอาเซียน ปี 2023–2027",
      "东盟智慧城市专业人才项目，2023–2027",
    ),
    note: text(
      "A call document describes a five-year course funded by the ASEAN-Korea Cooperation Fund and run by Seoul National University, aimed at 260 short-term trainees and 40 master’s students. No funding amount was found. A target is not a completed intake.",
      "เอกสารเปิดรับบรรยายหลักสูตรห้าปีที่กองทุนความร่วมมืออาเซียน–เกาหลีสนับสนุน และมหาวิทยาลัยแห่งชาติโซลเป็นผู้จัด ตั้งเป้าผู้เข้าอบรมระยะสั้น 260 คนและนักศึกษามหาบัณฑิต 40 คน ไม่พบจำนวนเงินทุน เป้าหมายไม่ใช่จำนวนที่รับเข้าแล้ว",
      "一份征集文件描述了由东盟—韩国合作基金资助、首尔大学承办的五年课程，目标是260名短期学员和40名硕士生。没有找到资助金额。目标不是已经完成的招生。",
    ),
  },
  F12: {
    type: "course",
    outcome: "partial",
    selfReported: true,
    counterpart: AUS4,
    title: text(
      "Second phase of support for the ASEAN Sustainable Urbanisation Strategy",
      "การสนับสนุนระยะที่สองของยุทธศาสตร์การพัฒนาเมืองอย่างยั่งยืนของอาเซียน",
      "东盟可持续城镇化战略支持的第二阶段",
    ),
    note: text(
      "ASEAN’s own 2025 monitoring report describes city-leader training and wider capacity building under this second phase, with UN-Habitat named alongside Aus4ASEAN Futures. No amount is disclosed. This is not the infrastructure-pipeline workshop recorded separately. The description is self-reported.",
      "รายงานติดตามปี 2025 ของอาเซียนเองบรรยายการอบรมผู้นำเมืองและการเสริมศักยภาพในระยะที่สองนี้ โดยกล่าวถึง UN-Habitat คู่กับ Aus4ASEAN Futures ไม่มีการเปิดเผยจำนวนเงิน ไม่ใช่เวิร์กช็อปบัญชีโครงการโครงสร้างพื้นฐานที่บันทึกแยกไว้ คำบรรยายเป็นรายงานเอง",
      "东盟自己的2025年监测报告描述了这一第二阶段中的城市领导人培训和更广泛的能力建设，并同时写到 UN-Habitat 与 Aus4ASEAN Futures。金额未披露。这不是另行记录的基础设施项目清单研讨会。描述是自行报告。",
    ),
  },
  T01: {
    type: "course",
    outcome: "delivered",
    counterpart: SMFA,
    title: text(
      "ASEAN Smart Cities Governance Workshop, Singapore",
      "เวิร์กช็อปธรรมาภิบาลเมืองอัจฉริยะอาเซียน ที่สิงคโปร์",
      "东盟智慧城市治理研讨会，新加坡",
    ),
    note: text(
      "Singapore’s foreign ministry records a workshop on 22–25 May 2018, before the inaugural network meeting.",
      "กระทรวงการต่างประเทศสิงคโปร์บันทึกเวิร์กช็อปวันที่ 22–25 พฤษภาคม 2018 ก่อนการประชุมแรกของเครือข่าย",
      "新加坡外交部记录了2018年5月22–25日的研讨会，时间在网络首次会议之前。",
    ),
  },
  T02: {
    type: "trip",
    outcome: "delivered",
    counterpart: STATE,
    title: text(
      "U.S.–ASEAN Smart Cities Partnership symposium, Washington",
      "การประชุมสมัชชาความร่วมมือเมืองอัจฉริยะสหรัฐ–อาเซียน ที่วอชิงตัน",
      "美国—东盟智慧城市伙伴关系研讨会，华盛顿",
    ),
    note: text(
      "The U.S. State Department hosted a symposium on 9 July 2019 for representatives of the pilot cities. The public page says the meeting was held. It does not show a project awarded there.",
      "กระทรวงการต่างประเทศสหรัฐเป็นเจ้าภาพการประชุมวันที่ 9 กรกฎาคม 2019 สำหรับผู้แทนเมืองนำร่อง หน้าสาธารณะบอกว่าการประชุมเกิดขึ้น ไม่ได้แสดงว่ามีโครงการได้รับคัดเลือกในที่นั้น",
      "美国国务院于2019年7月9日为试点城市代表主办研讨会。公开页面表明会议已举行。看不出当场有项目获批。",
    ),
  },
  T03: {
    type: "course",
    outcome: "delivered",
    counterpart: org(
      "Singapore–United States Third Country Training Program",
      "โครงการฝึกอบรมประเทศที่สามสิงคโปร์–สหรัฐฯ",
      "新加坡—美国第三国培训项目",
    ),
    title: text(
      "Singapore–United States smart cities workshop",
      "เวิร์กช็อปเมืองอัจฉริยะสิงคโปร์–สหรัฐฯ",
      "新加坡—美国智慧城市研讨会",
    ),
    note: text(
      "A five-day course on 2–6 December 2019 covered planning, finance, procurement, standards and cybersecurity. The public page records the course. It does not record a city project that followed.",
      "หลักสูตรห้าวันในวันที่ 2–6 ธันวาคม 2019 ครอบคลุมการวางแผน การเงิน การจัดซื้อ มาตรฐาน และความมั่นคงไซเบอร์ หน้าสาธารณะบันทึกว่ามีหลักสูตร ไม่ได้บันทึกโครงการของเมืองที่ตามมา",
      "2019年12月2–6日的五日课程涵盖规划、资金、采购、标准和网络安全。公开页面记录了课程。没有记录随后的城市项目。",
    ),
  },
  T04: {
    type: "trip",
    outcome: "delivered",
    counterpart: MLIT,
    title: text(
      "1st ASEAN-Japan Smart Cities Network High Level Meeting, Yokohama",
      "การประชุมระดับสูงเครือข่ายเมืองอัจฉริยะอาเซียน–ญี่ปุ่น ครั้งที่ 1 ที่โยโกฮามา",
      "第1届东盟—日本智慧城市网络高层会议，横滨",
    ),
    note: text(
      "The meeting was held in Yokohama on 8–9 October 2019, with public-private matching. The Japan-ASEAN Integration Fund is named as a supporter. No programme budget for Smart JAMP appears here; that proposal came later.",
      "การประชุมจัดที่โยโกฮามาในวันที่ 8–9 ตุลาคม 2019 พร้อมการจับคู่ภาครัฐและเอกชน มีการระบุกองทุนบูรณาการญี่ปุ่น–อาเซียนเป็นผู้สนับสนุน ไม่มีงบ Smart JAMP ในแถวนี้ ข้อเสนอนั้นมาทีหลัง",
      "会议于2019年10月8–9日在横滨举行，并有政企对接。日本—东盟一体化基金被列为支持方。这一行没有 Smart JAMP 的项目预算；该提议是后来才提出的。",
    ),
  },
  T05: {
    type: "trip",
    outcome: "delivered",
    counterpart: KMOLIT,
    title: text(
      "Briefing for ASEAN officials on Busan Eco Delta City",
      "การบรรยายสรุปให้เจ้าหน้าที่อาเซียนเรื่องเมืองอีโคเดลต้าปูซาน",
      "向东盟官员介绍釜山生态三角洲城",
    ),
    note: text(
      "During the November 2019 Busan meeting, officials from the ten ASEAN member states were briefed on Eco Delta City. This is the briefing, not the infrastructure fund and not the pacts signed at the same summit.",
      "ระหว่างการประชุมที่ปูซานในเดือนพฤศจิกายน 2019 เจ้าหน้าที่จากสิบประเทศสมาชิกอาเซียนได้รับฟังสรุปเรื่องเมืองอีโคเดลต้า นี่คือการบรรยายสรุป ไม่ใช่กองทุนโครงสร้างพื้นฐาน และไม่ใช่ข้อตกลงที่ลงนามในการประชุมเดียวกัน",
      "2019年11月釜山会议期间，十个东盟成员国的官员听取了生态三角洲城的介绍。这是介绍会，不是基础设施基金，也不是同一次峰会上签署的协议。",
    ),
  },
  T06: {
    type: "course",
    outcome: "delivered",
    counterpart: SNU,
    title: text(
      "First master’s cohort of the ASEAN Smart City Professional Program",
      "นักศึกษามหาบัณฑิตรุ่นแรกของโครงการผู้เชี่ยวชาญเมืองอัจฉริยะอาเซียน",
      "东盟智慧城市专业人才项目首届硕士班",
    ),
    note: text(
      "Nine students from ASEAN member states began a two-year master’s course at Seoul National University in early 2024. The fund is the ASEAN-Korea Cooperation Fund. This row is the start of that cohort, not the later cumulative total.",
      "นักศึกษาเก้าคนจากประเทศสมาชิกอาเซียนเริ่มหลักสูตรมหาบัณฑิตสองปีที่มหาวิทยาลัยแห่งชาติโซลต้นปี 2024 ทุนมาจากกองทุนความร่วมมืออาเซียน–เกาหลี แถวนี้คือการเริ่มของรุ่นนั้น ไม่ใช่ยอดสะสมในภายหลัง",
      "九名东盟成员国学生于2024年初在首尔大学开始两年制硕士课程。资助方是东盟—韩国合作基金。这一行是该届的开学，不是后来的累计总数。",
    ),
  },
  T07: {
    type: "course",
    outcome: "partial",
    selfReported: true,
    counterpart: AKCF,
    title: text(
      "ASEAN Smart City Professional Program: cumulative participation",
      "โครงการผู้เชี่ยวชาญเมืองอัจฉริยะอาเซียน: จำนวนผู้เข้าร่วมสะสม",
      "东盟智慧城市专业人才项目：累计参与人数",
    ),
    note: text(
      "ASEAN’s own 2025 monitoring report says 144 people had taken short courses and 40 were in the master’s course at Seoul National University. Those counts are self-reported. They are not an independent enrolment audit.",
      "รายงานติดตามปี 2025 ของอาเซียนเองระบุว่ามีผู้เข้าหลักสูตรระยะสั้น 144 คน และมีผู้เรียนมหาบัณฑิตที่มหาวิทยาลัยแห่งชาติโซล 40 คน ตัวเลขเหล่านี้เป็นรายงานเอง ไม่ใช่การตรวจทะเบียนอิสระ",
      "东盟自己的2025年监测报告称，144人参加了短期课程，40人在首尔大学攻读硕士。这些数字是自行报告，不是独立的学籍核对。",
    ),
  },
  T08: {
    type: "communication",
    outcome: "partial",
    selfReported: true,
    counterpart: NZ,
    title: text(
      "Showcase of New Zealand initiatives for ASCN",
      "การนำเสนอโครงการของนิวซีแลนด์ต่อ ASCN",
      "向 ASCN 展示新西兰项目",
    ),
    note: text(
      "ASEAN’s own 2025 monitoring report says ASCN representatives joined a showcase at New Zealand’s invitation. No separate public agenda was found, so the row stays partial and self-reported.",
      "รายงานติดตามปี 2025 ของอาเซียนเองระบุว่าผู้แทน ASCN เข้าร่วมการนำเสนอตามคำเชิญของนิวซีแลนด์ ไม่พบวาระสาธารณะแยกต่างหาก จึงยังเป็นผลบางส่วนและเป็นรายงานเอง",
      "东盟自己的2025年监测报告称，ASCN 代表应新西兰邀请参加了一次展示。没有找到另行公开的议程，所以这一行仍是部分完成并标为自行报告。",
    ),
  },
  M01: {
    type: "communication",
    outcome: "delivered",
    counterpart: ASEAN,
    title: text(
      "ASEAN Smart Cities Network established at the 32nd ASEAN Summit",
      "จัดตั้งเครือข่ายเมืองอัจฉริยะอาเซียนในการประชุมสุดยอดอาเซียนครั้งที่ 32",
      "东盟智慧城市网络在第32届东盟峰会上设立",
    ),
    note: text(
      "The April 2018 concept note sets up a network of 26 pilot cities. It is the founding document in this record, not a completed project list.",
      "เอกสารแนวคิดเดือนเมษายน 2018 จัดตั้งเครือข่ายเมืองนำร่อง 26 เมือง เป็นเอกสารก่อตั้งในบันทึกนี้ ไม่ใช่บัญชีโครงการที่ทำเสร็จแล้ว",
      "2018年4月的概念说明设立了由26个试点城市组成的网络。它是这份记录里的创立文件，不是一份已完成项目清单。",
    ),
  },
  M02: {
    type: "communication",
    outcome: "partial",
    counterpart: SMFA,
    title: text(
      "Inaugural ASCN meeting, Singapore",
      "การประชุม ASCN ครั้งแรก ที่สิงคโปร์",
      "ASCN 首次会议，新加坡",
    ),
    note: text(
      "Singapore’s foreign ministry said the 8 July 2018 meeting was expected to endorse the smart-city framework and 26 city action plans. The press note records that expectation. Adoption of the framework is a later summit document.",
      "กระทรวงการต่างประเทศสิงคโปร์ระบุว่าการประชุมวันที่ 8 กรกฎาคม 2018 คาดว่าจะให้การรับรองกรอบเมืองอัจฉริยะและแผนปฏิบัติการของ 26 เมือง ข่าวประชาสัมพันธ์บันทึกความคาดหมายนั้น การรับรองกรอบเป็นเอกสารของการประชุมสุดยอดถัดไป",
      "新加坡外交部称，2018年7月8日的会议预期将通过智慧城市框架和26个城市行动计划。新闻稿记录的是这一预期。框架的正式通过见稍后的峰会文件。",
    ),
  },
  M03: {
    type: "communication",
    outcome: "delivered",
    counterpart: ASEAN,
    title: text(
      "33rd ASEAN Summit adopts the ASEAN Smart Cities Framework",
      "การประชุมสุดยอดอาเซียนครั้งที่ 33 รับรองกรอบเมืองอัจฉริยะอาเซียน",
      "第33届东盟峰会通过《东盟智慧城市框架》",
    ),
    note: text(
      "The chairman’s statement of 13 November 2018 lists the ASEAN Smart Cities Framework among adopted documents. Confidence is medium.",
      "ถ้อยแถลงของประธานเมื่อ 13 พฤศจิกายน 2018 ระบุกรอบเมืองอัจฉริยะอาเซียนในเอกสารที่รับรอง ความเชื่อมั่นอยู่ที่ระดับกลาง",
      "2018年11月13日的主席声明把《东盟智慧城市框架》列在通过的文件中。可信度为中等。",
    ),
  },
  M04: {
    type: "mou",
    outcome: "delivered",
    counterpart: KMOLIT,
    title: text(
      "Korea–ASEAN smart-city pacts with Singapore and Brunei",
      "ข้อตกลงเมืองอัจฉริยะเกาหลี–อาเซียนกับสิงคโปร์และบรูไน",
      "韩国与新加坡、文莱的智慧城市协议",
    ),
    note: text(
      "A news report of the November 2019 Busan meeting says Korea agreed a ministerial consultative body with ASEAN and signed initial smart-city pacts with Singapore and Brunei. The pact texts are not in this record. This is not the infrastructure fund announced at the same meeting.",
      "ข่าวการประชุมที่ปูซานในเดือนพฤศจิกายน 2019 ระบุว่าเกาหลีตกลงตั้งคณะปรึกษาระดับรัฐมนตรีกับอาเซียน และลงนามข้อตกลงเมืองอัจฉริยะเบื้องต้นกับสิงคโปร์และบรูไน ตัวบทข้อตกลงไม่อยู่ในบันทึกนี้ ไม่ใช่กองทุนโครงสร้างพื้นฐานที่ประกาศในการประชุมเดียวกัน",
      "关于2019年11月釜山会议的新闻称，韩国与东盟商定设立部长级协商机制，并与新加坡和文莱签署了初期智慧城市协议。协议文本不在这份记录里。这不是同一次会议上宣布的基础设施基金。",
    ),
  },
  M06: {
    type: "communication",
    outcome: "delivered",
    selfReported: true,
    counterpart: ASEAN,
    title: text(
      "7th ASCN Annual Meeting",
      "การประชุมประจำปี ASCN ครั้งที่ 7",
      "第7届 ASCN 年会",
    ),
    note: text(
      "ASEAN’s own 2024 monitoring report says the annual meeting was held on 30 July 2024 with the ASCN conference, under the Lao PDR chair. The meeting date is self-reported in that monitoring report. This is not the 7th ASEAN-Japan high-level meeting.",
      "รายงานติดตามปี 2024 ของอาเซียนเองระบุว่าการประชุมประจำปีจัดเมื่อ 30 กรกฎาคม 2024 พร้อมการประชุม ASCN ภายใต้ประธานลาว วันที่ประชุมเป็นรายงานเองในรายงานติดตามนั้น ไม่ใช่การประชุมระดับสูงอาเซียน–ญี่ปุ่นครั้งที่ 7",
      "东盟自己的2024年监测报告称，年会于2024年7月30日与 ASCN 会议一并举行，由老挝主持。会议日期是该监测报告中的自行报告。这不是第7届东盟—日本高层会议。",
    ),
  },
  M07: {
    type: "communication",
    outcome: "delivered",
    selfReported: true,
    counterpart: ASEAN,
    title: text(
      "8th ASCN Annual Meeting",
      "การประชุมประจำปี ASCN ครั้งที่ 8",
      "第8届 ASCN 年会",
    ),
    note: text(
      "ASEAN’s own 2025 monitoring report says the annual meeting and an expert talk were held on 9–10 September 2025 under the Malaysia chair. The date is self-reported in that report. This is not the Kagawa high-level meeting and not an internal draft about Chonburi.",
      "รายงานติดตามปี 2025 ของอาเซียนเองระบุว่าการประชุมประจำปีและการเสวนาผู้เชี่ยวชาญจัดเมื่อ 9–10 กันยายน 2025 ภายใต้ประธานมาเลเซีย วันที่เป็นรายงานเองในรายงานนั้น ไม่ใช่การประชุมระดับสูงที่คากาวะ และไม่ใช่ฉบับร่างภายในเรื่องชลบุรี",
      "东盟自己的2025年监测报告称，年会和专家座谈于2025年9月9–10日举行，由马来西亚主持。日期是该报告中的自行报告。这不是香川高层会议，也不是关于春武里的内部草稿。",
    ),
  },
  M08: {
    type: "communication",
    outcome: "partial",
    selfReported: true,
    counterpart: ASEAN,
    title: text(
      "ASEAN Smart City Action Plan 2026–2035 reported as adopted",
      "แผนปฏิบัติการเมืองอัจฉริยะอาเซียน ปี 2026–2035 ที่รายงานว่าได้รับการรับรอง",
      "据报已通过的《东盟智慧城市行动计划（2026–2035）》",
    ),
    note: text(
      "ASEAN’s own 2025 monitoring report says the 2026–2035 action plan was developed and adopted under Malaysia’s chair. The plan text was not located, so this row does not quote it. Confidence is medium, and the adoption claim is self-reported.",
      "รายงานติดตามปี 2025 ของอาเซียนเองระบุว่าแผนปฏิบัติการปี 2026–2035 ถูกร่างและรับรองภายใต้ประธานมาเลเซีย ไม่พบตัวบทแผน จึงไม่มีการอ้างข้อความจากแผน ความเชื่อมั่นอยู่ที่ระดับกลาง และข้ออ้างว่าได้รับการรับรองเป็นรายงานเอง",
      "东盟自己的2025年监测报告称，2026–2035年行动计划在马来西亚主持下制定并通过。没有找到计划文本，所以这一行不引用其内容。可信度为中等，通过这一说法是自行报告。",
    ),
  },
  E02: {
    type: "communication",
    outcome: "partial",
    selfReported: true,
    counterpart: ASEAN,
    title: text(
      "ASCN monitoring report 2024",
      "รายงานติดตาม ASCN ปี 2024",
      "2024年 ASCN 监测报告",
    ),
    note: text(
      "ASEAN’s own monitoring report counts 108 projects, of which 11 (10.2%) are marked completed, 81 ongoing and 16 in planning, across 31 cities. These figures are self-reported. They are not an independent evaluation.",
      "รายงานติดตามของอาเซียนเองนับได้ 108 โครงการ ในจำนวนนี้ถูกทำเครื่องหมายว่าเสร็จ 11 โครงการ (ร้อยละ 10.2) กำลังดำเนิน 81 โครงการ และอยู่ในแผน 16 โครงการ ใน 31 เมือง ตัวเลขเหล่านี้เป็นรายงานเอง ไม่ใช่การประเมินอิสระ",
      "东盟自己的监测报告统计为108个项目，其中11个（10.2%）标为已完成，81个在进行，16个在规划，覆盖31个城市。这些数字是自行报告，不是独立评估。",
    ),
  },
  E03: {
    type: "communication",
    outcome: "partial",
    selfReported: true,
    counterpart: ASEAN,
    title: text(
      "ASCN monitoring report 2025",
      "รายงานติดตาม ASCN ปี 2025",
      "2025年 ASCN 监测报告",
    ),
    note: text(
      "ASEAN’s own monitoring report counts 134 projects, of which 18 (13%) are marked completed, 108 ongoing and 8 in planning, across 35 cities. These figures are self-reported. They are not an independent evaluation.",
      "รายงานติดตามของอาเซียนเองนับได้ 134 โครงการ ในจำนวนนี้ถูกทำเครื่องหมายว่าเสร็จ 18 โครงการ (ร้อยละ 13) กำลังดำเนิน 108 โครงการ และอยู่ในแผน 8 โครงการ ใน 35 เมือง ตัวเลขเหล่านี้เป็นรายงานเอง ไม่ใช่การประเมินอิสระ",
      "东盟自己的监测报告统计为134个项目，其中18个（13%）标为已完成，108个在进行，8个在规划，覆盖35个城市。这些数字是自行报告，不是独立评估。",
    ),
  },
  E04: {
    type: "communication",
    outcome: "partial",
    counterpart: org(
      "International Journal of Urban Sustainable Development",
      "International Journal of Urban Sustainable Development",
      "International Journal of Urban Sustainable Development",
    ),
    title: text(
      "Journal article on participation in ASCN projects",
      "บทความวารสารเรื่องการมีส่วนร่วมในโครงการ ASCN",
      "关于 ASCN 项目参与的期刊论文",
    ),
    note: argued(
      "A 2020 journal article argues that authoritarian practice in some member states undercuts participatory planning in ASCN projects.",
      "บทความวารสารปี 2020 โต้แย้งว่าแนวปฏิบัติอำนาจนิยมในบางประเทศสมาชิกบั่นทอนการวางแผนแบบมีส่วนร่วมในโครงการ ASCN",
      "2020年的一篇期刊论文认为，部分成员国的威权做法削弱了 ASCN 项目中的参与式规划。",
    ),
  },
  E05: {
    type: "communication",
    outcome: "partial",
    counterpart: org("Sustainability (MDPI)", "Sustainability (MDPI)", "Sustainability (MDPI)"),
    title: text(
      "Journal article on transboundary learning in ASCN",
      "บทความวารสารเรื่องการเรียนรู้ข้ามพรมแดนใน ASCN",
      "关于 ASCN 跨境学习的期刊论文",
    ),
    note: argued(
      "A 2021 journal article describes ASCN as a branding and influence tool, and says complex governance, thin resources and missing operating mechanisms have kept most smart-city ideas from being fully carried out.",
      "บทความวารสารปี 2021 บรรยาย ASCN ว่าเป็นเครื่องมือสร้างภาพลักษณ์และอิทธิพล และระบุว่าธรรมาภิบาลที่ซับซ้อน ทรัพยากรที่บาง และกลไกปฏิบัติที่ขาดไป ทำให้แนวคิดเมืองอัจฉริยะส่วนใหญ่ยังไม่ถูกทำให้ครบ",
      "2021年的一篇期刊论文把 ASCN 描述为品牌与影响力工具，并认为治理复杂、资源不足和缺少运作机制，使大多数智慧城市设想未能完全落地。",
    ),
  },
  E06: {
    type: "communication",
    outcome: "partial",
    counterpart: org(
      "International Journal of Law in Context",
      "International Journal of Law in Context",
      "International Journal of Law in Context",
    ),
    title: text(
      "Journal article on governance and rights in ASCN",
      "บทความวารสารเรื่องธรรมาภิบาลและสิทธิใน ASCN",
      "关于 ASCN 治理与权利的期刊论文",
    ),
    note: argued(
      "A 2022 journal article finds ASCN pilot governance top-down and organised around efficiency, and says that pattern can put rights at risk.",
      "บทความวารสารปี 2022 พบว่าธรรมาภิบาลของเมืองนำร่อง ASCN เป็นแบบบนลงล่างและจัดรอบประสิทธิภาพ และระบุว่ารูปแบบนั้นอาจทำให้สิทธิมีความเสี่ยง",
      "2022年的一篇期刊论文认为 ASCN 试点治理是自上而下并以效率为中心，并称这种模式可能使权利面临风险。",
    ),
  },
};
