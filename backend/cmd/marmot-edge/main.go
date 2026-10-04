package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"marmot-backend-service/internal/edge"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func main() {
	_ = godotenv.Load()

	lvlStr := getEnv("LOG_LEVEL", "INFO")
	var lvl slog.Leveler
	switch lvlStr {
	case "DEBUG":
		lvl = slog.LevelDebug
	case "WARN":
		lvl = slog.LevelWarn
	case "ERROR":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: lvl}))
	logger.Info("starting Marmot Edge IoT Gateway...")

	brokerURL := getEnv("MQTT_BROKER_URL", "tcp://localhost:1883")
	mqttTopic := getEnv("MQTT_TOPIC", "#")
	clientID := getEnv("MQTT_CLIENT_ID", fmt.Sprintf("marmot-edge-%d", time.Now().Unix()))
	edgePort := getEnv("EDGE_PORT", "3001")
	cloudURL := getEnv("CLOUD_API_URL", "http://127.0.0.1:3000")
	siteID := getEnv("SITE_ID", "plant-edge-01")
	siteName := getEnv("SITE_NAME", "Factory Edge 01")

	syncIntervalStr := getEnv("SYNC_INTERVAL", "1h")
	syncInterval, err := time.ParseDuration(syncIntervalStr)
	if err != nil {
		syncInterval = 1 * time.Hour
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Initialize Hub & Catalog Tracker
	hub := edge.NewHub(logger)
	tracker := edge.NewCatalogTracker(logger)

	// 2. Start Cloud Metadata Sync Worker
	tracker.StartSyncWorker(ctx, cloudURL, siteID, siteName, syncInterval)

	// 3. Connect to MQTT Broker
	mqttSub, err := edge.NewMqttSubscriber(brokerURL, clientID, mqttTopic, hub, tracker, logger)
	if err != nil {
		logger.Error("could not connect to MQTT broker", "error", err)
	} else {
		defer mqttSub.Close()
	}

	// 4. Setup HTTP & WebSocket routes
	router := chi.NewRouter()
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// WebSocket live streaming endpoint
	router.Get("/ws", hub.ServeWS)
	router.Get("/api/ws", hub.ServeWS)

	// Health and diagnostic endpoints
	router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":             "ok",
			"site_id":            siteID,
			"connected_clients":  hub.ClientCount(),
			"tracked_datapoints": tracker.Count(),
			"broker":             brokerURL,
		})
	})

	router.Get("/api/edge/catalog", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(tracker.GetAll())
	})

	server := &http.Server{
		Addr:    fmt.Sprintf("127.0.0.1:%s", edgePort),
		Handler: router,
	}

	go func() {
		logger.Info("marmot-edge listening", "port", edgePort, "ws_url", fmt.Sprintf("ws://localhost:%s/ws", edgePort))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("edge http server failed", "error", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down Marmot Edge gateway...")
	cancel()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	_ = server.Shutdown(shutdownCtx)
	logger.Info("marmot-edge stopped")
}
