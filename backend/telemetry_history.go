package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

// HistoryPoint represents an individual time-bucketed or raw measurement
type HistoryPoint struct {
	Time  time.Time `json:"time"`
	Value float64   `json:"value"`
	Min   *float64  `json:"min,omitempty"`
	Max   *float64  `json:"max,omitempty"`
	Count *int64    `json:"count,omitempty"`
}

// HistorySeries contains time-series data points for a specific datapoint
type HistorySeries struct {
	DataPointId   string         `json:"dataPointId"`
	DataPointName string         `json:"dataPointName,omitempty"`
	MachineId     string         `json:"machineId,omitempty"`
	Unit          *string        `json:"unit,omitempty"`
	Points        []HistoryPoint `json:"points"`
}

// HistoryResponse is the top-level payload returned by GET /api/telemetry/history
type HistoryResponse struct {
	From   time.Time       `json:"from"`
	To     time.Time       `json:"to"`
	Bucket string          `json:"bucket"`
	Agg    string          `json:"agg,omitempty"`
	Series []HistorySeries `json:"series"`
}

// parseRelativeOrAbsoluteTime converts duration strings (e.g. 15m, 1h, 24h, 7d) or RFC3339 timestamps
func parseRelativeOrAbsoluteTime(str string, now time.Time, defaultDuration time.Duration) (time.Time, error) {
	str = strings.TrimSpace(str)
	if str == "" || str == "now" {
		return now, nil
	}

	// Check relative formats: e.g. 15m, 1h, 24h, 7d, 30d
	re := regexp.MustCompile(`^(\d+)([smhdw])$`)
	if matches := re.FindStringSubmatch(strings.ToLower(str)); len(matches) == 3 {
		val, err := strconv.Atoi(matches[1])
		if err != nil {
			return now.Add(-defaultDuration), nil
		}
		unit := matches[2]
		var d time.Duration
		switch unit {
		case "s":
			d = time.Duration(val) * time.Second
		case "m":
			d = time.Duration(val) * time.Minute
		case "h":
			d = time.Duration(val) * time.Hour
		case "d":
			d = time.Duration(val) * 24 * time.Hour
		case "w":
			d = time.Duration(val) * 7 * 24 * time.Hour
		}
		return now.Add(-d), nil
	}

	// Try standard RFC3339 / ISO 8601 parsing
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, format := range formats {
		if t, err := time.Parse(format, str); err == nil {
			return t.UTC(), nil
		}
	}

	return now.Add(-defaultDuration), fmt.Errorf("unable to parse time: %s", str)
}

// pickAutoBucket selects a reasonable TimescaleDB bucket based on the query time span
func pickAutoBucket(span time.Duration) string {
	switch {
	case span <= 15*time.Minute:
		return "raw"
	case span <= 1*time.Hour:
		return "10s"
	case span <= 6*time.Hour:
		return "1m"
	case span <= 24*time.Hour:
		return "5m"
	case span <= 7*24*time.Hour:
		return "30m"
	default:
		return "1h"
	}
}

// bucketToInterval converts short bucket notations to valid Postgres intervals
func bucketToInterval(bucket string) (string, bool) {
	switch strings.ToLower(bucket) {
	case "1s", "1sec", "1second":
		return "1 second", true
	case "5s", "5sec", "5seconds":
		return "5 seconds", true
	case "10s", "10sec", "10seconds":
		return "10 seconds", true
	case "30s", "30sec", "30seconds":
		return "30 seconds", true
	case "1m", "1min", "1minute":
		return "1 minute", true
	case "5m", "5min", "5minutes":
		return "5 minutes", true
	case "10m", "10min", "10minutes":
		return "10 minutes", true
	case "15m", "15min", "15minutes":
		return "15 minutes", true
	case "30m", "30min", "30minutes":
		return "30 minutes", true
	case "1h", "1hour":
		return "1 hour", true
	case "6h", "6hours":
		return "6 hours", true
	case "12h", "12hours":
		return "12 hours", true
	case "1d", "1day":
		return "1 day", true
	default:
		return "", false
	}
}

// GetTelemetryHistoryHandler handles GET /api/telemetry/history
func GetTelemetryHistoryHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := r.URL.Query()

	// 1. Extract datapoints to query
	rawDatapoints := query["datapointId"]
	var datapointIDs []string
	for _, item := range rawDatapoints {
		for _, part := range strings.Split(item, ",") {
			part = strings.TrimSpace(part)
			if part != "" {
				datapointIDs = append(datapointIDs, part)
			}
		}
	}

	if len(datapointIDs) == 0 {
		http.Error(w, "Query parameter 'datapointId' is required", http.StatusBadRequest)
		return
	}

	// 2. Parse time window (from / to)
	now := time.Now().UTC()
	toTime, _ := parseRelativeOrAbsoluteTime(query.Get("to"), now, 0)
	fromTime, _ := parseRelativeOrAbsoluteTime(query.Get("from"), toTime, 1*time.Hour)

	if fromTime.After(toTime) {
		fromTime, toTime = toTime, fromTime
	}

	// 3. Determine bucket & aggregation function
	bucketParam := strings.ToLower(strings.TrimSpace(query.Get("bucket")))
	if bucketParam == "" || bucketParam == "auto" {
		bucketParam = pickAutoBucket(toTime.Sub(fromTime))
	}

	rawAggParam := strings.ToLower(strings.TrimSpace(query.Get("agg")))
	var valExpr string
	var aggResponse string

	switch rawAggParam {
	case "delta":
		valExpr = "COALESCE(last(val_num, time) - first(val_num, time), 0)"
		aggResponse = "delta"
	case "last":
		valExpr = "last(val_num, time)"
		aggResponse = "last"
	case "first":
		valExpr = "first(val_num, time)"
		aggResponse = "first"
	case "min":
		valExpr = "MIN(val_num)"
		aggResponse = "min"
	case "max":
		valExpr = "MAX(val_num)"
		aggResponse = "max"
	case "sum":
		valExpr = "SUM(val_num)"
		aggResponse = "sum"
	case "count":
		valExpr = "COUNT(val_num)"
		aggResponse = "count"
	case "avg":
		valExpr = "AVG(val_num)"
		aggResponse = "avg"
	default:
		// When no aggregation is explicitly requested:
		if bucketParam == "raw" {
			valExpr = "val_num"
			aggResponse = ""
		} else {
			valExpr = "AVG(val_num)"
			aggResponse = ""
		}
	}

	resp := HistoryResponse{
		From:   fromTime,
		To:     toTime,
		Bucket: bucketParam,
		Agg:    aggResponse,
		Series: make([]HistorySeries, 0, len(datapointIDs)),
	}

	pgInterval, isBucket := bucketToInterval(bucketParam)

	// 4. Query each datapoint series
	for _, dpID := range datapointIDs {
		series := HistorySeries{
			DataPointId: dpID,
			Points:      make([]HistoryPoint, 0),
		}

		// Retrieve metadata for this datapoint (name, unit, machine)
		metaSql := `
		SELECT datapoint_name, machine_id, unit 
		FROM line_telemetry 
		WHERE datapoint_id = $1 
		ORDER BY time DESC 
		LIMIT 1
		`
		var metaName, metaMachine, metaUnit pgtype.Text
		if err := Conn.QueryRow(ctx, metaSql, dpID).Scan(&metaName, &metaMachine, &metaUnit); err == nil {
			series.DataPointName = metaName.String
			series.MachineId = metaMachine.String
			if metaUnit.Valid && metaUnit.String != "" {
				u := metaUnit.String
				series.Unit = &u
			}
		}

		if isBucket && bucketParam != "raw" {
			// Query with TimescaleDB time_bucket aggregation
			sql := fmt.Sprintf(`
			SELECT time_bucket('%s', time) AS bucket,
			       %s AS val,
			       MIN(val_num) AS min_val,
			       MAX(val_num) AS max_val,
			       COUNT(val_num) AS count_val
			FROM line_telemetry
			WHERE datapoint_id = $1
			  AND time >= $2 AND time <= $3
			  AND val_num IS NOT NULL
			GROUP BY bucket
			ORDER BY bucket ASC
			`, pgInterval, valExpr)

			rows, err := Conn.Query(ctx, sql, dpID, fromTime, toTime)
			if err != nil {
				Logger.Warn("failed to query time_bucket history", "datapointId", dpID, "error", err)
				continue
			}

			for rows.Next() {
				var bTime time.Time
				var val, minVal, maxVal pgtype.Float8
				var countVal pgtype.Int8

				if err := rows.Scan(&bTime, &val, &minVal, &maxVal, &countVal); err == nil && val.Valid {
					pt := HistoryPoint{
						Time:  bTime.UTC(),
						Value: val.Float64,
					}
					// Only attach Count, Min, Max when multiple points were aggregated
					// so they represent real statistical downsampling rather than echoing Value
					if countVal.Valid && countVal.Int64 > 1 {
						c := countVal.Int64
						pt.Count = &c
						if minVal.Valid && minVal.Float64 != val.Float64 {
							minF := minVal.Float64
							pt.Min = &minF
						}
						if maxVal.Valid && maxVal.Float64 != val.Float64 {
							maxF := maxVal.Float64
							pt.Max = &maxF
						}
					}
					series.Points = append(series.Points, pt)
				}
			}
			rows.Close()
		} else {
			// Query raw telemetry points with a safe cap
			sql := `
			SELECT time, val_num
			FROM line_telemetry
			WHERE datapoint_id = $1
			  AND time >= $2 AND time <= $3
			  AND val_num IS NOT NULL
			ORDER BY time ASC
			LIMIT 3000
			`
			rows, err := Conn.Query(ctx, sql, dpID, fromTime, toTime)
			if err != nil {
				Logger.Warn("failed to query raw history", "datapointId", dpID, "error", err)
				continue
			}

			for rows.Next() {
				var ptTime time.Time
				var val pgtype.Float8
				if err := rows.Scan(&ptTime, &val); err == nil && val.Valid {
					series.Points = append(series.Points, HistoryPoint{
						Time:  ptTime.UTC(),
						Value: val.Float64,
					})
				}
			}
			rows.Close()
		}

		resp.Series = append(resp.Series, series)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}
