-- ash-scores schema 1 (README.md). A board is (day, variant, version): one board per daily variant per game version.
-- Columns marked "future" let later variants (other missions, modifiers, other result fields) arrive without a migration.

CREATE TABLE days (
  day        TEXT    NOT NULL,              -- YYYY-MM-DD in Asia/Taipei
  variant    TEXT    NOT NULL,              -- 'standard' today
  spec       TEXT    NOT NULL,              -- the JSON the game gets (src/ranked-daily.js rankedSpecProblem)
  seed       INTEGER NOT NULL,
  mission    TEXT    NOT NULL,
  facility   TEXT    NOT NULL,
  difficulty TEXT    NOT NULL,
  modifiers  TEXT    NOT NULL DEFAULT '[]', -- future: variant modifiers
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, variant)
);

CREATE TABLE players (
  id         TEXT    PRIMARY KEY,           -- sha256 of the player's secret key, hex, 32 characters
  name       TEXT    NOT NULL,              -- three characters, A-Z and 0-9, like an arcade
  created_at INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  hidden     INTEGER NOT NULL DEFAULT 0     -- 1 keeps the player off every board
);

CREATE TABLE tickets (
  id         TEXT    PRIMARY KEY,
  player_id  TEXT    NOT NULL,
  day        TEXT    NOT NULL,
  variant    TEXT    NOT NULL,
  issued_at  INTEGER NOT NULL,
  used_at    INTEGER                        -- set when a run is submitted with it, whether it passes or not
);
CREATE INDEX tickets_player_day ON tickets (player_id, day);

CREATE TABLE runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  day        TEXT    NOT NULL,
  variant    TEXT    NOT NULL,
  version    TEXT    NOT NULL,
  player_id  TEXT    NOT NULL,
  ticket_id  TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,              -- the name when the run was sent
  channel    TEXT    NOT NULL,              -- 'itch', 'web', 'dev'
  language   TEXT    NOT NULL,
  character  TEXT    NOT NULL,
  status     TEXT    NOT NULL,              -- 'won' or 'dead'
  deepest    INTEGER NOT NULL,
  turns      INTEGER NOT NULL,
  kills      INTEGER NOT NULL,
  level      INTEGER NOT NULL,
  score_key  INTEGER NOT NULL,              -- the ordering key (src/rules.js scoreKey)
  extra      TEXT    NOT NULL DEFAULT '{}', -- future: per-variant result fields
  duration_s INTEGER NOT NULL,
  ops        INTEGER NOT NULL,
  log_sha256 TEXT    NOT NULL,
  log        BLOB,                          -- the gzip'd replay log; cleared after 30 days
  verified   INTEGER NOT NULL,              -- 1 = played back on the server
  created_at INTEGER NOT NULL
);
CREATE INDEX runs_board ON runs (day, variant, version);
CREATE INDEX runs_player ON runs (player_id, day);

CREATE TABLE best (
  day        TEXT    NOT NULL,
  variant    TEXT    NOT NULL,
  version    TEXT    NOT NULL,
  player_id  TEXT    NOT NULL,
  run_id     INTEGER NOT NULL,
  score_key  INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, variant, version, player_id)
);
CREATE INDEX best_rank ON best (day, variant, version, score_key DESC, created_at);

CREATE TABLE rate (
  key   TEXT    NOT NULL,
  slot  INTEGER NOT NULL,                   -- the window's start, epoch seconds
  count INTEGER NOT NULL,
  PRIMARY KEY (key, slot)
);
