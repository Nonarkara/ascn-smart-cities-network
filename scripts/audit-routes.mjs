// Use the visible site's route links, including secondary views outside the rail.
export async function auditRoutes(page) {
  return page.evaluate(() => {
    const links = document.querySelectorAll(
      '#tab-nav a[data-tab], a[href="#ascn9"][data-tab], a[data-news-view]'
    );
    return [...new Set([...links].map(link => link.hash.slice(1)).map(route =>
      route === 'news/review' ? 'news' : route
    ))].filter(Boolean);
  });
}

export async function waitForAuditRoute(page, route, timeout = 8000) {
  await page.waitForFunction((route) => {
    const [surface, panel = 'review'] = route.split('/');
    const view = document.querySelector('section.view:not([hidden])');
    return view?.dataset.view === surface &&
      (surface !== 'news' || view.querySelector('[data-news-panel]:not([hidden])')?.dataset.newsPanel === panel);
  }, route, { timeout });
  await page.evaluate(() => document.fonts.ready);
}
