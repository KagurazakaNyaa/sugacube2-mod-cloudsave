const CLOUDSAVE_EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const CLOUDSAVE_SIGNED_HEADERS = "host;x-amz-content-sha256;x-amz-date";

function formatDateYYYYMMDD(date) {
  const d = new Date(date);
  const month = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  const year = d.getUTCFullYear();

  return `${year}${month}${day}`;
}

function formatAmzDate(date) {
  return new Date(date).toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function stringToUint8Array(value) {
  return new TextEncoder().encode(value);
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function encodeS3PathSegment(segment) {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

async function digestMessage(message) {
  const hashBuffer = await window.crypto.subtle.digest(
    "SHA-256",
    stringToUint8Array(message)
  );
  return toHex(hashBuffer);
}

async function hmacSha256(key, message) {
  const keyData =
    typeof key === "string" ? stringToUint8Array(key) : new Uint8Array(key);
  const messageData =
    typeof message === "string"
      ? stringToUint8Array(message)
      : new Uint8Array(message);

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return new Uint8Array(
    await window.crypto.subtle.sign("HMAC", cryptoKey, messageData)
  );
}

function getCloudsaveSettings() {
  return {
    s3Protocol: V.options["cloudsave_s3_protocol"] || "https",
    s3Endpoint: V.options["cloudsave_s3_endpoint"] || "",
    s3Region: V.options["cloudsave_s3_region"] || "",
    s3Bucket: V.options["cloudsave_s3_bucket"] || "",
    s3AccessKey: V.options["cloudsave_s3_accesskey"] || "",
    s3SecretKey: V.options["cloudsave_s3_secretkey"] || "",
    s3ObjectKey: V.options["cloudsave_s3_objectkey"] || "",
    s3PathStyle: Boolean(V.options["cloudsave_s3_pathstyle"]),
  };
}

function sanitizeEndpoint(endpoint) {
  const sanitizedEndpoint = endpoint
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  if (!sanitizedEndpoint) {
    return "";
  }

  let parsedEndpoint;

  try {
    parsedEndpoint = new URL(`https://${sanitizedEndpoint}`);
  } catch (error) {
    throw new Error("Endpoint 格式无效，请只填写主机名或主机名:端口");
  }

  if (
    parsedEndpoint.username ||
    parsedEndpoint.password ||
    parsedEndpoint.pathname !== "/" ||
    parsedEndpoint.search ||
    parsedEndpoint.hash
  ) {
    throw new Error("Endpoint 不能包含路径、查询参数或片段");
  }

  return parsedEndpoint.host;
}

function buildS3Target(settings) {
  const endpoint = sanitizeEndpoint(settings.s3Endpoint);
  const bucket = settings.s3Bucket.trim();
  const objectPath = settings.s3ObjectKey
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(encodeS3PathSegment)
    .join("/");
  const canonicalObjectPath = `/${objectPath}`;

  if (settings.s3PathStyle) {
    const host = endpoint;
    const canonicalUri = `/${encodeS3PathSegment(bucket)}${canonicalObjectPath}`;

    return {
      host,
      canonicalUri,
      requestUrl: `${settings.s3Protocol}://${host}${canonicalUri}`,
    };
  }

  const host = `${bucket}.${endpoint}`;

  return {
    host,
    canonicalUri: canonicalObjectPath,
    requestUrl: `${settings.s3Protocol}://${host}${canonicalObjectPath}`,
  };
}

function validateCloudsaveSettings(settings) {
  const requiredFields = [
    ["S3 协议", settings.s3Protocol],
    ["Endpoint", settings.s3Endpoint],
    ["地区", settings.s3Region],
    ["存储桶", settings.s3Bucket],
    ["Access Key", settings.s3AccessKey],
    ["Secret Key", settings.s3SecretKey],
    ["对象名", settings.s3ObjectKey],
  ];

  const missingFields = requiredFields
    .filter(([, value]) => !String(value).trim())
    .map(([label]) => label);

  if (missingFields.length > 0) {
    throw new Error(`缺少云存档配置：${missingFields.join("、")}`);
  }
}

async function createAuthorizationHeaders(method, settings, payloadHash) {
  const timestamp = new Date();
  const amzDate = formatAmzDate(timestamp);
  const signDate = formatDateYYYYMMDD(timestamp);
  const scope = `${signDate}/${settings.s3Region}/s3/aws4_request`;
  const { host, canonicalUri } = buildS3Target(settings);
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join("\n");
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    `${canonicalHeaders}\n`,
    CLOUDSAVE_SIGNED_HEADERS,
    payloadHash,
  ].join("\n");
  const canonicalRequestHash = await digestMessage(canonicalRequest);
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    canonicalRequestHash,
  ].join("\n");

  const dateKey = await hmacSha256(`AWS4${settings.s3SecretKey}`, signDate);
  const dateRegionKey = await hmacSha256(dateKey, settings.s3Region);
  const dateRegionServiceKey = await hmacSha256(dateRegionKey, "s3");
  const signingKey = await hmacSha256(dateRegionServiceKey, "aws4_request");
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${settings.s3AccessKey}/${scope},SignedHeaders=${CLOUDSAVE_SIGNED_HEADERS},Signature=${signature}`,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
}

async function buildSignedRequest(method, settings, payload = "") {
  validateCloudsaveSettings(settings);

  const { requestUrl } = buildS3Target(settings);
  const payloadHash =
    payload.length > 0 ? await digestMessage(payload) : CLOUDSAVE_EMPTY_SHA256;
  const headers = await createAuthorizationHeaders(method, settings, payloadHash);

  return {
    requestUrl,
    payloadHash,
    headers,
  };
}

async function readErrorResponse(response) {
  const responseText = await response.text();

  if (responseText.trim().length > 0) {
    return responseText;
  }

  return `${response.status} ${response.statusText}`.trim();
}

async function uploadSaveToS3() {
  try {
    const settings = getCloudsaveSettings();
    const saveData = Save.base64.export();
    const { requestUrl, headers } = await buildSignedRequest(
      "PUT",
      settings,
      saveData
    );
    const response = await fetch(requestUrl, {
      method: "PUT",
      headers,
      body: saveData,
    });

    if (!response.ok) {
      throw new Error(await readErrorResponse(response));
    }

    UI.alert("云存档上传成功！");
  } catch (error) {
    console.error(error);
    UI.alert(`云存档上传失败：${error.message || error}`);
  }
}

async function downloadSaveFromS3() {
  try {
    const settings = getCloudsaveSettings();
    const { requestUrl, headers } = await buildSignedRequest("GET", settings);
    const response = await fetch(requestUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(await readErrorResponse(response));
    }

    const base64Bundle = await response.text();

    if (!base64Bundle.trim()) {
      throw new Error("云端返回了空存档数据");
    }

    await Save.base64.import(base64Bundle);
    UI.alert("云存档下载并导入成功！");
  } catch (error) {
    console.error(error);
    UI.alert(`云存档下载失败：${error.message || error}`);
  }
}

const existingSetup = Reflect.get(window, "setup");
const sugarcubeSetup =
  existingSetup && typeof existingSetup === "object" ? existingSetup : {};

Reflect.set(window, "setup", sugarcubeSetup);
sugarcubeSetup.cloudsaveS3 = {
  upload: uploadSaveToS3,
  download: downloadSaveFromS3,
};
