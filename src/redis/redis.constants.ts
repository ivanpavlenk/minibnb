export const CACHE_TTL_BASE_SEC = 300;
export const CACHE_TTL_JITTER_SEC = 60;
export const LOCK_TTL_MS = 2000;
export const SESSION_TTL_SEC = 30;
export const RATE_LIMIT = 5;
export const RATE_WINDOW_MS = 10_000;

export const UNLOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export const RATE_LIMIT_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call("ZREMRANGEBYSCORE", key, 0, now - window)
local count = redis.call("ZCARD", key)
if count >= limit then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local retry = 1
  if oldest[2] then
    retry = math.max(1, math.ceil((tonumber(oldest[2]) + window - now) / 1000))
  end
  return {0, count, retry}
end
redis.call("ZADD", key, now, now .. "-" .. ARGV[4])
redis.call("PEXPIRE", key, window)
return {1, count + 1, 0}
`;

export function jitterTtlSec(): number {
    return CACHE_TTL_BASE_SEC + Math.floor(Math.random() * (CACHE_TTL_JITTER_SEC + 1));
}
