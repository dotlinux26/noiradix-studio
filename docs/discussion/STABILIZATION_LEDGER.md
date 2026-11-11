# Sổ kiểm chứng NOIRADIX Studio và PixelArt

> Historical checkpoint. For the later RC2 refactor, corrections, completed regression gaps and current verification, see [EDITOR_REFACTOR_PROGRESS.md](EDITOR_REFACTOR_PROGRESS.md). Original results below retain their original scope.

Baseline `a955c4d3c5cfa7a1e976df8bd0fc6839c429dc47`, nhánh `codex/editor-stabilization`. Checkout sạch lúc bắt đầu. Origin `dotlinux26/noiradix-studio`. Bộ Node 24.22.1 chạy 17 suite ở baseline, đều exit 0. Các trạng thái bên dưới áp dụng cho working tree trên baseline này.

## Nguồn và cách dùng

- **A** là tệp pasted mở đầu bằng “khá tệ khó dùng”, mục Master engineering execution prompt. Bảng dùng ID và số dòng A để đối chiếu cả yêu cầu lẫn tiêu chí thoát. Đây là bản kế hoạch được bàn giao cùng yêu cầu hiện tại.
- **H** là tệp Downloads về hai thanh ngang. Các báo cáo cũ trong H mô tả lịch sử, cần kiểm chứng lại ở commit hiện hành. Bốn pasted file mở đầu bằng cùng câu về hai thanh ngang có SHA-256 giống nhau. Pasted file mở đầu bằng bốn tab chứa các yêu cầu bổ sung về workspace, import và responsive.
- **S1–S3** là ba tài liệu [hợp đồng](../PIXELART/Discussions/NOIRADIX_v2_0_Phase_0_Contract_and_Architecture_Audit.md), [thiết kế sản phẩm](../PIXELART/Discussions/NOIRADIX_v2_0_PIX2_v1_1_Architecture_and_Product_Spec.md) và [kế hoạch cùng phụ lục modular](../PIXELART/Discussions/NOIRADIX_v2_0_Agentic_Implementation_Prompt.md). [Checkpoint trước](../PIXELART/Discussions/NOIRADIX_v2_0_EXECUTION_CHECKPOINT.md) là dữ liệu đối chiếu. Tài liệu chuẩn ở [PIX2](../../PIX2_SPECIFICATION.md), [sản phẩm](../PRODUCT_SPEC.md), [UX](../UX_AND_INTERACTION_SPEC.md), [selection](../SELECTION_AND_CONTEXT_MENU.md), [file lifecycle](../FILE_LIFECYCLE_SPEC.md) và [history/recovery](../HISTORY_AUTOSAVE_RECOVERY_SPEC.md).
- Hai link ChatGPT Share trong yêu cầu và A đều timeout khi truy xuất. Checkpoint ChatGPT còn lại trả về trang không có nội dung đọc được. A còn dẫn transcript 5.128 dòng, chưa xác nhận có bản đầy đủ trong tệp nhận được. Giữ các dòng cần đối chiếu chéo ở trạng thái mở.
- Bốn ảnh được dùng để nhận diện màn hình Import & Slice, dải bốn tab, hộp New PIX2 và panel chuyển đổi 1.0. Kết quả trên ảnh chỉ ghi nhận UI ở thời điểm chụp.
- Quy trình chuẩn của repo nằm ở [AGENTS.md](../../AGENTS.md). Mỗi lần cập nhật ghi riêng tình trạng code, kết quả Node, thao tác browser và môi trường. Chỉ đánh dấu PASS cho kịch bản thực sự chạy.

## Thứ tự thực hiện

1. Bảo toàn pixel và đúng đích ghi. Bắt đầu với layer/region bị ẩn hoặc khóa, isolation, cache composite và Undo.
2. Đồng bộ công cụ thường dùng ở hai editor. Chọn vùng theo layer, viền focus, isolation, group, kích thước cọ/tẩy và opacity. Tiếp theo kiểm tra marquee, clipboard, scale, rotate, align, tool shortcuts và các thao tác thoát giữa chừng.
3. Kiểm tra workspace và các đường vào sản phẩm. New/Open/Close, drag-scroll, resize và Import & Slice đi trước animation và export. Kiểm tra đúng phiên làm việc khi save hoặc reload đang chờ.
4. Chạy lại ma trận tương thích, hiệu năng trình duyệt, conformance và release. Tách phần điều khiển chung theo từng luồng đã có bài kiểm tra, giữ adapter UI và vòng đời riêng theo sản phẩm.

## Yêu cầu trực tiếp và lỗi lịch sử

| ID | Nguồn | Hành vi cần kiểm | Tình trạng |
|---|---|---|---|
| EDIT-01 | Yêu cầu hiện tại | Click Region Select theo layer, viền tồn tại qua hover, chọn nhiều và thao tác giống marquee nơi phù hợp | Đã tích hợp viền, chọn nhiều, kéo, nudge, scale và rotate. Clipboard đối tượng vẫn mở |
| EDIT-02 | Yêu cầu hiện tại | Double-click vùng, ẩn vùng khác, mọi nét vào đúng region, Esc trả focus | Đã tích hợp hai app. Cần kiểm từng công cụ, thao tác chuyển lớp/file và hủy gesture |
| EDIT-03 | Yêu cầu hiện tại | Group/Ungroup trên toolbar, kéo group giữ vị trí tương đối | Đã tích hợp. Group giữ thứ tự bằng cách giới hạn các phần tử liền nhau cùng parent. Cần kiểm nested group và phím tắt |
| EDIT-04 | Yêu cầu hiện tại | Tách phần chung và thống nhất khác biệt editor mode | Đã tách chọn vùng và dùng chung compositing, brush geometry, target guard. History, marquee lifecycle và shortcut còn riêng |
| EDIT-05 | Yêu cầu hiện tại | Kích cỡ cọ và tẩy, opacity bút, opacity layer PIX2 | Đã tích hợp. PIX2 1.1 có RGBA trên pixel và opacity Layer. Thuộc tính opacity Group/Region trong bản spec cần đối chiếu parser/serializer |
| EDIT-06 | Yêu cầu hiện tại | Thống nhất hay tách chọn pixel và chọn đối tượng | Giữ hai mode cùng toolbar. Marquee chọn mặt nạ pixel, Region Select thao tác node có ID. Layer là phạm vi, Group là đối tượng di chuyển, Region là đích vẽ |
| UI-01 | H và pasted ngắn | Hai thanh Slicing Viewport và Slices & Tagging kéo ngang, một hàng, nút vẫn click | Có wiring baseline, cần kiểm ở màn hẹp |
| UI-02 | H, ảnh 2 | Grid, Animation, Import & Slice, Code & AI luôn đứng trước cell tabs | Có wiring baseline, cần kiểm chuỗi mở/đóng nhiều cell |
| UI-03 | H | Grid có zoom tại con trỏ và Hand | Có wiring baseline, cần kiểm hướng và giới hạn |
| UI-04 | H và pasted ngắn | Slice pan hai trục, zoom neo con trỏ, overlay chữ/handle sắc | Có wiring baseline, cần kiểm trực tiếp nhiều zoom và DPR |
| UI-05 | H | Resize frame sau khi tạo, không mất pixel khi expand, có thước/lưới và chọn đúng pixel | Có nút và Node coverage. Cần browser và crop/expand/Undo |
| UI-06 | H | Tag là row, Frame # là col. Manual/auto tag, edit slice và alpha PNG chính xác | Đã sửa ưu tiên tag chéo và chặn trùng ô khi import tab mới. Cần kiểm fixture PNG và UI |
| UI-07 | H | Discord hiển thị icon đúng khi offline | Assets/wiring baseline, cần kiểm browser offline |
| UI-08 | H, ảnh 3 | Tạo file mặc định 1.1, tab cũ giữ nguyên, preset và summary khớp | Tạo document mặc định 1.1 trong engine. Cần kiểm modal/preset |
| UI-09 | H | Nút cộng hiện và hoạt động sau New/Close, Alt+N, dự án hiện hành đủ tương phản | Có nút và wiring baseline. Cần xác minh cả hai app ở trạng thái trống và màn hẹp |
| UI-10 | H | Đóng tab cuối danh sách đúng đối tượng, các tab còn lại giữ nội dung | Có bản sửa a955c4d. Cần kiểm duplicate names, đóng inactive, active và tab cuối |
| UI-11 | H | Hết tab hiển thị Drop/Open/New, chỉ lưu tab mở và giải phóng tab đóng | Có wiring baseline. Cần reload sau discard và phân biệt session storage với memory thực đo |
| UI-12 | H | Import code, PNG/slice và mở file sinh tab độc lập | Đã sửa commit PNG/slice tạo tab độc lập. Cần test các đường vào khác và file lỗi |
| UI-13 | H, ảnh 4 | Layers trên Palette, ba nút cấu trúc căn đều, đọc được ở màn hẹp | Bố cục baseline. Cần kiểm overflow, focus và kích thước |
| UI-14 | H | Inspector resize và xem được toàn bộ thông tin | Đã thêm splitter chiều rộng bên cạnh splitter chiều cao. Bố cục xếp dọc dưới 760 px |
| UI-15 | H | Banner song ngữ, header tiếng Anh, đóng được, xuất hiện lại 30 phút, responsive, module có toggle | Baseline có module. Cần kiểm bằng đồng hồ ảo |
| UI-16 | H | Không lỗi ReferenceError hoặc viewport trắng sau New/Import | Cần kiểm console qua các lối vào |
| UI-17 | A, ảnh 1 | Chọn hình chữ nhật tự do và chỉnh slice khi thiếu metadata | Có module manual slice. Cần kiểm tạo, chỉnh, xóa, hủy qua browser |
| UI-18 | A, ảnh 4 | Convert 1.0 sang 1.1 rồi vẽ ngay | Có pipeline migrate. Cần kiểm bằng Ghost và hình alpha nhiều cell |
| UI-19 | H | `rgbaToHex` trong Slicing không ném lỗi | Có fallback baseline. Cần fixture PNG qua UI và màu biên |

## Kế hoạch theo ID của tài liệu bàn giao

Mỗi hàng giữ mốc tham chiếu tới phần điều tra và tiêu chí thoát. **Đang làm** nghĩa là đã có thay đổi hoặc kiểm tra một phần trong lượt này. **Mở** cần kiểm tiếp theo tiêu chí gốc. Bảng browser dưới đây quyết định phạm vi đã xác minh.

| ID | Mốc A | Phạm vi | Mục cần kiểm | Tình trạng |
|---|---|---|---|---|
| BASE-01 | L59–61 | Cả hai / dùng chung | Capture exact repository, HEAD, origin, tag resolution, dirty files and tooling | Đang làm |
| BASE-02 | L62–64 | Cả hai / dùng chung | Map AST ownership, composite consumers, selection/floating controller, target resolver, history, project session, disk handle, watcher, autosave, export, animation, viewport/rulers and UI components | Đang làm |
| BASE-03 | L65–67 | Cả hai / dùng chung | Read every named source | Đang làm |
| SAFE-01 | L72–74 | Cả hai / dùng chung | Reproduce Convert blanks the artwork with a copy of the Ghost fixture and a multi-cell animated 1.0 sample | Mở |
| SAFE-02 | L75–77 | Cả hai / dùng chung | Reproduce new layer → draw → hide → show still blank for Pen, Bucket and pasted pixels | Đang làm |
| SAFE-03 | L78–80 | Cả hai / dùng chung | Reproduce Escape deletes or hides artwork during marquee, lift/move, paste, resize, flip and rotate | Mở |
| SAFE-04 | L81–83 | Cả hai / dùng chung | Reproduce rotation grows selection bounds on repeated movement/rotation with a nonsquare asymmetric mask, transparent margins and multiple zoom levels | Mở |
| SAFE-05 | L84–86 | Cả hai / dùng chung | Reproduce Align drops artwork on structured and flat cells | Mở |
| SAFE-06 | L87–89 | Cả hai / dùng chung | Check stale active Group/Region after switching Layer, newly created layers without a Region, and lock/visibility/isolation transitions | Đang làm |
| IO-01 | L94–96 | Cả hai / dùng chung | Inspect pushHistory(), activeStrokeChanges, lastHistoryPixels, pointer-down/up and mutation marking | Đang làm |
| IO-02 | L97–99 | Cả hai / dùng chung | Trace saveFileNative(), enqueue order, revision, save sequence, active operation lock, writable stream completion and error paths | Mở |
| IO-03 | L100–102 | Cả hai / dùng chung | Trace autosave triggers and publication after successful save | Mở |
| IO-04 | L103–105 | Cả hai / dùng chung | Reproduce false orange Reload warning on focus, after native picker, after permission loss and after a 1024×1024 localStorage write failure leaves stale cached text | Mở |
| IO-05 | L106–108 | Cả hai / dùng chung | Trace manual reload, versioned pre-reload backup, IndexedDB/localStorage fallbacks, storage failure reporting and restore banner lifecycle | Mở |
| IO-06 | L109–111 | Cả hai / dùng chung | Verify native Open/Save/Save As, drag-and-drop handle adoption, file-input/download fallback, permissions revoked or denied, UTF-8, extension handling, dirty badge and beforeunload | Mở |
| IO-07 | L112–114 | Cả hai / dùng chung | Measure ruler lag while drawing, marquee dragging and panning, and check stale static ticks after pan | Mở |
| IO-08 | L115–117 | Cả hai / dùng chung | Audit historical regression claims test-by-test, including prior audit tests 19–24 and later data-loss tests | Mở |
| PIX-01 | L122–124 | Cả hai / dùng chung | Reconcile parser, normalized AST, serializer, validator, published EBNF, syntax highlighting, standalone distribution and normative fixtures | Mở |
| PIX-02 | L125–127 | Cả hai / dùng chung | Exercise immutable safe IDs, document-scope uniqueness, UTF-8 display names, tags, cell-local coordinates, parent types, sibling order, missing or cross-cell parent, cycles, deep trees, invalid alpha/opacity/blend, malformed references, resource profiles and prototype-pollution guards. | Mở |
| PIX-03 | L128–130 | Cả hai / dùng chung | Check 1.0 implicit legacy Layer/Region IDs on repeated load, v1.0 editing without migration, explicit upgrade, explicit downgrade/flatten and loss report | Mở |
| PIX-04 | L131–133 | Cả hai / dùng chung | Maintain the conformance corpus: minimal 1.0, Ghost, minimal 1.1, overlapping layers, nested Groups, distinct cell trees, platformer, invalid structure and migration/loss fixtures | Mở |
| CORE-01 | L138–140 | Cả hai / dùng chung | Reuse js/editor-state.js, js/tools.js and the pending js/structure-operations.js where correct | Đang làm |
| CORE-02 | L141–143 | Cả hai / dùng chung | Establish authoritative AST and invalidatable derived composites | Đang làm |
| CORE-03 | L144–146 | Cả hai / dùng chung | Unify commit/cancel boundaries and history for pixel and structural changes | Đang làm |
| CORE-04 | L147–149 | Cả hai / dùng chung | Break up oversized js/app.js and pixelart/js/pixelart-app.js incrementally | Đang làm |
| SEL-01 | L154–156 | Cả hai / dùng chung | Define selection states for idle, marquee, floating, gesture preview and committed/canceled | Đang làm |
| SEL-02 | L157–159 | Cả hai / dùng chung | Reuse and verify all eight resize handles in js/selection-transform.js | Mở |
| INP-01 | L160–162 | Cả hai / dùng chung | Trace pointerdown/move/up/cancel, capture, blur, keyboard modifiers, coordinate conversion, pan, wheel, overlays and tool/menu interactions | Đang làm |
| TOOL-01 | L163–165 | Cả hai / dùng chung | Build a capability matrix for each app covering Pen, Eraser, Bucket, Line, Rectangle, Circle/other documented shapes, picker and palette, selection/move/align/transform, canvas background, rulers/grid, navigation, symmetry, animation tools, Clear and clipboard | Đang làm |
| TOOL-02 | L166–168 | Cả hai / dùng chung | Verify bidirectional PIX2 Code and canvas editing, validation/Apply, Safe View/Auto-Lock where specified, theme and palette library behavior | Mở |
| TREE-01 | L173–175 | Cả hai / dùng chung | Add/verify create, rename, duplicate and delete for Layer, Group and Region | Đang làm |
| TREE-02 | L176–178 | Cả hai / dùng chung | Implement or repair drag/drop insertion, sibling reorder/swap, moving Regions/Groups within and between Layers, group/ungroup, Move To and explicit merge/flatten | Mở |
| TREE-03 | L179–181 | Cả hai / dùng chung | Separate keyboard focus, row selection, active edit target and optional focus/solo behavior | Đang làm |
| TREE-04 | L182–184 | Cả hai / dùng chung | Finish Region Select and metadata inspector | Đang làm |
| TREE-05 | L185–187 | Cả hai / dùng chung | Verify double-click Region/Group isolation, descendant scope, dimmed/hideable context, breadcrumb, visible Exit, Escape priority and outside double-click | Mở |
| UX-01 | L192–194 | Cả hai / dùng chung | PixelArt starts in Layers on a fresh session unless an intentional stored preference overrides it | Mở |
| UX-02 | L195–197 | Cả hai / dùng chung | Align shared tokens for surfaces, border, text, accent, spacing, radii, typography, control heights and hover/focus/selection/disabled states | Đang làm |
| UX-03 | L198–200 | Cả hai / dùng chung | Verify accessible panel navigation, draggable split pane and documented horizontal drag-scroll | Đang làm |
| ANIM-01 | L205–207 | Studio | Inspect js/animation-player.js, current Idle/Run initialization, template metadata, clip lookup and track layout | Mở |
| ANIM-02 | L208–210 | Studio | Wire template/action/facing selectors, FPS, loop/once/ping-pong, frame step, index/cell ID and missing-clip diagnostics | Mở |
| IMP-01 | L215–217 | Studio | Confirm a top-level Import & Slice workflow | Đang làm |
| IMP-02 | L218–220 | Studio | Match actual NOIRADIX .pix2.json exporter schema and TexturePacker Hash/Array | Mở |
| IMP-03 | L221–223 | Studio | Build a validate→decode→plan→preview/edit→name/order→map animations→commit flow | Đang làm |
| PROJ-01 | L228–230 | Cả hai / dùng chung | Separate frame resolution, animation template, sheet layout and project details | Mở |
| PROJ-02 | L231–233 | Cả hai / dùng chung | Verify post-create document/frame dimension changes | Mở |
| PROJ-03 | L234–236 | Cả hai / dùng chung | Make project tabs independent of cell tabs | Đang làm |
| PROJ-04 | L237–239 | Cả hai / dùng chung | Add/verify app-window drop overlay and routing for multiple .pix2, PNG, recognized atlas JSON with matching PNG, orphan metadata and documented ZIP packages | Mở |
| EXP-01 | L244–246 | Cả hai / dùng chung | Audit existing composite PNG, spritesheet, per-frame ZIP, metadata, Unity package and Animator Controller paths from their actual UI | Mở |
| EXP-02 | L247–249 | Cả hai / dùng chung | Inspect js/modular-export.js | Mở |
| EXP-03 | L250–252 | Cả hai / dùng chung | Define and verify deterministic engine-neutral ZIP/manifest with source/exporter/format identity, canvas, component types and IDs, hierarchy, order, assets, visibility/opacity/baked state, pivots/trim, and frame/state/facing/timing mappings | Mở |
| EXP-04 | L253–255 | Studio | Studio supports selected cells/clips, all or one component, per-component sheet or PNG sequence, optional composite | Mở |
| EXP-05 | L256–258 | Cả hai / dùng chung | Implement and verify a non-destructive Prepare for Modular Export proposal workflow within available capabilities | Mở |
| PERF-01 | L263–265 | Cả hai / dùng chung | Profile PixelArt 1024² sparse/dense art, repeated strokes, flood fill, large source updates and storage quota | Mở |
| PERF-02 | L266–268 | Cả hai / dùng chung | Measure single-layer 1.0, 1.1 five layers/40 Regions, Studio max 512², PixelArt at max profile, multi-cell grid, platformer playback, move/rotate/scale, PNG/atlas import, multiple tabs and viewport pan at deep zoom | Mở |
| QA-01 | L269–271 | Cả hai / dùng chung | Rerun workflow syntax checks, every existing suite, added behavioral tests, benchmark and browser matrix below against the exact review state | Đang làm |
| REL-01 | L272–274 | Cả hai / dùng chung | Use one version source for About and other version displays | Mở |
| REL-02 | L275–277 | Cả hai / dùng chung | Inspect current tag targets, GitHub Release entry, artifacts, Pages workflow and CI | Mở |
| REL-03 | L278–280 | Cả hai / dùng chung | Align product/UX, shortcut and file lifecycle docs, architecture/reuse map, PIX2 specification/EBNF/vectors, migration guide, platformer guide, import support matrix, modular manifest docs, README, docs index, changelog and release notes with verified behavior | Mở |


## Ma trận browser bàn giao

| Case | Studio | PixelArt | Phạm vi |
|---|---|---|---|
| B01 | Một phần | NOT RUN | Fixture 1.0 nhiều cell có alpha và animation, Convert rồi vẽ ngay, Undo/Redo. Còn Ghost qua Save As và mở lại |
| B02 | Một phần | Một phần | Target ownership và opacity. Còn chuỗi hide/show, paste, Save As |
| B03–B05 | NOT RUN | NOT RUN | Marquee cancel/commit, tám handles, rotation và align |
| B06 | Một phần | Một phần | Undo structural edit. Còn chuỗi paint/shape/clipboard và Code Apply |
| B07–B09 | NOT RUN | NOT RUN | Native file, queue, watcher và recovery |
| B10 | NOT RUN | NOT RUN | Rulers, dense art và pan/zoom trên nhiều DPR |
| B11 | Một phần | Một phần | Region Select, isolation và group. Còn outliner reorder/metadata/keyboard |
| B12 | Một phần | Một phần | Khởi động, modal Create và thao tác toolbar. Còn audit Layers/Code và access bằng phím |
| B13 | NOT RUN | N/A | Platformer |
| B14 | Một phần | N/A | PNG alpha, kéo tạo crop 3×3, sửa width và xóa crop, chỉnh tên/tag/frame và tab riêng. Còn resize bằng từng handle và toàn bộ atlas schema |
| B15 | Một phần | Một phần | New, đóng đúng tab, giữ dự án cũ khi import, reload sau đóng hết. Còn native handle, mixed drop và nhiều phiên qua reload |
| B16 | NOT RUN | Một phần | PixelArt tải PNG 2× trong isolation. Còn Studio composite, modular và Unity |
| B17 | NOT RUN | NOT RUN | About và release identity |

Các acceptance list S1–S3 và ma trận B01–B17 vẫn là điều kiện đóng checklist. Trạng thái Node hoặc đọc mã không thay thế kết quả thao tác UI.

## Môi trường và cách chạy lại

Windows, Node 24.22.1, Chrome 157.0.8103.39 qua Playwright headless. Hai ứng dụng dùng server tĩnh local và browser context mới. Các bài browser chặn request ra ngoài localhost để dùng đúng asset trong repo. Kích thước kiểm tra chính là 1440×950 cho editor, 1100×840 cho workspace và 820×840 cho hai thanh Slice.

Chạy server từ root repo trong một terminal.

```powershell
py -m http.server 8769 --bind 127.0.0.1
```

Chạy các lệnh kiểm chứng ở terminal khác. Playwright chỉ phục vụ QA và được cài trong thư mục tạm.

```powershell
$qa = Join-Path $env:TEMP 'noiradix-editor-qa'
npm.cmd install --prefix $qa playwright --no-audit --no-fund
$env:NODE_PATH = Join-Path $qa 'node_modules'
node tests/browser/test-editor.cjs
node tests/browser/test-workspace.cjs
Get-ChildItem tests/test-*.js | ForEach-Object { node $_.FullName }
node tests/benchmark-performance.js
git diff --check
```

| Kiểm tra | Dữ liệu và tiêu chí |
|---|---|
| Editor | Fixture 16×16 với hai Layer chồng nhau. So catalog thanh công cụ và kích thước nút vuông, kéo dọc qua nút mà không kích hoạt nút, kéo mép inspector, preview zoom và đổi chiều cao ở Studio. Kiểm ellipse rỗng/đầy qua preview và pixel đã commit ở cả hai app. Viền vùng, isolation, Esc, tâm cọ chẵn, đồng bộ slider/ô số, cắt trong Region và Undo, Ctrl-click Layers, rename, group/drag/nudge/rotate/scale/ungroup, opacity 50% rồi 0%, và đổi thứ tự Layer khi thả nhanh qua mép dòng. |
| Rotate, Zoom và thước | Cả hai app chạy nút Rotate 90° với marquee mới, marquee đã kéo và raster đang focus. Resize trực tiếp từ 16×16 lên 512×16, kiểm trần 8×, nấc kế tiếp 6×, Fit dưới 100% khi thu viewport, thước sát cạnh canvas và nhãn cách nhau ít nhất 40 px. Node kiểm hai chiều ở các ngưỡng 127/128, 255/256, 511/512 và 1024 px. |
| Tab tài liệu chung | Chrome so chiều cao, chiều rộng tối đa, padding, góc, font-size, màu nền và viền tab active ở hai app. Mở tab bằng nút +, đổi thứ tự bằng Alt+Mũi tên, đóng bằng Delete và xác minh đúng ID được giữ lại. |
| Phím Group/Ungroup | Chrome kiểm Ctrl+G sau khi chọn hai Region, bỏ qua khi ô số đang có focus, kéo Group vừa tạo để xác minh tool giữ nguyên, Ctrl+Shift+G và Undo. |
| Thứ tự Z và Region chồng nhau | Chrome kiểm Layer và Region trước nằm trên trong outliner, kéo Layer lên đổi đúng thứ tự PIX2, ẩn/hiện Region trên để lộ Region dưới, double-click chọn lớp trên, Alt+double-click chọn Region dưới. Scale nhỏ đến mức mất một Region bị hủy nguyên giao dịch. |
| Browser draft và reload | Chrome mở hai tab, vẽ lên tài liệu import, tải lại ngay trước debounce và so source, ID, thứ tự và tab đang mở. Giả lập localStorage hết quota, chờ IndexedDB ghi xong và reload để kiểm bản mới. Đóng tất cả rồi reload giữ workspace trống. Studio lưu chính danh sách tab mà startup đọc. PixelArt khôi phục danh sách tab và giữ đường kiểm disk baseline cho phiên native đang active. |
| Đường zoom 512×512 | Đo callback wheel trong Chrome bằng sự kiện có tọa độ theo cả hai chiều. Kiểm một fill nền và một blit ở mỗi nấc thay đổi, không dựng lại buffer 1×, ở 8× chỉ blit phần nhìn thấy và giữ neo con trỏ dưới 2 CSS px. Chạy thêm với `EDITOR_QA_DENSE=1` và `EDITOR_QA_DPR=2`. Đây là chi phí callback JS và layout đồng bộ, chưa bao gồm thời gian GPU trình bày frame. |
| Fit Grid Overview | Chrome DPR 2 mở sheet 4×4 có frame 512×512, Fit dưới 1×, thu nhỏ thêm, Shift+Space, rồi double-click đúng frame góc dưới phải. Canvas Grid giới hạn backing store 4096 px mỗi chiều. |
| Hợp đồng PIX2 1.1 | Vector `canonical_v11_opacity.pix2` kiểm thứ tự Group xen Region, alpha theo cả ba cấp, opacity 0, lưu/mở lại và byte parity compiler. Suite 1.1 kiểm opacity sai cú pháp, Group depth 16/17, cycle, Ungroup, flatten và modular export. |
| Studio workspace | Dự án Ghost sẵn có, tab mới và đóng đúng tab, ưu tiên bốn tab kể cả khi đã mở cell editor, hai thanh kéo bằng chuột và wheel, resize panel ngang, crop tay 3×3, chỉnh width, xóa, nhập tên nhiều ký tự, gán tag chéo và frame #2. Import PNG alpha vào dự án riêng và giữ nguyên source dự án ban đầu. |
| PixelArt workspace | PNG alpha qua file input, ghi vào Region, giữ source tab cũ, đóng hết rồi reload ở trạng thái trống. |
| Chuyển đổi Studio | `tests/fixtures/safe01_v10_multicell_alpha_clip.pix2`. So pixel và animation với nguồn, vẽ ngay sau Convert, Undo nét vẽ, Undo/Redo chuyển đổi. |
| Xuất PNG PixelArt | Download 2× trong isolation, giải mã PNG và kiểm kích thước 32×32 cùng pixel của Layer bị ẩn trong viewport. |
| Node | 17 suite exit 0. Bộ SAFE-02 kiểm kế thừa lock, hit-test theo Layer, alpha isolation và composite gia tăng giữ nguyên cache đầy đủ. Vectors kiểm hai compiler byte-for-byte. |
| Benchmark Node | 8 phép đo exit 0. Composite 5 Layer và 40 Region median 0,638 ms, p95 1,155 ms trong một lần đo. Đây là số đo trên Node. Browser p95, DPR và hiệu năng vẽ liên tục ở 1024² vẫn mở. |

Cả hai runner browser exit 0 trên working tree của lượt này. Các kết quả PASS chỉ bao phủ chuỗi thao tác và fixture ghi trong bảng.

## Điểm tiếp tục

1. `SAFE-03–05`, `SEL-01–02`, `TREE-03–05`. Kiểm toàn bộ cử chỉ marquee trên hai app. Chốt hợp đồng resize, rotate và clipboard đối tượng giữ cấu trúc. Kiểm switch file, focus cây, cancel và thao tác khi khóa.
2. `IO-02–06`, `PROJ-03–04`. Chạy các ca native handle, Save A/B và reload recovery bằng file thử. Kiểm nhiều tab qua reload và trạng thái file thay đổi khi đang ghi.
3. `IMP-02`, `ANIM-01–02`, `EXP-01–05`. Chạy thêm fixtures rotated/trimmed/multipage, animation và kiểm Unity trong ứng dụng đích.
4. `PERF-01–02`, `QA-01`, `REL-01–03`. Đo browser và kiểm conformance/release theo từng case đã có bằng chứng.
