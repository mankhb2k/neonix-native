export function splitTopLevel(input: string, separator: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    if (c === "(") depth += 1;
    else if (c === ")") depth -= 1;
    if (depth === 0 && input.startsWith(separator, i)) {
      result.push(input.slice(start, i).trim());
      start = i + separator.length;
      i += separator.length - 1;
    }
  }
  result.push(input.slice(start).trim());
  return result.filter(Boolean);
}

