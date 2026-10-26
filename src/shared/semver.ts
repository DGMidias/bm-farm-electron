export function parseSemver(version: string): [number, number, number] {
  const clean = version.trim().replace(/^v/i, "");
  const [major = "0", minor = "0", patch = "0"] = clean.split(".");
  return [Number(major) || 0, Number(minor) || 0, Number(patch) || 0];
}

export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }
  return 0;
}

export function isRemoteNewer(local: string, remote: string): boolean {
  return compareSemver(remote, local) > 0;
}
