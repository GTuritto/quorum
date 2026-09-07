import path from "node:path";
import { fileURLToPath } from "node:url";

import { main } from "../installer/install.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const testHome = process.env.QUORUM_TEST_HOME;
if (!testHome) throw new Error("QUORUM_TEST_HOME is required");

process.exitCode = await main({
  argv: process.argv.slice(2),
  homeDir: path.resolve(testHome),
  sourceRoot: root,
});
