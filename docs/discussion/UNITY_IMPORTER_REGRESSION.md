# Unity importer generated-string regression

## Finding

- **App:** NOIRADIX Studio Unity package exporter
- **Repro:** Export a Unity 2D package, place `Pix2UnityImporter.cs` under a Unity project's `Assets/Editor/`, and let Unity compile it.
- **Observed:** The completion dialog's `\n` escapes were interpreted by the JavaScript template literal as literal newlines. The generated C# string therefore ended at the first newline, producing `CS1039` and cascading syntax errors.
- **Expected:** The generated C# source contains escaped `\\n` sequences within the dialog string, which C# interprets as line breaks at runtime.
- **Implementation:** Escape the backslashes in the JavaScript template in `js/studio-export.js`.
- **Format impact:** None. PIX2 grammar and serialization are unchanged.
- **Verification:** `git diff --check` passed after the fix. Full release-gate results and Unity environment limitation are recorded in the release notes after execution.
- **Remaining coverage:** Compile the generated importer in a supported Unity Editor version; Unity is not installed in the repository verification environment.
