/** Single-pass substitution: inserted user text is never interpreted as a template. */
export function renderMockTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!Object.hasOwn(values, key))
      throw new Error(`Mock 문서 양식의 값을 찾을 수 없습니다: ${key}`);
    return String(values[key]);
  });
}
