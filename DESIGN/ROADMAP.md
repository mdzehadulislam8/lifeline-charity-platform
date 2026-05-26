Lifeline Charity Platform — Roadmap to Ketto-like Full-Featured Platform

Overview
- Goal: Turn Lifeline Charity Platform into a full-featured crowdfunding platform with feature parity with ketto.org tailored for Bangladesh (bKash/Nagad/Rocket/banks, Bangla localization, organizer KYC/payouts, admin oversight, realtime donor feed).

High-level Phases
1. Core & Data Model (MVP)
   - Harden campaign/case models; add `CAMPAIGNS`, `PAYMENTS`, `PAYOUTS`, `ORGANIZERS`, `KYC_DOCUMENTS`, `REFUNDS`, `TRANSACTIONS` tables
   - Implement campaign creation UI + admin approval workflow
   - Add server-side payment intent APIs (Stripe) + mobile-wallet stubs (bKash/Nagad/Rocket)
   - Basic receipts by email (SendGrid/SMTP)

2. Payments & Payouts
   - Integrate bKash/Nagad Rocket production SDKs or partner APIs (sandbox first)
   - Implement Payout request flow for organizers, admin approval, scheduled disbursements
   - Fee handling (platform fee, payment processing fee)
   - Refunds & disputes handling

3. Real-time & UX
   - Add Socket.io to broadcast donation events, live progress updates, and recent donor feed
   - Implement Ketto-like campaign listing: featured, trending, filters, progress bar cards
   - Social sharing (Open Graph metadata, WhatsApp/FB/Twitter share actions)

4. Trust & Compliance
   - Organizer onboarding + KYC (document upload, manual verification dashboard)
   - Anti-fraud heuristics, reports, donor verification on large donations
   - Logging, audit trails, exportable reports

5. Scaling, Testing & Deployment
   - Add unit/integration tests, E2E (Playwright or Cypress)
   - CI pipeline, Docker containerization, staging environment
   - Production deployment (PM2 or Docker + Nginx), monitoring (Prometheus/Datadog), backups

Database schema additions (examples)
- ORGANIZERS: organizer_id, user_id, org_name, contact_phone, bank_account, bank_name, status (pending/approved/rejected), created_at
- CAMPAIGNS: campaign_id, organizer_id, title, slug, short_description, full_description, goal_amount, collected_amount, currency, status (draft/published/closed), start_date, end_date, created_at
- PAYMENTS: payment_id, campaign_id, case_id, donor_id, donor_name, donor_email, amount, currency, provider (stripe|bkash|nagad|rocket|bank), provider_reference, status (pending|completed|failed|refunded), created_at
- PAYOUTS: payout_id, organizer_id, amount, fee, method, provider_reference, status (requested|approved|paid|rejected), requested_at, processed_at
- KYC_DOCUMENTS: doc_id, organizer_id, filename, doc_type, status, uploaded_at, reviewed_by, reviewed_at
- TRANSACTIONS / LOGS: keep ledger for accounting and refunds

API endpoints (new/extended)
- POST /api/campaigns -> create campaign (auth organizer)
- GET /api/campaigns[?filters] -> list campaigns
- GET /api/campaigns/:id -> campaign details
- POST /api/payments/create-intent -> create payment intent (stripe or provider stub)
- POST /api/payments/confirm -> confirm external/mobile payment (already added)
- POST /api/payouts/request -> organizer requests payout
- POST /api/organizers/kyc -> upload docs
- GET /api/admin/approvals -> pending campaigns/kyc/payouts
- POST /api/admin/payouts/:id/approve -> approve payout

Realtime
- Socket.io server at /socket.io
- Rooms by campaign: join `campaign:<campaign_id>` to receive donation events and progress updates
- Emit events: `donation:created`, `campaign:updated`, `payout:status`.

Integrations & Providers
- Email: SendGrid or SMTP fallback
- SMS: Twilio or local Bangladeshi SMS gateway (if budget is constrained, use email-only MVP)
- Payments: Stripe (cards) + bKash/Nagad/Rocket (mobile wallets) + Bank transfer
- Storage: local uploads -> S3-compatible (DigitalOcean Spaces / AWS S3) for KYC docs and images

Security & Compliance
- Use HTTPS in production; do not accept credentials in frontend
- Store sensitive keys (Stripe, bKash) in environment variables
- Logging and rate limiting for endpoints like /payments/confirm

Milestones and estimated timeline (MVP-first approach)
- Week 0 (planning): finalize providers, KYC level, localization decision (2–3 days)
- Week 1–2 (Core & Payments MVP): DB schema, campaign create/approve, Stripe + mobile-wallet stubs, donation flow, basic receipts
- Week 3 (Realtime & UX polish): Socket.io live updates, campaign listing redesign, social sharing
- Week 4–5 (Payouts & KYC): organizer onboarding, KYC upload, payout request/approval
- Week 6+ (hardening): test coverage, CI, staging, production deployment and monitoring

Immediate next actions I propose (pick one)
- Option 1 (recommended): Implement Phase 1 tasks now — DB schema migration, backend APIs for campaigns/payouts, Socket.io skeleton, and update frontend campaign listing + detail pages to use realtime.
- Option 2: Implement Stripe + Stripe.js frontend integration end-to-end for card payments.
- Option 3: Implement bKash/Nagad sandbox server stubs + docs for merchant onboarding.

Notes for you to decide
- Which payment providers to prioritize (Stripe + bKash recommended)
- KYC depth: minimal (ID + bank proof) or strict (multi-doc manual review)
- Hosting target (AWS / DigitalOcean / Heroku / other)
- Preferred email/SMS providers (SendGrid/Twilio recommended)

What I will do next after you confirm
- Create DB migration SQL files for new tables and add them to `migrations/` (safe, reversible statements)
- Implement Socket.io in `server.js` and add a small client snippet to `public/js/main.js` to listen for updates
- Add backend endpoints for payout requests and KYC uploads with basic admin review endpoints

If you confirm, tell me which immediate option you want (1/2/3) and the provider choices (Stripe, bKash, Nagad, Rocket) and whether to start adding migrations and Socket.io now.