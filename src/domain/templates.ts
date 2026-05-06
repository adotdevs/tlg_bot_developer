export function applyTemplate(
  tpl: string,
  vars: Record<string, string>
): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}
