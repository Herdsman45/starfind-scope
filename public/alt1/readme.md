# alt1 (sf-version) — Local modified pack

Brief: this folder is used to document that the project uses a locally-provisioned, Alt1-modified pack based on the `sf-version` branch of Herdsman45's Alt1 fork.

Source: https://github.com/Herdsman45/alt1/tree/sf-version

Why: the `sf-version` branch contains local modifications needed by this project. During development and packaging we prefer to use the modified pack rather than the published `alt1` package so changes in the fork are available locally.

How to use

- Recommended (local folder): clone or copy the modified Alt1 repo next to this repo (example: `../alt1-sf-version`) and update the dependency in [dev/package.json](dev/package.json):

```json
"dependencies": {
  "alt1": "file:../alt1-sf-version"
}
```

- Alternative (install from the GitHub branch): reference the branch directly in `package.json`:

```json
"dependencies": {
  "alt1": "git+https://github.com/Herdsman45/alt1.git#sf-version"
}
```

- Alternative (local tarball): if you have an archived package `alt1-sf-version.tgz` inside this repo:

```json
"dependencies": {
  "alt1": "file:./alt1-sf-version.tgz"
}
```

After updating `package.json`, run:

```bash
npm install
```

Notes

- Using `file:` is best for iterative local development because it preserves local changes without needing to push to GitHub.
- If you use the GitHub branch reference, `npm install` will fetch the branch but you must push changes to that repo/branch for them to be pulled by others.
- Keep [dev/package.json](dev/package.json) updated to make the setup reproducible for teammates.
