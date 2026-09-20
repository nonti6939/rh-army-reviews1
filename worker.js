const ALLOWED_SERVICES = [
  "PC optimization",
  "Mobile tuning",
  "Editing services",
  "Paid software & setup",
  "Something else",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/reviews") {
      if (request.method === "GET") return handleGet(env);
      if (request.method === "POST") return handlePost(request, env);
      return new Response("Method not allowed", { status: 405 });
    }

    // Anything that isn't an API route: serve it as a static asset
    // (index.html, fonts, etc. from the `public/` directory).
    return env.ASSETS.fetch(request);
  },
};

async function handleGet(env) {
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

async function handlePost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  // Honeypot field: real visitors leave it blank; bots that fill every
  // field trip it, and we just pretend success instead of saving it.
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
