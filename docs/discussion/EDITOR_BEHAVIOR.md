# Quyết định thao tác chung cho hai editor

## Chọn và chỉnh sửa

| Thao tác | Hành vi |
|---|---|
| Chọn Layer trong Layers | Giới hạn việc tìm Region trên canvas vào Layer đó. Khi chưa chọn Layer, lần chọn canvas đầu tiên xác lập phạm vi. |
| Click Region Select | Hit-test theo thứ tự vẽ từ trên xuống. Vùng bị ẩn, khóa hoặc có alpha bằng 0 được bỏ qua. Vùng đang chọn có viền sáng, giữ nguyên khi rê chuột ra ngoài. |
| Click Region nằm trong Group | Chọn Group ngoài cùng trong phạm vi hiện tại. Kéo hoặc nhấn phím mũi tên dịch chuyển các Region trong Group cùng nhau. Giới hạn dịch chuyển theo toàn bộ bounding box để giữ pixel. |
| Shift, Ctrl hoặc Cmd và click | Thêm hoặc bỏ đối tượng khỏi tập chọn trên canvas hoặc trong Layers. Group gom các đối tượng liền nhau cùng parent để giữ thứ tự vẽ. Ungroup trả các con về đúng vị trí trong thứ tự đó. |
| Ctrl/Cmd+G hoặc Ctrl/Cmd+Shift+G | Group khi chọn nhiều node, Ungroup khi chọn đúng một Group. Dùng cùng lệnh với nút trên toolbar và Layers. Bỏ qua khi đang isolation, mở dialog hoặc nhập liệu. G riêng vẫn chọn Paint Bucket. |
| Double-click Region | Mở isolation đúng Region dưới con trỏ, kể cả khi nó nằm trong Group. Viewport ẩn các Region khác, giữ alpha hiện có và định tuyến thao tác raster vào Region cô lập. |
| Alt + double-click | Duyệt các Region có pixel tại điểm click trong Layer đang chọn, từ trước ra sau. Dùng tiếp khi đang isolation để sang Region bị che. Node ẩn, khóa hoặc trong suốt hoàn toàn được bỏ qua. |
| Esc | Hủy thao tác kéo chưa commit. Khi đang isolation, Esc trả về Region Select cùng focus ban đầu. Esc tiếp theo bỏ viền chọn. |
| Marquee | Chọn theo mặt nạ pixel. Copy, cut, paste, fill và biến đổi raster trong Studio đọc và ghi payload của Region đích. Trạng thái floating giữ đích từ lúc lift. |
| Brush và Eraser | Cọ vuông 1–32 px, mỗi công cụ có kích thước riêng. Cỡ lẻ bám tâm pixel, cỡ chẵn bám giao điểm lưới gần con trỏ. Viền dự báo dùng đúng footprint vẽ hoặc xóa, kể cả khi sát mép. Brush, Eraser và Ink mỗi mục có một dòng với thanh kéo và ô số đồng bộ. |
| Node opacity | Layer chỉnh 0–100% trên UI. Layer, Group và Region lưu 0–1 trong PIX2 1.1. Composite nhân alpha RGBA với opacity của Region và các node cha. Ink % ghi alpha vào nét vẽ. |

Giữ hai công cụ trên cùng toolbar vì chúng thao tác trên hai loại dữ liệu. Marquee thao tác trên pixel của một đích vẽ. Region Select thao tác trên node có định danh và cây Group. Kéo, nudge, scale và rotate áp dụng cho các Region con trong cùng khung tọa độ, giữ cây và ID. Scale và rotate dự báo khung trước khi commit. Clipboard đối tượng vẫn mở. [Adobe Illustrator về chọn Group](https://helpx.adobe.com/illustrator/desktop/manage-objects/select-objects/select-object-groups-and-nested-object-groups.html), [Adobe Illustrator về isolation](https://helpx.adobe.com/ie/illustrator/desktop/manage-objects/select-objects/isolate-objects.html), [Aseprite về cọ và opacity](https://aseprite.org/docs/context-bar).

**New Group** tạo folder trống. **Group** gom các node đã chọn và đề xuất tên `Group`, `Group 2`… theo các tên đã dùng trong cùng parent. Hai lệnh có icon riêng. Group và Ungroup có mặt trên toolbar chính và trong dải cuộn ngang của Layers. Double-click tên hoặc F2 để sửa nhãn, Enter xác nhận và Esc hủy. Hai Group có thể được đổi tên trùng nhau. Chọn, kéo, đổi thứ tự và Ungroup đều dùng ID ổn định. Tooltip tên hiện cả ID để phân biệt.

Layers dùng chung renderer và hiển thị trên cùng trước ở mỗi cấp Layer, Group và Region. Kéo lên hoặc dùng Move Up đưa node ra trước. Có thể thả Layer vào khe sát dòng hoặc qua các dòng con của Layer đích. File PIX2 tiếp tục lưu thứ tự từ sau ra trước, nên tác phẩm cũ giữ nguyên hình. Kéo mép giữa canvas và inspector để đổi độ rộng. Studio mặc định 360 px và mỗi app nhớ độ rộng riêng. Shift+Space đưa canvas về mức vừa khung.

Thu nhỏ Group hoặc Region dùng nearest neighbor trên lưới pixel và có thể mất chi tiết. Phóng trở lại dùng dữ liệu hiện tại. Undo khôi phục dữ liệu trước phép thu nhỏ. Nếu phép lấy mẫu làm mất toàn bộ pixel của bất kỳ Region có nội dung nào, cả phép biến đổi bị hủy và hiện tên Region cần giữ. Chọn Region khác trong Layers có thể thoát isolation và hiện lại toàn bộ hình, kể cả phần trước đó bị ẩn khỏi viewport.

Hai editor dùng cùng thanh công cụ dọc. Nút có khung vuông 34×34 px. Khi thanh tràn, giữ chuột kéo lên xuống ngay trên dải nút. Con trỏ đổi từ bàn tay mở sang nắm tay khi kéo và thao tác kéo không kích hoạt nút bên dưới.

Preview Studio có nút −, + và Fit, cùng zoom bằng bánh xe. Mép dưới điều chỉnh chiều cao. Khi bật Fit, ảnh tự vừa với viewport sau resize. Canvas giữ độ phân giải gốc của frame và dùng CSS để phóng ảnh.

## Ranh giới code

| Module | Trách nhiệm |
|---|---|
| `js/structure-operations.js` | Lookup kèm đường tổ tiên, kiểm quyền chỉnh sửa, hit-test, reparent, group và ungroup. |
| `js/region-selection.js` | Tập node được chọn theo cell/layer/isolation, preview viền, drag, nudge, scale và rotate. |
| `js/editor-outliner.js`, `js/editor-menu.js` | Cây Layers, đổi tên, menu canvas và menu node, reorder theo ID. |
| `js/editor-toolbar.js` | Một thanh công cụ dọc dùng chung cho hai editor, cùng thứ tự nút và icon. |
| `js/tab-strip.js`, `css/tab-strip.css` | Một component tab tài liệu theo giao diện Studio. `NoiraTabStrip.render(strip, sessions, activeId, options)` nhận session có `id`, `fileName` hoặc `title`, `filePath` và `isDirty` tùy chọn. App cung cấp `onActivate`, `onClose` và `onReorder`. |
| `js/pix2-ai-prompt.js` | Quy tắc PIX2 theo phiên bản và profile. Hai app dùng chung prompt với source canonical và brief riêng. |
| `js/tools.js` | Định tuyến đích raster, brush footprint, symmetry, clipping, alpha cọ, hình học và căn biên. |
| `js/pix2-format.js` | Composite chuẩn. Isolation và tính lại các pixel vừa đổi trả về view riêng để bảo toàn cache đầy đủ. Bản standalone được kiểm byte-for-byte. |
| `js/viewport-pan-zoom.js` | Hình học pan/zoom, nấc zoom, Fit và trần theo khổ canvas dùng chung cho PixelArt và Studio Sprite Editor. Chứa binder kéo thanh công cụ và resize panel. Hai thanh Slice dùng một lần đăng ký mỗi thanh. |
| `js/editor-rulers.js` | Bộ vẽ thước hai trục lấy từ PixelArt. Dùng chung nhãn giãn theo zoom, vạch phụ, DPR và highlight con trỏ/marquee. |
| `js/editor-canvas.js` | Checkerboard dùng lại, composite theo tọa độ cọ đổi, ghi pixel vào buffer 1×, blit phần canvas trong tầm nhìn và giữ điểm neo zoom theo vị trí layout thực. |
| Hai app controller | Nối DOM, viewport, history, autosave và luồng công việc riêng. PixelArt cập nhật composite theo các tọa độ vừa đổi trong stroke để tránh duyệt toàn bộ canvas ở mỗi pointermove. |

## Lỗi bổ sung phát hiện khi chạy thật

- Studio xử lý 0% layer opacity như 100% vì dùng `Number(value) || 100`. Input hiện chấp nhận 0 và giữ giá trị trước đó nếu nhập rỗng.
- Studio từng truyền nhầm thứ tự tham số khi preview ellipse. Thuật toán Studio cũng khởi đầu ở hai mép trên/dưới thay vì đường giữa, gây hình rỗng có pixel giữa và góc bị tô. Hai editor dùng thuật toán với điểm khởi đầu giữa từ PixelArt, cùng đường raster cho preview và commit.
- Nút Rotate 90° của Studio gọi sai tên API khi chưa có marquee. Hai editor hiện dùng chung phép xoay pixel đúng 90° cho marquee. Vùng đã được nhấc lên giữ preview cho tới Enter. Khung được dịch vào trong canvas nếu vừa. Nếu khung xoay lớn hơn canvas, thao tác dừng trước khi nhấc pixel.
- Studio từng dùng trần 64× cố định và in nhãn thước cách nhau 4 pixel nguồn. Với khổ lớn, Fit cần xuống dưới 100% và nhãn cũ chồng lên nhau. Hai editor dùng chung nấc 10%–64× và trần theo cạnh dài hơn. Cạnh dưới 128 px cho tối đa 64×, từ 128 px là 32×, từ 256 px là 16×, từ 512 px là 8×. Bộ vẽ thước giữ khoảng cách nhãn ít nhất 40 px CSS.
- PixelArt Undo khôi phục cây dữ liệu mới trong khi Layers giữ handler trỏ vào cây cũ. Sau Undo/Redo cấu trúc, Layers được render lại trước lần sửa tiếp theo.
- PixelArt chặn Esc nếu input kích thước vẫn giữ focus sau click canvas. Click canvas chuyển focus ra khỏi input để áp dụng giá trị và khôi phục phím tắt.
- Studio dùng hai binder kéo ngang trên cùng hai thanh Slice. Cả hai app dùng chung một binder theo viewport.
- Inspector của Slice từng dựng lại cả bảng sau mỗi phím nhập tên, tag hoặc số frame. Việc nhập hiện giữ focus, và đổi tag tính lại row thay vì giữ row cũ của atlas hoặc lưới.
- Studio Save/Undo dự án mới bị mất snapshot ban đầu khi adapter ghi đè history rỗng hoặc đổi index 0 thành -1.
- Banner bảo trì từng che modal Create và nhận click ở phần chữ nằm trên nút Delete Slice. Modal đứng trước banner. Chỉ nút đóng và Got it của banner nhận click. Tần suất vẫn là 30 phút.
- Studio commit Slice từng sửa thẳng dự án đang mở. PixelArt mở file qua fallback từng thay nội dung tab hiện tại. Hai luồng hiện tạo dự án riêng. PNG PixelArt đưa pixel alpha vào Region nguồn và báo kích thước vượt profile.

## Phương án phím tắt isolation

Double-click Region vào isolation, Esc thoát và giữ focus Region. Có thể bổ sung Ctrl+Enter hoặc Cmd+Enter cho người đang thao tác bằng bàn phím. Điều kiện đề xuất là một Region được chọn, đang mở canvas, không có marquee đang chờ xác nhận và focus ở ngoài ô nhập hoặc menu. Enter dành cho xác nhận marquee. Phương án phím mới đang ở mức thảo luận.

Xem [sổ kiểm chứng](STABILIZATION_LEDGER.md) và [audit engine chung](EDITOR_ENGINE_AUDIT.md) để biết case đã chạy và các mục tiếp theo.
