package common

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// useRequestLogArchive points the archive at a temporary directory and restores
// the process-wide settings the archive reads.
func useRequestLogArchive(t *testing.T, retentionDays int, maxBytes int64) string {
	t.Helper()
	dir := t.TempDir()
	enabled, logDir, retention, max := RequestLogEnabled, RequestLogDir, RequestLogRetentionDays, RequestLogMaxBytes
	t.Cleanup(func() {
		RequestLogEnabled, RequestLogDir, RequestLogRetentionDays, RequestLogMaxBytes = enabled, logDir, retention, max
	})
	RequestLogEnabled = true
	RequestLogDir = dir
	RequestLogRetentionDays = retentionDays
	RequestLogMaxBytes = maxBytes
	return dir
}

func TestRequestLogArchiveKeepsABodyUnderItsRequestId(t *testing.T) {
	dir := useRequestLogArchive(t, 7, 1<<20)
	storage, err := CreateBodyStorage([]byte(`{"model":"deepseek-v4.1-flash"}`))
	require.NoError(t, err)

	SaveRequestLog("20261018014200-abc12345", storage)

	content, err := ReadRequestLog("20261018014200-abc12345")
	require.NoError(t, err)
	assert.Equal(t, `{"model":"deepseek-v4.1-flash"}`, content)
	assert.FileExists(t, filepath.Join(dir, time.Now().Format(requestLogDayLayout), "20261018014200-abc12345.json"))
}

func TestRequestLogArchiveTruncatesAnOversizedBody(t *testing.T) {
	useRequestLogArchive(t, 7, 8)
	storage, err := CreateBodyStorage([]byte("0123456789"))
	require.NoError(t, err)

	SaveRequestLog("oversized", storage)

	content, err := ReadRequestLog("oversized")
	require.NoError(t, err)
	assert.Equal(t, "01234567\n\n[request body truncated at 8 bytes of 10]", content)
}

func TestRequestLogArchiveRefusesAnIdThatIsNotAFileName(t *testing.T) {
	dir := useRequestLogArchive(t, 7, 1<<20)

	assert.Empty(t, RequestLogPath("../../etc/passwd", time.Now()))
	_, err := ReadRequestLog("../../etc/passwd")
	require.ErrorIs(t, err, ErrRequestLogNotFound)

	storage, err := CreateBodyStorage([]byte("secret"))
	require.NoError(t, err)
	SaveRequestLog("../../etc/passwd", storage)
	entries, err := os.ReadDir(dir)
	require.NoError(t, err)
	assert.Empty(t, entries)
}

func TestRequestLogArchivePrunesOnlyDaysOlderThanTheRetention(t *testing.T) {
	dir := useRequestLogArchive(t, 7, 1<<20)
	old := filepath.Join(dir, time.Now().AddDate(0, 0, -8).Format(requestLogDayLayout))
	kept := filepath.Join(dir, time.Now().AddDate(0, 0, -6).Format(requestLogDayLayout))
	require.NoError(t, os.MkdirAll(old, 0o755))
	require.NoError(t, os.MkdirAll(kept, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(old, "old.json"), []byte("{}"), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(kept, "kept.json"), []byte("{}"), 0o644))

	CleanupRequestLogs()

	assert.NoDirExists(t, old)
	assert.FileExists(t, filepath.Join(kept, "kept.json"))
}

func TestRequestLogArchiveWritesNothingWhenDisabled(t *testing.T) {
	dir := useRequestLogArchive(t, 7, 1<<20)
	RequestLogEnabled = false
	storage, err := CreateBodyStorage([]byte("{}"))
	require.NoError(t, err)

	SaveRequestLog("disabled", storage)

	entries, err := os.ReadDir(dir)
	require.NoError(t, err)
	assert.Empty(t, entries)
	_, err = ReadRequestLog("disabled")
	assert.ErrorIs(t, err, ErrRequestLogNotFound)
}

func TestRequestLogArchiveIgnoresAnEmptyBody(t *testing.T) {
	dir := useRequestLogArchive(t, 7, 1<<20)
	storage, err := CreateBodyStorage(nil)
	require.NoError(t, err)

	SaveRequestLog("empty", storage)

	entries, err := os.ReadDir(dir)
	require.NoError(t, err)
	assert.Empty(t, entries)
	assert.False(t, strings.Contains(RequestLogPath("empty", time.Now()), ".."))
}
