# Pikko.ph

Pikko.ph is a multi-tenant pickleball court discovery, booking, and merchant operations platform for the Philippines.

## Current foundation

This first application baseline includes:

- Next.js App Router with TypeScript and Tailwind CSS.
- A mobile-first public booking preview with selectable hourly court slots.
- Real public merchant and site routes backed by tenant-scoped court, schedule,
  allocation, and pricing data.
- Guest manual-payment booking requests with atomic court allocation, secure
  booking links, merchant instructions, and configurable payment deadlines.
- Distinct customer and merchant workspaces backed by one shared identity, so
  venue operators can switch into customer mode without a second account.
- Merchant and platform-administrator dashboard shells.
- A Vercel-friendly health endpoint at `/api/health`.
- A Neon PostgreSQL schema managed with Drizzle migrations.
- Tenant-scoped foreign keys and a database-level court overlap guard.
- Neon Auth sign-in with Pikko-managed platform, merchant-role, and site permissions.
- Environment placeholders for authentication, Maya, and email.
- The product requirements in [`SOFTWARE_REQUIREMENTS.md`](./SOFTWARE_REQUIREMENTS.md).

The landing page lists active marketplace sites and courts from persisted venue
data. Public routes at `/{merchant-slug}` and `/{merchant-slug}/{site-slug}`
revalidate selected slots at checkout and write manual-payment bookings using
the database overlap guard. The merchant dashboard reads recent bookings from
persisted data.

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

## Database workflow

The Vercel project uses the Vercel-managed Neon integration. Vercel does not expose managed sensitive values through `env pull`. To run migrations locally, put a Development-only Neon connection string in the gitignored `.env.local`:

```bash
cp .env.example .env.local
# Replace DATABASE_URL with a Development database connection string.
npm run db:migrate
```

Schema changes live in `src/db/schema`. Generate and validate a migration before applying it:

```bash
npm run db:generate
npm run db:check
npm run db:migrate
```

Never commit `.env.local`, and never use Drizzle `push` against Preview or Production. Preview seed data requires `ALLOW_DATABASE_SEED=true` and the seed script refuses to run when `VERCEL_ENV=production`.

Neon provisions `NEON_AUTH_BASE_URL`. Add a unique `NEON_AUTH_COOKIE_SECRET` of at least 32 random characters to each environment. `PIKKO_PLATFORM_ADMIN_EMAILS` is an optional comma-separated allowlist that promotes matching verified identities to platform administrator when they sign in. Merchant staff are invited from `/merchant/team`; non-owner roles require at least one assigned site.

Vercel runs committed migrations before each build. Drizzle records applied migrations, so unchanged migrations are skipped. A failed migration stops the deployment before the new application version goes live.

## Deployment

Import the GitHub repository into Vercel. Next.js build settings are detected automatically. Configure secrets in Vercel for Preview and Production rather than committing `.env.local`.

## Planned implementation sequence

1. Merchant authentication, staff roles, and site assignments.
2. Sites, courts, hours, closures, and pricing services.
3. Atomic availability holds and booking state transitions.
4. Maya Dynamic QR Ph payment adapter and webhook reconciliation.
5. Manual payment proof workflow and transactional email.
6. Reporting, subscriptions, audit trail, and production hardening.
