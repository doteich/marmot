-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create Hypertable for Line Telemetry
CREATE TABLE IF NOT EXISTS line_telemetry (
    time        TIMESTAMPTZ NOT NULL,
    server_id   TEXT NOT NULL,
    machine_id  TEXT NOT NULL,
    data_point  TEXT NOT NULL,
    data_type   TEXT NOT NULL,
    val_num     DOUBLE PRECISION,
    val_str     TEXT,
    val_bool    BOOLEAN
);

-- Convert to hypertable partitioned by time
SELECT create_hypertable('line_telemetry', 'time', if_not_exists => TRUE);

-- Create compound index for fast retrieval of latest status and timeseries ranges per data point
CREATE INDEX IF NOT EXISTS idx_telemetry_machine_metric_time 
ON line_telemetry (machine_id, data_point, time DESC);

-- Seed initial test data points for local development
INSERT INTO line_telemetry (time, server_id, machine_id, data_point, data_type, val_num)
VALUES 
    (NOW() - INTERVAL '5 minutes', 'opc-server-1', 'Extruder_1', 'Temperature', 'float64', 85.4),
    (NOW() - INTERVAL '4 minutes', 'opc-server-1', 'Extruder_1', 'Temperature', 'float64', 86.1),
    (NOW() - INTERVAL '3 minutes', 'opc-server-1', 'Extruder_1', 'Temperature', 'float64', 87.0),
    (NOW() - INTERVAL '2 minutes', 'opc-server-1', 'Extruder_1', 'Temperature', 'float64', 86.8),
    (NOW() - INTERVAL '1 minute',  'opc-server-1', 'Extruder_1', 'Temperature', 'float64', 88.2),
    (NOW(),                         'opc-server-1', 'Extruder_1', 'Temperature', 'float64', 87.9),
    (NOW(),                         'opc-server-1', 'Extruder_1', 'Status',      'int32',   1),
    (NOW(),                         'opc-server-1', 'Conveyor_1', 'Speed',       'float64', 1.25),
    (NOW(),                         'opc-server-1', 'Conveyor_1', 'Status',      'int32',   1),
    (NOW(),                         'opc-server-1', 'Packer_1',   'Status',      'int32',   2);
