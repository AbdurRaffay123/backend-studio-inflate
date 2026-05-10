# backend-inflate-studio — Architecture

This document explains, end-to-end, how the unified Inflate Studio backend
is structured: every folder, every file's role, how a request travels
through the stack, the data models, the auth model, the configuration
surface, and how to extend the project with a new module.

> **TL;DR** — One Express server, two feature modules
> (`apps.product-options` for the Shopify integration and `crm` for
> consultation/customer data), shared cross-cutting code under
> `src/shared/`, a vanilla-JS admin SPA served from `/admin`, and a
> single `package.json` / `.env` / `Dockerfile` for everything.

---

## 1. Philosophy

| Principle | What it means here |
| --- | --- |
| **Modular monolith** | One Node process, one deployment, one set of dependencies — but the code is partitioned into modules with no cross-module imports. The CRM module never imports from product-options and vice versa. |
| **Shared layer is small and infrastructural only** | `src/shared/` contains logger, request-id middleware, error handler, db connection, JWT helper, env helper. Anything that's actually domain logic lives inside its module. |
| **Namespaced routes** | Every module mounts under its own URL prefix (`/api/apps/<name>/*`, `/api/crm/*`) so adding a new module never collides with an existing one. |
| **Feature flags** | `ENABLE_APPS_PRODUCT_OPTIONS` and `ENABLE_CRM` toggle modules at boot. A disabled module mounts no routes; if CRM is disabled the MongoDB connection is also skipped. |
| **Backward-compat first** | The legacy storefront / mobile paths (`/`, `/api/upload`, `/test`) are preserved at the server root so existing builds keep working without env changes. |
| **No build step** | Plain CommonJS Node, no transpiler. The admin "SPA" is two static HTML files with inline vanilla JS. |

---

## 2. Folder layout (annotated)

```
backend-inflate-studio/
├── index.js                            # Process entry — dotenv, db.connect, app.listen
├── package.json                        # Single dep tree for both modules
├── package-lock.json
├── Dockerfile                          # node:22-alpine, non-root, healthcheck
├── .dockerignore
├── .gitignore
├── .env                                # Local dev values (real secrets) — NEVER committed
├── .env.example                        # Template with comments
├── README.md                           # Quick start + endpoint reference
├── ARCHITECTURE.md                     # This document
│
├── scripts/
│   └── generate-admin-hash.js          # Bcrypt hash generator for ADMIN_PASSWORD_HASH
│
├── src/
│   ├── createApp.js                    # Express factory — mounts middleware + every module
│   │
│   ├── shared/                         # Cross-cutting code, used by every module
│   │   ├── config/
│   │   │   ├── db.js                   # Mongoose connection + isReady() probe
│   │   │   └── jwt.js                  # sign() / verify() helpers
│   │   ├── middleware/
│   │   │   ├── requestId.js            # Adds x-request-id to every req/res
│   │   │   ├── errorHandler.js         # Final 4-arg Express error handler
│   │   │   └── httpLogger.js           # Optional pino-http JSON access logs (LOG_JSON=1)
│   │   └── utils/
│   │       ├── logger.js               # Pino instance (pretty in dev, JSON in prod)
│   │       ├── fileLogger.js           # Per-request text file logs (legacy product-options)
│   │       └── env.js                  # isTruthy() + isModuleEnabled() helpers
│   │
│   └── modules/
│       ├── apps/                       # All Shopify-app-style modules live here
│       │   └── product-options/
│       │       ├── config/
│       │       │   ├── aws.js          # S3Client + BUCKET_NAME
│       │       │   └── multer.js       # Memory storage, 10 MB image-only filter
│       │       ├── controllers/
│       │       │   ├── healthController.js     # /health for the module
│       │       │   ├── productController.js    # GET / lookup + GET /test diagnostic
│       │       │   └── uploadController.js     # POST /upload → S3
│       │       ├── middleware/
│       │       │   ├── apiKey.js       # x-api-key (fail-open if API_KEY unset)
│       │       │   └── agentKey.js     # x-agent-key for /test (fail-closed)
│       │       ├── routes/
│       │       │   ├── index.js        # Canonical router mounted at /api/apps/product-options
│       │       │   └── legacy.js       # Backward-compat router mounted at /
│       │       ├── services/
│       │       │   ├── appDataService.js   # Polls Cloudlift, parses JSON/script, in-mem caches
│       │       │   └── productService.js   # Condition matching engine
│       │       └── utils/
│       │           ├── helpers.js              # parseTags()
│       │           └── uploadPublicUrl.js      # Build CloudFront / S3 URL
│       │
│       └── crm/
│           ├── admin/                  # Static SPA served at /admin/*
│           │   ├── login.html          # Vanilla JS — POSTs to /api/crm/admin/auth/login
│           │   └── index.html          # Vanilla JS SPA — lists, details, edits
│           ├── controllers/
│           │   ├── healthController.js         # CRM readiness (db connection)
│           │   ├── consultationController.js   # Public POST/GET/PATCH consultations
│           │   ├── customerController.js       # Public POST upsert / GET history
│           │   ├── adminAuthController.js      # POST /admin/auth/login → JWT
│           │   ├── adminConsultationController.js  # Admin list/detail/update
│           │   └── adminCustomerController.js      # Admin list/detail/update
│           ├── middleware/
│           │   ├── apiKey.js           # x-api-key (warns in dev if unset)
│           │   ├── jwtAuth.js          # Bearer token guard for admin/*
│           │   └── validate.js         # express-validator result handler → 422
│           ├── models/
│           │   ├── Customer.js         # shopifyCustomerId, profile, notes[], tags[]
│           │   ├── Consultation.js     # status, type, scheduledDate, intake{...}, notes
│           │   ├── Artist.js           # Scaffolded (name, email, specialties)
│           │   └── RecycleEvent.js     # Scaffolded (balloonCount, dropOffDate)
│           ├── routes/
│           │   ├── index.js            # Mounts public + admin sub-routers, applies rate limits
│           │   ├── public/
│           │   │   ├── consultations.js
│           │   │   └── customers.js
│           │   └── admin/
│           │       ├── auth.js
│           │       ├── consultations.js
│           │       └── customers.js
│           ├── services/
│           │   ├── customerService.js  # upsert, getByShopifyId, addNote
│           │   └── consultationService.js  # create, getById, list, updateStatus, addInternalNote
│           └── utils/
│               └── paginate.js         # parsePagination() + buildResponse()
│
├── tests/
│   ├── health.test.js                  # Aggregate /health
│   ├── apps/product-options/
│   │   └── helpers.test.js             # parseTags() unit tests
│   └── crm/
│       └── adminAuth.test.js           # POST /api/crm/admin/auth/login matrix
│
└── logs/                               # Created at runtime by fileLogger.js
```

---

## 3. Boot sequence (`index.js`)

When you run `node index.js` (or `npm start`) the following happens, in order:

1. **`dotenv.config()`** loads `.env` → `process.env`.
2. Read feature flags (`ENABLE_CRM`, `ENABLE_APPS_PRODUCT_OPTIONS`).
3. If CRM is enabled → call `connect()` from `src/shared/config/db.js`.
   - Listens for `connected` / `disconnected` / `error` events.
   - On `connected`, the internal `_ready` flag flips to `true` so
     `/health` reports the module as ok.
4. Build the app via `createApp()`.
5. If product-options is enabled → kick off `fetchData()` once and
   schedule a polling timer (`POLL_INTERVAL_MS`, default 30 s) to keep
   the in-memory cache fresh.
6. Bind the listener on `0.0.0.0:PORT` (default `3000`) so a phone on
   the same Wi-Fi can reach it.
7. Wire `SIGTERM` / `SIGINT` to a graceful shutdown.

Failures during startup propagate to the top-level `start().catch(...)`
and exit with code 1.

---

## 4. Express factory (`src/createApp.js`)

`createApp()` returns a fully wired Express instance. The middleware
order is **critical** and goes:

```
requestId           → adds req.id / req.requestId / x-request-id header
helmet              → secure headers (CSP disabled because admin SPA uses inline JS)
attachHttpLogger    → optional pino-http (only when LOG_JSON=1)
cors                → ALLOWED_ORIGINS list, open in dev
bodyParser.json     → 1 MB limit
express.urlencoded  → false-extended (disabled object syntax)

— static —
/admin              → src/modules/crm/admin/   (only if CRM enabled)

— routes —
GET  /health        → aggregate probe (combines all enabled modules)
/api/apps/product-options/*  →  productOptionsRouter  (canonical)
/                            →  productOptionsLegacyRouter  (backward compat)
/api/crm/*                   →  crmRouter

errorHandler        → final 4-arg handler that JSON-encodes the response
```

`buildCorsOrigin()` returns:
- `true` (open) when `NODE_ENV !== 'production'` and `ALLOWED_ORIGINS` is empty.
- `false` (closed) when `NODE_ENV === 'production'` and `ALLOWED_ORIGINS` is empty.
- An origin-checking function when `ALLOWED_ORIGINS` is a comma-separated list.

---

## 5. The shared layer — what's actually shared

| File | Responsibility |
| --- | --- |
| `shared/utils/logger.js` | The single Pino logger every module uses (`logger.info`, `logger.error`, …). Pretty-printed in dev, JSON in prod. |
| `shared/utils/fileLogger.js` | Verbose-text file logs in `./logs/`, used by the legacy product-options diagnostic flow. Auto-rotates after 5 files. |
| `shared/utils/env.js` | `isTruthy('1' \| 'true' \| ...)` and `isModuleEnabled('FLAG_NAME', defaultTrue)`. |
| `shared/middleware/requestId.js` | Reads inbound `x-request-id` (or generates a UUID), exposes `req.id` / `req.requestId`, echoes the header back. |
| `shared/middleware/errorHandler.js` | Last middleware. Logs the full error with the request id, returns `{statusCode, error, message}`; redacts the `message` in production for 500-class errors. |
| `shared/middleware/httpLogger.js` | Lazy-loaded pino-http access logs. Off by default; toggle with `LOG_JSON=1`. Skips `/health` to reduce noise. |
| `shared/config/db.js` | Mongoose connection lifecycle + `isReady()` probe used by `/health`. |
| `shared/config/jwt.js` | `sign(payload)` / `verify(token)` using `JWT_SECRET` and `JWT_EXPIRES_IN`. Used only by the CRM admin flow today. |

**Rule of thumb:** if a piece of code would be useful to a hypothetical
third module (e.g. `apps/upsells/`), it belongs in `shared/`. Otherwise it
belongs inside the module that owns it.

---

## 6. Module — `apps.product-options`

### 6.1 What it does

Reads the Cloudlift JS asset that defines the product-options
configuration for the Shopify storefront, caches the parsed config and
its associated lists in memory, and serves two main endpoints:

- A **product config lookup** (`GET /`) that takes a Shopify product
  payload (id / handle / type / tags / vendor / title) and returns every
  matching config plus its resolved list data.
- An **image upload** (`POST /api/upload`) that streams a multipart file
  to S3 and returns either a public CDN URL or a presigned URL.

A diagnostic endpoint (`GET /test`) emits a verbose text log to
`./logs/test-log-*.txt` for debugging matching rules.

### 6.2 Data caching strategy

`appDataService.js` holds three module-scoped caches:

1. `app_data` — the full `{configs, lists}` object pulled from Cloudlift.
2. `productIdIndex: Map<productId, config[]>` — for O(1) lookup of
   `targetMode == 0` (single-product) configs.
3. `configListsCache: Map<configKey, resolvedLists>` — pre-resolves the
   `lists` referenced by each config so the controller never re-walks
   `app_data.lists` per request.

`fetchWithRetries()` retries the remote fetch up to 3 times with
exponential back-off (2 s → 4 s). On any non-2xx or parse failure the
**previous** good cache is preserved (no garbage replaces good data).

### 6.3 Matching engine (`productService.js`)

`getProductConfiguration(product, app_data)` returns matched configs by:

1. Looking up direct id matches via `productIdIndex` (O(1)).
2. Iterating `targetMode == 1` configs and evaluating their `conditions`
   under `conditionMode` (1 = any, 0 = all).
3. De-duplicating by `id ?? uuid ?? name`.

Supported condition fields: `product`, `product_title`, `product_handle`,
`product_vendor`, `product_type`, `product_tags`. Operators on the
string fields: `equals`, `not_equals`, `contains`, `not_contains`.

### 6.4 Routes

| Method | Canonical path | Legacy path | Auth | Rate limit |
| --- | --- | --- | --- | --- |
| GET  | `/api/apps/product-options/`         | `GET /`              | `x-api-key`  | `LOOKUP_RATE_LIMIT_MAX` per IP/min (default 60) |
| POST | `/api/apps/product-options/upload`   | `POST /api/upload`   | `x-api-key`  | `UPLOAD_RATE_LIMIT_MAX` per IP/15 min (default 20) |
| GET  | `/api/apps/product-options/test`     | `GET /test`          | `x-agent-key` (fail-closed) | none |
| GET  | `/api/apps/product-options/health`   | (only at `/health`)  | none | none |

### 6.5 S3 upload flow

```
POST /api/apps/product-options/upload
   ├─ multer.single('file') → memoryStorage, 10 MB max, image MIME only
   ├─ S3 PutObjectCommand → BUCKET_NAME / [path/]fileName
   └─ response.url:
         UPLOAD_RESPONSE_URL_MODE = 'public'    → S3_PUBLIC_BASE_URL or virtual-hosted
         UPLOAD_RESPONSE_URL_MODE = 'presigned' → 1-hour signed GET URL
```

---

## 7. Module — `crm`

### 7.1 What it does

Stores customer profiles and consultation records in MongoDB, exposes a
public REST API the mobile app calls (after Shopify checkout completes,
and on login/register), and serves an admin SPA (`/admin`) for the studio
owner to read and manage the data.

### 7.2 Data model

```
┌─────────────────── Customer ────────────────────┐
│ shopifyCustomerId   String  required unique idx │
│ email               String  required            │
│ firstName/lastName  String  default ''          │
│ phone               String  default ''          │
│ memberSince         Date    default now         │
│ tags                String[] default []         │
│ notes               { text, addedBy, addedAt }[]│
│ createdAt / updatedAt (timestamps)              │
└─────────────────────────────────────────────────┘
                         ▲
                         │ shopifyCustomerId  (1 : N)
                         │
┌─────────────────── Consultation ────────────────┐
│ shopifyCustomerId   String  required idx        │
│ shopifyOrderId      String  default null        │
│ shopifyOrderName    String  default null        │
│ status              enum new|contacted|booked|  │
│                          completed|cancelled    │
│ type                enum phone|virtual|in_person│
│ scheduledDate       Date                        │
│ scheduledTime       String                      │
│ duration            15 | 30 | 60                │
│ price               25 | 50 | 100               │
│ intake (subdoc):                                │
│   eventType, eventDate, eventTime,              │
│   venueName, venueAddress, guestCount,          │
│   services[], budgetRange, colorPalette,        │
│   narrative, inspirationPics[] (S3 URLs),       │
│   additionalNotes                               │
│ internalNotes       { text, addedBy, addedAt }[]│
│ assignedArtistId    ObjectId → Artist (null)    │
│ createdAt / updatedAt (timestamps)              │
└─────────────────────────────────────────────────┘

Artist          (scaffolded, not yet routed)
RecycleEvent    (scaffolded, not yet routed)
```

**Indexes:**
- `Customer`: unique on `shopifyCustomerId`; text index on `firstName + lastName + email` for admin search.
- `Consultation`: `shopifyCustomerId` (lookup by customer), `status` (filter), and compound `(status, createdAt -1)` for the admin list.

### 7.3 Routes

#### Public (`x-api-key`, mobile app)

| Method | Path | Body / Params |
| --- | --- | --- |
| POST  | `/api/crm/customers`                 | `{shopifyCustomerId, email, firstName?, lastName?, phone?}` — upsert |
| GET   | `/api/crm/customers/:shopifyId`      | returns customer + recent consultations |
| POST  | `/api/crm/consultations`             | `{shopifyCustomerId, type, ..., intake:{...}}` — create |
| GET   | `/api/crm/consultations/:id`         | by Mongo ObjectId |
| PATCH | `/api/crm/consultations/:id/status`  | `{status: 'contacted' \| ...}` |

> The `POST /api/crm/consultations` controller also fires an
> opportunistic `customerService.upsertCustomer(...)` so the customer
> record stays current even if the mobile app didn't call
> `/api/crm/customers` separately.

#### Admin (`Authorization: Bearer <jwt>`, admin SPA)

| Method | Path | Notes |
| --- | --- | --- |
| POST  | `/api/crm/admin/auth/login`          | login w/ email + password → JWT |
| GET   | `/api/crm/admin/customers`           | `?q=...&page=...&limit=...` |
| GET   | `/api/crm/admin/customers/:id`       | full record + all consultations |
| PATCH | `/api/crm/admin/customers/:id`       | `{note?, tags?: string[]}` |
| GET   | `/api/crm/admin/consultations`       | `?status=&from=&to=&page=&limit=` |
| GET   | `/api/crm/admin/consultations/:id`   | full record |
| PATCH | `/api/crm/admin/consultations/:id`   | `{status?, note?}` |

#### Rate limits

```
publicLimiter : 100 reqs / 15 min  (per IP)
adminLimiter  : 300 reqs / 15 min  (per IP)
loginLimiter  :  10 reqs / 15 min  (per IP — brute-force guard)
```

### 7.4 Validation

Every route uses [`express-validator`](https://express-validator.github.io/)
chains and a single `validate` middleware that converts validation errors
into a consistent 422 response:

```json
{
  "statusCode": 422,
  "error": "ValidationError",
  "message": "Request validation failed",
  "details": [{ "type": "field", "value": "...", "msg": "...", "path": "...", "location": "..." }]
}
```

### 7.5 Error response shape (every error, every route)

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

For 500 errors in production, `message` is replaced with
`"An unexpected error occurred"` to avoid leaking internals.

### 7.6 Admin SPA (`src/modules/crm/admin/`)

Two static HTML files served by `express.static(...)`:

- `login.html` — form posts to `/api/crm/admin/auth/login`; on success
  stores `adminToken` and `adminEmail` in `localStorage` and redirects
  to `/admin/index.html`.
- `index.html` — vanilla-JS SPA with hash-based routing:
  - `#/consultations` — paginated list with status / date filters.
  - `#/consultations/:id` — detail + status update + add internal note.
  - `#/customers` — paginated list with search.
  - `#/customers/:id` — profile + tags edit + add internal note + full
    consultation history.

All admin-API calls go through a single `api(path, opts)` helper that:
1. Prefixes every path with `/api/crm`.
2. Injects `Authorization: Bearer <token>`.
3. Auto-redirects to `/admin/login.html` on a 401.

CSP is intentionally disabled in `helmet({contentSecurityPolicy: false})`
because the SPA relies on inline `<script>` and `<style>`.

---

## 8. Auth model summary

| Surface | Mechanism | Where it's checked | What happens if missing |
| --- | --- | --- | --- |
| Storefront / mobile → `apps.product-options` | `x-api-key: <API_KEY>` | `modules/apps/product-options/middleware/apiKey.js` | If `API_KEY` is unset on the server, every request is allowed (dev convenience). If set, missing/wrong key → 401. |
| Internal diagnostic (`/test`) | `x-agent-key: <AGENT_API_KEY>` | `modules/apps/product-options/middleware/agentKey.js` | **Fail-closed.** If `AGENT_API_KEY` is unset, every request is denied. |
| Mobile → CRM public | `x-api-key: <API_KEY>` | `modules/crm/middleware/apiKey.js` | If `API_KEY` is unset, every request is allowed but a warning is logged each time. |
| Admin SPA → CRM admin | `Authorization: Bearer <jwt>` | `modules/crm/middleware/jwtAuth.js` | Missing/expired/invalid token → 401. |
| Admin login itself | Compares `email === ADMIN_EMAIL` and `bcrypt.compare(password, ADMIN_PASSWORD_HASH)` | `modules/crm/controllers/adminAuthController.js` | Wrong creds → 401. Missing env config → 503. |

The mobile app and storefront share **one** `API_KEY`. The CRM admin
creds are completely separate (`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` +
`JWT_SECRET`).

---

## 9. Configuration (env vars)

Every env var read by the codebase, grouped by who reads it.

### Server-wide

| Var | Default | Effect |
| --- | --- | --- |
| `PORT` | `3000` | TCP port to bind. |
| `NODE_ENV` | `development` | Drives logger format, CORS defaults, error message redaction. |
| `TRUST_PROXY` | `0` | Set to `1` behind nginx / ngrok / ECS so rate limiters use the real client IP. |
| `ALLOWED_ORIGINS` | `''` | Comma-separated CORS allow-list. Empty → open in dev / closed in prod. |
| `LOG_LEVEL` | `info` | Pino level (`trace` … `fatal`). |
| `LOG_JSON` | unset | When `1`/`true`, attaches structured pino-http access logs. |

### Module flags

| Var | Default | Effect |
| --- | --- | --- |
| `ENABLE_APPS_PRODUCT_OPTIONS` | `true` | Mounts the product-options module + legacy paths. |
| `ENABLE_CRM` | `true` | Mounts the CRM module + admin SPA, opens the MongoDB connection. |

### CRM-specific

| Var | Used by |
| --- | --- |
| `MONGODB_URI` | `shared/config/db.js` |
| `JWT_SECRET` (≥ 32 chars) | `shared/config/jwt.js` |
| `JWT_EXPIRES_IN` (e.g. `24h`) | `shared/config/jwt.js` |
| `ADMIN_EMAIL` | `crm/controllers/adminAuthController.js` |
| `ADMIN_PASSWORD_HASH` (bcrypt of admin password) | `crm/controllers/adminAuthController.js` |
| `API_KEY` | both modules (shared storefront/mobile key) |

### Product-options-specific

| Var | Default | Effect |
| --- | --- | --- |
| `APP_SCRIPT_URL` | Cloudlift dev URL | Source of `{configs, lists}`. |
| `POLL_INTERVAL_MS` | `30000` | How often `appDataService.fetchData()` re-polls. |
| `APP_DATA_FORMAT` | `auto` | `auto` (sniff) / `json` (raw `{configs,lists}`) / `script` (embedded JS). |
| `LOOKUP_RATE_LIMIT_MAX` | `60` | Max GET / requests per IP per minute. |
| `UPLOAD_RATE_LIMIT_MAX` | `20` | Max upload requests per IP per 15 min. |
| `AGENT_API_KEY` | unset (fail-closed) | Required for `/test`. |
| `UPLOAD_RESPONSE_URL_MODE` | `public` | `public` or `presigned`. |
| `S3_GET_PRESIGN_EXPIRES_SEC` | `3600` (max `604800`) | Presigned URL TTL. |
| `S3_PUBLIC_BASE_URL` | unset | Optional CloudFront / custom domain prefix for public URLs. |
| `AWS_REGION` | `us-east-1` | S3 region. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | unset | If unset the SDK falls back to instance credentials. |
| `S3_BUCKET_NAME` | `''` | Target bucket. |
| `LOG_REQUESTS` | unset | When `1`/`true`, write verbose request/response logs to `./logs/`. |

Full reference + dev defaults live in **`.env.example`**.

---

## 10. Health endpoint

`GET /health` returns an aggregate status. It includes one entry per
**enabled** module:

```json
{
  "status": "ok",
  "timestamp": "2026-05-08T07:35:17.743Z",
  "modules": {
    "apps.product-options": {
      "ok": true,
      "configsLoaded": 31,
      "lastFetched": "2026-05-08T07:34:56.741Z"
    },
    "crm": {
      "ok": true,
      "db": "connected"
    }
  }
}
```

If any module reports `ok: false` the response status flips to `503` and
`status` becomes `"degraded"`. Each module also exposes its own
sub-health endpoint (`/api/apps/product-options/health`,
mounting parity for CRM via the aggregate).

---

## 11. Request lifecycle (worked example)

A real `POST /api/crm/consultations` request from the mobile app:

```
1. mobile app:                                              fetch POST /api/crm/consultations
                                                            headers: x-api-key, content-type
                                                            body:    { shopifyCustomerId, type, intake, ... }
2. helmet                  → secure headers
3. requestId               → req.id = uuid → x-request-id
4. cors                    → allow (dev) / allow-list (prod)
5. bodyParser.json         → req.body parsed
6. router /api/crm         → modules/crm/routes/index.js
7. publicLimiter           → 100 req / 15 min per IP
8. apiKey middleware       → x-api-key compared to API_KEY
9. router /consultations   → modules/crm/routes/public/consultations.js
10. express-validator      → required fields, enums, ISO dates
11. validate middleware    → 422 if any rule failed
12. consultationController.create
       └ consultationService.createConsultation(req.body)   → Consultation.create(...)
       └ customerService.upsertCustomer({...}).catch(()=>{}) // fire-and-forget
13. res.status(201).json({ data: consultation })
14. (on error) errorHandler  → logs with req.id, returns standardized JSON
```

Every layer can be inspected by following the file paths in the table —
nothing is generated, no decorators, no DI container.

---

## 12. Static admin SPA — mounting details

```js
// src/createApp.js
if (crmEnabled) {
  app.use('/admin', express.static(path.join(__dirname, 'modules/crm/admin')));
}
```

That single line maps:
- `GET /admin/login.html` → `src/modules/crm/admin/login.html`
- `GET /admin/index.html` → `src/modules/crm/admin/index.html`

The SPA is **deliberately** unminified, no build step, no framework. To
update copy, styles, or add a column: edit the HTML file directly. The
inline JS in `index.html` is organized into commented sections (State &
Auth, Routing, Consultations List, Consultation Detail, Customers List,
Customer Detail, Utilities) so search-and-replace is the primary
modification model.

---

## 13. Backward compatibility

`src/modules/apps/product-options/routes/legacy.js` re-exports the same
controllers under the original storefront / mobile paths:

| Legacy path | Mounted at | Behavior |
| --- | --- | --- |
| `GET /` | server root | Identical to `GET /api/apps/product-options/` |
| `POST /api/upload` | server root | Identical to `POST /api/apps/product-options/upload` |
| `GET /test` | server root | Identical to `GET /api/apps/product-options/test` |

This means **existing storefront / mobile builds keep working** without
changing `EXPO_PUBLIC_BACKEND_URL` or any storefront snippets. New
integrations should prefer the canonical, namespaced paths.

The CRM endpoints have **no** legacy compat layer — they are only
served under the canonical `/api/crm/*` prefix. The mobile app's
`src/services/crmService.ts` already targets these paths.

---

## 14. Tests

Three Jest suites, all hermetic (no external network or DB required):

| File | What it asserts |
| --- | --- |
| `tests/health.test.js` | `GET /health` returns 200 with both modules listed when stubs report ready. |
| `tests/apps/product-options/helpers.test.js` | `parseTags()` handles arrays, JSON-string arrays, comma-separated strings, empty input. |
| `tests/crm/adminAuth.test.js` | 422 on missing fields, 401 on wrong creds, 200 + JWT on correct creds, 401 on wrong email. |

Both `shared/config/db.js` and the product-options health controller are
mocked so tests never poll Cloudlift or talk to MongoDB. Run them with:

```bash
npm test          # one-shot
npm run test:watch
```

---

## 15. Docker

```bash
docker build -t backend-inflate-studio .
docker run --env-file .env -p 3000:3000 backend-inflate-studio
```

The Dockerfile (`node:22-alpine`):
1. Adds a non-root `app:app` user.
2. `npm ci --omit=dev` for production deps only.
3. Copies the source with `--chown=app:app`.
4. Creates `./logs` owned by the app user.
5. Drops to `USER app`, exposes 3000.
6. Healthcheck: `wget -qO- http://localhost:3000/health`.

The CRM connection target (`MONGODB_URI`) must point at an address the
container can reach (`mongodb://host.docker.internal:27017/...` on
macOS, or a real cloud URI in production).

---

## 16. Adding a new module

The folder structure is the API. To add, say, an "upsells" Shopify app:

```
src/modules/apps/upsells/
├── config/
├── controllers/
│   └── healthController.js          # exports getHealth + getUpsellsHealth()
├── middleware/
├── routes/
│   └── index.js                     # const router = express.Router(); ... module.exports = router
└── services/
```

Then in `src/createApp.js`:

```js
const upsellsRouter         = require('./modules/apps/upsells/routes');
const { getUpsellsHealth }  = require('./modules/apps/upsells/controllers/healthController');

const upsellsEnabled = isModuleEnabled('ENABLE_APPS_UPSELLS');

// inside the /health handler:
if (upsellsEnabled) {
  modules['apps.upsells'] = getUpsellsHealth();
  if (!modules['apps.upsells'].ok) allOk = false;
}

// route mount:
if (upsellsEnabled) {
  app.use('/api/apps/upsells', upsellsRouter);
}
```

Add `ENABLE_APPS_UPSELLS=true` to `.env.example` and you're done. No
existing module needs to change.

The same pattern works for non-app modules — e.g. a future
`src/modules/rewards/` would mount under `/api/rewards/*`.

---

## 17. Known constraints / by-design choices

- **Single Mongoose connection.** All CRM models share one Mongo
  database. Multi-tenant isolation isn't supported and isn't planned.
- **Static API key for the storefront / mobile.** Phase 1 only — see
  the original CRM design questions for the upgrade path (per-device
  signed tokens, short-lived JWTs, etc.).
- **No CSRF protection.** The admin SPA is JWT-only with `Bearer`
  headers, not cookies, so CSRF doesn't apply.
- **In-memory caches in `apps.product-options`.** Rebuilt every poll;
  process restart drops them. This is fine for the current load
  (hundreds of products, <30 s staleness tolerance).
- **No build step / no TypeScript.** Plain CommonJS — keep it that way
  unless there's a strong reason to move.

---

## 18. Where to look when debugging

| Symptom | First place to look |
| --- | --- |
| `/health` says CRM `ok: false` | MongoDB connection — check `MONGODB_URI`, then look for `MongoDB error` lines in the server logs. |
| `/health` says product-options `ok: false` and `configsLoaded: 0` | Cloudlift fetch failure — check `[appDataService] fetch attempt N/3 failed:` lines and `APP_SCRIPT_URL`. |
| Admin login returns 401 with the right password | `ADMIN_PASSWORD_HASH` mismatch. Regenerate with `npm run generate:admin-hash -- <password>` and restart. |
| Admin SPA shows blank page | Open devtools → Network. The SPA expects `/api/crm/admin/...` to exist; if you see 404s, confirm the CRM module is enabled. |
| Mobile app can't reach the server from a device | `0.0.0.0` binding is in `index.js`, but `EXPO_PUBLIC_*_URL` must be the LAN IP or an ngrok URL — `localhost` won't resolve from a phone. |
| Rate limit triggered unexpectedly behind a proxy | Set `TRUST_PROXY=1` in `.env`. Otherwise every request looks like it came from the proxy IP. |

---

That's the whole shape of the codebase. If something doesn't fit one of
the boxes above, it probably belongs in a new module — see §16.
