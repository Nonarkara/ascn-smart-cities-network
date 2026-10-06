import { safeUrl } from "./security.mjs";

export const NEWS_SOURCES = [
  { id: "eco-cities", name: "Eco-Business", section: "Cities", url: "https://www.eco-business.com/feeds/category/3/", site: "https://www.eco-business.com/feeds/", topic: "Infrastructure" },
  { id: "eco-transport", name: "Eco-Business", section: "Transport", url: "https://www.eco-business.com/feeds/category/9/", site: "https://www.eco-business.com/feeds/", topic: "Mobility" },
  { id: "itnews-asia", name: "iTnews Asia", section: "Technology", url: "https://www.itnews.asia/rss/rss.ashx", site: "https://www.itnews.asia/rss" },
  { id: "antara-tech", name: "ANTARA", section: "Technology", url: "https://en.antaranews.com/rss/tech.xml", site: "https://en.antaranews.com/rss", country: "Indonesia" },
];

export const NEWS_TOPICS = ["Digital Government", "Mobility", "Climate & Resilience", "Infrastructure", "Energy", "Urban Innovation"];
export const NEWS_COUNTRIES = ["Brunei", "Cambodia", "Indonesia", "Laos", "Malaysia", "Myanmar", "Philippines", "Singapore", "Thailand", "Timor-Leste", "Viet Nam"];

const geography = [
  /\b(brunei|bandar seri begawan)\b/i, /\b(cambodia|phnom penh|siem reap|battambang)\b/i,
  /\b(indonesia|jakarta|nusantara|surabaya|bali|makassar|semarang|denpasar|bandung|indonesian)\b/i,
  /\b(laos|lao pdr|vientiane|luang prabang)\b/i, /\b(malaysia|kuala lumpur|penang|johor|ipoh|kuching|malaysian)\b/i,
  /\b(myanmar|yangon|mandalay|nay pyi taw)\b/i, /\b(philippines|philippine|manila|cebu|davao|iloilo)\b/i,
  /\b(singapore|singpass|govtech singapore)\b/i, /\b(thailand|thai|bangkok|phuket|chiang mai)\b/i,
  /\b(timor.leste|dili)\b/i, /\b(viet ?nam|vietnamese|hanoi|ha noi|ho chi minh|da nang|hcmc)\b/i,
];
const topics = [
  /\b(digital government|public sector|govtech|singpass|digital identity|public services|e.government|digital econom\w*|ministries)\b/i,
  /\b(mobility|transport|transit|rail|metro|traffic|electric vehicle|evs?|charging|bus|cycling|aviation|airport|cruise terminal)\b/i,
  /\b(flood|climate|resilien|heat|water|waste|disaster|air quality|pollution|carbon|wildfire|haze)\w*/i,
  /\b(infrastructure|housing|urban|cities|city|building|construction|planning)\b/i,
  /\b(energy|grid|renewable|solar|electricity|power|hydrogen)\b/i,
  /\b(smart cit|innovation|iot|sensors?|digital twin|data platform|artificial intelligence|ai)\w*/i,
];

export function tagHeadline(text, source = {}) {
  const countries = NEWS_COUNTRIES.filter((_, index) => geography[index].test(text));
  if (!countries.length && source.country) countries.push(source.country);
  const taggedTopics = NEWS_TOPICS.filter((_, index) => topics[index].test(text));
  if (!taggedTopics.length && source.topic) taggedTopics.push(source.topic);
  return { countries, topics: taggedTopics, regional: /\b(asean|southeast asia|south-east asia)\b/i.test(text) };
}

export function filterArticles(articles, { query = "", country = "all", topic = "all", publisher = "all", days = "all" } = {}, now = Date.now()) {
  const search = query.trim().toLowerCase();
  return articles.filter((article) =>
    (!search || `${article.title} ${article.publisher} ${article.countries.join(" ")}`.toLowerCase().includes(search)) &&
    (country === "all" || (country === "Regional" ? !article.countries.length : article.countries.includes(country))) &&
    (topic === "all" || article.topics.includes(topic)) &&
    (publisher === "all" || article.publisher === publisher) &&
    (days === "all" || (article.publishedAt && now - Date.parse(article.publishedAt) <= Number(days) * 86400000))
  );
}

export function validateNewsPayload(payload) {
  if (!payload || !Array.isArray(payload.articles) || payload.articles.length > 100 || !Number.isFinite(Date.parse(payload.checkedAt))) throw new Error("Invalid news payload");
  const articles = payload.articles.filter((article) => {
    if (typeof article.title !== "string" || !article.title || article.title.length > 240 || typeof article.publisher !== "string") return false;
    try { if (new URL(article.url).protocol !== "https:" || safeUrl(article.url) === "#") return false; } catch { return false; }
    return Array.isArray(article.countries) && article.countries.every((country) => NEWS_COUNTRIES.includes(country)) &&
      Array.isArray(article.topics) && article.topics.every((topic) => NEWS_TOPICS.includes(topic)) &&
      (article.publishedAt == null || Number.isFinite(Date.parse(article.publishedAt)));
  });
  return { ...payload, articles, sources: Array.isArray(payload.sources) ? payload.sources.slice(0, 20) : [] };
}
