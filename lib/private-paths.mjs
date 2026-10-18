const privatePaths = [
  '/data/ascn-correspondence.json', '/data/ascn-email-evidence.json',
  '/lib/correspondence.mjs', '/lib/ascn-record.mjs', '/lib/ascn-funding.mjs', '/lib/ascn-scrape.mjs', '/lib/ascn-round2.mjs',
  '/media/ascn9', '/media/showcase/metadata.json', '/sources', '/scripts', '/.git', '/.env',
];
export function isPrivatePath(pathname) {
  let path;
  try { path = decodeURIComponent(pathname).toLowerCase(); } catch { return true; }
  if (path.startsWith("/docs/") && /contact|guidebook.*draft/.test(path)) return true;
  if (path.split("/").some((part) => part.startsWith(".env") || part === ".git" || part === ".ds_store")) return true;
  return privatePaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
