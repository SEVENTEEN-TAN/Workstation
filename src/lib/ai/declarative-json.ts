const placeholderPattern = /\$\{([^}]+)\}/g;
const pathPattern = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;

export function renderJsonTemplate(
  value: unknown,
  variables: Readonly<Record<string, string>>,
): unknown {
  if (typeof value === "string") {
    return value.replace(placeholderPattern, (_, name: string) => {
      if (!Object.hasOwn(variables, name)) throw new Error("Unsupported AI template variable");
      return variables[name];
    });
  }
  if (Array.isArray(value)) return value.map((item) => renderJsonTemplate(item, variables));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, renderJsonTemplate(item, variables)]),
    );
  }
  return value;
}

export function readJsonPath(value: unknown, path: string): unknown {
  if (!pathPattern.test(path)) throw new Error("AI JSON path is invalid");
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") throw new Error("AI JSON path is invalid");
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new Error("AI JSON path is invalid");
      }
      return current[index];
    }
    if (!Object.hasOwn(current, segment)) throw new Error("AI JSON path is invalid");
    return (current as Record<string, unknown>)[segment];
  }, value);
}
