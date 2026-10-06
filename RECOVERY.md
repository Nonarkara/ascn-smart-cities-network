# ASCN view recovery, 7 October 2026

The open browser tab pointed to the June deployment snapshot
`7d7433bf.ascn-smart-cities-network.pages.dev`. That snapshot has the early
six-section observatory. The maintained V2 is https://ascn.nonarkara.org,
with eleven navigation sections, city profiles, research, essays, contacts,
project analytics, the annual meeting record, and video demonstrations.
Use the custom domain for ongoing reviews. Deployment hash URLs preserve
one particular build and do not follow subsequent releases.

The current site also had a separate basemap failure. CARTO returned
watermarked "API key required" images instead of readable geography.
HTTP success and a non-zero image width did not detect that failure.

This release switches the cities and contacts basemaps to OpenStreetMap's
standard tiles. The existing city markers, selection, zoom, filters,
attribution, and night mode remain. Night mode filters only the tile pane;
it leaves city marker colours and text unchanged. Tiles load on demand
through the browser with normal cache and Referer behaviour; there is no
bulk download, proxy, or offline cache.

Sources:

- https://www.carto.com/basemaps/apikey/
- https://operations.osmfoundation.org/policies/tiles/

Regression checks cover both maps, provider URLs, loaded tiles, visible
attribution, night/day switching, Kuching selection, all eleven navigation
links, and page fit at 375, 768, and 1280 pixels. Visual review must also
confirm real coastlines and labels: a successful image request alone is
insufficient.
