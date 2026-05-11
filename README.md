# backend-inflate-studio

Single Node.js / Express backend for Inflate Studio — a **modular monolith**
that contains every Shopify app and the CRM service in one repo, one
deployment, one set of dependencies.

## Modules

| Module | Mount path | Purpose |
| --- | --- | --- |
| `apps.product-options` | `/api/apps/product-options/*` | Reads configs from Cloudlift, returns the matching product options for a Shopify product, and uploads inspiration images to S3. |
| `crm` | `/api/crm/*` | Customer profiles + consultation records (MongoDB). Powers the admin panel served at `/admin`. |

Each module is self-contained under `src/modules/<area>/<name>/` with its
own `controllers/`, `services/`, `routes/`, `middleware/`, and where
applicable, `models/` and `config/`.

Cross-cutting concerns (logger, request id, error handler, JWT helper, db
connection) live in `src/shared/`.

## Folder layout

```
backend-inflate-studio/
├── index.js                          # Boots Express + connects MongoDB
├── package.json
├── Dockerfile
├── .env.example
├── scripts/
│   └── generate-admin-hash.js
├── src/
│   ├── createApp.js                  # Mounts every module + middleware
│   ├── shared/
│   │   ├── config/                   # db.js, jwt.js
│   │   ├── middleware/               # requestId, errorHandler, httpLogger
│   │   └── utils/                    # logger, fileLogger, env
│   └── modules/
│       ├── apps/
│       │   └── product-options/
│       │       ├── config/           # aws.js, multer.js
│       │       ├── controllers/
│       │       ├── middleware/       # apiKey, agentKey
│       │       ├── routes/           # index.js + legacy.js
│       │       ├── services/
│       │       └── utils/
│       └── crm/
│           ├── admin/                # Static SPA (login.html, crm-console.html, …)
│           ├── config/               # (per-module config — currently none)
│           ├── controllers/
│           ├── middleware/           # apiKey, jwtAuth, validate
│           ├── models/               # Customer, Consultation, Artist, RecycleEvent
│           ├── routes/               # public/* + admin/*
│           ├── services/
│           └── utils/                # paginate.js
└── tests/
    ├── health.test.js
    ├── apps/
    │   └── product-options/
    └── crm/
```

## Quick start

```bash
cd backend-inflate-studio
cp .env.example .env
npm install

# Generate a bcrypt hash for the CRM admin login (only once):
npm run generate:admin-hash -- "your-strong-password"
# paste the result into ADMIN_PASSWORD_HASH in .env

# Start MongoDB (if running locally)
brew services start mongodb-community

npm run dev   # nodemon
# or
npm start
```

The server listens on `PORT` (default `3000`) and binds to `0.0.0.0`
so a phone on the same network can reach it.

## Endpoints

### Aggregate health
- `GET /health` → reports the readiness of each enabled module.

### Product Options module (Shopify storefront + mobile app)
| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET  | `/api/apps/product-options/`         | `x-api-key` | Match configs for a product |
| POST | `/api/apps/product-options/upload`   | `x-api-key` | Upload an image to S3 |
| GET  | `/api/apps/product-options/test`     | `x-agent-key` | Verbose diagnostic |
| GET  | `/api/apps/product-options/health`   | none | Module readiness |

**Backward-compat paths** (used by the existing storefront / mobile build):
`GET /`, `POST /api/upload`, `GET /test` — same behavior.

### CRM module — public (mobile app)
| Method | Path | Auth |
| --- | --- | --- |
| POST  | `/api/crm/customers`              | `x-api-key` |
| GET   | `/api/crm/customers/:shopifyId`   | `x-api-key` |
| POST  | `/api/crm/consultations`          | `x-api-key` |
| GET   | `/api/crm/consultations/:id`      | `x-api-key` |
| PATCH | `/api/crm/consultations/:id/status` | `x-api-key` |

### CRM module — admin (admin panel)
| Method | Path | Auth |
| --- | --- | --- |
| POST  | `/api/crm/admin/auth/login`              | none |
| GET   | `/api/crm/admin/customers`               | JWT |
| GET   | `/api/crm/admin/customers/:id`           | JWT |
| PATCH | `/api/crm/admin/customers/:id`           | JWT |
| GET   | `/api/crm/admin/consultations`           | JWT |
| GET   | `/api/crm/admin/consultations/:id`       | JWT |
| PATCH | `/api/crm/admin/consultations/:id`       | JWT |

The admin SPA is served from `/admin` (`/admin/login.html`, `/admin/crm-console.html`). Visiting `/admin/` or `/admin/index.html` redirects to `crm-console.html` (hash preserved).

## Mobile app integration

The mobile app (`inflate-studio-mobile-app`) talks to two URLs:

```
EXPO_PUBLIC_BACKEND_URL=https://<your-host>            # product-options
EXPO_PUBLIC_CRM_URL=https://<your-host>                # CRM (same host)
EXPO_PUBLIC_BACKEND_API_KEY=<API_KEY>
EXPO_PUBLIC_CRM_API_KEY=<API_KEY>
```

Both modules now run on the same host, so the two URLs can point at the
same domain. The mobile CRM client (`src/services/crmService.ts`) hits
`/api/crm/customers` and `/api/crm/consultations` directly.

## Disabling a module

Set `ENABLE_APPS_PRODUCT_OPTIONS=false` or `ENABLE_CRM=false` in `.env`
to skip that module entirely (no routes mounted, no MongoDB connection
when CRM is off). Useful for partial environments or test runs.

## Docker

```bash
docker build -t backend-inflate-studio .
docker run --env-file .env -p 3000:3000 backend-inflate-studio
```

## Tests

```bash
npm test
```

Tests stub MongoDB and the product-options data fetcher so they run
offline.
