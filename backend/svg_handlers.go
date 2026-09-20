package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/minio/minio-go/v7"
)

const SvgBucketName = "svgs"

type MachineLayout struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Tags         []string  `json:"tags"`
	Description  string    `json:"description"`
	SvgObjectKey string    `json:"svgObjectKey"`
	CreatedAt    time.Time `json:"createdAt"`
	SvgContent   string    `json:"svgContent,omitempty"`
}

func generateLayoutID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return fmt.Sprintf("layout-%d-%s", time.Now().Unix(), hex.EncodeToString(b))
}

// UploadSVGHandler handles multipart/form-data upload of SVG files
func UploadSVGHandler(w http.ResponseWriter, r *http.Request) {
	// Limit uploads to 10MB
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, "File too large or invalid multipart form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Missing 'file' form field in request", http.StatusBadRequest)
		return
	}
	defer file.Close()

	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		name = strings.TrimSuffix(header.Filename, ".svg")
		if name == "" {
			name = "Unnamed Machine Layout"
		}
	}

	description := strings.TrimSpace(r.FormValue("description"))
	tagsRaw := r.FormValue("tags")
	var tags []string
	if tagsRaw != "" {
		parts := strings.Split(tagsRaw, ",")
		for _, p := range parts {
			clean := strings.TrimSpace(p)
			if clean != "" {
				tags = append(tags, clean)
			}
		}
	}
	if tags == nil {
		tags = []string{}
	}

	// Read file contents
	rawBytes, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read uploaded file", http.StatusInternalServerError)
		return
	}

	// 1. Sanitize the SVG in Go:
	// - Strips XML prolog (<?xml...>) and DOCTYPE directives
	// - Strips dangerous <script>, <iframe> tags and event handlers (onload, onerror)
	// - Strips huge draw.io editor bloat attributes (e.g. content="<mxfile...>")
	// - Normalizes width/height to 100% and ensures viewBox exists for responsive layout scaling
	cleanBytes, err := SanitizeSVG(rawBytes)
	if err != nil {
		Logger.Error("SVG sanitization error", "error", err)
		http.Error(w, fmt.Sprintf("SVG sanitization failed: %v", err), http.StatusBadRequest)
		return
	}

	layoutID := generateLayoutID()
	objectKey := fmt.Sprintf("layouts/%s.svg", layoutID)

	// 2. Upload sanitized SVG to MinIO
	ctx := r.Context()
	_, err = MinioClient.PutObject(ctx, SvgBucketName, objectKey, bytes.NewReader(cleanBytes), int64(len(cleanBytes)), minio.PutObjectOptions{
		ContentType: "image/svg+xml",
	})
	if err != nil {
		Logger.Error("failed to store SVG in MinIO", "error", err)
		http.Error(w, "Failed to persist SVG in MinIO storage", http.StatusInternalServerError)
		return
	}

	// 3. Save layout metadata into PostgreSQL
	sql := `INSERT INTO machine_layouts (id, name, tags, description, svg_object_key, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW())`
	_, err = Conn.Exec(ctx, sql, layoutID, name, tags, description, objectKey)
	if err != nil {
		Logger.Error("failed to save layout metadata in Postgres", "error", err)
		// Clean up uploaded S3 object if database write fails
		_ = MinioClient.RemoveObject(ctx, SvgBucketName, objectKey, minio.RemoveObjectOptions{})
		http.Error(w, "Failed to save layout metadata", http.StatusInternalServerError)
		return
	}

	layout := MachineLayout{
		ID:           layoutID,
		Name:         name,
		Tags:         tags,
		Description:  description,
		SvgObjectKey: objectKey,
		CreatedAt:    time.Now(),
		SvgContent:   string(cleanBytes),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(layout)
}

// ListSVGHandler returns all machine layouts with search and tag filtering
func ListSVGHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	tag := strings.TrimSpace(r.URL.Query().Get("tag"))

	sql := `SELECT id, name, tags, description, svg_object_key, created_at FROM machine_layouts`
	var conditions []string
	var args []any

	if search != "" {
		args = append(args, "%"+search+"%")
		conditions = append(conditions, fmt.Sprintf("(name ILIKE $%d OR description ILIKE $%d)", len(args), len(args)))
	}
	if tag != "" {
		args = append(args, tag)
		conditions = append(conditions, fmt.Sprintf("$%d = ANY(tags)", len(args)))
	}

	if len(conditions) > 0 {
		sql += " WHERE " + strings.Join(conditions, " AND ")
	}
	sql += " ORDER BY created_at DESC"

	rows, err := Conn.Query(ctx, sql, args...)
	if err != nil {
		Logger.Error("failed to query machine layouts", "error", err)
		http.Error(w, "Database query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var layouts []MachineLayout
	for rows.Next() {
		var l MachineLayout
		var desc *string
		if err := rows.Scan(&l.ID, &l.Name, &l.Tags, &desc, &l.SvgObjectKey, &l.CreatedAt); err != nil {
			Logger.Error("failed to scan layout row", "error", err)
			continue
		}
		if desc != nil {
			l.Description = *desc
		}
		if l.Tags == nil {
			l.Tags = []string{}
		}
		layouts = append(layouts, l)
	}

	if layouts == nil {
		layouts = []MachineLayout{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"layouts": layouts})
}

// GetSVGContentHandler returns the raw SVG content from MinIO
func GetSVGContentHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "Missing layout ID", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// 1. Get object key from DB
	var objectKey string
	err := Conn.QueryRow(ctx, "SELECT svg_object_key FROM machine_layouts WHERE id = $1", id).Scan(&objectKey)
	if err != nil {
		http.Error(w, "Machine layout not found", http.StatusNotFound)
		return
	}

	// 2. Fetch object from MinIO
	obj, err := MinioClient.GetObject(ctx, SvgBucketName, objectKey, minio.GetObjectOptions{})
	if err != nil {
		http.Error(w, "Failed to read SVG from storage", http.StatusInternalServerError)
		return
	}
	defer obj.Close()

	w.Header().Set("Content-Type", "image/svg+xml")
	_, _ = io.Copy(w, obj)
}

// DeleteSVGHandler removes a layout from both Postgres and MinIO
func DeleteSVGHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "Missing layout ID", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var objectKey string
	err := Conn.QueryRow(ctx, "DELETE FROM machine_layouts WHERE id = $1 RETURNING svg_object_key", id).Scan(&objectKey)
	if err != nil {
		http.Error(w, "Machine layout not found", http.StatusNotFound)
		return
	}

	// Delete from MinIO
	_ = MinioClient.RemoveObject(ctx, SvgBucketName, objectKey, minio.RemoveObjectOptions{})

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "deleted"})
}
