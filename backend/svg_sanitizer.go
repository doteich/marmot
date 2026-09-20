package main

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
)

// SanitizeSVG processes, strips bloat, and secures SVG markup for inline DOM rendering.
//
// What it strips:
//  1. XML Processing Instructions (e.g. <?xml version="1.0" ... ?>) which are invalid in HTML5 inline DOM.
//  2. DOCTYPE directives (e.g. <!DOCTYPE svg ...>) which are unnecessary and can be an XML external entity (XXE) vector.
//  3. Dangerous executable tags (<script>, <iframe>, <object>, <embed>).
//  4. Inline JavaScript event handlers (e.g. onload, onclick, onerror).
//  5. Editor bloat attributes (such as draw.io's content="<mxfile...>" attribute, which can be hundreds of kilobytes).
//
// What it optimizes:
//  1. Sets width="100%" and height="100%" so the SVG scales responsively to fill its container.
//  2. Ensures a viewBox attribute exists (synthesizing it from width/height if missing).
func SanitizeSVG(raw []byte) ([]byte, error) {
	reader := bytes.NewReader(raw)
	decoder := xml.NewDecoder(reader)

	var out bytes.Buffer
	encoder := xml.NewEncoder(&out)

	skipDepth := 0
	foundSvg := false

	for {
		tok, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("invalid XML/SVG syntax: %w", err)
		}

		// If we are currently inside a discarded tag (e.g. <script>), skip everything until its closing tag
		if skipDepth > 0 {
			switch tok.(type) {
			case xml.StartElement:
				skipDepth++
			case xml.EndElement:
				skipDepth--
			}
			continue
		}

		switch t := tok.(type) {
		case xml.ProcInst:
			// Strip <?xml version="1.0" ... ?> prologs
			continue

		case xml.Directive:
			// Strip <!DOCTYPE ... > declarations
			continue

		case xml.Comment:
			// Strip XML comments
			continue

		case xml.StartElement:
			tagName := strings.ToLower(t.Name.Local)

			// Strip dangerous executable tags and skip their inner content
			if tagName == "script" || tagName == "iframe" || tagName == "object" || tagName == "embed" {
				skipDepth = 1
				continue
			}

			// Clean attributes
			cleanAttrs := make([]xml.Attr, 0, len(t.Attr))
			hasViewBox := false
			var widthVal, heightVal string

			for _, attr := range t.Attr {
				attrName := strings.ToLower(attr.Name.Local)

				// 1. Strip XSS event handlers
				if strings.HasPrefix(attrName, "on") {
					continue
				}

				// 2. Strip draw.io's huge bloat attribute: content="<mxfile...>"
				if tagName == "svg" && attrName == "content" {
					continue
				}

				// 3. Track width/height and viewBox on the root <svg> tag
				if tagName == "svg" {
					if attrName == "viewbox" {
						hasViewBox = true
					}
					if attrName == "width" {
						widthVal = attr.Value
						continue // Will normalize to 100%
					}
					if attrName == "height" {
						heightVal = attr.Value
						continue // Will normalize to 100%
					}
				}

				cleanAttrs = append(cleanAttrs, attr)
			}

			// For the root <svg> tag: normalize width/height and ensure viewBox exists
			if tagName == "svg" {
				foundSvg = true
				cleanAttrs = append(cleanAttrs,
					xml.Attr{Name: xml.Name{Local: "width"}, Value: "100%"},
					xml.Attr{Name: xml.Name{Local: "height"}, Value: "100%"},
				)

				if !hasViewBox && widthVal != "" && heightVal != "" {
					wClean := strings.TrimSuffix(strings.TrimSpace(widthVal), "px")
					hClean := strings.TrimSuffix(strings.TrimSpace(heightVal), "px")
					cleanAttrs = append(cleanAttrs, xml.Attr{
						Name:  xml.Name{Local: "viewBox"},
						Value: fmt.Sprintf("0 0 %s %s", wClean, hClean),
					})
				}
			}

			t.Attr = cleanAttrs
			if err := encoder.EncodeToken(t); err != nil {
				return nil, err
			}

		case xml.EndElement:
			tagName := strings.ToLower(t.Name.Local)
			if tagName == "script" || tagName == "iframe" || tagName == "object" || tagName == "embed" {
				continue
			}
			if err := encoder.EncodeToken(t); err != nil {
				return nil, err
			}

		case xml.CharData:
			if err := encoder.EncodeToken(t); err != nil {
				return nil, err
			}
		}
	}

	if !foundSvg {
		return nil, fmt.Errorf("no <svg> root element found in uploaded file")
	}

	if err := encoder.Flush(); err != nil {
		return nil, err
	}

	return out.Bytes(), nil
}
