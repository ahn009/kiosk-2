// SSRF guard for outbound webhook deliveries. Blocks destinations that
// resolve to private, loopback, link-local, multicast, or reserved address
// space — including the cloud metadata endpoints — and enforces HTTPS in
// production (plain HTTP is only allowed for localhost in non-production).
import { lookup } from "dns/promises";
import { isIP } from "net";
import { getConfig } from "./config";

function ipToInt(ip: string): number | null {
  if (!isIP(ip) || isIP(ip) !== 4) return null;
  const p = ip.split(".").map(Number);
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

function inCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const ipInt = ipToInt(ip);
  const baseInt = ipToInt(base);
  if (ipInt === null || baseInt === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

// Private / special-use ranges that a webhook must never target.
const BLOCKED_CIDRS = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "169.254.0.0/16", // link-local incl. cloud metadata
  "0.0.0.0/8",
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved
  "::1/128",
  "fc00::/7",
  "fe80::/10",
];

function isBlockedIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const low = ip.toLowerCase();
    return (
      low === "::1" ||
      low.startsWith("fc") ||
      low.startsWith("fd") ||
      low.startsWith("fe80")
    );
  }
  return BLOCKED_CIDRS.some((c) => inCidr(ip, c));
}

/**
 * Throws when the URL is not a safe webhook destination.
 * Resolves the hostname and checks every returned address (TOCTOU between
 * check and fetch is a residual risk; deliveries also run with a 5s timeout).
 */
export async function assertSafeWebhookUrl(rawUrl: string): Promise<void> {
  const cfg = getConfig();
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid webhook URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Webhook URL must be http(s)");
  }
  if (cfg.isProduction && url.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS in production");
  }
  if (url.username || url.password) {
    throw new Error("Webhook URL must not embed credentials");
  }
  const host = url.hostname.toLowerCase();
  const allowLocalhost =
    !cfg.isProduction && (host === "localhost" || host === "127.0.0.1" || host === "::1");
  if (!allowLocalhost) {
    let addresses: string[];
    try {
      addresses = (await lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new Error("Webhook hostname does not resolve");
    }
    if (addresses.length === 0 || addresses.some(isBlockedIp)) {
      throw new Error("Webhook URL resolves to a blocked address");
    }
  }
}
