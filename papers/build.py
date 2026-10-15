import markdown,re,glob,html
CSS='''@font-face{font-family:Plex;src:url(assets/fonts/IBMPlexSerif-Regular.ttf)}@font-face{font-family:Plex;font-style:italic;src:url(assets/fonts/IBMPlexSerif-Italic.ttf)}
@font-face{font-family:PlexMono;src:url(assets/fonts/IBMPlexMono-Regular.ttf)}@font-face{font-family:Sarabun;src:url(assets/fonts/Sarabun-Regular.ttf)}@font-face{font-family:Sarabun;font-weight:700;src:url(assets/fonts/Sarabun-Bold.ttf)}
:root{--paper:#f4efe4;--ink:#1d1d1b;--red:#d9472b;--ochre:#e0a526;--blue:#2c4f9e;--green:#3f7f5b}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:18px/1.65 Plex,Georgia,serif}
.rail{position:sticky;top:0;background:var(--ink);color:var(--paper);display:flex;gap:1.2rem;align-items:center;padding:.6rem 1.25rem;font:13px PlexMono,monospace;letter-spacing:.04em;z-index:2}
.rail a{color:var(--paper);text-decoration:none;border-bottom:2px solid transparent}.rail a:hover,.rail a:focus{border-color:var(--ochre)}.rail .sp{flex:1}
.strip{display:grid;grid-template-columns:5fr 3fr 2fr 1fr;height:14px}.strip i:nth-child(1){background:var(--red)}.strip i:nth-child(2){background:var(--ochre)}.strip i:nth-child(3){background:var(--blue)}.strip i:nth-child(4){background:var(--green)}
main{max-width:44rem;margin:0 auto;padding:2.5rem 1.25rem 5rem}section+section{border-top:3px solid var(--ink);margin-top:4rem;padding-top:2rem}
h1{font-size:2.1rem;line-height:1.15;margin:.2rem 0 1rem}h2{font:600 1.05rem PlexMono,monospace;text-transform:uppercase;letter-spacing:.03em;margin-top:2.6rem;border-left:8px solid var(--red);padding-left:.6rem}
section[lang=th]{font-family:Sarabun,sans-serif;font-size:19px;line-height:1.8}section[lang=th] h2{font-family:Sarabun;text-transform:none;font-size:1.2rem;font-weight:700}
img{max-width:100%;height:auto;display:block;border:2px solid var(--ink);background:#fff}p em:only-child{display:block;font-size:.85rem;margin-top:-.4rem}
a{color:var(--blue)}code{font-family:PlexMono}ol li,ul li{margin:.3rem 0}
.hero{max-width:44rem;margin:1.5rem auto 0;padding:0 1.25rem}.hero figcaption{font:12px PlexMono,monospace;margin-top:.4rem}
@media(max-width:600px){body{font-size:17px}h1{font-size:1.6rem}}
@media print{.rail{display:none}}'''
HERO={'01':('khlong-thonburi.jpg','Khlongs in the Thon Buri district, Bangkok, 2007. Photo: David Broad, CC BY 3.0, via Wikimedia Commons.')}
for md in sorted(glob.glob('0*.md')):
  s=open(md).read();fm,body=re.match(r'(?s)---\n(.*?)\n---\n(.*)',s).groups()
  meta=dict(re.findall(r'(\w+): "(.*)"',fm))
  body=re.sub(r'<section ([^>]*)>(.*?)</section>',lambda m:f'<section {m.group(1)}>'+markdown.markdown(m.group(2),extensions=['extra'])+'</section>',body,flags=re.S)
  body=re.sub(r'(https?://[^\s<)]+[^\s<).,])(?![^<]*</a>)(?![^<]*>)',r'<a href="\1">\1</a>',body)
  n=md[:2];hero=''
  if n in HERO: hero=f'<figure class="hero"><img src="assets/{HERO[n][0]}" alt=""><figcaption>{HERO[n][1]}</figcaption></figure>'
  out=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(meta["title"])}</title><meta name="description" content="{html.escape(meta["series"])} · {html.escape(meta["author"])}"><style>{CSS}</style></head><body>
<nav class="rail" aria-label="Paper"><span>{html.escape(meta["series"]).upper()}</span><span class="sp"></span><a href="#en">ENGLISH</a><a href="#th" lang="th">ไทย</a><a href="#references">REFERENCES</a></nav>
<div class="strip" aria-hidden="true"><i></i><i></i><i></i><i></i></div>{hero}<main>{body}</main></body></html>'''
  out=out.replace('<h2>References</h2>','<h2 id="references">References</h2>')
  open(md[:-3]+'.html','w').write(out);print(md[:-3]+'.html')
