export const SETTLE_SCHEDULED_OWNER_IF_CURRENT_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if not current then return 0 end
local ok, decoded = pcall(cjson.decode, current)
if not ok then return -1 end
if decoded["startedAt"] ~= ARGV[1] then return 0 end
if decoded["state"] ~= "started" then return 0 end
redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
return 1
`;

export const START_SCHEDULED_OWNER_IF_LATEST_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if current then
  local ok, decoded = pcall(cjson.decode, current)
  if not ok then return -1 end
  local currentStartedAt = decoded["startedAt"]
  if currentStartedAt >= ARGV[1] then return 0 end
end
redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
return 1
`;
