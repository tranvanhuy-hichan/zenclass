-- Cô lập dữ liệu theo trung tâm bằng Row-Level Security (chạy lại được sau mỗi lần đổi schema).
-- Ứng dụng kết nối bằng role app_rw (không phải chủ bảng, không phải superuser) nên bắt buộc chịu chính sách này.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns WHERE column_name = 'tenantId' AND table_schema = 'public' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$CREATE POLICY tenant_isolation ON %I USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '')) WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''))$f$, t);
  END LOOP;
END $$;
REVOKE ALL ON "Tenant", "PlatformConfig" FROM app_rw;
GRANT USAGE ON SCHEMA public TO app_rw;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_rw;
REVOKE ALL ON "Tenant", "PlatformConfig" FROM app_rw;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_rw;
