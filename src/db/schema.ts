import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = process.env.APP_DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "learning-planner.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  runMigrations(_db);
  return _db;
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function safeAddColumn(db: Database.Database, table: string, column: string, definition: string) {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      llm_provider TEXT NOT NULL DEFAULT 'openai',
      llm_api_key TEXT NOT NULL DEFAULT '',
      llm_base_url TEXT DEFAULT '',
      llm_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
      search_api_key TEXT DEFAULT '',
      proxy_enabled INTEGER NOT NULL DEFAULT 0,
      proxy_type TEXT DEFAULT 'http',
      proxy_host TEXT DEFAULT '',
      proxy_port INTEGER DEFAULT 0,
      proxy_username TEXT DEFAULT '',
      proxy_password TEXT DEFAULT '',
      schema_version INTEGER NOT NULL DEFAULT 2,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO system_config (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS learning_plan (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      goal_description TEXT NOT NULL,
      duration_weeks INTEGER NOT NULL,
      daily_hours REAL NOT NULL,
      skill_level TEXT NOT NULL DEFAULT 'beginner',
      status TEXT NOT NULL DEFAULT 'draft',
      total_stages INTEGER NOT NULL DEFAULT 0,
      current_stage_index INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stage (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      key_topics TEXT NOT NULL DEFAULT '[]',
      estimated_days INTEGER NOT NULL DEFAULT 7,
      status TEXT NOT NULL DEFAULT 'locked',
      summary_text TEXT DEFAULT '',
      resource_completion_rate REAL NOT NULL DEFAULT 0,
      unlocked_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES learning_plan(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS resource (
      id TEXT PRIMARY KEY,
      stage_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'article',
      reason TEXT NOT NULL DEFAULT '',
      estimated_minutes INTEGER DEFAULT 30,
      region_tag TEXT NOT NULL DEFAULT 'domestic',
      is_manual INTEGER NOT NULL DEFAULT 0,
      is_completed INTEGER NOT NULL DEFAULT 0,
      is_skipped INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (stage_id) REFERENCES stage(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assessment (
      id TEXT PRIMARY KEY,
      stage_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      input_text TEXT NOT NULL DEFAULT '',
      score_overall REAL NOT NULL DEFAULT 0,
      score_coverage REAL NOT NULL DEFAULT 0,
      score_depth REAL NOT NULL DEFAULT 0,
      score_accuracy REAL NOT NULL DEFAULT 0,
      passed INTEGER NOT NULL DEFAULT 0,
      feedback TEXT NOT NULL DEFAULT '',
      missing_topics TEXT NOT NULL DEFAULT '[]',
      suggestions TEXT NOT NULL DEFAULT '[]',
      attempt_number INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (stage_id) REFERENCES stage(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS search_cache (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      results TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'tavily',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stage_plan_id ON stage(plan_id);
    CREATE INDEX IF NOT EXISTS idx_resource_stage_id ON resource(stage_id);
    CREATE INDEX IF NOT EXISTS idx_assessment_stage_id ON assessment(stage_id);
    CREATE INDEX IF NOT EXISTS idx_search_cache_query ON search_cache(query);
  `);

  safeAddColumn(db, "system_config", "tavily_api_key", "TEXT DEFAULT ''");
  safeAddColumn(db, "system_config", "quality_sites", "TEXT DEFAULT '[]'");
  safeAddColumn(db, "system_config", "search_region", "TEXT DEFAULT 'global'");

  safeAddColumn(db, "learning_plan", "user_motivation", "TEXT DEFAULT ''");
  safeAddColumn(db, "learning_plan", "user_background", "TEXT DEFAULT ''");
  safeAddColumn(db, "learning_plan", "expected_outcome", "TEXT DEFAULT ''");

  safeAddColumn(db, "stage", "real_world_cases", "TEXT DEFAULT '[]'");
  safeAddColumn(db, "stage", "assessment_questions", "TEXT DEFAULT '[]'");
  safeAddColumn(db, "stage", "core_output", "TEXT DEFAULT ''");
  safeAddColumn(db, "stage", "learning_objectives", "TEXT DEFAULT '[]'");

  safeAddColumn(db, "resource", "search_source", "TEXT DEFAULT 'llm'");
  safeAddColumn(db, "resource", "verified", "INTEGER DEFAULT 0");

  safeAddColumn(db, "learning_plan", "review_enabled", "INTEGER DEFAULT 1");
  safeAddColumn(db, "learning_plan", "adaptive_enabled", "INTEGER DEFAULT 1");
  safeAddColumn(db, "learning_plan", "analytics_enabled", "INTEGER DEFAULT 1");
  safeAddColumn(db, "learning_plan", "review_interval_preset", "TEXT DEFAULT 'standard'");

  safeAddColumn(db, "system_config", "review_notifications", "INTEGER DEFAULT 1");
  safeAddColumn(db, "system_config", "default_review_interval_preset", "TEXT DEFAULT 'standard'");

  db.exec(`
    CREATE TABLE IF NOT EXISTS teaching_chat (
      id TEXT PRIMARY KEY,
      stage_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (stage_id) REFERENCES stage(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_teaching_chat_stage ON teaching_chat(stage_id);

    CREATE TABLE IF NOT EXISTS review_schedule (
      id TEXT PRIMARY KEY,
      stage_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      interval_days INTEGER NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at TEXT,
      score REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (stage_id) REFERENCES stage(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES learning_plan(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_review_schedule_plan ON review_schedule(plan_id);
    CREATE INDEX IF NOT EXISTS idx_review_schedule_stage ON review_schedule(stage_id);
    CREATE INDEX IF NOT EXISTS idx_review_schedule_date ON review_schedule(scheduled_at);

    CREATE TABLE IF NOT EXISTS review_session (
      id TEXT PRIMARY KEY,
      review_schedule_id TEXT NOT NULL,
      questions TEXT NOT NULL DEFAULT '[]',
      score REAL NOT NULL DEFAULT 0,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (review_schedule_id) REFERENCES review_schedule(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_concept (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      name TEXT NOT NULL,
      definition TEXT NOT NULL DEFAULT '',
      mastery_status TEXT NOT NULL DEFAULT 'untouched',
      source_stage_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES learning_plan(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_concept_plan ON knowledge_concept(plan_id);

    CREATE TABLE IF NOT EXISTS knowledge_relation (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      from_concept_id TEXT NOT NULL,
      to_concept_id TEXT NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'related',
      source TEXT NOT NULL DEFAULT 'ai',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES learning_plan(id) ON DELETE CASCADE,
      FOREIGN KEY (from_concept_id) REFERENCES knowledge_concept(id) ON DELETE CASCADE,
      FOREIGN KEY (to_concept_id) REFERENCES knowledge_concept(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_relation_plan ON knowledge_relation(plan_id);

    CREATE TABLE IF NOT EXISTS stage_project (
      id TEXT PRIMARY KEY,
      stage_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      expected_output TEXT NOT NULL DEFAULT '',
      checklist TEXT NOT NULL DEFAULT '[]',
      output_notes TEXT NOT NULL DEFAULT '',
      attachment_paths TEXT NOT NULL DEFAULT '[]',
      difficulty TEXT NOT NULL DEFAULT 'medium',
      estimated_minutes INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'not_started',
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (stage_id) REFERENCES stage(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_project_stage ON stage_project(stage_id);

    CREATE TABLE IF NOT EXISTS learning_session (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      stage_id TEXT,
      activity_type TEXT NOT NULL DEFAULT 'resource',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      is_manual INTEGER NOT NULL DEFAULT 0,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES learning_plan(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_session_plan ON learning_session(plan_id);
    CREATE INDEX IF NOT EXISTS idx_session_started ON learning_session(started_at);

    CREATE TABLE IF NOT EXISTS mastery_profile (
      id TEXT PRIMARY KEY,
      stage_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      overall_level TEXT NOT NULL DEFAULT 'on_track',
      weak_topics TEXT NOT NULL DEFAULT '[]',
      assessment_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (stage_id) REFERENCES stage(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES learning_plan(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_mastery_plan ON mastery_profile(plan_id);

    CREATE TABLE IF NOT EXISTS adaptive_adjustment (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      stage_id TEXT,
      trigger_reason TEXT NOT NULL DEFAULT '',
      adjustment_type TEXT NOT NULL DEFAULT 'stage_depth',
      before_snapshot TEXT NOT NULL DEFAULT '{}',
      after_snapshot TEXT NOT NULL DEFAULT '{}',
      user_accepted INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES learning_plan(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_adjustment_plan ON adaptive_adjustment(plan_id);

    CREATE TABLE IF NOT EXISTS export_record (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      export_type TEXT NOT NULL DEFAULT 'certificate',
      file_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES learning_plan(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_export_plan ON export_record(plan_id);

    CREATE TABLE IF NOT EXISTS stage_note (
      id TEXT PRIMARY KEY,
      stage_id TEXT NOT NULL UNIQUE,
      ai_summary TEXT NOT NULL DEFAULT '',
      user_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (stage_id) REFERENCES stage(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_stage_note_stage ON stage_note(stage_id);
  `);
}
