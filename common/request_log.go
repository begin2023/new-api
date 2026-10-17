package common

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"time"
)

// The request archive keeps the client request body of each relay call under
// its request id, so an operator can look up what a user actually sent.
//
// It is off unless REQUEST_LOG_ENABLED is set: the bodies are user content, and
// an operator must opt in to keeping them. Bodies are capped because the
// archive must not grow with the largest upload, and the archive is pruned by
// age because nothing else removes it.
var (
	RequestLogEnabled       bool
	RequestLogDir           string
	RequestLogRetentionDays int
	RequestLogMaxBytes      int64
)

// ErrRequestLogNotFound reports an archive entry that was never written or has
// already been pruned.
var ErrRequestLogNotFound = errors.New("request content not recorded")

// requestLogIdPattern keeps a request id usable as a single path element.
var requestLogIdPattern = regexp.MustCompile(`^[0-9A-Za-z_-]{1,64}$`)

// requestLogDayLayout names the archive's per-day directories.
const requestLogDayLayout = "2006-01-02"

// RequestLogPath is where the body of requestId is archived, or "" when the id
// cannot be a file name.
func RequestLogPath(requestId string, at time.Time) string {
	if !requestLogIdPattern.MatchString(requestId) {
		return ""
	}
	return filepath.Join(RequestLogDir, at.Format(requestLogDayLayout), requestId+".json")
}

// SaveRequestLog archives one request body under its request id. Failures are
// logged, never returned: the archive is for traceability, not correctness, and
// it must not fail a request that would otherwise be served.
func SaveRequestLog(requestId string, storage BodyStorage) {
	if !RequestLogEnabled || storage == nil {
		return
	}
	path := RequestLogPath(requestId, time.Now())
	size := storage.Size()
	if path == "" || size <= 0 {
		return
	}

	reader, err := storage.NewReader()
	if err != nil {
		return
	}
	defer reader.Close()

	truncated := size > RequestLogMaxBytes
	limit := size
	if truncated {
		limit = RequestLogMaxBytes
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		SysError(fmt.Sprintf("failed to create request log directory: %s", err.Error()))
		return
	}
	file, err := os.Create(path)
	if err != nil {
		SysError(fmt.Sprintf("failed to create request log %s: %s", requestId, err.Error()))
		return
	}
	defer file.Close()

	if _, err := io.CopyN(file, reader, limit); err != nil {
		SysError(fmt.Sprintf("failed to write request log %s: %s", requestId, err.Error()))
		// A half-written body reads as a complete one, so drop it instead.
		_ = os.Remove(path)
		return
	}
	if truncated {
		_, _ = fmt.Fprintf(file, "\n\n[request body truncated at %d bytes of %d]", limit, size)
	}
}

// ReadRequestLog returns the archived body of a request id. The id is searched
// across the retained days because the archive date is the write date, which
// can differ from the log row's date when a request crosses midnight.
func ReadRequestLog(requestId string) (string, error) {
	if !requestLogIdPattern.MatchString(requestId) {
		return "", ErrRequestLogNotFound
	}
	matches, err := filepath.Glob(filepath.Join(RequestLogDir, "*", requestId+".json"))
	if err != nil || len(matches) == 0 {
		return "", ErrRequestLogNotFound
	}
	body, err := os.ReadFile(matches[0])
	if err != nil {
		return "", ErrRequestLogNotFound
	}
	return string(body), nil
}

// CleanupRequestLogs deletes archive days older than the retention. A retention
// of zero or less keeps the archive forever.
func CleanupRequestLogs() {
	if !RequestLogEnabled || RequestLogRetentionDays <= 0 {
		return
	}
	entries, err := os.ReadDir(RequestLogDir)
	if err != nil {
		return
	}
	cutoff := time.Now().AddDate(0, 0, -RequestLogRetentionDays)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		day, err := time.ParseInLocation(requestLogDayLayout, entry.Name(), time.Local)
		if err != nil || !day.Before(cutoff) {
			continue
		}
		if err := os.RemoveAll(filepath.Join(RequestLogDir, entry.Name())); err != nil {
			SysError(fmt.Sprintf("failed to prune request logs of %s: %s", entry.Name(), err.Error()))
		}
	}
}

// StartRequestLogCleanup prunes the archive twice a day for as long as the
// process runs.
func StartRequestLogCleanup() {
	if !RequestLogEnabled {
		return
	}
	if RequestLogRetentionDays > 0 {
		SysLog(fmt.Sprintf("request archive enabled at %s, keeping %d days", RequestLogDir, RequestLogRetentionDays))
	} else {
		SysLog(fmt.Sprintf("request archive enabled at %s, keeping every day", RequestLogDir))
	}
	for {
		time.Sleep(12 * time.Hour)
		CleanupRequestLogs()
	}
}
