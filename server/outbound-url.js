import dns from "node:dns/promises";
import net from "node:net";

/* Proteção contra SSRF para URLs informadas pelo usuário (webhooks, integrações).
   Só http(s), sem credenciais na URL, host público: nada de localhost, redes
   privadas, link-local (metadados de nuvem), loopback ou IPv6 interno. */

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "metadata.google.internal", "instance-data"]);

function ipv4ToInt(ip) {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const PRIVATE_V4 = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
].map(([base, bits]) => [ipv4ToInt(base), bits]);

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const value = ipv4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => (value >>> (32 - bits)) === (base >>> (32 - bits)));
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("::ffff:")) return isPrivateIp(lower.slice(7));
    const first = parseInt(lower.split(":")[0] || "0", 16);
    return (first & 0xfe00) === 0xfc00 /* fc00::/7 */ || (first & 0xffc0) === 0xfe80 /* fe80::/10 */ || (first & 0xffc0) === 0xfec0;
  }
  return true; // não é IP válido: trate como inseguro
}

export function parseOutboundUrl(input) {
  let url;
  try { url = new URL(String(input || "")); } catch { return { ok: false, error: "URL inválida." }; }
  if (!["http:", "https:"].includes(url.protocol)) return { ok: false, error: "Use uma URL http ou https." };
  if (url.username || url.password) return { ok: false, error: "A URL não pode conter credenciais." };
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return { ok: false, error: "Host não permitido." };
  if ((net.isIP(host) && isPrivateIp(host))) return { ok: false, error: "Endereços internos não são permitidos." };
  return { ok: true, url, host };
}

export async function assertSafeOutboundUrl(input, { lookup = (host) => dns.lookup(host, { all: true }) } = {}) {
  const parsed = parseOutboundUrl(input);
  if (!parsed.ok) throw Object.assign(new Error(parsed.error), { status: 400 });
  if (!net.isIP(parsed.host)) {
    let addresses;
    try { addresses = await lookup(parsed.host); } catch { throw Object.assign(new Error("Não foi possível resolver o host."), { status: 400 }); }
    if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) throw Object.assign(new Error("Endereços internos não são permitidos."), { status: 400 });
  }
  return parsed.url;
}
