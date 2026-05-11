import crypto from "crypto";

function clean(value: any) {
  return String(value || "").trim();
}

function encode(value: any) {
  return encodeURIComponent(clean(value));
}

function buildUserAgent(req?: Request) {
  return (
    req?.headers.get("user-agent") ||
    "HalaDigital-MTD-Platform/1.0"
  );
}

function buildPublicIP(req?: Request) {
  return (
    req?.headers.get("x-forwarded-for") ||
    req?.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

function buildDeviceId(req?: Request) {
  const existing =
    req?.headers.get("x-hala-device-id") ||
    req?.headers.get("Gov-Client-Device-ID");

  if (existing) {
    return existing;
  }

  return crypto.randomUUID();
}

export function buildFraudHeaders(req?: Request) {
  const now = new Date().toISOString();

  const deviceId = buildDeviceId(req);

  const userAgent = buildUserAgent(req);

  const publicIp = buildPublicIP(req);

  const forwarded = req?.headers.get("x-forwarded-for");

  return {
    Accept: "application/vnd.hmrc.5.0+json",

    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",

    "Gov-Client-Device-ID": deviceId,

    "Gov-Client-User-Ids":
      `os=${encode("windows")},` +
      `device=${encode(deviceId)},` +
      `user=${encode("hala-platform-user")}`,

    "Gov-Client-Timezone": "UTC+00:00",

    "Gov-Client-Local-IPs": encode(publicIp),

    "Gov-Client-Local-IPs-Timestamp": now,

    "Gov-Client-MAC-Addresses":
      encode("02:00:5e:10:00:00"),

    "Gov-Client-User-Agent":
      encode(userAgent),

    "Gov-Client-Public-IP": encode(publicIp),

    "Gov-Client-Public-Port": "443",

    "Gov-Client-Window-Size": "1920x1080",

    "Gov-Client-Screens":
      encode("width=1920&height=1080&scaling-factor=1&colour-depth=24"),

    "Gov-Client-Browser-Plugins":
      encode("none"),

    "Gov-Client-Browser-JS-User-Agent":
      encode(userAgent),

    "Gov-Client-Multi-Factor": "type=totp",

    "Gov-Client-Device-ID-Created": now,

    "Gov-Client-Public-IP-Timestamp": now,

    "Gov-Vendor-Version":
      "hala-digital=1.0.0",

    "Gov-Vendor-License-Ids":
      "hala-digital=trial",

    "Gov-Vendor-Product-Name":
      encode("Hala Digital MTD SaaS"),

    "Gov-Vendor-Forwarded":
      encode(
        forwarded ||
        publicIp
      ),
  };
}