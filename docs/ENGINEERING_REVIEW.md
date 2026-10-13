# Engineering review

Reviewed on October 13, 2026. Scope: selected API routes, server actions, authentication helpers, configuration, migrations and tests. No production database policy inspection, payment execution, load test, or full Git-history secret scan was performed.

## What is expected to be visible

The browser uses Supabase's public URL and publishable/anonymous key. These identify the project; they are not administrative secrets. Database grants, RLS and verified sessions must enforce access. Rewriting Supabase URLs onto the application domain does not hide or secure the underlying API.

The inspected Stripe and SMTP secrets are read in server modules. Admin actions use `requireAdmin()`, sessions use verified claims, and the Stripe webhook verifies signatures. These are meaningful controls, but do not prove the deployed database policies are correct.

## Findings

| Priority | Finding | Evidence and follow-up |
| --- | --- | --- |
| High | Database lockdown cannot be reproduced from migrations alone | `20260831180000_fase_b_lockdown_pedido.sql` describes manual policy changes rather than executing them. A fresh replay can retain direct customer-write policies from earlier migrations. Reconcile actual production policies into executable migrations and test cross-user access using pgTAP. |
| High | Implicit production backend fallback | `lib/env.ts` falls back to a production project on Vercel; `next.config.ts` also creates rewrites with a production fallback. Missing preview configuration can select production. Require explicit per-environment backend configuration and make proxy rewrites opt-in. |
| Medium | Order status changes use read-then-write without comparing the previous state | `app/admin/actions.ts` reads status and later updates by ID alone. Concurrent staff operations can overwrite each other. Use compare-and-set for transitions and a database transaction for undo/credit invariants. |
| Medium | Email failure does not cause payment-webhook recovery | The webhook sends only for `confirmed`, ignores the send result and returns 200. A replay returns `duplicate_event` and skips that branch. Add a durable outbox/retry worker; do not confuse payment idempotency with email delivery guarantees. |
| Medium | Legacy secret fallback couples two trust boundaries | The webhook falls back from `STRIPE_CONFIRM_SECRET` to the signing secret. Confirm deployment and database migration state before removing this compatibility path. |
| Medium — fixed | Plain-text fallback was interpolated into email HTML | `lib/mailer.ts` now escapes plain text before embedding it in a `pre` element. Added regression tests for injected tags, links, entities and ordinary text. |
| Medium | Input types do not replace runtime validation | Several server actions accept typed objects and call string methods directly. Reject malformed types and enforce field lengths, UUIDs, finite numeric ranges and upload content constraints at the server boundary. |
| Low | Some diagnostics expose internal messages | Restrict detailed database/SMTP failures to server logs. Return stable public error codes; keep authenticated operational diagnostics intentional. |

## Verification and limits

The documentation cleanup passed the existing GitHub Actions pipeline (Node 22, TypeScript, tests, and builds). The email escaping change adds two deterministic tests. The default test run excludes opt-in browser checks; pgTAP tests require a configured test database and are not run in this workflow.

The review establishes concrete source-level findings. It does not assert that customer data has leaked, that a public Supabase key is a leaked secret, or that every dependency and historical commit has been audited.
