CREATE TYPE "public"."charge_status" AS ENUM('created', 'qr_uncertain', 'waiting_payment', 'paid', 'expired', 'locally_closed', 'incident');--> statement-breakpoint
CREATE TYPE "public"."payment_event_processing" AS ENUM('pending', 'applied', 'incident', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."payment_event_validation" AS ENUM('verified', 'mismatch');--> statement-breakpoint
CREATE TYPE "public"."payment_evidence_source" AS ENUM('webhook', 'provider_query');--> statement-breakpoint
CREATE TYPE "public"."payment_incident_status" AS ENUM('open', 'investigating', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."payment_incident_type" AS ENUM('amount_mismatch', 'unknown_qr', 'account_mismatch', 'reference_mismatch', 'late_payment', 'qr_creation_uncertain', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_reconciliation_status" AS ENUM('reconciled', 'incident');--> statement-breakpoint
CREATE TABLE "merchant_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"voice_announcements_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_preferences_merchant_id_key" UNIQUE("merchant_id")
);
--> statement-breakpoint
ALTER TABLE "merchant_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "merchant_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_users_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "merchant_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'America/Mexico_City' NOT NULL,
	"pey_bank_account_id" text NOT NULL,
	"receiving_account_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"status" charge_status DEFAULT 'created' NOT NULL,
	"idempotency_key" text NOT NULL,
	"paid_payment_id" uuid,
	"expires_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charges_merchant_idempotency_key" UNIQUE("merchant_id","idempotency_key"),
	CONSTRAINT "charges_amount_cents_positive" CHECK ("charges"."amount_cents" > 0),
	CONSTRAINT "charges_currency_mxn" CHECK ("charges"."currency" = 'MXN'),
	CONSTRAINT "charges_paid_requires_payment" CHECK ("charges"."status" <> 'paid' OR "charges"."paid_payment_id" IS NOT NULL),
	CONSTRAINT "charges_locally_closed_requires_closed_at" CHECK ("charges"."status" <> 'locally_closed' OR "charges"."closed_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "charges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "codi_qrs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"pey_qr_id" text NOT NULL,
	"num_ref" integer NOT NULL,
	"qr_payload" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codi_qrs_charge_id_key" UNIQUE("charge_id"),
	CONSTRAINT "codi_qrs_pey_qr_id_key" UNIQUE("pey_qr_id"),
	CONSTRAINT "codi_qrs_num_ref_max_7_digits" CHECK ("codi_qrs"."num_ref" BETWEEN 0 AND 9999999)
);
--> statement-breakpoint
ALTER TABLE "codi_qrs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'pey' NOT NULL,
	"webhook_id" text NOT NULL,
	"event_type" text NOT NULL,
	"validation_status" "payment_event_validation" NOT NULL,
	"processing_status" "payment_event_processing" DEFAULT 'pending' NOT NULL,
	"provider_transaction_id" text,
	"provider_qr_id" text,
	"codi_qr_id" uuid,
	"payment_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_events_provider_webhook_key" UNIQUE("provider","webhook_id")
);
--> statement-breakpoint
ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid,
	"payment_id" uuid,
	"payment_event_id" uuid,
	"type" "payment_incident_type" NOT NULL,
	"reason" text NOT NULL,
	"status" "payment_incident_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_incidents_has_reference" CHECK ("payment_incidents"."charge_id" IS NOT NULL OR "payment_incidents"."payment_id" IS NOT NULL OR "payment_incidents"."payment_event_id" IS NOT NULL),
	CONSTRAINT "payment_incidents_resolved_requires_resolved_at" CHECK ("payment_incidents"."status" <> 'resolved' OR "payment_incidents"."resolved_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "payment_incidents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codi_qr_id" uuid NOT NULL,
	"provider" text DEFAULT 'pey' NOT NULL,
	"provider_transaction_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"reconciliation_status" "payment_reconciliation_status" NOT NULL,
	"evidence_source" "payment_evidence_source" NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_transaction_key" UNIQUE("provider","provider_transaction_id"),
	CONSTRAINT "payments_amount_cents_positive" CHECK ("payments"."amount_cents" > 0),
	CONSTRAINT "payments_reconciled_requires_reconciled_at" CHECK ("payments"."reconciliation_status" <> 'reconciled' OR "payments"."reconciled_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "merchant_preferences" ADD CONSTRAINT "merchant_preferences_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_users" ADD CONSTRAINT "merchant_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_users" ADD CONSTRAINT "merchant_users_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_paid_payment_id_payments_id_fk" FOREIGN KEY ("paid_payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codi_qrs" ADD CONSTRAINT "codi_qrs_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_codi_qr_id_codi_qrs_id_fk" FOREIGN KEY ("codi_qr_id") REFERENCES "public"."codi_qrs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_incidents" ADD CONSTRAINT "payment_incidents_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_incidents" ADD CONSTRAINT "payment_incidents_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_incidents" ADD CONSTRAINT "payment_incidents_payment_event_id_payment_events_id_fk" FOREIGN KEY ("payment_event_id") REFERENCES "public"."payment_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_codi_qr_id_codi_qrs_id_fk" FOREIGN KEY ("codi_qr_id") REFERENCES "public"."codi_qrs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_users_merchant_id_idx" ON "merchant_users" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "charges_merchant_created_idx" ON "charges" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "charges_merchant_status_idx" ON "charges" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "charges_expires_at_idx" ON "charges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "codi_qrs_num_ref_idx" ON "codi_qrs" USING btree ("num_ref");--> statement-breakpoint
CREATE INDEX "payment_events_provider_transaction_idx" ON "payment_events" USING btree ("provider_transaction_id");--> statement-breakpoint
CREATE INDEX "payment_events_codi_qr_id_idx" ON "payment_events" USING btree ("codi_qr_id");--> statement-breakpoint
CREATE INDEX "payment_events_processing_status_idx" ON "payment_events" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "payment_incidents_charge_id_idx" ON "payment_incidents" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "payment_incidents_payment_id_idx" ON "payment_incidents" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_incidents_status_idx" ON "payment_incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_codi_qr_id_idx" ON "payments" USING btree ("codi_qr_id");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "payments_reconciliation_status_idx" ON "payments" USING btree ("reconciliation_status");