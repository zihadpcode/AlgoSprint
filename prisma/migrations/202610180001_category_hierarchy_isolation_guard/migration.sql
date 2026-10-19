-- Follow-up to 202610140001_category_hierarchy: reject stale-snapshot validation and serialize ID changes too.
--
-- The trigger takes an advisory lock and then re-checks the hierarchy. That is only sound if the checks see what the
-- previous lock holder committed. Under READ COMMITTED every query inside the trigger gets a fresh snapshot after the
-- lock is acquired, so it does. Under REPEATABLE READ or SERIALIZABLE the transaction keeps the snapshot it took before
-- it waited, so it would validate against stale rows and two concurrent nestings could together create a second level.
-- The trigger therefore raises invalid_transaction_state for non-NULL parent writes or ID changes in those modes. This is not a retryable
-- conflict: it fires every time, without any concurrent writer, so the caller must use READ COMMITTED (the default,
-- which seedCategoryGroups explicitly requests). An ID change also participates: a renamed parent must not appear between another
-- writer's hierarchy check and its FK check without taking the same lock. Metadata-only writes are unaffected.
CREATE OR REPLACE FUNCTION "app"."category_enforce_one_level"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  id_changed boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    id_changed := NEW."id" IS DISTINCT FROM OLD."id";
  END IF;
  IF NEW."parentId" IS NULL AND NOT id_changed THEN
    RETURN NEW;
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Category hierarchy changes require READ COMMITTED isolation (this transaction uses %).', current_setting('transaction_isolation')
      USING ERRCODE = 'invalid_transaction_state';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('app.Category.hierarchy'));
  IF NEW."parentId" IS NULL THEN
    RETURN NEW;
  END IF;
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

-- ID updates can make a previously invisible parent visible to the later foreign-key check.
CREATE OR REPLACE TRIGGER "Category_one_level_trigger"
  BEFORE INSERT OR UPDATE OF "parentId", "id" ON "app"."Category"
  FOR EACH ROW EXECUTE FUNCTION "app"."category_enforce_one_level"();
