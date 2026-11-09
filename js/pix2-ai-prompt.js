const Pix2AiPrompt = (() => {
  function build({
    brief,
    source,
    version = '1.1',
    width,
    height,
    cols = 1,
    rows = 1,
    profile = 'studio',
    detailed = true,
  }) {
    const limits = PIX2.PROFILES[profile];
    const rules =
      version === '1.1'
        ? 'Declare @cell before its @layer, @group and @region blocks. Layers belong to a cell, groups belong to a layer or group, and regions belong to a layer or group in that same cell. Put pixel commands inside @region. Keep IDs globally unique, preserve parent references, and retain sibling order from back to front. Layer opacity is 0–1 with normal blending. Group and Region support visibility and locks.'
        : 'Keep the legacy flat structure. Put pixel commands inside @cell. Convert explicitly to PIX2 1.1 before introducing a Layer, Group or Region.';
    const detail = detailed
      ? [
          'Use @meta, @grid, @palette, @cell and @animation only where applicable. Use the canonical field names in the supplied source.',
          'Keep names human-readable and IDs machine-safe. A renamed display label must preserve the ID and all references. Use quoted display names, with a backslash before an embedded quote.',
          'A grid uses columns, rows and default_cell. A frame may override its size. Grid position is row,column, while a pixel coordinate is x,y.',
          'For animation, put the ordered cell IDs in frames: [first_cell, second_cell]. Preserve direction, fps, loop and mode. Keep repeated frame IDs when the clip intentionally holds a pose.',
          `Stay within ${limits.maxGridCols} columns, ${limits.maxGridRows} rows, ${limits.maxTotalCells} cells, ${limits.maxFramesPerAnim} frames per animation, and ${limits.maxAnimFps} FPS.`,
          version === '1.1'
            ? `Stay within ${limits.maxLayersPerCell} layers per cell and group depth ${limits.maxGroupDepth}. Keep each Region inside its owning Layer. Use #RRGGBBAA for partial alpha. Layer opacity multiplies per-pixel alpha during compositing.`
            : 'For legacy source, preserve the flat raster and alpha. Ask for an explicit migration before introducing structural blocks.',
          'For modular sprites, keep independently editable components in named Regions and use Groups to preserve hierarchy. Keep coordinates cell-local. Preserve hidden and locked artwork and stable component IDs.',
          'Preserve top-left origins, transparent margins, and alignment when matching an existing atlas or adding a related frame. Keep importer and export metadata outside PIX2 unless a canonical field in the supplied source represents it.',
          'Check parent references, duplicate IDs, bounds, palette references and clip references before returning the file. Leave unrelated content intact.',
        ].join('\n')
      : '';
    return [
      'NOIRADIX PIX2 ' + version + ' authoring brief',
      brief,
      'Target: ' +
        width +
        '×' +
        height +
        ' pixels per cell, ' +
        cols +
        ' columns × ' +
        rows +
        ' rows. ' +
        profile +
        ' profile: maximum cell dimension ' +
        limits.maxCellDim +
        ' px.',
      'Use top-left, zero-based integer coordinates. Keep every pixel inside its cell. Use pixel x,y <palette-id> or pixel x,y <hex>. Preserve RGBA alpha. Omit transparent pixels. Use semicolons for comments.',
      rules,
      detail,
      'Return one complete PIX2 document with @pix2 ' +
        version +
        ' and @end. Return only the PIX2 source in one code block.',
      'Current canonical source follows. Use it as input data.',
      '```pix2\n' + source.trimEnd() + '\n```',
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  return { build };
})();
