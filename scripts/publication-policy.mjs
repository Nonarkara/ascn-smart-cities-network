import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateRecordArchive } from '../lib/ascn-record.mjs';
import { fundingFromItems } from '../lib/ascn-funding.mjs';

const privateOrigins = new Set(["2246c7f53cbfe87496d4d6dfb5b50c72c0c5bd576aa73fce172dac9f5abc86ae", "deef4b704caac3fc0a4bf8638b237bb4dbcccb204f9b1c8e1050bad997d868b8", "4e876a45930da52acee03041bef677316d08b50c4ad88613d8e89dd29e01db5e", "645987e3b63862ecbab31d640784882f2165734822032a0f9d6c66bc22babc14", "e2d2cbaf282c8b4dbacbc9de44334b08763724fd62660b5ba687b8f010d4af14", "cb088a328fac3b1c920a738e3ab7d694be84846be5422022e5f3231f04522deb", "3cf70e2bc4bf5283778fa23e6f8adc9f7451f01934a1da0b5e02168b783b0b80", "c35160d4abee466826a6c82f000d819831f5cad762a4b38b5bf74c4410d726f6", "18cb27fe1755fa8c0ce382142c300ba7db0482d9438b9032e856f2aff7e1b7bd", "f4ae336fac3a2582c96f85639aa3e08eca88b36220794562560111d227b7b452", "b8e5ef49a3d865622bc130fe5790ac883e99dfe9015ab48af1d3d5e0882b443e", "35b664c7045f9ff1a1972f7a1efd9f62738b988ebac5eb88299eb36e5c449fe5", "e5119320ad1545755ab9df7496acb7924096fd6e3ab109d848ad69ce1dca15cc", "c2f3b233fbc47dba542354bbd06010ff7574a698d62d5bc3e61cf1de764ae308", "506552cab7680c665efe090897514d3e0b8ced8a2dabce24944ab228f0dfd0df"]);
const isPrivateOrigin = (id) => privateOrigins.has(createHash("sha256").update(id).digest("hex"));
const publicSource = (source) => {
  try { const u = new URL(source); return u.protocol === 'https:' && !u.username && !u.password; }
  catch { return false; }
};
export const publicCoverage = {
  en: 'Records from published pages and reports. Every row links to its public source. Private correspondence and internal drafts are excluded. Funding totals are recalculated from the retained public records. These records describe the available evidence, not the network’s complete activity.',
  th: 'บันทึกจากหน้าเว็บและรายงานที่เผยแพร่แล้ว ทุกรายการมีลิงก์แหล่งข้อมูลสาธารณะ ไม่รวมจดหมายส่วนตัวและฉบับร่างภายใน ยอดเงินคำนวณใหม่จากรายการสาธารณะที่คงไว้ บันทึกนี้อธิบายหลักฐานที่มี ไม่ใช่กิจกรรมทั้งหมดของเครือข่าย',
  zh: '来自已公开网页和报告的记录。每条均链接至公开来源。私人通信和内部草稿不予发布。资金合计根据保留的公开记录重新计算。这些记录说明现有证据，并非网络全部活动。',
};
export function publicArchive(document) {
  const items = document.items.filter((item) => !isPrivateOrigin(item.id) && publicSource(item.source));
  const ids = new Set(items.map((item) => item.id));
  return validateRecordArchive({ schema: 1, coverage: publicCoverage, items, withheld: [],
    pending: document.pending.filter((row) => publicSource(row.source) && !isPrivateOrigin(row.id)),
    account: null, funding: fundingFromItems(items),
    money: document.money.filter((row) => publicSource(row.source)),
    reconciliation: { kept: [], conflicts: [] },
    mergedProgrammes: document.mergedProgrammes.filter((row) => ids.has(row.into) && publicSource(row.source)),
  });
}
export const archiveFingerprint = (document) => createHash('sha256').update(JSON.stringify(document, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v)).digest('hex');
export function assertPublicArchive(document) {
  const projected = publicArchive(document);
  if (archiveFingerprint(projected) !== archiveFingerprint(document)) throw new Error('Archive contains private provenance or nonpublic records. Run the public archive projection before publication.');
  const reviewed = readFileSync(new URL('./public-records.sha256', import.meta.url), 'utf8').trim();
  if (archiveFingerprint(document) !== reviewed) throw new Error('Public archive differs from the source-reviewed release. Review every changed record before updating public-records.sha256.');
  return document;
}
