# Kế hoạch tái cấu trúc engine editor sau RC2

Trạng thái: đề xuất để review; chưa triển khai refactor. Mốc code `2d5e751`, nhánh `rc2`, bản `2.1.2-beta.1`. Ngày 2026-11-11.

## Mục tiêu và mốc nghiệm thu

Người dùng xác nhận giao diện và cách sử dụng hiện tại cơ bản ổn. Giữ chúng làm mốc hồi quy. Công việc tiếp theo giảm logic tự triển khai ở mỗi app, làm rõ quyền sở hữu trạng thái và giúp thay đổi một quy tắc editor chỉ cần sửa một nơi. Không đổi framework, định dạng PIX2, storage schema hoặc thiết kế giao diện trong cùng đợt nếu không có lý do và quyết định riêng.

Số dòng chỉ là dấu hiệu để khảo sát. Thành công được đo bằng việc hai app đi qua cùng quy tắc, trạng thái có chủ sở hữu rõ ràng, lỗi có thể tái hiện và module có thể kiểm tra độc lập.

## Hiểu đúng thay đổi của agent trước

Đã đối chiếu lịch sử commit và các module liên quan; chưa xác minh mọi dòng hoặc mọi yêu cầu lịch sử.

| Commit | Thay đổi đã nhận diện | Bằng chứng hiện có / còn thiếu |
|---|---|---|
| `b3d9162` | Mở rộng generator prompt AI dùng chung và thêm test | Suite prompt đã qua trong RC2; chưa chứng minh chất lượng mọi kết quả AI sinh ra. |
| `20dc547` | Demo Reaper, chooser và tài liệu minh họa | RC2 sửa đường tạo session; browser kiểm tra giữ project và Undo đầu tiên. |
| `8f6c689` | Phiên bản 2.1.1, tài liệu feedback và timeout browser | Metadata đã đối chiếu; RC2 kế tiếp mang beta riêng. |
| `a20e2c1`, `00c5f59` | Cú pháp kích thước dùng dấu phẩy và diễn giải comment palette | Node suites hiện tại qua; RC2 bổ sung lexer chuỗi và giới hạn tài nguyên. |
| `c18600f`, `1f5a01c`, `c3393e5` | Ingestion PixelArt, headless guard, tạm tắt rồi bật lại browser CI | CI browser đã bật và xanh ở RC2; cần truy tiếp mọi nhánh mở/nhập khi tách lifecycle. |
| `6feb59e` | Export preview có vùng giới hạn, Fit và điều hướng | RC2 sửa thêm đo kích thước/modal, tái dùng raster; còn thiếu regression browser chuyên biệt. |

Đây là phần việc có sẵn phải bảo toàn, không viết lại theo báo cáo cũ. Trước khi di chuyển mỗi khu vực, đọc diff agent trước, truy entry point hiện tại và ghi rõ quyết định giữ/sửa/thay thế cùng bằng chứng.

## Khảo sát hiện trạng

`js/app.js` khoảng 11.975 dòng và `pixelart/js/pixelart-app.js` khoảng 5.980 dòng tại baseline. Studio còn chứa grid, slice, animation, export cùng editor; không phải tất cả các dòng đó là code trùng.

Đã có module dùng chung: parser/composite, tools, structure operations, selection transform, region selection, canvas helpers, rulers, pan/zoom geometry, toolbar, outliner, context menu, tab strip, workspace storage, file-write queue và AI prompts. Tiếp tục sử dụng chúng; không tạo engine mới song song.

Phần cần khảo sát sâu là orchestration: bắt đầu/kết thúc thao tác, selection nổi, clipboard, gắn mutation vào history/dirty/autosave, invalidation render, active session và sự kiện async. Cùng tên hàm chưa đủ chứng minh cùng nghiệp vụ.

## Kiến trúc đích

| Phần | Trách nhiệm |
|---|---|
| Engine dùng chung trong `js/` | Quy tắc chọn đích, ownership, thao tác raster/structure, lifecycle của gesture và command; không biết DOM ID, localStorage hay tab đang mở. |
| Adapter editor của mỗi app | Cấp document/cell/target hiện hành, mở transaction history, áp kết quả, báo dirty và yêu cầu render. Studio xử lý frame; PixelArt xử lý artwork. |
| Component giao diện dùng chung | Toolbar, tree, menu, ruler và canvas helpers hiện có; nhận callback rõ ràng. |
| App shell | DOM binding, viewport instance, history stack, autosave, session, file handle và các tính năng riêng. Studio giữ grid/slice/animation/atlas. |

Một thao tác chỉ có một chủ sở hữu commit history và dirty. Engine không tự lấy biến global của app. View state và buffer render không đi vào PIX2 export. Quy tắc có thể dùng chung, nhưng history stack, viewport và session của hai app vẫn độc lập theo AGENTS.md.

## Trình tự thực hiện

### P0 — Lập bản đồ trước khi di chuyển

- Lập bảng requirement → entry point Studio/PixelArt → shared module → adapter → test. Trạng thái gồm chưa kiểm tra, đã tái hiện, đã kiểm chứng; không suy từ mắt nhìn hoặc tên commit.
- Rà diff agent trước theo khu vực; đối chiếu `EDITOR_BEHAVIOR.md`, `EDITOR_ENGINE_AUDIT.md`, `STABILIZATION_LEDGER.md` và `RC2_AUDIT.md`.
- Bổ sung regression còn thiếu của watcher chậm và export preview. Chụp baseline hành vi và đo tương tác đại diện trên cùng browser, khổ canvas và DPR.
- Hoàn thành khi xác định được owner của document, selection, gesture, history, render cache và save ở mỗi app; có danh sách trùng thật và khác biệt chủ ý.

### P1 — Tách trách nhiệm bên trong mỗi app

- Tách Studio theo editor, project/file lifecycle, grid, slice, animation, code/AI và export; PixelArt theo editor, project/file lifecycle, palette/source.
- Mỗi thay đổi chỉ di chuyển một trách nhiệm, giữ thứ tự khởi tạo và điểm gọi. Tránh truyền nguyên app state hoặc hàng chục callback vào một module mới.
- Chưa đồng thời đổi thuật toán hoặc hợp nhất history. Giữ entry point tương thích để rollback từng phần.
- Hoàn thành khi app shell chủ yếu khởi tạo/bind và gọi controller; không có vòng phụ thuộc giữa controller.

### P2 — Chuẩn hóa mutation và command

- Định nghĩa hợp đồng transaction tối thiểu bằng tài liệu và JSDoc: scope document/session/cell/target; begin, preview, commit, cancel; kết quả changed/dirty bounds và lý do bị từ chối.
- App adapter chụp lịch sử và commit đúng một lần cho thao tác có thay đổi. No-op/cancel không tạo history hay dirty giả.
- Đi trước với brush/eraser và primitive vì đã có shared tools. Sau đó mới chuyển các lệnh selection.
- Hoàn thành khi cùng fixture tạo cùng pixel/ownership ở cả hai app; Undo/Redo và đổi frame/project không đổi đích.

### P3 — Hợp nhất điều phối selection và gesture

- Marquee, floating selection, clipboard, move/resize/rotate/flip và region/group dùng chung quy tắc, tận dụng SelectionTransform và RegionSelection hiện có.
- Chốt rõ dữ liệu gốc trong suốt một gesture, hit-test handle, ownership khi paste, và commit/cancel khi Esc, pointercancel, blur, đổi tool/frame/project.
- Chuyển từng lệnh, chạy cùng bộ tình huống ở hai app rồi bỏ implementation cũ. Không giữ hai đường hoạt động lâu dài.
- Hoàn thành khi không còn hai implementation của cùng command và toàn bộ case overlap/ancestor lock/hidden/boundary qua.

### P4 — Render và lifecycle

- Dùng chung cách xác định invalidation và hình học; giữ canvas/viewport instance của mỗi app. Phân biệt thay đổi artwork, overlay và view để tránh composite toàn bộ khi hover/zoom.
- Sau khi command ổn định mới cân nhắc chia sẻ thêm chính sách save/watcher/recovery. Giữ wiring/history/autosave của từng app; không ép dùng chung session object.
- Đo thời gian handler, frame và bộ nhớ với 16, 64, 512 cùng khổ lớn được hỗ trợ. Báo median/p95/max, không dùng câu khẳng định chung dưới 16ms.
- Hoàn thành khi kết quả hình và điểm neo zoom giữ nguyên, không tăng redraw hoặc lưu nhầm scope.

### P5 — Dọn đường cũ và chốt tài liệu

- Bỏ code không còn caller; thu gọn tests dò chuỗi source, thay bằng test hành vi cho engine/controller khi phù hợp.
- Cập nhật sơ đồ phụ thuộc, API/owner, hướng dẫn thêm tool/command và ma trận hai app. Tài liệu cũ ghi rõ phần bị thay thế.
- Chạy toàn bộ Node, ba browser runners và tình huống bổ sung. Review diff, giữ nhánh phụ; chỉ merge/release stable theo quyết định tiếp theo.

## Gate cho mỗi phần việc

1. Có repro/fixture, invariant cần giữ và ranh giới thay đổi.
2. Hai app dùng cùng implementation cho phần được hợp nhất; không chỉ copy code sang file khác.
3. Load → edit → Undo/Redo → export → reload giữ pixel, alpha, cấu trúc và thứ tự. PIX2 1.0 vẫn đọc được.
4. Kiểm tra vùng chồng lấp, ancestor khóa/ẩn, Esc, biên canvas, đổi frame/project, thao tác bị ngắt và completion async muộn khi liên quan.
5. Toàn bộ `tests/test-*.js` qua; UI thay đổi chạy normal entry point cả hai app. Ghi đúng môi trường và phạm vi đã chạy.
6. Không đổi UX ngoài quyết định được ghi nhận. Commit đủ nhỏ để revert riêng; không thay storage/schema chỉ để tiện refactor.

## Cách triển khai đề nghị

Bắt đầu P0, rồi chọn một lát cắt P1 nhỏ làm mẫu (palette controller có logic hai bên tương tự nhưng cần đối chiếu persistence và UI khác nhau). Tiếp theo ưu tiên transaction/gesture có rủi ro dữ liệu cao. Không đặt mục tiêu giảm số dòng tùy ý hoặc viết lại toàn bộ cùng lúc. Mỗi lát cắt có note trước/sau, kiểm thử và kết quả review; chỉ đánh dấu hoàn tất khi có bằng chứng.

Tài liệu này là kế hoạch, không phải cam kết các bước đã thực hiện. Chưa thay code runtime, chưa có quyết định merge hay phát hành mới.
