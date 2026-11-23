CREATE TABLE "counter_qrs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"status" text NOT NULL,
	"pey_qr_id" text,
	"num_ref" integer NOT NULL,
	"qr_payload" text,
	"concept" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "counter_qrs_merchant_id_key" UNIQUE("merchant_id"),
	CONSTRAINT "counter_qrs_pey_qr_id_key" UNIQUE("pey_qr_id"),
	CONSTRAINT "counter_qrs_status" CHECK ("counter_qrs"."status" in ('pending', 'ready', 'uncertain')),
	CONSTRAINT "counter_qrs_num_ref_max_7_digits" CHECK ("counter_qrs"."num_ref" BETWEEN 0 AND 9999999),
	CONSTRAINT "counter_qrs_ready_has_payload" CHECK ((
        "counter_qrs"."status" = 'ready'
        AND "counter_qrs"."pey_qr_id" IS NOT NULL
        AND "counter_qrs"."qr_payload" IS NOT NULL
      ) OR (
        "counter_qrs"."status" in ('pending', 'uncertain')
        AND "counter_qrs"."pey_qr_id" IS NULL
        AND "counter_qrs"."qr_payload" IS NULL
      ))
);
--> statement-breakpoint
ALTER TABLE "counter_qrs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "charges" DROP CONSTRAINT "charges_collection_method";--> statement-breakpoint
ALTER TABLE "charges" DROP CONSTRAINT "charges_phone_matches_method";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_one_instrument";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "counter_qr_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "charge_id" uuid;--> statement-breakpoint
ALTER TABLE "counter_qrs" ADD CONSTRAINT "counter_qrs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_counter_qr_id_counter_qrs_id_fk" FOREIGN KEY ("counter_qr_id") REFERENCES "public"."counter_qrs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_counter_qr_id_idx" ON "payments" USING btree ("counter_qr_id");--> statement-breakpoint
CREATE INDEX "payments_charge_id_idx" ON "payments" USING btree ("charge_id");--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_collection_method" CHECK ("charges"."collection_method" in ('qr', 'pn', 'link', 'counter'));--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_phone_matches_method" CHECK ((
        "charges"."collection_method" in ('qr', 'link', 'counter')
        AND "charges"."phone_hash" IS NULL
        AND "charges"."phone_last4" IS NULL
      ) OR (
        "charges"."collection_method" = 'pn'
        AND "charges"."phone_hash" ~ '^[0-9a-f]{64}$'
        AND "charges"."phone_last4" ~ '^[0-9]{4}$'
      ));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_one_instrument" CHECK ((
        "payments"."codi_qr_id" IS NOT NULL
        AND "payments"."codi_notification_id" IS NULL
        AND "payments"."payment_link_id" IS NULL
        AND "payments"."counter_qr_id" IS NULL
        AND "payments"."charge_id" IS NULL
      ) OR (
        "payments"."codi_qr_id" IS NULL
        AND "payments"."codi_notification_id" IS NOT NULL
        AND "payments"."payment_link_id" IS NULL
        AND "payments"."counter_qr_id" IS NULL
        AND "payments"."charge_id" IS NULL
      ) OR (
        "payments"."codi_qr_id" IS NULL
        AND "payments"."codi_notification_id" IS NULL
        AND "payments"."payment_link_id" IS NOT NULL
        AND "payments"."counter_qr_id" IS NULL
        AND "payments"."charge_id" IS NULL
      ) OR (
        "payments"."codi_qr_id" IS NULL
        AND "payments"."codi_notification_id" IS NULL
        AND "payments"."payment_link_id" IS NULL
        AND "payments"."counter_qr_id" IS NOT NULL
        AND "payments"."charge_id" IS NOT NULL
      ));