package main

import (
	"os"
	"strings"
	"testing"
)

func TestSanitizeSVG(t *testing.T) {
	// 1. Test stripping of <?xml>, <!DOCTYPE>, and dangerous <script>
	malicious := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" onload="alert('xss')">
  <script>alert('bad');</script>
  <rect x="0" y="0" width="100" height="50" fill="red" onclick="runCode()" />
</svg>`)

	clean, err := SanitizeSVG(malicious)
	if err != nil {
		t.Fatalf("SanitizeSVG failed: %v", err)
	}

	cleanStr := string(clean)

	if strings.Contains(cleanStr, "<?xml") {
		t.Errorf("Sanitized SVG should not contain <?xml")
	}
	if strings.Contains(cleanStr, "<!DOCTYPE") {
		t.Errorf("Sanitized SVG should not contain <!DOCTYPE")
	}
	if strings.Contains(cleanStr, "<script") {
		t.Errorf("Sanitized SVG should not contain <script>")
	}
	if strings.Contains(cleanStr, "onload") {
		t.Errorf("Sanitized SVG should not contain onload")
	}
	if strings.Contains(cleanStr, "onclick") {
		t.Errorf("Sanitized SVG should not contain onclick")
	}
	if !strings.Contains(cleanStr, "viewBox=\"0 0 200 100\"") {
		t.Errorf("Sanitized SVG should synthesize viewBox: got %s", cleanStr)
	}

	// 2. Test with sample.svg from the workspace root
	sampleData, err := os.ReadFile("../sample.svg")
	if err == nil {
		sampleClean, err := SanitizeSVG(sampleData)
		if err != nil {
			t.Fatalf("Failed to sanitize sample.svg: %v", err)
		}
		sampleCleanStr := string(sampleClean)
		if strings.Contains(sampleCleanStr, "content=") {
			t.Errorf("Sanitized sample.svg should not contain draw.io content attribute")
		}
		if !strings.Contains(sampleCleanStr, "data-cell-id=\"wYcdrV7rxjeMivQmTptT-7\"") {
			t.Errorf("Sanitized sample.svg should preserve data-cell-id attributes")
		}
	}
}
