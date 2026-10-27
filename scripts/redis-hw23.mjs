import Redis from 'ioredis';

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

export function cacheUrl() {
    const url = process.env.REDIS_URL;
    if (!url) {
        throw new Error('REDIS_URL is required');
    }
    return url;
}

export function queueUrl() {
    const url = process.env.REDIS_QUEUE_URL;
    if (!url) {
        throw new Error('REDIS_QUEUE_URL is required');
    }
    return url;
}

export function printKv(rows) {
    for (const [key, value] of Object.entries(rows)) {
        console.log(`${key}=${value}`);
    }
}

export function fail(message) {
    console.error(message);
    process.exit(1);
}

export function jitterTtl() {
    return 300 + Math.floor(Math.random() * 61);
}
