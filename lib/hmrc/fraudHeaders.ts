export function buildFraudHeaders(req?: Request) {
  return {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Client-Device-ID": crypto.randomUUID(),
    "Gov-Client-User-Ids": JSON.stringify({
      appUserId: "hala-digital-user",
    }),
    "Gov-Client-Timezone": "UTC+00:00",
    "Gov-Client-Local-IPs": "127.0.0.1",
    "Gov-Client-Local-IPs-Timestamp": new Date().toISOString(),
    "Gov-Client-MAC-Addresses": "00:00:5e:00:53:af",
    "Gov-Client-User-Agent": "HalaDigital-MTD-Portal",
    "Gov-Vendor-Version": "hala-digital=1.0.0",
    "Gov-Vendor-Product-Name": "Hala Digital MTD SaaS",
  };
}