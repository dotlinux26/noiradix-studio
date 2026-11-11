/** Studio export packages. App owns document capture, options and modal wiring. */
const StudioExport = (() => {
  const PIX2 = typeof window !== 'undefined' ? window.PIX2 : require('./pix2-format.js');
  const NOIRADIX_VERSION =
    typeof window !== 'undefined' ? window.NOIRADIX_VERSION : require('./version.js');
  const ModularExport =
    typeof window !== 'undefined' ? window.ModularExport : require('./modular-export.js');
  function create({
    sanitizeSafeFilename,
    downloadBlob,
    showToast,
    closeGameExportModal,
    createCanvas,
  }) {
    function canvasToUint8Array(canvas) {
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(new Uint8Array(reader.result));
          };
          reader.readAsArrayBuffer(blob);
        }, 'image/png');
      });
    }

    function createZip(files) {
      const table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c;
      }
      function crc32(buf) {
        let c = 0xffffffff;
        for (let i = 0; i < buf.length; i++) {
          c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
        }
        return (c ^ 0xffffffff) >>> 0;
      }

      const parts = [];
      const centralDir = [];
      let offset = 0;

      for (const f of files) {
        const safeEntryName = sanitizeSafeFilename(f.name);
        const nameBuf = new TextEncoder().encode(safeEntryName);
        const data = f.data;
        const crc = crc32(data);
        const size = data.length;

        const lHeader = new Uint8Array(30 + nameBuf.length);
        const lv = new DataView(lHeader.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(6, 0, true);
        lv.setUint16(8, 0, true);
        lv.setUint16(10, 0, true);
        lv.setUint16(12, 0, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, size, true);
        lv.setUint32(22, size, true);
        lv.setUint16(26, nameBuf.length, true);
        lv.setUint16(28, 0, true);
        lHeader.set(nameBuf, 30);

        parts.push(lHeader);
        parts.push(data);

        const cHeader = new Uint8Array(46 + nameBuf.length);
        const cv = new DataView(cHeader.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, 0, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, size, true);
        cv.setUint32(24, size, true);
        cv.setUint16(28, nameBuf.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0, true);
        cv.setUint32(42, offset, true);
        cHeader.set(nameBuf, 46);

        centralDir.push(cHeader);
        offset += lHeader.length + data.length;
      }

      const cdOffset = offset;
      let cdSize = 0;
      for (const h of centralDir) {
        parts.push(h);
        cdSize += h.length;
      }

      const eocd = new Uint8Array(22);
      const ev = new DataView(eocd.buffer);
      ev.setUint32(0, 0x06054b50, true);
      ev.setUint16(4, 0, true);
      ev.setUint16(6, 0, true);
      ev.setUint16(8, files.length, true);
      ev.setUint16(10, files.length, true);
      ev.setUint32(12, cdSize, true);
      ev.setUint32(16, cdOffset, true);
      ev.setUint16(20, 0, true);
      parts.push(eocd);

      return new Blob(parts, { type: 'application/zip' });
    }

    async function execute({
      doc,
      opts,
      atlasData,
      format: currentExportFormat,
      trimmed: isTrimmed,
    }) {
      if (!doc || !atlasData) return;

      // PNG encoding yields to the browser. Retain metadata and (for per-frame
      // encoding) source pixels from this invocation, independently of later edits.
      if (['unity', 'texturepacker', 'zip-frames'].includes(currentExportFormat)) {
        doc = {
          meta: { ...doc.meta, cellSize: { ...doc.meta.cellSize } },
          animations: JSON.parse(JSON.stringify(doc.animations || {})),
          cells: Object.fromEntries(
            Object.entries(doc.cells).map(([id, cell]) => [
              id,
              {
                name: cell.name,
                pixels: currentExportFormat === 'zip-frames' ? { ...cell.pixels } : undefined,
              },
            ]),
          ),
        };
        opts = { ...opts, pivot: { ...opts.pivot } };
      }

      const rawBaseName = (doc.meta.title || 'sprite_atlas').toLowerCase().replace(/\s+/g, '_');
      const baseName = sanitizeSafeFilename(rawBaseName, '', 'sprite_atlas');
      const pngName = `${baseName}.png`;

      if (currentExportFormat === 'png-only') {
        atlasData.canvas.toBlob((blob) => {
          downloadBlob(blob, pngName);
          showToast(`Exported PNG Atlas (${atlasData.width}×${atlasData.height} px)!`, 'success');
          closeGameExportModal();
        });
        return;
      }

      if (currentExportFormat === 'modular-components') {
        if (typeof ModularExport !== 'undefined') {
          const result = ModularExport.exportModularComponents(doc, {
            mode: 'modular',
            trimmed: isTrimmed,
          });
          const zipBlob =
            result.zip instanceof Blob
              ? result.zip
              : new Blob([result.zip], { type: 'application/zip' });
          downloadBlob(zipBlob, `${baseName}_modular_package.zip`);
          showToast(
            `Exported Modular Component Package (${result.files.length} assets)!`,
            'success',
          );
          closeGameExportModal();
          return;
        }
      }

      if (currentExportFormat === 'unity') {
        const pngBytes = await canvasToUint8Array(atlasData.canvas);

        // Build Unity Metadata JSON
        const unityAnimList = [];
        const anims = doc.animations || {};
        for (const k in anims) {
          const anim = anims[k];
          const fNames = (anim.frames || []).map((cid) => {
            const c = doc.cells[cid];
            return c && c.name ? c.name : cid;
          });
          unityAnimList.push({
            clipName: k,
            fps: anim.fps || 6,
            loop: anim.loop !== false,
            frameNames: fNames,
          });
        }

        const unityJsonData = {
          meta: {
            app: `NOIRADIX Studio ${NOIRADIX_VERSION.studio.displayVersion}`,
            version: NOIRADIX_VERSION.studio.version,
            formatVersion: '1.1',
            image: pngName,
            cellWidth: doc.meta.cellSize.w * opts.scale,
            cellHeight: doc.meta.cellSize.h * opts.scale,
            size: { w: atlasData.width, h: atlasData.height },
            spacing: opts.spacing,
            margin: opts.margin,
            extrude: opts.extrude,
            scale: opts.scale,
          },
          frames: atlasData.frameRects.map((fr) => ({
            name: fr.name,
            cellId: fr.id,
            x: fr.x,
            y: fr.y,
            w: fr.w,
            h: fr.h,
            pivotX: opts.pivot.x,
            pivotY: opts.pivot.y,
          })),
          animations: unityAnimList,
        };

        const jsonStr = JSON.stringify(unityJsonData, null, 2);
        const jsonBytes = new TextEncoder().encode(jsonStr);

        // Unity Importer Script
        const importerScript = `using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEditor;

namespace NOIRADIX.Editor
{
    /// <summary>
    /// Automatic Unity 2D Sprite Importer for NOIRADIX Studio (.pix2.json) exports.
    /// Slices multi-frame sprite sheets with exact padding/spacing bleed protection,
    /// sets sprite pivots, and automatically generates Unity .anim AnimationClips.
    /// </summary>
    public static class Pix2UnityImporter
    {
        [MenuItem("Tools/NOIRADIX/Import Pix2 Spritesheet JSON...")]
        public static void ImportPix2Menu()
        {
            string selectedPath = EditorUtility.OpenFilePanel("Select NOIRADIX Spritesheet JSON", "Assets", "json");
            if (string.IsNullOrEmpty(selectedPath)) return;

            ImportPix2Json(selectedPath);
        }

        [MenuItem("Assets/NOIRADIX/Import Spritesheet & Animations", false, 30)]
        public static void ImportSelectedAsset()
        {
            var selected = Selection.activeObject;
            if (selected == null) return;
            string path = AssetDatabase.GetAssetPath(selected);
            if (!path.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            {
                EditorUtility.DisplayDialog("NOIRADIX Importer", "Please select a NOIRADIX .json spritesheet file.", "OK");
                return;
            }
            ImportPix2Json(Path.GetFullPath(path));
        }

        [MenuItem("Assets/NOIRADIX/Import Spritesheet & Animations", true)]
        public static bool ValidateImportSelectedAsset()
        {
            var selected = Selection.activeObject;
            if (selected == null) return false;
            string path = AssetDatabase.GetAssetPath(selected);
            return path.EndsWith(".json", StringComparison.OrdinalIgnoreCase);
        }

        public static void ImportPix2Json(string fullJsonPath)
        {
            try
            {
                if (!File.Exists(fullJsonPath))
                {
                    Debug.LogError($"[NOIRADIX] File not found: {fullJsonPath}");
                    return;
                }

                string jsonText = File.ReadAllText(fullJsonPath);
                Pix2Data data = JsonUtility.FromJson<Pix2Data>(jsonText);
                if (data == null || data.frames == null || data.frames.Length == 0)
                {
                    Debug.LogError("[NOIRADIX] Invalid or empty NOIRADIX JSON format.");
                    return;
                }

                string dir = Path.GetDirectoryName(fullJsonPath);
                string safeImageName = Path.GetFileName(data.meta.image);
                string pngPath = Path.Combine(dir, safeImageName);
                if (!File.Exists(pngPath))
                {
                    string altPng = Path.ChangeExtension(fullJsonPath, ".png");
                    if (File.Exists(altPng)) pngPath = altPng;
                    else
                    {
                        Debug.LogError($"[NOIRADIX] PNG image not found at: {pngPath}");
                        return;
                    }
                }

                string assetPngPath = ToAssetPath(pngPath);
                TextureImporter importer = AssetImporter.GetAtPath(assetPngPath) as TextureImporter;
                if (importer == null)
                {
                    AssetDatabase.ImportAsset(assetPngPath, ImportAssetOptions.ForceUpdate);
                    importer = AssetImporter.GetAtPath(assetPngPath) as TextureImporter;
                }

                if (importer == null)
                {
                    Debug.LogError($"[NOIRADIX] Failed to obtain TextureImporter for {assetPngPath}");
                    return;
                }

                importer.textureType = TextureImporterType.Sprite;
                importer.spriteImportMode = SpriteImportMode.Multiple;
                importer.filterMode = FilterMode.Point;
                importer.textureCompression = TextureImporterCompression.Uncompressed;
                importer.mipmapEnabled = false;
                importer.spritePixelsPerUnit = data.meta.cellWidth > 0 ? data.meta.cellWidth : 16;

                List<SpriteMetaData> metas = new List<SpriteMetaData>();
                int texH = data.meta.size.h;

                foreach (var frame in data.frames)
                {
                    SpriteMetaData sm = new SpriteMetaData();
                    sm.name = frame.name;
                    int unityY = texH - frame.y - frame.h;
                    sm.rect = new Rect(frame.x, unityY, frame.w, frame.h);
                    sm.alignment = (int)SpriteAlignment.Custom;
                    sm.pivot = new Vector2(frame.pivotX, frame.pivotY);
                    metas.Add(sm);
                }

                importer.spritesheet = metas.ToArray();
                EditorUtility.SetDirty(importer);
                importer.SaveAndReimport();

                AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);

                UnityEngine.Object[] loadedSprites = AssetDatabase.LoadAllAssetsAtPath(assetPngPath);
                Dictionary<string, Sprite> spriteMap = new Dictionary<string, Sprite>();
                foreach (var obj in loadedSprites)
                {
                    if (obj is Sprite s) spriteMap[s.name] = s;
                }

                int createdClips = 0;
                string animDir = Path.Combine(Path.GetDirectoryName(assetPngPath), "Animations");
                if (!Directory.Exists(animDir)) Directory.CreateDirectory(animDir);

                if (data.animations != null)
                {
                    foreach (var anim in data.animations)
                    {
                        if (anim.frameNames == null || anim.frameNames.Length == 0) continue;

                        AnimationClip clip = new AnimationClip();
                        clip.frameRate = anim.fps > 0 ? anim.fps : 6;

                        if (anim.loop)
                        {
                            AnimationClipSettings settings = AnimationUtility.GetAnimationClipSettings(clip);
                            settings.loopTime = true;
                            AnimationUtility.SetAnimationClipSettings(clip, settings);
                        }

                        EditorCurveBinding binding = new EditorCurveBinding();
                        binding.type = typeof(SpriteRenderer);
                        binding.path = "";
                        binding.propertyName = "m_Sprite";

                        List<ObjectReferenceKeyframe> keyframes = new List<ObjectReferenceKeyframe>();
                        float frameDuration = 1f / clip.frameRate;

                        for (int i = 0; i < anim.frameNames.Length; i++)
                        {
                            string fName = anim.frameNames[i];
                            if (spriteMap.TryGetValue(fName, out Sprite sp))
                            {
                                ObjectReferenceKeyframe key = new ObjectReferenceKeyframe();
                                key.time = i * frameDuration;
                                key.value = sp;
                                keyframes.Add(key);
                            }
                        }

                        if (keyframes.Count > 0)
                        {
                            AnimationUtility.SetObjectReferenceCurve(clip, binding, keyframes.ToArray());
                            string clipPath = $"{animDir}/{anim.clipName}.anim";
                            AssetDatabase.CreateAsset(clip, clipPath);
                            createdClips++;
                        }
                    }
                }

                AssetDatabase.SaveAssets();
                AssetDatabase.Refresh();

                Debug.Log($"[NOIRADIX] Successfully imported '{Path.GetFileName(pngPath)}': Sliced {metas.Count} frames and created {createdClips} Animation Clips!");
                EditorUtility.DisplayDialog("NOIRADIX Importer", $"Import Complete!\\n\\nSliced: {metas.Count} frames\\nClips Created: {createdClips}\\nTarget: {assetPngPath}", "OK");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[NOIRADIX] Import failed: {ex.Message}\\n{ex.StackTrace}");
            }
        }

        private static string ToAssetPath(string fullPath)
        {
            string projectPath = Path.GetFullPath(Application.dataPath + "/..").Replace('\\\\', '/');
            string norm = fullPath.Replace('\\\\', '/');
            if (norm.StartsWith(projectPath, StringComparison.OrdinalIgnoreCase))
            {
                return norm.Substring(projectPath.Length).TrimStart('/');
            }
            return fullPath;
        }

        [Serializable]
        public class Pix2Data
        {
            public Pix2Meta meta;
            public Pix2Frame[] frames;
            public Pix2Anim[] animations;
        }

        [Serializable]
        public class Pix2Meta
        {
            public string image;
            public int cellWidth;
            public int cellHeight;
            public Pix2Size size;
        }

        [Serializable]
        public class Pix2Size
        {
            public int w;
            public int h;
        }

        [Serializable]
        public class Pix2Frame
        {
            public string name;
            public int x;
            public int y;
            public int w;
            public int h;
            public float pivotX = 0.5f;
            public float pivotY = 0f;
        }

        [Serializable]
        public class Pix2Anim
        {
            public string clipName;
            public float fps = 6;
            public bool loop = true;
            public string[] frameNames;
        }
    }
}`;
        const readmeUnityText = `================================================================================
NOIRADIX STUDIO — Unity 2D Sprite Package Quickstart Guide
================================================================================

Package Contents:
  1. ${pngName}
     - High-resolution sprite sheet atlas with anti-bleed padding & extrusion.
  2. ${baseName}.pix2.json
     - Precise slice boundaries, custom pivots, and animation sequence metadata.
  3. Pix2UnityImporter.cs
     - Automatic 1-click Unity editor importer script.
  4. README_UNITY_IMPORT.txt
     - This instruction guide.

--------------------------------------------------------------------------------
HOW TO IMPORT INTO YOUR UNITY PROJECT (3 Easy Steps):
--------------------------------------------------------------------------------

STEP 1: PLACE THE C# SCRIPT IN AN "Editor" FOLDER
  - Copy "Pix2UnityImporter.cs" into your Unity project's Editor directory:
      Assets/Editor/Pix2UnityImporter.cs
      (or Assets/_Game/Editor/Pix2UnityImporter.cs)
  * Note: Unity requires editor tools to be placed inside a folder named "Editor".

STEP 2: PLACE THE SPRITESHEET AND METADATA TOGETHER
  - Copy "${pngName}" and "${baseName}.pix2.json" into any folder inside Assets:
      e.g. Assets/_Game/Art/Sprites/
  * Note: Keep both the .png and .json files in the SAME directory.

STEP 3: 1-CLICK AUTOMATIC IMPORT
  - Method A (Right-Click Context Menu):
      In Unity Project Window, RIGHT-CLICK the "${baseName}.pix2.json" file
      -> Select "NOIRADIX > Import Spritesheet & Animations".

  - Method B (Top Menu Bar):
      In Unity's top menu bar, click "Tools > NOIRADIX > Import Pix2 Spritesheet JSON..."
      and select the .json file.

--------------------------------------------------------------------------------
WHAT THE IMPORTER DOES AUTOMATICALLY:
--------------------------------------------------------------------------------
  [x] Sets Texture Type to "Sprite (2D and UI)" with Sprite Mode = "Multiple".
  [x] Sets Filter Mode to "Point (no filter)" for crisp pixel-perfect art.
  [x] Sets Texture Compression to "None / Uncompressed".
  [x] Automatically slices all frames with exact pixel bounds and custom pivots.
  [x] Automatically creates native Unity Animation Clips (.anim) in an "Animations/"
      subfolder with preconfigured frame rates and looping!

Ready to drag directly into your Scene or Animator Controller!
NOIRADIX Studio: https://github.com/dotlinux26/noiradix-studio
`;

        const scriptBytes = new TextEncoder().encode(importerScript);
        const readmeBytes = new TextEncoder().encode(readmeUnityText);

        const zipBlob = createZip([
          { name: pngName, data: pngBytes },
          { name: `${baseName}.pix2.json`, data: jsonBytes },
          { name: 'Pix2UnityImporter.cs', data: scriptBytes },
          { name: 'README_UNITY_IMPORT.txt', data: readmeBytes },
        ]);

        downloadBlob(zipBlob, `${baseName}_unity_package.zip`);
        showToast(`Exported Unity 2D Sprite Package (${baseName}_unity_package.zip)!`, 'success');
        closeGameExportModal();
        return;
      }

      if (currentExportFormat === 'texturepacker') {
        const pngBytes = await canvasToUint8Array(atlasData.canvas);

        // TexturePacker Hash Format
        const tpFrames = {};
        atlasData.frameRects.forEach((fr) => {
          const safeFrameName = PIX2.sanitizeKey(fr.name || fr.id);
          tpFrames[safeFrameName] = {
            frame: { x: fr.x, y: fr.y, w: fr.w, h: fr.h },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: fr.w, h: fr.h },
            sourceSize: { w: fr.w, h: fr.h },
            pivot: { x: opts.pivot.x, y: opts.pivot.y },
          };
        });

        const tpAnimations = {};
        const anims = doc.animations || {};
        for (const k in anims) {
          if (!PIX2.isSafeIdentifier(k)) continue;
          tpAnimations[k] = (anims[k].frames || []).map((cid) => {
            const c = doc.cells[cid];
            return c && c.name ? c.name : cid;
          });
        }

        const tpData = {
          frames: tpFrames,
          animations: tpAnimations,
          meta: {
            app: `NOIRADIX Studio ${NOIRADIX_VERSION.studio.displayVersion}`,
            version: NOIRADIX_VERSION.studio.version,
            formatVersion: '1.1',
            image: pngName,
            format: 'RGBA8888',
            size: { w: atlasData.width, h: atlasData.height },
            scale: `${opts.scale}`,
          },
        };

        const readmeTpText = `================================================================================
NOIRADIX STUDIO — TexturePacker Standard JSON Package Guide
================================================================================

Package Contents:
  1. ${pngName}
     - High-resolution transparent sprite atlas with bleed protection.
  2. ${baseName}.json
     - Industry standard TexturePacker Hash format with frame rects and animations.
  3. README_TEXTUREPACKER.txt
     - This guide.

--------------------------------------------------------------------------------
HOW TO USE IN POPULAR GAME ENGINES:
--------------------------------------------------------------------------------

1. GODOT 4:
   - Copy "${pngName}" and "${baseName}.json" into your Godot project.
   - Use SpriteFrames importer or load as an AtlasTexture resource.

2. PHASER 3:
   - In your Scene preload method:
       this.load.atlas('${baseName}', 'assets/${pngName}', 'assets/${baseName}.json');

3. PIXI.JS:
   - Load using the modern Assets loader:
       const sheet = await PIXI.Assets.load('assets/${baseName}.json');

4. DEFOLD / RAYLIB / GAMEMAKER:
   - Direct support for TexturePacker JSON Hash coordinates.

NOIRADIX Studio: https://github.com/dotlinux26/noiradix-studio
`;

        const jsonBytes = new TextEncoder().encode(JSON.stringify(tpData, null, 2));
        const readmeBytes = new TextEncoder().encode(readmeTpText);

        const zipBlob = createZip([
          { name: pngName, data: pngBytes },
          { name: `${baseName}.json`, data: jsonBytes },
          { name: 'README_TEXTUREPACKER.txt', data: readmeBytes },
        ]);

        downloadBlob(zipBlob, `${baseName}_texturepacker.zip`);
        showToast(`Exported TexturePacker Package (${baseName}_texturepacker.zip)!`, 'success');
        closeGameExportModal();
        return;
      }

      if (currentExportFormat === 'zip-frames') {
        const cw = doc.meta.cellSize.w;
        const ch = doc.meta.cellSize.h;
        const files = [];

        for (const fr of atlasData.frameRects) {
          const cell = doc.cells[fr.id];
          const cellCanvas = createCanvas();
          cellCanvas.width = cw * opts.scale;
          cellCanvas.height = ch * opts.scale;
          const cctx = cellCanvas.getContext('2d');
          cctx.clearRect(0, 0, cellCanvas.width, cellCanvas.height);

          if (cell && cell.pixels) {
            for (const coord in cell.pixels) {
              const [px, py] = coord.split(',').map(Number);
              cctx.fillStyle = cell.pixels[coord];
              cctx.fillRect(px * opts.scale, py * opts.scale, opts.scale, opts.scale);
            }
          }

          const fBytes = await canvasToUint8Array(cellCanvas);
          files.push({ name: `${fr.name}.png`, data: fBytes });
        }

        const zipBlob = createZip(files);
        downloadBlob(zipBlob, `${baseName}_frames.zip`);
        showToast(`Exported ${files.length} individual frame PNGs (.zip)!`, 'success');
        closeGameExportModal();
        return;
      }
    }

    return { execute };
  }
  return { create };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = StudioExport;
