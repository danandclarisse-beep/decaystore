-- [P2-3] Rename Stripe-named fields to billing-neutral names.
-- These columns store LemonSqueezy IDs since the billing migration.
ALTER TABLE "users" RENAME COLUMN "stripe_customer_id" TO "billing_customer_id";
ALTER TABLE "users" RENAME COLUMN "stripe_subscription_id" TO "billing_subscription_id";