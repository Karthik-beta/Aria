# SignPath setup

Release installers are signed by [SignPath Foundation](https://signpath.org/) under
[CODE_SIGNING.md](../CODE_SIGNING.md). The `sign` job in
[release-images.yml](../.github/workflows/release-images.yml) does the signing. Until the
repository has the secret and variable below, it skips signing and releases the unsigned
installer.

## One-time setup

1. **Apply** at <https://signpath.org/apply.html> for the repository
   `https://github.com/Karthik-beta/Aria`. When accepted, SignPath creates an
   organization for the project.
2. **Turn on multi-factor authentication** for GitHub and SignPath. The terms require it.
3. In SignPath:
   - **Trusted build systems:** add the predefined **GitHub.com** and link it to the
     project.
   - Install the **SignPath GitHub App** for `Karthik-beta/Aria`.
   - **Project:** slug `aria`.
   - **Artifact configuration:** slug `installer`, with the contents of
     [artifact-configuration.xml](./artifact-configuration.xml).
   - **Signing policies:**
     - `test-signing`, with the test certificate, for trying the pipeline.
     - `release-signing`, with the SignPath Foundation certificate, approval required,
       and Karthik P as the approver.
   - **CI user:** create one with submitter rights on both policies, and copy its API
     token.
4. In GitHub, set the secret and the variable:

   ```bash
   gh secret set SIGNPATH_API_TOKEN --repo Karthik-beta/Aria
   ```

   ```bash
   gh variable set SIGNPATH_ORGANIZATION_ID --repo Karthik-beta/Aria --body "<organization id>"
   ```

   The first command prompts for the token, so it never lands in your shell history.

### Optional variables

These change the slugs the job uses. The defaults are the names above.

| Variable | Default |
| --- | --- |
| `SIGNPATH_PROJECT_SLUG` | `aria` |
| `SIGNPATH_SIGNING_POLICY_SLUG` | `release-signing` |
| `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` | `installer` |

## Trying it with the test certificate

1. Set `SIGNPATH_SIGNING_POLICY_SLUG` to `test-signing`.
2. Push a pre-release tag such as `v0.1.2-rc.1`. A pre-release doesn't replace the
   latest download link.
3. Check that the `Sign installer` job passes and that the release carries the
   test-signed installer.
4. Then delete the variable, so the job uses `release-signing` again.

If SignPath rejects the file details:

- The artifact configuration checks the product name `Aria ERP` and the product version.
- Aria ERP Setup sets the product version from `VersionInfoProductTextVersion` (the tag
  without the leading `v`) in
  [aria-setup.iss](../deployment/windows/installer/aria-setup.iss).
- Change one of the two files so they agree.

## Each release

1. Push the `vX.Y.Z` tag, as before.
2. The `Sign installer` job submits the installer and waits up to an hour.
3. Approve the request in SignPath. The job log links to it.
4. The release then gets the signed `Aria-ERP-Setup.exe`.

If the request is rejected or times out, the release fails rather than shipping an
unsigned file. Re-run the failed jobs to submit a new request.
