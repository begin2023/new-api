package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// ClinePass pools Cline API keys, one channel per account. Each account has a
// 5-hour, a weekly and a monthly usage window; an account that reaches any of
// them has to stop being routed to until that window resets.
//
// What a key has left is read from the Cline account endpoints, the same ones
// the Cline plugin reads signed in: GET /users/me/plan/usage-limits answers a
// key as it answers an account, and an account without ClinePass is a 404
// there and has its credits alone.

const (
	// clinePassDefaultUsageAPI is where the Cline account endpoints live.
	clinePassDefaultUsageAPI = "https://api.cline.bot/api/v1"

	// ClinePassDisabledReasonPrefix marks the channels this feature disabled, so
	// a later refresh knows it may enable them again once the window resets.
	ClinePassDisabledReasonPrefix = "ClinePass limit reached"

	clinePassRequestTimeout = 20 * time.Second
)

// clinePassUsageAPI is a var so tests can point it at a test server.
var clinePassUsageAPI = clinePassDefaultUsageAPI

// clinePassWindowNames is the window set ClinePass reports, in the order the
// panel shows it.
var clinePassWindowNames = []struct {
	Type string
	Name string
}{
	{"five_hour", "5 hours"},
	{"weekly", "Weekly"},
	{"monthly", "Monthly"},
}

// IsClinePassChannel reports whether a channel points at the Cline API, whose
// keys are the ClinePass accounts this feature pools.
func IsClinePassChannel(channel *model.Channel) bool {
	if channel == nil {
		return false
	}
	parsed, err := url.Parse(strings.TrimSpace(channel.GetBaseURL()))
	if err != nil {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	return host == "cline.bot" || strings.HasSuffix(host, ".cline.bot")
}

// FetchClinePassUsage reads an account's windows and credit balance. A window
// Cline did not report is left out, so an account without ClinePass reads as no
// windows at all rather than as an empty one.
func FetchClinePassUsage(ctx context.Context, client *http.Client, key string) *model.ClinePassUsage {
	usage := &model.ClinePassUsage{UpdatedTime: common.GetTimestamp()}

	var limits struct {
		Limits []struct {
			Type        string   `json:"type"`
			PercentUsed *float64 `json:"percentUsed"`
			ResetsAt    string   `json:"resetsAt"`
		} `json:"limits"`
	}
	if err := clinePassGet(ctx, client, key, "/users/me/plan/usage-limits", &limits); err != nil {
		usage.Error = err.Error()
		return usage
	}
	for _, known := range clinePassWindowNames {
		for _, reported := range limits.Limits {
			if reported.Type != known.Type {
				continue
			}
			window := model.ClinePassWindow{Type: known.Type}
			if reported.PercentUsed != nil {
				window.PercentUsed = min(100, max(0, *reported.PercentUsed))
			}
			if resetsAt, err := time.Parse(time.RFC3339, strings.TrimSpace(reported.ResetsAt)); err == nil {
				window.ResetsAt = resetsAt.Unix()
			}
			usage.Windows = append(usage.Windows, window)
			break
		}
	}
	usage.ExhaustedUntil = clinePassExhaustedUntil(usage)
	usage.Balance = clinePassBalance(ctx, client, key)
	return usage
}

// clinePassExhaustedUntil is the latest reset time among the windows at or over
// their limit, so the panel can say when the account comes back.
func clinePassExhaustedUntil(usage *model.ClinePassUsage) int64 {
	var until int64
	for _, window := range usage.Windows {
		if window.PercentUsed >= 100 && window.ResetsAt > until {
			until = window.ResetsAt
		}
	}
	return until
}

// clinePassBalance is the account's credit balance, in millionths of a dollar at
// /users/{id}/balance with the id /users/me tells.
func clinePassBalance(ctx context.Context, client *http.Client, key string) string {
	var me struct {
		ID          string `json:"id"`
		ClineUserID string `json:"clineUserId"`
		Subject     string `json:"subject"`
	}
	if err := clinePassGet(ctx, client, key, "/users/me", &me); err != nil {
		return ""
	}
	for _, id := range []string{me.ClineUserID, me.Subject, me.ID} {
		if strings.TrimSpace(id) == "" {
			continue
		}
		var balance struct {
			Balance float64 `json:"balance"`
		}
		if err := clinePassGet(ctx, client, key, "/users/"+url.PathEscape(id)+"/balance", &balance); err != nil {
			continue
		}
		if balance.Balance < 0 {
			continue
		}
		return fmt.Sprintf("$%.2f", balance.Balance/1e6)
	}
	return ""
}

// clinePassGet asks the Cline API at path with the key and reads its
// {success, data} reply's data into out.
func clinePassGet(ctx context.Context, client *http.Client, key string, path string, out any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, clinePassUsageAPI+path, nil)
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Authorization", "Bearer "+key)
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if response.StatusCode >= 300 {
		var envelope struct {
			Error string `json:"error"`
		}
		_ = common.Unmarshal(body, &envelope)
		if envelope.Error != "" {
			return fmt.Errorf("Cline answered %d: %s", response.StatusCode, envelope.Error)
		}
		return fmt.Errorf("Cline answered %d", response.StatusCode)
	}
	var envelope struct {
		Success *bool           `json:"success"`
		Error   string          `json:"error"`
		Data    json.RawMessage `json:"data"`
	}
	if err := common.Unmarshal(body, &envelope); err != nil {
		return err
	}
	if envelope.Success != nil && !*envelope.Success {
		return fmt.Errorf("Cline refused: %s", envelope.Error)
	}
	if len(envelope.Data) > 0 {
		body = envelope.Data
	}
	return common.Unmarshal(body, out)
}

// RefreshClinePassChannel reads an account's usage, stores the snapshot and
// keeps the channel's availability in step with it: an account at or over any
// window's limit is disabled until a later read shows the window reset.
func RefreshClinePassChannel(channel *model.Channel) *model.ClinePassUsage {
	setting := channel.GetSetting()
	client, err := GetHttpClientWithProxySettings(setting.Proxy, setting)
	if err != nil {
		common.SysLog(common.LogText("failed to build http client for clinepass usage: channel_id=%d, error=%v", channel.Id, err))
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), clinePassRequestTimeout)
	defer cancel()

	usage := FetchClinePassUsage(ctx, client, strings.TrimSpace(channel.Key))
	model.UpdateClinePassUsage(channel.Id, usage)
	applyClinePassAvailability(channel, usage)
	return usage
}

// clinePassAction is what a usage snapshot asks of the channel's availability.
type clinePassAction int

const (
	clinePassKeep clinePassAction = iota
	clinePassDisable
	clinePassEnable
)

// clinePassActionFor decides from a snapshot alone, so the routing rule can be
// read and tested without a database.
func clinePassActionFor(channel *model.Channel, usage *model.ClinePassUsage) clinePassAction {
	if usage == nil || usage.Error != "" {
		return clinePassKeep
	}
	if usage.Exhausted() {
		if channel.Status == common.ChannelStatusEnabled {
			return clinePassDisable
		}
		return clinePassKeep
	}
	if channel.Status == common.ChannelStatusAutoDisabled && clinePassDisabledChannel(channel) {
		return clinePassEnable
	}
	return clinePassKeep
}

// applyClinePassAvailability disables a channel whose account is out of window
// and enables one this feature disabled whose window has come back.
func applyClinePassAvailability(channel *model.Channel, usage *model.ClinePassUsage) {
	switch clinePassActionFor(channel, usage) {
	case clinePassDisable:
		DisableChannel(
			*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, "", channel.GetAutoBan()),
			clinePassDisabledReason(usage),
		)
	case clinePassEnable:
		EnableChannel(channel.Id, "", channel.Name)
	}
}

func clinePassDisabledReason(usage *model.ClinePassUsage) string {
	for _, window := range usage.Windows {
		if window.PercentUsed < 100 {
			continue
		}
		reason := fmt.Sprintf("%s: %s window at %.0f%%", ClinePassDisabledReasonPrefix, window.Type, window.PercentUsed)
		if window.ResetsAt > 0 {
			reason += fmt.Sprintf(", resets at %s", time.Unix(window.ResetsAt, 0).UTC().Format(time.RFC3339))
		}
		return reason
	}
	return ClinePassDisabledReasonPrefix
}

// clinePassDisabledChannel reports whether this feature disabled the channel,
// rather than an upstream error or an administrator.
func clinePassDisabledChannel(channel *model.Channel) bool {
	reason, _ := channel.GetOtherInfo()["status_reason"].(string)
	return strings.HasPrefix(reason, ClinePassDisabledReasonPrefix)
}

// RefreshClinePassChannels reads every ClinePass account, disabled ones
// included: an account that was disabled for its window has to be read again to
// learn the window reset.
func RefreshClinePassChannels() {
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		common.SysLog(common.LogText("failed to list channels for clinepass usage: %s", err.Error()))
		return
	}
	for _, channel := range channels {
		if !IsClinePassChannel(channel) {
			continue
		}
		RefreshClinePassChannel(channel)
		time.Sleep(common.RequestInterval)
	}
}

// StartClinePassUsageRefreshTask keeps the ClinePass snapshots fresh so routing
// stops using an account as soon as its window runs out. frequencyMinutes of 0
// turns the task off.
func StartClinePassUsageRefreshTask(frequencyMinutes int) {
	if frequencyMinutes <= 0 {
		return
	}
	common.SysLog(common.LogText("clinepass usage refresh started, every %d minutes", frequencyMinutes))
	for {
		time.Sleep(time.Duration(frequencyMinutes) * time.Minute)
		RefreshClinePassChannels()
	}
}
