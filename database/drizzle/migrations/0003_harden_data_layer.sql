-- updated_at where missing
ALTER TABLE public.forum_comments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS resolved_by uuid;
ALTER TABLE public.fire_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS touch_news ON public.news;
CREATE TRIGGER touch_news BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_forum_posts ON public.forum_posts;
CREATE TRIGGER touch_forum_posts BEFORE UPDATE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_profiles ON public.profiles;
CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_fire_reports ON public.fire_reports;
CREATE TRIGGER touch_fire_reports BEFORE UPDATE ON public.fire_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.content_report_resolution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.resolved AND NOT OLD.resolved THEN NEW.resolved_at := now(); NEW.resolved_by := auth.uid();
  ELSIF NOT NEW.resolved THEN NEW.resolved_at := NULL; NEW.resolved_by := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS content_reports_resolution ON public.content_reports;
CREATE TRIGGER content_reports_resolution BEFORE UPDATE ON public.content_reports FOR EACH ROW EXECUTE FUNCTION public.content_report_resolution();

CREATE OR REPLACE FUNCTION public.fire_report_resolution()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('resolved','false_report') AND OLD.status NOT IN ('resolved','false_report') THEN NEW.resolved_at := now();
  ELSIF NEW.status NOT IN ('resolved','false_report') THEN NEW.resolved_at := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fire_reports_resolution ON public.fire_reports;
CREATE TRIGGER fire_reports_resolution BEFORE UPDATE ON public.fire_reports FOR EACH ROW EXECUTE FUNCTION public.fire_report_resolution();

-- Audit log (separate from operational data)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  actor_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit staff read" ON public.audit_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log(created_at DESC);

CREATE OR REPLACE FUNCTION public.write_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log(table_name, record_id, action, actor_id, old_data, new_data)
  VALUES (TG_TABLE_NAME,
    COALESCE((CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END)),
    TG_OP, auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['fire_reports','news','forum_posts','forum_comments','content_reports','user_roles'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.write_audit()', t);
  END LOOP; END $$;
DROP TRIGGER IF EXISTS audit_profiles_block ON public.profiles;
CREATE TRIGGER audit_profiles_block AFTER UPDATE OF blocked ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- Validation (immutable checks only)
ALTER TABLE public.fire_reports ADD CONSTRAINT fire_reports_coords_chk CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180) NOT VALID;
ALTER TABLE public.fire_reports ADD CONSTRAINT fire_reports_desc_len CHECK (description IS NULL OR char_length(description) <= 5000) NOT VALID;
ALTER TABLE public.forum_posts ADD CONSTRAINT forum_posts_len CHECK (char_length(title) BETWEEN 1 AND 300 AND char_length(content) <= 20000) NOT VALID;
ALTER TABLE public.forum_comments ADD CONSTRAINT forum_comments_len CHECK (char_length(content) BETWEEN 1 AND 5000) NOT VALID;
ALTER TABLE public.messages ADD CONSTRAINT messages_len CHECK (char_length(content) BETWEEN 1 AND 5000) NOT VALID;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_details_len CHECK (details IS NULL OR char_length(details) <= 2000) NOT VALID;
ALTER TABLE public.forum_likes ADD CONSTRAINT forum_likes_one_target CHECK ((post_id IS NULL) <> (comment_id IS NULL)) NOT VALID;

-- Prevent duplicate open reports for same content
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_reports_open ON public.content_reports(reporter_id, target_type, target_id) WHERE NOT resolved;

-- Indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_fr_user ON public.fire_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_fc_parent ON public.forum_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_fc_user ON public.forum_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_fp_user ON public.forum_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_cr_open ON public.content_reports(resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_published ON public.news(published, created_at DESC);