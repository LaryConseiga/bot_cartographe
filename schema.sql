-- ============================================================
-- CARTOGRAPHE DE COMPÉTENCES PRÉDICTIF — Supabase SQL Setup
-- CogiteoAI · MVP v1
-- ============================================================
-- Exécuter dans : Supabase Dashboard > SQL Editor > New Query
-- ============================================================


-- ┌─────────────────────────────────────────────────────────┐
-- │  EXTENSIONS                                             │
-- └─────────────────────────────────────────────────────────┘

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ============================================================
-- BLOC 1 — SCRAPING
-- ============================================================

CREATE TABLE raw_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source          TEXT NOT NULL,
  scraped_by      TEXT NOT NULL,
  url             TEXT UNIQUE NOT NULL,
  title           TEXT,
  company         TEXT,
  location        TEXT,
  country         TEXT,
  region          TEXT,
  sector          TEXT,
  contract_type   TEXT,
  raw_description TEXT,
  date_posted     DATE,
  processed       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

ALTER TABLE raw_jobs
ADD CONSTRAINT check_country CHECK (
  country IN ('BF','SN','CI','ML','TG','BJ','GN','NE','MR',
              'MA','DZ','TN','CM','GH','NG','REMOTE')
);

ALTER TABLE raw_jobs
ADD CONSTRAINT check_region CHECK (
  region IN ('Afrique_Ouest','Maghreb','Afrique_Centrale',
             'Afrique_Est','Global_Remote','Afrique_francophone')
);

ALTER TABLE raw_jobs
ADD CONSTRAINT check_source CHECK (
  source IN (
    'emploi_bf',
    'rekrute',
    'linkedin',
    'indeed_fr',
    'jobberman',
    'afrique_it',
    'cd_emploi',
    'senjob',
    'malivore',
    'talent_com',
    'emploi_ci',
    'weforum_report',
    'manual'
  )
);

CREATE INDEX idx_raw_jobs_processed  ON raw_jobs(processed);
CREATE INDEX idx_raw_jobs_source     ON raw_jobs(source);
CREATE INDEX idx_raw_jobs_country    ON raw_jobs(country);
CREATE INDEX idx_raw_jobs_created_at ON raw_jobs(created_at DESC);


CREATE TABLE structured_jobs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_job_id       UUID REFERENCES raw_jobs(id) ON DELETE CASCADE,
  hard_skills      TEXT[],
  soft_skills      TEXT[],
  tools            TEXT[],
  certifications   TEXT[],
  experience_years TEXT,
  education_level  TEXT,
  salary_min       INTEGER,
  salary_max       INTEGER,
  salary_currency  TEXT DEFAULT 'XOF',
  extracted_by     TEXT DEFAULT 'mistral-small',
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_structured_jobs_raw    ON structured_jobs(raw_job_id);
CREATE INDEX idx_structured_jobs_skills ON structured_jobs USING GIN(hard_skills);


-- ============================================================
-- BLOC 2 — AGRÉGATION MARCHÉ
-- ============================================================

CREATE TABLE skills_market (
  skill           TEXT PRIMARY KEY,
  normalized_name TEXT UNIQUE,
  domain          TEXT,
  subdomain       TEXT,
  frequency       INTEGER DEFAULT 0,
  demand_level    TEXT,
  growth_rate     TEXT,
  top_roles       TEXT[],
  top_sectors     TEXT[],
  regions         TEXT[],
  avg_salary_xof  INTEGER,
  is_trending     BOOLEAN DEFAULT FALSE,
  last_updated    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_skills_domain    ON skills_market(domain);
CREATE INDEX idx_skills_demand    ON skills_market(demand_level);
CREATE INDEX idx_skills_trending  ON skills_market(is_trending);
CREATE INDEX idx_skills_name_trgm ON skills_market USING GIN(skill gin_trgm_ops);


CREATE TABLE skills_cooccurrence (
  skill_a     TEXT REFERENCES skills_market(skill),
  skill_b     TEXT REFERENCES skills_market(skill),
  count       INTEGER DEFAULT 0,
  correlation NUMERIC(4,3),
  PRIMARY KEY (skill_a, skill_b)
);


-- ============================================================
-- BLOC 3 — RESSOURCES D'APPRENTISSAGE
-- ============================================================

CREATE TABLE resources (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill          TEXT REFERENCES skills_market(skill) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  platform       TEXT NOT NULL,
  url            TEXT UNIQUE NOT NULL,
  duration_hours NUMERIC(5,1),
  level          TEXT,
  is_free        BOOLEAN DEFAULT TRUE,
  lang           TEXT DEFAULT 'fr',
  format         TEXT,
  rating         NUMERIC(3,1),
  added_by       TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_resources_skill ON resources(skill);
CREATE INDEX idx_resources_free  ON resources(is_free);
CREATE INDEX idx_resources_lang  ON resources(lang);


-- ============================================================
-- BLOC 4 — PROFILS UTILISATEURS & SESSIONS BOT
-- ============================================================

CREATE TABLE student_profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           TEXT,
  email               TEXT,
  country             TEXT,
  city                TEXT,
  nationality         TEXT,
  field_of_study      TEXT,
  school              TEXT,
  school_country      TEXT,
  graduation_year     INTEGER,
  bac_series          TEXT,
  target_role         TEXT,
  target_country      TEXT,
  target_sector       TEXT,
  willing_to_relocate BOOLEAN DEFAULT TRUE,
  cv_text             TEXT,
  cv_url              TEXT,
  preferred_lang      TEXT DEFAULT 'fr',
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);


CREATE TABLE student_skills (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  skill       TEXT,
  level       TEXT,
  source      TEXT,
  confirmed   BOOLEAN DEFAULT FALSE,
  detected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_student_skills_student ON student_skills(student_id);


CREATE TABLE gap_reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id       UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  target_role      TEXT,
  global_score     INTEGER,
  missing_skills   TEXT[],
  weak_skills      TEXT[],
  strong_skills    TEXT[],
  estimated_weeks  INTEGER,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_gap_reports_student ON gap_reports(student_id);


CREATE TABLE pathways (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  gap_id      UUID REFERENCES gap_reports(id),
  horizon     TEXT NOT NULL,
  skill       TEXT,
  resource_id UUID REFERENCES resources(id),
  priority    INTEGER,
  completed   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pathways_student ON pathways(student_id);
CREATE INDEX idx_pathways_horizon ON pathways(horizon);


CREATE TABLE chat_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  session_ref TEXT UNIQUE,
  started_at  TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);


-- ============================================================
-- BLOC 5 — SECTEURS AFRIQUE DE L'OUEST
-- ============================================================

CREATE TABLE sectors_west_africa (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT UNIQUE NOT NULL,
  growth_outlook  TEXT,
  key_countries   TEXT[],
  top_employers   TEXT[],
  notes           TEXT
);

INSERT INTO sectors_west_africa (name, growth_outlook, key_countries, top_employers, notes)
VALUES
  ('Fintech & Mobile Money',  'fort',   ARRAY['SN','CI','GH','BF'], ARRAY['Wave','Orange Money','Moov','MTN MoMo'],  'Secteur en hypercroissance depuis 2021'),
  ('Télécoms',                'modéré', ARRAY['BF','SN','CI','ML'], ARRAY['Orange BF','Moov Africa','Telecel'],      'Recrutement régulier, profils réseaux et data'),
  ('Administration publique', 'stable', ARRAY['BF','ML','NE'],      ARRAY['ANPE','Ministères'],                      'Débouché encore dominant pour beaucoup de profils'),
  ('Agritech',                'fort',   ARRAY['BF','ML','SN'],      ARRAY['Songhai','DigiFarm','Hello Tractor'],     'Secteur émergent, peu de concurrence tech'),
  ('E-commerce & Logistique', 'fort',   ARRAY['CI','SN','GH'],      ARRAY['Jumia','Glovo','Kifal Auto'],             'Croissance portée par la pénétration mobile'),
  ('ONG & Développement',     'stable', ARRAY['BF','ML','NE','GN'], ARRAY['GIZ','AFD','UNICEF','ONU'],              'Gros recruteur de profils data et systèmes'),
  ('Santé numérique',         'fort',   ARRAY['SN','CI','GH'],      ARRAY['mPharma','Helium Health'],               'Secteur sous-exploité, forte demande à venir'),
  ('EdTech',                  'modéré', ARRAY['SN','CI','BF'],      ARRAY['Orange Digital Center','Simplon'],       'Portée par les initiatives de formation numérique');


-- ============================================================
-- BLOC 6 — MONITORING SCRAPING
-- ============================================================

CREATE TABLE scraper_runs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source        TEXT NOT NULL,
  run_by        TEXT,
  started_at    TIMESTAMP DEFAULT NOW(),
  finished_at   TIMESTAMP,
  jobs_found    INTEGER DEFAULT 0,
  jobs_inserted INTEGER DEFAULT 0,
  jobs_skipped  INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'running',
  error_message TEXT
);


-- ============================================================
-- BLOC 7 — VUES UTILES
-- ============================================================

CREATE VIEW top_skills AS
  SELECT skill, domain, frequency, demand_level, growth_rate, top_roles, regions
  FROM skills_market
  ORDER BY frequency DESC
  LIMIT 20;

CREATE VIEW free_fr_resources AS
  SELECT skill, title, platform, url, duration_hours, level
  FROM resources
  WHERE is_free = TRUE AND lang = 'fr'
  ORDER BY skill, rating DESC NULLS LAST;

CREATE VIEW pending_jobs AS
  SELECT id, source, scraped_by, title, country, raw_description, created_at
  FROM raw_jobs
  WHERE processed = FALSE
  ORDER BY created_at ASC;

CREATE VIEW scraping_stats AS
  SELECT
    source,
    COUNT(*)                                    AS total_jobs,
    COUNT(*) FILTER (WHERE processed = TRUE)    AS processed,
    COUNT(*) FILTER (WHERE processed = FALSE)   AS pending,
    MAX(created_at)                             AS last_scraped
  FROM raw_jobs
  GROUP BY source
  ORDER BY total_jobs DESC;

CREATE VIEW skills_west_africa AS
  SELECT skill, domain, frequency, demand_level, growth_rate, top_roles, avg_salary_xof, is_trending
  FROM skills_market
  WHERE regions && ARRAY['BF','SN','CI','ML','TG','BJ','GH','NG']
     OR demand_level = 'high'
  ORDER BY frequency DESC;

CREATE VIEW resources_fr_priority AS
  SELECT skill, title, platform, url, duration_hours, level, is_free, format
  FROM resources
  ORDER BY
    CASE lang WHEN 'fr' THEN 0 WHEN 'en' THEN 1 ELSE 2 END,
    is_free DESC,
    rating DESC NULLS LAST;


-- ============================================================
-- BLOC 8 — TRIGGER updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_student_profiles_updated_at
  BEFORE UPDATE ON student_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- BLOC 9 — ROW LEVEL SECURITY (activer avant déploiement)
-- ============================================================
-- ⚠️  DÉSACTIVÉ pendant le développement
-- Décommenter uniquement avant le déploiement en production

/*
ALTER TABLE student_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_skills    ENABLE ROW LEVEL SECURITY;
ALTER TABLE gap_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pathways          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_jobs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills_market     ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile"  ON student_profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_skills"   ON student_skills   FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "own_gaps"     ON gap_reports       FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "own_pathways" ON pathways          FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "own_sessions" ON chat_sessions     FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "public_read_skills"    ON skills_market FOR SELECT USING (TRUE);
CREATE POLICY "public_read_resources" ON resources     FOR SELECT USING (TRUE);
*/


-- ============================================================
-- BLOC 10 — DONNÉES DE TEST (décommenter pour valider)
-- ============================================================

/*
INSERT INTO skills_market (skill, normalized_name, domain, frequency, demand_level, growth_rate, top_roles, regions)
VALUES
  ('Python',   'python',   'Data & IA',     342, 'high',   '+12%', ARRAY['Data Scientist','ML Engineer'],  ARRAY['MA','SN','CI','BF']),
  ('SQL',      'sql',      'Data & IA',     298, 'high',   '+8%',  ARRAY['Data Analyst','Backend Dev'],    ARRAY['MA','BF','SN']),
  ('Power BI', 'powerbi',  'Data & IA',     187, 'high',   '+24%', ARRAY['Data Analyst'],                  ARRAY['MA','CI']),
  ('MLOps',    'mlops',    'Data & IA',      89, 'medium', '+41%', ARRAY['ML Engineer'],                   ARRAY['REMOTE']),
  ('React',    'react',    'Développement', 210, 'high',   '+15%', ARRAY['Frontend Dev'],                  ARRAY['MA','SN','CI']),
  ('Docker',   'docker',   'DevOps',        145, 'high',   '+19%', ARRAY['DevOps','Backend Dev'],          ARRAY['MA','REMOTE']),
  ('Git',      'git',      'Développement', 311, 'high',   '+5%',  ARRAY['Tous profils tech'],              ARRAY['MA','BF','SN','CI']);

INSERT INTO resources (skill, title, platform, url, duration_hours, level, is_free, lang, format)
VALUES
  ('Python',   'Python pour la Data Science', 'Kaggle',   'https://kaggle.com/learn/python',    5.0,  'débutant',      TRUE,  'fr', 'cours'),
  ('SQL',      'SQL pour débutants',           'YouTube',  'https://youtube.com/watch?v=sql_fr', 3.0,  'débutant',      TRUE,  'fr', 'vidéo'),
  ('Power BI', 'Power BI Guide complet',       'YouTube',  'https://youtube.com/watch?v=pbi_fr', 6.0,  'débutant',      TRUE,  'fr', 'vidéo'),
  ('MLOps',    'MLOps Specialization',         'Coursera', 'https://coursera.org/mlops',         20.0, 'intermédiaire', FALSE, 'en', 'cours'),
  ('Docker',   'Docker pour développeurs',     'YouTube',  'https://youtube.com/watch?v=dkr_fr', 4.0,  'débutant',      TRUE,  'fr', 'vidéo');
*/
