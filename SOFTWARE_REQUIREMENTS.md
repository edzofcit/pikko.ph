# Pikko.ph Software Requirements Specification

**Document status:** Draft v0.2

**Product:** Pikko.ph

**Product type:** Multi-tenant pickleball court discovery and booking platform

**Initial market and currency:** Philippines / PHP

**Last updated:** 2026-08-01

## 1. Purpose

Pikko.ph enables pickleball merchants to publish sites and courts, manage schedules and pricing, accept online or manually verified payments, and operate bookings. Customers can discover available court-hour blocks and book one or more consecutive hours without being required to create an account. Pikko.ph administrators manage the platform, merchants, subscriptions, and transaction-fee settings.

This document defines the initial product requirements and recommended business rules. Items explicitly marked as assumptions or open decisions require confirmation before implementation.

## 2. MVP scope

The first release includes:

- Multi-tenant merchant accounts with strict data separation.
- Platform administration.
- Merchant staff and role-based permissions.
- Multiple sites per merchant and multiple courts per site.
- Site and court operating schedules, closures, and availability.
- Hour-based court bookings with consecutive-hour selection.
- Base, recurring time-based, and special-date pricing.
- Guest and registered-customer checkout.
- Maya Pay with Maya dynamic QR Ph online payments.
- Merchant-configured manual payment instructions and proof upload.
- Promo codes.
- Email notifications.
- Booking, revenue, balance, utilization, cancellation, and payment reconciliation reports.
- Subscription billing based on the number of active courts per month.
- Per-merchant online-payment percentage fees configured by a platform administrator.

The following are outside the MVP unless later approved:

- Native iOS or Android applications.
- SMS or push notifications.
- Memberships, packages, tournaments, coaching, equipment rentals, and food or beverage add-ons.
- Marketplace payouts or stored-value wallets operated directly by Pikko.ph.

## 3. Users and access

### 3.1 Platform administrator

A platform administrator can:

- Create, review, activate, suspend, and archive merchants.
- View all merchants, sites, courts, bookings, payments, refunds, subscriptions, and audit events.
- Configure each merchant's monthly subscription price per active court.
- Configure each merchant's Pikko.ph percentage fee for online gateway transactions.
- Configure platform-wide defaults without silently overwriting merchant-specific settings.
- Manage Maya integration settings and preserve a provider abstraction for future gateways.
- View subscription usage and billing history.
- Assist with disputes and support cases while all sensitive access is audited.
- Impersonate a merchant only if this capability is later enabled, clearly indicated, and fully audited.

### 3.2 Merchant owner

A merchant owner can:

- Manage merchant profile and public URL slug.
- Create and manage multiple sites and courts.
- Invite, deactivate, and assign roles to merchant staff.
- Configure schedules, prices, closures, payment methods, policies, promo codes, and notifications.
- Create and manage customer, walk-in, phone, and complimentary bookings.
- Review manual payment evidence and mark payments paid or rejected.
- Cancel bookings, record refunds, mark no-shows, and access reports.

### 3.3 Merchant staff

The system must support custom or predefined roles with granular permissions. Recommended predefined roles are:

- **Owner:** Full merchant access, billing, staff, and security settings.
- **Site manager:** Manages assigned sites, courts, schedules, prices, bookings, and reports.
- **Booking staff:** Creates and updates bookings and customer records for assigned sites.
- **Cashier:** Reviews payments, verifies manual payments, and records refunds.
- **Viewer:** Read-only access to assigned sites and reports.

A staff member may be restricted to one or more sites. The system must deny access by default when a permission or site assignment is absent.

### 3.4 Customer

A registered customer can manage profile information, view bookings, use booking-management links, and make new bookings. A customer may hold overlapping bookings for different courts or time blocks.

### 3.5 Guest customer

Guest checkout is allowed. At minimum, the customer must provide:

- Email address.
- Full name.
- Mobile number, recommended for operational contact even though MVP notifications are email-only.
- Acceptance of the site's booking, cancellation, and privacy policies.

A guest receives a confirmation email and a secure, expiring or revocable booking-management link. The link must not expose other bookings or customer data.

## 4. Multi-tenant structure

The ownership hierarchy is:

`Platform -> Merchant -> Site -> Court -> Availability and Bookings`

Rules:

- One merchant may own multiple sites.
- One site belongs to exactly one merchant.
- One site may contain multiple courts.
- One court belongs to exactly one site.
- Merchant data, users, configuration, reports, and files must be isolated from every other merchant.
- Platform administrators have authorized cross-tenant access; merchant users do not.
- Every tenant-owned record must carry or inherit an unambiguous merchant identifier.

## 5. Merchant, site, and court configuration

### 5.1 Merchant profile

The merchant profile includes legal/display name, logo, description, contact information, status, public slug, billing details, default currency, and default timezone.

### 5.2 Site profile

Each site supports:

- Name and unique merchant-scoped slug.
- Address and map coordinates.
- Timezone.
- Contact information.
- Description, amenities, photos, and policies.
- Weekly operating hours, including multiple open periods per day.
- Holiday or special-date operating-hour overrides.
- Booking lead time and maximum advance-booking window.
- Manual and online payment options.
- Cancellation, refund, no-show, and manual-payment policies.
- Tax and fee display settings.

Public routes should follow a stable structure such as:

- `pikko.ph/{merchant-slug}`
- `pikko.ph/{merchant-slug}/{site-slug}`

Slugs must be unique within their required scope, URL-safe, and protected from reserved platform words.

### 5.3 Court profile

Each court supports:

- Name or number, description, photos, surface/type, amenities, and active status.
- A base hourly rate.
- Site operating hours by default.
- Optional court-specific operating-hour overrides.
- Temporary closure and maintenance blocks.
- Configurable preparation or cleanup buffers before or after a booking, if enabled later.

Inactive courts must not be publicly bookable and must be excluded from future subscription usage from the effective deactivation date, subject to the billing policy.

## 6. Availability and scheduling

### 6.1 Slot model

- The MVP booking interval is one hour.
- The minimum booking duration is one hour.
- Customers may select multiple contiguous available hour blocks for the same court in one booking line.
- The site UI displays courts and their available hourly blocks for the chosen date.
- All availability calculations use the site's timezone and store timestamps in UTC plus the applicable timezone context.
- A court is available only when it is open, active, not blocked, and has no availability-blocking booking or temporary checkout hold.

### 6.2 Availability precedence

Availability is calculated in this order:

1. Site weekly operating hours.
2. Site special-date or holiday override.
3. Court-specific weekly override, when present.
4. Court-specific special-date override, when present.
5. Maintenance, private-event, or temporary-closure blocks.
6. Active holds and availability-blocking bookings.

A more specific court/date rule takes precedence over a broader site/weekly rule.

### 6.3 Closures and blocks

Authorized merchant users can block one court, multiple courts, or an entire site for maintenance, private events, or temporary closure. A block contains a reason, start and end time, visibility setting, creator, and audit history.

The system must warn the user when a new block overlaps an existing booking. It must not automatically cancel or move an existing booking without an explicit, audited merchant action.

### 6.4 Concurrency

- Availability shown in the UI is informational until the server acquires a hold or confirms a booking.
- The server must revalidate every selected block immediately before checkout and confirmation.
- The system must use an atomic conflict check so two customers cannot confirm the same court and time.
- A successful online-payment booking, or a manual-payment booking configured to reserve immediately, makes the relevant blocks unavailable.
- Customer identity does not create an overlap restriction: the same customer may book multiple courts at the same time.

## 7. Pricing

### 7.1 Price components

The booking price may contain:

- Court subtotal.
- Discount.
- Tax.
- Merchant-defined service or booking fee.
- Pikko.ph customer-facing fee, only if enabled by future policy.
- Total payable.

Pikko.ph's merchant subscription and gateway percentage fee must be accounted for separately from the customer total unless the merchant and platform configuration explicitly pass an allowed fee to the customer.

### 7.2 Price rules

Each court has a base hourly rate. Merchants may define:

- Recurring prices by day of week and start/end time.
- Peak and off-peak rates.
- Special-date and holiday prices.
- Date-range promotions or seasonal rates.
- Tax-inclusive or tax-exclusive display.
- Fixed or percentage merchant service fees.

Recommended pricing precedence, highest first:

1. Court-specific special date and time.
2. Site-wide special date and time.
3. Court-specific recurring day and time.
4. Site-wide recurring day and time, if site-level pricing is enabled.
5. Court base hourly rate.

If two rules have equal specificity, the most recently approved rule wins. The merchant UI must warn about overlapping rules before saving. A confirmed booking retains its price snapshot even if pricing rules later change.

### 7.3 Price presentation

The customer must see the hourly price for each available block and a complete price breakdown before placing the booking. Taxes, discounts, and fees must not appear for the first time after confirmation.

## 8. Promo codes

Merchants can create promo codes scoped to the merchant, selected sites, or selected courts. A promo code supports:

- Fixed-amount or percentage discounts.
- Active date/time range.
- Overall redemption limit and per-email/customer limit.
- Minimum spend and optional maximum discount.
- Applicable days, hours, sites, and courts.
- Active/inactive status.

Only one promo code applies to a booking in the MVP. The applied discount and rule snapshot must be retained on the booking.

## 9. Booking workflow

### 9.1 Customer booking

The customer can:

1. Open a merchant or site page.
2. Select a date and view courts with hourly availability and prices.
3. Select one or more consecutive blocks for a court.
4. Review booking details and price breakdown.
5. Sign in or continue as a guest.
6. Enter required contact information and optionally apply a promo code.
7. Choose an enabled payment method.
8. Accept site policies and place the booking.
9. Receive an email reflecting the resulting booking and payment state.

If selected blocks become unavailable before checkout completes, the system must not charge the customer and must return them to current availability with a clear message.

### 9.2 Merchant-created booking

Authorized merchant users can create bookings for walk-in, phone, complimentary, or other merchant-defined sources. They must provide or intentionally omit customer details, select a payment state, and add internal notes. Complimentary bookings have a zero total and remain distinct from discounts for reporting.

Merchant-created bookings use the same atomic conflict checks as customer bookings. Overbooking is prohibited in the MVP.

### 9.3 Booking reference

Each booking has a human-readable, globally unique reference suitable for email and support. Internal sequential database identifiers must not be exposed as the only public identifier.

## 10. Booking and payment states

Booking state and payment state must be stored separately.

Recommended booking states:

- `DRAFT`: Checkout has not been placed; does not block availability.
- `PENDING_PAYMENT`: Awaiting payment action; blocks availability only under the applicable hold/manual policy.
- `PENDING_VERIFICATION`: Manual proof was submitted and awaits merchant review; blocking behavior follows site policy.
- `CONFIRMED`: Required payment condition was satisfied or an authorized merchant confirmed the booking; blocks availability.
- `CANCELLED`: Cancelled by customer, merchant, or platform; no longer blocks availability.
- `EXPIRED`: Payment or proof deadline passed; no longer blocks availability.
- `COMPLETED`: Booking end time passed or booking was completed; historical only.
- `NO_SHOW`: Merchant marked the customer absent; historical only.

Recommended payment states:

- `UNPAID`
- `PENDING`
- `PAID`
- `REJECTED`
- `PARTIALLY_REFUNDED`
- `REFUNDED`
- `FAILED`

Every state transition records the actor, timestamp, source, reason, and relevant provider reference.

## 11. Online payments using Maya QR Ph

Maya Pay with Maya is the initial online payment gateway and QR Ph acquirer for Pikko.ph. QR Ph remains the Philippine national interoperable QR code standard; Maya supplies the API, transaction processing, status updates, and merchant services used by the platform.

Requirements:

- Use a provider abstraction so the platform can add or replace payment providers later without changing booking-domain rules.
- Integrate Maya's `Create Dynamic QR` endpoint to create a one-time QR Ph payment for the exact server-calculated booking total.
- Generate a unique Pikko.ph request reference number for every payment attempt and persist Maya's returned `paymentId`.
- Support either Maya's hosted `redirectUrl` or an embedded QR generated from the returned `qrCodeBody`; the MVP implementation choice must be consistent across supported browsers.
- Host customer-facing success, failure, and cancellation result pages.
- Create an availability hold before requesting the Maya QR.
- Treat a Maya dynamic QR as valid for one hour from creation. The court hold must not be released while the QR can still be paid unless Pikko.ph has successfully cancelled the Maya payment and verified that it can no longer succeed.
- Recommended safe MVP behavior: hold the selected court blocks until Maya reports a terminal payment state or the one-hour QR validity period ends. A shorter product hold may be introduced only with a tested cancellation-and-race-resolution design.
- Confirm a booking only after an authenticated Maya webhook reports success or a server-side Maya payment retrieval verifies success.
- Do not treat the browser redirect, client-side status request, or screenshot as authoritative proof of online payment.
- Acknowledge valid Maya webhook delivery promptly, then process it idempotently.
- Tolerate duplicate, delayed, missing, and out-of-order webhook events.
- If a webhook is not received, reconcile using Maya's payment retrieval endpoint by `paymentId` or request reference number.
- Release the court hold only after verified failure, cancellation, or expiry, with a final status check where a late payment remains possible.
- Reconcile Maya transactions against Pikko.ph payment attempts and bookings.
- Store Maya transaction identifiers and necessary reconciliation metadata, but never store customer banking credentials.
- Keep Maya secret API keys server-side, encrypted, access-controlled, and excluded from logs and browser responses.
- Calculate Pikko.ph's percentage fee using the administrator-configured rate effective for that merchant at transaction time.
- Snapshot the applied fee rate and amount so later configuration changes do not alter historical records.
- Support Maya full and partial refunds if enabled for the selected Maya product and merchant account; otherwise record an externally processed refund.

## 12. Manual payments

### 12.1 Merchant setup

At site level, merchants can enable manual payments and configure:

- Method name, such as bank transfer or e-wallet transfer.
- Account name and masked or displayable account details.
- Written payment instructions.
- QR code image.
- Payment/proof deadline.
- Accepted proof file types and customer notes.
- Whether a pending manual booking immediately reserves its selected court blocks.

Recommended default: manual bookings reserve the selected blocks immediately for a merchant-configurable deadline of 30 minutes. This avoids accepting payment from a customer after another customer has obtained the court. The merchant may configure a longer deadline when manual verification is slow.

If a merchant chooses not to reserve until verification, the checkout must clearly warn the customer that the slot is not guaranteed. Only the first payment that can be verified while the slot remains available may be confirmed; conflicting payments require merchant resolution and refund tracking.

### 12.2 Customer proof submission

- Instructions appear before and after the booking is placed.
- Customers can upload one or more screenshots or supported documents from the booking screen or secure guest-management link.
- Uploads are private and accessible only to authorized merchant staff and platform administrators.
- The system validates file type and size, renames stored files, scans them for malware where supported, and prevents executable content.
- Each submission records uploader, timestamp, files, and optional notes.

### 12.3 Merchant verification

Authorized merchant staff can:

- View the submitted proof and payment details.
- Mark the payment paid, recording amount, payment date, reference, and notes.
- Reject the proof with a customer-visible reason and request another submission.
- Record partial or full externally processed refunds.

Marking a manual payment paid must revalidate court availability. If the site policy already reserved the blocks, the booking becomes confirmed. If the site policy did not reserve them and they are no longer available, the system must prevent confirmation and start a documented conflict/refund resolution.

## 13. Cancellation, refund, and no-show policy

Policies are configured per site. Court-specific policy overrides are outside the MVP.

### 13.1 Configurable policy fields

- Whether customers may cancel using their account or secure guest link.
- Latest self-service cancellation time before booking start.
- One or more refund tiers expressed as time before start and refundable percentage.
- Whether tax and merchant service fees are refundable.
- Whether gateway fees are refundable, subject to provider rules and applicable law.
- Whether promo discounts are restored after cancellation.
- No-show grace period.
- Whether merchants can make documented exceptions.
- Customer-visible policy text and acceptance version.

### 13.2 Recommended default policy

- At least 24 hours before start: 100% of refundable court charges.
- From 6 to less than 24 hours: 50% of refundable court charges.
- Less than 6 hours before start or no-show: no refund.
- A merchant cancellation: 100% refund of all customer-paid amounts attributable to the booking.
- Refund timing: shown as provider-dependent; merchant must not promise an exact bank posting date unless supported.

The merchant may change these tiers. A booking must retain the exact policy version accepted at checkout; later policy changes apply only to new bookings.

### 13.3 Cancellation processing

- Cancellation must be an explicit, auditable action with actor and reason.
- Cancelling releases all future court blocks associated with the booking.
- Online refunds should be initiated through the payment provider when supported.
- Manual refunds must be marked pending and then completed with external reference/evidence.
- A refund failure must not silently revert the cancellation.
- Merchant exceptions require a reason and permission.

## 14. Email notifications

The MVP sends transactional email for:

- Booking placed or payment pending.
- Online payment success or failure.
- Manual payment instructions.
- Payment proof received.
- Manual proof approved or rejected.
- Booking confirmation.
- Booking reminder.
- Customer or merchant cancellation.
- Refund initiated, completed, or failed.
- Material schedule change affecting a booking.

Merchants can configure reply-to details and reminder timing within platform limits. Emails include merchant/site identity, booking reference, court, local date/time and timezone, price/payment summary, policies, and a secure management link where applicable.

## 15. Reports and dashboards

### 15.1 Merchant reporting

Merchant dashboards and exports include filters for date range, site, court, booking source, booking state, payment method, and payment state.

Required reports:

- Booking volume and value.
- Gross revenue, discounts, taxes, fees, refunds, and net collected amount.
- Paid, unpaid, pending-verification, failed, and rejected payments.
- Court utilization: booked hours divided by bookable operating hours.
- Cancellations and no-shows.
- Online-payment reconciliation by provider transaction.
- Manual-payment reconciliation.
- Promo-code usage.

### 15.2 Platform reporting

Platform administrators can view:

- Active merchants, sites, and billable courts.
- Monthly subscription usage and charges.
- Online payment volume and Pikko.ph percentage fees by merchant.
- Platform booking volume and gross merchandise value.
- Payment/refund reconciliation exceptions.
- Merchant activation, suspension, and churn indicators.

Reports must distinguish booking value from money actually collected and must not count unpaid or refunded amounts as collected revenue.

## 16. Subscription and platform fees

- Subscription pricing is based on each merchant's active billable courts per month.
- The administrator configures the monthly per-court price per merchant.
- The system records active-court usage over time so historical invoices can be reproduced.
- Mid-cycle activation/deactivation and proration behavior is an open decision.
- Subscription invoices, due dates, grace periods, and merchant suspension rules are configurable by platform administrators.
- Online payment percentage fees are configured per merchant and applied only to eligible successful gateway payments.
- Refund treatment for Pikko.ph percentage fees is configurable and retained in the transaction ledger.
- Manual payments do not incur the gateway percentage fee unless a separate platform rule is introduced.

## 17. Audit and history

The platform must retain an append-only audit history for sensitive actions, including:

- Staff invitations, permission changes, and authentication changes.
- Merchant/site/court activation or suspension.
- Schedule, price, promo, policy, tax, and fee changes.
- Booking creation, state changes, cancellations, and overrides.
- Payment verification, rejection, reconciliation, and refund actions.
- Platform subscription and transaction-fee changes.
- Administrator cross-tenant access and support actions.

Audit entries include actor, tenant, action, target, timestamp, source/IP where appropriate, and before/after values for material configuration changes.

## 18. Security, privacy, and quality requirements

### 18.1 Security and privacy

- Enforce tenant isolation and role-based authorization on the server for every request.
- Require strong authentication and multi-factor authentication for platform administrators and merchant owners.
- Encrypt traffic in transit and sensitive data at rest.
- Use secure, time-limited tokens for guest booking links, staff invitations, and password recovery.
- Apply rate limiting to login, availability, booking, promo, and upload endpoints.
- Never rely on client-supplied totals, prices, availability, permissions, or payment success.
- Store only payment data required for operations and reconciliation.
- Support configurable retention and deletion of payment screenshots and personal data.
- Record consent to the applicable privacy and booking-policy versions.

### 18.2 Reliability and correctness

- Booking conflict prevention and payment webhook handling must be transactional and idempotent.
- A confirmed court/time combination must never overlap another availability-blocking booking.
- Jobs for expiry, reminders, subscription usage, and reconciliation must be retryable without duplicate outcomes.
- Backups and recovery procedures must be documented and regularly tested.

### 18.3 Performance and usability

- Public site and availability pages should be mobile-first and keyboard accessible.
- Dates and times must always be displayed in the site's local timezone.
- Availability search should normally respond within two seconds under expected MVP load, excluding third-party latency.
- Checkout must clearly show when a temporary hold expires.
- Error messages must explain the next action without exposing internal or cross-tenant data.

## 19. Core data entities

The conceptual data model includes:

- Platform user and administrator role.
- Merchant, merchant user, role, permission, and site assignment.
- Merchant subscription plan, court usage record, invoice, and fee configuration.
- Site, site media, amenity, policy, and public slug.
- Court and court media.
- Weekly schedule, schedule override, and closure/block.
- Base price, recurring price rule, special-date price rule, tax, and fee.
- Promo code and redemption.
- Customer and guest contact snapshot.
- Booking, booking line, hourly block, price snapshot, and policy acceptance.
- Checkout hold.
- Payment, payment attempt, provider event, manual payment proof, and reconciliation entry.
- Refund.
- Notification and delivery event.
- Audit event.

## 20. Key acceptance criteria

The MVP is functionally acceptable when:

1. A merchant can create two sites, create multiple courts at each, and limit staff to an assigned site.
2. A merchant can set site hours, override one court's hours, close a court temporarily, and see accurate public availability.
3. A customer can select contiguous hourly blocks, see the correct rule-based price, check out as a guest, and receive email.
4. Two simultaneous checkout attempts cannot both confirm the same court blocks.
5. The same customer can confirm bookings for different courts at overlapping times.
6. A verified successful online payment confirms the booking, while a failed or expired payment releases its hold.
7. A customer can follow site-specific manual payment instructions, upload proof, and receive approval or rejection by email.
8. A merchant can create a walk-in or complimentary booking without bypassing conflict checks.
9. Site-specific cancellation tiers calculate the expected refund from the policy snapshot accepted at checkout.
10. Pricing and policy changes do not alter existing booking snapshots.
11. Merchant reports reconcile bookings, payments, refunds, and provider transactions without treating unpaid bookings as revenue.
12. One merchant cannot access another merchant's data, files, routes, exports, or identifiers through any merchant-facing request.
13. Platform reports calculate active court subscription usage and the correct per-merchant gateway percentage fee.

## 21. Open decisions for the next requirements pass

The following decisions are still required before technical design:

1. Confirm Maya merchant onboarding, settlement, webhook authentication, refund capability, production credentials, and commercial terms.
2. Confirm whether Pikko.ph uses one Maya master merchant account with supported sub-merchant settlement or each merchant connects its own Maya Business account.
3. Decide whether the MVP accepts Maya's one-hour court hold or implements a shorter hold using Maya cancellation plus explicit late-payment race handling; also set the manual-payment reservation deadline range.
4. Decide whether the subscription is billed in advance or arrears and how court additions/removals are prorated.
5. Define subscription invoice payment methods, grace period, suspension behavior, and reinstatement.
6. Confirm whether mobile number is mandatory for guest checkout even though notifications are email-only.
7. Choose email delivery provider, sender-domain strategy, and retention period for delivery logs.
8. Set upload formats, maximum size/count, malware-scanning service, and retention period for manual payment proof.
9. Decide whether customers can reschedule in the MVP or must cancel and create a new booking.
10. Confirm legal entity, privacy retention rules, tax treatment, and final customer/merchant terms with qualified Philippine advisers.

## 22. Source note

The QR Ph distinction in this document follows Bangko Sentral ng Pilipinas materials describing QR Ph as the national QR code standard adopted by participating payment service providers for interoperable payments. The Maya integration requirements follow Maya's “Generate a Maya QRPh” documentation, including its dynamic QR creation response, one-hour validity, webhook flow, and server-side payment retrieval options. Production behavior must be validated against Maya's current API documentation and the capabilities enabled for Pikko.ph's merchant account.
