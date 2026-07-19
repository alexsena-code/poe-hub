-- Brain CX: position tracking, pair state (aggression), decision log

CREATE TABLE cx_position (
    id TEXT PRIMARY KEY,
    pair_key TEXT NOT NULL,
    league TEXT NOT NULL,
    strategy TEXT NOT NULL,
    side TEXT NOT NULL,
    ratio_posted DOUBLE PRECISION NOT NULL,
    qty INTEGER NOT NULL,
    expected_order_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'posted',
    job_id TEXT,
    fill_event_id TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,
    filled_at TIMESTAMP(3),
    closed_at TIMESTAMP(3),
    timeout_at TIMESTAMP(3)
);

CREATE INDEX cx_position_league_status_idx ON cx_position(league, status);
CREATE INDEX cx_position_expected_order_key_idx ON cx_position(expected_order_key);
CREATE INDEX cx_position_pair_key_league_idx ON cx_position(pair_key, league);

CREATE TABLE cx_pair_state (
    id TEXT PRIMARY KEY,
    pair_key TEXT NOT NULL,
    league TEXT NOT NULL,
    strategy TEXT NOT NULL,
    aggression DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    consecutive_timeouts INTEGER NOT NULL DEFAULT 0,
    consecutive_fills INTEGER NOT NULL DEFAULT 0,
    avg_fill_time_s DOUBLE PRECISION,
    last_adjusted_at TIMESTAMP(3),
    cooldown_until TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,
    UNIQUE(pair_key, league, strategy)
);

CREATE TABLE cx_brain_log (
    id TEXT PRIMARY KEY,
    ts TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL,
    pair_key TEXT,
    detail JSONB,
    position_id TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX cx_brain_log_ts_idx ON cx_brain_log(ts);
CREATE INDEX cx_brain_log_action_idx ON cx_brain_log(action);
