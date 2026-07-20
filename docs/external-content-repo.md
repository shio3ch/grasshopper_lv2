# External Content Repository

The deploy workflow supports pulling blog content from a separate repository at build time.

## How it works

When `GH_CONTENT_REPOSITORY` is set, the deploy workflow checks out that repo into `src/content/blog/` before building. When the variable is unset, the in-repo content under `src/content/blog/` is used as-is.

## Required configuration

Set these in the **app repo** (Settings → Secrets and variables):

| Name | Type | Description |
|------|------|-------------|
| `CLOUDFLARE_API_TOKEN` | Secret | Cloudflare API token with Pages edit permission |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | Cloudflare account ID |
| `CONTENT_REPO_TOKEN` | Secret | PAT with `contents: read` on the content repo (omit if the content repo is public) |
| `GH_CONTENT_REPOSITORY` | Variable | `owner/repo` of the content repository (e.g. `acme/grasshopper-content`); leave unset to use in-repo content |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | Variable | Cloudflare Pages project name (e.g. `grasshopper`) |

## Triggering a deploy from the content repo

Add this workflow to the content repository to notify the app repo whenever new content is pushed:

```yaml
# .github/workflows/notify-app.yml  (in the content repo)
name: Notify app repo

on:
  push:
    branches:
      - main

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Send repository_dispatch to app repo
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.APP_REPO_TOKEN }}   # PAT with repo scope on the app repo
          repository: owner/grasshopper_lv2       # replace with actual app repo
          event-type: content-updated
```

`APP_REPO_TOKEN` must be a PAT (or fine-grained token) with `contents: write` on the app repo so it can create a `repository_dispatch` event.

## Manual deploy

The workflow can also be triggered manually from the Actions tab via **workflow_dispatch**.
