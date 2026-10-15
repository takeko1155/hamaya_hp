/**
 * 浜屋 ホームページ管理（お知らせ・お品書き）
 *
 * Google Apps Script の Web アプリ。開いた人の Google アカウントを確認し、
 * 許可された人だけが data/news.json・data/menu.json・メニュー画像を
 * GitHub に直接コミットできる。push で GitHub Actions が動いてサイトに反映される。
 *
 * スクリプト プロパティ:
 *   GITHUB_TOKEN  … takeko1155/hamaya_hp の Contents を読み書きできる fine-grained トークン
 */

const REPO = 'takeko1155/hamaya_hp';
const BRANCH = 'main';
const SITE_URL = 'https://takeko1155.github.io/hamaya_hp/';
const ALLOWED_EMAILS = ['（非公開）', '（非公開）'];

const NEWS_PATH = 'data/news.json';
const MENU_PATH = 'data/menu.json';
const MENU_DIR = 'src/assets/menu'; // full images; thumbnails live in MENU_DIR/thumb

const LIMITS = { newsMax: 30, title: 30, body: 300, pages: 20, alt: 30, imageBytes: 1.5 * 1024 * 1024 };

// ---------- web app ----------

function doGet() {
  const email = currentEmail_();
  const allowed = ALLOWED_EMAILS.includes(email);
  const t = HtmlService.createTemplateFromFile('index');
  t.allowed = allowed;
  t.email = email;
  t.limits = LIMITS;
  t.siteUrl = SITE_URL;
  return t
    .evaluate()
    .setTitle('浜屋 ホームページ管理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Everything the screen needs: current news, menu pages (with image URLs) and the commit they came from. */
function loadData() {
  assertAllowed_();
  const head = headCommit_();
  const news = JSON.parse(readFile_(NEWS_PATH, head.sha));
  const menu = JSON.parse(readFile_(MENU_PATH, head.sha));
  const raw = `https://raw.githubusercontent.com/${REPO}/${head.sha}/src/`;
  const pages = menu.main.pages.map((p) => ({
    src: p.src,
    alt: p.alt || '',
    thumb: raw + p.src.replace(/([^/]+)$/, 'thumb/$1'),
    full: raw + p.src,
  }));
  return {
    baseSha: head.sha,
    news: news.map((n) => ({ date: n.date, title: n.title, body: (n.body || []).join('\n\n') })),
    pages,
  };
}

/**
 * Replace the whole news list.
 * @param {{date:string,title:string,body:string}[]} items
 * @param {string} baseSha commit the screen was loaded from (detects edits made elsewhere)
 */
function saveNews(items, baseSha) {
  const email = assertAllowed_();
  if (!Array.isArray(items) || items.length > LIMITS.newsMax) throw new Error(`お知らせは${LIMITS.newsMax}件までです。`);
  const clean = items.map((it, i) => {
    const no = `${i + 1}件目`;
    const date = String(it.date || '');
    if (!isValidDate_(date)) throw new Error(`${no}：日付を選んでください。`);
    const title = plain_(it.title).replace(/\n/g, ' ').trim();
    if (!title) throw new Error(`${no}：タイトルを入力してください。`);
    if (title.length > LIMITS.title) throw new Error(`${no}：タイトルは${LIMITS.title}文字までです。`);
    const body = plain_(it.body).trim();
    if (body.length > LIMITS.body) throw new Error(`${no}：本文は${LIMITS.body}文字までです。`);
    if (hasUrl_(title + body)) throw new Error(`${no}：リンク（URL）は入れられません。`);
    return { date, title, body: body ? body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [] };
  });
  clean.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const sha = commit_(baseSha, `お知らせを更新（${email}）`, [
    { path: NEWS_PATH, text: JSON.stringify(clean, null, 2) + '\n' },
  ]);
  return { ok: true, sha };
}

/**
 * Replace the menu page list.
 * Each page is either an existing one ({src, alt}) or a new upload ({image:{full,thumb}, alt}),
 * where full/thumb are base64 JPEGs already resized in the browser.
 */
function saveMenu(pages, baseSha) {
  const email = assertAllowed_();
  if (!Array.isArray(pages) || pages.length === 0) throw new Error('お品書きは1ページ以上必要です。');
  if (pages.length > LIMITS.pages) throw new Error(`お品書きは${LIMITS.pages}ページまでです。`);

  const current = JSON.parse(readFile_(MENU_PATH, baseSha));
  const existing = new Set(current.main.pages.map((p) => p.src));
  const changes = [];
  const kept = new Set();
  const stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmmss');

  const next = pages.map((p, i) => {
    const no = `${i + 1}ページ目`;
    const alt = plain_(p.alt).replace(/\n/g, ' ').trim();
    if (alt.length > LIMITS.alt) throw new Error(`${no}：ページ名は${LIMITS.alt}文字までです。`);
    if (hasUrl_(alt)) throw new Error(`${no}：リンク（URL）は入れられません。`);

    if (p.image) {
      const full = jpegBytes_(p.image.full, no);
      const thumb = jpegBytes_(p.image.thumb, no);
      const name = `menu-${stamp}-${i + 1}.jpg`;
      changes.push({ path: `${MENU_DIR}/${name}`, bytes: full });
      changes.push({ path: `${MENU_DIR}/thumb/${name}`, bytes: thumb });
      return { src: `assets/menu/${name}`, alt };
    }
    if (!existing.has(p.src)) throw new Error(`${no}：画像が見つかりません。画面を読み込み直してください。`);
    kept.add(p.src);
    return { src: p.src, alt };
  });

  // images no longer used are removed (GitHub history keeps them as a backup)
  for (const src of existing) {
    if (kept.has(src)) continue;
    changes.push({ path: `src/${src}`, remove: true });
    changes.push({ path: `src/${src.replace(/([^/]+)$/, 'thumb/$1')}`, remove: true });
  }

  current.main.pages = next;
  changes.push({ path: MENU_PATH, text: JSON.stringify(current, null, 2) + '\n' });
  const sha = commit_(baseSha, `お品書きを更新（${email}）`, changes);
  return { ok: true, sha };
}

// ---------- validation helpers ----------

function currentEmail_() {
  return (Session.getActiveUser().getEmail() || '').toLowerCase();
}

function assertAllowed_() {
  const email = currentEmail_();
  if (!ALLOWED_EMAILS.includes(email)) throw new Error('このアカウントには編集の権限がありません。');
  return email;
}

function isValidDate_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

// control / zero-width / bidi characters (built from a string: Apps Script's parser
// rejects U+2028 inside a regex literal)
const INVISIBLE_ = new RegExp('[\\u0000-\\u0009\\u000B-\\u001F\\u007F\\u200B-\\u200F\\u2028-\\u202E]', 'g');

/** Text only: normalise newlines, drop control characters, collapse long blank runs. */
function plain_(v) {
  return String(v == null ? '' : v)
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE_, '')
    .replace(/\n{3,}/g, '\n\n');
}

function hasUrl_(s) {
  return /https?:|www\.|[a-z0-9-]+\.(com|jp|net|org|io|me|co)\b/i.test(s);
}

function jpegBytes_(b64, no) {
  let bytes;
  try {
    bytes = Utilities.base64Decode(String(b64 || ''));
  } catch (e) {
    throw new Error(`${no}：画像を読み込めませんでした。`);
  }
  const isJpeg = bytes.length > 3 && (bytes[0] & 0xff) === 0xff && (bytes[1] & 0xff) === 0xd8;
  if (!isJpeg) throw new Error(`${no}：画像の形式が正しくありません。`);
  if (bytes.length > LIMITS.imageBytes) throw new Error(`${no}：画像が大きすぎます。`);
  return bytes;
}

// ---------- GitHub (Git Data API) ----------

function gh_(method, path, body) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GitHub の設定がまだです（管理者に連絡してください）。');
  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    contentType: 'application/json',
    payload: body ? JSON.stringify(body) : undefined,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code >= 300) {
    const err = new Error(`GitHub ${method} ${path} → ${code}: ${text.slice(0, 200)}`);
    err.status = code;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

function headCommit_() {
  const ref = gh_('get', `/git/ref/heads/${BRANCH}`);
  const commit = gh_('get', `/git/commits/${ref.object.sha}`);
  return { sha: commit.sha, tree: commit.tree.sha };
}

function readFile_(path, sha) {
  const f = gh_('get', `/contents/${encodeURI(path)}?ref=${sha}`);
  return Utilities.newBlob(Utilities.base64Decode(f.content.replace(/\n/g, ''))).getDataAsString('UTF-8');
}

/**
 * One commit with all changes. Refuses if main moved since the screen loaded,
 * so two people editing at once never silently overwrite each other.
 */
function commit_(baseSha, message, changes) {
  const head = headCommit_();
  if (head.sha !== baseSha) {
    throw new Error('ほかの場所で更新されています。画面を読み込み直してから、もう一度保存してください。');
  }
  const tree = changes.map((c) => {
    if (c.remove) return { path: c.path, mode: '100644', type: 'blob', sha: null };
    const blob = c.bytes
      ? gh_('post', '/git/blobs', { content: Utilities.base64Encode(c.bytes), encoding: 'base64' })
      : gh_('post', '/git/blobs', { content: c.text, encoding: 'utf-8' });
    return { path: c.path, mode: '100644', type: 'blob', sha: blob.sha };
  });
  const newTree = gh_('post', '/git/trees', { base_tree: head.tree, tree });
  const commit = gh_('post', '/git/commits', { message, tree: newTree.sha, parents: [head.sha] });
  gh_('patch', `/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
  return commit.sha;
}
