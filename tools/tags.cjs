function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[_/.,()\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeTags(parts) {
  return norm(parts.filter(Boolean).join(" "));
}

module.exports = { norm, makeTags };