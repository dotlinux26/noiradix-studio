# Audit engine của Studio Sprite Editor và PixelArt

> Historical checkpoint. For the later RC2 refactor, corrections, completed regression gaps and current verification, see [EDITOR_REFACTOR_PROGRESS.md](EDITOR_REFACTOR_PROGRESS.md). Original results below retain their original scope.

PixelArt là chuẩn tham chiếu cho thao tác trên canvas, hình học và điều hướng. Studio là nguồn cho cây Structure & Layers và cách thao tác với dự án nhiều frame. Đích chung là một bộ quy tắc chỉnh sửa trong `js/`, với mỗi app cung cấp tài liệu đang mở, đích chỉnh sửa, lịch sử và UI của nó.

## Đối chiếu mã và bằng chứng

| Mảng | Nguồn được giữ | Đã dùng chung | Ca còn mở |
|---|---|---|---|
| Viewport | PixelArt có nấc dưới 1×, trần theo cạnh dài, Fit và thước giãn theo zoom | `viewport-pan-zoom.js`, `editor-rulers.js`. Cả hai dùng chung phép neo con trỏ, kích thước backing buffer của thước và cách vẽ vạch, nhãn, highlight. | Đo vẽ kéo dài trên artwork 1024², DPR 2 và dải viewport hẹp. PixelArt có giới hạn vẽ theo viewport, Studio hiện vẽ toàn bộ thước dài tối đa 512 pixel nguồn. |
| Panel và lệnh | Thanh công cụ dọc của PixelArt, cây Layers của Studio | `editor-toolbar.js`, `editor-outliner.js`, `editor-menu.js`. Browser so thứ tự, hình vuông nút, kéo thanh, kéo Layer, đổi tên và nhóm. | Kiểm focus khi đổi tài liệu, reparent phức tạp, cảm ứng và thao tác chỉ dùng bàn phím. |
| Tab tài liệu | Kiểu tab của Studio, điều hướng và reorder từ strip chung | `tab-strip.js` dựng markup và xử lý tương tác. `css/tab-strip.css` định kiểu cả hai. App cung cấp dữ liệu tab và callback mở, đóng, reorder. | Dùng hai file chung cho dự án khác. Đặt nút tạo tab cạnh strip để nút vẫn thấy khi cuộn. |
| Pixel và shape | Raster ellipse, bộ đệm 1× và composite gia tăng của PixelArt | `tools.js`, `structure-operations.js`, `pix2-format.js`, `editor-canvas.js`. Hai app dùng chung footprint, ellipse, checkerboard, composite điểm thay đổi, buffer pixel gốc và blit phần nhìn thấy. | Studio vẫn điều phối lịch sử, repaint overlay và Preview theo frame. Đo tiếp tải GPU, nét kéo dài trên artwork dày và DPR cao. |
| Region và Group | Focus và hierarchy của Studio, thao tác transform theo marquee | `region-selection.js`, `structure-operations.js`, `selection-transform.js`. Cùng hit-test, isolate, chọn nhiều, Group/Ungroup, di chuyển, nudge, scale và rotate. Tên tự sinh phân biệt sibling. Lệnh dùng ID, kể cả tên trùng. | Bổ sung ca group lồng, locked/hidden ancestor, Region chồng nhau, kéo ra biên, cancel và chuyển frame khi đang sửa. |
| Marquee và clipboard | PixelArt có lift/cancel, commit nổi và clipboard raster | Hai app dùng chung toán transform, handles, thao tác nhấc pixel kèm bản gốc và đặt/khôi phục pixel theo biên canvas trong `selection-transform.js`. PixelArt có cut/copy/paste raster. | Phiên gesture, preview và thời điểm commit vẫn riêng. Hợp nhất vòng đời marquee với đích cố định theo ID và một lần ghi history. Chốt hợp đồng clipboard đối tượng kèm cấu trúc, name và ID trước khi nối UI. |
| Lịch sử và file | PixelArt có diff/snapshot. Studio có lịch sử theo dự án và nhiều frame. | PIX2 parse, serialize, composite, quy tắc sửa tree và lưu workspace trình duyệt dùng chung. `editor-workspace-storage.js` dùng localStorage khi có chỗ và IndexedDB khi ghi localStorage thất bại. | Reload giữ tài liệu đã commit và tab đang mở. Lịch sử undo qua reload, Save đồng thời và quyền của nhiều native handle vẫn cần kiểm riêng. Draft quá quota cần IndexedDB ghi xong trước khi tải lại. |
| AI prompt | Grammar PIX2 1.1 và profile hiện tại | `pix2-ai-prompt.js` tạo rules chung và nhận brief theo app. | Kiểm cả đường generate và validate cho từng mode Studio bằng đầu vào có layer, alpha và giới hạn kích thước. |

## Thứ tự chuyển tiếp

1. Định nghĩa phiên marquee chung từ lúc nhấc pixel đến Enter hoặc Esc. Đầu vào là đích raster và kích thước canvas. Kết quả phải giữ ID đích, dữ liệu ban đầu để rollback và thay đổi để Undo/Redo.
2. Nối hai controller vào phiên chung và chạy cùng fixture cho click, kéo nhanh, resize, rotate, đổi tool, đổi layer/frame và cancel. Chốt cách commit cùng lúc với chuyển tab để tránh lưu bản đang nhấc pixel.
3. Đưa clipboard raster lên cùng API. Định nghĩa rõ copy/paste đối tượng Region/Group, cách cấp ID và xử lý tên trùng trước khi đưa lệnh ra UI.
4. Đo frame time thực và bộ nhớ với tác phẩm dày, cửa sổ hẹp và DPR cao. Giữ các luồng sprite sheet, Animation, Slice và export làm adapter riêng của Studio.

Các ca đã chạy và cách chạy lại nằm trong [sổ kiểm chứng](STABILIZATION_LEDGER.md). Quy tắc thao tác và phương án phím tắt isolation nằm trong [hợp đồng editor](EDITOR_BEHAVIOR.md).
