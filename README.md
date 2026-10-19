# FlowPilot Website

A fast, static, conversion-oriented marketing website for **FlowPilot** — workflow automation & AI solutions (flowpilotai.co.in), serving US businesses with a specialist focus on independent insurance agencies.

**Positioning:** outcome-led. The site sells what businesses can achieve with automation — use cases first, capabilities second, project history only as secondary evidence. Primary CTA: **"Explore Automation Opportunities."**

## Page structure

| Page | File | Role |
|---|---|---|
| Home | `index.html` | Headline + live workflow pipeline, use cases, insurance section, process, About, FAQ |
| Automation Solutions | `services.html` | Interactive problem explorer (Today vs. With FlowPilot workflow design) + capability list |
| Insurance Automation | `insurance.html` | Dedicated US-agency landing page (download workflows, AMS ops, data migration, reporting, AI-assisted ops) + pain-point picker |
| Contact | `contact.html` | Enquiry form (direct submission) + business contact details |
| Projects & Demonstrations | `projects.html` | **Secondary evidence page** — footer-linked, not in main nav |

No build step, no framework — plain HTML + CSS + one small JS file. `server.js` serves
the static site and hosts the Node.js contact API (`api/contact.js`); its only runtime
dependencies are `mysql2` (GoDaddy hosted MySQL) and `nodemailer` (optional SMTP).

## Local development

```
cd C:\Users\Admin\projects\flowpilot-website
npm install                     (one time — installs mysql2 + nodemailer)
node server.js                  (site + contact API; PORT env supported)
npm test                        (contact API unit tests + server end-to-end test)
```
Open http://localhost:3000. Without `DB_*` environment variables set, the contact API
answers `503` and the form falls back to email delivery — the site still works.

## Contact form configuration

**Delivery chain** (js/main.js): the form posts JSON to the Node API (`api/contact`)
first; if that endpoint is unavailable, it falls back to FormSubmit email
(`https://formsubmit.co/ajax/info@flowpilotai.co.in` — one-time activation click on
first use), and if both fail the visitor's email app opens pre-filled. A deliberate
server-side rejection (invalid input, rate limit) is **final**: the visitor sees the
real reason and no fallback email is sent.

Fields collected: name, business email, company (optional), phone (optional —
country code selectable: +1 US / +91 India), area of interest, workflow
description. No sensitive data is collected.

## Contact backend (Node.js + GoDaddy hosted MySQL)

`POST /api/contact` (implemented in `api/contact.js`, mounted in `server.js`) is the
Node.js replacement for the old `api/contact.php` — PHP does not run on the GoDaddy
Node.js host. Enquiries are stored with prepared statements (mysql2).

**Credentials:** connection details come exclusively from the GoDaddy-injected
environment variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
through `process.env`. Nothing is hardcoded or committed. If the `DB_*` variables
are absent, the endpoint answers `503 Server not configured` and the form falls
back to email delivery — the site never goes down over a missing database.

**Server-side protection (ported from the PHP endpoint):**
- honeypot field `company-website` — bots receive a fake `{"ok":true}`, nothing is stored;
- input validation mirroring the client (length limits, email format, tag/control-char stripping);
- rate limit: max 5 enquiries per hashed IP per 10 minutes;
- **IP handling:** the TCP peer is used directly; `X-Forwarded-For` is trusted only when
  the request arrived through a loopback/private reverse proxy. Raw IPs are never stored —
  only a SHA-256 hash salted with `IP_HASH_SALT` (a random per-boot salt when unset);
- responses and logs never contain credentials, stack traces, or enquiry content
  (database errors log only their driver code).

**Optional environment variables** (set in the hosting dashboard; GoDaddy injects only `DB_*`):

| Variable | Purpose | Default |
|---|---|---|
| `DB_SSL` | `true` to require TLS towards MySQL | off |
| `IP_HASH_SALT` | salt for hashing visitor IPs (stable across restarts) | random per boot |
| `ALLOWED_ORIGINS` | comma-separated origins allowed by the API's CORS | site's own domains |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | SMTP transport for enquiry notifications | notifications disabled |
| `NOTIFY_FROM` | From address — a mailbox you control, on your own domain | `SMTP_USER` |
| `NOTIFY_EMAIL` | notification recipient | `info@flowpilotai.co.in` |

**Email notifications are OFF until the `SMTP_*` variables are set.** The startup log
states this explicitly (`[contact] email notifications: disabled — …`). While disabled,
enquiries are still stored in MySQL; the form's FormSubmit fallback continues to deliver
email whenever the API itself is unreachable. There is no PHP `mail()` in Node.js hosting.

**Initialise the table (one time):** run `api/schema.sql` against the hosted database
(phpMyAdmin → **Import**, or paste into the SQL runner). It is non-destructive —
`CREATE TABLE IF NOT EXISTS` leaves existing tables and data untouched.

**Verify:** submit a test enquiry on `contact.html` (thank-you modal + `{"ok":true}`),
then in the database tool run
`SELECT id, name, email, topic, submitted_at FROM enquiries ORDER BY id DESC LIMIT 5;`
(limit reads to your own test rows — the table holds visitors' personal data).

## Public business information

- **Email:** `info@flowpilotai.co.in` (everywhere: form target, footers, schema)
- **Phone:** `+91 70201 11850`
- **Location:** "Serving US businesses remotely · Based in Pune, India" — no street address
- **No founder/owner profile** (`.founder-card` CSS retained for later if desired)
- **Compliance framing:** no partnerships claimed (IVANS/Applied Systems disclaimed by
  name), no client deployments, testimonials, or metrics; use cases labelled "potential
  outcomes"; internal work labelled Internal R&D / Demo / Prototype on `projects.html`

## Editing content

- **Copy** — edit HTML directly; sections are labelled with comments.
- **Logo** — `assets/logo.svg` is the official FlowPilot lockup (symbol + wordmark,
  white/cyan). Favicon (`assets/favicon.svg`) is the symbol-only mark.
- **Colors** — CSS variables at the top of `css/styles.css`.
- **Fonts** — Sora + Inter via Google Fonts (each page's `<head>`).
- **Analytics** — none included by design. If added later, document config + privacy
  impact and update the footer "No analytics" line.

## Deploying from GitHub

This repo is deploy-ready as-is — `index.html` sits at the root, no build step.

1. **Create the repo** on github.com, then:
   ```
   git init
   git add .
   git commit -m "Initial commit — FlowPilot website"
   git branch -M main
   git remote add origin https://github.com/<your-username>/flowpilot-website.git
   git push -u origin main
   ```
2. **Connect the repo** in your hosting platform (Airo / Netlify / Vercel): it should
   auto-detect a **static site** — framework: none, build command: none, output/publish
   directory: **repo root** (`/`). If the platform asks for a build command, use the
   no-op: `npm run build`.
3. **Platforms that require a listening process** (e.g. Airo): `npm start` runs
   `server.js` — a zero-dependency Node static server binding `process.env.PORT`.
4. **GoDaddy cPanel instead:** download the repo as a ZIP (Code → Download ZIP), upload
   to `public_html`, extract so `index.html` sits directly in `public_html`.

> If a preview URL shows the host's "Coming Soon / application is being prepared" page,
> the files were never deployed — check that the repo is connected and the deploy
> completed, not the site code.

## Tests executed (2026-10-19)

| Check | Result |
|---|---|
| Internal link & anchor checker (129 refs, 31 anchor targets, 5 pages) | ✅ all OK |
| All 5 pages load with zero console/page errors (headless Chromium/Edge) | ✅ pass |
| Mobile menu open/close at 375px, no horizontal overflow | ✅ pass |
| CTA destinations present (services.html / contact.html) | ✅ pass |
| FAQ accordion interaction | ✅ pass |
| Form validation flags 3 required fields on empty submit | ✅ pass |
| `?topic=insurance` preselects area of interest | ✅ pass |
| Successful submission (mocked endpoint) shows thank-you modal | ✅ pass |
| Failed submission (mocked 500) shows honest error box with mailto handoff | ✅ pass |
| Solutions explorer: tabs switch, deep links (#orchestration) activate tabs | ✅ pass |
| Hero pipeline cycles steps; pauses on hover | ✅ pass |
| server.js: GET 200s with correct MIME, POST 405, traversal 403 | ✅ pass |
| Nav links keyboard-focusable | ✅ pass |
| Contact API unit tests (`npm test`): validation, honeypot, rate limit, prepared-statement params, IP-hash salt, CORS, 413/422/429/500 containment, failing notifier | ✅ 13/13 pass |
| server.js end-to-end without `DB_*`: site serves, API → 503 not-configured, `.php` alias routed, dotfiles/PHP sources 404 | ✅ pass |
| Live smoke with unreachable `DB_*`: `500 {"ok":false,"error":"Server error"}`, log shows only `code=ECONNREFUSED` | ✅ pass |
| `npm run build` | ✅ pass |
| Lighthouse scores | ⛔ not executed (no Lighthouse runtime available in this environment) |
| Live form delivery end-to-end (GoDaddy) | ⏳ pending schema import + deploy |

## Remaining blockers to production

1. **Import `api/schema.sql`** into the GoDaddy hosted MySQL database (one time,
   non-destructive — see "Contact backend" above).
2. **Deploy with `npm install`** — `mysql2` + `nodemailer` are now real dependencies;
   the GoDaddy start command stays `npm start` (startup file `server.js`).
3. **SMTP notifications (optional):** set `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`
   (+ `NOTIFY_FROM`) in the hosting dashboard; until then enquiries are DB-only.
4. **FormSubmit activation click** — still needed for the email fallback path: submit
   one test enquiry with the API disabled, click the link emailed to
   `info@flowpilotai.co.in`, then confirm a second test arrives.
5. **Airo deployment** — repo pushed; redeploy must pick up the Node contact API commit.
6. **Lighthouse baseline** — run after deployment.
7. **Domain/DNS** — point `flowpilotai.co.in` at the host; confirm HTTPS.

## Launch checklist

- [x] Official logo lockup in place (`assets/logo.svg`)
- [ ] FormSubmit activation clicked; live test enquiry confirmed in inbox
- [ ] Airo deploy successful; preview URL serves the real site
- [ ] Add `flowpilotai.co.in` custom domain + verify HTTPS
- [ ] Run Lighthouse (target: Perf 90+, A11y 95+, BP 95+, SEO 95+)
- [ ] Submit sitemap to Google Search Console
- [ ] Final proofread of insurance.html (compliance language intact)
- [ ] Verify footer email/phone still correct after any changes

## Structure

```
flowpilot-website/
├── index.html          · Home
├── services.html       · Automation Solutions (interactive problem explorer)
├── insurance.html      · Insurance Automation landing page (+ pain-point picker)
├── contact.html        · Contact + enquiry form (direct submission + thank-you modal)
├── projects.html       · Projects & Demonstrations (secondary evidence)
├── server.js           · Static server + contact API mounting, DB_* env wiring
├── api/contact.js      · POST /api/contact — validation, honeypot, rate limit, MySQL inserts
├── api/notify.js       · Optional SMTP notifications (nodemailer; off until SMTP_* set)
├── api/contact.php     · Legacy PHP endpoint (kept for reference; not used on Node hosting)
├── api/schema.sql      · enquiries table DDL — import once into the hosted MySQL DB
├── css/styles.css      · All styling (design tokens at top)
├── js/main.js          · Nav, pipeline, tabs, picker, form delivery (FORM_ACTION here)
├── test/               · node:test suite — npm test
├── assets/logo.svg     · Official FlowPilot lockup (symbol + wordmark)
├── assets/favicon.svg  · Symbol-only mark
├── _headers            · Netlify security headers
├── robots.txt
├── sitemap.xml
└── README.md
```
