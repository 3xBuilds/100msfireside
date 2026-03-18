export function initials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  const a = (parts[0] && parts[0][0]) || "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

export function hash01(str: string) {
  let h = 7;
  for (let i = 0; i < str.length; i++)
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
