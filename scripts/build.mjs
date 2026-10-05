// Builds dist/ from src/ + data/*.json. No dependencies.
// Fails (exit 1) on invalid data so a broken update never replaces the live site.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const NEWS_VISIBLE = 3;
const NEWS_MAX = 10; // newest 3 shown + up to 7 under 過去のお知らせ
const NEWS_MAX_AGE_DAYS = 365; // older notices drop off automatically

const errors = [];
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Escape first, then turn URLs and phone numbers into links.
const linkify = (text) =>
  esc(text)
    .replace(/https?:\/\/[^\s<>"']+/g, (url) => `<a href="${url}" target="_blank" rel="noopener">${url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>`)
    .replace(/(?<![\d\/-])(0\d{1,4}-\d{1,4}-\d{3,4})(?![\d-])/g, (tel) => `<a href="tel:${tel}">${tel}</a>`)
    .replace(/\n/g, '<br>');

const fmtDate = (iso) => iso.replaceAll('-', '.');

const todayJst = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const daysAgo = (iso) => (Date.parse(todayJst) - Date.parse(iso)) / 86400e3;

// ---------- news ----------
const news = readJson('data/news.json');
if (!Array.isArray(news)) errors.push('news.json: 配列ではありません');
const newsItems = (Array.isArray(news) ? news : [])
  .filter((n, i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.date ?? '')) errors.push(`news[${i}]: 日付が不正です (${n.date})`);
    if (!n.title?.trim()) errors.push(`news[${i}]: タイトルが空です`);
    if (!Array.isArray(n.body)) errors.push(`news[${i}]: body は配列にしてください`);
    return true;
  })
  .sort((a, b) => (a.date < b.date ? 1 : -1))
  .filter((n) => !(daysAgo(n.date) > NEWS_MAX_AGE_DAYS))
  .slice(0, NEWS_MAX);

// One line per notice (date + title); the body opens inline. No per-notice pages.
// "NEW" relies on the daily scheduled build to drop off after NEWS_NEW_DAYS.
const NEWS_NEW_DAYS = 14;
const renderNewsItem = (n) => {
  const paras = (n.body ?? []).filter((p) => p.trim());
  const head = `<time class="news-date" datetime="${esc(n.date)}">${fmtDate(esc(n.date))}</time><span class="news-title">${esc(n.title)}</span>${
    daysAgo(n.date) <= NEWS_NEW_DAYS ? '<span class="news-new">NEW</span>' : ''
  }`;
  if (!paras.length) return `\n          <li class="news-item"><div class="news-head">${head}</div></li>`;
  return `
          <li class="news-item">
            <details>
              <summary class="news-head">${head}</summary>
              <div class="news-text">${paras.map((p) => `<p>${linkify(p.trim())}</p>`).join('')}</div>
            </details>
          </li>`;
};

const visible = newsItems.slice(0, NEWS_VISIBLE);
const past = newsItems.slice(NEWS_VISIBLE);
let newsHtml = visible.length
  ? `        <ul class="news-list">${visible.map(renderNewsItem).join('')}\n        </ul>`
  : `        <p class="news-empty">現在お知らせはありません。</p>`;
if (past.length) {
  newsHtml += `
        <details class="news-past">
          <summary>過去のお知らせ（${past.length}件）</summary>
          <ul class="news-list">${past.map(renderNewsItem).join('')}
          </ul>
        </details>`;
}

// ---------- menu ----------
const menu = readJson('data/menu.json');
const groups = Object.entries(menu);
if (!groups.length) errors.push('menu.json: メニューがありません');
for (const [key, g] of groups) {
  if (!g.pages?.length) errors.push(`menu.${key}: ページが0件です`);
  for (const p of g.pages ?? []) {
    if (!fs.existsSync(path.join(SRC, p.src))) errors.push(`menu.${key}: 画像がありません (${p.src})`);
  }
}
const thumbOf = (src) => {
  const t = path.posix.join(path.posix.dirname(src), 'thumb', path.posix.basename(src));
  return fs.existsSync(path.join(SRC, t)) ? t : src;
};

const menuHtml = `      <div class="menu-tabs" role="tablist" aria-label="お品書きの種類">
${groups
  .map(
    ([key, g], i) =>
      `        <button class="menu-tab" type="button" role="tab" id="tab-${key}" aria-controls="panel-${key}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ''}>${esc(g.label)}</button>`
  )
  .join('\n')}
      </div>
${groups
  .map(
    ([key, g], i) => `      <div class="menu-panel" id="panel-${key}" role="tabpanel" aria-labelledby="tab-${key}"${i ? ' hidden' : ''}>
        <p class="menu-panel-note">${esc(g.note ?? '')}</p>
        <ul class="menu-grid">
${(g.pages ?? [])
  .map(
    (p) =>
      `          <li><button type="button" data-full="${esc(p.src)}"><img src="${esc(thumbOf(p.src))}" alt="${esc(p.alt ?? g.label)}" width="520" height="736" loading="lazy" decoding="async"><span class="cap">${esc(p.alt ?? '')}</span></button></li>`
  )
  .join('\n')}
        </ul>
      </div>`
  )
  .join('\n')}`;

// ---------- structured data ----------
const jsonld = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: '浜屋',
  alternateName: '活魚料理・うに釜めし 浜屋',
  url: 'https://hamaya-senzaki.com/',
  image: 'https://hamaya-senzaki.com/assets/img/uni-kamameshi.webp',
  telephone: '+81-837-26-1436',
  servesCuisine: ['和食', '海鮮料理', '釜めし'],
  acceptsReservations: true,
  address: {
    '@type': 'PostalAddress',
    postalCode: '759-4106',
    addressRegion: '山口県',
    addressLocality: '長門市',
    streetAddress: '仙崎4137-5',
    addressCountry: 'JP',
  },
  geo: { '@type': 'GeoCoordinates', latitude: 34.38858, longitude: 131.20038 },
  sameAs: ['https://www.instagram.com/hamaya_senzaki/'],
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '11:30', closes: '15:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '18:00', closes: '22:00' },
  ],
};

// ---------- output ----------
if (errors.length) {
  console.error('ビルドを中止しました:\n- ' + errors.join('\n- '));
  process.exit(1);
}

const version = Date.now().toString(36);
const html = fs
  .readFileSync(path.join(SRC, 'index.html'), 'utf8')
  .replace('<!--NEWS-->', newsHtml)
  .replace('<!--MENU-->', menuHtml)
  // NOINDEX=1 while the site is a preview, so search engines don't index the draft
  .replace('<!--ROBOTS-->', process.env.NOINDEX ? '<meta name="robots" content="noindex, nofollow">' : '')
  .replace('<!--JSONLD-->', `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`)
  .replaceAll('{{VERSION}}', version);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(path.join(SRC, 'assets'), path.join(DIST, 'assets'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html);
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
console.log(`built dist/ — news ${newsItems.length}, menu ${groups.map(([k, g]) => `${k}:${g.pages.length}`).join(' ')}`);
