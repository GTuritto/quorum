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

1. Merge and verify the release commit on `main`.
2. Dispatch `publish.yml` from `main` with the exact package version.
3. Verify npm metadata, clean-cache execution, and provenance.
4. Download the workflow artifact and attach those exact files to the draft
   GitHub release.
5. Verify checksums before publishing the GitHub release.

Trusted publishing uses GitHub OIDC and stores no npm publish token. npm adds
provenance and publish attestations automatically for the public package from
this public repository.
