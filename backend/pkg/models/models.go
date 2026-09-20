package models

import "time"

// DataPoint represents a distinct industrial tag/metric metadata
type DataPoint struct {
	DataPointId   string  `json:"dataPointId"`
	DataPointName string  `json:"dataPointName"`
	MachineId     string  `json:"machineId"`
	DataType      string  `json:"dataType"`
	Unit          *string `json:"unit,omitempty"`
}

// TelemetryMessage represents the live streaming message structure from MQTT / OPC UA
type TelemetryMessage struct {
	DataPointId   string    `json:"dataPointId"`
	DataPointName string    `json:"dataPointName"`
	MachineId     string    `json:"machineId"`
	Value         any       `json:"value"`
	DataType      string    `json:"dataType"`
	Timestamp     time.Time `json:"timestamp"`
	Quality       string    `json:"quality,omitempty"`
	Unit          *string   `json:"unit,omitempty"`
}

// Site represents an edge plant/site configuration in Marmot Cloud
type Site struct {
	Id          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	WsUrl       string    `json:"wsUrl"`
	Status      string    `json:"status"`
	LastSeenAt  time.Time `json:"lastSeenAt"`
	CreatedAt   time.Time `json:"createdAt"`
}

// SyncDatapointsPayload is sent from marmot-edge to marmot-cloud
type SyncDatapointsPayload struct {
	SiteId     string      `json:"siteId"`
	SiteName   string      `json:"siteName,omitempty"`
	Datapoints []DataPoint `json:"datapoints"`
}
