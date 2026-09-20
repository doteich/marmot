package edge

import (
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow any origin for local dev and cross-origin HMI access
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// Hub maintains the set of active WebSocket clients and broadcasts telemetry
type Hub struct {
	logger  *slog.Logger
	mu      sync.RWMutex
	clients map[*websocket.Conn]bool
}

func NewHub(logger *slog.Logger) *Hub {
	return &Hub{
		logger:  logger,
		clients: make(map[*websocket.Conn]bool),
	}
}

// ClientCount returns the number of active connected clients
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Register adds a new client connection
func (h *Hub) Register(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[conn] = true
	h.logger.Info("client connected to live telemetry stream",
		"remote_addr", conn.RemoteAddr().String(),
		"total_clients", len(h.clients),
	)
}

// Unregister removes a client connection
func (h *Hub) Unregister(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[conn]; ok {
		delete(h.clients, conn)
		_ = conn.Close()
		h.logger.Info("client disconnected from live telemetry stream",
			"remote_addr", conn.RemoteAddr().String(),
			"total_clients", len(h.clients),
		)
	}
}

// Broadcast sends a raw message to all connected clients
func (h *Hub) Broadcast(msg []byte) {
	h.mu.RLock()
	clientsToBroadcast := make([]*websocket.Conn, 0, len(h.clients))
	for conn := range h.clients {
		clientsToBroadcast = append(clientsToBroadcast, conn)
	}
	h.mu.RUnlock()

	if len(clientsToBroadcast) == 0 {
		return
	}

	for _, conn := range clientsToBroadcast {
		_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
		err := conn.WriteMessage(websocket.TextMessage, msg)
		if err != nil {
			h.logger.Warn("error writing to client, dropping connection", "error", err, "client", conn.RemoteAddr().String())
			h.Unregister(conn)
		}
	}
}

// ServeWS upgrades the HTTP connection to WebSocket and registers with Hub
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.Error("websocket upgrade failed", "error", err)
		return
	}

	h.Register(conn)

	// Keep connection alive and wait for close/ping/pong
	go func() {
		defer h.Unregister(conn)
		conn.SetReadLimit(4096)
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		conn.SetPongHandler(func(string) error {
			_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			return nil
		})

		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()
}
