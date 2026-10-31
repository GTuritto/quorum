# Publishing Quorum

Only maintainers publish Quorum. Publish from a clean commit on `main` after the
release candidate has passed its verification and the versioned changes have
merged. The current workflow uses a stable `vX.Y.Z` tag pushed to that commit;
a merge alone does not publish.

## First publication and trusted publisher

Version `0.1.58` established ownership of the unscoped `quorum-skill` package.
Later releases use npm trusted publishing through `.github/workflows/publish.yml`
for `GTuritto/quorum`, with GitHub OIDC and no stored npm publish token. Keep
the npm trusted-publisher binding and account 2FA enabled.

## Release gate

1. Confirm the release commit is on `main`, the working tree is clean, and
   `VERSION`, `package.json`, `SKILL.md`, README, guide, changelog, and version
   tests agree on the release number.
2. Run `npm test`, `TZ=UTC npm run dist`, and `git diff --check`. Check the
   generated `dist/SHA256SUMS` with `shasum -a 256 -c` from `dist/`.
3. Confirm the exact version does not already exist on npm with
   `npm view quorum-skill@X.Y.Z version`.
4. Push an annotated `vX.Y.Z` tag on the merged release commit. The tag push
   starts the `Publish npm package` workflow. Its release check rejects a tag
   whose version differs from `package.json` or whose commit is not on
   `origin/main`.
5. Wait for the workflow and verify the npm version, tarball executable, and
   provenance. The workflow also uploads TGZ, ZIP, and checksums as temporary
   artifacts. It does not create a GitHub release.

The workflow can also be dispatched manually from `main` with the exact
version input. Use that only when a tag-triggered publish did not occur and
the version is still absent from npm. npm versions are immutable, so do not
rerun a successful publish for the same version.

## Verify a published release

Run the executable outside the source checkout, where npm cannot select the
local package in place of the registry package:

```sh
npm view quorum-skill@X.Y.Z version dist.integrity dist.attestations --json
quorum_smoke_dir=$(mktemp -d "${TMPDIR:-/tmp}/quorum-release-smoke.XXXXXX")
(cd "$quorum_smoke_dir" && npx -y quorum-skill@X.Y.Z --version)
```

The versioned npm package is the published artifact. A GitHub release and its
asset attachments are separate optional work and must use the workflow's
verified archives if created.
