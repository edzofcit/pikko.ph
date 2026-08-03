import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms governing customer bookings and merchant use of the Pikko.ph platform.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Platform terms"
      title="Terms & Conditions"
      summary="These terms govern access to Pikko.ph by players, guests, merchant partners, and their authorized staff. They explain Pikko’s role as the booking platform and the venue merchant’s role as the provider of the court and related services."
      updated="August 3, 2026"
    >
      <div className="mb-8 rounded-2xl border border-[var(--forest)]/15 bg-[var(--cream)] p-5 text-sm leading-6 text-[var(--forest)]">
        <strong>Important booking notice:</strong> Your booking is fulfilled by the venue merchant. Cancellations, rescheduling, no-shows, venue conditions, and refund requests should first be addressed directly with that merchant under the policy shown during booking.
      </div>

      <LegalSection id="acceptance" title="1. Acceptance and eligibility">
        <p>By creating an account, starting a merchant trial, making a booking, or otherwise using Pikko.ph, you agree to these Terms and our <Link href="/privacy" className="font-bold text-[var(--forest)] underline underline-offset-4">Privacy Policy</Link>. If you use Pikko for a business or another person, you confirm that you have authority to bind that business or person.</p>
        <p>You must be legally capable of entering into a contract. A minor may use the service only with the participation and consent of a parent or legal guardian, who is responsible for the booking and venue participation.</p>
      </LegalSection>

      <LegalSection id="platform-role" title="2. Pikko’s role as a platform">
        <p>Pikko.ph provides technology for discovering venues, viewing court availability, creating bookings, communicating booking status, submitting payment information, and helping merchants operate their schedules. Unless expressly stated otherwise, Pikko does not own or operate the listed venues and is not the provider of the court, coaching, equipment, food, parking, or other on-site service.</p>
        <p>The booking for a court is an agreement between the customer and the merchant identified on the venue page and booking confirmation. Each merchant is responsible for the accuracy of its listing, operating hours, prices, policies, licenses, taxes, personnel, facilities, safety, and delivery of the booked service. Pikko may moderate listings, facilitate communication, and assist with platform issues, but does not guarantee a merchant’s performance.</p>
      </LegalSection>

      <LegalSection id="accounts" title="3. Accounts and guest bookings">
        <p>Customers may book as a guest where enabled, but must provide accurate contact information so confirmations and status updates can be delivered. Registered users and merchant staff must protect their credentials and promptly report suspected unauthorized access.</p>
        <p>Private guest-booking links function as access credentials. Anyone with the link may be able to view or manage the associated booking, so the recipient must keep it confidential. You are responsible for activity performed through your account or private link unless caused by Pikko’s failure to apply reasonable security measures.</p>
      </LegalSection>

      <LegalSection id="bookings" title="4. Availability, prices, and booking confirmation">
        <p>Displayed availability is based on merchant schedules, existing bookings, temporary holds, maintenance blocks, and platform data. A selected slot is not guaranteed until the booking reaches the confirmation state described at checkout. Unpaid or unverified requests may expire, and temporary holds may be released automatically.</p>
        <p>Prices, taxes, service charges, promo conditions, payment deadlines, and the applicable venue policy are shown before confirmation where available. Merchants control their court rates and venue charges. Pikko may charge platform or payment-processing fees when clearly disclosed and permitted by law.</p>
      </LegalSection>

      <LegalSection id="payments" title="5. Payments and payment proof">
        <p>Bookings may support merchant-configured manual payments or an approved online payment gateway. Online payments are processed by the identified payment provider under its own terms and privacy practices. Pikko does not store full card, bank-account, or wallet credentials.</p>
        <p>For manual payments, customers must follow the merchant’s instructions and submit authentic proof before the deadline. Uploading altered, misleading, or unrelated payment evidence is prohibited. A manual booking may remain pending until the merchant verifies it, and the court may remain available to others when the venue uses a reserve-after-verification policy.</p>
      </LegalSection>

      <LegalSection id="cancellations" title="6. Cancellations, rescheduling, refunds, and no-shows">
        <p><strong className="text-[var(--forest)]">Requests must first be coursed through the venue merchant.</strong> The merchant sets and administers the cancellation deadline, rescheduling rules, refund percentage, late-cancellation treatment, and no-show policy for its site. The policy presented during booking and any mandatory consumer protections apply.</p>
        <p>Customers should use the private booking page or the venue contact details to submit a request. The merchant determines eligibility and authorizes any refund. For gateway payments, Pikko or the payment provider may technically transmit an approved refund, but processing time depends on the merchant, provider, and receiving bank or wallet.</p>
        <p>If a merchant is unresponsive, a transaction was duplicated, or a platform or gateway error occurred, the customer may ask Pikko for assistance. Pikko may request evidence, relay communications, correct platform records, or take other reasonable steps, but does not replace the merchant as the first decision-maker for ordinary venue cancellations. Nothing in these Terms limits rights or remedies that cannot lawfully be waived.</p>
      </LegalSection>

      <LegalSection id="venue-use" title="7. Venue participation and conduct">
        <p>Players must follow venue rules, staff directions, safety requirements, capacity limits, dress rules, and equipment restrictions. Sports and physical activity involve inherent risk. Customers are responsible for assessing their fitness to participate and for supervising minors or guests included in their booking.</p>
        <p>You may not misuse the platform, interfere with availability, make fraudulent reservations, scrape or probe the service, upload malicious material, impersonate another person, harass users or staff, or use Pikko in violation of law.</p>
      </LegalSection>

      <LegalSection id="merchant-terms" title="8. Merchant partner responsibilities">
        <p>Merchants must provide accurate business, contact, venue, court, pricing, policy, and payment information; honor confirmed bookings; keep schedules current; protect customer information; and comply with registration, tax, consumer-protection, accessibility, safety, and other requirements applicable to their operations.</p>
        <p>Merchant users must have authority to act for the business. Merchants are responsible for staff permissions, payment verification, customer service, cancellations, refunds, chargeback evidence, and keeping manual-payment instructions secure and current. Online-payment access may require platform approval and may be suspended for risk, compliance, or operational reasons.</p>
      </LegalSection>

      <LegalSection id="subscriptions" title="9. Merchant trials, subscriptions, and fees">
        <p>Unless a different offer is shown, a new merchant receives a 14-day trial. At the end of the trial, the account may move to a paid subscription based on the active-court monthly rate configured for that merchant. Pikko may also apply a disclosed percentage fee to gateway payments. Applicable rates, invoices, and status are available in the administrative records of the platform.</p>
        <p>Failure to pay a due subscription invoice may result in restricted features, suspension, or removal from public listings after reasonable notice. Trial eligibility may be limited to one trial per business or related operator.</p>
      </LegalSection>

      <LegalSection id="content" title="10. Content and intellectual property">
        <p>Users and merchants retain ownership of content they upload. They grant Pikko a non-exclusive, worldwide, royalty-free license to host, reproduce, resize, display, and transmit that content as needed to operate, secure, promote, and improve the platform. The uploader confirms it has the necessary rights and permissions.</p>
        <p>Pikko’s software, branding, interface, and original materials are protected by applicable intellectual-property laws. These Terms do not transfer ownership or permit copying, reverse engineering, or commercial reuse beyond normal platform use.</p>
      </LegalSection>

      <LegalSection id="availability" title="11. Service availability and disclaimers">
        <p>Pikko works to keep information accurate and the platform available, but services may occasionally be interrupted, delayed, or affected by merchants, payment providers, communications networks, maintenance, or events beyond reasonable control. The platform is provided on an “as available” basis to the extent permitted by law.</p>
        <p>Pikko does not warrant the condition, safety, suitability, legality, or availability of a merchant’s venue or the conduct of venue personnel and other players. Statutory warranties and consumer rights that cannot be excluded remain unaffected.</p>
      </LegalSection>

      <LegalSection id="liability" title="12. Responsibility and limitation of liability">
        <p>Each party remains responsible for its own acts and omissions. To the fullest extent permitted by law, Pikko is not responsible for indirect, incidental, special, or consequential loss; a merchant’s cancellation or failure to provide a venue service; injury or property loss at a venue; or loss caused by information, instructions, or conduct supplied by a merchant or user.</p>
        <p>Nothing in these Terms excludes liability for fraud, willful misconduct, gross negligence, violation of data-protection obligations, or any liability or consumer remedy that cannot lawfully be excluded or limited.</p>
      </LegalSection>

      <LegalSection id="enforcement" title="13. Suspension, termination, and changes">
        <p>Pikko may restrict or terminate access, remove content, release abusive holds, or suspend a merchant listing when reasonably necessary for security, fraud prevention, legal compliance, nonpayment, repeated policy violations, or protection of users. Where practical, affected users will receive notice and an opportunity to address the issue.</p>
        <p>We may update these Terms as the service or law changes. Material changes will be communicated through the platform or registered contact information. Continued use after the effective date constitutes acceptance where permitted by law.</p>
      </LegalSection>

      <LegalSection id="law-contact" title="14. Governing law, concerns, and contact">
        <p>These Terms are governed by the laws of the Republic of the Philippines, without limiting mandatory consumer rights. Before starting formal proceedings, users should first contact the merchant for venue-service concerns and allow a reasonable opportunity to resolve them. Platform, privacy, or unresolved marketplace concerns may then be raised with Pikko.</p>
        <p>Questions about these Terms may be sent to <a href="mailto:support@pikko.ph" className="font-bold text-[var(--forest)] underline underline-offset-4">support@pikko.ph</a>. Privacy requests should follow the process in our <Link href="/privacy" className="font-bold text-[var(--forest)] underline underline-offset-4">Privacy Policy</Link>.</p>
      </LegalSection>
    </LegalDocument>
  );
}
