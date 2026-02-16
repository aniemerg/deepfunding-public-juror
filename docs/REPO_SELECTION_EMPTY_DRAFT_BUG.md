# Repo Selection Empty Draft Bug

## Summary

Some users reached the "Select Projects to Evaluate" screen and saw no projects.
Root cause was an empty autosave draft for `repo_selection` that prevented the
initial selection from being generated.

## Impact

- Affected new users (and any user with an empty draft for repo selection).
- Flow blocked at "Select Projects to Evaluate" with zero projects shown.

## Root Cause

The repo selection screen loads existing data with:
- `getSubmissionStatus(user, 'repo_selection', 'repo-selection')`

If it finds data, it assumes the selection is valid and skips initialization.
However, `useAutosave` wrote a draft immediately on mount, before initialization
completed. That draft had empty arrays:

- `initialRepos: []`
- `finalSelectedRepos: []`

This caused the UI to render an empty list and block the user.

## Fix (Code)

Two changes:

1. **Avoid autosave until initialization**
   - Only autosave after the repo selection screen is fully initialized.

2. **Treat empty drafts as "no data"**
   - If existing submission has empty `initialRepos` and `finalSelectedRepos`,
     generate the initial 10 projects instead of loading empty arrays.

Relevant files:

- `src/components/RepoSelectionScreen.jsx`
- `src/hooks/useAutoSave.js`

## Remediation (Data)

If a user is stuck, clear only the repo selection draft + navigation cache:

Keys to delete (production or preview):

- `user:<address>:repo_selection:repo-selection`
- `user:<address>:repo_selection:_index`
- `user:<address>:navigation-state`
- `user:<address>:in-progress:repo_selection`

This preserves submitted data while forcing a clean re-init.

## Detection

A stuck user will have a repo selection draft like:

```
initialRepos: []
finalSelectedRepos: []
status: "draft"
```

You can scan for affected users using:

```
node scripts/find-empty-repo-selection.js --env=production
```

## Related Tools

- `scripts/find-empty-repo-selection.js`
  - Scans KV for empty repo selection drafts.
- `scripts/clone-user-kv.js`
  - Copies user KV state across envs (without profile / ENS keys).

