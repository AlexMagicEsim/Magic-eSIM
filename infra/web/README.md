# magicesim.store on nginx — real 301s for the EN-root migration

GitHub Pages cannot answer a real HTTP 301 for a path (it only redirects a directory to its slash form), so the
EN-root migration (`seo/url-migration.mjs`: English to `/`, Russian to `/ru/`) needs a host that can. This directory
prepares that host. **Nothing here is deployed, nothing touches DNS or Pages**, and `.github/workflows/deploy-web.yml`
does nothing until the repository variable `WEB_DEPLOY` is `true`.

| File | What it is |
|---|---|
| `nginx/site.conf` | hand-written server blocks: :80 → https, www → apex, the apex TLS site (Pages-equivalent behaviour) |
| `nginx/redirects.conf` | **generated** — one `location` per rule of `seo/url-migration.mjs` |
| `nginx/country-map.conf` | **generated** — `/?country=XX` → `/ru/esim/<slug>/` from `seo/catalogue-countries.json` |
| `test/compose.yml`, `test/run.sh` | the proof: today's artifact + this config in the pinned nginx image, `nginx -t`, the verifier |
| `deploy/activate.sh` | runs on the host: atomic release switch, `nginx -t`, reload, rollback, keep 5 releases |
| `../../scripts/build-web-server-config.mjs` | the generator (`--check` = fail when a generated file is stale) |
| `../../scripts/verify-web-redirects.mjs` | the verifier (local container, or the live site read-only with `--expect-pages`) |
| `../../seo/test-web-server-config.mjs` | `npm test`: generated files current, nginx precedence = `newPath()`, config and workflow rules |

**Never type a redirect.** Change `seo/url-migration.mjs`, run `node scripts/build-web-server-config.mjs`, commit
both. The generator refuses a map nginx would answer differently: nginx takes an `=` location first and then the
LONGEST `^~` prefix, while `newPath()` takes the FIRST matching rule — the two are compared on every rule, a path
under every prefix and every sitemap URL before anything is written.

## What the server reproduces from Pages (and what it adds)

| Behaviour | Pages today (measured 2026-11-07) | nginx here |
|---|---|---|
| file / `<path>.html` / directory index | yes | `try_files $uri $uri.html $uri/ =404` |
| `/es` (directory, no slash) | 301 → `https://magicesim.store/es/` | the same, one hop, absolute Location |
| not found, `/pay/<token>`, `/pay/s/<secret>` | 404 with `404.html` (the Private Pay router) | `error_page 404 /404.html`, status 404 |
| `Cache-Control` | `max-age=600` + `Expires` (none on a 404) | `expires 10m` |
| `Access-Control-Allow-Origin` | `*` | `*` |
| types | `text/html`, `text/css`, `application/javascript`, `application/json`, `application/manifest+json` with `charset=utf-8`; `image/svg+xml`, `application/pdf` without | the same |
| gzip | yes, `Vary: Accept-Encoding` | yes |
| moved paths | **200 (no redirect possible)** | **one 301**, query kept (`$is_args$args` / `rewrite … permanent`) |
| `/?country=XX` | 200, the page's script moves the browser | **301** to `/ru/esim/<slug>/` for a code with a page (upper case, as in the JSON), other parameters kept; unknown / malformed / lower-case → 200 |
| `/en`, `/esim` | 301 to the slash form | 301 **straight to the final target** (exact rules), never two hops |
| http, www | Pages redirects | `http://` (either name) → `https://magicesim.store$request_uri` in one hop; `https://www` → apex |
| unknown Host | GitHub's 404 | connection closed (`return 444`, `ssl_reject_handshake`) |

**Not added, on purpose (owner: keep Pages-equivalent headers):** HSTS, `X-Frame-Options` / `frame-ancestors`, a
header CSP, `Referrer-Policy`, `X-Content-Type-Options`. They become possible on this host — each is a separate
decision later (HSTS especially: never `preload` / `includeSubDomains` without the owner; `/app/` is legitimately
framed by Telegram, so a frame rule must exempt it). No server-side language, IP or user-agent logic anywhere.

Known edges (from the map, not from nginx): `/iphone` and `/android` (no `.html`) still serve the old Russian pages
with 200 (only `/iphone.html`, `/android.html` are rules); a moved path without its trailing slash
(`/esim/turkey`) becomes `/ru/esim/turkey` and then the directory 301 — two hops for a URL nobody links.

## Hosting options

| Option | Real 301 for every rule | `/?country=` | Apex | Notes |
|---|---|---|---|---|
| **nginx on a small VPS (recommended)** | yes | yes (`map`) | A record | full control, access logs, the config in this repo is the whole server |
| Yandex Object Storage static website | prefix-only routing rules | **no** | needs ALIAS/ANAME | see below |
| Cloudflare (Pages/Workers/proxy) | yes | yes | yes | **REJECTED**: Russian ISPs throttle Cloudflare |
| GitHub Pages (today) | no (meta refresh / JS only) | no | yes | stays the rollback target |

Yandex Object Storage, and why it is weaker. *Verified:* it hosts a static site from a bucket with S3-style
website routing rules (condition on a key prefix or on an error code, redirect replacing the key or a key prefix).
*Assumed from the S3 semantics it implements, not re-checked against Yandex's docs today:* at most 50 routing rules;
no condition on the query string (so `/?country=XX` cannot be answered — it would stay a 200 with a script); an exact
path is only expressible as a prefix (so `/en` vs `/en/esim/…` ordering has to be designed around); a custom domain is
a CNAME to the bucket's website endpoint, so the apex needs an ALIAS/ANAME record at the DNS provider; no access logs
in the nginx sense without enabling bucket logging. Good as a fallback copy of the files, not as the 301 server.

VPS location: Pages is served from Fastly's CDN worldwide; one VPS is one location. For the Russian audience a Russian
or nearby location is the safer bet — some foreign hosting ranges have been throttled by Russian ISPs (*assumed;
measure from a Russian connection before committing*). Cost (assumptions, 2026 list prices to re-check): 1 vCPU /
1–2 GB / 20 GB is enough — about €4–6/month abroad, about 300–900 ₽/month at Russian providers (Yandex Compute Cloud,
Selectel, Timeweb). Certificates (Let's Encrypt) are free.

## Provisioning the server (owner, once)

1. Ubuntu 24.04 LTS, firewall open on 22 (restricted), 80, 443. `apt install nginx certbot rsync`.
2. A `deploy` user that owns `/srv/magicesim` (`releases/`), with exactly this sudoers line:
   `deploy ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /usr/bin/systemctl reload nginx`.
   Its `~/.ssh/authorized_keys` holds only the deploy key's public half (private half = secret `WEB_SSH_KEY`), with
   `no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty` (GitHub-hosted runners have no fixed address
   range, so `from=` cannot pin them).
3. `/etc/nginx/conf.d/magicesim.conf` = the one line in `test/conf.d/magicesim.conf`; remove the default site.
4. `mkdir -p /var/www/certbot` (ACME HTTP-01 answers on :80, `site.conf` serves them before the https redirect).
5. Put the first release in place by hand (or a `workflow_dispatch` run once the variable and secrets exist), then
   `nginx -t`. The site's server needs the certificate files to exist before nginx starts — see the next section.

### The certificate before the DNS switch

HTTP-01 (certbot `--webroot`) only works once `magicesim.store` resolves to the new server, so it cannot issue the
certificate *before* the switch. Two ways:

- **DNS-01 (recommended, no window):** prove the domain with a TXT record. Either through Namecheap's API (acme.sh
  `dns_namecheap`; *assumed*: Namecheap's API needs the caller's IP whitelisted and an account that meets their API
  eligibility threshold), or — simpler and safer — delegate only the challenge name: one Namecheap record
  `_acme-challenge.magicesim.store CNAME <id>.<acme-dns zone>` and certbot with an acme-dns hook; renewals then never
  need Namecheap credentials. Issue for `magicesim.store` and `www.magicesim.store`, then switch DNS with HTTPS ready.
- **HTTP-01 right after the switch (short window):** lower TTL first (below), start nginx with a temporary self-signed
  certificate, switch the A records, run `certbot certonly --webroot -w /var/www/certbot -d magicesim.store -d
  www.magicesim.store` as soon as Let's Encrypt sees the new address (it queries the authoritative servers, so
  minutes), `nginx -t && systemctl reload nginx`. During those minutes visitors who already resolve to the new server
  get a certificate error — avoid it on a sales day.

Either way renewal is `certbot renew` (systemd timer) with a deploy hook `systemctl reload nginx`.

## The switch (owner, DNS is at Namecheap)

Today (DNS-over-HTTPS, 2026-11-07): apex = four A records `185.199.108.153`, `.109.153`, `.110.153`, `.111.153`
(TTL 1800), no AAAA at the apex; `www` = CNAME `alexmagicesim.github.io`; NS `dns1/dns2.registrar-servers.com`.
**Touch only those five records — never the mail records (MX, SPF, DKIM, DMARC).**

1. **A week before:** lower the TTL of the four A records and the www CNAME to 300 s.
2. Server ready: a release built from the migrated tree (the deploy workflow verifies it STRICTLY: every moved path's
   target must answer 200, so a map pointing at pages that do not exist yet never deploys), certificate in place,
   verified with `curl --resolve magicesim.store:443:<server IP> https://magicesim.store/…` and
   `node scripts/verify-web-redirects.mjs --base https://<server IP> --host magicesim.store --docroot <release>`.
3. Set the repository variable `WEB_DEPLOY=true` and the secrets `WEB_SSH_KEY`, `WEB_HOST` (`deploy@<IP>`),
   `WEB_KNOWN_HOSTS` (`ssh-keyscan -t ed25519 <IP>` output, checked against the server's own fingerprint).
4. At Namecheap: replace the four GitHub A records with one A record → the server (add AAAA only if the server has
   IPv6 and nginx listens on it — it does in `site.conf`); replace `www` CNAME → an A record to the server (or a CNAME
   to the apex).
5. Watch: access logs, Search Console / Webmaster crawl, `verify-web-redirects.mjs` against the live host.
6. A week later raise the TTL back.

### Rollback

- **To the previous release on the server:** `Deploy web` → Run workflow → `rollback` (or `activate.sh --rollback` on
  the host): one symlink back, `nginx -t`, reload.
- **To GitHub Pages:** keep the Pages site deployed and the custom domain in Settings → Pages untouched while the VPS
  runs (`deploy-pages.yml` keeps publishing the same artifact). Rollback = put the four GitHub A records and the www
  CNAME back at Namecheap; with TTL 300 it takes minutes. *Assumed:* GitHub keeps the custom domain and its
  certificate while DNS points elsewhere (it may show a DNS check warning and re-issue the certificate after the DNS
  returns; the existing certificate renews on 2026-11-28 — check it after a rollback). Note the 301s themselves are
  cached by browsers and search engines: a rollback after the 301s were seen serves the old paths again (fine — Pages
  still has them), but the new paths (`/ru/…`, `/destinations/…`) must then exist on Pages too.

## Monitoring

The new host gives what Pages never did: **access logs**. `/var/log/nginx/access.log` shows every crawler request
(Googlebot, YandexBot, Bingbot by user agent — verify by reverse DNS before trusting it), the 301 → target pairs and
the 404s — the crawl evidence the migration needs. Keep them (logrotate, 14–30 days; they hold IP addresses — say so
in the privacy wording if the owner keeps them longer). Add an external uptime check on `/` and on one moved path
(expects 301), and certificate-expiry monitoring. Never put `/pay/<token>` or `/pay/s/<secret>` in an alert or a shared
log excerpt — the path IS the capability.

## Local proof

```
infra/web/test/run.sh --report /tmp/web-redirects.json      # Docker, node 22, openssl; nothing leaves the machine
node scripts/verify-web-redirects.mjs --base https://magicesim.store --expect-pages --rate 2 --report live.json
```

The second command reads the live Pages site (HEAD/GET only, ≤ 2 requests/second) to record today's statuses; it
never fails. `.github/workflows/web-server.yml` runs the first one on every pull request that touches the map, this
directory, the web scripts or the country list.
