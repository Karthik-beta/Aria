# Releases

Aria uses [Semantic Versioning](https://semver.org/) with `vX.Y.Z` git tags, and keeps a [changelog](https://github.com/Karthik-beta/Aria/blob/master/CHANGELOG.md) in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Releases are listed on the [Releases page](https://github.com/Karthik-beta/Aria/releases).

## Cutting a release

1. Move the `## [Unreleased]` entries in `CHANGELOG.md` under a new `## [X.Y.Z] - YYYY-MM-DD` heading and merge that to `master`.
2. Tag the merge commit and push the tag:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. The **Release Images** workflow then:
   - publishes `aria-backend` and `aria-frontend` images to GHCR tagged `X.Y.Z`, `X.Y`, `latest` and `sha-<commit>`
   - builds and, when signing is configured, signs `Aria-ERP-Setup.exe`
   - creates the GitHub Release with the installer attached

Pushes to `master` without a tag publish only the `master` and `sha-<commit>` image tags.

## Upgrading an installation

- **Aria ERP Setup:** run the new installer and choose update. It rolls back if the new version fails to start.
- **Docker Compose:** set `VERSION=X.Y.Z` in `.env` and restart. Migrations run automatically.
