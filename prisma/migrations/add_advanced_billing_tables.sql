-- Migration: Add Advanced Billing Tables
-- Date: 2026-01-18
-- Description: Tables for credits, advanced billing, reconciliation, and disputes

-- Credits and Wallet System
CREATE TABLE IF NOT EXISTS credits (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  balance DECIMAL(10, 2) NOT NULL,
  expires_at TIMESTAMP,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'expired', 'used')),
  source VARCHAR(50) NOT NULL CHECK (source IN ('refund', 'promotion', 'manual', 'compensation')),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credits_user_id ON credits(user_id);
CREATE INDEX idx_credits_status ON credits(status);
CREATE INDEX idx_credits_expires_at ON credits(expires_at);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY,
  credit_id UUID NOT NULL REFERENCES credits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('credit', 'debit')),
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  invoice_id UUID REFERENCES invoices(id),
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_credit_id ON credit_transactions(credit_id);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at);

-- Advanced Billing
CREATE TABLE IF NOT EXISTS invoice_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  header_html TEXT NOT NULL,
  footer_html TEXT NOT NULL,
  items_template TEXT NOT NULL,
  styles TEXT NOT NULL,
  logo TEXT,
  colors JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID,
  metric_name VARCHAR(100) NOT NULL,
  quantity DECIMAL(15, 4) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX idx_usage_records_metric_name ON usage_records(metric_name);
CREATE INDEX idx_usage_records_timestamp ON usage_records(timestamp);

CREATE TABLE IF NOT EXISTS grouped_invoices (
  id UUID PRIMARY KEY,
  parent_invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  child_invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grouped_invoices_parent ON grouped_invoices(parent_invoice_id);
CREATE INDEX idx_grouped_invoices_child ON grouped_invoices(child_invoice_id);

CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'issued', 'applied')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMP
);

CREATE INDEX idx_credit_notes_invoice_id ON credit_notes(invoice_id);
CREATE INDEX idx_credit_notes_user_id ON credit_notes(user_id);
CREATE INDEX idx_credit_notes_status ON credit_notes(status);

CREATE TABLE IF NOT EXISTS exchange_rate_cache (
  base_currency VARCHAR(3) PRIMARY KEY,
  rates JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

-- Reconciliation
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY,
  account_id VARCHAR(100) NOT NULL,
  transaction_date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  description TEXT NOT NULL,
  reference VARCHAR(255),
  type VARCHAR(10) NOT NULL CHECK (type IN ('debit', 'credit')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'reconciled', 'discrepancy')),
  reconciled_at TIMESTAMP,
  matched_payment_id UUID REFERENCES payments(id),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_transactions_account_id ON bank_transactions(account_id);
CREATE INDEX idx_bank_transactions_transaction_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_status ON bank_transactions(status);

CREATE TABLE IF NOT EXISTS reconciliation_reports (
  id UUID PRIMARY KEY,
  account_id VARCHAR(100) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_bank_transactions INTEGER NOT NULL,
  total_payments INTEGER NOT NULL,
  matched_count INTEGER NOT NULL,
  unmatched_bank_transactions INTEGER NOT NULL,
  unmatched_payments INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('in_progress', 'completed', 'reviewed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_reconciliation_reports_account_id ON reconciliation_reports(account_id);
CREATE INDEX idx_reconciliation_reports_period ON reconciliation_reports(period_start, period_end);

CREATE TABLE IF NOT EXISTS discrepancies (
  id UUID PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reconciliation_reports(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('missing_payment', 'missing_bank_transaction', 'amount_mismatch', 'duplicate')),
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  payment_id UUID REFERENCES payments(id),
  expected_amount DECIMAL(10, 2),
  actual_amount DECIMAL(10, 2),
  description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'investigating', 'resolved')),
  resolved_at TIMESTAMP,
  resolution TEXT
);

CREATE INDEX idx_discrepancies_report_id ON discrepancies(report_id);
CREATE INDEX idx_discrepancies_status ON discrepancies(status);

-- Disputes and Chargebacks
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('chargeback', 'inquiry', 'fraud', 'product_issue', 'billing_error')),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('open', 'investigating', 'evidence_submitted', 'won', 'lost', 'closed')),
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('stripe', 'paypal', 'wise')),
  provider_dispute_id VARCHAR(255),
  due_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolution TEXT,
  metadata JSONB
);

CREATE INDEX idx_disputes_payment_id ON disputes(payment_id);
CREATE INDEX idx_disputes_user_id ON disputes(user_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_priority ON disputes(priority);

CREATE TABLE IF NOT EXISTS dispute_evidence (
  id UUID PRIMARY KEY,
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('invoice', 'receipt', 'communication', 'shipping', 'refund', 'other')),
  description TEXT NOT NULL,
  file_url TEXT,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  submitted_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_dispute_evidence_dispute_id ON dispute_evidence(dispute_id);

CREATE TABLE IF NOT EXISTS dispute_activities (
  id UUID PRIMARY KEY,
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  performed_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_dispute_activities_dispute_id ON dispute_activities(dispute_id);
CREATE INDEX idx_dispute_activities_created_at ON dispute_activities(created_at);

-- Add comments for documentation
COMMENT ON TABLE credits IS 'User credit/wallet system for storing promotional credits, refunds, etc.';
COMMENT ON TABLE credit_transactions IS 'Transaction history for credit debits and credits';
COMMENT ON TABLE invoice_templates IS 'Customizable invoice templates for different branding';
COMMENT ON TABLE usage_records IS 'Metered billing usage records for pay-as-you-go services';
COMMENT ON TABLE credit_notes IS 'Credit notes for invoice adjustments and refunds';
COMMENT ON TABLE bank_transactions IS 'Imported bank transactions for reconciliation';
COMMENT ON TABLE reconciliation_reports IS 'Bank reconciliation reports';
COMMENT ON TABLE discrepancies IS 'Discrepancies found during reconciliation';
COMMENT ON TABLE disputes IS 'Payment disputes and chargebacks';
COMMENT ON TABLE dispute_evidence IS 'Evidence submitted for dispute resolution';
COMMENT ON TABLE dispute_activities IS 'Activity log for dispute management';
