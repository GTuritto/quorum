export const EXPECTED_PACKAGE_FILES = Object.freeze([
  "LICENSE",
  "README.md",
  "SKILL.md",
  "VERSION",
  "agents/openai.yaml",
  "install.ps1",
  "install.sh",
  "installer/install.mjs",
  "installer/selector.mjs",
  "installer/targets.mjs",
  "package.json",
  "references/codex-adapter.md",
  "references/protocol.sudo.md",
]);

export function packFilePaths(packResult) {
  if (!packResult || !Array.isArray(packResult.files)) {
    throw new Error("npm pack did not return a files array");
  }
  return packResult.files.map(({ path }) => path).sort();
}

export function assertExactPackageFiles(
  actualPaths,
  expectedPaths = EXPECTED_PACKAGE_FILES,
) {
  const actual = [...new Set(actualPaths)].sort();
  const expected = [...new Set(expectedPaths)].sort();
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((file) => !actualSet.has(file));
  const unexpected = actual.filter((file) => !expectedSet.has(file));

  if (missing.length > 0 || unexpected.length > 0) {
    const details = [];
    if (missing.length > 0) details.push(`Missing package files: ${missing.join(", ")}`);
    if (unexpected.length > 0) details.push(`Unexpected package files: ${unexpected.join(", ")}`);
    throw new Error(details.join("\n"));
  }
}
