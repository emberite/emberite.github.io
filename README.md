# emberite.github.io

The showcase site for emberite's Foundry VTT modules for Daggerheart: <https://emberite.github.io>.

The page is generated from the `dh-*` repositories: each module's version, release, manifest, requirements and screenshots (from `docs/screenshots/`, with captions taken from the README's image alt text) come from the GitHub API.

```sh
node build.mjs   # reads GITHUB_ACCESS_TOKEN from the environment or .env
```

This rewrites `index.html`, `data.json` and `assets/screenshots/`. The hand-written copy (taglines, feature highlights, accent colors, which screenshot leads each section) lives in `content.mjs`. A new `dh-*` repo shows up automatically, using its repo description until it gets an entry there.
