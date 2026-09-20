// Cloudflare Pages Function — handles GET and POST for /api/reviews
// Requires a D1 database bound to this Pages project as "DB".
// See README.md for setup steps.

const ALLOWED_SERVICES = [
  "PC optimization",
  "Mobile tuning",
  "Editing services",
  "Paid software & setup",
  "Something else",
];

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const { results } = await env.DB.prepare(
      "SELECT id, name, service, rating, text, created_at FROM reviews ORDER BY created_at DESC LIMIT 200"
    ).all();

    return Response.json(results ?? [], {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return new Response("Could not load reviews.", { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  // Honeypot field: real visitors never fill this in (it's hidden in the form).
  // Bots that auto-fill every field will trip it, and we just pretend success.
  if (body.company) {
    return Response.json({ ok: true });
  }

  const name = String(body.name ?? "").trim().slice(0, 60);
  const service = String(body.service ?? "").trim().slice(0, 60);
  const text = String(body.text ?? "").trim().slice(0, 800);
  const rating = Number(body.rating);

  if (
    !name ||
    !ALLOWED_SERVICES.includes(service) ||
    !text ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return new Response("Missing or invalid fields.", { status: 400 });
  }

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  try {
    await env.DB.prepare(
      "INSERT INTO reviews (id, name, service, rating, text, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(id, name, service, rating, text, created_at)
      .run();
  } catch (err) {
    return new Response("Could not save review.", { status: 500 });
  }

  return Response.json(
    { id, name, service, rating, text, created_at },
    { status: 201 }
  );
}
