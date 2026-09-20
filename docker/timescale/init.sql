-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create Hypertable for Line Telemetry
CREATE TABLE IF NOT EXISTS line_telemetry (
    time            TIMESTAMPTZ NOT NULL,
    machine_id      TEXT NOT NULL,
    datapoint_id    TEXT NOT NULL,
    datapoint_name  TEXT NOT NULL,
    data_type       TEXT NOT NULL,
    val_num         DOUBLE PRECISION,
    val_str         TEXT,
    val_bool        BOOLEAN,
    quality         TEXT DEFAULT 'Good',
    unit            TEXT
);

-- Convert to hypertable partitioned by time
SELECT create_hypertable('line_telemetry', 'time', if_not_exists => TRUE);

-- Create compound indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_telemetry_datapoint_time 
ON line_telemetry (datapoint_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_machine_time 
ON line_telemetry (machine_id, time DESC);

-- Create Table for Reusable Machine Layouts (SVGs)
CREATE TABLE IF NOT EXISTS machine_layouts (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    description TEXT,
    svg_object_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial test data points for local development
INSERT INTO line_telemetry (time, machine_id, datapoint_id, datapoint_name, data_type, val_num, quality, unit)
VALUES 
    (NOW() - INTERVAL '5 minutes', 'Extruder_1', 'ns=2;s=Extruder1.Temperature', 'Extruder Temperature', 'float64', 85.4, 'Good', '°C'),
    (NOW() - INTERVAL '4 minutes', 'Extruder_1', 'ns=2;s=Extruder1.Temperature', 'Extruder Temperature', 'float64', 86.1, 'Good', '°C'),
    (NOW() - INTERVAL '3 minutes', 'Extruder_1', 'ns=2;s=Extruder1.Temperature', 'Extruder Temperature', 'float64', 87.0, 'Good', '°C'),
    (NOW() - INTERVAL '2 minutes', 'Extruder_1', 'ns=2;s=Extruder1.Temperature', 'Extruder Temperature', 'float64', 86.8, 'Good', '°C'),
    (NOW() - INTERVAL '1 minute',  'Extruder_1', 'ns=2;s=Extruder1.Temperature', 'Extruder Temperature', 'float64', 88.2, 'Good', '°C'),
    (NOW(),                         'Extruder_1', 'ns=2;s=Extruder1.Temperature', 'Extruder Temperature', 'float64', 87.9, 'Good', '°C'),
    (NOW(),                         'Extruder_1', 'ns=2;s=Extruder1.Status',      'Extruder Status',      'int32',   1,    'Good', NULL),
    (NOW(),                         'Conveyor_1', 'ns=2;s=Conveyor1.Speed',       'Conveyor Speed',       'float64', 1.25, 'Good', 'm/s'),
    (NOW(),                         'Conveyor_1', 'ns=2;s=Conveyor1.Status',      'Conveyor Status',      'int32',   1,    'Good', NULL),
    (NOW(),                         'Packer_1',   'ns=2;s=Packer1.Status',        'Packer Status',        'int32',   2,    'Good', NULL);
