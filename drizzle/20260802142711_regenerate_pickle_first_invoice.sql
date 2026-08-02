WITH invoice_repair AS (
  SELECT
    invoice.id AS invoice_id,
    invoice.merchant_id,
    invoice.invoice_number,
    invoice.court_count AS previous_court_count,
    invoice.total_cents AS previous_total_cents,
    merchant.monthly_court_price_cents,
    count(court.id)::integer AS active_court_count
  FROM subscription_invoices AS invoice
  INNER JOIN merchants AS merchant ON merchant.id = invoice.merchant_id
  LEFT JOIN courts AS court
    ON court.merchant_id = merchant.id
   AND court.status = 'active'
  WHERE lower(merchant.display_name) = lower('Pickle First')
    AND invoice.court_count = 0
    AND invoice.total_cents = 0
    AND invoice.status IN ('draft', 'issued', 'past_due')
  GROUP BY invoice.id, merchant.monthly_court_price_cents
  HAVING count(court.id) > 0
), updated_invoice AS (
  UPDATE subscription_invoices AS invoice
  SET
    court_count = repair.active_court_count,
    subtotal_cents = repair.active_court_count * repair.monthly_court_price_cents,
    total_cents = (repair.active_court_count * repair.monthly_court_price_cents) + invoice.tax_cents,
    updated_at = now()
  FROM invoice_repair AS repair
  WHERE invoice.id = repair.invoice_id
  RETURNING
    invoice.id,
    invoice.merchant_id,
    invoice.invoice_number,
    repair.previous_court_count,
    repair.previous_total_cents,
    invoice.court_count,
    invoice.total_cents
)
INSERT INTO audit_events (
  merchant_id,
  action,
  target_type,
  target_id,
  before,
  after,
  metadata
)
SELECT
  merchant_id,
  'platform.subscription.invoice_regenerated',
  'subscription_invoice',
  id,
  jsonb_build_object(
    'courtCount', previous_court_count,
    'totalCents', previous_total_cents
  ),
  jsonb_build_object(
    'courtCount', court_count,
    'totalCents', total_cents
  ),
  jsonb_build_object(
    'invoiceNumber', invoice_number,
    'reason', 'Corrected merchant court-count correlation bug'
  )
FROM updated_invoice;
