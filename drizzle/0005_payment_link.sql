CREATE TABLE "payment_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"pey_payment_link_id" text NOT NULL,
	"url" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_links_charge_id_key" UNIQUE("charge_id"),
	CONSTRAINT "payment_links_pey_payment_link_id_key" UNIQUE("pey_payment_link_id"),
	CONSTRAINT "payment_links_url_https" CHECK ("payment_links"."url" ~ '^https://')
);
--> statement-breakpoint
ALTER TABLE "payment_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "charges" DROP CONSTRAINT "charges_collection_method";--> statement-breakpoint
ALTER TABLE "charges" DROP CONSTRAINT "charges_phone_matches_method";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_one_instrument";--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "creation_result" text;--> statement-breakpoint
ALTER TABLE "payment_events" ADD COLUMN "payment_link_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_link_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_link_id_payment_links_id_fk" FOREIGN KEY ("payment_link_id") REFERENCES "public"."payment_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_link_id_payment_links_id_fk" FOREIGN KEY ("payment_link_id") REFERENCES "public"."payment_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_events_payment_link_id_idx" ON "payment_events" USING btree ("payment_link_id");--> statement-breakpoint
CREATE INDEX "payments_payment_link_id_idx" ON "payments" USING btree ("payment_link_id");--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_creation_result" CHECK ("charges"."creation_result" IS NULL OR "charges"."creation_result" in ('uncertain', 'rejected'));--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_collection_method" CHECK ("charges"."collection_method" in ('qr', 'pn', 'link'));--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_phone_matches_method" CHECK ((
        "charges"."collection_method" in ('qr', 'link')
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
      ) OR (
        "payments"."codi_qr_id" IS NULL
        AND "payments"."codi_notification_id" IS NOT NULL
        AND "payments"."payment_link_id" IS NULL
      ) OR (
        "payments"."codi_qr_id" IS NULL
        AND "payments"."codi_notification_id" IS NULL
        AND "payments"."payment_link_id" IS NOT NULL
      ));