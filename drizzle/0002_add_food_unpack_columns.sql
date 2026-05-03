ALTER TABLE "food" ADD COLUMN "unpacks_to_food_id" text;--> statement-breakpoint
ALTER TABLE "food" ADD COLUMN "unpack_count" integer;--> statement-breakpoint
ALTER TABLE "food" ADD CONSTRAINT "food_unpacks_to_food_id_food_id_fk" FOREIGN KEY ("unpacks_to_food_id") REFERENCES "public"."food"("id") ON DELETE set null ON UPDATE no action;