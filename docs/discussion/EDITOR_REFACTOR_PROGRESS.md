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
