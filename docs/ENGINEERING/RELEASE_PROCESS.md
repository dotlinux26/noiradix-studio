# Release process

Keep the application version in `js/version.js` and the format version in the file contract. The [root PIX2 specification](../../PIX2_SPECIFICATION.md) is normative for 1.1. The former specification and grammar files are 1.0 compatibility references.

1. Push a reviewable checkpoint on a feature branch. Compare the compiler copies byte for byte and check parse, edit, export, reload and compatibility against the tagged baseline.
2. Run `node tests/run-all.cjs --syntax`, `node tests/run-all.cjs`, the benchmark, and `node tests/run-all.cjs --browser` (all three browser runners). Record the exact cases in the [verification ledger](../discussion/STABILIZATION_LEDGER.md). For viewport changes run the dense editor fixture with `EDITOR_QA_DENSE=1` and `EDITOR_QA_DPR=2`.
3. Set matching app versions and write notes in `docs/releases/vX.Y.Z.md`. State remaining limitations and distinguish app changes from format changes.
4. Push an annotated version tag at the verified commit. The tag workflow runs the Node and browser gates before publishing the GitHub release for that existing tag. Only a push to `main` runs the Pages deployment.
5. Verify the tag resolves to the tested commit and the release page is published. Keep prior version tags intact.

The release job uses GitHub's per-job token with Contents write permission. [GitHub Actions token authentication](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)

Prerelease tags such as `v2.1.2-beta.2` are published with the GitHub prerelease flag. They do not deploy Pages or authorize merging the review branch. CI discovers Node/browser suites from their test filename pattern; a newly added suite must follow that convention.
