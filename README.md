# Crave
🍳 Crave is an AI-powered culinary engine. Whether you're scanning your fridge with Vision AI, hitting specific post-workout macros, or just cooking by "mood", Crave dynamically generates the perfect recipe. Built with Next.js, FastAPI &amp; Gemini.

## Project structure

- `frontend/` — Next.js + Tailwind CSS mobile-first interface. The initial screen is the selected Saffron recipe-home template, set in Sora.
- `backend/` — FastAPI template with health and placeholder recipe-generation endpoints.

## Selected design

**Saffron** uses a white canvas with saffron gold (`#D7C56D`), roasted caramel (`#996130`), and espresso brown (`#423421`). It is an earthy, refined food-first direction.

## Deploying with Dokploy

Create three resources: a Postgres database, `backend` (Dockerfile build, build path `backend`, Dockerfile `Dockerfile`) and `frontend` (Dockerfile build, build path `frontend`).

For each application, add a domain in Dokploy and set the **container port**: `8000` for the backend, `3000` for the frontend. A wrong port is the usual cause of `Bad Gateway`.

**backend environment**

| Variable | Value |
| --- | --- |
| `ENVIRONMENT` | `production` (disables `/docs` and the OpenAPI schema, enables HSTS) |
| `DATABASE_URL` | internal connection URL of the Dokploy Postgres service (`postgresql://user:pass@<service-name>:5432/db`) |
| `OPENROUTER_API_KEY` | OpenRouter secret for the models |
| `JWT_SECRET` | a long (32+ bytes), cryptographically random secret used to sign access tokens |
| `CORS_ORIGINS` | exact public frontend origin, e.g. `https://crave.example.com` (no trailing path, no `*`) |
| `ALLOWED_HOSTS` | public backend hostname, e.g. `api.crave.example.com` (no scheme) |

`PORT` defaults to `8000` and does not need to be set.

**frontend build arguments** (Dokploy: Advanced → Build Args; the value is inlined at build time)

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | public backend URL, e.g. `https://api.crave.example.com` (contains no secrets) |

Never commit `.env` files; only `.env.example` templates are tracked.

## Account activation

New signup accounts are stored with `is_active=false`; they cannot obtain an access token until manually enabled. There is intentionally no public admin endpoint. Run the following command in the backend container (Dokploy: Terminal tab) to enable an account:

`python -m app.admin activate-user person@example.com`
