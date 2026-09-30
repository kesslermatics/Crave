# Crave
🍳 Crave is an AI-powered culinary engine. Whether you're scanning your fridge with Vision AI, hitting specific post-workout macros, or just cooking by "mood", Crave dynamically generates the perfect recipe. Built with Next.js, FastAPI &amp; Gemini.

## Project structure

- `frontend/` — Next.js + Tailwind CSS mobile-first interface. The initial screen is the selected Saffron recipe-home template, set in Sora.
- `backend/` — FastAPI template with health and placeholder recipe-generation endpoints.

## Selected design

**Saffron** uses a white canvas with saffron gold (`#D7C56D`), roasted caramel (`#996130`), and espresso brown (`#423421`). It is an earthy, refined food-first direction.

## Deploying on Railway

Create three services: Postgres, `backend` (root directory `backend`) and `frontend` (root directory `frontend`). Each folder has a `Dockerfile` and `railway.json`.

**backend variables**

| Variable | Value |
| --- | --- |
| `ENVIRONMENT` | `production` (disables `/docs` and the OpenAPI schema, enables HSTS) |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference variable) |
| `GEMINI_API_KEY` | your key (keep it as a Railway secret) |
| `OPENAI_API_KEY` | OpenAI secret for `gpt-6-sol` descriptions and `image-1` recipe images |
| `JWT_SECRET` | a long, cryptographically random Railway secret used to sign access tokens |
| `CORS_ORIGINS` | not needed in production; CORS is pinned to `https://crave-frontend-production.up.railway.app` in the API code |
| `ALLOWED_HOSTS` | `crave-backend-production.up.railway.app` |

**frontend variables**

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://crave-backend-production.up.railway.app` (inlined at build time, contains no secrets) |

Never commit `.env` files; only `.env.example` templates are tracked.

## Account activation

New signup accounts are stored with `is_active=false`; they cannot obtain an access token until manually enabled. There is intentionally no public admin endpoint. Run the following command in the backend Railway service to enable an account:

`python -m app.admin activate-user person@example.com`
