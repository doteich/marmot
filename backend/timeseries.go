package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
)

type GetDataPointsInput struct {
	ServerId  string `query:"server_id" doc:"Filters datapoints by provided server id"`
	MachineId string `query:"machine_id" doc:"Filters datapoints by provided machine id"`
}

type GetDataPointsOutput struct {
	Body struct {
		Content []DataPoint `json:"datapoints"`
	}
}

type DataPoint struct {
	ServerId  string `json:"server_id"`
	MachineId string `json:"machine_id"`
	DataType  string `json:"datatype"`
	DataPoint string `json:"datapoint"`
}

func GetDatapoints(ctx context.Context, input *GetDataPointsInput) (*GetDataPointsOutput, error) {
	resp := new(GetDataPointsOutput)

	sql := `SELECT DISTINCT server_id,machine_id,data_point,data_type FROM line_telemetry `

	var conditions []string
	var args []any

	if input.MachineId != "" {
		args = append(args, input.MachineId)
		conditions = append(conditions, fmt.Sprintf("machine_id=$%d", len(args)))
	}
	if input.ServerId != "" {
		args = append(args, input.ServerId)
		conditions = append(conditions, fmt.Sprintf("server_id=$%d", len(args)))
	}
	if len(conditions) > 0 {
		sql += " WHERE " + strings.Join(conditions, " AND ")
	}

	rows, err := Conn.Query(ctx, sql, args...)
	if err != nil {
		return resp, err
	}

	defer rows.Close()

	var server_id, machine_id, data_point, data_type pgtype.Text

	for rows.Next() {
		if err := rows.Scan(&server_id, &machine_id, &data_point, &data_type); err != nil {
			return resp, err
		}
		resp.Body.Content = append(resp.Body.Content, DataPoint{
			ServerId:  server_id.String,
			MachineId: machine_id.String,
			DataPoint: data_point.String,
			DataType:  data_type.String,
		})
	}
	return resp, nil
}
