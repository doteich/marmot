package edge

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"marmot-backend-service/pkg/models"
)

// CatalogTracker tracks distinct datapoints seen on the edge MQTT stream
type CatalogTracker struct {
	logger     *slog.Logger
	mu         sync.RWMutex
	datapoints map[string]models.DataPoint
	httpClient *http.Client
}

func NewCatalogTracker(logger *slog.Logger) *CatalogTracker {
	return &CatalogTracker{
		logger:     logger,
		datapoints: make(map[string]models.DataPoint),
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Track extracts metadata from incoming telemetry message and registers if new or updated
func (c *CatalogTracker) Track(msg *models.TelemetryMessage) {
	if msg == nil || msg.DataPointId == "" {
		return
	}

	c.mu.RLock()
	_, exists := c.datapoints[msg.DataPointId]
	c.mu.RUnlock()

	if exists {
		return
	}

	c.mu.Lock()
	c.datapoints[msg.DataPointId] = models.DataPoint{
		DataPointId:   msg.DataPointId,
		DataPointName: msg.DataPointName,
		MachineId:     msg.MachineId,
		DataType:      msg.DataType,
		Unit:          msg.Unit,
	}
	count := len(c.datapoints)
	c.mu.Unlock()

	c.logger.Debug("registered new datapoint from MQTT",
		"id", msg.DataPointId,
		"name", msg.DataPointName,
		"machine", msg.MachineId,
		"total_tracked", count,
	)
}

// GetAll returns a snapshot list of all tracked datapoints
func (c *CatalogTracker) GetAll() []models.DataPoint {
	c.mu.RLock()
	defer c.mu.RUnlock()

	list := make([]models.DataPoint, 0, len(c.datapoints))
	for _, dp := range c.datapoints {
		list = append(list, dp)
	}
	return list
}

// Count returns the number of unique tracked datapoints
func (c *CatalogTracker) Count() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.datapoints)
}

// SyncToCloud sends the tracked datapoint list to the Marmot Cloud service
func (c *CatalogTracker) SyncToCloud(ctx context.Context, cloudURL string, siteID string, siteName string) error {
	items := c.GetAll()
	if len(items) == 0 {
		c.logger.Debug("no datapoints to sync to cloud yet")
		return nil
	}

	payload := models.SyncDatapointsPayload{
		SiteId:     siteID,
		SiteName:   siteName,
		Datapoints: items,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal sync payload: %w", err)
	}

	targetURL := fmt.Sprintf("%s/api/edge/datapoints", cloudURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to build sync request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("cloud sync request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("cloud sync responded with status %d", resp.StatusCode)
	}

	c.logger.Info("successfully synced datapoints to cloud",
		"count", len(items),
		"cloud_url", cloudURL,
		"site_id", siteID,
		"site_name", siteName,
	)
	return nil
}

// StartSyncWorker begins a background loop pushing periodic updates to Marmot Cloud
func (c *CatalogTracker) StartSyncWorker(ctx context.Context, cloudURL string, siteID string, siteName string, interval time.Duration) {
	go func() {
		// Initial sync retry loop: retry every 15s until at least 1 successful sync with items
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(15 * time.Second):
				if c.Count() > 0 {
					if err := c.SyncToCloud(ctx, cloudURL, siteID, siteName); err == nil {
						c.logger.Info("initial cloud sync complete, switching to periodic interval", "interval", interval)
						goto PeriodicLoop
					} else {
						c.logger.Debug("initial sync attempt failed, will retry in 15s", "error", err)
					}
				}
			}
		}

	PeriodicLoop:
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := c.SyncToCloud(ctx, cloudURL, siteID, siteName); err != nil {
					c.logger.Warn("periodic cloud sync failed", "error", err)
				}
			}
		}
	}()
}
