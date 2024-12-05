function formatDateYYYYMMDD(date) {
  let d = new Date(date),
    month = "" + (d.getMonth() + 1),
    day = "" + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("");
}

async function digestMessage(message) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(""); // convert bytes to hex string
  return hashHex;
}

async function digestCanonicalRequest(
  httpMethod,
  cannonicalUri,
  canonicalQueryString,
  canonicalHeaders,
  signedHeaders,
  hashedPayload
) {
  const canonicalRequest = `${httpMethod}\n${cannonicalUri}\n${canonicalQueryString}\n,${canonicalHeaders}\n,${signedHeaders}\n${hashedPayload}`;
  return digestMessage(canonicalRequest);
}

async function hmac(secretKey, message) {
  // Convert the message and secretKey to Uint8Array
  const encoder = new TextEncoder();
  const messageUint8Array = encoder.encode(message);
  const keyUint8Array = encoder.encode(secretKey);

  // Import the secretKey as a CryptoKey
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyUint8Array,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign the message with HMAC and the CryptoKey
  const signature = await window.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageUint8Array
  );

  // Convert the signature ArrayBuffer to a hex string
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

async function signAWSv4(
  canonicalRequestSha256,
  scope,
  s3Region,
  timestampISO8601,
  signDate,
  secretKey
) {
  const stringToSign = `AWS4-HMAC-SHA256\n${timestampISO8601}\n${scope}\n${canonicalRequestSha256}`;
  const dateKey = await hmac("AWS4" + secretKey, signDate);
  const dateRegionKey = await hmac(dateKey, s3Region);
  const dateRegionServiceKey = await hmac(dateRegionKey, "s3");
  const signingKey = await hmac(dateRegionServiceKey, "aws4_request");
  return await hmac(signingKey, stringToSign);
}

function getCloudsaveSettings() {
  const s3Settings = {
    s3Protocol: V.options["cloudsave_s3_protocol"],
    s3Endpoint: V.options["cloudsave_s3_endpoint"],
    s3Region: V.options["cloudsave_s3_region"],
    s3Bucket: V.options["cloudsave_s3_bucket"],
    s3AccessKey: V.options["cloudsave_s3_accesskey"],
    s3SecretKey: V.options["cloudsave_s3_secretkey"],
    s3ObjectKey: V.options["cloudsave_s3_objectkey"],
    s3PathStyle: V.options["cloudsave_s3_pathstyle"],
  };
  return s3Settings;
}

let upload_save_to_s3 = async function () {
  const s3Settings = getCloudsaveSettings();
  const saveData = Save.base64.export();
  const saveDataSha256 = await digestMessage(saveData);
  const now = new Date();
  const nowIso8601 = now.toISOString();
  const signDate = formatDateYYYYMMDD(now);
  const scope = `${signDate}/${s3Settings.s3Region}/S3/aws4_request`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  let requestUrl = `${s3Settings.s3Protocol}://`;
  if (s3Settings.s3PathStyle) {
    requestUrl += `${s3Settings.s3Endpoint}/${s3Settings.s3Bucket}/${s3Settings.s3ObjectKey}`;
  } else {
    requestUrl += `${s3Settings.s3Bucket}.${s3Settings.s3Endpoint}/${s3Settings.s3ObjectKey}`;
  }
  const canonicalRequestSha256 = await digestCanonicalRequest(
    "PUT",
    s3Settings.s3ObjectKey,
    "",
    `host:${s3Settings.s3Endpoint}\nx-amz-content-sha256:${saveDataSha256}\nx-amz-date:${nowIso8601}\n`,
    signedHeaders,
    saveDataSha256
  );
  const signature = await signAWSv4(
    canonicalRequestSha256,
    scope,
    s3Settings.s3Region,
    nowIso8601,
    signDate,
    s3Settings.s3SecretKey
  );
  fetch(requestUrl, {
    method: "PUT",
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${s3Settings.s3AccessKey}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`,
      "x-amz-date": nowIso8601,
      "x-amz-content-sha256": saveDataSha256,
    },
    body: saveData,
  }).then((response) => {
    if (!response.ok) {
      UI.alert("Upload save failed.");
    }
  });
};

let download_save_from_s3 = async function () {
  const s3Settings = getCloudsaveSettings();
  const now = new Date();
  const nowIso8601 = now.toISOString();
  const signDate = formatDateYYYYMMDD(now);
  const scope = `${signDate}/${s3Settings.s3Region}/S3/aws4_request`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const requestPayloadSha256 = await digestMessage(""); // should be "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  const canonicalRequestSha256 = await digestCanonicalRequest(
    "GET",
    s3Settings.s3ObjectKey,
    "",
    `host:${s3Settings.s3Endpoint}\nx-amz-content-sha256:${requestPayloadSha256}\nx-amz-date:${nowIso8601}\n`,
    signedHeaders,
    requestPayloadSha256
  );
  const signature = await signAWSv4(
    canonicalRequestSha256,
    scope,
    s3Settings.s3Region,
    nowIso8601,
    signDate,
    s3Settings.s3SecretKey
  );
  fetch(requestUrl, {
    method: "GET",
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${s3Settings.s3AccessKey}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`,
      "x-amz-date": nowIso8601,
      "x-amz-content-sha256": requestPayloadSha256,
    },
    body: saveData,
  })
    .then((response) => response.text())
    .then((base64Bundle) => {
      Save.base64
        .import(base64Bundle)
        .then(() => {
          /* Success.  Do something special. */
          UI.alert("Import save from cloud successful!");
        })
        .catch((error) => {
          /* Failure.  Handle the error. */
          console.error(error);
          UI.alert(error);
        });
    });
};
