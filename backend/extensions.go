package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/minio/minio-go/v7"
)

const (
	ExtensionsBucketName = "extensions"
	MaxZipUploadBytes    = 5 << 20  // 5 MB max uploaded zip
	MaxUncompressedBytes = 25 << 20 // 25 MB max uncompressed zip payload
)

var validIDRegex = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

var reservedWidgetIDs = map[string]bool{
	"svg-machine":   true,
	"gauge":         true,
	"traffic-light": true,
	"trend-chart":   true,
	"chart":         true,
	"bar-chart":     true,
	"text-label":    true,
}

var validCategories = map[string]bool{
	"layout":     true,
	"indicator":  true,
	"chart":      true,
	"annotation": true,
	"custom":     true,
}

// WidgetSize defines default dimensions
type WidgetSize struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

// ExtensionManifest defines the schema required in manifest.json
type ExtensionManifest struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	Version      string                 `json:"version"`
	Category     string                 `json:"category"`
	Description  string                 `json:"description,omitempty"`
	Author       string                 `json:"author,omitempty"`
	Entry        string                 `json:"entry,omitempty"`
	DefaultSize  WidgetSize             `json:"defaultSize"`
	DefaultProps map[string]interface{} `json:"defaultProps"`
}

// ExtensionRecord represents the database & API response model
type ExtensionRecord struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Version     string            `json:"version"`
	Category    string            `json:"category"`
	Description string            `json:"description"`
	Author      string            `json:"author"`
	Manifest    ExtensionManifest `json:"manifest"`
	BundlePath  string            `json:"bundlePath"`
	BundleUrl   string            `json:"bundleUrl"`
	Enabled     bool              `json:"enabled"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
}

// InitExtensionsTable ensures the PostgreSQL table and MinIO bucket exist
func InitExtensionsTable(ctx context.Context) error {
	sql := `
	CREATE TABLE IF NOT EXISTS extensions (
		id          VARCHAR(64) PRIMARY KEY,
		name        VARCHAR(255) NOT NULL,
		version     VARCHAR(32) NOT NULL,
		category    VARCHAR(32) DEFAULT 'custom',
		description TEXT,
		author      VARCHAR(128),
		manifest    JSONB NOT NULL,
		bundle_path TEXT NOT NULL,
		enabled     BOOLEAN DEFAULT TRUE,
		created_at  TIMESTAMPTZ DEFAULT NOW(),
		updated_at  TIMESTAMPTZ DEFAULT NOW()
	);`
	if _, err := Conn.Exec(ctx, sql); err != nil {
		return fmt.Errorf("failed to create extensions table: %w", err)
	}

	if MinioClient != nil {
		exists, err := MinioClient.BucketExists(ctx, ExtensionsBucketName)
		if err != nil {
			Logger.Warn("could not check MinIO extensions bucket", "error", err)
		} else if !exists {
			if err := MinioClient.MakeBucket(ctx, ExtensionsBucketName, minio.MakeBucketOptions{}); err != nil {
				Logger.Warn("could not create MinIO extensions bucket", "error", err)
			} else {
				Logger.Info("created MinIO extensions bucket", "bucket", ExtensionsBucketName)
			}
		}
	}

	return nil
}

// validateManifest enforces schema correctness
func validateManifest(m *ExtensionManifest) error {
	m.ID = strings.TrimSpace(m.ID)
	if m.ID == "" {
		return fmt.Errorf("manifest is missing 'id'")
	}
	if len(m.ID) < 3 || len(m.ID) > 64 {
		return fmt.Errorf("extension 'id' must be between 3 and 64 characters")
	}
	if !validIDRegex.MatchString(m.ID) {
		return fmt.Errorf("extension 'id' must be lower-case alphanumeric with hyphens (e.g. 'tank-level')")
	}
	if reservedWidgetIDs[m.ID] {
		return fmt.Errorf("extension 'id' '%s' is a reserved built-in widget identifier", m.ID)
	}

	m.Name = strings.TrimSpace(m.Name)
	if m.Name == "" {
		return fmt.Errorf("manifest is missing 'name'")
	}
	if len(m.Name) > 100 {
		return fmt.Errorf("extension 'name' cannot exceed 100 characters")
	}

	m.Version = strings.TrimSpace(m.Version)
	if m.Version == "" {
		return fmt.Errorf("manifest is missing 'version'")
	}
	if len(m.Version) > 32 {
		return fmt.Errorf("extension 'version' cannot exceed 32 characters")
	}

	m.Category = strings.ToLower(strings.TrimSpace(m.Category))
	if m.Category == "" {
		m.Category = "custom"
	}
	if !validCategories[m.Category] {
		return fmt.Errorf("invalid category '%s'. Must be one of: layout, indicator, chart, annotation, custom", m.Category)
	}

	if m.Entry == "" {
		m.Entry = "bundle.js"
	} else {
		m.Entry = path.Clean(strings.TrimSpace(m.Entry))
		if strings.Contains(m.Entry, "..") || strings.HasPrefix(m.Entry, "/") || strings.HasPrefix(m.Entry, "\\") {
			return fmt.Errorf("invalid entry path '%s'", m.Entry)
		}
	}

	if m.DefaultSize.Width <= 0 || m.DefaultSize.Height <= 0 {
		return fmt.Errorf("defaultSize width and height must be positive numbers")
	}
	if m.DefaultSize.Width > 4000 || m.DefaultSize.Height > 4000 {
		return fmt.Errorf("defaultSize dimensions exceed maximum 4000px")
	}

	if m.DefaultProps == nil {
		m.DefaultProps = make(map[string]interface{})
	}

	return nil
}

// UploadExtensionHandler handles zip upload, validation, extraction, MinIO persistence and DB registration
func UploadExtensionHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Enforce size limit on request
	r.Body = http.MaxBytesReader(w, r.Body, MaxZipUploadBytes)
	if err := r.ParseMultipartForm(MaxZipUploadBytes); err != nil {
		http.Error(w, fmt.Sprintf("File too large or invalid multipart form (limit %d MB)", MaxZipUploadBytes>>20), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Missing 'file' field in multipart form", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if !strings.HasSuffix(strings.ToLower(header.Filename), ".zip") {
		http.Error(w, "Uploaded file must be a .zip extension bundle", http.StatusBadRequest)
		return
	}

	zipBytes, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read uploaded zip file", http.StatusInternalServerError)
		return
	}

	// 2. Open zip archive
	zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse zip archive: %v", err), http.StatusBadRequest)
		return
	}

	// 3. Find root directory inside zip (if files are nested in a folder)
	var manifestEntry *zip.File
	var rootPrefix string

	// Look for manifest.json
	for _, f := range zipReader.File {
		if strings.Contains(f.Name, "..") {
			http.Error(w, "Zip archive contains invalid relative paths (zip-slip detected)", http.StatusBadRequest)
			return
		}
		cleanName := strings.TrimPrefix(path.Clean(f.Name), "/")
		if path.Base(cleanName) == "manifest.json" {
			manifestEntry = f
			dir := path.Dir(cleanName)
			if dir != "." {
				rootPrefix = dir + "/"
			}
			break
		}
	}

	if manifestEntry == nil {
		http.Error(w, "Invalid bundle: manifest.json not found in archive root", http.StatusBadRequest)
		return
	}

	// 4. Read & validate manifest.json
	manifestRc, err := manifestEntry.Open()
	if err != nil {
		http.Error(w, "Failed to open manifest.json in archive", http.StatusBadRequest)
		return
	}
	manifestBytes, err := io.ReadAll(manifestRc)
	manifestRc.Close()
	if err != nil {
		http.Error(w, "Failed to read manifest.json", http.StatusBadRequest)
		return
	}

	var manifest ExtensionManifest
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse manifest.json: %v", err), http.StatusBadRequest)
		return
	}

	if err := validateManifest(&manifest); err != nil {
		http.Error(w, fmt.Sprintf("Manifest schema validation failed: %v", err), http.StatusBadRequest)
		return
	}

	// 5. Locate bundle entry file (e.g. bundle.js)
	targetBundlePath := rootPrefix + manifest.Entry
	var bundleEntry *zip.File
	var iconBytes []byte

	var totalUncompressed int64
	for _, f := range zipReader.File {
		cleanName := strings.TrimPrefix(path.Clean(f.Name), "/")
		totalUncompressed += int64(f.UncompressedSize64)
		if totalUncompressed > MaxUncompressedBytes {
			http.Error(w, fmt.Sprintf("Uncompressed zip payload exceeds limit of %d MB", MaxUncompressedBytes>>20), http.StatusBadRequest)
			return
		}

		if cleanName == targetBundlePath {
			bundleEntry = f
		} else if path.Base(cleanName) == "icon.svg" {
			rc, err := f.Open()
			if err == nil {
				iconBytes, _ = io.ReadAll(rc)
				rc.Close()
			}
		}
	}

	if bundleEntry == nil {
		http.Error(w, fmt.Sprintf("Declared entry point '%s' not found in zip archive", manifest.Entry), http.StatusBadRequest)
		return
	}

	bundleRc, err := bundleEntry.Open()
	if err != nil {
		http.Error(w, "Failed to open bundle file in archive", http.StatusBadRequest)
		return
	}
	bundleBytes, err := io.ReadAll(bundleRc)
	bundleRc.Close()
	if err != nil {
		http.Error(w, "Failed to read bundle file", http.StatusBadRequest)
		return
	}

	if len(bundleBytes) == 0 {
		http.Error(w, "Bundle entry point file is empty", http.StatusBadRequest)
		return
	}

	// 6. Upload bundle & manifest to MinIO
	ctx := r.Context()
	minioBundleKey := fmt.Sprintf("%s/%s/bundle.js", manifest.ID, manifest.Version)
	minioManifestKey := fmt.Sprintf("%s/%s/manifest.json", manifest.ID, manifest.Version)

	_, err = MinioClient.PutObject(ctx, ExtensionsBucketName, minioBundleKey, bytes.NewReader(bundleBytes), int64(len(bundleBytes)), minio.PutObjectOptions{
		ContentType: "application/javascript; charset=utf-8",
	})
	if err != nil {
		Logger.Error("failed to persist extension bundle to MinIO", "id", manifest.ID, "error", err)
		http.Error(w, "Failed to persist extension bundle in storage", http.StatusInternalServerError)
		return
	}

	normalizedManifestBytes, _ := json.MarshalIndent(manifest, "", "  ")
	_, err = MinioClient.PutObject(ctx, ExtensionsBucketName, minioManifestKey, bytes.NewReader(normalizedManifestBytes), int64(len(normalizedManifestBytes)), minio.PutObjectOptions{
		ContentType: "application/json",
	})
	if err != nil {
		Logger.Error("failed to persist extension manifest to MinIO", "id", manifest.ID, "error", err)
	}

	if len(iconBytes) > 0 {
		minioIconKey := fmt.Sprintf("%s/%s/icon.svg", manifest.ID, manifest.Version)
		_, _ = MinioClient.PutObject(ctx, ExtensionsBucketName, minioIconKey, bytes.NewReader(iconBytes), int64(len(iconBytes)), minio.PutObjectOptions{
			ContentType: "image/svg+xml",
		})
	}

	// 7. Upsert record in PostgreSQL
	sql := `
	INSERT INTO extensions (id, name, version, category, description, author, manifest, bundle_path, enabled, updated_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
	ON CONFLICT (id) DO UPDATE SET
		name = EXCLUDED.name,
		version = EXCLUDED.version,
		category = EXCLUDED.category,
		description = EXCLUDED.description,
		author = EXCLUDED.author,
		manifest = EXCLUDED.manifest,
		bundle_path = EXCLUDED.bundle_path,
		enabled = TRUE,
		updated_at = NOW();`

	manifestJson, _ := json.Marshal(manifest)
	_, err = Conn.Exec(ctx, sql,
		manifest.ID,
		manifest.Name,
		manifest.Version,
		manifest.Category,
		manifest.Description,
		manifest.Author,
		manifestJson,
		minioBundleKey,
	)
	if err != nil {
		Logger.Error("failed to record extension in database", "id", manifest.ID, "error", err)
		// Clean up MinIO object if DB insert failed
		_ = MinioClient.RemoveObject(ctx, ExtensionsBucketName, minioBundleKey, minio.RemoveObjectOptions{})
		http.Error(w, "Failed to save extension metadata to database", http.StatusInternalServerError)
		return
	}

	record := ExtensionRecord{
		ID:          manifest.ID,
		Name:        manifest.Name,
		Version:     manifest.Version,
		Category:    manifest.Category,
		Description: manifest.Description,
		Author:      manifest.Author,
		Manifest:    manifest,
		BundlePath:  minioBundleKey,
		BundleUrl:   fmt.Sprintf("/api/extensions/%s/bundle", manifest.ID),
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	Logger.Info("extension uploaded and registered successfully", "id", manifest.ID, "version", manifest.Version)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"message":   fmt.Sprintf("Extension '%s' (v%s) registered successfully", manifest.Name, manifest.Version),
		"extension": record,
	})
}

// ListExtensionsHandler lists all registered extensions
func ListExtensionsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	sql := `
	SELECT id, name, version, category, description, author, manifest, bundle_path, enabled, created_at, updated_at
	FROM extensions
	ORDER BY created_at DESC`

	rows, err := Conn.Query(ctx, sql)
	if err != nil {
		Logger.Error("failed to query extensions", "error", err)
		http.Error(w, "Failed to query extensions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	list := make([]ExtensionRecord, 0)
	for rows.Next() {
		var rec ExtensionRecord
		var desc, author *string
		var manifestRaw []byte
		if err := rows.Scan(
			&rec.ID,
			&rec.Name,
			&rec.Version,
			&rec.Category,
			&desc,
			&author,
			&manifestRaw,
			&rec.BundlePath,
			&rec.Enabled,
			&rec.CreatedAt,
			&rec.UpdatedAt,
		); err != nil {
			Logger.Warn("error scanning extension row", "error", err)
			continue
		}
		if desc != nil {
			rec.Description = *desc
		}
		if author != nil {
			rec.Author = *author
		}
		_ = json.Unmarshal(manifestRaw, &rec.Manifest)
		rec.BundleUrl = fmt.Sprintf("/api/extensions/%s/bundle", rec.ID)
		list = append(list, rec)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(list)
}

// GetExtensionBundleHandler serves the javascript bundle directly from MinIO
func GetExtensionBundleHandler(w http.ResponseWriter, r *http.Request) {
	extID := chi.URLParam(r, "id")
	if extID == "" {
		http.Error(w, "Missing extension ID", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var bundlePath string
	var enabled bool
	sql := `SELECT bundle_path, enabled FROM extensions WHERE id = $1`
	err := Conn.QueryRow(ctx, sql, extID).Scan(&bundlePath, &enabled)
	if err != nil {
		http.Error(w, "Extension not found", http.StatusNotFound)
		return
	}

	if !enabled {
		http.Error(w, "Extension is disabled", http.StatusForbidden)
		return
	}

	obj, err := MinioClient.GetObject(ctx, ExtensionsBucketName, bundlePath, minio.GetObjectOptions{})
	if err != nil {
		Logger.Error("failed to get extension bundle from MinIO", "id", extID, "error", err)
		http.Error(w, "Failed to retrieve bundle file from storage", http.StatusInternalServerError)
		return
	}
	defer obj.Close()

	stat, err := obj.Stat()
	if err != nil {
		http.Error(w, "Failed to stat bundle file in storage", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", stat.Size))
	_, _ = io.Copy(w, obj)
}

// DeleteExtensionHandler deletes an extension from DB and MinIO
func DeleteExtensionHandler(w http.ResponseWriter, r *http.Request) {
	extID := chi.URLParam(r, "id")
	if extID == "" {
		http.Error(w, "Missing extension ID", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var bundlePath string
	sql := `DELETE FROM extensions WHERE id = $1 RETURNING bundle_path`
	err := Conn.QueryRow(ctx, sql, extID).Scan(&bundlePath)
	if err != nil {
		http.Error(w, "Extension not found or already deleted", http.StatusNotFound)
		return
	}

	// Remove MinIO bundle and related objects for this extension
	objectsCh := make(chan minio.ObjectInfo)
	go func() {
		defer close(objectsCh)
		for obj := range MinioClient.ListObjects(ctx, ExtensionsBucketName, minio.ListObjectsOptions{Prefix: extID + "/", Recursive: true}) {
			if obj.Err == nil {
				objectsCh <- obj
			}
		}
	}()

	for rErr := range MinioClient.RemoveObjects(ctx, ExtensionsBucketName, objectsCh, minio.RemoveObjectsOptions{}) {
		Logger.Warn("error removing MinIO object during extension delete", "error", rErr.Err)
	}

	Logger.Info("deleted extension", "id", extID)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Extension '%s' successfully uninstalled", extID),
	})
}

// ToggleExtensionHandler toggles the enabled state of an extension
func ToggleExtensionHandler(w http.ResponseWriter, r *http.Request) {
	extID := chi.URLParam(r, "id")
	if extID == "" {
		http.Error(w, "Missing extension ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	sql := `UPDATE extensions SET enabled = $1, updated_at = NOW() WHERE id = $2`
	tag, err := Conn.Exec(ctx, sql, req.Enabled, extID)
	if err != nil || tag.RowsAffected() == 0 {
		http.Error(w, "Extension not found or could not be updated", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      extID,
		"enabled": req.Enabled,
	})
}
