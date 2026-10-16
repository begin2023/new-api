package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"

	"github.com/gin-gonic/gin"
)

// ContextTokenMaxConcurrency carries the token's concurrency limit to the
// limiter middleware, set by SetupContextForToken after token authentication.
const ContextTokenMaxConcurrency = "token_max_concurrency"

const redisTokenConcurrencyNamespace = "tokenConcurrency:v1"

// tokenConcurrencyTTLSeconds bounds how long a slot survives a process that
// died without releasing it. It only has to outlive an ordinary request; a
// stream longer than the TTL may briefly admit one extra request.
const tokenConcurrencyTTLSeconds = 3600

// The in-flight count is a plain counter: acquire increments it and refuses
// when the token already has `limit` requests in flight, release decrements it.
const redisTokenConcurrencyAcquireScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
if count > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return 0
end
return 1
`

const redisTokenConcurrencyReleaseScript = `
local count = redis.call('DECR', KEYS[1])
if count <= 0 then
  redis.call('DEL', KEYS[1])
end
return count
`

// tokenConcurrencyCounts tracks in-flight requests per token when Redis is
// disabled. Without Redis the limit applies to one instance, not the deployment.
var tokenConcurrencyCounts = struct {
	sync.Mutex
	counts map[int]int
}{counts: make(map[int]int)}

func redisTokenConcurrencyKey(tokenId int) string {
	return fmt.Sprintf("%s:%d", redisTokenConcurrencyNamespace, tokenId)
}

// acquireTokenConcurrency reserves one in-flight slot for the token. The
// returned release function is non-nil only when the request was admitted.
func acquireTokenConcurrency(ctx context.Context, tokenId int, limit int) (func(), bool, error) {
	if common.RedisEnabled {
		if common.RDB == nil {
			return nil, false, errors.New("Redis client is not initialized")
		}
		key := redisTokenConcurrencyKey(tokenId)
		admitted, err := common.RDB.Eval(ctx, redisTokenConcurrencyAcquireScript,
			[]string{key}, limit, tokenConcurrencyTTLSeconds).Int()
		if err != nil {
			return nil, false, err
		}
		if admitted != 1 {
			return nil, false, nil
		}
		return func() {
			// The request context is already canceled once the response is done.
			if err := common.RDB.Eval(context.Background(), redisTokenConcurrencyReleaseScript, []string{key}).Err(); err != nil {
				logger.LogError(context.Background(), common.LogText("failed to release token concurrency slot (token=%d): %v", tokenId, err))
			}
		}, true, nil
	}

	tokenConcurrencyCounts.Lock()
	defer tokenConcurrencyCounts.Unlock()
	if tokenConcurrencyCounts.counts[tokenId] >= limit {
		return nil, false, nil
	}
	tokenConcurrencyCounts.counts[tokenId]++
	return func() {
		tokenConcurrencyCounts.Lock()
		defer tokenConcurrencyCounts.Unlock()
		if tokenConcurrencyCounts.counts[tokenId] <= 1 {
			delete(tokenConcurrencyCounts.counts, tokenId)
			return
		}
		tokenConcurrencyCounts.counts[tokenId]--
	}, true, nil
}

// TokenConcurrencyLimit caps how many requests one API key may have in flight
// at the same time. It runs after TokenAuth and wraps the rest of the relay
// chain, so the slot is held until the response, including a stream, ends.
func TokenConcurrencyLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		limit := c.GetInt(ContextTokenMaxConcurrency)
		if limit <= 0 {
			c.Next()
			return
		}
		tokenId := c.GetInt("token_id")
		release, admitted, err := acquireTokenConcurrency(c.Request.Context(), tokenId, limit)
		if err != nil {
			logger.LogError(c.Request.Context(), common.LogText("token concurrency check failed (token=%d): %v", tokenId, err))
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "concurrency_limit_check_failed")
			return
		}
		if !admitted {
			c.Header("Retry-After", "1")
			abortWithOpenAiMessage(c, http.StatusTooManyRequests,
				i18n.T(c, i18n.MsgTokenConcurrencyLimitReached, map[string]any{"Max": limit}))
			return
		}
		defer release()
		c.Next()
	}
}
