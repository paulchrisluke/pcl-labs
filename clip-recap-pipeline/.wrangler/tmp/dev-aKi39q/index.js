var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// .wrangler/tmp/bundle-TgVJqC/checked-fetch.js
function checkURL(request2, init) {
  const url = request2 instanceof URL ? request2 : new URL(
    (typeof request2 === "string" ? new Request(request2, init) : request2).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
var urls;
var init_checked_fetch = __esm({
  ".wrangler/tmp/bundle-TgVJqC/checked-fetch.js"() {
    "use strict";
    urls = /* @__PURE__ */ new Set();
    __name(checkURL, "checkURL");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        const [request2, init] = argArray;
        checkURL(request2, init);
        return Reflect.apply(target, thisArg, argArray);
      }
    });
  }
});

// .wrangler/tmp/bundle-TgVJqC/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request2 = new Request(input, init);
  request2.headers.delete("CF-Connecting-IP");
  return request2;
}
var init_strip_cf_connecting_ip_header = __esm({
  ".wrangler/tmp/bundle-TgVJqC/strip-cf-connecting-ip-header.js"() {
    "use strict";
    __name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        return Reflect.apply(target, thisArg, [
          stripCfConnectingIPHeader.apply(null, argArray)
        ]);
      }
    });
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
  }
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// src/utils/ai.ts
var AIService;
var init_ai = __esm({
  "src/utils/ai.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    AIService = class {
      constructor(env) {
        this.env = env;
      }
      async callWithRetry(model, params, options = {}) {
        const retries = Math.max(0, Math.floor(options?.retries ?? 2));
        const timeout = Math.max(1, Math.floor(options?.timeout ?? 3e4));
        for (let i = 0; i <= retries; i++) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          try {
            const result = await this.env.ai.run(model, params, { signal: controller.signal });
            return result;
          } catch (error) {
            if (i === retries)
              throw error;
            console.warn(`AI call failed, retrying... (${i + 1}/${retries})`);
            const backoffMs = 1e3 * Math.pow(2, i);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
          } finally {
            clearTimeout(timeoutId);
          }
        }
      }
    };
    __name(AIService, "AIService");
  }
});

// src/get-broadcaster-id.ts
async function getBroadcasterId(env) {
  if (env.TWITCH_BROADCASTER_ID) {
    console.log("\u{1F511} Using provided TWITCH_BROADCASTER_ID");
    return env.TWITCH_BROADCASTER_ID;
  }
  if (!env.TWITCH_BROADCASTER_LOGIN) {
    throw new Error("TWITCH_BROADCASTER_LOGIN environment variable is required when TWITCH_BROADCASTER_ID is not provided");
  }
  try {
    console.log("\u{1F511} Getting Twitch access token...");
    const tokenBody = new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials"
    });
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody
    });
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token response error:", errorText);
      throw new Error(`Token request failed: ${tokenResponse.statusText} - ${errorText}`);
    }
    const tokenData = await tokenResponse.json();
    const userResponse = await fetch(
      `https://api.twitch.tv/helix/users?login=${env.TWITCH_BROADCASTER_LOGIN}`,
      {
        headers: {
          "Client-ID": env.TWITCH_CLIENT_ID,
          "Authorization": `Bearer ${tokenData.access_token}`
        }
      }
    );
    if (!userResponse.ok) {
      throw new Error(`User lookup failed: ${userResponse.statusText}`);
    }
    const userData = await userResponse.json();
    if (userData.data?.length > 0) {
      return userData.data[0].id;
    } else {
      throw new Error(`User ${env.TWITCH_BROADCASTER_LOGIN} not found`);
    }
  } catch (error) {
    console.error("Error getting broadcaster ID:", error);
    throw error;
  }
}
var init_get_broadcaster_id = __esm({
  "src/get-broadcaster-id.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    __name(getBroadcasterId, "getBroadcasterId");
  }
});

// src/services/twitch.ts
var twitch_exports = {};
__export(twitch_exports, {
  TwitchService: () => TwitchService
});
var TwitchService;
var init_twitch = __esm({
  "src/services/twitch.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    init_ai();
    init_get_broadcaster_id();
    TwitchService = class {
      constructor(env) {
        this.env = env;
        this.aiService = new AIService(env);
      }
      aiService;
      tokenCache = null;
      async getAccessToken() {
        const response = await fetch("https://id.twitch.tv/oauth2/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            client_id: this.env.TWITCH_CLIENT_ID,
            client_secret: this.env.TWITCH_CLIENT_SECRET,
            grant_type: "client_credentials"
          })
        });
        if (!response.ok) {
          throw new Error(`Failed to get Twitch token: ${response.statusText}`);
        }
        const data = await response.json();
        const now = Date.now();
        return { token: data.access_token, expiresAt: now + data.expires_in * 1e3 };
      }
      async validateToken(token) {
        try {
          const response = await fetch("https://id.twitch.tv/oauth2/validate", {
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            console.log(`Token validation successful. Expires in: ${data.expires_in} seconds`);
            return true;
          } else {
            console.error(`Token validation failed: ${response.status} ${response.statusText}`);
            return false;
          }
        } catch (error) {
          console.error("Token validation error:", error);
          return false;
        }
      }
      async getValidatedToken() {
        const skewMs = 6e4;
        if (this.tokenCache && this.tokenCache.expiresAt - Date.now() > skewMs) {
          return this.tokenCache.token;
        }
        const { token, expiresAt } = await this.getAccessToken();
        const isValid = await this.validateToken(token);
        if (!isValid)
          throw new Error("Twitch token validation failed");
        this.tokenCache = { token, expiresAt };
        return token;
      }
      async getRecentClips() {
        const token = await this.getValidatedToken();
        const broadcasterId = await getBroadcasterId(this.env);
        const now = /* @__PURE__ */ new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
        const response = await fetch(
          `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&started_at=${yesterday.toISOString()}&ended_at=${now.toISOString()}&first=100`,
          {
            headers: {
              "Client-ID": this.env.TWITCH_CLIENT_ID,
              "Authorization": `Bearer ${token}`
            }
          }
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch clips: ${response.statusText}`);
        }
        const data = await response.json();
        return data.data || [];
      }
      async transcribeClips(clips) {
        const transcripts = [];
        for (const clip of clips) {
          try {
            console.log(`Transcribing clip: ${clip.id}`);
            const audioBuffer = await this.downloadClipAudio(clip.url);
            const transcript = await this.transcribeAudio(audioBuffer, clip.id);
            await this.storeTranscript(clip.id, transcript);
            transcripts.push(transcript);
            console.log(`Successfully transcribed clip: ${clip.id}`);
          } catch (error) {
            console.error(`Failed to transcribe clip ${clip.id}:`, error);
          }
        }
        return transcripts;
      }
      async downloadClipAudio(clipUrl) {
        try {
          console.log(`Downloading clip audio from: ${clipUrl}`);
          const clipId = this.extractClipId(clipUrl);
          if (!clipId) {
            throw new Error("Could not extract clip ID from URL");
          }
          const token = await this.getValidatedToken();
          const clipResponse = await fetch(
            `https://api.twitch.tv/helix/clips?id=${clipId}`,
            {
              headers: {
                "Client-ID": this.env.TWITCH_CLIENT_ID,
                "Authorization": `Bearer ${token}`
              }
            }
          );
          if (!clipResponse.ok) {
            throw new Error(`Failed to get clip info: ${clipResponse.statusText}`);
          }
          const clipData = await clipResponse.json();
          const clip = clipData.data?.[0];
          if (!clip) {
            throw new Error("Clip not found");
          }
          console.log(`Clip found: ${clip.title} (${clip.duration}s)`);
          const placeholderBuffer = new ArrayBuffer(1024);
          console.log(`Returning placeholder audio buffer for clip: ${clipId}`);
          return placeholderBuffer;
        } catch (error) {
          console.error(`Failed to download clip audio: ${error}`);
          throw error;
        }
      }
      extractClipId(clipUrl) {
        const patterns = [
          /\/clip\/([a-zA-Z0-9_-]+)/,
          // Standard clip URL
          /clips\.twitch\.tv\/([a-zA-Z0-9_-]+)/
          // Direct clips URL
        ];
        for (const pattern of patterns) {
          const match = clipUrl.match(pattern);
          if (match) {
            return match[1];
          }
        }
        return null;
      }
      async transcribeAudio(audioBuffer, clipId) {
        try {
          const result = await this.aiService.callWithRetry("@cf/openai/whisper-large-v3-turbo", {
            audio: audioBuffer
          });
          if (!result) {
            throw new Error("AI service returned null or undefined result");
          }
          const segments = Array.isArray(result.segments) ? result.segments : [];
          const lang = result.language || "en";
          return {
            clip_id: clipId,
            lang,
            segments
          };
        } catch (error) {
          console.error(`Transcription failed for clip ${clipId} using Whisper service:`, error);
          return {
            clip_id: clipId,
            lang: "en",
            segments: []
          };
        }
      }
      async storeTranscript(clipId, transcript) {
        const key = `transcripts/${clipId}.json`;
        await this.env.R2_BUCKET.put(key, JSON.stringify(transcript), {
          httpMetadata: {
            contentType: "application/json"
          }
        });
      }
    };
    __name(TwitchService, "TwitchService");
  }
});

// node_modules/fast-content-type-parse/index.js
var require_fast_content_type_parse = __commonJS({
  "node_modules/fast-content-type-parse/index.js"(exports, module) {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    var NullObject = /* @__PURE__ */ __name(function NullObject2() {
    }, "NullObject");
    NullObject.prototype = /* @__PURE__ */ Object.create(null);
    var paramRE = /; *([!#$%&'*+.^\w`|~-]+)=("(?:[\v\u0020\u0021\u0023-\u005b\u005d-\u007e\u0080-\u00ff]|\\[\v\u0020-\u00ff])*"|[!#$%&'*+.^\w`|~-]+) */gu;
    var quotedPairRE = /\\([\v\u0020-\u00ff])/gu;
    var mediaTypeRE = /^[!#$%&'*+.^\w|~-]+\/[!#$%&'*+.^\w|~-]+$/u;
    var defaultContentType = { type: "", parameters: new NullObject() };
    Object.freeze(defaultContentType.parameters);
    Object.freeze(defaultContentType);
    function parse2(header) {
      if (typeof header !== "string") {
        throw new TypeError("argument header is required and must be a string");
      }
      let index = header.indexOf(";");
      const type = index !== -1 ? header.slice(0, index).trim() : header.trim();
      if (mediaTypeRE.test(type) === false) {
        throw new TypeError("invalid media type");
      }
      const result = {
        type: type.toLowerCase(),
        parameters: new NullObject()
      };
      if (index === -1) {
        return result;
      }
      let key;
      let match;
      let value;
      paramRE.lastIndex = index;
      while (match = paramRE.exec(header)) {
        if (match.index !== index) {
          throw new TypeError("invalid parameter format");
        }
        index += match[0].length;
        key = match[1].toLowerCase();
        value = match[2];
        if (value[0] === '"') {
          value = value.slice(1, value.length - 1);
          quotedPairRE.test(value) && (value = value.replace(quotedPairRE, "$1"));
        }
        result.parameters[key] = value;
      }
      if (index !== header.length) {
        throw new TypeError("invalid parameter format");
      }
      return result;
    }
    __name(parse2, "parse");
    function safeParse2(header) {
      if (typeof header !== "string") {
        return defaultContentType;
      }
      let index = header.indexOf(";");
      const type = index !== -1 ? header.slice(0, index).trim() : header.trim();
      if (mediaTypeRE.test(type) === false) {
        return defaultContentType;
      }
      const result = {
        type: type.toLowerCase(),
        parameters: new NullObject()
      };
      if (index === -1) {
        return result;
      }
      let key;
      let match;
      let value;
      paramRE.lastIndex = index;
      while (match = paramRE.exec(header)) {
        if (match.index !== index) {
          return defaultContentType;
        }
        index += match[0].length;
        key = match[1].toLowerCase();
        value = match[2];
        if (value[0] === '"') {
          value = value.slice(1, value.length - 1);
          quotedPairRE.test(value) && (value = value.replace(quotedPairRE, "$1"));
        }
        result.parameters[key] = value;
      }
      if (index !== header.length) {
        return defaultContentType;
      }
      return result;
    }
    __name(safeParse2, "safeParse");
    module.exports.default = { parse: parse2, safeParse: safeParse2 };
    module.exports.parse = parse2;
    module.exports.safeParse = safeParse2;
    module.exports.defaultContentType = defaultContentType;
  }
});

// .wrangler/tmp/bundle-TgVJqC/middleware-loader.entry.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// .wrangler/tmp/bundle-TgVJqC/middleware-insertion-facade.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/index.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/utils/validation.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function validateClipId(clipId) {
  if (!clipId || typeof clipId !== "string") {
    return { isValid: false, error: "clipId must be a non-empty string" };
  }
  if (clipId.length > 50) {
    return { isValid: false, error: "clipId is too long (max 50 characters)" };
  }
  const dangerousPattern = /[\/\\\.\0]/;
  if (dangerousPattern.test(clipId)) {
    return { isValid: false, error: "clipId contains invalid characters" };
  }
  const validPattern = /^[A-Za-z0-9_-]+$/;
  if (!validPattern.test(clipId)) {
    return { isValid: false, error: "clipId contains invalid characters (only A-Z, a-z, 0-9, _, - allowed)" };
  }
  return { isValid: true };
}
__name(validateClipId, "validateClipId");
function sanitizeString(input) {
  return input.replace(/<[^>]*>/g, "").replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/[<>\"'&]/g, "").replace(/[\x00-\x1F\x7F]/g, "").trim();
}
__name(sanitizeString, "sanitizeString");
function validateData(data, schema, forbiddenFields = []) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { isValid: false, error: "data must be a plain object" };
  }
  for (const field of forbiddenFields) {
    if (field in data) {
      return { isValid: false, error: `Field '${field}' is not allowed to be modified` };
    }
  }
  const sanitizedData = {};
  const errors = [];
  for (const [field, value] of Object.entries(data)) {
    if (!(field in schema)) {
      errors.push(`Field '${field}' is not allowed`);
      continue;
    }
    const fieldConfig = schema[field];
    if (fieldConfig.type === "string") {
      if (typeof value !== "string") {
        errors.push(`Field '${field}' must be a string`);
        continue;
      }
      if (fieldConfig.maxLength && value.length > fieldConfig.maxLength) {
        errors.push(`Field '${field}' is too long (max ${fieldConfig.maxLength} characters)`);
        continue;
      }
      const sanitized = sanitizeString(value);
      sanitizedData[field] = sanitized;
    } else if (fieldConfig.type === "array") {
      if (!Array.isArray(value)) {
        errors.push(`Field '${field}' must be an array`);
        continue;
      }
      if (fieldConfig.maxItems && value.length > fieldConfig.maxItems) {
        errors.push(`Field '${field}' has too many items (max ${fieldConfig.maxItems})`);
        continue;
      }
      if (field === "tags") {
        const sanitizedTags = value.filter((tag) => typeof tag === "string").map((tag) => sanitizeString(tag)).filter((tag) => tag.length > 0 && tag.length <= 50);
        sanitizedData[field] = sanitizedTags;
      } else {
        sanitizedData[field] = value;
      }
    } else if (fieldConfig.type === "boolean") {
      if (typeof value !== "boolean") {
        errors.push(`Field '${field}' must be a boolean`);
        continue;
      }
      sanitizedData[field] = value;
    } else if (fieldConfig.type === "number") {
      if (typeof value !== "number" || isNaN(value)) {
        errors.push(`Field '${field}' must be a valid number`);
        continue;
      }
      if (fieldConfig.min !== void 0 && value < fieldConfig.min) {
        errors.push(`Field '${field}' must be at least ${fieldConfig.min}`);
        continue;
      }
      if (fieldConfig.max !== void 0 && value > fieldConfig.max) {
        errors.push(`Field '${field}' must be at most ${fieldConfig.max}`);
        continue;
      }
      sanitizedData[field] = value;
    } else if (fieldConfig.type === "object") {
      if (typeof value !== "object" || Array.isArray(value)) {
        errors.push(`Field '${field}' must be an object`);
        continue;
      }
      sanitizedData[field] = value;
    }
  }
  if (errors.length > 0) {
    return { isValid: false, error: `Validation errors: ${errors.join(", ")}` };
  }
  return { isValid: true, sanitizedData };
}
__name(validateData, "validateData");
var CLIP_DATA_SCHEMA = {
  title: { type: "string", maxLength: 200, required: false },
  description: { type: "string", maxLength: 1e3, required: false },
  tags: { type: "array", maxItems: 20, required: false },
  category: { type: "string", maxLength: 100, required: false },
  language: { type: "string", maxLength: 10, required: false },
  is_public: { type: "boolean", required: false },
  custom_metadata: { type: "object", required: false }
};
var CLIP_FORBIDDEN_FIELDS = [
  "_id",
  "id",
  "owner",
  "created_at",
  "updated_at",
  "broadcaster_id",
  "creator_id",
  "broadcaster_name",
  "creator_name",
  "url",
  "embed_url",
  "thumbnail_url"
];
function validateClipData(data) {
  return validateData(data, CLIP_DATA_SCHEMA, CLIP_FORBIDDEN_FIELDS);
}
__name(validateClipData, "validateClipData");
var CLIP_OBJECT_SCHEMA = {
  id: { type: "string", maxLength: 50, required: true },
  title: { type: "string", maxLength: 200, required: false },
  description: { type: "string", maxLength: 1e3, required: false },
  tags: { type: "array", maxItems: 20, required: false },
  category: { type: "string", maxLength: 100, required: false },
  language: { type: "string", maxLength: 10, required: false },
  is_public: { type: "boolean", required: false },
  custom_metadata: { type: "object", required: false },
  // Twitch-specific fields that might be present
  url: { type: "string", maxLength: 500, required: false },
  embed_url: { type: "string", maxLength: 500, required: false },
  thumbnail_url: { type: "string", maxLength: 500, required: false },
  duration: { type: "number", min: 0, max: 3600, required: false },
  view_count: { type: "number", min: 0, required: false },
  created_at: { type: "string", maxLength: 50, required: false },
  broadcaster_name: { type: "string", maxLength: 100, required: false },
  creator_name: { type: "string", maxLength: 100, required: false }
};
var CLIP_OBJECT_FORBIDDEN_FIELDS = [
  "_id",
  "owner",
  "updated_at",
  "broadcaster_id",
  "creator_id"
];
function validateClipObject(clip) {
  return validateData(clip, CLIP_OBJECT_SCHEMA, CLIP_OBJECT_FORBIDDEN_FIELDS);
}
__name(validateClipObject, "validateClipObject");

// src/services/scheduler.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_twitch();

// src/services/content.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/utils/jwt.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
async function generateJWT(privateKey, appId, options = {}) {
  if (!privateKey)
    throw new Error("generateJWT: privateKey is required");
  if (!appId)
    throw new Error("generateJWT: appId is required");
  const key = privateKey.includes("\\n") ? privateKey.replace(/\\n/g, "\n") : privateKey;
  const toBase64Url = /* @__PURE__ */ __name((input) => {
    const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
    const g2 = typeof globalThis !== "undefined" ? globalThis : {};
    const BufferCtor2 = g2.Buffer;
    if (BufferCtor2) {
      return BufferCtor2.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }
    let binary = "";
    for (let i = 0; i < bytes.length; i++)
      binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }, "toBase64Url");
  const header = options.keyId ? { alg: "RS256", typ: "JWT", kid: options.keyId } : { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const skew = Math.max(0, options.skewSeconds ?? 60);
  const ttl = Math.min(600, Math.max(60, options.ttlSeconds ?? 600));
  const iat = now - skew;
  const exp = iat + ttl;
  if (exp <= now)
    throw new Error("generateJWT: exp must be in the future");
  const appIdNum = Number(appId);
  if (!Number.isInteger(appIdNum) || appIdNum <= 0) {
    throw new Error("generateJWT: appId must be a positive integer");
  }
  const iss = String(appIdNum);
  const payload = { iat, exp, iss };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const pemHeaderPkcs8 = "-----BEGIN PRIVATE KEY-----";
  const pemHeaderPkcs1 = "-----BEGIN RSA PRIVATE KEY-----";
  const pemFooterPkcs8 = "-----END PRIVATE KEY-----";
  const pemFooterPkcs1 = "-----END RSA PRIVATE KEY-----";
  let pemContents = key.replace(pemHeaderPkcs8, "").replace(pemHeaderPkcs1, "").replace(pemFooterPkcs8, "").replace(pemFooterPkcs1, "").replace(/\s/g, "");
  const g = typeof globalThis !== "undefined" ? globalThis : {};
  const BufferCtor = g.Buffer;
  const binaryKey = BufferCtor ? new Uint8Array(BufferCtor.from(pemContents, "base64")) : Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoSubtle = globalThis.crypto?.subtle;
  if (!cryptoSubtle) {
    throw new Error("Web Crypto API not available");
  }
  const cryptoKey = await cryptoSubtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" }
    },
    false,
    ["sign"]
  );
  const signature = await cryptoSubtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}
__name(generateJWT, "generateJWT");

// src/services/content.ts
init_ai();
var ContentService = class {
  constructor(env) {
    this.env = env;
    this.aiService = new AIService(env);
  }
  aiService;
  cachedGitHubToken = null;
  cachedGitHubTokenExpiry = null;
  async selectBestClips(clips, transcripts) {
    console.log("Selecting best clips...");
    const scoredClips = clips.map((clip) => {
      const transcript = transcripts.find((t) => t.clip_id === clip.id);
      const score = this.scoreClip(clip, transcript);
      return { clip, score };
    });
    const sortedClips = scoredClips.sort((a, b) => b.score - a.score).slice(0, Math.min(12, Math.max(5, clips.length))).map((item) => item.clip);
    console.log(`Selected ${sortedClips.length} clips out of ${clips.length}`);
    return sortedClips;
  }
  scoreClip(clip, transcript) {
    let score = 0;
    const text = transcript?.segments?.map((s) => s.text).join(" ").toLowerCase() || "";
    if (text.includes("test") && (text.includes("pass") || text.includes("green")))
      score += 5;
    if (text.includes("commit") || text.includes("merge") || text.includes("pr"))
      score += 4;
    if (text.includes("fix") || text.includes("bug") || text.includes("issue"))
      score += 4;
    if (text.includes("build") && (text.includes("success") || text.includes("fail")))
      score += 3;
    if (text.includes("finally") || text.includes("works"))
      score += 3;
    if (text.includes("error") || text.includes("exception"))
      score += 2;
    if (text.includes("deploy") || text.includes("release"))
      score += 2;
    score += Math.min(clip.view_count / 10, 5);
    if (clip.duration > 120)
      score -= 2;
    return score;
  }
  async generateBlogPost(clips, transcripts) {
    console.log("Generating blog post...");
    const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const sections = [];
    for (const clip of clips) {
      const transcript = transcripts.find((t) => t.clip_id === clip.id);
      const section = await this.generateClipSection(clip, transcript);
      sections.push(section);
    }
    const intro = await this.generateIntro(clips, sections);
    const title = await this.generateTitle(clips, sections);
    return {
      title,
      date,
      clip_count: clips.length,
      sections,
      intro,
      tags: ["Development", "Live Coding", "Twitch", "Daily Recap"]
    };
  }
  parseLLMJSON(raw) {
    try {
      let cleaned = raw.trim();
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in response");
      }
      const jsonStr = jsonMatch[0];
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error("Failed to parse LLM JSON response:", error);
      throw error;
    }
  }
  async generateClipSection(clip, transcript) {
    const text = transcript?.segments?.map((s) => s.text).join(" ") || "";
    const prompt = `Create a blog section for this Twitch clip:

Clip Title: ${clip.title}
Duration: ${clip.duration} seconds
Transcript: ${text}

Generate:
1. A compelling H2 title (max 60 chars)
2. 2-3 bullet points highlighting key moments
3. A 3-5 sentence paragraph summarizing the clip
4. Extract any repository names mentioned

Format as JSON:
{
  "h2": "title",
  "bullets": ["point1", "point2"],
  "paragraph": "summary text",
  "repo": "org/repo if mentioned"
}`;
    let result;
    try {
      result = await this.aiService.callWithRetry("@cf/google/gemma-2b-it", {
        prompt,
        max_tokens: 500
      });
    } catch (error) {
      console.error("AI service call failed:", error);
      return {
        clip_id: clip.id,
        h2: clip.title,
        bullets: ["Development progress", "Live coding session"],
        paragraph: "Interesting development moment captured during the stream.",
        clip_url: clip.embed_url
      };
    }
    try {
      const parsed = this.parseLLMJSON(result.response);
      const h2 = typeof parsed.h2 === "string" ? parsed.h2.substring(0, 60) : clip.title;
      const bullets = Array.isArray(parsed.bullets) && parsed.bullets.length >= 2 && parsed.bullets.length <= 3 ? parsed.bullets.filter((b) => typeof b === "string") : ["Development progress", "Live coding session"];
      const paragraph = typeof parsed.paragraph === "string" && parsed.paragraph.length > 50 ? parsed.paragraph : "Interesting development moment captured during the stream.";
      let repo;
      if (typeof parsed.repo === "string" && parsed.repo.includes("/")) {
        repo = parsed.repo.trim();
      }
      return {
        clip_id: clip.id,
        h2,
        bullets,
        paragraph,
        clip_url: clip.embed_url,
        repo
      };
    } catch (error) {
      console.error("AI response parsing failed:", error);
      return {
        clip_id: clip.id,
        h2: clip.title,
        bullets: ["Development progress", "Live coding session"],
        paragraph: "Interesting development moment captured during the stream.",
        clip_url: clip.embed_url
      };
    }
  }
  async generateIntro(clips, sections) {
    const prompt = `Write a brief intro paragraph for a daily development recap blog post with ${clips.length} clips. Keep it under 100 words and mention it's from a Twitch stream.`;
    const result = await this.aiService.callWithRetry("@cf/google/gemma-2b-it", {
      prompt,
      max_tokens: 200
    });
    return result.response || `Daily development recap from today's Twitch stream featuring ${clips.length} key moments.`;
  }
  async generateTitle(clips, sections) {
    const prompt = `Generate a compelling title for a daily development recap blog post with ${clips.length} clips. Keep it under 60 characters and make it engaging for developers.`;
    const result = await this.aiService.callWithRetry("@cf/google/gemma-2b-it", {
      prompt,
      max_tokens: 100
    });
    return result.response || `Daily Dev Recap - ${clips.length} Key Moments`;
  }
  async createPR(blogPost) {
    console.log("Creating GitHub PR...");
    const date = blogPost.date;
    const branchName = `auto/daily-recap-${date}`;
    const filePath = `content/blog/development/${date}-daily-dev-recap.mdx`;
    try {
      const token = await this.getGitHubToken();
      await this.createBranch(token, branchName);
      const mdxContent = this.generateMDX(blogPost);
      await this.createFile(token, branchName, filePath, mdxContent, `Add daily recap for ${blogPost.date}`, blogPost.date);
      const pr = await this.createPullRequest(token, branchName, blogPost);
      return pr;
    } catch (error) {
      console.error("Failed to create PR:", error);
      throw new Error(`PR creation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  async getGitHubToken() {
    const now = Date.now();
    if (this.cachedGitHubToken && this.cachedGitHubTokenExpiry && now < this.cachedGitHubTokenExpiry) {
      return this.cachedGitHubToken;
    }
    let jwt;
    try {
      jwt = await this.generateJWT();
    } catch (error) {
      throw new Error(`Failed to generate JWT for GitHub authentication: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    let response;
    try {
      response = await fetch(
        `https://api.github.com/app/installations/${this.env.GITHUB_INSTALLATION_ID}/access_tokens`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${jwt}`,
            "Accept": "application/vnd.github.v3+json"
          }
        }
      );
    } catch (error) {
      throw new Error(`Network error while fetching GitHub token: ${error instanceof Error ? error.message : "Unknown network error"}`);
    }
    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = "Unable to read error response body";
      }
      throw new Error(`Failed to get GitHub token: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error(`Failed to parse GitHub token response: ${error instanceof Error ? error.message : "Invalid JSON response"}`);
    }
    this.cachedGitHubToken = data.token;
    this.cachedGitHubTokenExpiry = now + 55 * 60 * 1e3;
    return data.token;
  }
  async generateJWT() {
    return generateJWT(this.env.GITHUB_PRIVATE_KEY, this.env.GITHUB_APP_ID);
  }
  async createBranch(token, branchName) {
    const response = await fetch(
      `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/git/ref/heads/${this.env.CONTENT_REPO_MAIN_BRANCH}`,
      {
        headers: {
          "Authorization": `token ${token}`,
          "Accept": "application/vnd.github.v3+json"
        }
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to get main branch: ${response.statusText}`);
    }
    const data = await response.json();
    const createResponse = await fetch(
      `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/git/refs`,
      {
        method: "POST",
        headers: {
          "Authorization": `token ${token}`,
          "Accept": "application/vnd.github.v3+json"
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: data.object.sha
        })
      }
    );
    if (!createResponse.ok) {
      const errorBody = await createResponse.text();
      if (createResponse.status === 422 && errorBody.includes("Reference already exists")) {
        console.log(`Branch ${branchName} already exists, continuing...`);
      } else {
        throw new Error(`Failed to create branch: ${createResponse.statusText} - ${errorBody}`);
      }
    }
  }
  encodeBase64UnicodeSafe(content) {
    return btoa(unescape(encodeURIComponent(content)));
  }
  async createFile(token, branch, path, content, commitMessage, date) {
    const response = await fetch(
      `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `token ${token}`,
          "Accept": "application/vnd.github.v3+json"
        },
        body: JSON.stringify({
          message: commitMessage,
          content: this.encodeBase64UnicodeSafe(content),
          // Unicode-safe base64 encode
          branch
        })
      }
    );
    if (!response.ok) {
      if (response.status === 422) {
        const getResp = await fetch(
          `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/contents/${path}?ref=${branch}`,
          { headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github+json" } }
        );
        if (!getResp.ok) {
          const t = await getResp.text().catch(() => "");
          throw new Error(`Failed to read existing file for update: ${getResp.status} ${getResp.statusText} - ${t}`);
        }
        const { sha } = await getResp.json();
        const upd = await fetch(
          `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/contents/${path}`,
          {
            method: "PUT",
            headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github+json" },
            body: JSON.stringify({
              message: `Update daily recap for ${date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`,
              content: this.encodeBase64UnicodeSafe(content),
              branch,
              sha
            })
          }
        );
        if (!upd.ok) {
          const t = await upd.text().catch(() => "");
          throw new Error(`Failed to update existing file: ${upd.status} ${upd.statusText} - ${t}`);
        }
        return;
      }
      const body = await response.text().catch(() => "");
      throw new Error(`Failed to create file: ${response.status} ${response.statusText} - ${body}`);
    }
  }
  async createPullRequest(token, branch, blogPost) {
    const response = await fetch(
      `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/pulls`,
      {
        method: "POST",
        headers: {
          "Authorization": `token ${token}`,
          "Accept": "application/vnd.github.v3+json"
        },
        body: JSON.stringify({
          title: blogPost.title,
          body: this.generatePRBody(blogPost),
          head: branch,
          base: this.env.CONTENT_REPO_STAGING_BRANCH,
          draft: false
        })
      }
    );
    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = "Unable to read error response body";
      }
      throw new Error(`Failed to create PR: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    return await response.json();
  }
  generatePRBody(blogPost) {
    const escapeYaml = /* @__PURE__ */ __name((str) => {
      return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
    }, "escapeYaml");
    return `**Date**: ${blogPost.date}
**Clips**: ${blogPost.clip_count}
**Status**: Ready for review

### Summary
${blogPost.intro}

### Clips Included
${blogPost.sections.map((s) => `- ${s.h2}`).join("\n")}

---
*Auto-generated by Twitch Clip Recap Pipeline*`;
  }
  generateMDX(blogPost) {
    const escapeYaml = /* @__PURE__ */ __name((str) => str.replace(/"/g, '\\"'), "escapeYaml");
    const frontMatter = `---
title: "${escapeYaml(blogPost.title)}"
category: "development"
tags: ${JSON.stringify(blogPost.tags)}
description: "${escapeYaml(blogPost.intro)}"
date: "${blogPost.date}"
updated: "${blogPost.date}"
canonical: "https://paulchrisluke.com/blog/development/${blogPost.date}-daily-dev-recap"
draft: false
---

`;
    const content = `${blogPost.intro}

${blogPost.sections.map((section) => `
## ${section.h2}

${section.bullets.map((bullet) => `- ${bullet}`).join("\n")}

${section.paragraph}

<iframe
  src="${section.clip_url}"
  height="378"
  width="620"
  frameborder="0"
  scrolling="no"
  allowfullscreen="true"
  sandbox="allow-scripts allow-same-origin allow-presentation">
</iframe>
`).join("\n")}

---
*Generated from Twitch clips on ${blogPost.date}*`;
    return frontMatter + content;
  }
  async judgeContent(blogPost) {
    console.log("Judging content...");
    const prompt = `Evaluate this blog post for quality and developer relevance:

Title: ${blogPost.title}
Intro: ${blogPost.intro}
Sections: ${blogPost.sections.length}
Content: ${blogPost.sections.map((s) => s.paragraph).join(" ")}

Rate on a scale of 0-100 for each category:
- Coherence (0-20): Each section stands alone
- Technical correctness (0-25): Matches transcript/clip content
- Dev signal (0-20): Clear development milestones
- Narrative flow (0-15): Setup \u2192 attempt \u2192 result
- Length/clarity (0-10): Precise, no fluff
- Safety/compliance (0-10): No secrets/PII

Format as JSON:
{
  "overall": 85,
  "per_axis": {
    "coherence": 18,
    "correctness": 22,
    "dev_signal": 17,
    "narrative_flow": 14,
    "length": 8,
    "safety": 6
  },
  "reasons": ["reason1", "reason2"],
  "action": "approve"
}`;
    const result = await this.aiService.callWithRetry("@cf/google/gemma-2b-it", {
      prompt,
      max_tokens: 500
    });
    try {
      const parsed = this.parseLLMJSON(result.response);
      const overall = typeof parsed.overall === "number" && parsed.overall >= 0 && parsed.overall <= 100 ? parsed.overall : 80;
      const per_axis = typeof parsed.per_axis === "object" && parsed.per_axis !== null ? {
        coherence: typeof parsed.per_axis.coherence === "number" ? Math.max(0, Math.min(20, parsed.per_axis.coherence)) : 18,
        correctness: typeof parsed.per_axis.correctness === "number" ? Math.max(0, Math.min(25, parsed.per_axis.correctness)) : 20,
        dev_signal: typeof parsed.per_axis.dev_signal === "number" ? Math.max(0, Math.min(20, parsed.per_axis.dev_signal)) : 16,
        narrative_flow: typeof parsed.per_axis.narrative_flow === "number" ? Math.max(0, Math.min(15, parsed.per_axis.narrative_flow)) : 14,
        length: typeof parsed.per_axis.length === "number" ? Math.max(0, Math.min(10, parsed.per_axis.length)) : 8,
        safety: typeof parsed.per_axis.safety === "number" ? Math.max(0, Math.min(10, parsed.per_axis.safety)) : 6
      } : {
        coherence: 18,
        correctness: 20,
        dev_signal: 16,
        narrative_flow: 14,
        length: 8,
        safety: 6
      };
      const reasons = Array.isArray(parsed.reasons) && parsed.reasons.length > 0 ? parsed.reasons.filter((r) => typeof r === "string") : ["AI parsing failed, using fallback"];
      const action = parsed.action === "approve" || parsed.action === "reject" || parsed.action === "revise" ? parsed.action : "approve";
      return {
        overall,
        per_axis,
        reasons,
        action
      };
    } catch (error) {
      console.error("AI response parsing failed:", error);
      return {
        overall: 80,
        per_axis: {
          coherence: 18,
          correctness: 20,
          dev_signal: 16,
          narrative_flow: 14,
          length: 8,
          safety: 6
        },
        reasons: ["AI parsing failed, using fallback"],
        action: "approve"
      };
    }
  }
  async updatePRWithJudgeResults(prNumber, judgeResult, headSha) {
    console.log(`Updating PR ${prNumber} with judge results...`);
    const token = await this.getGitHubToken();
    if (!headSha) {
      const prResponse = await fetch(
        `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/pulls/${prNumber}`,
        {
          headers: {
            "Authorization": `token ${token}`,
            "Accept": "application/vnd.github.v3+json"
          }
        }
      );
      if (!prResponse.ok) {
        throw new Error(`Failed to get PR details: ${prResponse.statusText}`);
      }
      const prData = await prResponse.json();
      headSha = prData.head.sha;
    }
    const checkRunResponse = await fetch(
      `https://api.github.com/repos/${this.env.CONTENT_REPO_OWNER}/${this.env.CONTENT_REPO_NAME}/check-runs`,
      {
        method: "POST",
        headers: {
          "Authorization": `token ${token}`,
          "Accept": "application/vnd.github.v3+json"
        },
        body: JSON.stringify({
          name: "Content Quality Judge",
          head_sha: headSha,
          status: "completed",
          completed_at: (/* @__PURE__ */ new Date()).toISOString(),
          conclusion: judgeResult.overall >= 80 ? "success" : "neutral",
          output: {
            title: `Content Quality Score: ${judgeResult.overall}/100`,
            summary: `Judge evaluation completed`,
            text: [
              "## Judge Results",
              "",
              `**Overall Score**: ${judgeResult.overall}/100`,
              "",
              "**Breakdown:**",
              ...Object.entries(judgeResult.per_axis).map(([k, v]) => `- ${k}: ${v}`),
              "",
              "**Reasons:**",
              ...judgeResult.reasons.map((r) => `- ${r}`),
              "",
              `**Action**: ${judgeResult.action}`
            ].join("\n")
          }
        })
      }
    );
    if (!checkRunResponse.ok) {
      let errorBody;
      try {
        errorBody = await checkRunResponse.text();
      } catch {
        errorBody = "Unable to read error response body";
      }
      throw new Error(`Failed to create check run: ${checkRunResponse.status} ${checkRunResponse.statusText} - ${errorBody}`);
    }
  }
};
__name(ContentService, "ContentService");

// src/services/discord.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var DiscordService = class {
  constructor(env) {
    this.env = env;
  }
  async notifyPRCreated(pr, judgeResult, clipCount) {
    console.log(`Notifying Discord about PR ${pr.number} with ${clipCount} clips...`);
    const embed = {
      title: "\u{1F3AC} Daily Dev Recap Ready for Review",
      description: `A new daily development recap has been generated and is ready for review!`,
      color: judgeResult.overall >= 80 ? 65280 : 16753920,
      // Green if good, orange if needs review
      fields: [
        {
          name: "\u{1F4CA} Quality Score",
          value: `${judgeResult.overall}/100`,
          inline: true
        },
        {
          name: "\u{1F3A5} Clips Included",
          value: `${clipCount} clips`,
          inline: true
        },
        {
          name: "\u{1F4DD} Status",
          value: judgeResult.action === "approve" ? "\u2705 Ready to merge" : "\u26A0\uFE0F Needs review",
          inline: true
        },
        {
          name: "\u{1F517} Pull Request",
          value: `[View PR #${pr.number}](${pr.html_url})`,
          inline: false
        }
      ],
      footer: {
        text: "Twitch Clip Recap Pipeline"
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.sendDiscordMessage(embed);
  }
  async notifyError(error) {
    console.log("Sending error notification to Discord...");
    const embed = {
      title: "\u274C Pipeline Error",
      description: "The daily clip recap pipeline encountered an error.",
      color: 16711680,
      // Red
      fields: [
        {
          name: "\u{1F6A8} Error Details",
          value: error.message || "Unknown error occurred",
          inline: false
        }
      ],
      footer: {
        text: "Twitch Clip Recap Pipeline"
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.sendDiscordMessage(embed);
  }
  async notifyTokenValidationErrors(errors) {
    console.log("Sending token validation error notification to Discord...");
    const embed = {
      title: "\u{1F510} Token Validation Failed",
      description: "One or more API tokens failed validation during the hourly check.",
      color: 16739125,
      // Orange-red
      fields: errors.map((error, index) => ({
        name: `Error ${index + 1}`,
        value: error,
        inline: false
      })),
      footer: {
        text: "Twitch Clip Recap Pipeline - Token Validation"
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.sendDiscordMessage(embed);
  }
  async sendDiscordMessage(embed) {
    if (!this.env.DISCORD_REVIEW_CHANNEL_ID || !this.env.DISCORD_BOT_TOKEN) {
      throw new Error(
        "Discord configuration missing: DISCORD_REVIEW_CHANNEL_ID and DISCORD_BOT_TOKEN are required"
      );
    }
    const message = {
      embeds: [embed]
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1e4);
    try {
      const doPost = /* @__PURE__ */ __name(async () => fetch(
        `https://discord.com/api/v10/channels/${this.env.DISCORD_REVIEW_CHANNEL_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${this.env.DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(message),
          signal: controller.signal
        }
      ), "doPost");
      let response = await doPost();
      if (response.status === 429) {
        const { retry_after } = await response.json().catch(() => ({ retry_after: 1 }));
        const ms = Math.ceil((retry_after ?? 1) * 1e3);
        console.warn(`Discord rate limited. Retrying after ${ms}ms...`);
        await new Promise((r) => setTimeout(r, ms));
        response = await doPost();
      }
      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        console.error(`Failed to send Discord message: ${response.status} ${response.statusText} ${errBody}`);
        throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
      }
      const resJson = await response.json().catch(() => null);
      console.log(
        `Discord notification sent successfully${resJson?.id ? ` (message id: ${resJson.id})` : ""}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }
};
__name(DiscordService, "DiscordService");

// src/services/scheduler.ts
async function handleScheduled(event, env, ctx) {
  console.log(`Scheduled event triggered: ${event.cron}`);
  if (event.cron === "0 * * * *") {
    await handleTokenValidation(env);
    return;
  }
  if (event.cron === "0 2 * * *") {
    await handleDailyPipeline(env);
    return;
  }
  console.log(`Unknown cron pattern: ${event.cron}`);
}
__name(handleScheduled, "handleScheduled");
async function handleTokenValidation(env) {
  console.log("Starting hourly token validation...");
  const validationErrors = [];
  try {
    const twitchService = new TwitchService(env);
    const token = await twitchService.getValidatedToken();
    console.log("\u2705 Twitch token validation successful");
  } catch (error) {
    const errorMsg = `Twitch token validation failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    console.error("\u274C", errorMsg);
    validationErrors.push(errorMsg);
  }
  try {
    const contentService = new ContentService(env);
    const token = await contentService.getGitHubToken();
    console.log("\u2705 GitHub App token validation successful");
  } catch (error) {
    const errorMsg = `GitHub App token validation failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    console.error("\u274C", errorMsg);
    validationErrors.push(errorMsg);
  }
  try {
    const testToken = env.GITHUB_TOKEN || env.GITHUB_TOKEN_PAULCHRISLUKE || env.GITHUB_TOKEN_BLAWBY;
    if (testToken) {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `Bearer ${testToken}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "clip-recap-pipeline/1.0.0"
        }
      });
      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
      }
      console.log("\u2705 GitHub personal token validation successful");
    } else {
      console.log("\u26A0\uFE0F No GitHub personal tokens found to validate");
    }
  } catch (error) {
    const errorMsg = `GitHub personal token validation failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    console.error("\u274C", errorMsg);
    validationErrors.push(errorMsg);
  }
  if (validationErrors.length > 0) {
    try {
      const discordService = new DiscordService(env);
      await discordService.notifyTokenValidationErrors(validationErrors);
    } catch (discordError) {
      console.error("Failed to send token validation error notification:", discordError);
    }
  }
}
__name(handleTokenValidation, "handleTokenValidation");
async function handleDailyPipeline(env) {
  console.log("Starting daily clip recap pipeline...");
  try {
    const twitchService = new TwitchService(env);
    const contentService = new ContentService(env);
    const discordService = new DiscordService(env);
    console.log("Fetching clips...");
    const clips = await twitchService.getRecentClips();
    if (clips.length === 0) {
      console.log("No clips found for the last 24 hours");
      return;
    }
    console.log(`Transcribing ${clips.length} clips...`);
    const transcripts = await twitchService.transcribeClips(clips);
    console.log("Scoring and selecting clips...");
    const selectedClips = await contentService.selectBestClips(clips, transcripts);
    if (!selectedClips?.length) {
      console.log("No clips selected after scoring. Skipping blog generation and PR creation.");
      return;
    }
    console.log("Generating blog post...");
    const blogPost = await contentService.generateBlogPost(selectedClips, transcripts);
    console.log("Creating GitHub PR...");
    const pr = await contentService.createPR(blogPost);
    console.log("Running content judge...");
    const judgeResult = await contentService.judgeContent(blogPost);
    await contentService.updatePRWithJudgeResults(pr.number, judgeResult);
    console.log("Sending Discord notification...");
    await discordService.notifyPRCreated(pr, judgeResult, selectedClips.length);
    console.log("Pipeline completed successfully!");
  } catch (error) {
    console.error("Pipeline failed:", error);
    try {
      const discordService = new DiscordService(env);
      await discordService.notifyError(error);
    } catch (discordError) {
      console.error("Failed to send error notification:", discordError);
    }
  }
}
__name(handleDailyPipeline, "handleDailyPipeline");

// src/services/webhooks.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
async function handleWebhook(request2, env, ctx) {
  try {
    const bodyBytes = await request2.arrayBuffer();
    const signature = request2.headers.get("x-hub-signature-256");
    if (!env.GITHUB_WEBHOOK_SECRET) {
      console.error("Missing GITHUB_WEBHOOK_SECRET");
      return new Response("Internal Server Error", { status: 500 });
    }
    if (!await verifyWebhookSignature(bodyBytes, signature, env.GITHUB_WEBHOOK_SECRET)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const event = request2.headers.get("x-github-event");
    if (!event) {
      return new Response("Bad Request: Missing x-github-event", { status: 400 });
    }
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(bodyBytes));
    } catch (e) {
      console.error("Invalid JSON payload", e);
      return new Response("Bad Request: Invalid JSON", { status: 400 });
    }
    const delivery = request2.headers.get("x-github-delivery");
    console.log(`Received GitHub webhook: ${event} (delivery: ${delivery})`);
    switch (event) {
      case "pull_request": {
        return await handlePullRequestEvent(payload, env);
      }
      case "check_run": {
        return await handleCheckRunEvent(payload, env);
      }
      default: {
        console.log(`Unhandled event type: ${event}`);
        return new Response(null, { status: 204 });
      }
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
__name(handleWebhook, "handleWebhook");
async function verifyWebhookSignature(body, signature, secret) {
  try {
    if (!signature || !signature.startsWith("sha256=")) {
      return false;
    }
    const signatureValue = signature.substring(7);
    if (!/^[a-f0-9]{64}$/i.test(signatureValue)) {
      return false;
    }
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = new Uint8Array(
      signatureValue.match(/.{1,2}/g).map((h) => parseInt(h, 16))
    );
    return crypto.subtle.verify("HMAC", key, sigBytes, body);
  } catch (error) {
    console.error("Webhook signature verification error:", error);
    return false;
  }
}
__name(verifyWebhookSignature, "verifyWebhookSignature");
async function handlePullRequestEvent(payload, env) {
  const { action, pull_request } = payload;
  console.log(`PR ${action}: #${pull_request.number} - ${pull_request.title}`);
  if (action === "closed" && pull_request.merged) {
    console.log(`PR #${pull_request.number} was merged`);
  }
  return new Response("OK", { status: 200 });
}
__name(handlePullRequestEvent, "handlePullRequestEvent");
async function handleCheckRunEvent(payload, env) {
  const { action, check_run } = payload;
  console.log(`Check run ${action}: ${check_run.name} - ${check_run.conclusion}`);
  if (action === "completed") {
    console.log(`Check run completed: ${check_run.name} with conclusion: ${check_run.conclusion}`);
  }
  return new Response("OK", { status: 200 });
}
__name(handleCheckRunEvent, "handleCheckRunEvent");

// src/routes/github.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/services/github.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/@octokit/rest/dist-src/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/@octokit/core/dist-src/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/universal-user-agent/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function getUserAgent() {
  if (typeof navigator === "object" && "userAgent" in navigator) {
    return "Cloudflare-Workers";
  }
  if (typeof process === "object" && process.version !== void 0) {
    return `Node.js/${process.version.substr(1)} (${process.platform}; ${process.arch})`;
  }
  return "<environment undetectable>";
}
__name(getUserAgent, "getUserAgent");

// node_modules/before-after-hook/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/before-after-hook/lib/register.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function register(state, name, method, options) {
  if (typeof method !== "function") {
    throw new Error("method for before hook must be a function");
  }
  if (!options) {
    options = {};
  }
  if (Array.isArray(name)) {
    return name.reverse().reduce((callback, name2) => {
      return register.bind(null, state, name2, callback, options);
    }, method)();
  }
  return Promise.resolve().then(() => {
    if (!state.registry[name]) {
      return method(options);
    }
    return state.registry[name].reduce((method2, registered) => {
      return registered.hook.bind(null, method2, options);
    }, method)();
  });
}
__name(register, "register");

// node_modules/before-after-hook/lib/add.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function addHook(state, kind, name, hook2) {
  const orig = hook2;
  if (!state.registry[name]) {
    state.registry[name] = [];
  }
  if (kind === "before") {
    hook2 = /* @__PURE__ */ __name((method, options) => {
      return Promise.resolve().then(orig.bind(null, options)).then(method.bind(null, options));
    }, "hook");
  }
  if (kind === "after") {
    hook2 = /* @__PURE__ */ __name((method, options) => {
      let result;
      return Promise.resolve().then(method.bind(null, options)).then((result_) => {
        result = result_;
        return orig(result, options);
      }).then(() => {
        return result;
      });
    }, "hook");
  }
  if (kind === "error") {
    hook2 = /* @__PURE__ */ __name((method, options) => {
      return Promise.resolve().then(method.bind(null, options)).catch((error) => {
        return orig(error, options);
      });
    }, "hook");
  }
  state.registry[name].push({
    hook: hook2,
    orig
  });
}
__name(addHook, "addHook");

// node_modules/before-after-hook/lib/remove.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function removeHook(state, name, method) {
  if (!state.registry[name]) {
    return;
  }
  const index = state.registry[name].map((registered) => {
    return registered.orig;
  }).indexOf(method);
  if (index === -1) {
    return;
  }
  state.registry[name].splice(index, 1);
}
__name(removeHook, "removeHook");

// node_modules/before-after-hook/index.js
var bind = Function.bind;
var bindable = bind.bind(bind);
function bindApi(hook2, state, name) {
  const removeHookRef = bindable(removeHook, null).apply(
    null,
    name ? [state, name] : [state]
  );
  hook2.api = { remove: removeHookRef };
  hook2.remove = removeHookRef;
  ["before", "error", "after", "wrap"].forEach((kind) => {
    const args = name ? [state, kind, name] : [state, kind];
    hook2[kind] = hook2.api[kind] = bindable(addHook, null).apply(null, args);
  });
}
__name(bindApi, "bindApi");
function Singular() {
  const singularHookName = Symbol("Singular");
  const singularHookState = {
    registry: {}
  };
  const singularHook = register.bind(null, singularHookState, singularHookName);
  bindApi(singularHook, singularHookState, singularHookName);
  return singularHook;
}
__name(Singular, "Singular");
function Collection() {
  const state = {
    registry: {}
  };
  const hook2 = register.bind(null, state);
  bindApi(hook2, state);
  return hook2;
}
__name(Collection, "Collection");
var before_after_hook_default = { Singular, Collection };

// node_modules/@octokit/request/dist-bundle/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/@octokit/endpoint/dist-bundle/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var VERSION = "0.0.0-development";
var userAgent = `octokit-endpoint.js/${VERSION} ${getUserAgent()}`;
var DEFAULTS = {
  method: "GET",
  baseUrl: "https://api.github.com",
  headers: {
    accept: "application/vnd.github.v3+json",
    "user-agent": userAgent
  },
  mediaType: {
    format: ""
  }
};
function lowercaseKeys(object) {
  if (!object) {
    return {};
  }
  return Object.keys(object).reduce((newObj, key) => {
    newObj[key.toLowerCase()] = object[key];
    return newObj;
  }, {});
}
__name(lowercaseKeys, "lowercaseKeys");
function isPlainObject(value) {
  if (typeof value !== "object" || value === null)
    return false;
  if (Object.prototype.toString.call(value) !== "[object Object]")
    return false;
  const proto = Object.getPrototypeOf(value);
  if (proto === null)
    return true;
  const Ctor = Object.prototype.hasOwnProperty.call(proto, "constructor") && proto.constructor;
  return typeof Ctor === "function" && Ctor instanceof Ctor && Function.prototype.call(Ctor) === Function.prototype.call(value);
}
__name(isPlainObject, "isPlainObject");
function mergeDeep(defaults, options) {
  const result = Object.assign({}, defaults);
  Object.keys(options).forEach((key) => {
    if (isPlainObject(options[key])) {
      if (!(key in defaults))
        Object.assign(result, { [key]: options[key] });
      else
        result[key] = mergeDeep(defaults[key], options[key]);
    } else {
      Object.assign(result, { [key]: options[key] });
    }
  });
  return result;
}
__name(mergeDeep, "mergeDeep");
function removeUndefinedProperties(obj) {
  for (const key in obj) {
    if (obj[key] === void 0) {
      delete obj[key];
    }
  }
  return obj;
}
__name(removeUndefinedProperties, "removeUndefinedProperties");
function merge(defaults, route, options) {
  if (typeof route === "string") {
    let [method, url] = route.split(" ");
    options = Object.assign(url ? { method, url } : { url: method }, options);
  } else {
    options = Object.assign({}, route);
  }
  options.headers = lowercaseKeys(options.headers);
  removeUndefinedProperties(options);
  removeUndefinedProperties(options.headers);
  const mergedOptions = mergeDeep(defaults || {}, options);
  if (options.url === "/graphql") {
    if (defaults && defaults.mediaType.previews?.length) {
      mergedOptions.mediaType.previews = defaults.mediaType.previews.filter(
        (preview) => !mergedOptions.mediaType.previews.includes(preview)
      ).concat(mergedOptions.mediaType.previews);
    }
    mergedOptions.mediaType.previews = (mergedOptions.mediaType.previews || []).map((preview) => preview.replace(/-preview/, ""));
  }
  return mergedOptions;
}
__name(merge, "merge");
function addQueryParameters(url, parameters) {
  const separator = /\?/.test(url) ? "&" : "?";
  const names = Object.keys(parameters);
  if (names.length === 0) {
    return url;
  }
  return url + separator + names.map((name) => {
    if (name === "q") {
      return "q=" + parameters.q.split("+").map(encodeURIComponent).join("+");
    }
    return `${name}=${encodeURIComponent(parameters[name])}`;
  }).join("&");
}
__name(addQueryParameters, "addQueryParameters");
var urlVariableRegex = /\{[^{}}]+\}/g;
function removeNonChars(variableName) {
  return variableName.replace(/(?:^\W+)|(?:(?<!\W)\W+$)/g, "").split(/,/);
}
__name(removeNonChars, "removeNonChars");
function extractUrlVariableNames(url) {
  const matches = url.match(urlVariableRegex);
  if (!matches) {
    return [];
  }
  return matches.map(removeNonChars).reduce((a, b) => a.concat(b), []);
}
__name(extractUrlVariableNames, "extractUrlVariableNames");
function omit(object, keysToOmit) {
  const result = { __proto__: null };
  for (const key of Object.keys(object)) {
    if (keysToOmit.indexOf(key) === -1) {
      result[key] = object[key];
    }
  }
  return result;
}
__name(omit, "omit");
function encodeReserved(str) {
  return str.split(/(%[0-9A-Fa-f]{2})/g).map(function(part) {
    if (!/%[0-9A-Fa-f]/.test(part)) {
      part = encodeURI(part).replace(/%5B/g, "[").replace(/%5D/g, "]");
    }
    return part;
  }).join("");
}
__name(encodeReserved, "encodeReserved");
function encodeUnreserved(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return "%" + c.charCodeAt(0).toString(16).toUpperCase();
  });
}
__name(encodeUnreserved, "encodeUnreserved");
function encodeValue(operator, value, key) {
  value = operator === "+" || operator === "#" ? encodeReserved(value) : encodeUnreserved(value);
  if (key) {
    return encodeUnreserved(key) + "=" + value;
  } else {
    return value;
  }
}
__name(encodeValue, "encodeValue");
function isDefined(value) {
  return value !== void 0 && value !== null;
}
__name(isDefined, "isDefined");
function isKeyOperator(operator) {
  return operator === ";" || operator === "&" || operator === "?";
}
__name(isKeyOperator, "isKeyOperator");
function getValues(context, operator, key, modifier) {
  var value = context[key], result = [];
  if (isDefined(value) && value !== "") {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      value = value.toString();
      if (modifier && modifier !== "*") {
        value = value.substring(0, parseInt(modifier, 10));
      }
      result.push(
        encodeValue(operator, value, isKeyOperator(operator) ? key : "")
      );
    } else {
      if (modifier === "*") {
        if (Array.isArray(value)) {
          value.filter(isDefined).forEach(function(value2) {
            result.push(
              encodeValue(operator, value2, isKeyOperator(operator) ? key : "")
            );
          });
        } else {
          Object.keys(value).forEach(function(k) {
            if (isDefined(value[k])) {
              result.push(encodeValue(operator, value[k], k));
            }
          });
        }
      } else {
        const tmp = [];
        if (Array.isArray(value)) {
          value.filter(isDefined).forEach(function(value2) {
            tmp.push(encodeValue(operator, value2));
          });
        } else {
          Object.keys(value).forEach(function(k) {
            if (isDefined(value[k])) {
              tmp.push(encodeUnreserved(k));
              tmp.push(encodeValue(operator, value[k].toString()));
            }
          });
        }
        if (isKeyOperator(operator)) {
          result.push(encodeUnreserved(key) + "=" + tmp.join(","));
        } else if (tmp.length !== 0) {
          result.push(tmp.join(","));
        }
      }
    }
  } else {
    if (operator === ";") {
      if (isDefined(value)) {
        result.push(encodeUnreserved(key));
      }
    } else if (value === "" && (operator === "&" || operator === "?")) {
      result.push(encodeUnreserved(key) + "=");
    } else if (value === "") {
      result.push("");
    }
  }
  return result;
}
__name(getValues, "getValues");
function parseUrl(template) {
  return {
    expand: expand.bind(null, template)
  };
}
__name(parseUrl, "parseUrl");
function expand(template, context) {
  var operators = ["+", "#", ".", "/", ";", "?", "&"];
  template = template.replace(
    /\{([^\{\}]+)\}|([^\{\}]+)/g,
    function(_, expression, literal) {
      if (expression) {
        let operator = "";
        const values = [];
        if (operators.indexOf(expression.charAt(0)) !== -1) {
          operator = expression.charAt(0);
          expression = expression.substr(1);
        }
        expression.split(/,/g).forEach(function(variable) {
          var tmp = /([^:\*]*)(?::(\d+)|(\*))?/.exec(variable);
          values.push(getValues(context, operator, tmp[1], tmp[2] || tmp[3]));
        });
        if (operator && operator !== "+") {
          var separator = ",";
          if (operator === "?") {
            separator = "&";
          } else if (operator !== "#") {
            separator = operator;
          }
          return (values.length !== 0 ? operator : "") + values.join(separator);
        } else {
          return values.join(",");
        }
      } else {
        return encodeReserved(literal);
      }
    }
  );
  if (template === "/") {
    return template;
  } else {
    return template.replace(/\/$/, "");
  }
}
__name(expand, "expand");
function parse(options) {
  let method = options.method.toUpperCase();
  let url = (options.url || "/").replace(/:([a-z]\w+)/g, "{$1}");
  let headers = Object.assign({}, options.headers);
  let body;
  let parameters = omit(options, [
    "method",
    "baseUrl",
    "url",
    "headers",
    "request",
    "mediaType"
  ]);
  const urlVariableNames = extractUrlVariableNames(url);
  url = parseUrl(url).expand(parameters);
  if (!/^http/.test(url)) {
    url = options.baseUrl + url;
  }
  const omittedParameters = Object.keys(options).filter((option) => urlVariableNames.includes(option)).concat("baseUrl");
  const remainingParameters = omit(parameters, omittedParameters);
  const isBinaryRequest = /application\/octet-stream/i.test(headers.accept);
  if (!isBinaryRequest) {
    if (options.mediaType.format) {
      headers.accept = headers.accept.split(/,/).map(
        (format) => format.replace(
          /application\/vnd(\.\w+)(\.v3)?(\.\w+)?(\+json)?$/,
          `application/vnd$1$2.${options.mediaType.format}`
        )
      ).join(",");
    }
    if (url.endsWith("/graphql")) {
      if (options.mediaType.previews?.length) {
        const previewsFromAcceptHeader = headers.accept.match(/(?<![\w-])[\w-]+(?=-preview)/g) || [];
        headers.accept = previewsFromAcceptHeader.concat(options.mediaType.previews).map((preview) => {
          const format = options.mediaType.format ? `.${options.mediaType.format}` : "+json";
          return `application/vnd.github.${preview}-preview${format}`;
        }).join(",");
      }
    }
  }
  if (["GET", "HEAD"].includes(method)) {
    url = addQueryParameters(url, remainingParameters);
  } else {
    if ("data" in remainingParameters) {
      body = remainingParameters.data;
    } else {
      if (Object.keys(remainingParameters).length) {
        body = remainingParameters;
      }
    }
  }
  if (!headers["content-type"] && typeof body !== "undefined") {
    headers["content-type"] = "application/json; charset=utf-8";
  }
  if (["PATCH", "PUT"].includes(method) && typeof body === "undefined") {
    body = "";
  }
  return Object.assign(
    { method, url, headers },
    typeof body !== "undefined" ? { body } : null,
    options.request ? { request: options.request } : null
  );
}
__name(parse, "parse");
function endpointWithDefaults(defaults, route, options) {
  return parse(merge(defaults, route, options));
}
__name(endpointWithDefaults, "endpointWithDefaults");
function withDefaults(oldDefaults, newDefaults) {
  const DEFAULTS2 = merge(oldDefaults, newDefaults);
  const endpoint2 = endpointWithDefaults.bind(null, DEFAULTS2);
  return Object.assign(endpoint2, {
    DEFAULTS: DEFAULTS2,
    defaults: withDefaults.bind(null, DEFAULTS2),
    merge: merge.bind(null, DEFAULTS2),
    parse
  });
}
__name(withDefaults, "withDefaults");
var endpoint = withDefaults(null, DEFAULTS);

// node_modules/@octokit/request/dist-bundle/index.js
var import_fast_content_type_parse = __toESM(require_fast_content_type_parse(), 1);

// node_modules/@octokit/request-error/dist-src/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var RequestError = class extends Error {
  name;
  /**
   * http status code
   */
  status;
  /**
   * Request options that lead to the error.
   */
  request;
  /**
   * Response object if a response was received
   */
  response;
  constructor(message, statusCode, options) {
    super(message);
    this.name = "HttpError";
    this.status = Number.parseInt(statusCode);
    if (Number.isNaN(this.status)) {
      this.status = 0;
    }
    if ("response" in options) {
      this.response = options.response;
    }
    const requestCopy = Object.assign({}, options.request);
    if (options.request.headers.authorization) {
      requestCopy.headers = Object.assign({}, options.request.headers, {
        authorization: options.request.headers.authorization.replace(
          /(?<! ) .*$/,
          " [REDACTED]"
        )
      });
    }
    requestCopy.url = requestCopy.url.replace(/\bclient_secret=\w+/g, "client_secret=[REDACTED]").replace(/\baccess_token=\w+/g, "access_token=[REDACTED]");
    this.request = requestCopy;
  }
};
__name(RequestError, "RequestError");

// node_modules/@octokit/request/dist-bundle/index.js
var VERSION2 = "9.2.4";
var defaults_default = {
  headers: {
    "user-agent": `octokit-request.js/${VERSION2} ${getUserAgent()}`
  }
};
function isPlainObject2(value) {
  if (typeof value !== "object" || value === null)
    return false;
  if (Object.prototype.toString.call(value) !== "[object Object]")
    return false;
  const proto = Object.getPrototypeOf(value);
  if (proto === null)
    return true;
  const Ctor = Object.prototype.hasOwnProperty.call(proto, "constructor") && proto.constructor;
  return typeof Ctor === "function" && Ctor instanceof Ctor && Function.prototype.call(Ctor) === Function.prototype.call(value);
}
__name(isPlainObject2, "isPlainObject");
async function fetchWrapper(requestOptions) {
  const fetch2 = requestOptions.request?.fetch || globalThis.fetch;
  if (!fetch2) {
    throw new Error(
      "fetch is not set. Please pass a fetch implementation as new Octokit({ request: { fetch }}). Learn more at https://github.com/octokit/octokit.js/#fetch-missing"
    );
  }
  const log = requestOptions.request?.log || console;
  const parseSuccessResponseBody = requestOptions.request?.parseSuccessResponseBody !== false;
  const body = isPlainObject2(requestOptions.body) || Array.isArray(requestOptions.body) ? JSON.stringify(requestOptions.body) : requestOptions.body;
  const requestHeaders = Object.fromEntries(
    Object.entries(requestOptions.headers).map(([name, value]) => [
      name,
      String(value)
    ])
  );
  let fetchResponse;
  try {
    fetchResponse = await fetch2(requestOptions.url, {
      method: requestOptions.method,
      body,
      redirect: requestOptions.request?.redirect,
      headers: requestHeaders,
      signal: requestOptions.request?.signal,
      // duplex must be set if request.body is ReadableStream or Async Iterables.
      // See https://fetch.spec.whatwg.org/#dom-requestinit-duplex.
      ...requestOptions.body && { duplex: "half" }
    });
  } catch (error) {
    let message = "Unknown Error";
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        error.status = 500;
        throw error;
      }
      message = error.message;
      if (error.name === "TypeError" && "cause" in error) {
        if (error.cause instanceof Error) {
          message = error.cause.message;
        } else if (typeof error.cause === "string") {
          message = error.cause;
        }
      }
    }
    const requestError = new RequestError(message, 500, {
      request: requestOptions
    });
    requestError.cause = error;
    throw requestError;
  }
  const status = fetchResponse.status;
  const url = fetchResponse.url;
  const responseHeaders = {};
  for (const [key, value] of fetchResponse.headers) {
    responseHeaders[key] = value;
  }
  const octokitResponse = {
    url,
    status,
    headers: responseHeaders,
    data: ""
  };
  if ("deprecation" in responseHeaders) {
    const matches = responseHeaders.link && responseHeaders.link.match(/<([^<>]+)>; rel="deprecation"/);
    const deprecationLink = matches && matches.pop();
    log.warn(
      `[@octokit/request] "${requestOptions.method} ${requestOptions.url}" is deprecated. It is scheduled to be removed on ${responseHeaders.sunset}${deprecationLink ? `. See ${deprecationLink}` : ""}`
    );
  }
  if (status === 204 || status === 205) {
    return octokitResponse;
  }
  if (requestOptions.method === "HEAD") {
    if (status < 400) {
      return octokitResponse;
    }
    throw new RequestError(fetchResponse.statusText, status, {
      response: octokitResponse,
      request: requestOptions
    });
  }
  if (status === 304) {
    octokitResponse.data = await getResponseData(fetchResponse);
    throw new RequestError("Not modified", status, {
      response: octokitResponse,
      request: requestOptions
    });
  }
  if (status >= 400) {
    octokitResponse.data = await getResponseData(fetchResponse);
    throw new RequestError(toErrorMessage(octokitResponse.data), status, {
      response: octokitResponse,
      request: requestOptions
    });
  }
  octokitResponse.data = parseSuccessResponseBody ? await getResponseData(fetchResponse) : fetchResponse.body;
  return octokitResponse;
}
__name(fetchWrapper, "fetchWrapper");
async function getResponseData(response) {
  const contentType = response.headers.get("content-type");
  if (!contentType) {
    return response.text().catch(() => "");
  }
  const mimetype = (0, import_fast_content_type_parse.safeParse)(contentType);
  if (isJSONResponse(mimetype)) {
    let text = "";
    try {
      text = await response.text();
      return JSON.parse(text);
    } catch (err) {
      return text;
    }
  } else if (mimetype.type.startsWith("text/") || mimetype.parameters.charset?.toLowerCase() === "utf-8") {
    return response.text().catch(() => "");
  } else {
    return response.arrayBuffer().catch(() => new ArrayBuffer(0));
  }
}
__name(getResponseData, "getResponseData");
function isJSONResponse(mimetype) {
  return mimetype.type === "application/json" || mimetype.type === "application/scim+json";
}
__name(isJSONResponse, "isJSONResponse");
function toErrorMessage(data) {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return "Unknown error";
  }
  if ("message" in data) {
    const suffix = "documentation_url" in data ? ` - ${data.documentation_url}` : "";
    return Array.isArray(data.errors) ? `${data.message}: ${data.errors.map((v) => JSON.stringify(v)).join(", ")}${suffix}` : `${data.message}${suffix}`;
  }
  return `Unknown error: ${JSON.stringify(data)}`;
}
__name(toErrorMessage, "toErrorMessage");
function withDefaults2(oldEndpoint, newDefaults) {
  const endpoint2 = oldEndpoint.defaults(newDefaults);
  const newApi = /* @__PURE__ */ __name(function(route, parameters) {
    const endpointOptions = endpoint2.merge(route, parameters);
    if (!endpointOptions.request || !endpointOptions.request.hook) {
      return fetchWrapper(endpoint2.parse(endpointOptions));
    }
    const request2 = /* @__PURE__ */ __name((route2, parameters2) => {
      return fetchWrapper(
        endpoint2.parse(endpoint2.merge(route2, parameters2))
      );
    }, "request2");
    Object.assign(request2, {
      endpoint: endpoint2,
      defaults: withDefaults2.bind(null, endpoint2)
    });
    return endpointOptions.request.hook(request2, endpointOptions);
  }, "newApi");
  return Object.assign(newApi, {
    endpoint: endpoint2,
    defaults: withDefaults2.bind(null, endpoint2)
  });
}
__name(withDefaults2, "withDefaults");
var request = withDefaults2(endpoint, defaults_default);

// node_modules/@octokit/graphql/dist-bundle/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var VERSION3 = "0.0.0-development";
function _buildMessageForResponseErrors(data) {
  return `Request failed due to following response errors:
` + data.errors.map((e) => ` - ${e.message}`).join("\n");
}
__name(_buildMessageForResponseErrors, "_buildMessageForResponseErrors");
var GraphqlResponseError = /* @__PURE__ */ __name(class extends Error {
  constructor(request2, headers, response) {
    super(_buildMessageForResponseErrors(response));
    this.request = request2;
    this.headers = headers;
    this.response = response;
    this.errors = response.errors;
    this.data = response.data;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  name = "GraphqlResponseError";
  errors;
  data;
}, "GraphqlResponseError");
var NON_VARIABLE_OPTIONS = [
  "method",
  "baseUrl",
  "url",
  "headers",
  "request",
  "query",
  "mediaType",
  "operationName"
];
var FORBIDDEN_VARIABLE_OPTIONS = ["query", "method", "url"];
var GHES_V3_SUFFIX_REGEX = /\/api\/v3\/?$/;
function graphql(request2, query, options) {
  if (options) {
    if (typeof query === "string" && "query" in options) {
      return Promise.reject(
        new Error(`[@octokit/graphql] "query" cannot be used as variable name`)
      );
    }
    for (const key in options) {
      if (!FORBIDDEN_VARIABLE_OPTIONS.includes(key))
        continue;
      return Promise.reject(
        new Error(
          `[@octokit/graphql] "${key}" cannot be used as variable name`
        )
      );
    }
  }
  const parsedOptions = typeof query === "string" ? Object.assign({ query }, options) : query;
  const requestOptions = Object.keys(
    parsedOptions
  ).reduce((result, key) => {
    if (NON_VARIABLE_OPTIONS.includes(key)) {
      result[key] = parsedOptions[key];
      return result;
    }
    if (!result.variables) {
      result.variables = {};
    }
    result.variables[key] = parsedOptions[key];
    return result;
  }, {});
  const baseUrl = parsedOptions.baseUrl || request2.endpoint.DEFAULTS.baseUrl;
  if (GHES_V3_SUFFIX_REGEX.test(baseUrl)) {
    requestOptions.url = baseUrl.replace(GHES_V3_SUFFIX_REGEX, "/api/graphql");
  }
  return request2(requestOptions).then((response) => {
    if (response.data.errors) {
      const headers = {};
      for (const key of Object.keys(response.headers)) {
        headers[key] = response.headers[key];
      }
      throw new GraphqlResponseError(
        requestOptions,
        headers,
        response.data
      );
    }
    return response.data.data;
  });
}
__name(graphql, "graphql");
function withDefaults3(request2, newDefaults) {
  const newRequest = request2.defaults(newDefaults);
  const newApi = /* @__PURE__ */ __name((query, options) => {
    return graphql(newRequest, query, options);
  }, "newApi");
  return Object.assign(newApi, {
    defaults: withDefaults3.bind(null, newRequest),
    endpoint: newRequest.endpoint
  });
}
__name(withDefaults3, "withDefaults");
var graphql2 = withDefaults3(request, {
  headers: {
    "user-agent": `octokit-graphql.js/${VERSION3} ${getUserAgent()}`
  },
  method: "POST",
  url: "/graphql"
});
function withCustomRequest(customRequest) {
  return withDefaults3(customRequest, {
    method: "POST",
    url: "/graphql"
  });
}
__name(withCustomRequest, "withCustomRequest");

// node_modules/@octokit/auth-token/dist-bundle/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var b64url = "(?:[a-zA-Z0-9_-]+)";
var sep = "\\.";
var jwtRE = new RegExp(`^${b64url}${sep}${b64url}${sep}${b64url}$`);
var isJWT = jwtRE.test.bind(jwtRE);
async function auth(token) {
  const isApp = isJWT(token);
  const isInstallation = token.startsWith("v1.") || token.startsWith("ghs_");
  const isUserToServer = token.startsWith("ghu_");
  const tokenType = isApp ? "app" : isInstallation ? "installation" : isUserToServer ? "user-to-server" : "oauth";
  return {
    type: "token",
    token,
    tokenType
  };
}
__name(auth, "auth");
function withAuthorizationPrefix(token) {
  if (token.split(/\./).length === 3) {
    return `bearer ${token}`;
  }
  return `token ${token}`;
}
__name(withAuthorizationPrefix, "withAuthorizationPrefix");
async function hook(token, request2, route, parameters) {
  const endpoint2 = request2.endpoint.merge(
    route,
    parameters
  );
  endpoint2.headers.authorization = withAuthorizationPrefix(token);
  return request2(endpoint2);
}
__name(hook, "hook");
var createTokenAuth = /* @__PURE__ */ __name(function createTokenAuth2(token) {
  if (!token) {
    throw new Error("[@octokit/auth-token] No token passed to createTokenAuth");
  }
  if (typeof token !== "string") {
    throw new Error(
      "[@octokit/auth-token] Token passed to createTokenAuth is not a string"
    );
  }
  token = token.replace(/^(token|bearer) +/i, "");
  return Object.assign(auth.bind(null, token), {
    hook: hook.bind(null, token)
  });
}, "createTokenAuth2");

// node_modules/@octokit/core/dist-src/version.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var VERSION4 = "6.1.6";

// node_modules/@octokit/core/dist-src/index.js
var noop = /* @__PURE__ */ __name(() => {
}, "noop");
var consoleWarn = console.warn.bind(console);
var consoleError = console.error.bind(console);
function createLogger(logger = {}) {
  if (typeof logger.debug !== "function") {
    logger.debug = noop;
  }
  if (typeof logger.info !== "function") {
    logger.info = noop;
  }
  if (typeof logger.warn !== "function") {
    logger.warn = consoleWarn;
  }
  if (typeof logger.error !== "function") {
    logger.error = consoleError;
  }
  return logger;
}
__name(createLogger, "createLogger");
var userAgentTrail = `octokit-core.js/${VERSION4} ${getUserAgent()}`;
var Octokit = class {
  static defaults(defaults) {
    const OctokitWithDefaults = /* @__PURE__ */ __name(class extends this {
      constructor(...args) {
        const options = args[0] || {};
        if (typeof defaults === "function") {
          super(defaults(options));
          return;
        }
        super(
          Object.assign(
            {},
            defaults,
            options,
            options.userAgent && defaults.userAgent ? {
              userAgent: `${options.userAgent} ${defaults.userAgent}`
            } : null
          )
        );
      }
    }, "OctokitWithDefaults");
    return OctokitWithDefaults;
  }
  /**
   * Attach a plugin (or many) to your Octokit instance.
   *
   * @example
   * const API = Octokit.plugin(plugin1, plugin2, plugin3, ...)
   */
  static plugin(...newPlugins) {
    const currentPlugins = this.plugins;
    const NewOctokit = /* @__PURE__ */ __name(class extends this {
      static plugins = currentPlugins.concat(
        newPlugins.filter((plugin) => !currentPlugins.includes(plugin))
      );
    }, "NewOctokit");
    return NewOctokit;
  }
  constructor(options = {}) {
    const hook2 = new before_after_hook_default.Collection();
    const requestDefaults = {
      baseUrl: request.endpoint.DEFAULTS.baseUrl,
      headers: {},
      request: Object.assign({}, options.request, {
        // @ts-ignore internal usage only, no need to type
        hook: hook2.bind(null, "request")
      }),
      mediaType: {
        previews: [],
        format: ""
      }
    };
    requestDefaults.headers["user-agent"] = options.userAgent ? `${options.userAgent} ${userAgentTrail}` : userAgentTrail;
    if (options.baseUrl) {
      requestDefaults.baseUrl = options.baseUrl;
    }
    if (options.previews) {
      requestDefaults.mediaType.previews = options.previews;
    }
    if (options.timeZone) {
      requestDefaults.headers["time-zone"] = options.timeZone;
    }
    this.request = request.defaults(requestDefaults);
    this.graphql = withCustomRequest(this.request).defaults(requestDefaults);
    this.log = createLogger(options.log);
    this.hook = hook2;
    if (!options.authStrategy) {
      if (!options.auth) {
        this.auth = async () => ({
          type: "unauthenticated"
        });
      } else {
        const auth2 = createTokenAuth(options.auth);
        hook2.wrap("request", auth2.hook);
        this.auth = auth2;
      }
    } else {
      const { authStrategy, ...otherOptions } = options;
      const auth2 = authStrategy(
        Object.assign(
          {
            request: this.request,
            log: this.log,
            // we pass the current octokit instance as well as its constructor options
            // to allow for authentication strategies that return a new octokit instance
            // that shares the same internal state as the current one. The original
            // requirement for this was the "event-octokit" authentication strategy
            // of https://github.com/probot/octokit-auth-probot.
            octokit: this,
            octokitOptions: otherOptions
          },
          options.auth
        )
      );
      hook2.wrap("request", auth2.hook);
      this.auth = auth2;
    }
    const classConstructor = this.constructor;
    for (let i = 0; i < classConstructor.plugins.length; ++i) {
      Object.assign(this, classConstructor.plugins[i](this, options));
    }
  }
  // assigned during constructor
  request;
  graphql;
  log;
  hook;
  // TODO: type `octokit.auth` based on passed options.authStrategy
  auth;
};
__name(Octokit, "Octokit");
__publicField(Octokit, "VERSION", VERSION4);
__publicField(Octokit, "plugins", []);

// node_modules/@octokit/plugin-request-log/dist-src/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/@octokit/plugin-request-log/dist-src/version.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var VERSION5 = "5.3.1";

// node_modules/@octokit/plugin-request-log/dist-src/index.js
function requestLog(octokit) {
  octokit.hook.wrap("request", (request2, options) => {
    octokit.log.debug("request", options);
    const start = Date.now();
    const requestOptions = octokit.request.endpoint.parse(options);
    const path = requestOptions.url.replace(options.baseUrl, "");
    return request2(options).then((response) => {
      const requestId = response.headers["x-github-request-id"];
      octokit.log.info(
        `${requestOptions.method} ${path} - ${response.status} with id ${requestId} in ${Date.now() - start}ms`
      );
      return response;
    }).catch((error) => {
      const requestId = error.response?.headers["x-github-request-id"] || "UNKNOWN";
      octokit.log.error(
        `${requestOptions.method} ${path} - ${error.status} with id ${requestId} in ${Date.now() - start}ms`
      );
      throw error;
    });
  });
}
__name(requestLog, "requestLog");
requestLog.VERSION = VERSION5;

// node_modules/@octokit/plugin-paginate-rest/dist-bundle/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var VERSION6 = "0.0.0-development";
function normalizePaginatedListResponse(response) {
  if (!response.data) {
    return {
      ...response,
      data: []
    };
  }
  const responseNeedsNormalization = "total_count" in response.data && !("url" in response.data);
  if (!responseNeedsNormalization)
    return response;
  const incompleteResults = response.data.incomplete_results;
  const repositorySelection = response.data.repository_selection;
  const totalCount = response.data.total_count;
  delete response.data.incomplete_results;
  delete response.data.repository_selection;
  delete response.data.total_count;
  const namespaceKey = Object.keys(response.data)[0];
  const data = response.data[namespaceKey];
  response.data = data;
  if (typeof incompleteResults !== "undefined") {
    response.data.incomplete_results = incompleteResults;
  }
  if (typeof repositorySelection !== "undefined") {
    response.data.repository_selection = repositorySelection;
  }
  response.data.total_count = totalCount;
  return response;
}
__name(normalizePaginatedListResponse, "normalizePaginatedListResponse");
function iterator(octokit, route, parameters) {
  const options = typeof route === "function" ? route.endpoint(parameters) : octokit.request.endpoint(route, parameters);
  const requestMethod = typeof route === "function" ? route : octokit.request;
  const method = options.method;
  const headers = options.headers;
  let url = options.url;
  return {
    [Symbol.asyncIterator]: () => ({
      async next() {
        if (!url)
          return { done: true };
        try {
          const response = await requestMethod({ method, url, headers });
          const normalizedResponse = normalizePaginatedListResponse(response);
          url = ((normalizedResponse.headers.link || "").match(
            /<([^<>]+)>;\s*rel="next"/
          ) || [])[1];
          return { value: normalizedResponse };
        } catch (error) {
          if (error.status !== 409)
            throw error;
          url = "";
          return {
            value: {
              status: 200,
              headers: {},
              data: []
            }
          };
        }
      }
    })
  };
}
__name(iterator, "iterator");
function paginate(octokit, route, parameters, mapFn) {
  if (typeof parameters === "function") {
    mapFn = parameters;
    parameters = void 0;
  }
  return gather(
    octokit,
    [],
    iterator(octokit, route, parameters)[Symbol.asyncIterator](),
    mapFn
  );
}
__name(paginate, "paginate");
function gather(octokit, results, iterator2, mapFn) {
  return iterator2.next().then((result) => {
    if (result.done) {
      return results;
    }
    let earlyExit = false;
    function done() {
      earlyExit = true;
    }
    __name(done, "done");
    results = results.concat(
      mapFn ? mapFn(result.value, done) : result.value.data
    );
    if (earlyExit) {
      return results;
    }
    return gather(octokit, results, iterator2, mapFn);
  });
}
__name(gather, "gather");
var composePaginateRest = Object.assign(paginate, {
  iterator
});
function paginateRest(octokit) {
  return {
    paginate: Object.assign(paginate.bind(null, octokit), {
      iterator: iterator.bind(null, octokit)
    })
  };
}
__name(paginateRest, "paginateRest");
paginateRest.VERSION = VERSION6;

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/version.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var VERSION7 = "13.5.0";

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/endpoints-to-methods.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/generated/endpoints.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var Endpoints = {
  actions: {
    addCustomLabelsToSelfHostedRunnerForOrg: [
      "POST /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    addCustomLabelsToSelfHostedRunnerForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    addRepoAccessToSelfHostedRunnerGroupInOrg: [
      "PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}"
    ],
    addSelectedRepoToOrgSecret: [
      "PUT /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}"
    ],
    addSelectedRepoToOrgVariable: [
      "PUT /orgs/{org}/actions/variables/{name}/repositories/{repository_id}"
    ],
    approveWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/approve"
    ],
    cancelWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel"
    ],
    createEnvironmentVariable: [
      "POST /repos/{owner}/{repo}/environments/{environment_name}/variables"
    ],
    createHostedRunnerForOrg: ["POST /orgs/{org}/actions/hosted-runners"],
    createOrUpdateEnvironmentSecret: [
      "PUT /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}"
    ],
    createOrUpdateOrgSecret: ["PUT /orgs/{org}/actions/secrets/{secret_name}"],
    createOrUpdateRepoSecret: [
      "PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}"
    ],
    createOrgVariable: ["POST /orgs/{org}/actions/variables"],
    createRegistrationTokenForOrg: [
      "POST /orgs/{org}/actions/runners/registration-token"
    ],
    createRegistrationTokenForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/registration-token"
    ],
    createRemoveTokenForOrg: ["POST /orgs/{org}/actions/runners/remove-token"],
    createRemoveTokenForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/remove-token"
    ],
    createRepoVariable: ["POST /repos/{owner}/{repo}/actions/variables"],
    createWorkflowDispatch: [
      "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches"
    ],
    deleteActionsCacheById: [
      "DELETE /repos/{owner}/{repo}/actions/caches/{cache_id}"
    ],
    deleteActionsCacheByKey: [
      "DELETE /repos/{owner}/{repo}/actions/caches{?key,ref}"
    ],
    deleteArtifact: [
      "DELETE /repos/{owner}/{repo}/actions/artifacts/{artifact_id}"
    ],
    deleteEnvironmentSecret: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}"
    ],
    deleteEnvironmentVariable: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}"
    ],
    deleteHostedRunnerForOrg: [
      "DELETE /orgs/{org}/actions/hosted-runners/{hosted_runner_id}"
    ],
    deleteOrgSecret: ["DELETE /orgs/{org}/actions/secrets/{secret_name}"],
    deleteOrgVariable: ["DELETE /orgs/{org}/actions/variables/{name}"],
    deleteRepoSecret: [
      "DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}"
    ],
    deleteRepoVariable: [
      "DELETE /repos/{owner}/{repo}/actions/variables/{name}"
    ],
    deleteSelfHostedRunnerFromOrg: [
      "DELETE /orgs/{org}/actions/runners/{runner_id}"
    ],
    deleteSelfHostedRunnerFromRepo: [
      "DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}"
    ],
    deleteWorkflowRun: ["DELETE /repos/{owner}/{repo}/actions/runs/{run_id}"],
    deleteWorkflowRunLogs: [
      "DELETE /repos/{owner}/{repo}/actions/runs/{run_id}/logs"
    ],
    disableSelectedRepositoryGithubActionsOrganization: [
      "DELETE /orgs/{org}/actions/permissions/repositories/{repository_id}"
    ],
    disableWorkflow: [
      "PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/disable"
    ],
    downloadArtifact: [
      "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}"
    ],
    downloadJobLogsForWorkflowRun: [
      "GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs"
    ],
    downloadWorkflowRunAttemptLogs: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/logs"
    ],
    downloadWorkflowRunLogs: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs"
    ],
    enableSelectedRepositoryGithubActionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/repositories/{repository_id}"
    ],
    enableWorkflow: [
      "PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/enable"
    ],
    forceCancelWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel"
    ],
    generateRunnerJitconfigForOrg: [
      "POST /orgs/{org}/actions/runners/generate-jitconfig"
    ],
    generateRunnerJitconfigForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/generate-jitconfig"
    ],
    getActionsCacheList: ["GET /repos/{owner}/{repo}/actions/caches"],
    getActionsCacheUsage: ["GET /repos/{owner}/{repo}/actions/cache/usage"],
    getActionsCacheUsageByRepoForOrg: [
      "GET /orgs/{org}/actions/cache/usage-by-repository"
    ],
    getActionsCacheUsageForOrg: ["GET /orgs/{org}/actions/cache/usage"],
    getAllowedActionsOrganization: [
      "GET /orgs/{org}/actions/permissions/selected-actions"
    ],
    getAllowedActionsRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions/selected-actions"
    ],
    getArtifact: ["GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}"],
    getCustomOidcSubClaimForRepo: [
      "GET /repos/{owner}/{repo}/actions/oidc/customization/sub"
    ],
    getEnvironmentPublicKey: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key"
    ],
    getEnvironmentSecret: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}"
    ],
    getEnvironmentVariable: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}"
    ],
    getGithubActionsDefaultWorkflowPermissionsOrganization: [
      "GET /orgs/{org}/actions/permissions/workflow"
    ],
    getGithubActionsDefaultWorkflowPermissionsRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions/workflow"
    ],
    getGithubActionsPermissionsOrganization: [
      "GET /orgs/{org}/actions/permissions"
    ],
    getGithubActionsPermissionsRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions"
    ],
    getHostedRunnerForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/{hosted_runner_id}"
    ],
    getHostedRunnersGithubOwnedImagesForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/images/github-owned"
    ],
    getHostedRunnersLimitsForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/limits"
    ],
    getHostedRunnersMachineSpecsForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/machine-sizes"
    ],
    getHostedRunnersPartnerImagesForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/images/partner"
    ],
    getHostedRunnersPlatformsForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/platforms"
    ],
    getJobForWorkflowRun: ["GET /repos/{owner}/{repo}/actions/jobs/{job_id}"],
    getOrgPublicKey: ["GET /orgs/{org}/actions/secrets/public-key"],
    getOrgSecret: ["GET /orgs/{org}/actions/secrets/{secret_name}"],
    getOrgVariable: ["GET /orgs/{org}/actions/variables/{name}"],
    getPendingDeploymentsForRun: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments"
    ],
    getRepoPermissions: [
      "GET /repos/{owner}/{repo}/actions/permissions",
      {},
      { renamed: ["actions", "getGithubActionsPermissionsRepository"] }
    ],
    getRepoPublicKey: ["GET /repos/{owner}/{repo}/actions/secrets/public-key"],
    getRepoSecret: ["GET /repos/{owner}/{repo}/actions/secrets/{secret_name}"],
    getRepoVariable: ["GET /repos/{owner}/{repo}/actions/variables/{name}"],
    getReviewsForRun: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/approvals"
    ],
    getSelfHostedRunnerForOrg: ["GET /orgs/{org}/actions/runners/{runner_id}"],
    getSelfHostedRunnerForRepo: [
      "GET /repos/{owner}/{repo}/actions/runners/{runner_id}"
    ],
    getWorkflow: ["GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}"],
    getWorkflowAccessToRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions/access"
    ],
    getWorkflowRun: ["GET /repos/{owner}/{repo}/actions/runs/{run_id}"],
    getWorkflowRunAttempt: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}"
    ],
    getWorkflowRunUsage: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/timing"
    ],
    getWorkflowUsage: [
      "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/timing"
    ],
    listArtifactsForRepo: ["GET /repos/{owner}/{repo}/actions/artifacts"],
    listEnvironmentSecrets: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets"
    ],
    listEnvironmentVariables: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/variables"
    ],
    listGithubHostedRunnersInGroupForOrg: [
      "GET /orgs/{org}/actions/runner-groups/{runner_group_id}/hosted-runners"
    ],
    listHostedRunnersForOrg: ["GET /orgs/{org}/actions/hosted-runners"],
    listJobsForWorkflowRun: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs"
    ],
    listJobsForWorkflowRunAttempt: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/jobs"
    ],
    listLabelsForSelfHostedRunnerForOrg: [
      "GET /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    listLabelsForSelfHostedRunnerForRepo: [
      "GET /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    listOrgSecrets: ["GET /orgs/{org}/actions/secrets"],
    listOrgVariables: ["GET /orgs/{org}/actions/variables"],
    listRepoOrganizationSecrets: [
      "GET /repos/{owner}/{repo}/actions/organization-secrets"
    ],
    listRepoOrganizationVariables: [
      "GET /repos/{owner}/{repo}/actions/organization-variables"
    ],
    listRepoSecrets: ["GET /repos/{owner}/{repo}/actions/secrets"],
    listRepoVariables: ["GET /repos/{owner}/{repo}/actions/variables"],
    listRepoWorkflows: ["GET /repos/{owner}/{repo}/actions/workflows"],
    listRunnerApplicationsForOrg: ["GET /orgs/{org}/actions/runners/downloads"],
    listRunnerApplicationsForRepo: [
      "GET /repos/{owner}/{repo}/actions/runners/downloads"
    ],
    listSelectedReposForOrgSecret: [
      "GET /orgs/{org}/actions/secrets/{secret_name}/repositories"
    ],
    listSelectedReposForOrgVariable: [
      "GET /orgs/{org}/actions/variables/{name}/repositories"
    ],
    listSelectedRepositoriesEnabledGithubActionsOrganization: [
      "GET /orgs/{org}/actions/permissions/repositories"
    ],
    listSelfHostedRunnersForOrg: ["GET /orgs/{org}/actions/runners"],
    listSelfHostedRunnersForRepo: ["GET /repos/{owner}/{repo}/actions/runners"],
    listWorkflowRunArtifacts: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts"
    ],
    listWorkflowRuns: [
      "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs"
    ],
    listWorkflowRunsForRepo: ["GET /repos/{owner}/{repo}/actions/runs"],
    reRunJobForWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun"
    ],
    reRunWorkflow: ["POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun"],
    reRunWorkflowFailedJobs: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs"
    ],
    removeAllCustomLabelsFromSelfHostedRunnerForOrg: [
      "DELETE /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    removeAllCustomLabelsFromSelfHostedRunnerForRepo: [
      "DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    removeCustomLabelFromSelfHostedRunnerForOrg: [
      "DELETE /orgs/{org}/actions/runners/{runner_id}/labels/{name}"
    ],
    removeCustomLabelFromSelfHostedRunnerForRepo: [
      "DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels/{name}"
    ],
    removeSelectedRepoFromOrgSecret: [
      "DELETE /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}"
    ],
    removeSelectedRepoFromOrgVariable: [
      "DELETE /orgs/{org}/actions/variables/{name}/repositories/{repository_id}"
    ],
    reviewCustomGatesForRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule"
    ],
    reviewPendingDeploymentsForRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments"
    ],
    setAllowedActionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/selected-actions"
    ],
    setAllowedActionsRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions/selected-actions"
    ],
    setCustomLabelsForSelfHostedRunnerForOrg: [
      "PUT /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    setCustomLabelsForSelfHostedRunnerForRepo: [
      "PUT /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    setCustomOidcSubClaimForRepo: [
      "PUT /repos/{owner}/{repo}/actions/oidc/customization/sub"
    ],
    setGithubActionsDefaultWorkflowPermissionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/workflow"
    ],
    setGithubActionsDefaultWorkflowPermissionsRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions/workflow"
    ],
    setGithubActionsPermissionsOrganization: [
      "PUT /orgs/{org}/actions/permissions"
    ],
    setGithubActionsPermissionsRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions"
    ],
    setSelectedReposForOrgSecret: [
      "PUT /orgs/{org}/actions/secrets/{secret_name}/repositories"
    ],
    setSelectedReposForOrgVariable: [
      "PUT /orgs/{org}/actions/variables/{name}/repositories"
    ],
    setSelectedRepositoriesEnabledGithubActionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/repositories"
    ],
    setWorkflowAccessToRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions/access"
    ],
    updateEnvironmentVariable: [
      "PATCH /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}"
    ],
    updateHostedRunnerForOrg: [
      "PATCH /orgs/{org}/actions/hosted-runners/{hosted_runner_id}"
    ],
    updateOrgVariable: ["PATCH /orgs/{org}/actions/variables/{name}"],
    updateRepoVariable: [
      "PATCH /repos/{owner}/{repo}/actions/variables/{name}"
    ]
  },
  activity: {
    checkRepoIsStarredByAuthenticatedUser: ["GET /user/starred/{owner}/{repo}"],
    deleteRepoSubscription: ["DELETE /repos/{owner}/{repo}/subscription"],
    deleteThreadSubscription: [
      "DELETE /notifications/threads/{thread_id}/subscription"
    ],
    getFeeds: ["GET /feeds"],
    getRepoSubscription: ["GET /repos/{owner}/{repo}/subscription"],
    getThread: ["GET /notifications/threads/{thread_id}"],
    getThreadSubscriptionForAuthenticatedUser: [
      "GET /notifications/threads/{thread_id}/subscription"
    ],
    listEventsForAuthenticatedUser: ["GET /users/{username}/events"],
    listNotificationsForAuthenticatedUser: ["GET /notifications"],
    listOrgEventsForAuthenticatedUser: [
      "GET /users/{username}/events/orgs/{org}"
    ],
    listPublicEvents: ["GET /events"],
    listPublicEventsForRepoNetwork: ["GET /networks/{owner}/{repo}/events"],
    listPublicEventsForUser: ["GET /users/{username}/events/public"],
    listPublicOrgEvents: ["GET /orgs/{org}/events"],
    listReceivedEventsForUser: ["GET /users/{username}/received_events"],
    listReceivedPublicEventsForUser: [
      "GET /users/{username}/received_events/public"
    ],
    listRepoEvents: ["GET /repos/{owner}/{repo}/events"],
    listRepoNotificationsForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/notifications"
    ],
    listReposStarredByAuthenticatedUser: ["GET /user/starred"],
    listReposStarredByUser: ["GET /users/{username}/starred"],
    listReposWatchedByUser: ["GET /users/{username}/subscriptions"],
    listStargazersForRepo: ["GET /repos/{owner}/{repo}/stargazers"],
    listWatchedReposForAuthenticatedUser: ["GET /user/subscriptions"],
    listWatchersForRepo: ["GET /repos/{owner}/{repo}/subscribers"],
    markNotificationsAsRead: ["PUT /notifications"],
    markRepoNotificationsAsRead: ["PUT /repos/{owner}/{repo}/notifications"],
    markThreadAsDone: ["DELETE /notifications/threads/{thread_id}"],
    markThreadAsRead: ["PATCH /notifications/threads/{thread_id}"],
    setRepoSubscription: ["PUT /repos/{owner}/{repo}/subscription"],
    setThreadSubscription: [
      "PUT /notifications/threads/{thread_id}/subscription"
    ],
    starRepoForAuthenticatedUser: ["PUT /user/starred/{owner}/{repo}"],
    unstarRepoForAuthenticatedUser: ["DELETE /user/starred/{owner}/{repo}"]
  },
  apps: {
    addRepoToInstallation: [
      "PUT /user/installations/{installation_id}/repositories/{repository_id}",
      {},
      { renamed: ["apps", "addRepoToInstallationForAuthenticatedUser"] }
    ],
    addRepoToInstallationForAuthenticatedUser: [
      "PUT /user/installations/{installation_id}/repositories/{repository_id}"
    ],
    checkToken: ["POST /applications/{client_id}/token"],
    createFromManifest: ["POST /app-manifests/{code}/conversions"],
    createInstallationAccessToken: [
      "POST /app/installations/{installation_id}/access_tokens"
    ],
    deleteAuthorization: ["DELETE /applications/{client_id}/grant"],
    deleteInstallation: ["DELETE /app/installations/{installation_id}"],
    deleteToken: ["DELETE /applications/{client_id}/token"],
    getAuthenticated: ["GET /app"],
    getBySlug: ["GET /apps/{app_slug}"],
    getInstallation: ["GET /app/installations/{installation_id}"],
    getOrgInstallation: ["GET /orgs/{org}/installation"],
    getRepoInstallation: ["GET /repos/{owner}/{repo}/installation"],
    getSubscriptionPlanForAccount: [
      "GET /marketplace_listing/accounts/{account_id}"
    ],
    getSubscriptionPlanForAccountStubbed: [
      "GET /marketplace_listing/stubbed/accounts/{account_id}"
    ],
    getUserInstallation: ["GET /users/{username}/installation"],
    getWebhookConfigForApp: ["GET /app/hook/config"],
    getWebhookDelivery: ["GET /app/hook/deliveries/{delivery_id}"],
    listAccountsForPlan: ["GET /marketplace_listing/plans/{plan_id}/accounts"],
    listAccountsForPlanStubbed: [
      "GET /marketplace_listing/stubbed/plans/{plan_id}/accounts"
    ],
    listInstallationReposForAuthenticatedUser: [
      "GET /user/installations/{installation_id}/repositories"
    ],
    listInstallationRequestsForAuthenticatedApp: [
      "GET /app/installation-requests"
    ],
    listInstallations: ["GET /app/installations"],
    listInstallationsForAuthenticatedUser: ["GET /user/installations"],
    listPlans: ["GET /marketplace_listing/plans"],
    listPlansStubbed: ["GET /marketplace_listing/stubbed/plans"],
    listReposAccessibleToInstallation: ["GET /installation/repositories"],
    listSubscriptionsForAuthenticatedUser: ["GET /user/marketplace_purchases"],
    listSubscriptionsForAuthenticatedUserStubbed: [
      "GET /user/marketplace_purchases/stubbed"
    ],
    listWebhookDeliveries: ["GET /app/hook/deliveries"],
    redeliverWebhookDelivery: [
      "POST /app/hook/deliveries/{delivery_id}/attempts"
    ],
    removeRepoFromInstallation: [
      "DELETE /user/installations/{installation_id}/repositories/{repository_id}",
      {},
      { renamed: ["apps", "removeRepoFromInstallationForAuthenticatedUser"] }
    ],
    removeRepoFromInstallationForAuthenticatedUser: [
      "DELETE /user/installations/{installation_id}/repositories/{repository_id}"
    ],
    resetToken: ["PATCH /applications/{client_id}/token"],
    revokeInstallationAccessToken: ["DELETE /installation/token"],
    scopeToken: ["POST /applications/{client_id}/token/scoped"],
    suspendInstallation: ["PUT /app/installations/{installation_id}/suspended"],
    unsuspendInstallation: [
      "DELETE /app/installations/{installation_id}/suspended"
    ],
    updateWebhookConfigForApp: ["PATCH /app/hook/config"]
  },
  billing: {
    getGithubActionsBillingOrg: ["GET /orgs/{org}/settings/billing/actions"],
    getGithubActionsBillingUser: [
      "GET /users/{username}/settings/billing/actions"
    ],
    getGithubBillingUsageReportOrg: [
      "GET /organizations/{org}/settings/billing/usage"
    ],
    getGithubPackagesBillingOrg: ["GET /orgs/{org}/settings/billing/packages"],
    getGithubPackagesBillingUser: [
      "GET /users/{username}/settings/billing/packages"
    ],
    getSharedStorageBillingOrg: [
      "GET /orgs/{org}/settings/billing/shared-storage"
    ],
    getSharedStorageBillingUser: [
      "GET /users/{username}/settings/billing/shared-storage"
    ]
  },
  checks: {
    create: ["POST /repos/{owner}/{repo}/check-runs"],
    createSuite: ["POST /repos/{owner}/{repo}/check-suites"],
    get: ["GET /repos/{owner}/{repo}/check-runs/{check_run_id}"],
    getSuite: ["GET /repos/{owner}/{repo}/check-suites/{check_suite_id}"],
    listAnnotations: [
      "GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations"
    ],
    listForRef: ["GET /repos/{owner}/{repo}/commits/{ref}/check-runs"],
    listForSuite: [
      "GET /repos/{owner}/{repo}/check-suites/{check_suite_id}/check-runs"
    ],
    listSuitesForRef: ["GET /repos/{owner}/{repo}/commits/{ref}/check-suites"],
    rerequestRun: [
      "POST /repos/{owner}/{repo}/check-runs/{check_run_id}/rerequest"
    ],
    rerequestSuite: [
      "POST /repos/{owner}/{repo}/check-suites/{check_suite_id}/rerequest"
    ],
    setSuitesPreferences: [
      "PATCH /repos/{owner}/{repo}/check-suites/preferences"
    ],
    update: ["PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}"]
  },
  codeScanning: {
    commitAutofix: [
      "POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix/commits"
    ],
    createAutofix: [
      "POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix"
    ],
    createVariantAnalysis: [
      "POST /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses"
    ],
    deleteAnalysis: [
      "DELETE /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}{?confirm_delete}"
    ],
    deleteCodeqlDatabase: [
      "DELETE /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}"
    ],
    getAlert: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}",
      {},
      { renamedParameters: { alert_id: "alert_number" } }
    ],
    getAnalysis: [
      "GET /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}"
    ],
    getAutofix: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix"
    ],
    getCodeqlDatabase: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}"
    ],
    getDefaultSetup: ["GET /repos/{owner}/{repo}/code-scanning/default-setup"],
    getSarif: ["GET /repos/{owner}/{repo}/code-scanning/sarifs/{sarif_id}"],
    getVariantAnalysis: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}"
    ],
    getVariantAnalysisRepoTask: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}/repos/{repo_owner}/{repo_name}"
    ],
    listAlertInstances: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances"
    ],
    listAlertsForOrg: ["GET /orgs/{org}/code-scanning/alerts"],
    listAlertsForRepo: ["GET /repos/{owner}/{repo}/code-scanning/alerts"],
    listAlertsInstances: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances",
      {},
      { renamed: ["codeScanning", "listAlertInstances"] }
    ],
    listCodeqlDatabases: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/databases"
    ],
    listRecentAnalyses: ["GET /repos/{owner}/{repo}/code-scanning/analyses"],
    updateAlert: [
      "PATCH /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}"
    ],
    updateDefaultSetup: [
      "PATCH /repos/{owner}/{repo}/code-scanning/default-setup"
    ],
    uploadSarif: ["POST /repos/{owner}/{repo}/code-scanning/sarifs"]
  },
  codeSecurity: {
    attachConfiguration: [
      "POST /orgs/{org}/code-security/configurations/{configuration_id}/attach"
    ],
    attachEnterpriseConfiguration: [
      "POST /enterprises/{enterprise}/code-security/configurations/{configuration_id}/attach"
    ],
    createConfiguration: ["POST /orgs/{org}/code-security/configurations"],
    createConfigurationForEnterprise: [
      "POST /enterprises/{enterprise}/code-security/configurations"
    ],
    deleteConfiguration: [
      "DELETE /orgs/{org}/code-security/configurations/{configuration_id}"
    ],
    deleteConfigurationForEnterprise: [
      "DELETE /enterprises/{enterprise}/code-security/configurations/{configuration_id}"
    ],
    detachConfiguration: [
      "DELETE /orgs/{org}/code-security/configurations/detach"
    ],
    getConfiguration: [
      "GET /orgs/{org}/code-security/configurations/{configuration_id}"
    ],
    getConfigurationForRepository: [
      "GET /repos/{owner}/{repo}/code-security-configuration"
    ],
    getConfigurationsForEnterprise: [
      "GET /enterprises/{enterprise}/code-security/configurations"
    ],
    getConfigurationsForOrg: ["GET /orgs/{org}/code-security/configurations"],
    getDefaultConfigurations: [
      "GET /orgs/{org}/code-security/configurations/defaults"
    ],
    getDefaultConfigurationsForEnterprise: [
      "GET /enterprises/{enterprise}/code-security/configurations/defaults"
    ],
    getRepositoriesForConfiguration: [
      "GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories"
    ],
    getRepositoriesForEnterpriseConfiguration: [
      "GET /enterprises/{enterprise}/code-security/configurations/{configuration_id}/repositories"
    ],
    getSingleConfigurationForEnterprise: [
      "GET /enterprises/{enterprise}/code-security/configurations/{configuration_id}"
    ],
    setConfigurationAsDefault: [
      "PUT /orgs/{org}/code-security/configurations/{configuration_id}/defaults"
    ],
    setConfigurationAsDefaultForEnterprise: [
      "PUT /enterprises/{enterprise}/code-security/configurations/{configuration_id}/defaults"
    ],
    updateConfiguration: [
      "PATCH /orgs/{org}/code-security/configurations/{configuration_id}"
    ],
    updateEnterpriseConfiguration: [
      "PATCH /enterprises/{enterprise}/code-security/configurations/{configuration_id}"
    ]
  },
  codesOfConduct: {
    getAllCodesOfConduct: ["GET /codes_of_conduct"],
    getConductCode: ["GET /codes_of_conduct/{key}"]
  },
  codespaces: {
    addRepositoryForSecretForAuthenticatedUser: [
      "PUT /user/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    addSelectedRepoToOrgSecret: [
      "PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    checkPermissionsForDevcontainer: [
      "GET /repos/{owner}/{repo}/codespaces/permissions_check"
    ],
    codespaceMachinesForAuthenticatedUser: [
      "GET /user/codespaces/{codespace_name}/machines"
    ],
    createForAuthenticatedUser: ["POST /user/codespaces"],
    createOrUpdateOrgSecret: [
      "PUT /orgs/{org}/codespaces/secrets/{secret_name}"
    ],
    createOrUpdateRepoSecret: [
      "PUT /repos/{owner}/{repo}/codespaces/secrets/{secret_name}"
    ],
    createOrUpdateSecretForAuthenticatedUser: [
      "PUT /user/codespaces/secrets/{secret_name}"
    ],
    createWithPrForAuthenticatedUser: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/codespaces"
    ],
    createWithRepoForAuthenticatedUser: [
      "POST /repos/{owner}/{repo}/codespaces"
    ],
    deleteForAuthenticatedUser: ["DELETE /user/codespaces/{codespace_name}"],
    deleteFromOrganization: [
      "DELETE /orgs/{org}/members/{username}/codespaces/{codespace_name}"
    ],
    deleteOrgSecret: ["DELETE /orgs/{org}/codespaces/secrets/{secret_name}"],
    deleteRepoSecret: [
      "DELETE /repos/{owner}/{repo}/codespaces/secrets/{secret_name}"
    ],
    deleteSecretForAuthenticatedUser: [
      "DELETE /user/codespaces/secrets/{secret_name}"
    ],
    exportForAuthenticatedUser: [
      "POST /user/codespaces/{codespace_name}/exports"
    ],
    getCodespacesForUserInOrg: [
      "GET /orgs/{org}/members/{username}/codespaces"
    ],
    getExportDetailsForAuthenticatedUser: [
      "GET /user/codespaces/{codespace_name}/exports/{export_id}"
    ],
    getForAuthenticatedUser: ["GET /user/codespaces/{codespace_name}"],
    getOrgPublicKey: ["GET /orgs/{org}/codespaces/secrets/public-key"],
    getOrgSecret: ["GET /orgs/{org}/codespaces/secrets/{secret_name}"],
    getPublicKeyForAuthenticatedUser: [
      "GET /user/codespaces/secrets/public-key"
    ],
    getRepoPublicKey: [
      "GET /repos/{owner}/{repo}/codespaces/secrets/public-key"
    ],
    getRepoSecret: [
      "GET /repos/{owner}/{repo}/codespaces/secrets/{secret_name}"
    ],
    getSecretForAuthenticatedUser: [
      "GET /user/codespaces/secrets/{secret_name}"
    ],
    listDevcontainersInRepositoryForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces/devcontainers"
    ],
    listForAuthenticatedUser: ["GET /user/codespaces"],
    listInOrganization: [
      "GET /orgs/{org}/codespaces",
      {},
      { renamedParameters: { org_id: "org" } }
    ],
    listInRepositoryForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces"
    ],
    listOrgSecrets: ["GET /orgs/{org}/codespaces/secrets"],
    listRepoSecrets: ["GET /repos/{owner}/{repo}/codespaces/secrets"],
    listRepositoriesForSecretForAuthenticatedUser: [
      "GET /user/codespaces/secrets/{secret_name}/repositories"
    ],
    listSecretsForAuthenticatedUser: ["GET /user/codespaces/secrets"],
    listSelectedReposForOrgSecret: [
      "GET /orgs/{org}/codespaces/secrets/{secret_name}/repositories"
    ],
    preFlightWithRepoForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces/new"
    ],
    publishForAuthenticatedUser: [
      "POST /user/codespaces/{codespace_name}/publish"
    ],
    removeRepositoryForSecretForAuthenticatedUser: [
      "DELETE /user/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    removeSelectedRepoFromOrgSecret: [
      "DELETE /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    repoMachinesForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces/machines"
    ],
    setRepositoriesForSecretForAuthenticatedUser: [
      "PUT /user/codespaces/secrets/{secret_name}/repositories"
    ],
    setSelectedReposForOrgSecret: [
      "PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories"
    ],
    startForAuthenticatedUser: ["POST /user/codespaces/{codespace_name}/start"],
    stopForAuthenticatedUser: ["POST /user/codespaces/{codespace_name}/stop"],
    stopInOrganization: [
      "POST /orgs/{org}/members/{username}/codespaces/{codespace_name}/stop"
    ],
    updateForAuthenticatedUser: ["PATCH /user/codespaces/{codespace_name}"]
  },
  copilot: {
    addCopilotSeatsForTeams: [
      "POST /orgs/{org}/copilot/billing/selected_teams"
    ],
    addCopilotSeatsForUsers: [
      "POST /orgs/{org}/copilot/billing/selected_users"
    ],
    cancelCopilotSeatAssignmentForTeams: [
      "DELETE /orgs/{org}/copilot/billing/selected_teams"
    ],
    cancelCopilotSeatAssignmentForUsers: [
      "DELETE /orgs/{org}/copilot/billing/selected_users"
    ],
    copilotMetricsForOrganization: ["GET /orgs/{org}/copilot/metrics"],
    copilotMetricsForTeam: ["GET /orgs/{org}/team/{team_slug}/copilot/metrics"],
    getCopilotOrganizationDetails: ["GET /orgs/{org}/copilot/billing"],
    getCopilotSeatDetailsForUser: [
      "GET /orgs/{org}/members/{username}/copilot"
    ],
    listCopilotSeats: ["GET /orgs/{org}/copilot/billing/seats"],
    usageMetricsForOrg: ["GET /orgs/{org}/copilot/usage"],
    usageMetricsForTeam: ["GET /orgs/{org}/team/{team_slug}/copilot/usage"]
  },
  dependabot: {
    addSelectedRepoToOrgSecret: [
      "PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}"
    ],
    createOrUpdateOrgSecret: [
      "PUT /orgs/{org}/dependabot/secrets/{secret_name}"
    ],
    createOrUpdateRepoSecret: [
      "PUT /repos/{owner}/{repo}/dependabot/secrets/{secret_name}"
    ],
    deleteOrgSecret: ["DELETE /orgs/{org}/dependabot/secrets/{secret_name}"],
    deleteRepoSecret: [
      "DELETE /repos/{owner}/{repo}/dependabot/secrets/{secret_name}"
    ],
    getAlert: ["GET /repos/{owner}/{repo}/dependabot/alerts/{alert_number}"],
    getOrgPublicKey: ["GET /orgs/{org}/dependabot/secrets/public-key"],
    getOrgSecret: ["GET /orgs/{org}/dependabot/secrets/{secret_name}"],
    getRepoPublicKey: [
      "GET /repos/{owner}/{repo}/dependabot/secrets/public-key"
    ],
    getRepoSecret: [
      "GET /repos/{owner}/{repo}/dependabot/secrets/{secret_name}"
    ],
    listAlertsForEnterprise: [
      "GET /enterprises/{enterprise}/dependabot/alerts"
    ],
    listAlertsForOrg: ["GET /orgs/{org}/dependabot/alerts"],
    listAlertsForRepo: ["GET /repos/{owner}/{repo}/dependabot/alerts"],
    listOrgSecrets: ["GET /orgs/{org}/dependabot/secrets"],
    listRepoSecrets: ["GET /repos/{owner}/{repo}/dependabot/secrets"],
    listSelectedReposForOrgSecret: [
      "GET /orgs/{org}/dependabot/secrets/{secret_name}/repositories"
    ],
    removeSelectedRepoFromOrgSecret: [
      "DELETE /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}"
    ],
    setSelectedReposForOrgSecret: [
      "PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories"
    ],
    updateAlert: [
      "PATCH /repos/{owner}/{repo}/dependabot/alerts/{alert_number}"
    ]
  },
  dependencyGraph: {
    createRepositorySnapshot: [
      "POST /repos/{owner}/{repo}/dependency-graph/snapshots"
    ],
    diffRange: [
      "GET /repos/{owner}/{repo}/dependency-graph/compare/{basehead}"
    ],
    exportSbom: ["GET /repos/{owner}/{repo}/dependency-graph/sbom"]
  },
  emojis: { get: ["GET /emojis"] },
  gists: {
    checkIsStarred: ["GET /gists/{gist_id}/star"],
    create: ["POST /gists"],
    createComment: ["POST /gists/{gist_id}/comments"],
    delete: ["DELETE /gists/{gist_id}"],
    deleteComment: ["DELETE /gists/{gist_id}/comments/{comment_id}"],
    fork: ["POST /gists/{gist_id}/forks"],
    get: ["GET /gists/{gist_id}"],
    getComment: ["GET /gists/{gist_id}/comments/{comment_id}"],
    getRevision: ["GET /gists/{gist_id}/{sha}"],
    list: ["GET /gists"],
    listComments: ["GET /gists/{gist_id}/comments"],
    listCommits: ["GET /gists/{gist_id}/commits"],
    listForUser: ["GET /users/{username}/gists"],
    listForks: ["GET /gists/{gist_id}/forks"],
    listPublic: ["GET /gists/public"],
    listStarred: ["GET /gists/starred"],
    star: ["PUT /gists/{gist_id}/star"],
    unstar: ["DELETE /gists/{gist_id}/star"],
    update: ["PATCH /gists/{gist_id}"],
    updateComment: ["PATCH /gists/{gist_id}/comments/{comment_id}"]
  },
  git: {
    createBlob: ["POST /repos/{owner}/{repo}/git/blobs"],
    createCommit: ["POST /repos/{owner}/{repo}/git/commits"],
    createRef: ["POST /repos/{owner}/{repo}/git/refs"],
    createTag: ["POST /repos/{owner}/{repo}/git/tags"],
    createTree: ["POST /repos/{owner}/{repo}/git/trees"],
    deleteRef: ["DELETE /repos/{owner}/{repo}/git/refs/{ref}"],
    getBlob: ["GET /repos/{owner}/{repo}/git/blobs/{file_sha}"],
    getCommit: ["GET /repos/{owner}/{repo}/git/commits/{commit_sha}"],
    getRef: ["GET /repos/{owner}/{repo}/git/ref/{ref}"],
    getTag: ["GET /repos/{owner}/{repo}/git/tags/{tag_sha}"],
    getTree: ["GET /repos/{owner}/{repo}/git/trees/{tree_sha}"],
    listMatchingRefs: ["GET /repos/{owner}/{repo}/git/matching-refs/{ref}"],
    updateRef: ["PATCH /repos/{owner}/{repo}/git/refs/{ref}"]
  },
  gitignore: {
    getAllTemplates: ["GET /gitignore/templates"],
    getTemplate: ["GET /gitignore/templates/{name}"]
  },
  hostedCompute: {
    createNetworkConfigurationForOrg: [
      "POST /orgs/{org}/settings/network-configurations"
    ],
    deleteNetworkConfigurationFromOrg: [
      "DELETE /orgs/{org}/settings/network-configurations/{network_configuration_id}"
    ],
    getNetworkConfigurationForOrg: [
      "GET /orgs/{org}/settings/network-configurations/{network_configuration_id}"
    ],
    getNetworkSettingsForOrg: [
      "GET /orgs/{org}/settings/network-settings/{network_settings_id}"
    ],
    listNetworkConfigurationsForOrg: [
      "GET /orgs/{org}/settings/network-configurations"
    ],
    updateNetworkConfigurationForOrg: [
      "PATCH /orgs/{org}/settings/network-configurations/{network_configuration_id}"
    ]
  },
  interactions: {
    getRestrictionsForAuthenticatedUser: ["GET /user/interaction-limits"],
    getRestrictionsForOrg: ["GET /orgs/{org}/interaction-limits"],
    getRestrictionsForRepo: ["GET /repos/{owner}/{repo}/interaction-limits"],
    getRestrictionsForYourPublicRepos: [
      "GET /user/interaction-limits",
      {},
      { renamed: ["interactions", "getRestrictionsForAuthenticatedUser"] }
    ],
    removeRestrictionsForAuthenticatedUser: ["DELETE /user/interaction-limits"],
    removeRestrictionsForOrg: ["DELETE /orgs/{org}/interaction-limits"],
    removeRestrictionsForRepo: [
      "DELETE /repos/{owner}/{repo}/interaction-limits"
    ],
    removeRestrictionsForYourPublicRepos: [
      "DELETE /user/interaction-limits",
      {},
      { renamed: ["interactions", "removeRestrictionsForAuthenticatedUser"] }
    ],
    setRestrictionsForAuthenticatedUser: ["PUT /user/interaction-limits"],
    setRestrictionsForOrg: ["PUT /orgs/{org}/interaction-limits"],
    setRestrictionsForRepo: ["PUT /repos/{owner}/{repo}/interaction-limits"],
    setRestrictionsForYourPublicRepos: [
      "PUT /user/interaction-limits",
      {},
      { renamed: ["interactions", "setRestrictionsForAuthenticatedUser"] }
    ]
  },
  issues: {
    addAssignees: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/assignees"
    ],
    addLabels: ["POST /repos/{owner}/{repo}/issues/{issue_number}/labels"],
    addSubIssue: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues"
    ],
    checkUserCanBeAssigned: ["GET /repos/{owner}/{repo}/assignees/{assignee}"],
    checkUserCanBeAssignedToIssue: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/assignees/{assignee}"
    ],
    create: ["POST /repos/{owner}/{repo}/issues"],
    createComment: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments"
    ],
    createLabel: ["POST /repos/{owner}/{repo}/labels"],
    createMilestone: ["POST /repos/{owner}/{repo}/milestones"],
    deleteComment: [
      "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}"
    ],
    deleteLabel: ["DELETE /repos/{owner}/{repo}/labels/{name}"],
    deleteMilestone: [
      "DELETE /repos/{owner}/{repo}/milestones/{milestone_number}"
    ],
    get: ["GET /repos/{owner}/{repo}/issues/{issue_number}"],
    getComment: ["GET /repos/{owner}/{repo}/issues/comments/{comment_id}"],
    getEvent: ["GET /repos/{owner}/{repo}/issues/events/{event_id}"],
    getLabel: ["GET /repos/{owner}/{repo}/labels/{name}"],
    getMilestone: ["GET /repos/{owner}/{repo}/milestones/{milestone_number}"],
    list: ["GET /issues"],
    listAssignees: ["GET /repos/{owner}/{repo}/assignees"],
    listComments: ["GET /repos/{owner}/{repo}/issues/{issue_number}/comments"],
    listCommentsForRepo: ["GET /repos/{owner}/{repo}/issues/comments"],
    listEvents: ["GET /repos/{owner}/{repo}/issues/{issue_number}/events"],
    listEventsForRepo: ["GET /repos/{owner}/{repo}/issues/events"],
    listEventsForTimeline: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline"
    ],
    listForAuthenticatedUser: ["GET /user/issues"],
    listForOrg: ["GET /orgs/{org}/issues"],
    listForRepo: ["GET /repos/{owner}/{repo}/issues"],
    listLabelsForMilestone: [
      "GET /repos/{owner}/{repo}/milestones/{milestone_number}/labels"
    ],
    listLabelsForRepo: ["GET /repos/{owner}/{repo}/labels"],
    listLabelsOnIssue: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/labels"
    ],
    listMilestones: ["GET /repos/{owner}/{repo}/milestones"],
    listSubIssues: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues"
    ],
    lock: ["PUT /repos/{owner}/{repo}/issues/{issue_number}/lock"],
    removeAllLabels: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels"
    ],
    removeAssignees: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees"
    ],
    removeLabel: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}"
    ],
    removeSubIssue: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/sub_issue"
    ],
    reprioritizeSubIssue: [
      "PATCH /repos/{owner}/{repo}/issues/{issue_number}/sub_issues/priority"
    ],
    setLabels: ["PUT /repos/{owner}/{repo}/issues/{issue_number}/labels"],
    unlock: ["DELETE /repos/{owner}/{repo}/issues/{issue_number}/lock"],
    update: ["PATCH /repos/{owner}/{repo}/issues/{issue_number}"],
    updateComment: ["PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}"],
    updateLabel: ["PATCH /repos/{owner}/{repo}/labels/{name}"],
    updateMilestone: [
      "PATCH /repos/{owner}/{repo}/milestones/{milestone_number}"
    ]
  },
  licenses: {
    get: ["GET /licenses/{license}"],
    getAllCommonlyUsed: ["GET /licenses"],
    getForRepo: ["GET /repos/{owner}/{repo}/license"]
  },
  markdown: {
    render: ["POST /markdown"],
    renderRaw: [
      "POST /markdown/raw",
      { headers: { "content-type": "text/plain; charset=utf-8" } }
    ]
  },
  meta: {
    get: ["GET /meta"],
    getAllVersions: ["GET /versions"],
    getOctocat: ["GET /octocat"],
    getZen: ["GET /zen"],
    root: ["GET /"]
  },
  migrations: {
    deleteArchiveForAuthenticatedUser: [
      "DELETE /user/migrations/{migration_id}/archive"
    ],
    deleteArchiveForOrg: [
      "DELETE /orgs/{org}/migrations/{migration_id}/archive"
    ],
    downloadArchiveForOrg: [
      "GET /orgs/{org}/migrations/{migration_id}/archive"
    ],
    getArchiveForAuthenticatedUser: [
      "GET /user/migrations/{migration_id}/archive"
    ],
    getStatusForAuthenticatedUser: ["GET /user/migrations/{migration_id}"],
    getStatusForOrg: ["GET /orgs/{org}/migrations/{migration_id}"],
    listForAuthenticatedUser: ["GET /user/migrations"],
    listForOrg: ["GET /orgs/{org}/migrations"],
    listReposForAuthenticatedUser: [
      "GET /user/migrations/{migration_id}/repositories"
    ],
    listReposForOrg: ["GET /orgs/{org}/migrations/{migration_id}/repositories"],
    listReposForUser: [
      "GET /user/migrations/{migration_id}/repositories",
      {},
      { renamed: ["migrations", "listReposForAuthenticatedUser"] }
    ],
    startForAuthenticatedUser: ["POST /user/migrations"],
    startForOrg: ["POST /orgs/{org}/migrations"],
    unlockRepoForAuthenticatedUser: [
      "DELETE /user/migrations/{migration_id}/repos/{repo_name}/lock"
    ],
    unlockRepoForOrg: [
      "DELETE /orgs/{org}/migrations/{migration_id}/repos/{repo_name}/lock"
    ]
  },
  oidc: {
    getOidcCustomSubTemplateForOrg: [
      "GET /orgs/{org}/actions/oidc/customization/sub"
    ],
    updateOidcCustomSubTemplateForOrg: [
      "PUT /orgs/{org}/actions/oidc/customization/sub"
    ]
  },
  orgs: {
    addSecurityManagerTeam: [
      "PUT /orgs/{org}/security-managers/teams/{team_slug}",
      {},
      {
        deprecated: "octokit.rest.orgs.addSecurityManagerTeam() is deprecated, see https://docs.github.com/rest/orgs/security-managers#add-a-security-manager-team"
      }
    ],
    assignTeamToOrgRole: [
      "PUT /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}"
    ],
    assignUserToOrgRole: [
      "PUT /orgs/{org}/organization-roles/users/{username}/{role_id}"
    ],
    blockUser: ["PUT /orgs/{org}/blocks/{username}"],
    cancelInvitation: ["DELETE /orgs/{org}/invitations/{invitation_id}"],
    checkBlockedUser: ["GET /orgs/{org}/blocks/{username}"],
    checkMembershipForUser: ["GET /orgs/{org}/members/{username}"],
    checkPublicMembershipForUser: ["GET /orgs/{org}/public_members/{username}"],
    convertMemberToOutsideCollaborator: [
      "PUT /orgs/{org}/outside_collaborators/{username}"
    ],
    createInvitation: ["POST /orgs/{org}/invitations"],
    createIssueType: ["POST /orgs/{org}/issue-types"],
    createOrUpdateCustomProperties: ["PATCH /orgs/{org}/properties/schema"],
    createOrUpdateCustomPropertiesValuesForRepos: [
      "PATCH /orgs/{org}/properties/values"
    ],
    createOrUpdateCustomProperty: [
      "PUT /orgs/{org}/properties/schema/{custom_property_name}"
    ],
    createWebhook: ["POST /orgs/{org}/hooks"],
    delete: ["DELETE /orgs/{org}"],
    deleteIssueType: ["DELETE /orgs/{org}/issue-types/{issue_type_id}"],
    deleteWebhook: ["DELETE /orgs/{org}/hooks/{hook_id}"],
    enableOrDisableSecurityProductOnAllOrgRepos: [
      "POST /orgs/{org}/{security_product}/{enablement}",
      {},
      {
        deprecated: "octokit.rest.orgs.enableOrDisableSecurityProductOnAllOrgRepos() is deprecated, see https://docs.github.com/rest/orgs/orgs#enable-or-disable-a-security-feature-for-an-organization"
      }
    ],
    get: ["GET /orgs/{org}"],
    getAllCustomProperties: ["GET /orgs/{org}/properties/schema"],
    getCustomProperty: [
      "GET /orgs/{org}/properties/schema/{custom_property_name}"
    ],
    getMembershipForAuthenticatedUser: ["GET /user/memberships/orgs/{org}"],
    getMembershipForUser: ["GET /orgs/{org}/memberships/{username}"],
    getOrgRole: ["GET /orgs/{org}/organization-roles/{role_id}"],
    getOrgRulesetHistory: ["GET /orgs/{org}/rulesets/{ruleset_id}/history"],
    getOrgRulesetVersion: [
      "GET /orgs/{org}/rulesets/{ruleset_id}/history/{version_id}"
    ],
    getWebhook: ["GET /orgs/{org}/hooks/{hook_id}"],
    getWebhookConfigForOrg: ["GET /orgs/{org}/hooks/{hook_id}/config"],
    getWebhookDelivery: [
      "GET /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}"
    ],
    list: ["GET /organizations"],
    listAppInstallations: ["GET /orgs/{org}/installations"],
    listAttestations: ["GET /orgs/{org}/attestations/{subject_digest}"],
    listBlockedUsers: ["GET /orgs/{org}/blocks"],
    listCustomPropertiesValuesForRepos: ["GET /orgs/{org}/properties/values"],
    listFailedInvitations: ["GET /orgs/{org}/failed_invitations"],
    listForAuthenticatedUser: ["GET /user/orgs"],
    listForUser: ["GET /users/{username}/orgs"],
    listInvitationTeams: ["GET /orgs/{org}/invitations/{invitation_id}/teams"],
    listIssueTypes: ["GET /orgs/{org}/issue-types"],
    listMembers: ["GET /orgs/{org}/members"],
    listMembershipsForAuthenticatedUser: ["GET /user/memberships/orgs"],
    listOrgRoleTeams: ["GET /orgs/{org}/organization-roles/{role_id}/teams"],
    listOrgRoleUsers: ["GET /orgs/{org}/organization-roles/{role_id}/users"],
    listOrgRoles: ["GET /orgs/{org}/organization-roles"],
    listOrganizationFineGrainedPermissions: [
      "GET /orgs/{org}/organization-fine-grained-permissions"
    ],
    listOutsideCollaborators: ["GET /orgs/{org}/outside_collaborators"],
    listPatGrantRepositories: [
      "GET /orgs/{org}/personal-access-tokens/{pat_id}/repositories"
    ],
    listPatGrantRequestRepositories: [
      "GET /orgs/{org}/personal-access-token-requests/{pat_request_id}/repositories"
    ],
    listPatGrantRequests: ["GET /orgs/{org}/personal-access-token-requests"],
    listPatGrants: ["GET /orgs/{org}/personal-access-tokens"],
    listPendingInvitations: ["GET /orgs/{org}/invitations"],
    listPublicMembers: ["GET /orgs/{org}/public_members"],
    listSecurityManagerTeams: [
      "GET /orgs/{org}/security-managers",
      {},
      {
        deprecated: "octokit.rest.orgs.listSecurityManagerTeams() is deprecated, see https://docs.github.com/rest/orgs/security-managers#list-security-manager-teams"
      }
    ],
    listWebhookDeliveries: ["GET /orgs/{org}/hooks/{hook_id}/deliveries"],
    listWebhooks: ["GET /orgs/{org}/hooks"],
    pingWebhook: ["POST /orgs/{org}/hooks/{hook_id}/pings"],
    redeliverWebhookDelivery: [
      "POST /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}/attempts"
    ],
    removeCustomProperty: [
      "DELETE /orgs/{org}/properties/schema/{custom_property_name}"
    ],
    removeMember: ["DELETE /orgs/{org}/members/{username}"],
    removeMembershipForUser: ["DELETE /orgs/{org}/memberships/{username}"],
    removeOutsideCollaborator: [
      "DELETE /orgs/{org}/outside_collaborators/{username}"
    ],
    removePublicMembershipForAuthenticatedUser: [
      "DELETE /orgs/{org}/public_members/{username}"
    ],
    removeSecurityManagerTeam: [
      "DELETE /orgs/{org}/security-managers/teams/{team_slug}",
      {},
      {
        deprecated: "octokit.rest.orgs.removeSecurityManagerTeam() is deprecated, see https://docs.github.com/rest/orgs/security-managers#remove-a-security-manager-team"
      }
    ],
    reviewPatGrantRequest: [
      "POST /orgs/{org}/personal-access-token-requests/{pat_request_id}"
    ],
    reviewPatGrantRequestsInBulk: [
      "POST /orgs/{org}/personal-access-token-requests"
    ],
    revokeAllOrgRolesTeam: [
      "DELETE /orgs/{org}/organization-roles/teams/{team_slug}"
    ],
    revokeAllOrgRolesUser: [
      "DELETE /orgs/{org}/organization-roles/users/{username}"
    ],
    revokeOrgRoleTeam: [
      "DELETE /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}"
    ],
    revokeOrgRoleUser: [
      "DELETE /orgs/{org}/organization-roles/users/{username}/{role_id}"
    ],
    setMembershipForUser: ["PUT /orgs/{org}/memberships/{username}"],
    setPublicMembershipForAuthenticatedUser: [
      "PUT /orgs/{org}/public_members/{username}"
    ],
    unblockUser: ["DELETE /orgs/{org}/blocks/{username}"],
    update: ["PATCH /orgs/{org}"],
    updateIssueType: ["PUT /orgs/{org}/issue-types/{issue_type_id}"],
    updateMembershipForAuthenticatedUser: [
      "PATCH /user/memberships/orgs/{org}"
    ],
    updatePatAccess: ["POST /orgs/{org}/personal-access-tokens/{pat_id}"],
    updatePatAccesses: ["POST /orgs/{org}/personal-access-tokens"],
    updateWebhook: ["PATCH /orgs/{org}/hooks/{hook_id}"],
    updateWebhookConfigForOrg: ["PATCH /orgs/{org}/hooks/{hook_id}/config"]
  },
  packages: {
    deletePackageForAuthenticatedUser: [
      "DELETE /user/packages/{package_type}/{package_name}"
    ],
    deletePackageForOrg: [
      "DELETE /orgs/{org}/packages/{package_type}/{package_name}"
    ],
    deletePackageForUser: [
      "DELETE /users/{username}/packages/{package_type}/{package_name}"
    ],
    deletePackageVersionForAuthenticatedUser: [
      "DELETE /user/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    deletePackageVersionForOrg: [
      "DELETE /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    deletePackageVersionForUser: [
      "DELETE /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    getAllPackageVersionsForAPackageOwnedByAnOrg: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}/versions",
      {},
      { renamed: ["packages", "getAllPackageVersionsForPackageOwnedByOrg"] }
    ],
    getAllPackageVersionsForAPackageOwnedByTheAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}/versions",
      {},
      {
        renamed: [
          "packages",
          "getAllPackageVersionsForPackageOwnedByAuthenticatedUser"
        ]
      }
    ],
    getAllPackageVersionsForPackageOwnedByAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}/versions"
    ],
    getAllPackageVersionsForPackageOwnedByOrg: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}/versions"
    ],
    getAllPackageVersionsForPackageOwnedByUser: [
      "GET /users/{username}/packages/{package_type}/{package_name}/versions"
    ],
    getPackageForAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}"
    ],
    getPackageForOrganization: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}"
    ],
    getPackageForUser: [
      "GET /users/{username}/packages/{package_type}/{package_name}"
    ],
    getPackageVersionForAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    getPackageVersionForOrganization: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    getPackageVersionForUser: [
      "GET /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    listDockerMigrationConflictingPackagesForAuthenticatedUser: [
      "GET /user/docker/conflicts"
    ],
    listDockerMigrationConflictingPackagesForOrganization: [
      "GET /orgs/{org}/docker/conflicts"
    ],
    listDockerMigrationConflictingPackagesForUser: [
      "GET /users/{username}/docker/conflicts"
    ],
    listPackagesForAuthenticatedUser: ["GET /user/packages"],
    listPackagesForOrganization: ["GET /orgs/{org}/packages"],
    listPackagesForUser: ["GET /users/{username}/packages"],
    restorePackageForAuthenticatedUser: [
      "POST /user/packages/{package_type}/{package_name}/restore{?token}"
    ],
    restorePackageForOrg: [
      "POST /orgs/{org}/packages/{package_type}/{package_name}/restore{?token}"
    ],
    restorePackageForUser: [
      "POST /users/{username}/packages/{package_type}/{package_name}/restore{?token}"
    ],
    restorePackageVersionForAuthenticatedUser: [
      "POST /user/packages/{package_type}/{package_name}/versions/{package_version_id}/restore"
    ],
    restorePackageVersionForOrg: [
      "POST /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore"
    ],
    restorePackageVersionForUser: [
      "POST /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore"
    ]
  },
  privateRegistries: {
    createOrgPrivateRegistry: ["POST /orgs/{org}/private-registries"],
    deleteOrgPrivateRegistry: [
      "DELETE /orgs/{org}/private-registries/{secret_name}"
    ],
    getOrgPrivateRegistry: ["GET /orgs/{org}/private-registries/{secret_name}"],
    getOrgPublicKey: ["GET /orgs/{org}/private-registries/public-key"],
    listOrgPrivateRegistries: ["GET /orgs/{org}/private-registries"],
    updateOrgPrivateRegistry: [
      "PATCH /orgs/{org}/private-registries/{secret_name}"
    ]
  },
  projects: {
    addCollaborator: [
      "PUT /projects/{project_id}/collaborators/{username}",
      {},
      {
        deprecated: "octokit.rest.projects.addCollaborator() is deprecated, see https://docs.github.com/rest/projects/collaborators#add-project-collaborator"
      }
    ],
    createCard: [
      "POST /projects/columns/{column_id}/cards",
      {},
      {
        deprecated: "octokit.rest.projects.createCard() is deprecated, see https://docs.github.com/rest/projects/cards#create-a-project-card"
      }
    ],
    createColumn: [
      "POST /projects/{project_id}/columns",
      {},
      {
        deprecated: "octokit.rest.projects.createColumn() is deprecated, see https://docs.github.com/rest/projects/columns#create-a-project-column"
      }
    ],
    createForAuthenticatedUser: [
      "POST /user/projects",
      {},
      {
        deprecated: "octokit.rest.projects.createForAuthenticatedUser() is deprecated, see https://docs.github.com/rest/projects/projects#create-a-user-project"
      }
    ],
    createForOrg: [
      "POST /orgs/{org}/projects",
      {},
      {
        deprecated: "octokit.rest.projects.createForOrg() is deprecated, see https://docs.github.com/rest/projects/projects#create-an-organization-project"
      }
    ],
    createForRepo: [
      "POST /repos/{owner}/{repo}/projects",
      {},
      {
        deprecated: "octokit.rest.projects.createForRepo() is deprecated, see https://docs.github.com/rest/projects/projects#create-a-repository-project"
      }
    ],
    delete: [
      "DELETE /projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.projects.delete() is deprecated, see https://docs.github.com/rest/projects/projects#delete-a-project"
      }
    ],
    deleteCard: [
      "DELETE /projects/columns/cards/{card_id}",
      {},
      {
        deprecated: "octokit.rest.projects.deleteCard() is deprecated, see https://docs.github.com/rest/projects/cards#delete-a-project-card"
      }
    ],
    deleteColumn: [
      "DELETE /projects/columns/{column_id}",
      {},
      {
        deprecated: "octokit.rest.projects.deleteColumn() is deprecated, see https://docs.github.com/rest/projects/columns#delete-a-project-column"
      }
    ],
    get: [
      "GET /projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.projects.get() is deprecated, see https://docs.github.com/rest/projects/projects#get-a-project"
      }
    ],
    getCard: [
      "GET /projects/columns/cards/{card_id}",
      {},
      {
        deprecated: "octokit.rest.projects.getCard() is deprecated, see https://docs.github.com/rest/projects/cards#get-a-project-card"
      }
    ],
    getColumn: [
      "GET /projects/columns/{column_id}",
      {},
      {
        deprecated: "octokit.rest.projects.getColumn() is deprecated, see https://docs.github.com/rest/projects/columns#get-a-project-column"
      }
    ],
    getPermissionForUser: [
      "GET /projects/{project_id}/collaborators/{username}/permission",
      {},
      {
        deprecated: "octokit.rest.projects.getPermissionForUser() is deprecated, see https://docs.github.com/rest/projects/collaborators#get-project-permission-for-a-user"
      }
    ],
    listCards: [
      "GET /projects/columns/{column_id}/cards",
      {},
      {
        deprecated: "octokit.rest.projects.listCards() is deprecated, see https://docs.github.com/rest/projects/cards#list-project-cards"
      }
    ],
    listCollaborators: [
      "GET /projects/{project_id}/collaborators",
      {},
      {
        deprecated: "octokit.rest.projects.listCollaborators() is deprecated, see https://docs.github.com/rest/projects/collaborators#list-project-collaborators"
      }
    ],
    listColumns: [
      "GET /projects/{project_id}/columns",
      {},
      {
        deprecated: "octokit.rest.projects.listColumns() is deprecated, see https://docs.github.com/rest/projects/columns#list-project-columns"
      }
    ],
    listForOrg: [
      "GET /orgs/{org}/projects",
      {},
      {
        deprecated: "octokit.rest.projects.listForOrg() is deprecated, see https://docs.github.com/rest/projects/projects#list-organization-projects"
      }
    ],
    listForRepo: [
      "GET /repos/{owner}/{repo}/projects",
      {},
      {
        deprecated: "octokit.rest.projects.listForRepo() is deprecated, see https://docs.github.com/rest/projects/projects#list-repository-projects"
      }
    ],
    listForUser: [
      "GET /users/{username}/projects",
      {},
      {
        deprecated: "octokit.rest.projects.listForUser() is deprecated, see https://docs.github.com/rest/projects/projects#list-user-projects"
      }
    ],
    moveCard: [
      "POST /projects/columns/cards/{card_id}/moves",
      {},
      {
        deprecated: "octokit.rest.projects.moveCard() is deprecated, see https://docs.github.com/rest/projects/cards#move-a-project-card"
      }
    ],
    moveColumn: [
      "POST /projects/columns/{column_id}/moves",
      {},
      {
        deprecated: "octokit.rest.projects.moveColumn() is deprecated, see https://docs.github.com/rest/projects/columns#move-a-project-column"
      }
    ],
    removeCollaborator: [
      "DELETE /projects/{project_id}/collaborators/{username}",
      {},
      {
        deprecated: "octokit.rest.projects.removeCollaborator() is deprecated, see https://docs.github.com/rest/projects/collaborators#remove-user-as-a-collaborator"
      }
    ],
    update: [
      "PATCH /projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.projects.update() is deprecated, see https://docs.github.com/rest/projects/projects#update-a-project"
      }
    ],
    updateCard: [
      "PATCH /projects/columns/cards/{card_id}",
      {},
      {
        deprecated: "octokit.rest.projects.updateCard() is deprecated, see https://docs.github.com/rest/projects/cards#update-an-existing-project-card"
      }
    ],
    updateColumn: [
      "PATCH /projects/columns/{column_id}",
      {},
      {
        deprecated: "octokit.rest.projects.updateColumn() is deprecated, see https://docs.github.com/rest/projects/columns#update-an-existing-project-column"
      }
    ]
  },
  pulls: {
    checkIfMerged: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/merge"],
    create: ["POST /repos/{owner}/{repo}/pulls"],
    createReplyForReviewComment: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies"
    ],
    createReview: ["POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews"],
    createReviewComment: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments"
    ],
    deletePendingReview: [
      "DELETE /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}"
    ],
    deleteReviewComment: [
      "DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}"
    ],
    dismissReview: [
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals"
    ],
    get: ["GET /repos/{owner}/{repo}/pulls/{pull_number}"],
    getReview: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}"
    ],
    getReviewComment: ["GET /repos/{owner}/{repo}/pulls/comments/{comment_id}"],
    list: ["GET /repos/{owner}/{repo}/pulls"],
    listCommentsForReview: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments"
    ],
    listCommits: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/commits"],
    listFiles: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/files"],
    listRequestedReviewers: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers"
    ],
    listReviewComments: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments"
    ],
    listReviewCommentsForRepo: ["GET /repos/{owner}/{repo}/pulls/comments"],
    listReviews: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews"],
    merge: ["PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge"],
    removeRequestedReviewers: [
      "DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers"
    ],
    requestReviewers: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers"
    ],
    submitReview: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/events"
    ],
    update: ["PATCH /repos/{owner}/{repo}/pulls/{pull_number}"],
    updateBranch: [
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch"
    ],
    updateReview: [
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}"
    ],
    updateReviewComment: [
      "PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}"
    ]
  },
  rateLimit: { get: ["GET /rate_limit"] },
  reactions: {
    createForCommitComment: [
      "POST /repos/{owner}/{repo}/comments/{comment_id}/reactions"
    ],
    createForIssue: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/reactions"
    ],
    createForIssueComment: [
      "POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions"
    ],
    createForPullRequestReviewComment: [
      "POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions"
    ],
    createForRelease: [
      "POST /repos/{owner}/{repo}/releases/{release_id}/reactions"
    ],
    createForTeamDiscussionCommentInOrg: [
      "POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions"
    ],
    createForTeamDiscussionInOrg: [
      "POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions"
    ],
    deleteForCommitComment: [
      "DELETE /repos/{owner}/{repo}/comments/{comment_id}/reactions/{reaction_id}"
    ],
    deleteForIssue: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}"
    ],
    deleteForIssueComment: [
      "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}"
    ],
    deleteForPullRequestComment: [
      "DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}"
    ],
    deleteForRelease: [
      "DELETE /repos/{owner}/{repo}/releases/{release_id}/reactions/{reaction_id}"
    ],
    deleteForTeamDiscussion: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions/{reaction_id}"
    ],
    deleteForTeamDiscussionComment: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions/{reaction_id}"
    ],
    listForCommitComment: [
      "GET /repos/{owner}/{repo}/comments/{comment_id}/reactions"
    ],
    listForIssue: ["GET /repos/{owner}/{repo}/issues/{issue_number}/reactions"],
    listForIssueComment: [
      "GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions"
    ],
    listForPullRequestReviewComment: [
      "GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions"
    ],
    listForRelease: [
      "GET /repos/{owner}/{repo}/releases/{release_id}/reactions"
    ],
    listForTeamDiscussionCommentInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions"
    ],
    listForTeamDiscussionInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions"
    ]
  },
  repos: {
    acceptInvitation: [
      "PATCH /user/repository_invitations/{invitation_id}",
      {},
      { renamed: ["repos", "acceptInvitationForAuthenticatedUser"] }
    ],
    acceptInvitationForAuthenticatedUser: [
      "PATCH /user/repository_invitations/{invitation_id}"
    ],
    addAppAccessRestrictions: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
      {},
      { mapToData: "apps" }
    ],
    addCollaborator: ["PUT /repos/{owner}/{repo}/collaborators/{username}"],
    addStatusCheckContexts: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
      {},
      { mapToData: "contexts" }
    ],
    addTeamAccessRestrictions: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
      {},
      { mapToData: "teams" }
    ],
    addUserAccessRestrictions: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
      {},
      { mapToData: "users" }
    ],
    cancelPagesDeployment: [
      "POST /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}/cancel"
    ],
    checkAutomatedSecurityFixes: [
      "GET /repos/{owner}/{repo}/automated-security-fixes"
    ],
    checkCollaborator: ["GET /repos/{owner}/{repo}/collaborators/{username}"],
    checkPrivateVulnerabilityReporting: [
      "GET /repos/{owner}/{repo}/private-vulnerability-reporting"
    ],
    checkVulnerabilityAlerts: [
      "GET /repos/{owner}/{repo}/vulnerability-alerts"
    ],
    codeownersErrors: ["GET /repos/{owner}/{repo}/codeowners/errors"],
    compareCommits: ["GET /repos/{owner}/{repo}/compare/{base}...{head}"],
    compareCommitsWithBasehead: [
      "GET /repos/{owner}/{repo}/compare/{basehead}"
    ],
    createAttestation: ["POST /repos/{owner}/{repo}/attestations"],
    createAutolink: ["POST /repos/{owner}/{repo}/autolinks"],
    createCommitComment: [
      "POST /repos/{owner}/{repo}/commits/{commit_sha}/comments"
    ],
    createCommitSignatureProtection: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures"
    ],
    createCommitStatus: ["POST /repos/{owner}/{repo}/statuses/{sha}"],
    createDeployKey: ["POST /repos/{owner}/{repo}/keys"],
    createDeployment: ["POST /repos/{owner}/{repo}/deployments"],
    createDeploymentBranchPolicy: [
      "POST /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies"
    ],
    createDeploymentProtectionRule: [
      "POST /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules"
    ],
    createDeploymentStatus: [
      "POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses"
    ],
    createDispatchEvent: ["POST /repos/{owner}/{repo}/dispatches"],
    createForAuthenticatedUser: ["POST /user/repos"],
    createFork: ["POST /repos/{owner}/{repo}/forks"],
    createInOrg: ["POST /orgs/{org}/repos"],
    createOrUpdateCustomPropertiesValues: [
      "PATCH /repos/{owner}/{repo}/properties/values"
    ],
    createOrUpdateEnvironment: [
      "PUT /repos/{owner}/{repo}/environments/{environment_name}"
    ],
    createOrUpdateFileContents: ["PUT /repos/{owner}/{repo}/contents/{path}"],
    createOrgRuleset: ["POST /orgs/{org}/rulesets"],
    createPagesDeployment: ["POST /repos/{owner}/{repo}/pages/deployments"],
    createPagesSite: ["POST /repos/{owner}/{repo}/pages"],
    createRelease: ["POST /repos/{owner}/{repo}/releases"],
    createRepoRuleset: ["POST /repos/{owner}/{repo}/rulesets"],
    createUsingTemplate: [
      "POST /repos/{template_owner}/{template_repo}/generate"
    ],
    createWebhook: ["POST /repos/{owner}/{repo}/hooks"],
    declineInvitation: [
      "DELETE /user/repository_invitations/{invitation_id}",
      {},
      { renamed: ["repos", "declineInvitationForAuthenticatedUser"] }
    ],
    declineInvitationForAuthenticatedUser: [
      "DELETE /user/repository_invitations/{invitation_id}"
    ],
    delete: ["DELETE /repos/{owner}/{repo}"],
    deleteAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions"
    ],
    deleteAdminBranchProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins"
    ],
    deleteAnEnvironment: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}"
    ],
    deleteAutolink: ["DELETE /repos/{owner}/{repo}/autolinks/{autolink_id}"],
    deleteBranchProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection"
    ],
    deleteCommitComment: ["DELETE /repos/{owner}/{repo}/comments/{comment_id}"],
    deleteCommitSignatureProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures"
    ],
    deleteDeployKey: ["DELETE /repos/{owner}/{repo}/keys/{key_id}"],
    deleteDeployment: [
      "DELETE /repos/{owner}/{repo}/deployments/{deployment_id}"
    ],
    deleteDeploymentBranchPolicy: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}"
    ],
    deleteFile: ["DELETE /repos/{owner}/{repo}/contents/{path}"],
    deleteInvitation: [
      "DELETE /repos/{owner}/{repo}/invitations/{invitation_id}"
    ],
    deleteOrgRuleset: ["DELETE /orgs/{org}/rulesets/{ruleset_id}"],
    deletePagesSite: ["DELETE /repos/{owner}/{repo}/pages"],
    deletePullRequestReviewProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews"
    ],
    deleteRelease: ["DELETE /repos/{owner}/{repo}/releases/{release_id}"],
    deleteReleaseAsset: [
      "DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}"
    ],
    deleteRepoRuleset: ["DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
    deleteWebhook: ["DELETE /repos/{owner}/{repo}/hooks/{hook_id}"],
    disableAutomatedSecurityFixes: [
      "DELETE /repos/{owner}/{repo}/automated-security-fixes"
    ],
    disableDeploymentProtectionRule: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}"
    ],
    disablePrivateVulnerabilityReporting: [
      "DELETE /repos/{owner}/{repo}/private-vulnerability-reporting"
    ],
    disableVulnerabilityAlerts: [
      "DELETE /repos/{owner}/{repo}/vulnerability-alerts"
    ],
    downloadArchive: [
      "GET /repos/{owner}/{repo}/zipball/{ref}",
      {},
      { renamed: ["repos", "downloadZipballArchive"] }
    ],
    downloadTarballArchive: ["GET /repos/{owner}/{repo}/tarball/{ref}"],
    downloadZipballArchive: ["GET /repos/{owner}/{repo}/zipball/{ref}"],
    enableAutomatedSecurityFixes: [
      "PUT /repos/{owner}/{repo}/automated-security-fixes"
    ],
    enablePrivateVulnerabilityReporting: [
      "PUT /repos/{owner}/{repo}/private-vulnerability-reporting"
    ],
    enableVulnerabilityAlerts: [
      "PUT /repos/{owner}/{repo}/vulnerability-alerts"
    ],
    generateReleaseNotes: [
      "POST /repos/{owner}/{repo}/releases/generate-notes"
    ],
    get: ["GET /repos/{owner}/{repo}"],
    getAccessRestrictions: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions"
    ],
    getAdminBranchProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins"
    ],
    getAllDeploymentProtectionRules: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules"
    ],
    getAllEnvironments: ["GET /repos/{owner}/{repo}/environments"],
    getAllStatusCheckContexts: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts"
    ],
    getAllTopics: ["GET /repos/{owner}/{repo}/topics"],
    getAppsWithAccessToProtectedBranch: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps"
    ],
    getAutolink: ["GET /repos/{owner}/{repo}/autolinks/{autolink_id}"],
    getBranch: ["GET /repos/{owner}/{repo}/branches/{branch}"],
    getBranchProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection"
    ],
    getBranchRules: ["GET /repos/{owner}/{repo}/rules/branches/{branch}"],
    getClones: ["GET /repos/{owner}/{repo}/traffic/clones"],
    getCodeFrequencyStats: ["GET /repos/{owner}/{repo}/stats/code_frequency"],
    getCollaboratorPermissionLevel: [
      "GET /repos/{owner}/{repo}/collaborators/{username}/permission"
    ],
    getCombinedStatusForRef: ["GET /repos/{owner}/{repo}/commits/{ref}/status"],
    getCommit: ["GET /repos/{owner}/{repo}/commits/{ref}"],
    getCommitActivityStats: ["GET /repos/{owner}/{repo}/stats/commit_activity"],
    getCommitComment: ["GET /repos/{owner}/{repo}/comments/{comment_id}"],
    getCommitSignatureProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures"
    ],
    getCommunityProfileMetrics: ["GET /repos/{owner}/{repo}/community/profile"],
    getContent: ["GET /repos/{owner}/{repo}/contents/{path}"],
    getContributorsStats: ["GET /repos/{owner}/{repo}/stats/contributors"],
    getCustomDeploymentProtectionRule: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}"
    ],
    getCustomPropertiesValues: ["GET /repos/{owner}/{repo}/properties/values"],
    getDeployKey: ["GET /repos/{owner}/{repo}/keys/{key_id}"],
    getDeployment: ["GET /repos/{owner}/{repo}/deployments/{deployment_id}"],
    getDeploymentBranchPolicy: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}"
    ],
    getDeploymentStatus: [
      "GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses/{status_id}"
    ],
    getEnvironment: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}"
    ],
    getLatestPagesBuild: ["GET /repos/{owner}/{repo}/pages/builds/latest"],
    getLatestRelease: ["GET /repos/{owner}/{repo}/releases/latest"],
    getOrgRuleSuite: ["GET /orgs/{org}/rulesets/rule-suites/{rule_suite_id}"],
    getOrgRuleSuites: ["GET /orgs/{org}/rulesets/rule-suites"],
    getOrgRuleset: ["GET /orgs/{org}/rulesets/{ruleset_id}"],
    getOrgRulesets: ["GET /orgs/{org}/rulesets"],
    getPages: ["GET /repos/{owner}/{repo}/pages"],
    getPagesBuild: ["GET /repos/{owner}/{repo}/pages/builds/{build_id}"],
    getPagesDeployment: [
      "GET /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}"
    ],
    getPagesHealthCheck: ["GET /repos/{owner}/{repo}/pages/health"],
    getParticipationStats: ["GET /repos/{owner}/{repo}/stats/participation"],
    getPullRequestReviewProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews"
    ],
    getPunchCardStats: ["GET /repos/{owner}/{repo}/stats/punch_card"],
    getReadme: ["GET /repos/{owner}/{repo}/readme"],
    getReadmeInDirectory: ["GET /repos/{owner}/{repo}/readme/{dir}"],
    getRelease: ["GET /repos/{owner}/{repo}/releases/{release_id}"],
    getReleaseAsset: ["GET /repos/{owner}/{repo}/releases/assets/{asset_id}"],
    getReleaseByTag: ["GET /repos/{owner}/{repo}/releases/tags/{tag}"],
    getRepoRuleSuite: [
      "GET /repos/{owner}/{repo}/rulesets/rule-suites/{rule_suite_id}"
    ],
    getRepoRuleSuites: ["GET /repos/{owner}/{repo}/rulesets/rule-suites"],
    getRepoRuleset: ["GET /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
    getRepoRulesetHistory: [
      "GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history"
    ],
    getRepoRulesetVersion: [
      "GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history/{version_id}"
    ],
    getRepoRulesets: ["GET /repos/{owner}/{repo}/rulesets"],
    getStatusChecksProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks"
    ],
    getTeamsWithAccessToProtectedBranch: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams"
    ],
    getTopPaths: ["GET /repos/{owner}/{repo}/traffic/popular/paths"],
    getTopReferrers: ["GET /repos/{owner}/{repo}/traffic/popular/referrers"],
    getUsersWithAccessToProtectedBranch: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users"
    ],
    getViews: ["GET /repos/{owner}/{repo}/traffic/views"],
    getWebhook: ["GET /repos/{owner}/{repo}/hooks/{hook_id}"],
    getWebhookConfigForRepo: [
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/config"
    ],
    getWebhookDelivery: [
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}"
    ],
    listActivities: ["GET /repos/{owner}/{repo}/activity"],
    listAttestations: [
      "GET /repos/{owner}/{repo}/attestations/{subject_digest}"
    ],
    listAutolinks: ["GET /repos/{owner}/{repo}/autolinks"],
    listBranches: ["GET /repos/{owner}/{repo}/branches"],
    listBranchesForHeadCommit: [
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/branches-where-head"
    ],
    listCollaborators: ["GET /repos/{owner}/{repo}/collaborators"],
    listCommentsForCommit: [
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/comments"
    ],
    listCommitCommentsForRepo: ["GET /repos/{owner}/{repo}/comments"],
    listCommitStatusesForRef: [
      "GET /repos/{owner}/{repo}/commits/{ref}/statuses"
    ],
    listCommits: ["GET /repos/{owner}/{repo}/commits"],
    listContributors: ["GET /repos/{owner}/{repo}/contributors"],
    listCustomDeploymentRuleIntegrations: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/apps"
    ],
    listDeployKeys: ["GET /repos/{owner}/{repo}/keys"],
    listDeploymentBranchPolicies: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies"
    ],
    listDeploymentStatuses: [
      "GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses"
    ],
    listDeployments: ["GET /repos/{owner}/{repo}/deployments"],
    listForAuthenticatedUser: ["GET /user/repos"],
    listForOrg: ["GET /orgs/{org}/repos"],
    listForUser: ["GET /users/{username}/repos"],
    listForks: ["GET /repos/{owner}/{repo}/forks"],
    listInvitations: ["GET /repos/{owner}/{repo}/invitations"],
    listInvitationsForAuthenticatedUser: ["GET /user/repository_invitations"],
    listLanguages: ["GET /repos/{owner}/{repo}/languages"],
    listPagesBuilds: ["GET /repos/{owner}/{repo}/pages/builds"],
    listPublic: ["GET /repositories"],
    listPullRequestsAssociatedWithCommit: [
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls"
    ],
    listReleaseAssets: [
      "GET /repos/{owner}/{repo}/releases/{release_id}/assets"
    ],
    listReleases: ["GET /repos/{owner}/{repo}/releases"],
    listTags: ["GET /repos/{owner}/{repo}/tags"],
    listTeams: ["GET /repos/{owner}/{repo}/teams"],
    listWebhookDeliveries: [
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries"
    ],
    listWebhooks: ["GET /repos/{owner}/{repo}/hooks"],
    merge: ["POST /repos/{owner}/{repo}/merges"],
    mergeUpstream: ["POST /repos/{owner}/{repo}/merge-upstream"],
    pingWebhook: ["POST /repos/{owner}/{repo}/hooks/{hook_id}/pings"],
    redeliverWebhookDelivery: [
      "POST /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}/attempts"
    ],
    removeAppAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
      {},
      { mapToData: "apps" }
    ],
    removeCollaborator: [
      "DELETE /repos/{owner}/{repo}/collaborators/{username}"
    ],
    removeStatusCheckContexts: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
      {},
      { mapToData: "contexts" }
    ],
    removeStatusCheckProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks"
    ],
    removeTeamAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
      {},
      { mapToData: "teams" }
    ],
    removeUserAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
      {},
      { mapToData: "users" }
    ],
    renameBranch: ["POST /repos/{owner}/{repo}/branches/{branch}/rename"],
    replaceAllTopics: ["PUT /repos/{owner}/{repo}/topics"],
    requestPagesBuild: ["POST /repos/{owner}/{repo}/pages/builds"],
    setAdminBranchProtection: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins"
    ],
    setAppAccessRestrictions: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
      {},
      { mapToData: "apps" }
    ],
    setStatusCheckContexts: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
      {},
      { mapToData: "contexts" }
    ],
    setTeamAccessRestrictions: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
      {},
      { mapToData: "teams" }
    ],
    setUserAccessRestrictions: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
      {},
      { mapToData: "users" }
    ],
    testPushWebhook: ["POST /repos/{owner}/{repo}/hooks/{hook_id}/tests"],
    transfer: ["POST /repos/{owner}/{repo}/transfer"],
    update: ["PATCH /repos/{owner}/{repo}"],
    updateBranchProtection: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection"
    ],
    updateCommitComment: ["PATCH /repos/{owner}/{repo}/comments/{comment_id}"],
    updateDeploymentBranchPolicy: [
      "PUT /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}"
    ],
    updateInformationAboutPagesSite: ["PUT /repos/{owner}/{repo}/pages"],
    updateInvitation: [
      "PATCH /repos/{owner}/{repo}/invitations/{invitation_id}"
    ],
    updateOrgRuleset: ["PUT /orgs/{org}/rulesets/{ruleset_id}"],
    updatePullRequestReviewProtection: [
      "PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews"
    ],
    updateRelease: ["PATCH /repos/{owner}/{repo}/releases/{release_id}"],
    updateReleaseAsset: [
      "PATCH /repos/{owner}/{repo}/releases/assets/{asset_id}"
    ],
    updateRepoRuleset: ["PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
    updateStatusCheckPotection: [
      "PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks",
      {},
      { renamed: ["repos", "updateStatusCheckProtection"] }
    ],
    updateStatusCheckProtection: [
      "PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks"
    ],
    updateWebhook: ["PATCH /repos/{owner}/{repo}/hooks/{hook_id}"],
    updateWebhookConfigForRepo: [
      "PATCH /repos/{owner}/{repo}/hooks/{hook_id}/config"
    ],
    uploadReleaseAsset: [
      "POST /repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}",
      { baseUrl: "https://uploads.github.com" }
    ]
  },
  search: {
    code: ["GET /search/code"],
    commits: ["GET /search/commits"],
    issuesAndPullRequests: [
      "GET /search/issues",
      {},
      {
        deprecated: "octokit.rest.search.issuesAndPullRequests() is deprecated, see https://docs.github.com/rest/search/search#search-issues-and-pull-requests"
      }
    ],
    labels: ["GET /search/labels"],
    repos: ["GET /search/repositories"],
    topics: ["GET /search/topics"],
    users: ["GET /search/users"]
  },
  secretScanning: {
    createPushProtectionBypass: [
      "POST /repos/{owner}/{repo}/secret-scanning/push-protection-bypasses"
    ],
    getAlert: [
      "GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}"
    ],
    getScanHistory: ["GET /repos/{owner}/{repo}/secret-scanning/scan-history"],
    listAlertsForEnterprise: [
      "GET /enterprises/{enterprise}/secret-scanning/alerts"
    ],
    listAlertsForOrg: ["GET /orgs/{org}/secret-scanning/alerts"],
    listAlertsForRepo: ["GET /repos/{owner}/{repo}/secret-scanning/alerts"],
    listLocationsForAlert: [
      "GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}/locations"
    ],
    updateAlert: [
      "PATCH /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}"
    ]
  },
  securityAdvisories: {
    createFork: [
      "POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/forks"
    ],
    createPrivateVulnerabilityReport: [
      "POST /repos/{owner}/{repo}/security-advisories/reports"
    ],
    createRepositoryAdvisory: [
      "POST /repos/{owner}/{repo}/security-advisories"
    ],
    createRepositoryAdvisoryCveRequest: [
      "POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/cve"
    ],
    getGlobalAdvisory: ["GET /advisories/{ghsa_id}"],
    getRepositoryAdvisory: [
      "GET /repos/{owner}/{repo}/security-advisories/{ghsa_id}"
    ],
    listGlobalAdvisories: ["GET /advisories"],
    listOrgRepositoryAdvisories: ["GET /orgs/{org}/security-advisories"],
    listRepositoryAdvisories: ["GET /repos/{owner}/{repo}/security-advisories"],
    updateRepositoryAdvisory: [
      "PATCH /repos/{owner}/{repo}/security-advisories/{ghsa_id}"
    ]
  },
  teams: {
    addOrUpdateMembershipForUserInOrg: [
      "PUT /orgs/{org}/teams/{team_slug}/memberships/{username}"
    ],
    addOrUpdateProjectPermissionsInOrg: [
      "PUT /orgs/{org}/teams/{team_slug}/projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.teams.addOrUpdateProjectPermissionsInOrg() is deprecated, see https://docs.github.com/rest/teams/teams#add-or-update-team-project-permissions"
      }
    ],
    addOrUpdateProjectPermissionsLegacy: [
      "PUT /teams/{team_id}/projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.teams.addOrUpdateProjectPermissionsLegacy() is deprecated, see https://docs.github.com/rest/teams/teams#add-or-update-team-project-permissions-legacy"
      }
    ],
    addOrUpdateRepoPermissionsInOrg: [
      "PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}"
    ],
    checkPermissionsForProjectInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.teams.checkPermissionsForProjectInOrg() is deprecated, see https://docs.github.com/rest/teams/teams#check-team-permissions-for-a-project"
      }
    ],
    checkPermissionsForProjectLegacy: [
      "GET /teams/{team_id}/projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.teams.checkPermissionsForProjectLegacy() is deprecated, see https://docs.github.com/rest/teams/teams#check-team-permissions-for-a-project-legacy"
      }
    ],
    checkPermissionsForRepoInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}"
    ],
    create: ["POST /orgs/{org}/teams"],
    createDiscussionCommentInOrg: [
      "POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments"
    ],
    createDiscussionInOrg: ["POST /orgs/{org}/teams/{team_slug}/discussions"],
    deleteDiscussionCommentInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}"
    ],
    deleteDiscussionInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}"
    ],
    deleteInOrg: ["DELETE /orgs/{org}/teams/{team_slug}"],
    getByName: ["GET /orgs/{org}/teams/{team_slug}"],
    getDiscussionCommentInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}"
    ],
    getDiscussionInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}"
    ],
    getMembershipForUserInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/memberships/{username}"
    ],
    list: ["GET /orgs/{org}/teams"],
    listChildInOrg: ["GET /orgs/{org}/teams/{team_slug}/teams"],
    listDiscussionCommentsInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments"
    ],
    listDiscussionsInOrg: ["GET /orgs/{org}/teams/{team_slug}/discussions"],
    listForAuthenticatedUser: ["GET /user/teams"],
    listMembersInOrg: ["GET /orgs/{org}/teams/{team_slug}/members"],
    listPendingInvitationsInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/invitations"
    ],
    listProjectsInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/projects",
      {},
      {
        deprecated: "octokit.rest.teams.listProjectsInOrg() is deprecated, see https://docs.github.com/rest/teams/teams#list-team-projects"
      }
    ],
    listProjectsLegacy: [
      "GET /teams/{team_id}/projects",
      {},
      {
        deprecated: "octokit.rest.teams.listProjectsLegacy() is deprecated, see https://docs.github.com/rest/teams/teams#list-team-projects-legacy"
      }
    ],
    listReposInOrg: ["GET /orgs/{org}/teams/{team_slug}/repos"],
    removeMembershipForUserInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/memberships/{username}"
    ],
    removeProjectInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.teams.removeProjectInOrg() is deprecated, see https://docs.github.com/rest/teams/teams#remove-a-project-from-a-team"
      }
    ],
    removeProjectLegacy: [
      "DELETE /teams/{team_id}/projects/{project_id}",
      {},
      {
        deprecated: "octokit.rest.teams.removeProjectLegacy() is deprecated, see https://docs.github.com/rest/teams/teams#remove-a-project-from-a-team-legacy"
      }
    ],
    removeRepoInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}"
    ],
    updateDiscussionCommentInOrg: [
      "PATCH /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}"
    ],
    updateDiscussionInOrg: [
      "PATCH /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}"
    ],
    updateInOrg: ["PATCH /orgs/{org}/teams/{team_slug}"]
  },
  users: {
    addEmailForAuthenticated: [
      "POST /user/emails",
      {},
      { renamed: ["users", "addEmailForAuthenticatedUser"] }
    ],
    addEmailForAuthenticatedUser: ["POST /user/emails"],
    addSocialAccountForAuthenticatedUser: ["POST /user/social_accounts"],
    block: ["PUT /user/blocks/{username}"],
    checkBlocked: ["GET /user/blocks/{username}"],
    checkFollowingForUser: ["GET /users/{username}/following/{target_user}"],
    checkPersonIsFollowedByAuthenticated: ["GET /user/following/{username}"],
    createGpgKeyForAuthenticated: [
      "POST /user/gpg_keys",
      {},
      { renamed: ["users", "createGpgKeyForAuthenticatedUser"] }
    ],
    createGpgKeyForAuthenticatedUser: ["POST /user/gpg_keys"],
    createPublicSshKeyForAuthenticated: [
      "POST /user/keys",
      {},
      { renamed: ["users", "createPublicSshKeyForAuthenticatedUser"] }
    ],
    createPublicSshKeyForAuthenticatedUser: ["POST /user/keys"],
    createSshSigningKeyForAuthenticatedUser: ["POST /user/ssh_signing_keys"],
    deleteEmailForAuthenticated: [
      "DELETE /user/emails",
      {},
      { renamed: ["users", "deleteEmailForAuthenticatedUser"] }
    ],
    deleteEmailForAuthenticatedUser: ["DELETE /user/emails"],
    deleteGpgKeyForAuthenticated: [
      "DELETE /user/gpg_keys/{gpg_key_id}",
      {},
      { renamed: ["users", "deleteGpgKeyForAuthenticatedUser"] }
    ],
    deleteGpgKeyForAuthenticatedUser: ["DELETE /user/gpg_keys/{gpg_key_id}"],
    deletePublicSshKeyForAuthenticated: [
      "DELETE /user/keys/{key_id}",
      {},
      { renamed: ["users", "deletePublicSshKeyForAuthenticatedUser"] }
    ],
    deletePublicSshKeyForAuthenticatedUser: ["DELETE /user/keys/{key_id}"],
    deleteSocialAccountForAuthenticatedUser: ["DELETE /user/social_accounts"],
    deleteSshSigningKeyForAuthenticatedUser: [
      "DELETE /user/ssh_signing_keys/{ssh_signing_key_id}"
    ],
    follow: ["PUT /user/following/{username}"],
    getAuthenticated: ["GET /user"],
    getById: ["GET /user/{account_id}"],
    getByUsername: ["GET /users/{username}"],
    getContextForUser: ["GET /users/{username}/hovercard"],
    getGpgKeyForAuthenticated: [
      "GET /user/gpg_keys/{gpg_key_id}",
      {},
      { renamed: ["users", "getGpgKeyForAuthenticatedUser"] }
    ],
    getGpgKeyForAuthenticatedUser: ["GET /user/gpg_keys/{gpg_key_id}"],
    getPublicSshKeyForAuthenticated: [
      "GET /user/keys/{key_id}",
      {},
      { renamed: ["users", "getPublicSshKeyForAuthenticatedUser"] }
    ],
    getPublicSshKeyForAuthenticatedUser: ["GET /user/keys/{key_id}"],
    getSshSigningKeyForAuthenticatedUser: [
      "GET /user/ssh_signing_keys/{ssh_signing_key_id}"
    ],
    list: ["GET /users"],
    listAttestations: ["GET /users/{username}/attestations/{subject_digest}"],
    listBlockedByAuthenticated: [
      "GET /user/blocks",
      {},
      { renamed: ["users", "listBlockedByAuthenticatedUser"] }
    ],
    listBlockedByAuthenticatedUser: ["GET /user/blocks"],
    listEmailsForAuthenticated: [
      "GET /user/emails",
      {},
      { renamed: ["users", "listEmailsForAuthenticatedUser"] }
    ],
    listEmailsForAuthenticatedUser: ["GET /user/emails"],
    listFollowedByAuthenticated: [
      "GET /user/following",
      {},
      { renamed: ["users", "listFollowedByAuthenticatedUser"] }
    ],
    listFollowedByAuthenticatedUser: ["GET /user/following"],
    listFollowersForAuthenticatedUser: ["GET /user/followers"],
    listFollowersForUser: ["GET /users/{username}/followers"],
    listFollowingForUser: ["GET /users/{username}/following"],
    listGpgKeysForAuthenticated: [
      "GET /user/gpg_keys",
      {},
      { renamed: ["users", "listGpgKeysForAuthenticatedUser"] }
    ],
    listGpgKeysForAuthenticatedUser: ["GET /user/gpg_keys"],
    listGpgKeysForUser: ["GET /users/{username}/gpg_keys"],
    listPublicEmailsForAuthenticated: [
      "GET /user/public_emails",
      {},
      { renamed: ["users", "listPublicEmailsForAuthenticatedUser"] }
    ],
    listPublicEmailsForAuthenticatedUser: ["GET /user/public_emails"],
    listPublicKeysForUser: ["GET /users/{username}/keys"],
    listPublicSshKeysForAuthenticated: [
      "GET /user/keys",
      {},
      { renamed: ["users", "listPublicSshKeysForAuthenticatedUser"] }
    ],
    listPublicSshKeysForAuthenticatedUser: ["GET /user/keys"],
    listSocialAccountsForAuthenticatedUser: ["GET /user/social_accounts"],
    listSocialAccountsForUser: ["GET /users/{username}/social_accounts"],
    listSshSigningKeysForAuthenticatedUser: ["GET /user/ssh_signing_keys"],
    listSshSigningKeysForUser: ["GET /users/{username}/ssh_signing_keys"],
    setPrimaryEmailVisibilityForAuthenticated: [
      "PATCH /user/email/visibility",
      {},
      { renamed: ["users", "setPrimaryEmailVisibilityForAuthenticatedUser"] }
    ],
    setPrimaryEmailVisibilityForAuthenticatedUser: [
      "PATCH /user/email/visibility"
    ],
    unblock: ["DELETE /user/blocks/{username}"],
    unfollow: ["DELETE /user/following/{username}"],
    updateAuthenticated: ["PATCH /user"]
  }
};
var endpoints_default = Endpoints;

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/endpoints-to-methods.js
var endpointMethodsMap = /* @__PURE__ */ new Map();
for (const [scope, endpoints] of Object.entries(endpoints_default)) {
  for (const [methodName, endpoint2] of Object.entries(endpoints)) {
    const [route, defaults, decorations] = endpoint2;
    const [method, url] = route.split(/ /);
    const endpointDefaults = Object.assign(
      {
        method,
        url
      },
      defaults
    );
    if (!endpointMethodsMap.has(scope)) {
      endpointMethodsMap.set(scope, /* @__PURE__ */ new Map());
    }
    endpointMethodsMap.get(scope).set(methodName, {
      scope,
      methodName,
      endpointDefaults,
      decorations
    });
  }
}
var handler = {
  has({ scope }, methodName) {
    return endpointMethodsMap.get(scope).has(methodName);
  },
  getOwnPropertyDescriptor(target, methodName) {
    return {
      value: this.get(target, methodName),
      // ensures method is in the cache
      configurable: true,
      writable: true,
      enumerable: true
    };
  },
  defineProperty(target, methodName, descriptor) {
    Object.defineProperty(target.cache, methodName, descriptor);
    return true;
  },
  deleteProperty(target, methodName) {
    delete target.cache[methodName];
    return true;
  },
  ownKeys({ scope }) {
    return [...endpointMethodsMap.get(scope).keys()];
  },
  set(target, methodName, value) {
    return target.cache[methodName] = value;
  },
  get({ octokit, scope, cache }, methodName) {
    if (cache[methodName]) {
      return cache[methodName];
    }
    const method = endpointMethodsMap.get(scope).get(methodName);
    if (!method) {
      return void 0;
    }
    const { endpointDefaults, decorations } = method;
    if (decorations) {
      cache[methodName] = decorate(
        octokit,
        scope,
        methodName,
        endpointDefaults,
        decorations
      );
    } else {
      cache[methodName] = octokit.request.defaults(endpointDefaults);
    }
    return cache[methodName];
  }
};
function endpointsToMethods(octokit) {
  const newMethods = {};
  for (const scope of endpointMethodsMap.keys()) {
    newMethods[scope] = new Proxy({ octokit, scope, cache: {} }, handler);
  }
  return newMethods;
}
__name(endpointsToMethods, "endpointsToMethods");
function decorate(octokit, scope, methodName, defaults, decorations) {
  const requestWithDefaults = octokit.request.defaults(defaults);
  function withDecorations(...args) {
    let options = requestWithDefaults.endpoint.merge(...args);
    if (decorations.mapToData) {
      options = Object.assign({}, options, {
        data: options[decorations.mapToData],
        [decorations.mapToData]: void 0
      });
      return requestWithDefaults(options);
    }
    if (decorations.renamed) {
      const [newScope, newMethodName] = decorations.renamed;
      octokit.log.warn(
        `octokit.${scope}.${methodName}() has been renamed to octokit.${newScope}.${newMethodName}()`
      );
    }
    if (decorations.deprecated) {
      octokit.log.warn(decorations.deprecated);
    }
    if (decorations.renamedParameters) {
      const options2 = requestWithDefaults.endpoint.merge(...args);
      for (const [name, alias] of Object.entries(
        decorations.renamedParameters
      )) {
        if (name in options2) {
          octokit.log.warn(
            `"${name}" parameter is deprecated for "octokit.${scope}.${methodName}()". Use "${alias}" instead`
          );
          if (!(alias in options2)) {
            options2[alias] = options2[name];
          }
          delete options2[name];
        }
      }
      return requestWithDefaults(options2);
    }
    return requestWithDefaults(...args);
  }
  __name(withDecorations, "withDecorations");
  return Object.assign(withDecorations, requestWithDefaults);
}
__name(decorate, "decorate");

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/index.js
function restEndpointMethods(octokit) {
  const api = endpointsToMethods(octokit);
  return {
    rest: api
  };
}
__name(restEndpointMethods, "restEndpointMethods");
restEndpointMethods.VERSION = VERSION7;
function legacyRestEndpointMethods(octokit) {
  const api = endpointsToMethods(octokit);
  return {
    ...api,
    rest: api
  };
}
__name(legacyRestEndpointMethods, "legacyRestEndpointMethods");
legacyRestEndpointMethods.VERSION = VERSION7;

// node_modules/@octokit/rest/dist-src/version.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var VERSION8 = "21.1.1";

// node_modules/@octokit/rest/dist-src/index.js
var Octokit2 = Octokit.plugin(requestLog, legacyRestEndpointMethods, paginateRest).defaults(
  {
    userAgent: `octokit-rest.js/${VERSION8}`
  }
);

// src/config/repos.json
var repos_default = {
  repositories: [
    {
      name: "pcl-labs",
      owner: "paulchrisluke",
      type: "personal",
      enabled: true,
      description: "Main portfolio and blog site",
      tokenKey: "GITHUB_TOKEN_PAULCHRISLUKE"
    },
    {
      name: "preact-cloudflare-intake-chatbot",
      owner: "Blawby",
      type: "organization",
      enabled: true,
      description: "Legal intake chatbot using Cloudflare Workers AI",
      tokenKey: "GITHUB_TOKEN_BLAWBY"
    }
  ],
  settings: {
    lookbackHours: 24,
    maxCommitsPerRepo: 50,
    maxPRsPerRepo: 20,
    includeIssues: true,
    includeReleases: true,
    filterPatterns: {
      includeBranches: ["main", "staging", "develop"],
      excludePatterns: ["^dependabot/", "^renovate/", "^chore/", "^docs/"]
    }
  }
};

// src/services/github.ts
var GitHubService = class {
  config;
  tokens;
  constructor(tokens) {
    this.tokens = tokens;
    this.config = repos_default;
  }
  getOctokitForRepo(repo) {
    const token = this.tokens[repo.tokenKey];
    if (!token) {
      throw new Error(`No token found for repository ${repo.owner}/${repo.name} (key: ${repo.tokenKey})`);
    }
    return new Octokit2({
      auth: token
    });
  }
  async gatherDailyActivity() {
    const activities = [];
    const lookbackDate = /* @__PURE__ */ new Date();
    lookbackDate.setHours(lookbackDate.getHours() - this.config.settings.lookbackHours);
    for (const repo of this.config.repositories) {
      if (!repo.enabled)
        continue;
      try {
        const activity = await this.getRepositoryActivity(repo, lookbackDate);
        activities.push(activity);
      } catch (error) {
        console.error(`Error gathering activity for ${repo.owner}/${repo.name}:`, error);
      }
    }
    return activities;
  }
  async getRepositoryActivity(repo, since) {
    const [commits, pullRequests, issues, releases] = await Promise.all([
      this.getCommits(repo, since),
      this.getPullRequests(repo, since),
      this.getIssues(repo, since),
      this.getReleases(repo, since)
    ]);
    const topContributors = this.getTopContributors(commits);
    return {
      repository: repo.name,
      owner: repo.owner,
      commits,
      pullRequests,
      issues,
      releases,
      summary: {
        totalCommits: commits.length,
        totalPRs: pullRequests.length,
        totalIssues: issues.length,
        totalReleases: releases.length,
        topContributors
      }
    };
  }
  async getCommits(repo, since) {
    const octokit = this.getOctokitForRepo(repo);
    const { data: commits } = await octokit.repos.listCommits({
      owner: repo.owner,
      repo: repo.name,
      since: since.toISOString(),
      per_page: this.config.settings.maxCommitsPerRepo
    });
    return commits.filter((commit) => this.shouldIncludeCommit(commit.commit.message)).map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name || commit.author?.login || "Unknown",
      date: commit.commit.author?.date || "",
      url: commit.html_url,
      filesChanged: 0,
      // Would need additional API call to get this
      additions: 0,
      // Would need additional API call to get this
      deletions: 0
      // Would need additional API call to get this
    }));
  }
  async getPullRequests(repo, since) {
    const octokit = this.getOctokitForRepo(repo);
    const { data: prs } = await octokit.pulls.list({
      owner: repo.owner,
      repo: repo.name,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: this.config.settings.maxPRsPerRepo
    });
    return prs.filter((pr) => new Date(pr.updated_at) >= since).map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      author: pr.user?.login || "Unknown",
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      url: pr.html_url,
      additions: pr.additions ?? 0,
      deletions: pr.deletions ?? 0,
      changedFiles: pr.changed_files ?? 0
    }));
  }
  async getIssues(repo, since) {
    if (!this.config.settings.includeIssues)
      return [];
    const octokit = this.getOctokitForRepo(repo);
    const { data: issues } = await octokit.issues.listForRepo({
      owner: repo.owner,
      repo: repo.name,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: 50
    });
    return issues.filter((issue) => !issue.pull_request && new Date(issue.updated_at) >= since).map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author: issue.user?.login || "Unknown",
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      url: issue.html_url,
      labels: issue.labels.map((label) => typeof label === "string" ? label : label.name || "")
    }));
  }
  async getReleases(repo, since) {
    if (!this.config.settings.includeReleases)
      return [];
    const octokit = this.getOctokitForRepo(repo);
    const { data: releases } = await octokit.repos.listReleases({
      owner: repo.owner,
      repo: repo.name,
      per_page: 10
    });
    return releases.filter((release) => release.published_at && new Date(release.published_at) >= since).map((release) => ({
      id: release.id,
      name: release.name || release.tag_name,
      tagName: release.tag_name,
      publishedAt: release.published_at || "",
      url: release.html_url,
      description: release.body || ""
    }));
  }
  shouldIncludeCommit(message) {
    const excludePatterns = this.config.settings.filterPatterns.excludePatterns;
    return !excludePatterns.some((pattern) => {
      try {
        return new RegExp(pattern).test(message);
      } catch (error) {
        console.error(`Invalid regex pattern: ${pattern}`, error);
        return false;
      }
    });
  }
  getTopContributors(commits) {
    const contributorCounts = commits.reduce((acc, commit) => {
      acc[commit.author] = (acc[commit.author] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(contributorCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([author]) => author);
  }
};
__name(GitHubService, "GitHubService");

// src/routes/github.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};
function createErrorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
__name(createErrorResponse, "createErrorResponse");
function createSuccessResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
__name(createSuccessResponse, "createSuccessResponse");
async function handleGitHubRequest(request2, env) {
  try {
    if (request2.method === "OPTIONS") {
      const requestHeaders = request2.headers.get("Access-Control-Request-Headers");
      const requestMethod = request2.headers.get("Access-Control-Request-Method");
      const supportedMethods = ["GET", "POST"];
      const dynamicCorsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Max-Age": "86400"
      };
      if (requestMethod && supportedMethods.includes(requestMethod.toUpperCase())) {
        dynamicCorsHeaders["Access-Control-Allow-Methods"] = requestMethod.toUpperCase();
      } else {
        dynamicCorsHeaders["Access-Control-Allow-Methods"] = "GET, POST";
      }
      if (requestHeaders) {
        dynamicCorsHeaders["Access-Control-Allow-Headers"] = requestHeaders;
      } else {
        dynamicCorsHeaders["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
      }
      return new Response(null, {
        status: 204,
        headers: dynamicCorsHeaders
      });
    }
    const url = new URL(request2.url);
    let path = url.pathname;
    if (path.endsWith("/") && path !== "/") {
      path = path.slice(0, -1);
    }
    const tokens = {
      GITHUB_TOKEN_PAULCHRISLUKE: env.GITHUB_TOKEN_PAULCHRISLUKE,
      GITHUB_TOKEN_BLAWBY: env.GITHUB_TOKEN_BLAWBY
    };
    const missingTokens = Object.entries(tokens).filter(([key, token]) => !token).map(([key]) => key);
    if (missingTokens.length > 0) {
      console.error(`Missing GitHub tokens: ${missingTokens.join(", ")}`);
      return createErrorResponse(500, "Internal server error");
    }
    const githubService = new GitHubService(tokens);
    switch (path) {
      case "/api/github/activity": {
        if (request2.method !== "GET") {
          return createErrorResponse(405, "Method Not Allowed");
        }
        return await handleActivity(githubService);
      }
      default: {
        return createErrorResponse(404, "Not found");
      }
    }
  } catch (error) {
    console.error("GitHub route error:", error);
    return createErrorResponse(500, "Internal server error");
  }
}
__name(handleGitHubRequest, "handleGitHubRequest");
async function handleActivity(githubService) {
  try {
    const activity = await githubService.gatherDailyActivity();
    return createSuccessResponse(activity);
  } catch (error) {
    console.error("Error gathering activity:", error);
    return createErrorResponse(500, "Error gathering activity");
  }
}
__name(handleActivity, "handleActivity");

// src/index.ts
var src_default = {
  async fetch(request2, env, ctx) {
    const url = new URL(request2.url);
    if (url.pathname === "/health") {
      const healthData = {
        status: "healthy",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        service: "Twitch Clip Recap Pipeline",
        version: "1.0.0",
        uptime: "24/7",
        environment: "production"
      };
      return new Response(JSON.stringify(healthData, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/validate") {
      try {
        console.log("\u{1F50D} Validating Twitch credentials...");
        const formData = new URLSearchParams();
        formData.append("client_id", env.TWITCH_CLIENT_ID);
        formData.append("client_secret", env.TWITCH_CLIENT_SECRET);
        formData.append("grant_type", "client_credentials");
        const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formData.toString()
        });
        console.log("Token response status:", tokenResponse.status);
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error("Token response error:", errorText);
          return new Response(JSON.stringify({
            success: false,
            error: `Token request failed: ${tokenResponse.status} - ${errorText}`,
            twitch_client_id_present: !!env.TWITCH_CLIENT_ID,
            twitch_client_secret_present: !!env.TWITCH_CLIENT_SECRET
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        const tokenData = await tokenResponse.json();
        const validateResponse = await fetch("https://id.twitch.tv/oauth2/validate", {
          headers: {
            "Authorization": `Bearer ${tokenData.access_token}`
          }
        });
        if (!validateResponse.ok) {
          const errorText = await validateResponse.text();
          return new Response(JSON.stringify({
            success: false,
            error: `Token validation failed: ${validateResponse.status} - ${errorText}`,
            token_obtained: true,
            token_expires_in: tokenData.expires_in
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        const validateData2 = await validateResponse.json();
        const loginToTest = env.TWITCH_BROADCASTER_LOGIN || "paulchrisluke";
        const userResponse = await fetch(
          `https://api.twitch.tv/helix/users?login=${loginToTest}`,
          {
            headers: {
              "Client-ID": env.TWITCH_CLIENT_ID,
              "Authorization": `Bearer ${tokenData.access_token}`
            }
          }
        );
        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          return new Response(JSON.stringify({
            success: false,
            error: `API call failed: ${userResponse.status} - ${errorText}`,
            token_obtained: true,
            token_validated: true,
            token_info: validateData2
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        const userData = await userResponse.json();
        return new Response(JSON.stringify({
          success: true,
          message: "Twitch credentials are valid!",
          token_obtained: true,
          token_validated: true,
          token_info: validateData2,
          user_found: userData.data?.length > 0,
          broadcaster_id: userData.data?.[0]?.id || null,
          username: userData.data?.[0]?.login || null
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (url.pathname === "/validate-github") {
      try {
        console.log("\u{1F50D} Validating GitHub credentials...");
        const tokens = {
          GITHUB_TOKEN: env.GITHUB_TOKEN,
          GITHUB_TOKEN_PAULCHRISLUKE: env.GITHUB_TOKEN_PAULCHRISLUKE,
          GITHUB_TOKEN_BLAWBY: env.GITHUB_TOKEN_BLAWBY
        };
        const availableTokens = Object.entries(tokens).filter(([key, token]) => !!token).map(([key]) => key);
        if (availableTokens.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: "No GitHub tokens found",
            tokens_present: false
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        console.log(`\u2705 Found ${availableTokens.length} GitHub tokens: ${availableTokens.join(", ")}`);
        const testToken = Object.values(tokens).find((token) => !!token);
        if (!testToken) {
          return new Response(JSON.stringify({
            success: false,
            error: "No valid GitHub token found"
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        try {
          const userResponse = await fetch("https://api.github.com/user", {
            headers: {
              "Authorization": `Bearer ${testToken}`,
              "Accept": "application/vnd.github.v3+json",
              "User-Agent": "clip-recap-pipeline/1.0.0"
            }
          });
          if (!userResponse.ok) {
            const errorText = await userResponse.text();
            return new Response(JSON.stringify({
              success: false,
              error: `GitHub API access failed: ${userResponse.status} - ${errorText}`,
              tokens_present: true,
              available_tokens: availableTokens
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
          }
          const userData = await userResponse.json();
          console.log("\u2705 GitHub API access successful");
          let repoAccess = null;
          if (env.CONTENT_REPO_OWNER && env.CONTENT_REPO_NAME) {
            try {
              const repoResponse = await fetch(
                `https://api.github.com/repos/${env.CONTENT_REPO_OWNER}/${env.CONTENT_REPO_NAME}`,
                {
                  headers: {
                    "Authorization": `Bearer ${testToken}`,
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "clip-recap-pipeline/1.0.0"
                  }
                }
              );
              if (repoResponse.ok) {
                const repoData = await repoResponse.json();
                repoAccess = {
                  name: repoData.name,
                  full_name: repoData.full_name,
                  private: repoData.private,
                  permissions: repoData.permissions
                };
                console.log("\u2705 Repository access successful");
              } else {
                console.log("\u26A0\uFE0F Repository access failed (this might be expected)");
              }
            } catch (error) {
              console.log("\u26A0\uFE0F Repository access test failed (this might be expected)");
            }
          }
          return new Response(JSON.stringify({
            success: true,
            message: "GitHub credentials are valid!",
            tokens_present: true,
            available_tokens: availableTokens,
            api_accessible: true,
            user_info: {
              login: userData.login,
              id: userData.id,
              type: userData.type
            },
            repository_accessible: !!repoAccess,
            repo_info: repoAccess
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: `GitHub API call failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            tokens_present: true,
            available_tokens: availableTokens
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (url.pathname === "/clips") {
      try {
        const { TwitchService: TwitchService2 } = await Promise.resolve().then(() => (init_twitch(), twitch_exports));
        const twitchService = new TwitchService2(env);
        switch (request2.method) {
          case "GET": {
            console.log("\u{1F50D} Fetching recent Twitch clips...");
            const clips = await twitchService.getRecentClips();
            return new Response(JSON.stringify({
              success: true,
              message: `Found ${clips.length} clips from the last 24 hours`,
              clips: clips.map((clip) => ({
                id: clip.id,
                title: clip.title,
                url: clip.url,
                embed_url: clip.embed_url,
                thumbnail_url: clip.thumbnail_url,
                duration: clip.duration,
                view_count: clip.view_count,
                created_at: clip.created_at,
                broadcaster_name: clip.broadcaster_name,
                creator_name: clip.creator_name
              }))
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          case "POST": {
            console.log("\u{1F4BE} Storing clips data...");
            const contentLength = request2.headers.get("content-length");
            const MAX_REQUEST_SIZE = 10 * 1024 * 1024;
            if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
              return new Response(JSON.stringify({
                success: false,
                error: `Request body too large. Maximum size is ${MAX_REQUEST_SIZE / (1024 * 1024)}MB.`
              }), {
                status: 413,
                headers: { "Content-Type": "application/json" }
              });
            }
            const body = await request2.json();
            const clipsToStore = body.clips || [];
            const MAX_CLIPS_PER_REQUEST = 100;
            if (clipsToStore.length > MAX_CLIPS_PER_REQUEST) {
              return new Response(JSON.stringify({
                success: false,
                error: `Too many clips. Maximum ${MAX_CLIPS_PER_REQUEST} clips per request.`
              }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
            }
            if (clipsToStore.length === 0) {
              return new Response(JSON.stringify({
                success: false,
                error: "No clips provided to store"
              }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
            }
            const validatedClips = [];
            for (let i = 0; i < clipsToStore.length; i++) {
              const clip = clipsToStore[i];
              if (!clip || typeof clip !== "object" || Array.isArray(clip)) {
                return new Response(JSON.stringify({
                  success: false,
                  error: `Clip at index ${i} must be a valid object`
                }), {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                });
              }
              const clipValidation = validateClipObject(clip);
              if (!clipValidation.isValid) {
                return new Response(JSON.stringify({
                  success: false,
                  error: `Invalid clip at index ${i}: ${clipValidation.error}`
                }), {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                });
              }
              if (validatedClips.some((validatedClip) => validatedClip.id === clip.id)) {
                return new Response(JSON.stringify({
                  success: false,
                  error: `Duplicate clip ID found: ${clip.id}`
                }), {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                });
              }
              validatedClips.push(clipValidation.sanitizedData);
            }
            const storedClips = [];
            for (const clip of validatedClips) {
              const key = `clips/${clip.id}.json`;
              await env.R2_BUCKET.put(key, JSON.stringify(clip), {
                httpMetadata: {
                  contentType: "application/json"
                }
              });
              storedClips.push(clip.id);
            }
            return new Response(JSON.stringify({
              success: true,
              message: `Stored ${storedClips.length} clips to R2`,
              stored_clips: storedClips,
              validation_summary: {
                total_received: clipsToStore.length,
                total_stored: storedClips.length,
                sanitized: validatedClips.some((clip) => Object.keys(clip).length > 1)
              }
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          case "PUT": {
            console.log("\u{1F504} Updating clip data...");
            const updateBody = await request2.json();
            const { clipId, data } = updateBody;
            if (!clipId || !data) {
              return new Response(JSON.stringify({
                success: false,
                error: "clipId and data are required"
              }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
            }
            const clipIdValidation = validateClipId(clipId);
            if (!clipIdValidation.isValid) {
              return new Response(JSON.stringify({
                success: false,
                error: `Invalid clipId: ${clipIdValidation.error}`
              }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
            }
            const dataValidation = validateClipData(data);
            if (!dataValidation.isValid) {
              return new Response(JSON.stringify({
                success: false,
                error: dataValidation.error
              }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
            }
            const sanitizedData = dataValidation.sanitizedData;
            const updateKey = `clips/${clipId}.json`;
            await env.R2_BUCKET.put(updateKey, JSON.stringify(sanitizedData), {
              httpMetadata: {
                contentType: "application/json"
              }
            });
            return new Response(JSON.stringify({
              success: true,
              message: `Updated clip ${clipId}`,
              clip_id: clipId,
              updated_fields: Object.keys(sanitizedData)
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          default:
            return new Response(JSON.stringify({
              success: false,
              error: "Method not allowed"
            }), {
              status: 405,
              headers: { "Content-Type": "application/json" }
            });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (url.pathname.startsWith("/clips/stored")) {
      try {
        const clipId = url.searchParams.get("id");
        if (clipId) {
          const validation = validateClipId(clipId);
          if (!validation.isValid) {
            return new Response(JSON.stringify({
              success: false,
              error: validation.error
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
          }
          const clipObject = await env.R2_BUCKET.get(`clips/${clipId}.json`);
          if (!clipObject) {
            return new Response(JSON.stringify({
              success: false,
              error: "Clip not found"
            }), {
              status: 404,
              headers: { "Content-Type": "application/json" }
            });
          }
          const clipData = await clipObject.json();
          return new Response(JSON.stringify({
            success: true,
            clip: clipData
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } else {
          console.log("\u{1F4D6} Listing stored clips...");
          const list = await env.R2_BUCKET.list({ prefix: "clips/" });
          const clips = [];
          const MAX_CLIPS = 100;
          const objectsToFetch = list.objects.slice(0, MAX_CLIPS);
          const batchSize = 10;
          for (let i = 0; i < objectsToFetch.length; i += batchSize) {
            const batch = objectsToFetch.slice(i, i + batchSize);
            const batchPromises = batch.map(async (object) => {
              const clipObject = await env.R2_BUCKET.get(object.key);
              return clipObject ? clipObject.json() : null;
            });
            const batchResults = await Promise.all(batchPromises);
            clips.push(...batchResults.filter((clip) => clip !== null));
          }
          const hasMore = list.objects.length > MAX_CLIPS;
          return new Response(JSON.stringify({
            success: true,
            message: `Found ${clips.length} stored clips`,
            clips,
            has_more: hasMore,
            total_objects: list.objects.length
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (url.pathname.startsWith("/api/github/")) {
      return handleGitHubRequest(request2, env);
    }
    if (url.pathname === "/webhook/github") {
      return handleWebhook(request2, env, ctx);
    }
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Twitch Clip Recap Pipeline - API Status</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .header {
            text-align: center;
            margin-bottom: 3rem;
            color: white;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }
        
        .status-card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease;
        }
        
        .status-card:hover {
            transform: translateY(-2px);
        }
        
        .status-card h3 {
            color: #667eea;
            margin-bottom: 1rem;
            font-size: 1.3rem;
        }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }
        
        .status-online {
            background: #10b981;
        }
        
        .status-offline {
            background: #ef4444;
        }
        
        .endpoints {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .endpoints h2 {
            color: #667eea;
            margin-bottom: 1.5rem;
            font-size: 1.8rem;
        }
        
        .endpoint {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 1rem;
            overflow: hidden;
        }
        
        .endpoint-header {
            background: #f9fafb;
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .method {
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.875rem;
        }
        
        .method.get { background: #dbeafe; color: #1d4ed8; }
        .method.post { background: #dcfce7; color: #15803d; }
        .method.put { background: #fef3c7; color: #d97706; }
        
        .endpoint-path {
            font-family: 'Monaco', 'Menlo', monospace;
            font-weight: 600;
        }
        
        .endpoint-description {
            padding: 1rem;
            color: #6b7280;
        }
        
        .footer {
            text-align: center;
            margin-top: 3rem;
            color: white;
            opacity: 0.8;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 1.5rem;
            text-align: center;
            color: white;
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        
        .stat-label {
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>\u{1F3AC} Twitch Clip Recap Pipeline</h1>
            <p>Automated daily blog post generation from Twitch clips</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">7</div>
                <div class="stat-label">API Endpoints</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">24/7</div>
                <div class="stat-label">Uptime</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">AI</div>
                <div class="stat-label">Powered</div>
            </div>
        </div>
        
        <div class="status-grid">
            <div class="status-card">
                <h3><span class="status-indicator status-online"></span>Twitch Integration</h3>
                <p>Connected to Twitch API for clip fetching and processing</p>
            </div>
            <div class="status-card">
                <h3><span class="status-indicator status-online"></span>GitHub Integration</h3>
                <p>Connected to GitHub for content repository management</p>
            </div>
            <div class="status-card">
                <h3><span class="status-indicator status-online"></span>AI Processing</h3>
                <p>Workers AI for transcription and content generation</p>
            </div>
            <div class="status-card">
                <h3><span class="status-indicator status-online"></span>Cloud Storage</h3>
                <p>R2 storage for clips and transcripts</p>
            </div>
        </div>
        
        <div class="endpoints">
            <h2>\u{1F4E1} API Endpoints</h2>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/health</span>
                </div>
                <div class="endpoint-description">
                    Health check endpoint to verify service status
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/validate</span>
                </div>
                <div class="endpoint-description">
                    Validate Twitch API credentials and connection
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/validate-github</span>
                </div>
                <div class="endpoint-description">
                    Validate GitHub API credentials and repository access
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/clips</span>
                </div>
                <div class="endpoint-description">
                    Fetch recent Twitch clips from the last 24 hours
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method post">POST</span>
                    <span class="endpoint-path">/clips</span>
                </div>
                <div class="endpoint-description">
                    Store clips data to R2 storage
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/clips/stored</span>
                </div>
                <div class="endpoint-description">
                    List all stored clips from R2 storage
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method post">POST</span>
                    <span class="endpoint-path">/webhook/github</span>
                </div>
                <div class="endpoint-description">
                    GitHub webhook handler for repository events
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Built with Cloudflare Workers \u2022 AI-Powered Content Generation</p>
        </div>
    </div>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html" }
    });
  },
  async scheduled(event, env, ctx) {
    await handleScheduled(event, env, ctx);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var drainBody = /* @__PURE__ */ __name(async (request2, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request2, env);
  } finally {
    try {
      if (request2.body !== null && !request2.bodyUsed) {
        const reader = request2.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request2, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request2, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-TgVJqC/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request2, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request2, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request2, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request2, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-TgVJqC/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request2, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request2, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request2, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request2, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request2, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request2);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request2) {
      return __facade_invoke__(
        request2,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
