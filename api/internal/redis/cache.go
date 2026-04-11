package redis

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// Cache key prefixes.
const (
	PrefixMagicLink = "magic_"
	// PrefixMagicCodeLogin stores email login codes (numeric), separate from magic-link keys.
	PrefixMagicCodeLogin = "logincode_"
	PrefixLock           = "lock_"
	PrefixCache          = "cache_"
)

// Default TTLs.
const (
	MagicLinkTTL      = 600 * time.Second // 10 min
	MagicCodeLoginTTL = 600 * time.Second // 10 min
	// MagicCodeMaxAttempts before the stored code is invalidated.
	MagicCodeMaxAttempts = 10
	LockTTL              = 300 * time.Second // 5 min
)

// Get gets a string value. Returns redis.Nil when key does not exist.
func (c *Client) Get(ctx context.Context, key string) (string, error) {
	return c.Client.Get(ctx, key).Result()
}

// Set sets a string value with optional TTL. Use 0 for no expiry.
func (c *Client) Set(ctx context.Context, key string, value string, ttl time.Duration) error {
	return c.Client.Set(ctx, key, value, ttl).Err()
}

// Delete removes a key.
func (c *Client) Delete(ctx context.Context, keys ...string) error {
	return c.Client.Del(ctx, keys...).Err()
}

// Exists returns whether the key exists.
func (c *Client) Exists(ctx context.Context, key string) (bool, error) {
	n, err := c.Client.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// --- Cache (generic) ---

// CacheGet gets a cached value and unmarshals into v (e.g. *string or struct pointer).
func (c *Client) CacheGet(ctx context.Context, key string, v interface{}) error {
	data, err := c.Client.Get(ctx, PrefixCache+key).Result()
	if err != nil {
		return err
	}
	if v == nil {
		return nil
	}
	return json.Unmarshal([]byte(data), v)
}

// CacheSet sets a cached value with TTL.
func (c *Client) CacheSet(ctx context.Context, key string, v interface{}, ttl time.Duration) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return c.Client.Set(ctx, PrefixCache+key, data, ttl).Err()
}

// --- Lock (distributed lock for batch tasks) ---

// AcquireLock acquires a lock. Returns true if acquired, false if already held.
func (c *Client) AcquireLock(ctx context.Context, lockID string, expire time.Duration) (bool, error) {
	if expire <= 0 {
		expire = LockTTL
	}
	key := PrefixLock + lockID
	ok, err := c.Client.SetNX(ctx, key, "1", expire).Result()
	return ok, err
}

// ReleaseLock releases a lock.
func (c *Client) ReleaseLock(ctx context.Context, lockID string) error {
	return c.Client.Del(ctx, PrefixLock+lockID).Err()
}

// --- Magic-link token (key = magic_<email>, value = JSON) ---

// MagicLinkData is stored in Redis for magic-link auth.
type MagicLinkData struct {
	Email          string `json:"email"`
	Token          string `json:"token"`
	CurrentAttempt int    `json:"current_attempt"`
}

// SetMagicLink sets magic-link data for email. Overwrites existing; use GetMagicLink to check attempts.
func (c *Client) SetMagicLink(ctx context.Context, email, token string, attempt int, ttl time.Duration) error {
	if ttl <= 0 {
		ttl = MagicLinkTTL
	}
	data := MagicLinkData{Email: email, Token: token, CurrentAttempt: attempt}
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return c.Client.Set(ctx, PrefixMagicLink+email, b, ttl).Err()
}

// GetMagicLink returns magic-link data if it exists.
func (c *Client) GetMagicLink(ctx context.Context, email string) (*MagicLinkData, error) {
	data, err := c.Client.Get(ctx, PrefixMagicLink+email).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}
	var out MagicLinkData
	if err := json.Unmarshal([]byte(data), &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// DeleteMagicLink removes magic-link data after successful sign-in.
func (c *Client) DeleteMagicLink(ctx context.Context, email string) error {
	return c.Client.Del(ctx, PrefixMagicLink+email).Err()
}

// --- Email login code (magic code) ---

// MagicCodeLoginData is stored in Redis for one-time email codes.
type MagicCodeLoginData struct {
	CodeMAC     string `json:"m"`
	Attempts    int    `json:"a"`
	InviteToken string `json:"it,omitempty"`
	IsSignup    bool   `json:"su"`
}

// LoginCodeRedisKey returns the Redis key for magic-code login for an email address.
func LoginCodeRedisKey(email string) string {
	return PrefixMagicCodeLogin + strings.ToLower(strings.TrimSpace(email))
}

// SetMagicCodeLogin stores login code metadata for the email. Overwrites any prior code.
func (c *Client) SetMagicCodeLogin(ctx context.Context, email string, data *MagicCodeLoginData, ttl time.Duration) error {
	if ttl <= 0 {
		ttl = MagicCodeLoginTTL
	}
	if data == nil {
		data = &MagicCodeLoginData{}
	}
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return c.Client.Set(ctx, LoginCodeRedisKey(email), b, ttl).Err()
}

// GetMagicCodeLogin returns stored login code metadata, or (nil, nil) if missing.
func (c *Client) GetMagicCodeLogin(ctx context.Context, email string) (*MagicCodeLoginData, error) {
	key := LoginCodeRedisKey(email)
	s, err := c.Client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}
	var out MagicCodeLoginData
	if err := json.Unmarshal([]byte(s), &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// DeleteMagicCodeLogin removes the login code for an email (after success or lockout).
func (c *Client) DeleteMagicCodeLogin(ctx context.Context, email string) error {
	return c.Client.Del(ctx, LoginCodeRedisKey(email)).Err()
}

// BumpMagicCodeLoginFailedAttempt increments failed verification attempts and deletes the key after too many failures.
func (c *Client) BumpMagicCodeLoginFailedAttempt(ctx context.Context, email string) error {
	key := LoginCodeRedisKey(email)
	data, err := c.GetMagicCodeLogin(ctx, email)
	if err != nil || data == nil {
		return err
	}
	data.Attempts++
	if data.Attempts >= MagicCodeMaxAttempts {
		return c.DeleteMagicCodeLogin(ctx, email)
	}
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	ttl, err := c.Client.TTL(ctx, key).Result()
	if err != nil {
		return err
	}
	if ttl < 0 {
		ttl = MagicCodeLoginTTL
	}
	return c.Client.Set(ctx, key, b, ttl).Err()
}

// --- Short-lived metadata (e.g. request origin per issue) ---

// SetRequestOrigin sets a short-lived value for an entity (e.g. issue_id -> origin).
func (c *Client) SetRequestOrigin(ctx context.Context, entityID, origin string, ttl time.Duration) error {
	if ttl <= 0 {
		ttl = 600 * time.Second
	}
	return c.Client.Set(ctx, "origin_"+entityID, origin, ttl).Err()
}

// GetRequestOrigin gets the stored origin for an entity.
func (c *Client) GetRequestOrigin(ctx context.Context, entityID string) (string, error) {
	s, err := c.Client.Get(ctx, "origin_"+entityID).Result()
	if err == redis.Nil {
		return "", nil
	}
	return s, err
}
