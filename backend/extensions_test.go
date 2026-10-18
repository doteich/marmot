package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidateManifest(t *testing.T) {
	tests := []struct {
		name        string
		manifest    ExtensionManifest
		expectError bool
		errMsg      string
	}{
		{
			name: "Valid manifest",
			manifest: ExtensionManifest{
				ID:          "tank-level",
				Name:        "Industrial Tank Level",
				Version:     "1.0.0",
				Category:    "indicator",
				Description: "Tank gauge with liquid fill",
				DefaultSize: WidgetSize{Width: 200, Height: 300},
				DefaultProps: map[string]interface{}{
					"capacity": 1000,
				},
			},
			expectError: false,
		},
		{
			name: "Empty ID",
			manifest: ExtensionManifest{
				ID:          "",
				Name:        "Tank Level",
				Version:     "1.0.0",
				Category:    "indicator",
				DefaultSize: WidgetSize{Width: 100, Height: 100},
			},
			expectError: true,
			errMsg:      "missing 'id'",
		},
		{
			name: "Reserved ID",
			manifest: ExtensionManifest{
				ID:          "gauge",
				Name:        "Custom Gauge",
				Version:     "1.0.0",
				Category:    "indicator",
				DefaultSize: WidgetSize{Width: 100, Height: 100},
			},
			expectError: true,
			errMsg:      "reserved built-in widget identifier",
		},
		{
			name: "Invalid ID with uppercase and underscores",
			manifest: ExtensionManifest{
				ID:          "Tank_Level",
				Name:        "Tank Level",
				Version:     "1.0.0",
				Category:    "indicator",
				DefaultSize: WidgetSize{Width: 100, Height: 100},
			},
			expectError: true,
			errMsg:      "lower-case alphanumeric with hyphens",
		},
		{
			name: "Invalid category",
			manifest: ExtensionManifest{
				ID:          "tank-level",
				Name:        "Tank Level",
				Version:     "1.0.0",
				Category:    "unknown-category",
				DefaultSize: WidgetSize{Width: 100, Height: 100},
			},
			expectError: true,
			errMsg:      "invalid category",
		},
		{
			name: "Invalid size zero",
			manifest: ExtensionManifest{
				ID:          "tank-level",
				Name:        "Tank Level",
				Version:     "1.0.0",
				Category:    "indicator",
				DefaultSize: WidgetSize{Width: 0, Height: 200},
			},
			expectError: true,
			errMsg:      "positive numbers",
		},
		{
			name: "Path traversal entry",
			manifest: ExtensionManifest{
				ID:          "tank-level",
				Name:        "Tank Level",
				Version:     "1.0.0",
				Category:    "indicator",
				Entry:       "../../etc/passwd",
				DefaultSize: WidgetSize{Width: 100, Height: 100},
			},
			expectError: true,
			errMsg:      "invalid entry path",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validateManifest(&tc.manifest)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error containing '%s', got nil", tc.errMsg)
				}
				if !strings.Contains(err.Error(), tc.errMsg) {
					t.Fatalf("expected error containing '%s', got '%v'", tc.errMsg, err)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			}
		})
	}
}

func createZip(files map[string][]byte) ([]byte, error) {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)
	for name, content := range files {
		f, err := zw.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := f.Write(content); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func TestUploadExtensionZipValidation(t *testing.T) {
	// 1. Missing manifest.json
	noManifestZip, _ := createZip(map[string][]byte{
		"bundle.js": []byte("export default {}"),
	})

	body := new(bytes.Buffer)
	mw := multipart.NewWriter(body)
	part, _ := mw.CreateFormFile("file", "no-manifest.zip")
	_, _ = io.Copy(part, bytes.NewReader(noManifestZip))
	_ = mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/extensions/upload", body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()

	UploadExtensionHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for missing manifest, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "manifest.json not found") {
		t.Fatalf("unexpected error response: %s", w.Body.String())
	}

	// 2. Missing bundle.js
	manifestObj := ExtensionManifest{
		ID:          "my-sensor",
		Name:        "My Sensor",
		Version:     "1.0.0",
		Category:    "indicator",
		DefaultSize: WidgetSize{Width: 100, Height: 100},
	}
	manifestJson, _ := json.Marshal(manifestObj)
	noBundleZip, _ := createZip(map[string][]byte{
		"manifest.json": manifestJson,
	})

	body = new(bytes.Buffer)
	mw = multipart.NewWriter(body)
	part, _ = mw.CreateFormFile("file", "no-bundle.zip")
	_, _ = io.Copy(part, bytes.NewReader(noBundleZip))
	_ = mw.Close()

	req = httptest.NewRequest(http.MethodPost, "/api/extensions/upload", body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w = httptest.NewRecorder()

	UploadExtensionHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for missing bundle file, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "Declared entry point") {
		t.Fatalf("unexpected error response: %s", w.Body.String())
	}
}
