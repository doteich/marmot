package edge

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"marmot-backend-service/pkg/models"
)

type MqttSubscriber struct {
	client  mqtt.Client
	logger  *slog.Logger
	hub     *Hub
	tracker *CatalogTracker
	topic   string
}

func NewMqttSubscriber(brokerURL, clientID, topic string, hub *Hub, tracker *CatalogTracker, logger *slog.Logger) (*MqttSubscriber, error) {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(brokerURL)
	opts.SetClientID(clientID)
	opts.SetKeepAlive(30 * time.Second)
	opts.SetPingTimeout(10 * time.Second)
	opts.SetAutoReconnect(true)
	opts.SetMaxReconnectInterval(5 * time.Second)

	opts.SetOnConnectHandler(func(c mqtt.Client) {
		logger.Info("connected to MQTT broker", "broker", brokerURL)
		if token := c.Subscribe(topic, 1, nil); token.Wait() && token.Error() != nil {
			logger.Error("failed to subscribe to MQTT topic", "topic", topic, "error", token.Error())
		} else {
			logger.Info("subscribed to MQTT topic", "topic", topic)
		}
	})

	opts.SetConnectionLostHandler(func(_ mqtt.Client, err error) {
		logger.Warn("connection to MQTT broker lost", "error", err)
	})

	sub := &MqttSubscriber{
		logger:  logger,
		hub:     hub,
		tracker: tracker,
		topic:   topic,
	}

	opts.SetDefaultPublishHandler(sub.handleMessage)

	client := mqtt.NewClient(opts)
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		return nil, fmt.Errorf("failed to initiate MQTT connection: %w", token.Error())
	}

	sub.client = client
	return sub, nil
}

func (s *MqttSubscriber) handleMessage(_ mqtt.Client, msg mqtt.Message) {
	payload := msg.Payload()

	// 1. Parse JSON to register distinct datapoint in catalog tracker
	var telemetry models.TelemetryMessage
	if err := json.Unmarshal(payload, &telemetry); err == nil && telemetry.DataPointId != "" {
		s.tracker.Track(&telemetry)
	}

	// 2. DROP WHEN NO CLIENTS:
	// If no WebSocket clients are connected, do not waste CPU or memory buffering
	if s.hub.ClientCount() == 0 {
		return
	}

	// 3. Broadcast raw JSON to all active WebSocket clients
	s.hub.Broadcast(payload)
}

func (s *MqttSubscriber) Close() {
	if s.client != nil && s.client.IsConnected() {
		s.client.Unsubscribe(s.topic)
		s.client.Disconnect(250)
	}
}
