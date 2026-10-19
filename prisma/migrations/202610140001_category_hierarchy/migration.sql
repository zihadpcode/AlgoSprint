-- Category groups: a nullable self-reference (one level only) plus a display position.
-- Existing rows stay valid: parentId NULL means top level, which is what every current category is.
ALTER TABLE "app"."Category" ADD COLUMN "parentId" UUID;
ALTER TABLE "app"."Category" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Category_parentId_idx" ON "app"."Category"("parentId");

-- A group cannot be deleted while it still has children.
ALTER TABLE "app"."Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "app"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "app"."Category" ADD CONSTRAINT "Category_not_own_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id");
ALTER TABLE "app"."Category" ADD CONSTRAINT "Category_position_check" CHECK ("position" >= 0);

-- Nesting is at most one level: a group has no parent, and a child's parent has no parent. A CHECK cannot look at
-- other rows, so a trigger enforces it on both sides (a child cannot point at a child; a group with children cannot
-- become a child). An advisory transaction lock serialises hierarchy changes so two concurrent writers cannot each
-- pass the check and together create a second level. Category writes are rare (seeding and admin), so this is cheap.
CREATE FUNCTION "app"."category_enforce_one_level"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW."parentId" IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('app.Category.hierarchy'));
  IF EXISTS (SELECT 1 FROM "app"."Category" WHERE "id" = NEW."parentId" AND "parentId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Category % cannot be nested under %: the parent is itself a child (one level only).', NEW."id", NEW."parentId"
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM "app"."Category" WHERE "parentId" = NEW."id") THEN
    RAISE EXCEPTION 'Category % cannot become a child: it already has children (one level only).', NEW."id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Category_one_level_trigger"
  BEFORE INSERT OR UPDATE OF "parentId" ON "app"."Category"
  FOR EACH ROW EXECUTE FUNCTION "app"."category_enforce_one_level"();

-- Row level security is already enabled on this table by the foundation migration and its privileges are unchanged;
-- the new columns inherit both. Re-asserting is harmless and keeps this migration self-evidently safe.
ALTER TABLE "app"."Category" ENABLE ROW LEVEL SECURITY;
