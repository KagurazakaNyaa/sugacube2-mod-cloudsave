Setting.addHeader("CloudSave", "云存档设置");
Setting.addToggle("cloudsave_s3_pathstyle", {
  label: "S3路径模式(Minio建议开启)",
  default: false,
});
Setting.addList("cloudsave_s3_protocol", {
  label: "S3服务器协议",
  list: ["http", "https"],
  default: "https",
});
Setting.addValue("cloudsave_s3_endpoint", {
  default: "",
});
Setting.addValue("cloudsave_s3_region", {
  default: "us-east-1",
});
Setting.addValue("cloudsave_s3_bucket", {
  default: "",
});
Setting.addValue("cloudsave_s3_accesskey", {
  default: "",
});
Setting.addValue("cloudsave_s3_secretkey", {
  default: "",
});
Setting.addValue("cloudsave_s3_objectkey", {
  default: "",
});
