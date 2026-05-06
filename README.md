# Telegram outreach (consent-first)

Production-oriented backend for **polite, operator-controlled** outreach to leads who already have valid consent and (when used) a known Telegram user id. The system does not discover Telegram accounts from phone/email and does not let the model choose targets or timing.

## Stack

- **API**: Fastify, PostgreSQL (Prisma), Redis, BullMQ, grammY, OpenAI (wording + classification only)

## Quick start (local)

1. Copy [`.env.example`](.env.example) to `.env` and set secrets (`ADMIN_API_KEY`, `TELEGRAM_*`, `OPENAI_API_KEY`, etc.).
2. Start infra:

   ```bash
   docker compose up -d postgres redis
   ```

3. Apply migrations and run API + worker (two terminals):

   ```bash
   npx prisma migrate deploy
   npm run dev
   ```

   ```bash
   npm run dev:worker
   ```

4. Set Telegram webhook (replace host and secrets):

   ```text
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<PUBLIC_WEBHOOK_BASE_URL>/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
   ```

5. **Optional admin UI** ([`admin/`](admin/)):

   ```bash
   cd admin && npm install && npm run dev
   ```

   Configure the API key in the UI; Vite proxies `/api` to `http://127.0.0.1:3000`.

## Docker (API + worker)

```bash
docker compose up -d --build
```

Ensure `.env` is present (same variables as `.env.example`). Run `npx prisma migrate deploy` inside the API container once, or from CI before traffic.

## Operator workflow

1. Import leads (`POST /api/v1/leads/upload`) with **required** `consent_status` (see Prisma enum). Rows without allowed consent are stored but never eligible to send.
2. Ensure `telegram_id` is present for leads you intend to message (no scraping).
3. **Enqueue explicitly** per lead: `POST /api/v1/leads/:id/enqueue` with body `{"kind":"initial"}` (or enqueue follow-up only after `NEEDS_INFO` flow).
4. Worker applies RPM limit, daily cap, per-lead cooldown, max attempts, and circuit breaker; replies are classified and state changes are deterministic.

## Testing

```bash
npm test
```

Set `INTEGRATION=1` to run optional Redis queue smoke tests (requires Redis).

## Compliance

You are responsible for consent, messaging frequency, Telegram Terms of Service, and applicable anti-spam law. This codebase encodes guardrails (opt-out, caps, audit logs) but does not replace legal review.
