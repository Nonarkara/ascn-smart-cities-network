import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { safeUrl } from "./security.mjs";
import { MERGE, PENDING, SCRAPE, SCRAPE_ALIAS } from "./ascn-scrape.mjs";

export const ARCHIVE_TYPES = ["grant", "trip", "mou", "communication", "course"];
export const ARCHIVE_OUTCOMES = ["delivered", "partial", "stalled", "failed"];
const TYPE_SET = new Set(ARCHIVE_TYPES);
const OUTCOME_SET = new Set(ARCHIVE_OUTCOMES);
const LANGS = ["en", "th", "zh"];
const ITEM_KEYS = ["id", "type", "date", "title", "counterpart", "outcome", "note", "source", "public", "amount", "confidence", "selfReported"];
const PENDING_KEYS = ["id", "date", "title", "counterpart", "note", "source", "confidence", "status"];
const HIGH_SOURCE = new Set(["hlm3-2021", "usascp-ius-2021", "ascn-site-repo"]);
const UNREAD_REVIEW = /Baguio|financial-management|\bGold\b/;
const DENY_KEYS = new Set([
  "thread_ids", "threadIds", "summary", "participants", "sender_org", "borderline_reason",
  "publishable", "funders", "amounts", "outcome_evidence", "has_outcome", "public_url",
  "email", "phone", "body", "gmail", "passcode",
]);

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const OBFUSCATED_EMAIL = /\b[A-Z0-9._%+-]+\s*(?:\(|\[)?\s*at\s*(?:\)|\])?\s*[A-Z0-9.-]+\s*(?:\(|\[)?\s*dot\s*(?:\)|\])?\s*[A-Z]{2,}\b/i;
const PHONE_PATTERNS = [
  /\+\d{1,3}(?:[\s().-]*\d){7,14}/,
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,
  /\b0[689]\d(?:[-.\s]?\d){7}\b/,
  /\(\d{2,4}\)\s*\d{3,4}[-.\s]?\d{3,4}/,
];
const RAW_EMAIL = /(?:^|[\n\r])\s*(?:from|to|cc|bcc|subject|sent)\s*:|mail\.google\.com|\bgmail\.com\b|\bthread[_ ]?ids?\b|\bwrote:\s*$|original message|begin forwarded message|mime-version:|content-type:\s*text\//im;

const COVERAGE = {
  en: "Public items linked to the ASEAN Smart Cities Network, from one cleared inbox and from public pages. Each item says whether that trail shows a result. Figures taken from ASEAN’s own monitoring reports are labelled self-reported. A document that has not been read is listed as pending review and states no findings. This is not the network’s full record.",
  th: "รายการสาธารณะที่เกี่ยวกับเครือข่ายเมืองอัจฉริยะอาเซียน จากกล่องจดหมายที่ตรวจแล้วหนึ่งกล่องและจากหน้าสาธารณะ แต่ละรายการบอกว่าเส้นทางนั้นมีผลหรือไม่ ตัวเลขจากรายงานติดตามของอาเซียนเองถูกกำกับว่าเป็นรายงานเอง เอกสารที่ยังไม่ได้อ่านถูกใส่เป็นรอการทบทวนและไม่ระบุข้อค้นพบ นี่ไม่ใช่บันทึกทั้งหมดของเครือข่าย",
  zh: "与东盟智慧城市网络有关的公开事项，来自一个已核可的收件箱和公开网页。每一条都写明这条线索有没有结果。取自东盟自己监测报告的数字标为自行报告。尚未读过的文件列为待审阅，并且不陈述结论。这不是整个网络的全部记录。",
};

const NOT_PUBLIC = {
  en: "Not public.",
  th: "ไม่ใช่ข้อมูลสาธารณะ",
  zh: "未公开。",
};

const WITHHELD_COPY = {
  "stgp-korea-2022": {
    en: "Names a third party, and the link to ASCN is weak.",
    th: "ระบุบุคคลภายนอก และความเชื่อมกับ ASCN อ่อน",
    zh: "点名了一名第三方，且与 ASCN 的关联很弱。",
  },
  "ascn8-chonburi-2025": {
    en: "Internal draft. Only a finished public deck would be published.",
    th: "เป็นฉบับร่างภายใน จะเผยแพร่ได้ก็ต่อเมื่อมีสไลด์ฉบับสาธารณะที่เสร็จแล้ว",
    zh: "内部草稿。只有完成的公开幻灯片才适合发表。",
  },
  "ascn-linkedin-page": {
    en: "Message contents are private. Page ownership was not confirmed for publication.",
    th: "เนื้อหาข้อความเป็นเรื่องส่วนตัว ยังไม่ได้ยืนยันความเป็นเจ้าของเพจก่อนเผยแพร่",
    zh: "私信内容不能公开。页面归属尚未确认到可以发表。",
  },
};

const org = (en, th, zh) => ({ en, th, zh });
const text = (en, th, zh) => ({ en, th, zh });

const MLIT = org(
  "Ministry of Land, Infrastructure, Transport and Tourism (Japan)",
  "กระทรวงที่ดิน โครงสร้างพื้นฐาน การขนส่ง และการท่องเที่ยว (ญี่ปุ่น)",
  "日本国土交通省",
);
const ASEAN = org("ASEAN Secretariat", "สำนักเลขาธิการอาเซียน", "东盟秘书处");

// Public wording for inbox rows. Dates stay with the source record so a later
// correction is picked up on the next build. Bodies, thread ids and names of
// private correspondents are never copied across.
const EDITORIAL = {
  "hlm3-2021": {
    type: "communication",
    outcome: "stalled",
    source: "https://www.ascnjapan2021.jp/eng/index.html",
    counterpart: MLIT,
    title: text(
      "3rd ASEAN-Japan Smart Cities Network High Level Meeting (Aichi host, held online)",
      "การประชุมระดับสูงเครือข่ายเมืองอัจฉริยะอาเซียน–ญี่ปุ่น ครั้งที่ 3 (เจ้าภาพไอจิ จัดออนไลน์)",
      "第3届东盟—日本智慧城市网络高层会议（爱知主办，线上举行）",
    ),
    note: text(
      "The host drafted the summary record before the meeting and offered business-matching sessions. No deal or project is visible afterwards.",
      "เจ้าภาพร่างบันทึกสรุปก่อนการประชุม และเปิดช่วงจับคู่ธุรกิจ ไม่ปรากฏข้อตกลงหรือโครงการตามมา",
      "主办方在会前起草了纪要，并安排了商务对接。此后未见成交或项目。",
    ),
  },
  "hlm2-2020": {
    type: "communication",
    outcome: "stalled",
    source: "cleared by Non",
    counterpart: org("Ministry of Foreign Affairs (Japan)", "กระทรวงการต่างประเทศ (ญี่ปุ่น)", "日本外务省"),
    title: text(
      "2nd ASEAN-Japan Smart Cities Network High Level Meeting (referenced later)",
      "การประชุมระดับสูงเครือข่ายเมืองอัจฉริยะอาเซียน–ญี่ปุ่น ครั้งที่ 2 (อ้างถึงในภายหลัง)",
      "第2届东盟—日本智慧城市网络高层会议（见于后来的函件）",
    ),
    note: text(
      "A 2021 letter says depa’s southern office presented at this meeting. This inbox has no primary record of the meeting itself.",
      "จดหมายปี 2021 ระบุว่าสำนักงานภาคใต้ของดีป้านำเสนอในการประชุมนี้ กล่องจดหมายนี้ไม่มีบันทึกต้นทางของการประชุม",
      "2021年的来函称 depa 南部办公室在这次会议上作了介绍。此收件箱没有会议本身的原始记录。",
    ),
  },
  "hlm6-2024": {
    type: "trip",
    outcome: "failed",
    source: "cleared by Non",
    counterpart: MLIT,
    title: text(
      "6th ASEAN-Japan Smart Cities Network High Level Meeting (Japan)",
      "การประชุมระดับสูงเครือข่ายเมืองอัจฉริยะอาเซียน–ญี่ปุ่น ครั้งที่ 6 (ประเทศญี่ปุ่น)",
      "第6届东盟—日本智慧城市网络高层会议（日本）",
    ),
    note: text(
      "Thailand was asked to field a panel and a short slide deck, and was asked who would pay for the delegation. No follow-on project is visible, and this record does not confirm the panel was delivered.",
      "ไทยถูกขอให้จัดคนขึ้นเวทีและสไลด์สั้น ๆ และถูกถามว่าใครออกค่าเดินทางของคณะ ไม่ปรากฏโครงการต่อเนื่อง และบันทึกนี้ไม่ได้ยืนยันว่าการขึ้นเวทีเกิดขึ้นจริง",
      "泰方被要求安排发言和一份短幻灯片，并被问及代表团费用由谁承担。未见后续项目，本记录也不能确认发言已经完成。",
    ),
  },
  "hlm7-2025": {
    type: "trip",
    outcome: "failed",
    source: "cleared by Non",
    counterpart: org(
      "Ministry of Housing and Local Government (Malaysia)",
      "กระทรวงการเคหะและรัฐบาลท้องถิ่น (มาเลเซีย)",
      "马来西亚房屋及地方政府部",
    ),
    title: text(
      "7th ASEAN-Japan Smart Cities Network High Level Meeting, Kagawa (10–11 Nov 2025)",
      "การประชุมระดับสูงเครือข่ายเมืองอัจฉริยะอาเซียน–ญี่ปุ่น ครั้งที่ 7 ที่คากาวะ (10–11 พ.ย. 2025)",
      "第7届东盟—日本智慧城市网络高层会议，香川（2025年11月10–11日）",
    ),
    note: text(
      "Malaysia, as 2025 chair, asked for a bilateral on the 2026–2035 action plan. The inbox stops at the request.",
      "มาเลเซียในฐานะประธานปี 2025 ขอหารือทวิภาคีเรื่องแผนปฏิบัติการปี 2026–2035 บันทึกจบที่คำขอ",
      "作为2025年主席，马来西亚请求就2026–2035年行动计划举行双边会谈。记录停在这项请求。",
    ),
  },
  "guidebook-2021": {
    type: "communication",
    outcome: "stalled",
    source: "cleared by Non",
    counterpart: ASEAN,
    title: text(
      "ASEAN Smart Cities Planning Guidebook: country consultations",
      "คู่มือการวางแผนเมืองอัจฉริยะอาเซียน: การปรึกษาหารือรายประเทศ",
      "《东盟智慧城市规划指南》：国别磋商",
    ),
    note: text(
      "Country consultations ran, then the questionnaire for Bangkok, Chonburi and Phuket was chased twice. Whether the guidebook was published is not in this record.",
      "มีการปรึกษาหารือรายประเทศ แล้วมีการทวงแบบสอบถามของกรุงเทพฯ ชลบุรี และภูเก็ตสองครั้ง บันทึกนี้ไม่บอกว่าคู่มือได้รับการตีพิมพ์หรือไม่",
      "国别磋商已经进行，随后两次催要曼谷、春武里和普吉的问卷。本记录看不出指南是否出版。",
    ),
  },
  "investment-toolkit-2023": {
    type: "communication",
    outcome: "partial",
    source: "cleared by Non",
    counterpart: ASEAN,
    title: text(
      "ASEAN Smart City Investment Toolkit: Thailand consultation (recorded)",
      "ชุดเครื่องมือการลงทุนเมืองอัจฉริยะอาเซียน: การปรึกษาหารือกับไทย (มีการบันทึก)",
      "东盟智慧城市投资工具包：泰国磋商（有录像）",
    ),
    note: text(
      "A recorded Thailand consultation took place and fed the 2024 update. Use of the toolkit is not shown.",
      "มีการปรึกษาหารือกับไทยและบันทึกไว้ และนำไปสู่ฉบับปรับปรุงปี 2024 ไม่ปรากฏการใช้งานจริงของชุดเครื่องมือ",
      "与泰国的磋商有录像，并进入了2024年的修订。工具包是否被使用，这里看不到。",
    ),
  },
  "investment-toolkit-2024": {
    type: "communication",
    outcome: "partial",
    source: "cleared by Non",
    counterpart: ASEAN,
    title: text(
      "ASEAN Smart City Investment Toolkit: proposed additional features",
      "ชุดเครื่องมือการลงทุนเมืองอัจฉริยะอาเซียน: ข้อเสนอฟังก์ชันเพิ่มเติม",
      "东盟智慧城市投资工具包：拟增功能",
    ),
    note: text(
      "Some suggestions were accepted in principle, including a chatbot and pointers to existing material. Usage analytics were deferred. Live use is not shown.",
      "ข้อเสนอส่วนหนึ่งได้รับการตอบรับในหลักการ รวมถึงแชตบอตและการชี้ไปยังเอกสารที่มีอยู่ การวิเคราะห์การใช้งานถูกเลื่อนออกไป ไม่ปรากฏการใช้งานจริง",
      "部分建议被原则接受，包括聊天机器人和指向已有材料。使用分析被推迟。未见实际使用。",
    ),
  },
  "financing-toolkit-2024": {
    type: "course",
    outcome: "partial",
    source: "cleared by Non",
    counterpart: org(
      "Ministry of Public Works and Transport (Lao PDR)",
      "กระทรวงโยธาธิการและขนส่ง (ลาว)",
      "老挝公共工程与运输部",
    ),
    title: text(
      "Workshop and launch of the ASEAN Smart City Financing Toolkit, Jakarta (26–27 Nov 2024)",
      "เวิร์กช็อปและพิธีเปิดชุดเครื่องมือการเงินเมืองอัจฉริยะอาเซียน ที่จาการ์ตา (26–27 พ.ย. 2024)",
      "东盟智慧城市融资工具包研讨会暨发布会，雅加达（2024年11月26–27日）",
    ),
    note: text(
      "The financing toolkit was launched in Jakarta. No financing deal after the launch is visible. The trip is filed here as a course because the public event was a workshop.",
      "ชุดเครื่องมือการเงินเปิดตัวที่จาการ์ตา ไม่ปรากฏข้อตกลงด้านการเงินหลังการเปิดตัว การเดินทางถูกจัดไว้ที่นี่ในประเภทการอบรม เพราะงานสาธารณะคือเวิร์กช็อป",
      "融资工具包在雅加达发布。发布之后未见融资协议。这次出行归在培训类，因为公开活动是一场研讨会。",
    ),
  },
  "usascp-ius-2021": {
    type: "grant",
    outcome: "failed",
    source: "https://www.nrel.gov/international/integrated-urban-services.html",
    counterpart: org("U.S. Department of State", "กระทรวงการต่างประเทศสหรัฐฯ", "美国国务院"),
    title: text(
      "U.S.–ASEAN Smart Cities Partnership: Integrated Urban Services pilot-city call",
      "ความร่วมมือเมืองอัจฉริยะสหรัฐ–อาเซียน: เปิดรับเมืองนำร่องบริการเมืองแบบบูรณาการ",
      "美国—东盟智慧城市伙伴关系：综合城市服务试点城市征集",
    ),
    note: text(
      "An open call for pilot cities, with a deadline of 25 Oct 2021. No evidence that Thailand applied or was awarded a pilot. No amount is stated.",
      "เป็นการเปิดรับเมืองนำร่อง ปิดรับวันที่ 25 ต.ค. 2021 ไม่มีหลักฐานว่าไทยสมัครหรือได้รับคัดเลือก ไม่มีการระบุจำนวนเงิน",
      "这是一次试点城市公开征集，截止2021年10月25日。没有泰国申请或入选的证据。未写明金额。",
    ),
  },
  "aus4asean-2025": {
    type: "course",
    outcome: "failed",
    source: "cleared by Non",
    counterpart: org("Aus4ASEAN Futures", "Aus4ASEAN Futures", "Aus4ASEAN Futures"),
    title: text(
      "Regional workshop on the initial pipeline of ASEAN infrastructure projects",
      "การประชุมเชิงปฏิบัติการระดับภูมิภาคเรื่องบัญชีโครงการโครงสร้างพื้นฐานอาเซียนเบื้องต้น",
      "关于东盟基础设施项目初步清单的区域研讨会",
    ),
    note: text(
      "A feedback form for an infrastructure-pipeline workshop. The link to ASCN is indirect. No project result is recorded.",
      "เป็นแบบประเมินของเวิร์กช็อปบัญชีโครงการโครงสร้างพื้นฐาน ความเชื่อมกับ ASCN เป็นทางอ้อม ไม่มีผลของโครงการ",
      "这是一场基础设施项目清单研讨会的反馈表。与 ASCN 的关联是间接的。没有项目结果。",
    ),
  },
  "yseali-2021": {
    type: "course",
    outcome: "delivered",
    source: "cleared by Non",
    counterpart: org(
      "U.S. Embassy Bangkok",
      "สถานเอกอัครราชทูตสหรัฐอเมริกา ประจำกรุงเทพฯ",
      "美国驻曼谷大使馆",
    ),
    title: text(
      "YSEALI Smart Cities Regional Workshop",
      "การประชุมเชิงปฏิบัติการระดับภูมิภาคเมืองอัจฉริยะ YSEALI",
      "YSEALI 智慧城市区域研讨会",
    ),
    note: text(
      "A recorded talk and a virtual site visit were delivered. An in-person session in Bangkok was only tentative. This was a parallel United States programme, not an ASCN programme.",
      "มีการส่งมอบคำบรรยายที่บันทึกไว้และการเยี่ยมชมแบบออนไลน์ กำหนดการพบกันที่กรุงเทพฯ ยังเป็นเพียงแผนชั่วคราว นี่เป็นโครงการคู่ขนานของสหรัฐฯ ไม่ใช่โครงการของ ASCN",
      "已交付一场录像演讲和一次线上参访。曼谷的线下活动只是暂定。这是美国的平行项目，不是 ASCN 项目。",
    ),
  },
  "asuf-2021": {
    type: "communication",
    outcome: "delivered",
    source: "cleared by Non",
    counterpart: org("UN-Habitat", "UN-Habitat", "联合国人居署"),
    title: text(
      "UN-Habitat / ASEAN Sustainable Urbanisation Forum: digital skills dialogue",
      "เวทีการพัฒนาเมืองอย่างยั่งยืน UN-Habitat / อาเซียน: เสวนาทักษะดิจิทัล",
      "人居署 / 东盟可持续城镇化论坛：数字技能对话",
    ),
    note: text(
      "The panel talk on 7 Oct 2021 was delivered.",
      "การบรรยายบนเวทีวันที่ 7 ต.ค. 2021 เกิดขึ้นแล้ว",
      "2021年10月7日的专题发言已经完成。",
    ),
  },
  "sustinv-2021": {
    type: "communication",
    outcome: "failed",
    source: "cleared by Non",
    counterpart: ASEAN,
    title: text(
      "ASEAN Forum on Sustainable Investment, invitation extended to ASCN",
      "เวทีอาเซียนว่าด้วยการลงทุนอย่างยั่งยืน คำเชิญที่ส่งต่อถึง ASCN",
      "东盟可持续投资论坛，邀请转至 ASCN",
    ),
    note: text(
      "An invitation for 4–5 Nov 2021 was forwarded to ASCN members. Attendance and any result are not recorded.",
      "มีการส่งต่อคำเชิญสำหรับวันที่ 4–5 พ.ย. 2021 ถึงสมาชิก ASCN ไม่มีบันทึกการเข้าร่วมหรือผลลัพธ์",
      "2021年11月4–5日的邀请被转给 ASCN 成员。没有出席或结果的记录。",
    ),
  },
  "jaki-ascn-forum-2026": {
    type: "communication",
    outcome: "failed",
    source: "cleared by Non",
    counterpart: org("Jakarta Smart City", "จาการ์ตาสมาร์ตซิตี้", "雅加达智慧城市"),
    title: text(
      "ASCN Forum at the JAKI and Fellowship Cities Forum 2026",
      "เวที ASCN ในงาน JAKI และ Fellowship Cities Forum 2026",
      "2026年 JAKI 与伙伴城市论坛上的 ASCN 论坛",
    ),
    note: text(
      "A notice that an ASCN forum would close day two in Jakarta. No decision or delivery is recorded.",
      "เป็นประกาศว่าจะมีเวที ASCN ปิดท้ายวันที่สองที่จาการ์ตา ไม่มีบันทึกการตัดสินใจหรือสิ่งที่ส่งมอบ",
      "通知称雅加达论坛的第二天将以 ASCN 论坛收尾。没有决定或交付的记录。",
    ),
  },
  "smartjamp-phuket-2021": {
    type: "trip",
    outcome: "stalled",
    source: "cleared by Non",
    counterpart: MLIT,
    title: text(
      "Smart JAMP study on traffic management in Phuket",
      "การศึกษา Smart JAMP เรื่องการจัดการจราจรในภูเก็ต",
      "普吉交通管理 Smart JAMP 研究",
    ),
    note: text(
      "A Japanese-funded study, including a consultant visit to Phuket, stalled while waiting for CCTV data. No final report is visible. No amount is stated. Filed as a trip because the public event in this record is the site visit, not a sum of money.",
      "การศึกษาที่ญี่ปุ่นสนับสนุน รวมการลงพื้นที่ของที่ปรึกษาที่ภูเก็ต หยุดอยู่ระหว่างรอข้อมูลกล้องวงจรปิด ไม่ปรากฏรายงานฉบับสุดท้าย ไม่มีการระบุจำนวนเงิน จัดเป็นการเดินทางเพราะสิ่งที่บันทึกนี้แสดงคือการลงพื้นที่ ไม่ใช่ตัวเลขเงิน",
      "日本资助的研究（含顾问赴普吉实地走访）停在等待闭路电视数据。未见最终报告。未写明金额。归在出行类，因为这条记录里的公开活动是实地走访，不是一笔金额。",
    ),
  },
  "ascn-site-repo": {
    type: "communication",
    outcome: "delivered",
    source: "https://github.com/Nonarkara/ascn-smart-cities-network",
    counterpart: null,
    title: text(
      "Public site and repository for this ASCN record",
      "เว็บไซต์สาธารณะและคลังโค้ดของบันทึก ASCN นี้",
      "本 ASCN 记录的公开网站与代码库",
    ),
    note: text(
      "This public site is live. It is Dr Non’s own output, not a result delivered by the ASCN secretariat.",
      "เว็บไซต์สาธารณะนี้เปิดใช้งานอยู่ เป็นผลงานของ ดร. นนท์ เอง ไม่ใช่ผลที่สำนักเลขาธิการ ASCN ส่งมอบ",
      "这个公开网站已经上线。它是 Non 博士自己的成果，不是 ASCN 秘书处交付的结果。",
    ),
  },
};

function fail(message) {
  throw new Error(message);
}

function localized(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be {en, th, zh}`);
  const out = {};
  for (const lang of LANGS) {
    if (typeof value[lang] !== "string" || !value[lang].trim()) fail(`${field}.${lang} is empty`);
    out[lang] = value[lang].trim();
  }
  return out;
}

export function privateTextIssue(value, path = "") {
  if (typeof value === "string") {
    if (EMAIL.test(value) || OBFUSCATED_EMAIL.test(value) || /mailto:/i.test(value)) return `email address in ${path || "text"}`;
    if (PHONE_PATTERNS.some((pattern) => pattern.test(value))) return `phone number in ${path || "text"}`;
    if (RAW_EMAIL.test(value)) return `raw email text in ${path || "text"}`;
    return null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const issue = privateTextIssue(value[index], `${path}[${index}]`);
      if (issue) return issue;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (DENY_KEYS.has(key)) return `raw email field ${path ? `${path}.` : ""}${key}`;
      const issue = privateTextIssue(child, path ? `${path}.${key}` : key);
      if (issue) return issue;
    }
  }
  return null;
}

function assertDate(date, id) {
  if (typeof date !== "string" || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(date)) {
    fail(`${id} is missing a YYYY, YYYY-MM, or YYYY-MM-DD date`);
  }
  if (date.length === 4) return;
  const [year, month, day] = date.split("-").map(Number);
  if (month < 1 || month > 12) fail(`${id} date is not a real month`);
  if (date.length === 7) return;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    fail(`${id} date is not a real day`);
  }
}

function sourceOf(value, field) {
  if (value === "cleared by Non") return value;
  if (typeof value !== "string" || safeUrl(value) === "#" || !/^https?:\/\//i.test(value)) {
    fail(`${field} must be a public http(s) URL or "cleared by Non"`);
  }
  return value;
}

function amountOf(value, field) {
  if (value == null || value === "") return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) fail(`${field} is not a public amount`);
    return value;
  }
  if (typeof value !== "string" || !value.trim() || /none stated|not public|^n\/a$/i.test(value)) {
    fail(`${field} is not a public amount`);
  }
  return value.trim();
}

function isScrape(row) {
  return Boolean(row) && typeof row.scrapeId === "string" && typeof row.source_url === "string";
}

function isInbox(row) {
  return Boolean(row) && !isScrape(row) && (typeof row.title === "string" || typeof row.publishable === "string" || Array.isArray(row.thread_ids));
}

function isPublicShape(row) {
  return Boolean(row) && row.public === true && row.title && typeof row.title === "object" && !Array.isArray(row.title) && TYPE_SET.has(row.type);
}

function exclusion(row) {
  if (!row || typeof row !== "object") return "not public";
  if (row.public === false) return "not public";
  const publishable = typeof row.publishable === "string" ? row.publishable : "";
  const borderline = typeof row.borderline_reason === "string" ? row.borderline_reason.trim() : "";
  if (publishable && publishable !== "yes") return borderline || "not public";
  if (borderline) return borderline;
  return null;
}

function dateRank(date) {
  if (typeof date !== "string") return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return 3;
  if (/^\d{4}-\d{2}$/.test(date)) return 2;
  if (/^\d{4}$/.test(date)) return 1;
  return 0;
}

function bestDate(rows, id) {
  let best = "";
  let rank = 0;
  for (const row of rows) {
    const next = dateRank(row?.date);
    if (next > rank || (next === rank && next > 0 && row.date > best)) {
      best = row.date;
      rank = next;
    }
  }
  if (!rank) fail(`${id} is missing a YYYY, YYYY-MM, or YYYY-MM-DD date`);
  return best;
}

function confidenceOf(value, id, fallback) {
  const confidence = value ?? fallback;
  if (confidence !== "high" && confidence !== "medium") fail(`${id} confidence must be high or medium`);
  return confidence;
}

function formatAmount(row) {
  const currency = String(row.currency || "").trim();
  const raw = String(row.amount || "").trim();
  if (!/^[A-Z]{3}$/.test(currency)) fail(`${row.scrapeId} currency is not a public amount`);
  const over = raw.endsWith("+");
  const digits = over ? raw.slice(0, -1) : raw;
  if (!/^\d+$/.test(digits)) fail(`${row.scrapeId} amount is not a public amount`);
  return over ? `over ${currency} ${digits}` : `${currency} ${digits}`;
}

function withScrape(base, scrape) {
  const overlay = MERGE[scrape.scrapeId] || {};
  const next = { ...base, ...overlay, source: scrape.source_url };
  next.confidence = confidenceOf(scrape.confidence, scrape.scrapeId);
  if (base.selfReported === true || overlay.selfReported === true || /self-reported/i.test(scrape.source_type || "")) next.selfReported = true;
  else delete next.selfReported;
  if (next.publicAmount === true) next.amount = formatAmount(scrape);
  else delete next.amount;
  return next;
}

function normalizeItem(raw, id) {
  assertDate(raw.date, id);
  const item = {
    id,
    type: raw.type,
    date: raw.date,
    title: localized(raw.title, `${id} title`),
    counterpart: raw.counterpart == null ? null : localized(raw.counterpart, `${id} counterpart`),
    outcome: raw.outcome,
    note: localized(raw.note, `${id} note`),
    source: sourceOf(raw.source, `${id} source`),
    public: true,
    confidence: confidenceOf(raw.confidence, id, "high"),
  };
  if (!TYPE_SET.has(item.type)) fail(`${id} has an unknown type`);
  if (!OUTCOME_SET.has(item.outcome)) fail(`${id} has an unknown outcome`);
  if (raw.public === false) fail(`${id} is not public`);
  const amount = amountOf(raw.amount, `${id} amount`);
  if (amount != null) item.amount = amount;
  if (raw.selfReported === true) item.selfReported = true;
  else if (raw.selfReported != null && raw.selfReported !== false) fail(`${id} selfReported must be true`);
  return item;
}

function normalizePending(raw) {
  assertDate(raw.date, raw.id);
  const row = {
    id: raw.id,
    date: raw.date,
    title: localized(raw.title, `${raw.id} title`),
    counterpart: localized(raw.counterpart, `${raw.id} counterpart`),
    note: localized(raw.note, `${raw.id} note`),
    source: sourceOf(raw.source, `${raw.id} source`),
    confidence: confidenceOf(raw.confidence, raw.id),
    status: "pending review",
  };
  if (raw.status != null && raw.status !== "pending review") fail(`${raw.id} status must be pending review`);
  if (raw.outcome != null || raw.amount != null) fail(`${raw.id} pending review states no findings`);
  if (UNREAD_REVIEW.test(JSON.stringify(row))) fail(`${raw.id} quotes an unread review`);
  return row;
}

function withheldReason(id, rawReason) {
  if (rawReason === "not public") return NOT_PUBLIC;
  if (WITHHELD_COPY[id]) return WITHHELD_COPY[id];
  fail(`No public wording for withheld record ${id}`);
}

function assertNoThreadLeak(rows, document) {
  const output = JSON.stringify(document);
  for (const row of rows) {
    for (const threadId of row?.thread_ids || []) {
      if (threadId && output.includes(threadId)) fail(`Output contains thread id for ${row.id}`);
    }
  }
}

export function archiveSpan(items) {
  const years = items.map((item) => Number(String(item.date).slice(0, 4))).filter((year) => Number.isInteger(year));
  const last = Math.max(2026, 2018, ...years);
  return Array.from({ length: last - 2018 + 1 }, (_, index) => 2018 + index);
}

export function archiveReport(document, meta = {}) {
  const lines = [];
  if (meta.sourceRows != null) lines.push(`Source rows ${meta.sourceRows}`);
  lines.push(`Included ${document.items.length}`);
  for (const item of document.items) {
    lines.push(`- ${item.id}  ${item.type}  ${item.outcome}  ${item.confidence}${item.selfReported ? "  self-reported" : ""}`);
  }
  lines.push(`Excluded ${document.withheld.length}`);
  for (const row of document.withheld) lines.push(`- ${row.id}: ${row.reason.en}`);
  lines.push(`Pending review ${document.pending.length}`);
  for (const row of document.pending) lines.push(`- ${row.id}: ${row.status}`);
  const merged = meta.merged || [];
  lines.push(`Merged ${merged.length}`);
  for (const pair of merged) lines.push(`- ${pair.from} into ${pair.into}`);
  return lines.join("\n");
}

export function buildArchive(rows) {
  if (!Array.isArray(rows)) fail("Archive source must be an array of records");
  const byId = new Map();
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || !row.id.trim()) fail("A record is missing id");
    const id = row.id.trim();
    byId.set(id, [...(byId.get(id) || []), row]);
  }

  const items = [];
  const withheld = [];
  const pending = [];
  for (const [id, group] of byId) {
    const rawReason = group.map(exclusion).find(Boolean);
    if (rawReason) {
      withheld.push({ id, reason: localized(withheldReason(id, rawReason), `${id} withheld reason`) });
      continue;
    }
    const published = group.find(isPublicShape);
    const inbox = group.find(isInbox);
    const scrape = group.find(isScrape);
    const date = bestDate(group, id);
    if (scrape && !published && !inbox && PENDING[scrape.scrapeId]) {
      const copy = PENDING[scrape.scrapeId];
      pending.push(normalizePending({
        id: scrape.scrapeId,
        date,
        title: copy.title,
        counterpart: copy.counterpart,
        note: copy.note,
        source: scrape.source_url,
        confidence: scrape.confidence,
      }));
      continue;
    }
    if (published) {
      items.push(normalizeItem({ ...published, date, confidence: published.confidence || "high" }, id));
      continue;
    }
    if (scrape && !inbox && !SCRAPE[scrape.scrapeId]) fail(`No public wording for ${scrape.scrapeId}. Add a scrape entry before publishing.`);
    if (scrape && inbox && scrape.scrapeId !== id && !MERGE[scrape.scrapeId]) {
      fail(`No merge rule for ${scrape.scrapeId} into ${id}`);
    }
    const editorial = inbox ? EDITORIAL[id] : scrape ? SCRAPE[scrape.scrapeId] : null;
    if (inbox && !editorial) fail(`No public wording for ${id}. Add an editorial entry, or supply a public record with en/th/zh text, before publishing.`);
    if (editorial) {
      const next = scrape ? withScrape(editorial, scrape) : { ...editorial };
      if (!next.confidence) next.confidence = HIGH_SOURCE.has(id) ? "high" : "medium";
      items.push(normalizeItem({ ...next, date }, id));
    } else if (group.some((row) => row.public === true)) {
      fail(`${id} is marked public but is missing type, title translations, or outcome`);
    } else {
      withheld.push({ id, reason: localized(NOT_PUBLIC, `${id} withheld reason`) });
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  withheld.sort((a, b) => a.id.localeCompare(b.id));
  pending.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const document = { schema: 1, coverage: COVERAGE, items, withheld, pending };
  assertNoThreadLeak(rows, document);
  return validateRecordArchive(document);
}

export function validateRecordArchive(data) {
  if (!data || data.schema !== 1) fail("ascn-archive.json: schema must be 1");
  localized(data.coverage, "coverage");
  if (!Array.isArray(data.items)) fail("ascn-archive.json: items must be an array");
  if (!Array.isArray(data.withheld)) fail("ascn-archive.json: withheld must be an array");
  if (!Array.isArray(data.pending)) fail("ascn-archive.json: pending must be an array");
  const ids = new Set();
  let previous = "";
  for (const item of data.items) {
    if (!item || typeof item !== "object") fail("ascn-archive.json: invalid item");
    for (const key of Object.keys(item)) if (!ITEM_KEYS.includes(key)) fail(`${item.id || "item"}: unexpected field ${key}`);
    if (typeof item.id !== "string" || !item.id || ids.has(item.id)) fail("ascn-archive.json: duplicate or empty id");
    ids.add(item.id);
    const sortKey = `${item.date}\u0000${item.id}`;
    if (previous && sortKey < previous) fail("ascn-archive.json: items must be sorted by date then id");
    previous = sortKey;
    normalizeItem(item, item.id);
    if (item.public !== true) fail(`${item.id} must be public`);
  }
  const withheldIds = new Set();
  for (const row of data.withheld) {
    if (!row || typeof row.id !== "string" || !row.id || withheldIds.has(row.id) || ids.has(row.id)) {
      fail("ascn-archive.json: withheld ids must be unique and absent from items");
    }
    withheldIds.add(row.id);
    localized(row.reason, `${row.id} withheld reason`);
  }
  const pendingIds = new Set();
  for (const row of data.pending) {
    if (!row || typeof row !== "object") fail("ascn-archive.json: invalid pending row");
    for (const key of Object.keys(row)) if (!PENDING_KEYS.includes(key)) fail(`${row.id || "pending"}: unexpected field ${key}`);
    if (typeof row.id !== "string" || !row.id || pendingIds.has(row.id) || ids.has(row.id) || withheldIds.has(row.id)) {
      fail("ascn-archive.json: pending ids must be unique and absent from items");
    }
    pendingIds.add(row.id);
    const pending = normalizePending(row);
    if (pending.status !== "pending review") fail(`${row.id} must be pending review`);
  }
  if (UNREAD_REVIEW.test(JSON.stringify(data.pending))) fail("ascn-archive.json quotes an unread review");
  const issue = privateTextIssue(data);
  if (issue) fail(`ascn-archive.json contains ${issue}`);
  return data;
}

async function readJsonRows(path) {
  const text = await readFile(path, "utf8");
  if (text.length > 2_000_000) fail(`Archive JSON is too large: ${path}`);
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

async function walkJson(dir, rows) {
  if (!existsSync(dir)) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkJson(path, rows);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) rows.push(...await readJsonRows(path));
  }
}

export function parseRecordsCsv(text) {
  const table = parseCsv(String(text || "").replace(/^\uFEFF/, ""));
  const filled = table.filter((row) => row.some((cell) => cell.trim()));
  if (!filled.length) fail("Public records CSV is empty");
  const header = filled[0].map((cell) => cell.trim());
  for (const key of ["id", "date", "year", "amount", "currency", "source_url", "source_type", "confidence"]) {
    if (!header.includes(key)) fail(`Public records CSV is missing ${key}`);
  }
  const seen = new Set();
  return filled.slice(1).map((cols) => {
    const raw = {};
    header.forEach((key, index) => { raw[key] = (cols[index] || "").trim(); });
    if (!/^[A-Z]\d{2}$/.test(raw.id)) fail(`Public row ${raw.id || "(blank)"} is not a scrape id`);
    if (seen.has(raw.id)) fail(`Duplicate public row ${raw.id}`);
    seen.add(raw.id);
    return {
      id: SCRAPE_ALIAS[raw.id] || raw.id,
      scrapeId: raw.id,
      date: raw.date || raw.year,
      source_url: raw.source_url,
      source_type: raw.source_type,
      confidence: raw.confidence,
      amount: raw.amount,
      currency: raw.currency,
    };
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function buildFromDirectory(dir) {
  const recordsPath = join(dir, "records.json");
  if (!existsSync(recordsPath)) fail(`No ASCN archive source at ${recordsPath}. Set ASCN_ARCHIVE_DIR when Scrape’s data lands.`);
  const rows = await readJsonRows(recordsPath);
  await walkJson(join(dir, "public"), rows);
  const csvPath = join(dir, "public", "records.csv");
  let merged = [];
  if (existsSync(csvPath)) {
    const csvText = await readFile(csvPath, "utf8");
    if (csvText.length > 2_000_000) fail(`Archive CSV is too large: ${csvPath}`);
    const csvRows = parseRecordsCsv(csvText);
    merged = csvRows.filter((row) => row.scrapeId !== row.id).map((row) => ({ from: row.scrapeId, into: row.id }));
    rows.push(...csvRows);
  }
  const document = buildArchive(rows);
  return { document, report: archiveReport(document, { sourceRows: rows.length, merged }) };
}
