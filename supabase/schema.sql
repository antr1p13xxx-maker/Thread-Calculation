-- ============================================================================
-- THREAD CALCULATION — SUPABASE DATABASE SCHEMA (PostgreSQL)
-- Project: Thread Calculation (zfxzrhqiiojhojvlxqsj)
-- ============================================================================

-- 1. Tabel Utama Workspace & Lembar Kerja Proyek
CREATE TABLE IF NOT EXISTS public.thread_workspaces (
  id TEXT PRIMARY KEY DEFAULT 'default',
  project_name TEXT NOT NULL DEFAULT 'Spindel & Mur Ulir Trapesium Workshop Utama',
  prepared_by TEXT NOT NULL DEFAULT 'Tim Rekayasa Mekanik & QC',
  project_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_measured_wire_m JSONB NOT NULL DEFAULT '{}'::jsonb,
  wire_check_preset TEXT NOT NULL DEFAULT 'mixed_qc',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Relasional Baris Kalkulasi Ulir Proyek
CREATE TABLE IF NOT EXISTS public.thread_project_rows (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default'
    REFERENCES public.thread_workspaces(id) ON DELETE CASCADE,
  thread_type TEXT NOT NULL DEFAULT 'TR',
  designation TEXT NOT NULL,
  series SMALLINT NOT NULL DEFAULT 1,
  thread_angle_deg NUMERIC(6,2) NOT NULL DEFAULT 30,
  flank_half_angle_deg NUMERIC(6,2) NOT NULL DEFAULT 15,
  d NUMERIC(10,3) NOT NULL,
  p NUMERIC(10,4) NOT NULL,
  tpi NUMERIC(10,3),
  starts INT NOT NULL DEFAULT 1,
  ph NUMERIC(10,3) NOT NULL,
  d2 NUMERIC(10,3) NOT NULL,
  d3 NUMERIC(10,3) NOT NULL,
  d1_nut NUMERIC(10,3) NOT NULL,
  d4_nut NUMERIC(10,3) NOT NULL,
  h1 NUMERIC(10,3) NOT NULL,
  h3 NUMERIC(10,3) NOT NULL,
  ac NUMERIC(10,3) NOT NULL,
  ext_tol_class TEXT NOT NULL DEFAULT '7e',
  int_tol_class TEXT NOT NULL DEFAULT '7H',
  d2_min NUMERIC(10,3) NOT NULL,
  d2_max NUMERIC(10,3) NOT NULL,
  d2_min_7e NUMERIC(10,3) NOT NULL,
  d2_max_7e NUMERIC(10,3) NOT NULL,
  best_wire_size NUMERIC(10,3) NOT NULL,
  measure_over_wires NUMERIC(10,3) NOT NULL,
  wire_m_min_7e NUMERIC(10,3) NOT NULL,
  wire_m_max_7e NUMERIC(10,3) NOT NULL,
  core_area_mm2 NUMERIC(12,2) NOT NULL,
  max_static_load_c45_kn NUMERIC(12,2) NOT NULL,
  max_static_load_bronze_kn NUMERIC(12,2) NOT NULL,
  material_grade TEXT NOT NULL DEFAULT 'C45',
  applied_load_kn NUMERIC(12,2) NOT NULL DEFAULT 0,
  safety_factor NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_load_safe BOOLEAN NOT NULL DEFAULT TRUE,
  friction_mu NUMERIC(6,3) NOT NULL DEFAULT 0.15,
  tightening_torque_nm NUMERIC(12,2) NOT NULL DEFAULT 0,
  length_mm NUMERIC(10,2) NOT NULL DEFAULT 500,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabel Log Pemeriksaan Batas Toleransi 3-Kawat (QC Go/No-Go 7e/7H)
CREATE TABLE IF NOT EXISTS public.thread_wire_inspections (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default'
    REFERENCES public.thread_workspaces(id) ON DELETE CASCADE,
  row_id TEXT NOT NULL,
  designation TEXT NOT NULL,
  best_wire_size_mm NUMERIC(10,3) NOT NULL,
  measured_wire_m_mm NUMERIC(10,3) NOT NULL,
  wire_m_min_7e_mm NUMERIC(10,3) NOT NULL,
  wire_m_max_7e_mm NUMERIC(10,3) NOT NULL,
  inferred_d2_mm NUMERIC(10,3) NOT NULL,
  qc_status TEXT NOT NULL CHECK (qc_status IN ('GO', 'NO_GO_UNDERSIZE', 'NO_GO_OVERSIZE')),
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Trigger Otomatis untuk Memperbarui Kolom updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_thread_workspaces_updated_at ON public.thread_workspaces;
CREATE TRIGGER trg_thread_workspaces_updated_at
BEFORE UPDATE ON public.thread_workspaces
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_thread_project_rows_updated_at ON public.thread_project_rows;
CREATE TRIGGER trg_thread_project_rows_updated_at
BEFORE UPDATE ON public.thread_project_rows
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 5. Row Level Security (RLS) & Policies untuk Supabase REST API
ALTER TABLE public.thread_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_project_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_wire_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to thread_workspaces" ON public.thread_workspaces;
CREATE POLICY "Allow full access to thread_workspaces"
  ON public.thread_workspaces
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to thread_project_rows" ON public.thread_project_rows;
CREATE POLICY "Allow full access to thread_project_rows"
  ON public.thread_project_rows
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to thread_wire_inspections" ON public.thread_wire_inspections;
CREATE POLICY "Allow full access to thread_wire_inspections"
  ON public.thread_wire_inspections
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Seed Baris Workspace Default
INSERT INTO public.thread_workspaces (
  id,
  project_name,
  prepared_by,
  project_rows,
  custom_measured_wire_m,
  wire_check_preset
)
VALUES (
  'default',
  'Spindel & Mur Ulir Trapesium Workshop Utama',
  'Tim Rekayasa Mekanik & QC',
  '[]'::jsonb,
  '{}'::jsonb,
  'mixed_qc'
)
ON CONFLICT (id) DO NOTHING;
