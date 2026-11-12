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

## Compatibility follow-up

- **Modern path:** Unity 2021.1+ builds the slice metadata through `SpriteDataProviderFactories` and `ISpriteEditorDataProvider`; Unity 2021.2+ also registers sprite name/file-ID pairs. Existing sprite IDs are reused by name on reimport.
- **Legacy fallback:** Older Unity versions compile the `TextureImporter.spritesheet` branch. The obsolete API is excluded from modern Unity builds.
- **Asset paths:** The generated animation directory is normalized to forward slashes before passing it to `AssetDatabase.CreateAsset`.
- **Verification:** Source review and PIX2 package-data checks only so far. The generated file was refreshed in the supplied download folder. Unity compilation and import/reimport still need to be exercised in Unity 2021.1, 2021.2+, and a legacy version if those targets are supported.

## Import command naming and workflow clarity

- **App:** NOIRADIX Studio Unity package exporter
- **Repro:** In Unity's Project window, open the context menu for an exported `.pix2.json` file.
- **Observed:** The menu label used `&`, while the menu screenshot did not visibly show the conjunction, making it unclear that the importer both slices sprites and creates animation clips.
- **Expected:** The context-menu command says `Import Spritesheet and Animations`; both the context menu and top-menu workflow explain that JSON metadata drives exact sprite slicing and native `.anim` clip creation.
- **Implementation:** Rename the Unity menu item and validator to use the word `and`; update the generated package instructions and both README guides. Clarify that manually importing a PNG can remain crisp with Point filtering, but does not apply PIX2 frame/animation metadata.
- **Verification:** Source and documentation reviewed; `git diff --check` passed. Unity UI rendering and generated-package import have not been rerun in Unity.
- **Remaining coverage:** Confirm the visible label and both import paths in a supported Unity Editor version.
