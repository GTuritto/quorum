import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function resolveReleaseVersion({ eventName, ref, requestedVersion, packageVersion }) {
  let version;
  if (eventName === "push" && ref?.startsWith("refs/tags/v")) {
    version = ref.slice("refs/tags/v".length);
  } else if (eventName === "workflow_dispatch" && ref === "refs/heads/main") {
    version = requestedVersion;
  } else {
    throw new Error("Publish requires a version tag push or manual dispatch on main");
  }
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? "")) {
    throw new Error("Release version must be a stable X.Y.Z version, such as 0.1.60");
  }
  if (version !== packageVersion) {
    throw new Error(`Release version ${version} does not match package.json ${packageVersion}`);
  }
  return version;
}

export function verifyRelease({ cwd = process.cwd(), env = process.env } = {}) {
  const manifest = JSON.parse(readFileSync(new URL("package.json", pathToFileURL(`${cwd}/`)), "utf8"));
  const version = resolveReleaseVersion({
    eventName: env.GITHUB_EVENT_NAME,
    ref: env.GITHUB_REF,
    requestedVersion: env.REQUESTED_VERSION,
    packageVersion: manifest.version,
  });
  // Refuse unmerged branch tags; missing main refs also fail closed.
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", "HEAD", "refs/remotes/origin/main"], {
      cwd, stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("Release commit must belong to origin/main; check the fetched main ref");
  }
  if (!env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
  appendFileSync(env.GITHUB_OUTPUT, `version=${version}\n`);
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(`Verified release ${verifyRelease()}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
