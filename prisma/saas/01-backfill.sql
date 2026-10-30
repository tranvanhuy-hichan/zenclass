-- Chuyển dữ liệu một-trung-tâm hiện có thành "trung tâm đầu tiên" (idempotent).
INSERT INTO "Tenant" (id, slug, name, plan, status, "maxStudents", "maxBranches")
SELECT 'tenant_first', 'saomai', COALESCE((SELECT value->>'name' FROM "Setting" WHERE key = 'center' LIMIT 1), 'Trung tâm đầu tiên'), 'ENTERPRISE', 'ACTIVE', 100000, 100
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" WHERE slug = 'saomai');

DO $$
DECLARE t text; tid text;
BEGIN
  SELECT id INTO tid FROM "Tenant" WHERE slug = 'saomai';
  FOR t IN SELECT table_name FROM information_schema.columns WHERE column_name = 'tenantId' AND table_schema = 'public' LOOP
    EXECUTE format('UPDATE %I SET "tenantId" = %L WHERE "tenantId" IS NULL', t, tid);
    IF t <> 'User' THEN EXECUTE format('ALTER TABLE %I ALTER COLUMN "tenantId" SET NOT NULL', t); END IF;
  END LOOP;
END $$;
