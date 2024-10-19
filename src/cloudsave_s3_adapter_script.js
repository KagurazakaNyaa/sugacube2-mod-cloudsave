function formatDateYYYYMMDD(date) {
  let d = new Date(date),
    month = "" + (d.getMonth() + 1),
    day = "" + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("");
}

function signAWSv4() {
  //TODO sign request
}

let upload_save_to_s3 = function () {
  const s3Protocol = Setting.getValue("cloudsave_s3_protocol");
  const s3Endpoint = Setting.getValue("cloudsave_s3_endpoint");
  const s3Region = Setting.getValue("cloudsave_s3_region");
  const s3Bucket = Setting.getValue("cloudsave_s3_bucket");
  const s3AccessKey = Setting.getValue("cloudsave_s3_accesskey");
  const s3SecretKey = Setting.getValue("cloudsave_s3_secretkey");
  const s3ObjectKey = Setting.getValue("cloudsave_s3_objectkey");
  const saveData = Save.base64.export();
  const now = new Date();
  const signDate = formatDateYYYYMMDD(now);
  const credential = `${s3AccessKey}/${signDate}/${s3Region}/S3/aws4_request`;
  let requestUrl = `${s3Protocol}://`;
  if (Setting.getValue("cloudsave_s3_pathstyle")) {
    requestUrl += `${s3Endpoint}/${s3Bucket}/${s3ObjectKey}`;
  } else {
    requestUrl += `${s3Bucket}.${s3Endpoint}/${s3ObjectKey}`;
  }
  fetch(requestUrl, {
    method: "PUT",
    headers: {
      Authorization: "AWS4-HMAC-SHA256",
      SignedHeaders: "host;range;x-amz-date",
      Credential: credential,
      "x-amz-date": now.toISOString(),
      Signature: signAWSv4(),
    },
    body: saveData,
  });
};
