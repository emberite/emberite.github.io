#!/usr/bin/env node
// Builds the emberite.github.io site from the dh-* repositories.
//
//   GITHUB_ACCESS_TOKEN=… node build.mjs
//
// Reads the token from the environment or from .env, fetches each module's
// repository, latest release, module.json, README and screenshots, copies the
// screenshots into assets/screenshots/<repo>/ and writes index.html.

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site, order, modules as content } from './content.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const API = 'https://api.github.com';

async function loadToken() {
  if (process.env.GITHUB_ACCESS_TOKEN) return process.env.GITHUB_ACCESS_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const envFile = join(ROOT, '.env');
  if (existsSync(envFile)) {
    const m = (await readFile(envFile, 'utf8')).match(/^GITHUB_ACCESS_TOKEN=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

const token = await loadToken();
if (!token) console.warn('No GitHub token found; using unauthenticated requests (60/hour).');

async function gh(path, { raw = false, optional = false } = {}) {
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    headers: {
      Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'emberite-site-builder',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    if (optional && res.status === 404) return null;
    throw new Error(`GitHub ${res.status} for ${path}: ${await res.text()}`);
  }
  return raw ? res.text() : res.json();
}

async function download(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'emberite-site-builder', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`Download ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Width and height from a WebP, PNG or JPEG header, so <img> tags reserve space.
function imageSize(buf) {
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

const IMAGE = /\.(webp|png|jpe?g|gif|avif)$/i;

// Images the README shows from inside the repo, in reading order, with their alt text.
function readmeImages(readme) {
  const out = new Map();
  const add = (src, alt) => {
    if (/^(https?:|data:|\/\/)/.test(src) || !IMAGE.test(src.split(/[?#]/)[0])) return;
    const path = src.split(/[?#]/)[0].replace(/^\.?\//, '');
    if (!out.has(path) || (!out.get(path) && alt)) out.set(path, alt ?? '');
  };
  for (const [, alt, src] of readme.matchAll(/!\[([^\]]*)\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g)) add(src, alt);
  for (const [tag] of readme.matchAll(/<img\b[^>]*>/gi)) {
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (src) add(src, tag.match(/\balt=["']([^"']*)["']/i)?.[1] ?? '');
  }
  return out;
}

const fallbackAlt = (path) => path.split('/').pop().replace(/^\d+-|-v\d+|\.\w+$/g, '').replace(/[-_]/g, ' ');

const KNOWN_DEPS = {
  'daggerheart-core': ['Daggerheart Core Rulebook', 'https://www.foundryvtt.store/products/daggerheart-core'],
  'daggerheart-hope-and-fear': ['Daggerheart: Hope & Fear', 'https://www.foundryvtt.store/products/daggerheart-hope-and-fear'],
  'dice-so-nice': ['Dice So Nice', 'https://foundryvtt.com/packages/dice-so-nice'],
  daggerheart: ['Daggerheart system', 'https://foundryborne.online/'],
};

function dep(rel) {
  const [name, url] = KNOWN_DEPS[rel.id] ?? [rel.id, null];
  const min = rel.compatibility?.minimum;
  return { id: rel.id, name, url, min };
}

async function collect() {
  const repos = (await gh(`/users/${site.owner}/repos?per_page=100&type=owner`))
    .filter((r) => r.name.startsWith(site.repoPrefix) && !r.fork && !r.archived && !r.private);
  repos.sort((a, b) => {
    const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
  });

  // The account's GitHub avatar is the site logo and favicon.
  const user = await gh(`/users/${site.owner}`);
  await mkdir(join(ROOT, 'assets'), { recursive: true });
  await writeFile(join(ROOT, 'assets', 'avatar.png'), await download(`${user.avatar_url}${user.avatar_url.includes('?') ? '&' : '?'}s=128`));

  const shotsRoot = join(ROOT, 'assets', 'screenshots');
  await rm(shotsRoot, { recursive: true, force: true });

  const result = [];
  for (const repo of repos) {
    const name = repo.name;
    process.stdout.write(`${name}… `);
    const [release, readme, tree] = await Promise.all([
      gh(`/repos/${site.owner}/${name}/releases/latest`, { optional: true }),
      gh(`/repos/${site.owner}/${name}/readme`, { raw: true, optional: true }),
      gh(`/repos/${site.owner}/${name}/git/trees/${repo.default_branch}?recursive=1`),
    ]);

    // Prefer the released module.json: it carries the stamped version.
    let manifest = null;
    const manifestAsset = release?.assets?.find((a) => a.name === 'module.json');
    if (manifestAsset) {
      try { manifest = JSON.parse((await download(manifestAsset.browser_download_url)).toString('utf8')); } catch {}
    }
    if (!manifest) {
      const text = await gh(`/repos/${site.owner}/${name}/contents/module.json`, { raw: true, optional: true });
      manifest = text ? JSON.parse(text) : {};
    }

    // Screenshots: every image the README shows, in README order, then any other
    // image under docs/ (whatever the folder is called).
    const blobs = new Set(tree.tree.filter((t) => t.type === 'blob').map((t) => t.path));
    const shown = readme ? readmeImages(readme) : new Map();
    const paths = [...shown.keys()].filter((p) => blobs.has(p));
    for (const p of [...blobs].sort()) if (p.startsWith('docs/') && IMAGE.test(p) && !paths.includes(p)) paths.push(p);
    if (!paths.length) throw new Error(`${name} has no screenshots: no README images and no images under docs/`);

    await mkdir(join(shotsRoot, name), { recursive: true });
    const shots = [];
    for (const path of paths) {
      const raw = `https://raw.githubusercontent.com/${site.owner}/${name}/${repo.default_branch}/${path.split('/').map(encodeURIComponent).join('/')}`;
      const buf = await download(raw);
      const file = path.replace(/^docs\//, '').replace(/\//g, '-');
      await writeFile(join(shotsRoot, name, file), buf);
      const size = imageSize(buf) ?? { w: 1200, h: 800 };
      shots.push({ file: path.split('/').pop(), src: `assets/screenshots/${name}/${file}`, alt: shown.get(path) || fallbackAlt(path), ...size });
    }

    // Lead screenshot: the one named in content.mjs if it still exists, else the README's first.
    const c = content[name] ?? {};
    const heroIdx = Math.max(0, shots.findIndex((s) => s.file === c.hero));
    if (c.hero && !shots.some((s) => s.file === c.hero)) console.warn(`(hero ${c.hero} not found, using ${shots[0].file}) `);
    shots.unshift(...shots.splice(heroIdx, 1));

    const rel = manifest.relationships ?? {};
    const zip = release?.assets?.find((a) => a.name === 'module.zip');
    result.push({
      name,
      title: manifest.title ?? name,
      short: c.short ?? (manifest.title ?? name).split(':')[0],
      frame: c.frame ?? null,
      source: c.source ?? null,
      accent: c.accent ?? '#f08a3c',
      tagline: c.tagline ?? repo.description ?? '',
      blurb: c.blurb ?? '',
      features: c.features ?? [],
      url: repo.html_url,
      version: (release?.tag_name ?? manifest.version ?? '').replace(/^v/, ''),
      released: release?.published_at ?? repo.pushed_at,
      releaseUrl: release?.html_url ?? `${repo.html_url}/releases`,
      // Always the newest release's zip, so the link never goes stale.
      zip: zip ? `${repo.html_url}/releases/latest/download/module.zip` : (manifest.download ?? null),
      manifestUrl: manifest.manifest ?? `${repo.html_url}/releases/latest/download/module.json`,
      foundry: manifest.compatibility ?? {},
      system: (rel.systems ?? []).map(dep)[0] ?? null,
      requires: (rel.requires ?? []).map(dep),
      recommends: (rel.recommends ?? []).map(dep),
      license: repo.license?.spdx_id ?? null,
      shots,
    });
    console.log(`v${result.at(-1).version}, ${shots.length} screenshots`);
  }
  return result;
}

// ---------- rendering ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const date = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const icon = {
  github: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>',
  expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function img(shot, { cls = '', eager = false, sizes } = {}) {
  return `<img src="${esc(shot.src)}" alt="${esc(shot.alt)}" width="${shot.w}" height="${shot.h}"${cls ? ` class="${cls}"` : ''} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${sizes ? ` sizes="${sizes}"` : ''}>`;
}

function depList(m) {
  const li = (d, note) => `<li>${d.url ? `<a href="${esc(d.url)}">${esc(d.name)}</a>` : esc(d.name)}${d.min ? ` <span class="muted">${esc(d.min)}+</span>` : ''}${note ? ` <span class="pill">${note}</span>` : ''}</li>`;
  const items = [
    `<li><a href="https://foundryvtt.com/">Foundry VTT</a> <span class="muted">v${esc(m.foundry.minimum ?? '?')}${m.foundry.verified ? ` · verified ${esc(m.foundry.verified)}` : ''}</span></li>`,
    m.system && li(m.system),
    ...m.requires.map((d) => li(d, 'required')),
    ...m.recommends.map((d) => li(d, 'recommended')),
  ].filter(Boolean);
  return `<ul class="deps">${items.join('')}</ul>`;
}

function moduleSection(m, i) {
  const [hero, ...rest] = m.shots;
  const gallery = rest.map((s, j) => `
          <li><button class="thumb" type="button" data-gallery="${esc(m.name)}" data-index="${j + 1}" aria-label="Enlarge: ${esc(s.alt)}">${img(s, { sizes: '(max-width: 700px) 45vw, 220px' })}</button></li>`).join('');
  return `
    <section class="module${i % 2 ? ' flip' : ''}" id="${esc(m.name)}" style="--accent:${esc(m.accent)}" aria-labelledby="${esc(m.name)}-title">
      <div class="module-grid">
        <div class="module-copy">
          <p class="eyebrow">${m.frame ? `<span>${esc(m.frame)}</span>` : ''}${m.source ? `<span class="muted">${esc(m.source)}</span>` : ''}</p>
          <h2 id="${esc(m.name)}-title">${esc(m.short)}</h2>
          <p class="tagline">${esc(m.tagline)}</p>
          ${m.blurb ? `<p class="blurb">${esc(m.blurb)}</p>` : ''}
          <div class="meta">
            <a class="badge" href="${esc(m.releaseUrl)}">${icon.tag}v${esc(m.version)}</a>
            <span class="muted">Released ${esc(date(m.released))}</span>
            ${m.license ? `<span class="muted">${esc(m.license)}</span>` : ''}
          </div>
        </div>
        <figure class="module-hero">
          <button class="hero-shot" type="button" data-gallery="${esc(m.name)}" data-index="0" aria-label="Enlarge: ${esc(hero.alt)}">
            ${img(hero, { sizes: '(max-width: 960px) 100vw, 640px' })}
            <span class="zoom">${icon.expand}</span>
          </button>
          <figcaption>${esc(hero.alt)}</figcaption>
        </figure>
      </div>
      ${m.features.length ? `<ul class="features">${m.features.map(([t, d]) => `
        <li><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join('')}
      </ul>` : ''}
      ${gallery ? `<ul class="gallery" aria-label="${esc(m.short)} screenshots">${gallery}
      </ul>` : ''}
      <div class="install">
        <div class="install-manifest">
          <label for="${esc(m.name)}-manifest">Manifest URL</label>
          <div class="copy-field">
            <input id="${esc(m.name)}-manifest" type="text" readonly value="${esc(m.manifestUrl)}" spellcheck="false">
            <button type="button" class="copy" data-copy="${esc(m.name)}-manifest">${icon.copy}<span>Copy</span></button>
          </div>
          <div class="actions">
            <a class="btn" href="${esc(m.url)}">${icon.github}Source &amp; docs</a>
            ${m.zip ? `<a class="btn ghost" href="${esc(m.zip)}">${icon.download}module.zip</a>` : ''}
          </div>
        </div>
        <div class="install-deps">
          <span class="label">Works with</span>
          ${depList(m)}
        </div>
      </div>
      <script type="application/json" data-gallery-json="${esc(m.name)}">${JSON.stringify(m.shots.map(({ src, alt, w, h }) => ({ src, alt, w, h }))).replace(/</g, '\\u003c')}</script>
    </section>`;
}

// Opens the repo's issue form; the form's field ids can be pre-filled from the URL.
function issueUrl(m, kind) {
  const q = new URLSearchParams(kind === 'bug'
    ? { template: 'bug_report.yml', 'module-version': m.version }
    : { template: 'feature_request.yml' });
  return `${m.url}/issues/new?${q}`;
}

function supportRow(m) {
  return `
        <li style="--accent:${esc(m.accent)}">
          <span class="support-name">${esc(m.short)}</span>
          <a class="btn" href="${esc(issueUrl(m, 'bug'))}">Report a bug</a>
          <a class="btn" href="${esc(issueUrl(m, 'feature'))}">Request a feature</a>
          <a class="support-open" href="${esc(m.url)}/issues">Open issues</a>
        </li>`;
}

function render(mods) {
  const avatar = '<img class="avatar" src="assets/avatar.png" alt="" width="32" height="32">';
  const heroShots = mods.slice(0, 4).map((m) => ({ m, s: m.shots[0] }));
  const ogImage = mods[0]?.shots[0]?.src;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(site.title)}</title>
  <meta name="description" content="${esc(site.description)}">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#120d0b">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(site.title)}">
  <meta property="og:description" content="${esc(site.description)}">
  <meta property="og:url" content="https://${site.owner}.github.io/">
  ${ogImage ? `<meta property="og:image" content="https://${site.owner}.github.io/${esc(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">` : ''}
  <link rel="icon" href="assets/avatar.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a class="skip" href="#modules">Skip to the modules</a>
  <header class="topbar">
    <nav class="wrap nav" aria-label="Main">
      <a class="brand" href="#top">${avatar}<span>emberite</span></a>
      <ul class="nav-links">
        ${mods.map((m) => `<li><a href="#${esc(m.name)}" style="--accent:${esc(m.accent)}">${esc(m.short)}</a></li>`).join('\n        ')}
      </ul>
      <a class="nav-support" href="#support">Support</a>
      <a class="nav-gh" href="https://github.com/${site.owner}" aria-label="emberite on GitHub">${icon.github}</a>
    </nav>
  </header>

  <main id="top">
    <section class="hero">
      <div class="embers" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${6 + (i * 7) % 9}s;--delay:-${(i * 13) % 11}s;--s:${2 + (i % 3)}px"></i>`).join('')}</div>
      <div class="wrap hero-grid">
        <div class="hero-copy">
          <h1>Tools for the tables of Daggerheart’s campaign frames</h1>
          <p class="lede">Free, open-source Foundry VTT modules that turn a campaign frame’s rules into things the whole table can see and touch.</p>
          <div class="actions">
            <a class="btn primary" href="#modules">Browse the modules</a>
            <a class="btn ghost" href="#install">How to install</a>
          </div>
        </div>
        <div class="hero-stack" aria-hidden="true">
          ${heroShots.map(({ m, s }, i) => `<a href="#${esc(m.name)}" tabindex="-1" class="card c${i}" style="--accent:${esc(m.accent)}">${img(s, { eager: i < 2, sizes: '(max-width: 960px) 70vw, 420px' })}<span>${esc(m.short)}</span></a>`).join('\n          ')}
        </div>
      </div>
    </section>

    <section class="wrap strip" aria-label="Notes">
      <p class="note"><strong>No AI artwork.</strong> The modules use no AI-generated art. Their images come from Foundry VTT, the Daggerheart system, or the official Daggerheart Core Rulebook and Hope &amp; Fear modules. Horizon’s hex map tiles are <a href="https://cuddlyclover.itch.io/fantasy-hex-tiles">Fantasy Hex Tiles</a> by The Clover Patch (CC BY 4.0). Custom Beast Feast artwork and tokens for Hotpot have been commissioned from a human artist and will be added once they’re ready.</p>
      <p class="note"><strong>One frame at a time.</strong> Each module is built for its own campaign frame, so only one of them can be active in a world. Enabling a second one prompts the GM to choose.</p>
    </section>

    <div id="modules" class="modules">
      ${mods.map(moduleSection).join('\n')}
    </div>

    <section class="wrap howto" id="install" aria-labelledby="install-title">
      <h2 id="install-title">Installing a module</h2>
      <ol class="steps">
        <li><span>1</span><div><h3>Get the requirements</h3><p>Foundry VTT v14, the Daggerheart system 2.12 or later, and the official content module the frame comes from (Core Rulebook or Hope &amp; Fear). The modules load that content at runtime and include none of it.</p></div></li>
        <li><span>2</span><div><h3>Paste the manifest</h3><p>In Foundry’s setup screen, open <strong>Add-on Modules → Install Module</strong>, paste the module’s manifest URL from above and click <strong>Install</strong>.</p></div></li>
        <li><span>3</span><div><h3>Enable it in your world</h3><p>Turn it on under <strong>Manage Modules</strong>. Its tools appear in the Daggerheart sidebar menu, under the campaign frame’s name.</p></div></li>
      </ol>
    </section>

    <section class="wrap howto support" id="support" aria-labelledby="support-title">
      <h2 id="support-title">Support</h2>
      <p class="section-lede">Found a bug or have an idea? Open an issue on the module’s GitHub repository. You need a free <a href="https://github.com/signup">GitHub account</a>. Search the open issues first: if someone already reported it, add a comment or a 👍 there instead.</p>
      <div class="support-grid">
        <div class="support-card">
          <h3>Reporting a bug</h3>
          <ul class="checklist">
            <li>What happened, and what you expected instead</li>
            <li>The steps to make it happen again</li>
            <li>Your versions of Foundry VTT, the Daggerheart system and the module</li>
            <li>Any other modules that are active</li>
            <li>Errors from the browser console (<kbd>F12</kbd> → Console), as text</li>
            <li>A screenshot, if it shows the problem</li>
          </ul>
        </div>
        <div class="support-card">
          <h3>Requesting a feature</h3>
          <ul class="checklist">
            <li>What you’d like to do at the table</li>
            <li>Which rule or part of the campaign frame it’s about, with a page reference if you have one</li>
            <li>How you handle it today, without the feature</li>
          </ul>
        </div>
      </div>
      <ul class="support-modules">
        ${mods.map(supportRow).join('')}
      </ul>
    </section>
  </main>

  <footer class="footer">
    <div class="wrap">
      <p class="brand small">${avatar}<span>emberite</span></p>
      <p>The modules’ code is released under the MIT License. They are unofficial fan works, not affiliated with Darrington Press, Critical Role or Foundry Gaming. Daggerheart content and art are loaded from the official modules you own and are not distributed here; the screenshots show those modules in use.</p>
      <p class="muted">This product includes materials from the Daggerheart System Reference Document 2.0, © Critical Role, LLC. under the terms of the Darrington Press Community Gaming (DPCGL) License. More information can be found at <a href="https://www.daggerheart.com">daggerheart.com</a>. There are no previous modifications by others.</p>
      <p class="muted">Built from the <a href="https://github.com/${site.owner}?tab=repositories&amp;q=${encodeURIComponent(site.repoPrefix)}">${esc(site.repoPrefix)}* repositories</a> on ${esc(date(new Date().toISOString()))}.</p>
    </div>
  </footer>

  <dialog class="lightbox" aria-label="Screenshot viewer">
    <form method="dialog"><button class="lb-close" aria-label="Close">×</button></form>
    <button class="lb-nav prev" type="button" aria-label="Previous screenshot">‹</button>
    <figure><img alt=""><figcaption></figcaption></figure>
    <button class="lb-nav next" type="button" aria-label="Next screenshot">›</button>
  </dialog>

  <script src="app.js" defer></script>
</body>
</html>
`;
}

const mods = await collect();
await writeFile(join(ROOT, 'data.json'), JSON.stringify(mods, null, 2) + '\n');
await writeFile(join(ROOT, 'index.html'), render(mods));
console.log(`Wrote index.html with ${mods.length} modules.`);
