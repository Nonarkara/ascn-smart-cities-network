# ASCN Working Papers — publish brief

Drafts are ready for the research tab on **ascn.nonarkara.org**. Nothing is live until a reviewed PR lands.

## Suggested paper paths

| # | File | Suggested URL path |
|---|------|--------------------|
| 1 | `papers/01-4p-framework.html` | `/papers/01-4p-framework.html` (or `/research/4p-filter`) |
| 2 | `papers/02-agentic-ai-flooddash.html` | `/papers/02-agentic-ai-flooddash.html` (or `/research/agentic-ai-flooddash`) |
| 3 | `papers/03-smart-city-finance.html` | `/papers/03-smart-city-finance.html` (or `/research/smart-city-finance`) |

Source Markdown lives beside each HTML file. Rebuild with:

```bash
cd papers && python3 build.py
```

Assets (diagrams, CC/PD photos, fonts) are under `papers/assets/`. Keep that folder next to the HTML when deploying.

## Research-tab copy (EN)

**Working papers**

Three short bilingual papers from Dr Non Arkaraprasertkul, Thailand’s ASCN representative since 2019. Plain language, full citations, openly licensed figures.

1. **The 4P Filter** — Purpose, Practicality, Proof and People: a checklist before you write a TOR, with city figures from recorded talks (including Nakhon Si Thammarat).
2. **One Builds, Another Checks** — How FloodDash reached storm-ready reliability with agentic AI: build–check loops, tests, gates and a human at the merge button.
3. **Stop Waiting for the Budget** — A plain guide to the six families of finance in the ASEAN Smart City Financing Toolkit, plus the cost of waiting.

Each page is English and Thai side by side. Drafts pending site PR.

## Research-tab copy (TH)

**เอกสารทำงาน (Working papers)**

บทความสองภาษาสั้น ๆ สามฉบับ โดย ดร.นน อัครประเสริฐกุล ผู้แทนประเทศไทยใน ASCN ตั้งแต่ปี 2562 ภาษาง่าย อ้างอิงครบ แผนภาพและภาพถ่ายเปิดสิทธิ์

1. **ตัวกรอง 4P** — เป้าหมาย ทำได้จริง พิสูจน์ก่อน และคน: รายการตรวจสอบก่อนเขียน TOR พร้อมตัวเลขเมืองจากการบรรยาย (รวมนครศรีธรรมราช)
2. **คนหนึ่งสร้าง อีกคนตรวจ** — FloodDash ไปถึงระดับที่พึ่งพาได้ในพายุด้วย AI แบบเอเจนต์อย่างไร: วงจรสร้าง–ตรวจ ชุดทดสอบ ด่านปล่อย และคนกดรวมโค้ด
3. **เลิกรองบประมาณ** — คู่มือภาษาง่ายเรื่องแหล่งเงินหกกลุ่มใน ASEAN Smart City Financing Toolkit และต้นทุนของการรอ

แต่ละหน้ามีทั้งภาษาอังกฤษและไทย คู่กัน ฉบับร่างรอ PR ขึ้นเว็บ

## Author CHECK resolution (15 Oct 2026 ICT)

| Item | Decision | Done in drafts |
|------|----------|----------------|
| City figures (184→42; NST 2023 award) | Yes — include with methods note | §6 in paper 01; pending public citation noted |
| FloodDash internal records | Yes — authorised to publish | Methods + Limitations in paper 02 |
| ASCN title since 2019 | Yes — accurate | Bylines on all three papers |
| Finance case studies | No invented deals; add later when cleared | Limitations note in paper 03 |

## Next step

Open a reviewed pull request that copies `papers/*.html` and `papers/assets/` into the ASCN site research section, and paste the research-tab copy above into the hub page.
