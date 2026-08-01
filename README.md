# Pikko.ph

Pikko.ph is a multi-tenant pickleball court discovery, booking, and merchant operations platform for the Philippines.

## Current scaffold

This first application baseline includes:

- Next.js App Router with TypeScript and Tailwind CSS.
- A mobile-first public booking preview with selectable hourly court slots.
- Merchant and platform-administrator dashboard shells.
- A Vercel-friendly health endpoint at `/api/health`.
- Environment placeholders for PostgreSQL, authentication, Maya, and email.
- The product requirements in [`SOFTWARE_REQUIREMENTS.md`](./SOFTWARE_REQUIREMENTS.md).

The displayed courts, prices, and dashboard metrics are sample data. No payment or booking is persisted yet.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run lint
npm run build
```

## Deployment

Import the GitHub repository into Vercel. Next.js build settings are detected automatically. Configure secrets in Vercel for Preview and Production rather than committing `.env.local`.

## Planned implementation sequence

1. PostgreSQL schema and tenant-safe data access.
2. Merchant authentication, staff roles, and site assignments.
3. Sites, courts, hours, closures, and pricing rules.
4. Atomic availability holds and booking state transitions.
5. Maya Dynamic QR Ph payment adapter and webhook reconciliation.
6. Manual payment proof workflow and transactional email.
7. Reporting, subscriptions, audit trail, and production hardening.
