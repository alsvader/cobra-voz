CREATE TABLE "codi_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"pey_transaction_id" text NOT NULL,
	"codi_id" text NOT NULL,
	"num_ref" integer NOT NULL,
	"phone_last4" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codi_notifications_charge_id_key" UNIQUE("charge_id"),
	CONSTRAINT "codi_notifications_pey_transaction_id_key" UNIQUE("pey_transaction_id"),
	CONSTRAINT "codi_notifications_codi_id_key" UNIQUE("codi_id"),
	CONSTRAINT "codi_notifications_num_ref_max_7_digits" CHECK ("codi_notifications"."num_ref" BETWEEN 0 AND 9999999),
	CONSTRAINT "codi_notifications_phone_last4" CHECK ("codi_notifications"."phone_last4" ~ '^[0-9]{4}$'),
	CONSTRAINT "codi_notifications_codi_id_20_digits" CHECK ("codi_notifications"."codi_id" ~ '^[0-9]{20}$')
);
--> statement-breakpoint
ALTER TABLE "codi_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "codi_qr_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "collection_method" text DEFAULT 'qr' NOT NULL;--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "phone_hash" text;--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "phone_last4" text;--> statement-breakpoint
ALTER TABLE "payment_events" ADD COLUMN "codi_notification_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "codi_notification_id" uuid;--> statement-breakpoint
ALTER TABLE "codi_notifications" ADD CONSTRAINT "codi_notifications_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "codi_notifications_num_ref_idx" ON "codi_notifications" USING btree ("num_ref");--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_codi_notification_id_codi_notifications_id_fk" FOREIGN KEY ("codi_notification_id") REFERENCES "public"."codi_notifications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_codi_notification_id_codi_notifications_id_fk" FOREIGN KEY ("codi_notification_id") REFERENCES "public"."codi_notifications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_events_codi_notification_id_idx" ON "payment_events" USING btree ("codi_notification_id");--> statement-breakpoint
CREATE INDEX "payments_codi_notification_id_idx" ON "payments" USING btree ("codi_notification_id");--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_collection_method" CHECK ("charges"."collection_method" in ('qr', 'pn'));--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_phone_matches_method" CHECK ((
        "charges"."collection_method" = 'qr'
        AND "charges"."phone_hash" IS NULL
        AND "charges"."phone_last4" IS NULL
      ) OR (
        "charges"."collection_method" = 'pn'
        AND "charges"."phone_hash" ~ '^[0-9a-f]{64}$'
        AND "charges"."phone_last4" ~ '^[0-9]{4}$'
      ));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_one_instrument" CHECK ((
        "payments"."codi_qr_id" IS NOT NULL AND "payments"."codi_notification_id" IS NULL
      ) OR (
        "payments"."codi_qr_id" IS NULL AND "payments"."codi_notification_id" IS NOT NULL
      ));