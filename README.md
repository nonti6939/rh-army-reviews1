# RH ARMY reviews site (Cloudflare Pages + D1)

A static site with a live reviews database, deployable on Cloudflare's free tier.

- `index.html` — the site (services, reviews list, review form)
- `functions/api/reviews.js` — Cloudflare Pages Function: `GET` lists reviews, `POST` adds one
- `schema.sql` — the D1 table
- `wrangler.toml` — project config, used for local dev and CLI deploys

## 1. Install Wrangler (Cloudflare's CLI), if you don't have it

```
npm install -g wrangler
wrangler login
```

## 2. Create the D1 database

```
wrangler d1 create rh-army-reviews
```

This prints a `database_id`. Copy it into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_DATABASE_ID`.

## 3. Create the table

```
wrangler d1 execute rh-army-reviews --remote --file=./schema.sql
```

## 4. Deploy to Pages

From inside this project folder:

```
wrangler pages deploy .
```

Follow the prompts to create a new Pages project (any name is fine).

## 5. Bind the database to the Pages project

The CLI deploy doesn't attach the D1 binding automatically — do this once in
the dashboard:

1. Go to **Cloudflare dashboard → Workers & Pages → your project → Settings → Functions**
2. Under **D1 database bindings**, click **Add binding**
3. Variable name: `DB`
4. D1 database: `rh-army-reviews`
5. Save, then trigger a redeploy (`wrangler pages deploy .` again, or use the
   dashboard's "Retry deployment")

## 6. Swap the placeholders

In `index.html`, find:

```js
const DISCORD_INVITE = "https://discord.gg/your-invite";
```

and replace it with your real invite link, then redeploy.

## That's it

Your site is live at `https://<project-name>.pages.dev`. Anyone who submits
the form writes directly to the D1 database, and everyone who loads the page
sees the current list — no email step, no manual updating.

### Alternative: deploy via GitHub instead of the CLI

If you'd rather connect a GitHub repo in the Cloudflare dashboard and get
auto-deploys on every push:

1. Push this folder to a new GitHub repo
2. Cloudflare dashboard → Workers & Pages → **Create application** → **Pages** → **Connect to Git**
3. Build settings: no build command needed, output directory `/`
4. Add the D1 binding as in step 5 above after the first deploy

### Local development

```
wrangler pages dev . --d1=DB=rh-army-reviews
```

This serves the site at `http://localhost:8788` with the database wired up,
so you can test the form before deploying.
