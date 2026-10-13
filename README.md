# Atgangway

A fullstack commerce application for delivering supplies to vessel crews calling at the Port of Santos.

The product connects vessel availability, a product catalog, customer orders, deposit payments, and staff fulfillment workflows.

[Product website](https://atgangway.com)

## Product capabilities

- Vessel selection and ordering windows.
- Product catalog, cart, checkout, and customer order tracking.
- Account authentication and staff access.
- Deposit checkout through Stripe and payment confirmation through webhooks.
- Transactional email notifications and scheduled operational summaries.
- Staff workflows for catalog, vessels, and order fulfillment.

## Architecture and Node.js usage

| Layer | Implementation |
| --- | --- |
| User interface | React, Next.js App Router, TypeScript, and custom CSS |
| Backend | Next.js Server Actions and API route handlers using Node.js-compatible server libraries |
| Database | Supabase/PostgreSQL, SQL functions, migrations, and row-level security policies |
| Authentication | Supabase Auth and server-side session handling |
| Payments | Stripe SDK, checkout sessions, and signed webhook events |
| Notifications | Nodemailer SMTP transport |
| Operations | Scheduled API endpoints, Vercel metrics, and GitHub Actions |

Node.js handles HTTP requests, external integrations, payment orchestration, and email delivery. Critical order rules are implemented in PostgreSQL functions: the backend calls these functions rather than trusting prices supplied by the browser.

This is a **Node.js/TypeScript backend built with Next.js**, not NestJS. The AIS integration under `supabase/functions/` is a separate Supabase Edge Function and should not be counted as Node.js runtime code.

## Engineering decisions

- **Database-owned pricing and order creation:** the checkout delegates catalog checks and order persistence to a PostgreSQL RPC.
- **Idempotent operations:** order creation uses a request key, Stripe checkout uses an idempotency key, and webhook processing records event identifiers.
- **Verified payment events:** the webhook verifies the Stripe signature before processing payment confirmation.
- **Separated access checks:** server-side session and staff checks work alongside database access policies.
- **Operational visibility:** instrumentation records order attempts, database-call duration, and email outcomes.

These mechanisms are implemented in the repository; they do not by themselves establish production-scale reliability.

## Code walkthrough

| Area | Entry point | What to inspect |
| --- | --- | --- |
| Checkout | [app/checkout/actions.ts](app/checkout/actions.ts) | User checks, order RPC, deposit calculation, and Stripe session creation |
| Payments | [app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts) | Signature validation, event handling, and confirmation outcomes |
| Email | [lib/mailer.ts](lib/mailer.ts) | SMTP configuration, timeouts, and delivery claims |
| Staff authorization | [lib/admin.ts](lib/admin.ts) | Shared staff-access checks |
| Scheduled operations | [app/api/cron/daily/route.ts](app/api/cron/daily/route.ts) | Authenticated daily operational summary |
| Database changes | [supabase/migrations/](supabase/migrations/) | SQL schema and business-rule evolution |
| Database checks | [supabase/tests/](supabase/tests/) | pgTAP checks for order, stock, and access invariants |

## Verification

The [CI workflow](.github/workflows/ci.yml) uses Node.js 22 and runs dependency installation, TypeScript checks, the Node test suite, and builds with the repository's public configuration and with empty public configuration.

```bash
npm ci
npx tsc --noEmit
npm test
npm run build
```

Browser tests in [tests/responsivo.test.mjs](tests/responsivo.test.mjs) are opt-in; a passing default test run does not mean these browser checks ran. Database tests require a separately configured development database and are not executed by this CI workflow.

## Development configuration

Use Node.js 22 and configure a private `.env.local` before connecting to external services. Run `npm run dev` to start the application.

| Feature | Configuration names |
| --- | --- |
| Public application configuration | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONFIRM_SECRET` |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |

Public Supabase client configuration is distinct from administrative credentials. Authorization depends on database policies and server-side checks. Use development services and test-mode payments for local verification.

## Current limitations

- Some historical migration files describe changes applied directly to the database instead of containing executable SQL. Database bootstrap and security-policy reproducibility need reconciliation before treating the migration directory as a complete setup procedure.
- Email delivery after payment confirmation needs a durable retry mechanism. The current webhook does not guarantee recovery from an SMTP failure.
- The repository includes automated checks, but not a complete end-to-end validation of payments, database policies, email recovery, and production load.

Earlier product prototypes remain in `prototype/`; the application code is in `app/` and `lib/`.
