const TEAL = "#10A37F";
const ORANGE = "#F59E0B";
const RED = "#EF4444";

export function scoreColor(score: number): string {
  if (score >= 80) return TEAL;
  if (score >= 50) return ORANGE;
  return RED;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
