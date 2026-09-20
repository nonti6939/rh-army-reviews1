// admin.js — private admin for the RH ARMY reviews site
//
// Routes (all password protected):
//   GET    /admin                      -> the admin page
//   GET    /api/admin/reviews          -> list of reviews (JSON)
//   DELETE /api/admin/reviews/:id      -> delete one review
//
// Needs: env.DB (your D1 binding) and env.ADMIN_PASSWORD (a Secret).

const enc = new TextEncoder();

async function isAuthed(request, env) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return false;

  let pass;
  try {
    const bytes = Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const idx = decoded.indexOf(":");
    if (idx < 0) return false;
    pass = decoded.slice(idx + 1); // username is ignored, only the password matters
  } catch {
    return false;
  }

  // Compare hashes in constant time so the password can't be guessed by timing
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(pass)),
    crypto.subtle.digest("SHA-256", enc.encode(env.ADMIN_PASSWORD)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>RH ARMY Admin</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #0d0f14; color: #e8eaf0; }
  main { max-width: 820px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { margin: 0 0 4px; font-size: 24px; }
  .muted { color: #8a90a2; }
  .bar { display: flex; gap: 12px; align-items: center; margin: 16px 0; flex-wrap: wrap; }
  input { flex: 1; min-width: 200px; padding: 10px 12px; border-radius: 8px; border: 1px solid #2a2f3d; background: #151923; color: inherit; font-size: 15px; }
  .card { background: #151923; border: 1px solid #2a2f3d; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }
  .top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .text { margin: 10px 0 0; white-space: pre-wrap; word-break: break-word; }
  button { background: #3a1d24; color: #ff8a9b; border: 1px solid #6b2a37; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; }
  button:hover { background: #4d2430; }
  button:disabled { opacity: .5; cursor: default; }
</style>
</head>
<body>
<main>
  <h1>Reviews admin</h1>
  <div id="stats" class="muted">Loading…</div>
  <div class="bar"><input id="q" type="search" placeholder="Search name, service or text"></div>
  <div id="list"></div>
</main>
<script>
var listEl = document.getElementById('list');
var statsEl = document.getElementById('stats');
var searchEl = document.getElementById('q');
var all = [];

function fmt(s) {
  var d = new Date(s);
  return isNaN(d) ? String(s) : d.toLocaleString();
}

function del(id, btn) {
  if (!confirm('Delete this review? This cannot be undone.')) return;
  btn.disabled = true;
  fetch('/api/admin/reviews/' + encodeURIComponent(id), { method: 'DELETE' })
    .then(function (r) {
      if (!r.ok) throw new Error('failed');
      all = all.filter(function (x) { return x.id !== id; });
      render();
    })
    .catch(function () {
      alert('Delete failed. Try again.');
      btn.disabled = false;
    });
}

function render() {
  var q = searchEl.value.toLowerCase();
  var rows = all.filter(function (r) {
    return (r.name + ' ' + r.service + ' ' + r.text).toLowerCase().indexOf(q) !== -1;
  });

  var avg = all.length
    ? (all.reduce(function (s, r) { return s + r.rating; }, 0) / all.length).toFixed(1)
    : '-';
  statsEl.textContent = all.length + ' reviews · average rating ' + avg;

  listEl.textContent = '';
  if (!rows.length) {
    var empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No reviews found.';
    listEl.appendChild(empty);
    return;
  }

  rows.forEach(function (r) {
    var card = document.createElement('div');
    card.className = 'card';

    var top = document.createElement('div');
    top.className = 'top';

    var info = document.createElement('div');
    var who = document.createElement('strong');
    who.textContent = r.name;
    var meta = document.createElement('div');
    meta.className = 'muted';
    meta.textContent = r.service + ' · ' + '★'.repeat(r.rating) + ' · ' + fmt(r.created_at);
    info.appendChild(who);
    info.appendChild(meta);

    var btn = document.createElement('button');
    btn.textContent = 'Delete';
    btn.addEventListener('click', function () { del(r.id, btn); });

    top.appendChild(info);
    top.appendChild(btn);

    var text = document.createElement('p');
    text.className = 'text';
    text.textContent = r.text;

    card.appendChild(top);
    card.appendChild(text);
    listEl.appendChild(card);
  });
}

searchEl.addEventListener('input', render);

fetch('/api/admin/reviews')
  .then(function (r) { if (!r.ok) throw new Error('failed'); return r.json(); })
  .then(function (data) { all = data; render(); })
  .catch(function () { statsEl.textContent = 'Could not load reviews. Refresh to try again.'; });
</script>
</body>
</html>`;

// Returns a Response for admin routes, or null so your normal code can handle the request.
export async function handleAdmin(request, env) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, "") || "/";

  const isPage = p === "/admin";
  const isList = p === "/api/admin/reviews";
  const isItem = p.startsWith("/api/admin/reviews/");
  if (!isPage && !isList && !isItem) return null;

  if (!env.ADMIN_PASSWORD) {
    return new Response("Admin is not set up yet (missing ADMIN_PASSWORD).", { status: 503 });
  }

  if (!(await isAuthed(request, env))) {
    return new Response("Login required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="RH ARMY Admin", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  }

  // Block requests coming from other websites
  if (request.method !== "GET") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return json({ error: "Forbidden" }, 403);
  }

  if (isPage && request.method === "GET") {
    return new Response(PAGE, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  if (isList && request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id, name, service, rating, text, created_at FROM reviews ORDER BY created_at DESC LIMIT 500"
    ).all();
    return json(results);
  }

  if (isItem && request.method === "DELETE") {
    const id = decodeURIComponent(p.slice("/api/admin/reviews/".length));
    const res = await env.DB.prepare("DELETE FROM reviews WHERE id = ?").bind(id).run();
    return json({ ok: true, deleted: res.meta.changes });
  }

  return json({ error: "Not found" }, 404);
}
