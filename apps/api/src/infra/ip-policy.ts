import { BlockList, isIP } from "node:net";

/** Faixas recusadas no download de imagem (S02 §5.3). */
const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  // :: , ::1 e o antigo "IPv4 compatível" (::a.b.c.d)
  ["::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["64:ff9b::", 96],
  ["2002::", 16],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

/** Expande um IPv6 (com ou sem IPv4 no fim) em 8 grupos de 16 bits. `null` se não for IPv6. */
export function ipv6Groups(address: string): number[] | null {
  if (isIP(address) !== 6) return null;
  let text = address.toLowerCase().split("%")[0] ?? "";
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (v4?.[1]) {
    const bytes = v4[1].split(".").map(Number);
    text = `${text.slice(0, -v4[1].length)}${(((bytes[0] ?? 0) << 8) | (bytes[1] ?? 0)).toString(16)}:${(((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0)).toString(16)}`;
  }
  const [head = "", tail] = text.split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const fill = tail === undefined ? [] : Array(8 - left.length - right.length).fill("0");
  const groups = [...left, ...fill, ...right].map((group) => Number.parseInt(group, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

/** `::ffff:a.b.c.d` e `::ffff:7f00:1` viram o IPv4 por trás, para checar como IPv4. */
export function unmapIPv4(address: string): string | null {
  const groups = ipv6Groups(address);
  if (!groups) return null;
  const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (!mapped) return null;
  const hi = groups[6] ?? 0;
  const lo = groups[7] ?? 0;
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

/** O endereço é privado, local, reservado ou de túnel? Formas que não são IP literal contam como recusadas. */
export function isBlockedAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "");
  const family = isIP(bare);
  if (family === 4) return blocked.check(bare, "ipv4");
  if (family === 6) {
    const v4 = unmapIPv4(bare);
    if (v4) return blocked.check(v4, "ipv4");
    return blocked.check(bare.split("%")[0] ?? bare, "ipv6");
  }
  return true;
}
