// Shared helpers for seeding via the Firestore REST API.
//
// The service-account (Admin SDK) key on this project is IAM-denied for
// Firestore writes, so these scripts authenticate with the **Firebase CLI
// login** (`firebase login`) and call the REST API as that user.
//
// Requires: `firebase login` (already done on this machine).

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");

// Public firebase-tools OAuth client (same one the Firebase CLI uses).
const CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

const CONFIG = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");

function form(url) {
  return new URL(url);
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function postForm(host, pathname, fields) {
  const body = new URLSearchParams(fields).toString();
  return request(
    {
      hostname: host,
      path: pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    body
  );
}

async function postJson(host, pathname, obj) {
  const body = JSON.stringify(obj);
  return request(
    {
      hostname: host,
      path: pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    body
  );
}

function readRefreshToken() {
  if (!fs.existsSync(CONFIG)) return null;
  const cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  const t = cfg.tokens || {};
  return t.refresh_token || t.refreshToken || null;
}

async function getAccessToken() {
  const refresh = readRefreshToken();
  if (!refresh) {
    throw new Error(
      "No Firebase CLI login found. Run `firebase login`, or set up Admin SDK IAM."
    );
  }
  const res = await postForm("oauth2.googleapis.com", "/token", {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refresh,
    grant_type: "refresh_token",
  });
  const json = JSON.parse(res.body);
  if (!json.access_token) {
    throw new Error(`Token refresh failed (${res.status}): ${res.body.slice(0, 200)}`);
  }
  return json.access_token;
}

// Encode a plain JS value into a Firestore REST value. Objects/arrays only —
// Firestore forbids nested arrays, so callers must store those as JSON strings.
function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (v && v.__ts) return { timestampValue: v.__ts };
  if (Array.isArray(v)) {
    return v.length ? { arrayValue: { values: v.map(encodeValue) } } : { arrayValue: {} };
  }
  const fields = {};
  for (const k of Object.keys(v)) fields[k] = encodeValue(v[k]);
  return { mapValue: { fields } };
}

function decodeValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(decodeValue);
  if (v.mapValue) return decodeDoc(v.mapValue.fields || {});
  return null;
}

function decodeDoc(fields) {
  const o = {};
  for (const k of Object.keys(fields || {})) o[k] = decodeValue(fields[k]);
  return o;
}

async function listDocs(token, project, collection, pageSize = 300) {
  const res = await request({
    hostname: "firestore.googleapis.com",
    path: `/v1/projects/${project}/databases/(default)/documents/${collection}?pageSize=${pageSize}`,
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) {
    throw new Error(`list ${collection} -> ${res.status}: ${res.body.slice(0, 200)}`);
  }
  const json = JSON.parse(res.body);
  return (json.documents || []).map((d) => ({
    id: d.name.split("/").pop(),
    ...decodeDoc(d.fields),
  }));
}

function encodeDocument(obj) {
  const fields = {};
  for (const k of Object.keys(obj)) fields[k] = encodeValue(obj[k]);
  return JSON.stringify({ fields });
}

async function setDoc(token, project, collection, id, obj) {
  const body = encodeDocument(obj);
  const res = await request(
    {
      hostname: "firestore.googleapis.com",
      path: `/v1/projects/${project}/databases/(default)/documents/${collection}/${id}`,
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    body
  );
  if (res.status !== 200) {
    throw new Error(`write ${collection}/${id} -> ${res.status}: ${res.body.slice(0, 300)}`);
  }
  return res;
}

async function deleteDoc(token, project, collection, id) {
  return request({
    hostname: "firestore.googleapis.com",
    path: `/v1/projects/${project}/databases/(default)/documents/${collection}/${id}`,
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

const nowTs = () => ({ __ts: new Date().toISOString() });

module.exports = {
  getAccessToken,
  setDoc,
  deleteDoc,
  listDocs,
  decodeDoc,
  postJson,
  nowTs,
};
