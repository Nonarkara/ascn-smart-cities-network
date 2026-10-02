"use strict";

(() => {
  const overview = document.querySelector("#view-overview");
  const player = document.querySelector("#showcase-player");
  const selector = document.querySelector("#showcase-selector");
  if (!overview || !player || !selector) return;

  const title = document.querySelector("#showcase-title");
  const description = document.querySelector("#showcase-description");
  const directLink = document.querySelector("#showcase-open");
  const error = document.querySelector("#showcase-error");
  const clips = [...selector.querySelectorAll("[data-video]")];
  const source = player.querySelector("source");

  selector.hidden = false;
  for (const clip of clips) {
    clip.addEventListener("click", () => {
      if (clip.getAttribute("aria-pressed") === "true") return;
      player.pause();
      for (const item of clips) item.setAttribute("aria-pressed", String(item === clip));
      const name = clip.querySelector("strong").textContent;
      const src = `media/showcase/${clip.dataset.video}.mp4`;
      source.src = src;
      player.poster = clip.querySelector("img").getAttribute("src");
      player.setAttribute("aria-label", name);
      title.textContent = name;
      description.textContent = clip.querySelector(".showcase-clip-description").textContent;
      directLink.href = src;
      error.hidden = true;
      player.load();
    });
  }

  player.addEventListener("error", () => { error.hidden = false; });
  source.addEventListener("error", () => { error.hidden = false; });
  // Routing changes the overview's hidden attribute, including direct hash links.
  new MutationObserver(() => {
    if (overview.hidden) player.pause();
  }).observe(overview, { attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) player.pause();
  });
})();
