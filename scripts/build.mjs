#!/usr/bin/env node
// Publishing pipeline: content/blog/*.md -> blog/<slug>/index.html + blog/index.html + sitemap.xml
// Usage: npm run build   (then commit the generated files)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.webuildco.com.au';
const CONTENT_DIR = join(ROOT, 'content/blog');
const TEMPLATE = readFileSync(join(ROOT, 'templates/post.html'), 'utf8');
const DEFAULT_OG = `${SITE}/og-image.jpg`;

// Static pages, in sitemap order. Blog posts are appended automatically.
const STATIC_PAGES = [
  { loc: `${SITE}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${SITE}/audit/`, changefreq: 'monthly', priority: '0.8' },
  { loc: `${SITE}/tools/roi-calculator/`, changefreq: 'monthly', priority: '0.8' },
  { loc: `${SITE}/blog/`, changefreq: 'weekly', priority: '0.7' },
  { loc: `${SITE}/privacy.html`, changefreq: 'yearly', priority: '0.2' },
  { loc: `${SITE}/terms.html`, changefreq: 'yearly', priority: '0.2' },
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fail = msg => { console.error(`BUILD FAILED: ${msg}`); process.exit(1); };

// ponytail: flat "key: value" frontmatter only — no YAML nesting; upgrade to a YAML lib if CMO ever needs lists/objects
function parseFrontmatter(raw, file) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) fail(`${file}: missing frontmatter block (--- ... ---)`);
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i === -1) fail(`${file}: bad frontmatter line "${line}"`);
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return { fm, body: m[2] };
}

function humanDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// --- Build posts ---
const posts = [];
const files = existsSync(CONTENT_DIR) ? readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md') && f !== 'README.md').sort() : [];

for (const file of files) {
  const { fm, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, file), 'utf8'), file);
  if (fm.draft === 'true') { console.log(`skip draft: ${file}`); continue; }
  for (const req of ['title', 'description', 'date']) if (!fm[req]) fail(`${file}: frontmatter missing "${req}"`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.date)) fail(`${file}: date must be YYYY-MM-DD`);
  if (fm.description.length > 165) fail(`${file}: description over 165 chars (${fm.description.length})`);

  const slug = fm.slug || file.replace(/\.md$/, '');
  if (!/^[a-z0-9-]+$/.test(slug)) fail(`${file}: slug "${slug}" must be lowercase kebab-case`);
  const canonical = `${SITE}/blog/${slug}/`;
  const updated = fm.updated || fm.date;
  const author = fm.author || 'WeBuild Agency';
  const ogImage = fm.image ? (fm.image.startsWith('http') ? fm.image : SITE + fm.image) : DEFAULT_OG;
  const tags = fm.tags ? fm.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': canonical,
    headline: fm.title,
    description: fm.description,
    datePublished: fm.date,
    dateModified: updated,
    image: ogImage,
    author: { '@type': 'Organization', name: author, url: `${SITE}/` },
    publisher: { '@id': `${SITE}/#organization` },
    mainEntityOfPage: canonical,
    inLanguage: 'en-AU',
    ...(tags.length ? { keywords: tags.join(', ') } : {}),
  };

  const html = TEMPLATE
    .replaceAll('{{TITLE}}', esc(fm.title))
    .replaceAll('{{DESCRIPTION}}', esc(fm.description))
    .replaceAll('{{CANONICAL}}', canonical)
    .replaceAll('{{AUTHOR}}', esc(author))
    .replaceAll('{{OG_IMAGE}}', esc(ogImage))
    .replaceAll('{{DATE_ISO}}', fm.date)
    .replaceAll('{{UPDATED_ISO}}', updated)
    .replaceAll('{{DATE_HUMAN}}', humanDate(fm.date))
    .replaceAll('{{JSONLD}}', JSON.stringify(jsonld))
    .replaceAll('{{TAGS_HTML}}', tags.map(t => `<span>${esc(t)}</span>`).join(''))
    .replaceAll('{{CONTENT}}', marked.parse(body));

  const outDir = join(ROOT, 'blog', slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
  posts.push({ slug, canonical, ...fm, updated, tags });
  console.log(`built: /blog/${slug}/`);
}

posts.sort((a, b) => b.date.localeCompare(a.date));

// --- Blog index ---
const indexCards = posts.map(p => `
      <a class="card" href="/blog/${p.slug}/">
        <div class="post-meta">${humanDate(p.date)}</div>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.description)}</p>
      </a>`).join('\n');

const indexHtml = TEMPLATE
  .replaceAll('{{TITLE}}', 'Blog — AI automation for Australian SMBs')
  .replaceAll('{{DESCRIPTION}}', 'Practical guides on AI agents, automation ROI, and agentic systems for Australian small and medium businesses, from the WeBuild team.')
  .replaceAll('{{CANONICAL}}', `${SITE}/blog/`)
  .replaceAll('{{AUTHOR}}', 'WeBuild Agency')
  .replaceAll('{{OG_IMAGE}}', DEFAULT_OG)
  .replaceAll('{{DATE_ISO}}', posts[0]?.date || '2026-07-14')
  .replaceAll('{{UPDATED_ISO}}', posts[0]?.updated || '2026-07-14')
  .replaceAll('{{DATE_HUMAN}}', 'WeBuild Agency')
  .replaceAll('{{JSONLD}}', JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Blog', '@id': `${SITE}/blog/`,
    name: 'WeBuild Agency Blog', publisher: { '@id': `${SITE}/#organization` }, inLanguage: 'en-AU',
  }))
  .replaceAll('{{TAGS_HTML}}', '')
  .replace(/<article class="container prose">[\s\S]*?<\/article>/, `<div class="container">
      <div class="prose" style="text-align:center;">
        <div class="post-meta">WeBuild Blog</div>
        <h1>Practical AI automation, explained</h1>
        <p>Guides and teardowns on putting AI agents to work in Australian SMBs.</p>
      </div>
      <div class="card-grid">${indexCards}
      </div>
    </div>`)
  // index page is a listing, not an article — drop article OG type
  .replace('content="article"', 'content="website"');
writeFileSync(join(ROOT, 'blog', 'index.html'), indexHtml);
console.log(`built: /blog/ (${posts.length} post${posts.length === 1 ? '' : 's'})`);

// --- Sitemap ---
const today = new Date().toISOString().slice(0, 10);
const urls = [
  ...STATIC_PAGES.map(p => ({ ...p, lastmod: p.loc === `${SITE}/blog/` ? (posts[0]?.updated || today) : '2026-07-14' })),
  ...posts.map(p => ({ loc: p.canonical, lastmod: p.updated, changefreq: 'monthly', priority: '0.6' })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap.xml'), sitemap);
console.log(`built: sitemap.xml (${urls.length} urls)`);

// --- Internal link check: every root-relative href in generated pages must resolve to a file ---
let broken = 0;
const generated = [join(ROOT, 'blog', 'index.html'), ...posts.map(p => join(ROOT, 'blog', p.slug, 'index.html'))];
for (const page of generated) {
  const hrefs = [...readFileSync(page, 'utf8').matchAll(/href="(\/[^"#?]*)/g)].map(m => m[1]);
  for (const href of new Set(hrefs)) {
    const target = join(ROOT, href.replace(/\/$/, ''));
    const ok = existsSync(target) && (statSync(target).isFile() || existsSync(join(target, 'index.html')));
    if (!ok) { console.error(`broken internal link ${href} in ${page.replace(ROOT, '')}`); broken++; }
  }
}
if (broken) fail(`${broken} broken internal link(s)`);
console.log('link check: OK');
