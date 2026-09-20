package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"marmot-backend-service/pkg/models"
)

type GetDataPointsInput struct {
	SiteId      string `query:"siteId" doc:"Filters datapoints by site id"`
	MachineId   string `query:"machineId" doc:"Filters datapoints by provided machine id"`
	DataPointId string `query:"dataPointId" doc:"Filters datapoints by provided datapoint id"`
}

type GetDataPointsOutput struct {
	Body struct {
		Content []DataPoint `json:"datapoints"`
	}
}

type DataPoint = models.DataPoint
type TelemetryPayload = models.TelemetryMessage
type Site = models.Site

// InitEdgeDatapointsTable ensures the sites and edge_datapoints tables exist
func InitEdgeDatapointsTable(ctx context.Context) error {
	sql := `
	CREATE TABLE IF NOT EXISTS sites (
		id           VARCHAR(64) PRIMARY KEY,
		name         VARCHAR(255) NOT NULL,
		description  TEXT,
		ws_url       TEXT NOT NULL DEFAULT 'ws://localhost:3001/ws',
		status       VARCHAR(32) DEFAULT 'online',
		last_seen_at TIMESTAMPTZ DEFAULT NOW(),
		created_at   TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS edge_datapoints (
		datapoint_id   TEXT PRIMARY KEY,
		datapoint_name TEXT NOT NULL,
		machine_id     TEXT NOT NULL,
		data_type      TEXT NOT NULL,
		unit           TEXT,
		site_id        TEXT DEFAULT 'factory-edge-01',
		last_seen_at   TIMESTAMPTZ DEFAULT NOW()
	);

	-- Seed default dev site if none exists
	INSERT INTO sites (id, name, description, ws_url, status)
	VALUES ('factory-edge-01', 'Factory Edge 01', 'Local development edge instance', 'ws://localhost:3001/ws', 'online')
	ON CONFLICT (id) DO NOTHING;
	`
	_, err := Conn.Exec(ctx, sql)
	return err
}

// ListSitesHandler returns all registered sites from the config database
func ListSitesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	sql := `SELECT id, name, COALESCE(description, ''), ws_url, status, last_seen_at, created_at FROM sites ORDER BY name ASC`
	rows, err := Conn.Query(ctx, sql)
	if err != nil {
		http.Error(w, "Failed to query sites", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var sites []Site
	for rows.Next() {
		var s Site
		if err := rows.Scan(&s.Id, &s.Name, &s.Description, &s.WsUrl, &s.Status, &s.LastSeenAt, &s.CreatedAt); err == nil {
			sites = append(sites, s)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(sites)
}

// GetSiteHandler returns a specific site by ID
func GetSiteHandler(w http.ResponseWriter, r *http.Request) {
	siteId := chi.URLParam(r, "id")
	if siteId == "" {
		http.Error(w, "Site ID required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	sql := `SELECT id, name, COALESCE(description, ''), ws_url, status, last_seen_at, created_at FROM sites WHERE id = $1`
	var s Site
	err := Conn.QueryRow(ctx, sql, siteId).Scan(&s.Id, &s.Name, &s.Description, &s.WsUrl, &s.Status, &s.LastSeenAt, &s.CreatedAt)
	if err != nil {
		http.Error(w, "Site not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(s)
}

// UpdateSiteHandler updates a site's name, description, or ws_url
func UpdateSiteHandler(w http.ResponseWriter, r *http.Request) {
	siteId := chi.URLParam(r, "id")
	if siteId == "" {
		http.Error(w, "Site ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		WsUrl       string `json:"wsUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	sql := `
	UPDATE sites 
	SET name = COALESCE(NULLIF($2, ''), name),
	    description = $3,
	    ws_url = COALESCE(NULLIF($4, ''), ws_url)
	WHERE id = $1
	`
	_, err := Conn.Exec(ctx, sql, siteId, req.Name, req.Description, req.WsUrl)
	if err != nil {
		http.Error(w, "Failed to update site", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "siteId": siteId})
}

// SyncEdgeDatapointsHandler receives distinct datapoints pushed from marmot-edge
func SyncEdgeDatapointsHandler(w http.ResponseWriter, r *http.Request) {
	var payload models.SyncDatapointsPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	siteId := payload.SiteId
	if siteId == "" {
		siteId = "factory-edge-01"
	}

	siteName := payload.SiteName
	if siteName == "" {
		siteName = "Site " + siteId
	}

	ctx := r.Context()

	// 1. Ensure/upsert the site in the sites registry
	siteSql := `
	INSERT INTO sites (id, name, ws_url, status, last_seen_at)
	VALUES ($1, $2, 'ws://localhost:3001/ws', 'online', NOW())
	ON CONFLICT (id) DO UPDATE SET
		name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE sites.name END,
		status = 'online',
		last_seen_at = NOW()
	`
	_, _ = Conn.Exec(ctx, siteSql, siteId, siteName)

	// 2. Upsert each datapoint associated with this site
	syncedCount := 0
	for _, dp := range payload.Datapoints {
		sql := `
		INSERT INTO edge_datapoints (datapoint_id, datapoint_name, machine_id, data_type, unit, site_id, last_seen_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (datapoint_id) DO UPDATE SET
			datapoint_name = EXCLUDED.datapoint_name,
			machine_id = EXCLUDED.machine_id,
			data_type = EXCLUDED.data_type,
			unit = EXCLUDED.unit,
			site_id = EXCLUDED.site_id,
			last_seen_at = NOW()
		`
		_, err := Conn.Exec(ctx, sql, dp.DataPointId, dp.DataPointName, dp.MachineId, dp.DataType, dp.Unit, siteId)
		if err != nil {
			Logger.Error("failed to upsert edge datapoint", "id", dp.DataPointId, "error", err)
		} else {
			syncedCount++
		}
	}

	Logger.Info("edge datapoints synchronized successfully", "synced", syncedCount, "site_id", siteId, "site_name", siteName)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":  "ok",
		"synced":  syncedCount,
		"site_id": siteId,
	})
}

func GetDatapoints(ctx context.Context, input *GetDataPointsInput) (*GetDataPointsOutput, error) {
	resp := new(GetDataPointsOutput)

	// 1. Query edge_datapoints first (with optional siteId, machineId, dataPointId filters)
	edgeSql := `SELECT datapoint_id, datapoint_name, machine_id, data_type, unit FROM edge_datapoints `
	var edgeConditions []string
	var edgeArgs []any

	if input.SiteId != "" {
		edgeArgs = append(edgeArgs, input.SiteId)
		edgeConditions = append(edgeConditions, fmt.Sprintf("site_id=$%d", len(edgeArgs)))
	}
	if input.MachineId != "" {
		edgeArgs = append(edgeArgs, input.MachineId)
		edgeConditions = append(edgeConditions, fmt.Sprintf("machine_id=$%d", len(edgeArgs)))
	}
	if input.DataPointId != "" {
		edgeArgs = append(edgeArgs, input.DataPointId)
		edgeConditions = append(edgeConditions, fmt.Sprintf("datapoint_id=$%d", len(edgeArgs)))
	}
	if len(edgeConditions) > 0 {
		edgeSql += " WHERE " + strings.Join(edgeConditions, " AND ")
	}
	edgeSql += " ORDER BY machine_id, datapoint_name"

	edgeRows, err := Conn.Query(ctx, edgeSql, edgeArgs...)
	if err == nil {
		defer edgeRows.Close()
		for edgeRows.Next() {
			var dataPointId, dataPointName, machineId, dataType pgtype.Text
			var unit pgtype.Text
			if err := edgeRows.Scan(&dataPointId, &dataPointName, &machineId, &dataType, &unit); err == nil {
				var unitPtr *string
				if unit.Valid && unit.String != "" {
					unitStr := unit.String
					unitPtr = &unitStr
				}
				resp.Body.Content = append(resp.Body.Content, DataPoint{
					DataPointId:   dataPointId.String,
					DataPointName: dataPointName.String,
					MachineId:     machineId.String,
					DataType:      dataType.String,
					Unit:          unitPtr,
				})
			}
		}
	}

	// 2. If edge_datapoints has content, return it
	if len(resp.Body.Content) > 0 {
		return resp, nil
	}

	// 3. Fallback: Query distinct datapoints from line_telemetry table (seed data)
	sql := `SELECT DISTINCT datapoint_id, datapoint_name, machine_id, data_type, unit FROM line_telemetry `
	var conditions []string
	var args []any

	if input.MachineId != "" {
		args = append(args, input.MachineId)
		conditions = append(conditions, fmt.Sprintf("machine_id=$%d", len(args)))
	}
	if input.DataPointId != "" {
		args = append(args, input.DataPointId)
		conditions = append(conditions, fmt.Sprintf("datapoint_id=$%d", len(args)))
	}
	if len(conditions) > 0 {
		sql += " WHERE " + strings.Join(conditions, " AND ")
	}
	sql += " ORDER BY machine_id, datapoint_name"

	rows, err := Conn.Query(ctx, sql, args...)
	if err != nil {
		return resp, err
	}
	defer rows.Close()

	for rows.Next() {
		var dataPointId, dataPointName, machineId, dataType pgtype.Text
		var unit pgtype.Text

		if err := rows.Scan(&dataPointId, &dataPointName, &machineId, &dataType, &unit); err != nil {
			return resp, err
		}

		var unitPtr *string
		if unit.Valid && unit.String != "" {
			unitStr := unit.String
			unitPtr = &unitStr
		}

		resp.Body.Content = append(resp.Body.Content, DataPoint{
			DataPointId:   dataPointId.String,
			DataPointName: dataPointName.String,
			MachineId:     machineId.String,
			DataType:      dataType.String,
			Unit:          unitPtr,
		})
	}
	return resp, nil
}
