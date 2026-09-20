# RH ARMY reviews site (Cloudflare Workers + Assets + D1)

Your Cloudflare project is already connected to Git and auto-deploys with
`npx wrangler deploy` on every push — this version of the project is built
to match that exactly.

**Repo layout — this must sit at the ROOT of your repository, not inside a
subfolder** (a previous deploy log showed the files nested inside a
`rh-army-cloudflare/` folder, which is why the database and API route never
connected):

```
/
├── worker.js         ← handles /api/reviews, then hands everything else to static assets
├── wrangler.jsonc     ← Worker + assets + D1 config
├── schema.sql
├── README.md
└── public/
    └── index.html
```

## 1. Fix your repo structure

If your repo currently looks like `your-repo/rh-army-cloudflare/index.html`,
move everything up so `wrangler.jsonc` and `worker.js` sit directly in the
repo root, with the site itself inside a `public/` folder. Easiest way:
delete the old contents and replace them with this project's files, keeping
the same folder layout shown above.

## 2. Create the D1 database

```
npm install -g wrangler   # if you don't have it
wrangler login
wrangler d1 create rh-army-reviews-db
```

This prints a `database_id`. Open `wrangler.jsonc` and replace
`REPLACE_WITH_YOUR_DATABASE_ID` with it.

## 3. Create the table

```
wrangler d1 execute rh-army-reviews-db --remote --file=./schema.sql
```

## 4. Commit and push

```
git add .
git commit -m "Switch to Worker + assets + D1"
git push
```

Because the D1 binding is now declared in `wrangler.jsonc` itself, you do
**not** need to add it manually in the dashboard — Cloudflare's Git-connected
build picks it up automatically from the file. Watch the deployment log; it
should now show a binding for `DB` instead of just uploading static assets.

## 5. Swap the Discord link

In `public/index.html`, find:

```js
const DISCORD_INVITE = "https://discord.gg/your-invite";
```

Replace it with your real invite link, commit, and push again.

## That's it

Your site stays at the same URL Cloudflare gave you
(`https://rh-army-reviews.<your-subdomain>.workers.dev`, plus any custom
domain you've attached). Submitted reviews now write to D1 through
`worker.js`, and everyone loading the page sees the current list.

### Local development

```
wrangler dev
```

Serves the site locally with the D1 binding wired up, so you can test the
form before pushing.
