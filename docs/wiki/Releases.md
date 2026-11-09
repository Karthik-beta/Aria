# Releases

Aria uses [Semantic Versioning](https://semver.org/) with `vX.Y.Z` git tags, and keeps a [changelog](https://github.com/Karthik-beta/Aria/blob/main/CHANGELOG.md) in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Releases are listed on the [Releases page](https://github.com/Karthik-beta/Aria/releases).

## Cutting a release

1. Move the `## [Unreleased]` entries in `CHANGELOG.md` under a new `## [X.Y.Z] - YYYY-MM-DD` heading and merge that to `main`.
2. Tag the merge commit and push the tag:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. The **Release Images** workflow then:
   - publishes `aria-erp-backend` and `aria-erp-frontend` images to GHCR tagged `X.Y.Z`, `X.Y`, `latest` and `sha-<commit>`
   - builds and, when signing is configured, signs `Aria-ERP-Setup.exe`
   - creates the GitHub Release with the installer attached

Pushes to `main` without a tag publish only the `main` and `sha-<commit>` image tags.

## Upgrading an installation

- **Aria ERP Setup:** run the new installer and choose update. It rolls back if the new version fails to start.
- **Docker Compose:** set `VERSION=X.Y.Z` in `.env` and restart. Migrations run automatically.
