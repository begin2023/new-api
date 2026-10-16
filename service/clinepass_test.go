package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsClinePassChannelReadsTheBaseURLHost(t *testing.T) {
	for _, test := range []struct {
		name    string
		baseURL string
		want    bool
	}{
		{name: "cline api", baseURL: "https://api.cline.bot/api", want: true},
		{name: "bare host", baseURL: "https://cline.bot", want: true},
		{name: "case and trailing slash", baseURL: "https://API.Cline.Bot/api/", want: true},
		{name: "another host", baseURL: "https://api.openai.com/v1", want: false},
		{name: "host that merely ends in the name", baseURL: "https://notcline.bot/api", want: false},
		{name: "no base url", baseURL: "", want: false},
		{name: "unparsable", baseURL: "://cline.bot", want: false},
	} {
		t.Run(test.name, func(t *testing.T) {
			baseURL := test.baseURL
			channel := &model.Channel{BaseURL: &baseURL}
			assert.Equal(t, test.want, IsClinePassChannel(channel))
		})
	}
}

func TestFetchClinePassUsageReadsWindowsAndBalance(t *testing.T) {
	resetsWeekly := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer cline-key", r.Header.Get("Authorization"))
		switch r.URL.Path {
		case "/users/me/plan/usage-limits":
			_, _ = w.Write([]byte(`{"success":true,"data":{"limits":[
				{"type":"weekly","percentUsed":100,"resetsAt":"2026-01-02T03:04:05Z"},
				{"type":"five_hour","percentUsed":42.5,"resetsAt":"2026-01-01T00:00:00Z"},
				{"type":"monthly","percentUsed":150,"resetsAt":""}
			]}}`))
		case "/users/me":
			_, _ = w.Write([]byte(`{"success":true,"data":{"clineUserId":"u-1"}}`))
		case "/users/u-1/balance":
			_, _ = w.Write([]byte(`{"success":true,"data":{"balance":2500000}}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	previous := clinePassUsageAPI
	clinePassUsageAPI = server.URL
	t.Cleanup(func() { clinePassUsageAPI = previous })

	usage := FetchClinePassUsage(context.Background(), server.Client(), "cline-key")

	require.Empty(t, usage.Error)
	require.Len(t, usage.Windows, 3, "windows keep the order ClinePass reports them in")
	assert.Equal(t, "five_hour", usage.Windows[0].Type)
	assert.InDelta(t, 42.5, usage.Windows[0].PercentUsed, 0.001)
	assert.Equal(t, "weekly", usage.Windows[1].Type)
	assert.Equal(t, resetsWeekly.Unix(), usage.Windows[1].ResetsAt)
	assert.InDelta(t, 100, usage.Windows[2].PercentUsed, 0.001, "a percentage over 100 is clamped")
	assert.Zero(t, usage.Windows[2].ResetsAt, "an unparsable reset time stays unknown")
	assert.Equal(t, "$2.50", usage.Balance)
	assert.Equal(t, resetsWeekly.Unix(), usage.ExhaustedUntil)
	assert.True(t, usage.Exhausted())
}

func TestFetchClinePassUsageKeepsTheRefusalOfAnAccountWithoutClinePass(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"success":false,"error":"not found"}`))
	}))
	defer server.Close()

	previous := clinePassUsageAPI
	clinePassUsageAPI = server.URL
	t.Cleanup(func() { clinePassUsageAPI = previous })

	usage := FetchClinePassUsage(context.Background(), server.Client(), "cline-key")

	assert.NotEmpty(t, usage.Error)
	assert.Contains(t, usage.Error, "404")
	assert.Empty(t, usage.Windows)
	assert.False(t, usage.Exhausted())
}

func TestFetchClinePassUsageReadsADataEnvelopeWithoutSuccessFlag(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/users/me/plan/usage-limits":
			_, _ = w.Write([]byte(`{"data":{"limits":[{"type":"five_hour","percentUsed":10}]}}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	previous := clinePassUsageAPI
	clinePassUsageAPI = server.URL
	t.Cleanup(func() { clinePassUsageAPI = previous })

	usage := FetchClinePassUsage(context.Background(), server.Client(), "cline-key")

	require.Empty(t, usage.Error)
	require.Len(t, usage.Windows, 1)
	assert.InDelta(t, 10, usage.Windows[0].PercentUsed, 0.001)
	assert.Equal(t, "", usage.Balance, "a balance that could not be read is left out")
}

func TestClinePassActionFor(t *testing.T) {
	exhausted := &model.ClinePassUsage{Windows: []model.ClinePassWindow{{Type: "weekly", PercentUsed: 100}}}
	room := &model.ClinePassUsage{Windows: []model.ClinePassWindow{{Type: "weekly", PercentUsed: 20}}}
	failed := &model.ClinePassUsage{Windows: []model.ClinePassWindow{{Type: "weekly", PercentUsed: 100}}, Error: "Cline answered 500"}

	channel := func(status int, reason string) *model.Channel {
		ch := &model.Channel{Id: 1, Name: "clinepass", Status: status}
		if reason != "" {
			ch.SetOtherInfo(map[string]any{"status_reason": reason})
		}
		return ch
	}

	for _, test := range []struct {
		name    string
		channel *model.Channel
		usage   *model.ClinePassUsage
		want    clinePassAction
	}{
		{name: "out of window disables a serving channel", channel: channel(common.ChannelStatusEnabled, ""), usage: exhausted, want: clinePassDisable},
		{name: "an already disabled channel is left alone", channel: channel(common.ChannelStatusAutoDisabled, ClinePassDisabledReasonPrefix), usage: exhausted, want: clinePassKeep},
		{name: "a window that came back enables the channel it disabled", channel: channel(common.ChannelStatusAutoDisabled, ClinePassDisabledReasonPrefix+": weekly window at 100%"), usage: room, want: clinePassEnable},
		{name: "another reason to be disabled is not undone", channel: channel(common.ChannelStatusAutoDisabled, "Insufficient balance"), usage: room, want: clinePassKeep},
		{name: "a manual disable is never undone", channel: channel(common.ChannelStatusManuallyDisabled, ""), usage: room, want: clinePassKeep},
		{name: "a failed read changes nothing", channel: channel(common.ChannelStatusEnabled, ""), usage: failed, want: clinePassKeep},
		{name: "a failed read does not enable either", channel: channel(common.ChannelStatusAutoDisabled, ClinePassDisabledReasonPrefix), usage: failed, want: clinePassKeep},
		{name: "no snapshot changes nothing", channel: channel(common.ChannelStatusEnabled, ""), usage: nil, want: clinePassKeep},
	} {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, clinePassActionFor(test.channel, test.usage))
		})
	}
}

func TestClinePassDisabledReasonNamesTheWindowAndReset(t *testing.T) {
	usage := &model.ClinePassUsage{Windows: []model.ClinePassWindow{
		{Type: "five_hour", PercentUsed: 20},
		{Type: "weekly", PercentUsed: 100, ResetsAt: time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC).Unix()},
	}}

	reason := clinePassDisabledReason(usage)

	assert.Contains(t, reason, ClinePassDisabledReasonPrefix)
	assert.Contains(t, reason, "weekly")
	assert.Contains(t, reason, "2026-01-02T03:04:05Z")
}
