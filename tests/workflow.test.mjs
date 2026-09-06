import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workflowPath = path.join(root, ".github", "workflows", "publish.yml");

test("trusted publish workflow uses constrained GitHub OIDC", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /version:\n\s+description:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /node-version: "24"/);
  assert.match(workflow, /npm@\^11\.15\.0/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run dist/);
  assert.match(workflow, /npm publish "dist\/quorum-skill-\$\{RELEASE_VERSION\}\.tgz" --access public/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.ok(
    workflow.indexOf("actions/upload-artifact@v4") < workflow.indexOf("npm publish"),
    "verified artifacts must be preserved before the immutable npm publish",
  );
  assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./);
});
