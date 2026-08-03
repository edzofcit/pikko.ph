import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Pikko.ph collects, uses, shares, retains, and protects personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Privacy notice"
      title="Privacy Policy"
      summary="This notice explains how Pikko.ph handles personal data when customers discover and book courts, merchants operate their venues, and administrators manage the platform."
      updated="August 3, 2026"
    >
      <LegalSection id="scope" title="1. Scope and privacy roles">
        <p>This Policy applies to Pikko.ph websites, booking pages, customer and merchant accounts, administrative tools, emails, and related support interactions. It should be read with our <Link href="/terms" className="font-bold text-[var(--forest)] underline underline-offset-4">Terms & Conditions</Link>.</p>
        <p>Pikko controls personal data needed to operate accounts, secure and improve the platform, administer merchant subscriptions, and maintain marketplace and transaction records. A venue merchant separately controls customer information it uses to provide the court, verify manual payments, communicate about bookings, administer venue policies, and meet its legal obligations. Depending on the activity, Pikko may also process booking data for or with that merchant.</p>
      </LegalSection>

      <LegalSection id="data-collected" title="2. Personal data we collect">
        <p>Depending on how you use Pikko, we may collect:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Identity and contact data:</strong> name, email address, mobile number, account identifiers, verification status, and authentication information.</li>
          <li><strong>Booking data:</strong> merchant, site, court, dates, hour blocks, prices, booking status, guest-booking token records, notes, cancellation information, and booking history.</li>
          <li><strong>Payment data:</strong> payment method, amount, status, gateway reference, timestamps, fees, refund or reconciliation records, and manual-payment screenshots. Payment providers handle full payment credentials.</li>
          <li><strong>Merchant and staff data:</strong> business identity, contact details, addresses, venue coordinates, sites, courts, rates, operating rules, subscription records, staff roles, and uploaded business media.</li>
          <li><strong>Technical and usage data:</strong> IP address, browser and device information, security and access logs, session cookies, error records, pages and actions used, and approximate or device location only when requested and permitted.</li>
          <li><strong>Communications:</strong> support messages, dispute information, policy requests, and email delivery records.</li>
        </ul>
        <p>Please avoid including unrelated financial, identification, health, or other sensitive information in notes or payment screenshots. Where possible, obscure details that the merchant does not need to verify the transfer.</p>
      </LegalSection>

      <LegalSection id="sources" title="3. Sources of data">
        <p>We collect data directly from customers, guests, merchants, and staff; automatically from devices and platform activity; from payment, authentication, email, hosting, storage, and security providers; and from another authorized user who creates a booking or merchant record on your behalf.</p>
      </LegalSection>

      <LegalSection id="purposes" title="4. Why we process personal data">
        <p>We process personal data to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>create and secure accounts, authenticate users, and manage roles;</li>
          <li>display availability, create bookings, reserve courts, verify payments, and send confirmations or operational notices;</li>
          <li>share booking details with the responsible venue merchant and support cancellations, refunds, reconciliation, and disputes;</li>
          <li>operate merchant trials, subscriptions, invoices, gateway entitlements, reporting, and customer records;</li>
          <li>prevent fraud, abuse, double bookings, unauthorized access, and security incidents;</li>
          <li>diagnose errors, maintain the platform, analyze aggregate performance, and improve features;</li>
          <li>comply with legal, accounting, tax, regulatory, and lawful government requirements; and</li>
          <li>send marketing only when permitted, with a way to opt out.</li>
        </ul>
      </LegalSection>

      <LegalSection id="basis" title="5. Basis for processing">
        <p>We process data when necessary to provide a requested booking or platform service and perform a contract; to comply with legal obligations; for legitimate interests such as platform security, fraud prevention, service improvement, and business administration when those interests do not override individual rights; and with consent where consent is required. Consent may be withdrawn without affecting processing already lawfully completed.</p>
      </LegalSection>

      <LegalSection id="sharing" title="6. How personal data is shared">
        <p>We may share relevant information with:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Venue merchants and authorized staff</strong> so they can fulfill bookings, verify payments, contact customers, and apply venue policies.</li>
          <li><strong>Service providers</strong> supporting hosting, databases, authentication, file and image storage, email, maps, analytics, security, and technical operations.</li>
          <li><strong>Payment providers and financial partners</strong> to create QR payments, confirm status, prevent fraud, reconcile transactions, and process authorized refunds.</li>
          <li><strong>Professional advisers, regulators, courts, and authorities</strong> when reasonably necessary to protect rights, comply with law, or respond to valid legal process.</li>
          <li><strong>A successor or transaction participant</strong> in a merger, financing, reorganization, or transfer of the platform, subject to appropriate confidentiality and legal safeguards.</li>
        </ul>
        <p>We do not sell personal data as a standalone product. Merchants may not use booking data for unrelated marketing without an appropriate lawful basis.</p>
      </LegalSection>

      <LegalSection id="transfers" title="7. Storage and cross-border processing">
        <p>Pikko and its providers may process data in the Philippines and other locations where they maintain infrastructure or support operations. When data is transferred or remotely accessed across borders, we require appropriate contractual, organizational, and technical safeguards consistent with applicable data-protection requirements.</p>
      </LegalSection>

      <LegalSection id="retention" title="8. Retention and deletion">
        <p>We retain personal data only as long as reasonably necessary for the purposes described above, including active accounts, booking fulfillment, transaction reconciliation, merchant administration, security, dispute handling, and legal, tax, and accounting requirements. Different records have different retention periods.</p>
        <p>Booking and payment records may be kept after a booking for legitimate recordkeeping and dispute purposes. Manual-payment screenshots should be removed or restricted when they are no longer necessary for verification, disputes, or compliance. Data may be retained longer when required by law, legal hold, fraud prevention, or a pending claim. Aggregated or de-identified information may be retained where it no longer identifies an individual.</p>
      </LegalSection>

      <LegalSection id="security" title="9. Security and account protection">
        <p>We use reasonable organizational, physical, and technical measures designed to protect data, including access controls, tenant separation, encrypted connections, protected secrets, audit records, and service-provider safeguards. No internet service can guarantee absolute security.</p>
        <p>Users must protect passwords and private booking links. If you suspect unauthorized access or an exposed payment screenshot, contact Pikko and the relevant merchant promptly.</p>
      </LegalSection>

      <LegalSection id="cookies" title="10. Cookies and similar technology">
        <p>Pikko uses cookies and comparable browser storage necessary for login sessions, security, preferences, and reliable platform operation. We may use limited measurement tools to understand performance and feature use. Where required, optional tracking will be subject to notice and consent controls.</p>
      </LegalSection>

      <LegalSection id="rights" title="11. Your privacy rights">
        <p>Subject to the Data Privacy Act of 2012 and applicable limitations, you may have rights to be informed, access personal data, object to or withdraw consent for certain processing, correct inaccurate data, request erasure or blocking, obtain portable data where applicable, claim damages, and file a complaint with the National Privacy Commission.</p>
        <p>We may need to verify your identity and clarify the data or processing involved before acting. Some records cannot be immediately deleted when retention is required for a booking contract, legal obligation, security investigation, accounting record, or legal claim. For merchant-controlled booking data, we may direct or transmit the request to the responsible venue merchant.</p>
      </LegalSection>

      <LegalSection id="children" title="12. Children’s privacy">
        <p>Pikko is not directed to children acting independently. A booking for a minor should be created and supervised by a parent or legal guardian. If we learn that a child’s data was submitted without appropriate authority, we will take reasonable steps to review and delete or restrict it, subject to legal and safety requirements.</p>
      </LegalSection>

      <LegalSection id="changes" title="13. Policy changes">
        <p>We may update this Policy to reflect platform, provider, or legal changes. The revised version will show a new last-updated date. Material changes may also be communicated through the platform or registered contact information.</p>
      </LegalSection>

      <LegalSection id="contact" title="14. Contact and complaints">
        <p>For privacy questions or requests, email <a href="mailto:privacy@pikko.ph" className="font-bold text-[var(--forest)] underline underline-offset-4">privacy@pikko.ph</a> with enough detail to identify the account, booking, or merchant record involved. Venue-service and cancellation matters should first be sent to the merchant shown on the booking page.</p>
        <p>If a privacy concern is not resolved, you may lodge a complaint with the Philippine National Privacy Commission. Platform-support questions may be sent to <a href="mailto:support@pikko.ph" className="font-bold text-[var(--forest)] underline underline-offset-4">support@pikko.ph</a>.</p>
      </LegalSection>
    </LegalDocument>
  );
}
