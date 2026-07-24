# keel-check-action

Runs `keel check --ci` on a pull request and fails it if any block-severity rule fails, with
`::error` annotations on the exact artifact lines.

```yaml
# .github/workflows/keel.yml
name: keel
on: [pull_request]
jobs:
  keel:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: keel-dev/keel-check-action@v2
```

Make it a **required status check** (Settings → Branches → branch protection) so a seal break or an
unsigned gate physically cannot merge. On a repository that hasn't run `keel init`, the check exits
0 and does nothing — safe to add org-wide.
