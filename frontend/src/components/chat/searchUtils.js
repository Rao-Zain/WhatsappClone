// Makes user text safe to use inside a regular expression.
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A short piece of text around the first match, so long messages stay
// readable in the results list.
export function makeSnippet(text = "", query = "", radius = 40) {
  const flat = String(text).replace(/\s+/g, " ").trim();
  const needle = String(query).trim();

  if (!needle) return flat;

  const match = new RegExp(escapeRegExp(needle), "i").exec(flat);

  if (!match || match.index <= radius) return flat;

  return `…${flat.slice(match.index - radius)}`;
}