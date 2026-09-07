# Publishing Quorum

Only maintainers publish Quorum. Build and test every release from a clean
`main` branch.

## First npm publication

Version `0.1.58` establishes ownership of the unscoped `quorum-skill` package.
It is published once from an authenticated maintainer account after the local
release gate passes. This first release has no trusted-publishing provenance;
provenance cannot be added retroactively.

After `0.1.58` exists, configure GitHub Actions workflow `publish.yml` as the
trusted publisher for `GTuritto/quorum`. The npm account must have 2FA enabled.
Use npm `11.15.0` or later:

```sh
npx -y npm@^11.15.0 trust github quorum-skill \
  --file publish.yml \
  --repo GTuritto/quorum \
  --allow-publish \
  --yes
npx -y npm@^11.15.0 trust list quorum-skill --json
```

## Subsequent npm releases

Version 0.1.59 is the first trusted publication. Start from a clean, verified
`main` branch and confirm that npm still binds direct publishing to this
repository and workflow:

```sh
git fetch origin
git rev-list --left-right --count origin/main...main
gh auth status
npx -y npm@^11.15.0 trust list quorum-skill --json
npm view quorum-skill@0.1.59 version
```

The final `npm view` command must report that 0.1.59 is absent before release.
Run the local gate, push `main`, and dispatch the trusted workflow:

```sh
npm test
TZ=UTC npm run dist
git diff --check
git push origin main
gh workflow run publish.yml --ref main -f version=0.1.59
quorum_run_id=$(gh run list --workflow publish.yml --branch main --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$quorum_run_id" --exit-status
```

Use UTC for the local distribution build. The system ZIP format records local
wall-clock timestamps, while npm normalizes packaged file times. Matching the
GitHub-hosted runner's UTC timezone makes the local and workflow ZIP archives
byte-for-byte comparable.

Download the workflow artifact and compare it with the local build:

```sh
quorum_artifact_dir=$(mktemp -d "${TMPDIR:-/tmp}/quorum-0.1.59-artifact.XXXXXX")
gh run download "$quorum_run_id" --name quorum-skill-0.1.59 --dir "$quorum_artifact_dir"
(cd "$quorum_artifact_dir" && shasum -a 256 -c SHA256SUMS)
cmp dist/quorum-skill-0.1.59.tgz "$quorum_artifact_dir/quorum-skill-0.1.59.tgz"
cmp dist/quorum-skill-0.1.59.zip "$quorum_artifact_dir/quorum-skill-0.1.59.zip"
```

Verify the registry version, executable, integrity, and provenance metadata:

```sh
npm view quorum-skill@0.1.59 version dist.integrity dist.tarball dist.attestations --json
quorum_smoke_dir=$(mktemp -d "${TMPDIR:-/tmp}/quorum-0.1.59-smoke.XXXXXX")
(cd "$quorum_smoke_dir" && npx -y quorum-skill@0.1.59 --version)
```

Run the `npx` smoke test outside the source checkout. Inside a matching local
package, npm may prefer the project without creating an executable link.

Create the annotated tag only after npm verification. Attach the workflow's
exact three files to a draft release, verify them, then publish the release.

```sh
git tag -a v0.1.59 -m "Quorum 0.1.59"
git push origin v0.1.59
quorum_release_notes=$(mktemp "${TMPDIR:-/tmp}/quorum-0.1.59-notes.XXXXXX")
sed -n '/^## \[0.1.59\]/,/^## \[/p' CHANGELOG.md | sed '$d' > "$quorum_release_notes"
gh release create v0.1.59 --draft --title "Quorum 0.1.59" \
  --notes-file "$quorum_release_notes" \
  "$quorum_artifact_dir/quorum-skill-0.1.59.tgz" \
  "$quorum_artifact_dir/quorum-skill-0.1.59.zip" \
  "$quorum_artifact_dir/SHA256SUMS"
quorum_release_verify_dir=$(mktemp -d "${TMPDIR:-/tmp}/quorum-0.1.59-release.XXXXXX")
gh release download v0.1.59 --dir "$quorum_release_verify_dir"
(cd "$quorum_release_verify_dir" && shasum -a 256 -c SHA256SUMS)
gh release edit v0.1.59 --draft=false
```

Trusted publishing uses GitHub OIDC and stores no npm publish token. npm adds
provenance and publish attestations automatically for the public package from
this public repository.
