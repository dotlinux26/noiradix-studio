# Báo cáo tiến độ tái cấu trúc editor

Baseline `2d5e751`, nhánh `rc2`. Mỗi phase cập nhật tại đây trước khi bước tiếp. Kế hoạch: `EDITOR_REFACTOR_PLAN.md`.

## P0 — Bản đồ và baseline

Trạng thái: đang hoàn tất regression browser bổ sung, 2026-11-11.

| Luồng | Studio entry / owner | PixelArt entry / owner | Shared hiện tại / quyết định |
|---|---|---|---|
| Document/session | createProjectSession, switchProjectSession; EditorState.doc | createPaProjectSession, switchPaProjectSession; state.doc | Parser/serializer và TabStrip chung; session adapter riêng. |
| Raster gesture | handleCellMouseDown/Move/Up, paintCellStroke | onPointerDown/Move/Up, paintBrush/paintRaster | Tools chung; orchestration khác, cần hợp đồng transaction trước khi gom. |
| Selection nổi | ensure/commit/cancelFloatingSelection; biến closure và cell/target ID | ensure/commit/cancelFloatingSelection; state.floating* | SelectionTransform chung; lifecycle và history còn riêng. |
| Region/group | RegionSelection instance + EditorState | RegionSelection instance + artwork adapter | StructureOps/RegionSelection/Outliner dùng chung; bảo toàn ID, ancestor guards và thứ tự. |
| History | EditorState.beginStroke/endStroke, full document snapshots | pushHistory/applyHistory, snapshot/diff theo artwork | Khác biệt chủ ý về scope; không thay stack/schema khi chuẩn hóa mutation. |
| Render/view | renderCellEditor, renderCellOverlay; buffer/zoom trên state | repaintCanvas, renderSelectionMarquee; buffer/zoom trên state | EditorCanvas/Rulers/Viewport chung; app quản lý invalidation riêng. |
| File/recovery | saveStudioSnapshot, watcher, persistAllProjectSessions | saveFileNative, watcher, persistPaWorkspace | FileSave và WorkspaceStorage chung; phần publication theo session còn riêng. |
| Palette library | localStorage, document palette, Studio presets | storage adapter, active swatches + document palette, PixelArt presets | Dropdown/library lặp; danh sách preset và nguồn màu khác chủ ý. Lát cắt P1 giữ cấu hình riêng. |
| Grid/slice/animation/atlas | Studio shell | Không có nghiệp vụ tương ứng | Tách controller riêng; không đưa vào standalone engine. |

Các thay đổi agent trước được liệt kê theo commit trong kế hoạch. Không suy từ báo cáo rằng code đã đồng nhất. Code hiện có xác nhận nhiều helper đã chung nhưng ownership/lifecycle còn ở hai controller lớn.

### Kiểm chứng bổ sung

- Thêm watcher native-handle read bị trì hoãn: bắt đầu ở A, chuyển B, trả kết quả A; B giữ nguyên source. Chạy cả hai app.
- Thêm Studio export: Fit sau mở modal; zoom không draw lại raster; quá giới hạn thì disable; giảm scale thì hoạt động lại.
- Các số baseline RC2: wheel p95 Studio 7.2ms, PixelArt 4.1ms trên Chrome 157, khổ 512, DPR 2. Đây là mẫu đo, không phải cam kết mọi máy.

### Phát hiện cần giữ khi refactor

- PixelArt pushHistory tăng revision trước khi một số nhánh phát hiện no-op. Cần kiểm tra trong P2, không nhân nguyên mẫu này thành luật chung.
- Selection nổi của Studio gắn cell ID, PixelArt gắn artwork/session qua state. Scope phải được chụp trước thao tác; không lookup active target lúc commit.
- Palette có khác biệt chủ ý: Studio chỉ lấy palette tài liệu, PixelArt lấy activeSwatches rồi palette. Hợp nhất renderer/library không được âm thầm đổi nguồn màu.

### Kết quả P0

P0 hoàn tất bản đồ theo entry point hiện tại và kiểm thử bổ sung. Native watcher trễ qua cả hai app; export Fit, không raster lại khi zoom, chặn kích thước quá giới hạn và phục hồi khi giảm scale đều qua Chrome 157. Bài Fit chờ CSS transition kết thúc trước đo bounding box. Đây không phải thay đổi assertion để bỏ qua lỗi.

## P1 — Tách controller

Đang thực hiện lát cắt palette/library đầu tiên. Tách storage + dropdown chung vào `js/editor-palette-library.js`; app cung cấp preset, fallback, nhãn và DOM accessor. Nguồn lấy màu/save prompt vẫn thuộc app. Tiếp theo sẽ quyết định lát cắt dựa trên dependency, không gom toàn bộ app state vào module mới.

### P1 — Kết quả lát cắt đầu

Đã tách `EditorPaletteLibrary` (storage và dropdown dùng chung), `StudioAtlas` (raster và frame rect), `StudioExport` (đóng gói định dạng và ZIP). App chỉ cung cấp lựa chọn, tài liệu và các callback UI. Preset/fallback/nhãn và nguồn lấy màu của mỗi app giữ nguyên. Không tạo runtime dependency.

19 Node suites qua sau extraction. Browser workspace qua palette có tên chứa ký tự đặc biệt và các luồng hiện có; đang mở rộng kiểm tra tải gói Unity/TexturePacker/frame ZIP. Các controller grid/slice/animation còn nằm trong Studio app; P1 chưa hoàn tất toàn bộ phạm vi kế hoạch.

### P1 — Kiểm chứng controller đã tách

- Palette preset data đã có một nguồn; mỗi app nhận bản sao riêng, giữ bộ preset sẵn có.
- Studio normal entry point tải được gói Unity, TexturePacker và ZIP từng frame. Test đọc ZIP thực, JSON metadata và chữ ký PNG; không chỉ kiểm tra nút có callback.
- Workspace browser qua cả hai app, gồm palette library có tên chứa ký tự đặc biệt. 19 Node suites qua. Đã sửa thứ tự nạp preset trước EditorState; kiểm thử browser bắt được dependency khởi tạo này.
- Module atlas/export không tham chiếu state/DOM toàn app. App cấp request và callback UI. Refactor đang tiếp tục các controller còn lại; chưa đánh dấu P1 hoàn tất.

### P1 — Tách các controller Studio còn lại

Đã tách grid, animation/template, Import & Slice, code/AI và export thành các module Studio riêng. Grid/animation/source nhận document adapter chỉ có doc, active view và những phương thức history/cell cần thiết; view port giữ trạng thái riêng, callback giữa controller được gọi qua app. Không lấy session/file/autosave state vào engine.

Phát hiện RF-001: Apply Action Template gọi `updateStudioUI` không tồn tại. Tái hiện qua nút 4-dir: lỗi ReferenceError và modal không đóng dù tài liệu đã đổi. Đã bỏ lời gọi dư vì refreshAll đã render đúng active view. Thêm regression tạo template, đóng modal và Undo về source trước thao tác.

Quyết định về trình tự: editor gesture, selection và file lifecycle vẫn nằm trong adapter app để xử lý transaction ở P2/P3/P4; không di chuyển chúng cùng lúc với đổi quy tắc. Mục tiêu app shell chủ yếu khởi tạo là đích cuối P5, không phải điều kiện ép mọi closure ra file trong P1. P1 hoàn tất khi các controller trên và pipeline hiện có qua regression; không dựa vào số dòng.

### Kết quả P1

P1 hoàn tất theo ranh giới đã điều chỉnh ở kế hoạch: các controller Studio grid/slice/animation/source/export và palette đã tách; core gesture/history/lifecycle để dành cho các phase tiếp theo. 19 Node suites qua; browser workspace normal entry points cả hai app qua. Các gói Unity/TexturePacker/frame ZIP và action template/Undo qua. RF-001 đã được kiểm chứng sửa bằng thao tác UI thật.

Không có thay đổi định dạng hay storage schema. Không cài dependency runtime; Acorn chỉ dùng trong TEMP để xác định dependency khi di chuyển controller. Các callback giữa feature vẫn do app nối, không import chéo controller.

## P2 — Mutation và transaction

Đang bắt đầu: hợp nhất đường ghi raster và phát hiện thay đổi thực; giữ history adapter riêng. Ưu tiên brush/eraser/shapes và lỗi no-op làm tăng revision hoặc mất redo ở PixelArt.

### Kết quả P2

- Shared `Tools.editRaster` nhận source target tường minh, kích thước và emitter; trả changed keys, dirty bounds và diff tùy chọn. Không lookup app global, không DOM/history/autosave. Brush/eraser hai app và shapes Studio đi qua đường này; shapes PixelArt đã đi qua paintRaster adapter.
- Adapter vẫn xử lý ancestor/visibility qua target resolver hiện có, cập nhật composite/buffer và chốt history. Kích thước dùng cell.size khi có.
- RF-002 (PixelArt): pushHistory tăng revision/cắt redo trước khi phát hiện no-op. Đã đưa phát hiện thay đổi lên trước các side effect. Test production history xác nhận flat và structural no-op giữ clean/redo. Resize có cùng layers vẫn là thay đổi; bỏ check dư từng làm mất history của resize.
- 20 Node suites qua, gồm `test-editor-refactor.js`. Browser editor dense DPR2 và native lifecycle qua cả hai app. Wheel p95 mẫu Studio 7.1ms / PixelArt 2.2ms. Benchmark scale p95 15.45ms, max 24.48ms; không coi là mọi sample dưới 16ms.
- Phạm vi: chuẩn hóa mutation raster và publication no-op; vòng đời floating selection, clipboard và gesture chuyển tiếp P3. History stack/schema giữ riêng.

## P3 — Selection và gesture

Đang bắt đầu khảo sát hợp nhất lifecycle của floating selection và các phép flip/quarter-turn; giữ scope, baseline hủy và dữ liệu gốc khi scale/rotate.

### Kết quả P3

- `js/editor-floating-selection.js` dùng chung lift/paste/commit/cancel, ownership theo document/cell/target, flip và quarter-turn. Hai app giữ binding field/UI/history riêng qua adapter. Không có engine selection thứ hai thay thế RegionSelection; tiếp tục dùng geometry hiện có.
- Clipboard extraction dùng chung `SelectionTransform.copyPixels`; Studio giữ paste chốt ngay, PixelArt giữ paste nổi như UX hiện tại. Đây là khác biệt được bảo toàn, không phải hai thuật toán raster.
- RF-003: hai nút flip selection Studio gọi `flipSelection` không tồn tại, trong khi menu dùng executeSelectionFlip. Browser regression mới bắt ReferenceError; đã nối về canonical command. Flip H/V, rotate, Undo đều qua cả hai app.
- 20 Node suites qua. Test shared session kiểm tra baseline hủy bất biến, ancestor khóa sau lift, stale document không nhận nhầm pixel, paste-cancel không xóa destination và clipping khi commit. Test Escape cũ được đưa qua production lift thay cho tự tạo một phần state giả.
- Browser editor dense DPR2 qua hai app, bổ sung pointercancel/blur ngay trong drag, flip hai trục và các luồng region/isolation hiện có. Native lifecycle runner cũng qua hai app.
- Còn bước render/lifecycle P4: invalidation khi settlement hủy vì scope không còn active và chính sách đóng gói snapshot export/file. Viewport instance/history wiring tiếp tục riêng theo AGENTS.

## P4 — Render và lifecycle

Đang bắt đầu: kiểm tra buffer/cache ownership, invalidation và async snapshot; không đổi giao diện hoặc storage schema.

### Kết quả P4

- Shared `EditorCanvas.refreshSourceComposite` làm mới full composite của đúng source document sau cancellation, kể cả document đó không còn active. Không ghi isolation vào artwork cache.
- RF-004: export chờ PNG encoding rồi đọc metadata từ doc còn mutable. Controller hiện chụp metadata/animation ở thời điểm bắt đầu; ZIP từng frame chụp thêm pixel source. Unity/TexturePacker không nhân đôi raster không cần thiết. Browser test trì hoãn toBlob, đổi kích thước và animation của live doc, rồi xác nhận metadata vẫn thuộc snapshot ban đầu.
- RF-005: Studio source apply/watcher có đường publish parse result chưa validate; PixelArt watcher từ chối canvas nhưng để source lỗi trong textarea. Thêm `PIX2.parseValidated` dùng chung cho publication được di chuyển; parse() vẫn dành cho diagnostic tooling. PixelArt restore source/mode khi external reload thất bại. Native browser test xác nhận file có coordinate lỗi không thay document/source hiện tại ở cả hai app.
- Native tests bổ sung quyền ghi bị từ chối, hủy picker và retry; cả hai app qua. Đây là mô phỏng adapter trình duyệt, không phải OS picker thật.
- Workspace browser qua cả hai app, export snapshot và template regression qua. Node test xác nhận validated ingestion giữ PIX2 1.0 và cache phục hồi đúng document.
- Benchmark browser mới: Chrome 157, 1440x950, DPR2, sparse density 1/16, khổ Studio 16/64/512 và PixelArt 16/64/512/1024. Đã chờ dimension thực của tài liệu trước đo. Handler p95 Studio 3.1/4.1/4.3ms, PixelArt 6.6/6.1/5.9/6.3ms; max cao nhất 9.4ms. Đây là mẫu trên máy hiện tại, không phải frame latency, RSS hay chứng minh hiệu năng trên mọi máy. Heap/canvas-connected estimates được script in riêng; không bao gồm mọi GPU/offscreen allocation.
- Ranh giới: shared geometry/raster/cache rules; viewport instance, render scheduling và autosave/history wiring riêng từng app. Không hợp nhất schema lưu trữ trong đợt này.

## P5 — Dọn, tài liệu và gate cuối

Đang bắt đầu rà dependency/caller, chuẩn hóa runner CI để không bỏ sót suite mới, cập nhật hợp đồng/module map và kiểm tra toàn bộ trước push RC2. Không merge main.
