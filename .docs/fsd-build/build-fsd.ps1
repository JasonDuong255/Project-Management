#requires -Version 5.1
# Build the QLDA FSD .docx via Word COM automation.
# Output: C:\Users\phucdm\Documents\QLDA\FSD_QLDA_v2.0.docx
# Run with:  powershell -ExecutionPolicy Bypass -File .\build-fsd.ps1

[CmdletBinding()]
param(
  [string]$OutputPath = "C:\Users\phucdm\Documents\QLDA\FSD_QLDA_v2.2.docx"
)

$ErrorActionPreference = 'Stop'

# ───────────────────────────── Word setup ─────────────────────────────
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0  # wdAlertsNone

$doc = $word.Documents.Add()
$selection = $word.Selection

# Page setup: A4 portrait, normal margins
$doc.PageSetup.PageWidth  = 595.27   # A4 width in points
$doc.PageSetup.PageHeight = 841.89   # A4 height in points
$doc.PageSetup.TopMargin    = 56.7   # 2 cm
$doc.PageSetup.BottomMargin = 56.7
$doc.PageSetup.LeftMargin   = 70.9   # 2.5 cm
$doc.PageSetup.RightMargin  = 56.7

# Default Vietnamese font
$doc.Content.Font.Name = "Times New Roman"
$doc.Content.Font.Size = 11

# Constants
$wdAlignParagraphLeft   = 0
$wdAlignParagraphCenter = 1
$wdAlignParagraphRight  = 2
$wdAlignParagraphJustify = 3
$wdStyleHeading1 = -2
$wdStyleHeading2 = -3
$wdStyleHeading3 = -4
$wdStyleHeading4 = -5
$wdStyleTitle    = -63
$wdStyleSubtitle = -75
$wdStyleNormal   = -1
$wdLineStyleSingle = 1
$wdBorderTop = -1; $wdBorderLeft = -2; $wdBorderBottom = -3; $wdBorderRight = -4
$wdBorderHorizontal = -5; $wdBorderVertical = -6
$wdAlignVerticalCenter = 1
$wdSeekCurrentPageHeader = 9
$wdSeekMainDocument = 0
$wdHeaderFooterPrimary = 1

# ───────────────────────────── Helpers ─────────────────────────────

function AddParagraph {
  param([string]$Text, [int]$Style = $wdStyleNormal, [int]$Align = $wdAlignParagraphJustify, [bool]$Bold = $false, [single]$Size = 11, [bool]$Italic = $false)
  $p = $doc.Paragraphs.Add()
  $p.Range.Text = $Text
  $p.Range.Style = $Style
  $p.Range.ParagraphFormat.Alignment = $Align
  $p.Range.ParagraphFormat.SpaceAfter = 4
  $p.Range.ParagraphFormat.SpaceBefore = 0
  $p.Range.Font.Name = "Times New Roman"
  $p.Range.Font.Size = $Size
  $p.Range.Font.Bold = if ($Bold) { -1 } else { 0 }
  $p.Range.Font.Italic = if ($Italic) { -1 } else { 0 }
  $p.Range.InsertParagraphAfter()
  return $p
}

function AddBlank {
  $p = $doc.Paragraphs.Add()
  $p.Range.Text = ""
  $p.Range.InsertParagraphAfter()
}

function AddHeading1 { param([string]$Text)
  $p = AddParagraph -Text $Text -Style $wdStyleHeading1 -Align $wdAlignParagraphLeft -Bold $true -Size 16
}
function AddHeading2 { param([string]$Text)
  $p = AddParagraph -Text $Text -Style $wdStyleHeading2 -Align $wdAlignParagraphLeft -Bold $true -Size 14
}
function AddHeading3 { param([string]$Text)
  $p = AddParagraph -Text $Text -Style $wdStyleHeading3 -Align $wdAlignParagraphLeft -Bold $true -Size 12
}
function AddHeading4 { param([string]$Text)
  $p = AddParagraph -Text $Text -Style $wdStyleHeading4 -Align $wdAlignParagraphLeft -Bold $true -Size 11.5
}

function AddBoldLabel { param([string]$Label, [string]$Text)
  $p = $doc.Paragraphs.Add()
  $p.Range.Font.Name = "Times New Roman"
  $p.Range.Font.Size = 11
  $r = $p.Range
  $r.Font.Bold = -1
  $r.Text = "$Label "
  $r2 = $r.Duplicate
  $r2.Collapse(0)
  $r2.Font.Bold = 0
  $r2.Text = $Text
  $r.ParagraphFormat.Alignment = $wdAlignParagraphJustify
  $r.ParagraphFormat.SpaceAfter = 4
  $r.InsertParagraphAfter()
}

function AddBullets { param([string[]]$Items)
  foreach ($it in $Items) {
    $p = $doc.Paragraphs.Add()
    $p.Range.Text = $it
    $p.Range.Font.Name = "Times New Roman"
    $p.Range.Font.Size = 11
    $p.Range.ListFormat.ApplyBulletDefault() | Out-Null
    $p.Range.ParagraphFormat.LeftIndent = 18
    $p.Range.ParagraphFormat.SpaceAfter = 2
    $p.Range.InsertParagraphAfter()
  }
  # Reset list
  $resetP = $doc.Paragraphs.Add()
  $resetP.Range.ListFormat.RemoveNumbers() | Out-Null
  $resetP.Range.Text = ""
}

function NewTable {
  param([int]$Rows, [int]$Cols, [string[]]$Headers, [int[]]$WidthPct)
  $range = $doc.Paragraphs.Add().Range
  $tbl = $doc.Tables.Add($range, $Rows, $Cols)
  $tbl.Borders.Enable = $true
  $tbl.Borders.OutsideLineStyle = $wdLineStyleSingle
  $tbl.Borders.InsideLineStyle = $wdLineStyleSingle
  $tbl.Range.Font.Name = "Times New Roman"
  $tbl.Range.Font.Size = 10.5
  $tbl.Rows.AllowBreakAcrossPages = $true

  # Header row
  for ($i = 0; $i -lt $Cols; $i++) {
    $cell = $tbl.Cell(1, $i + 1)
    $cell.Range.Text = $Headers[$i]
    $cell.Range.Font.Bold = -1
    $cell.Range.ParagraphFormat.Alignment = $wdAlignParagraphCenter
    $cell.Range.Shading.BackgroundPatternColor = 14474460  # light gray
    $cell.VerticalAlignment = $wdAlignVerticalCenter
  }
  $tbl.Rows.Item(1).HeadingFormat = -1

  # Width adjustment (best-effort)
  if ($WidthPct -and $WidthPct.Count -eq $Cols) {
    $total = $doc.PageSetup.PageWidth - $doc.PageSetup.LeftMargin - $doc.PageSetup.RightMargin
    for ($i = 0; $i -lt $Cols; $i++) {
      $tbl.Columns.Item($i + 1).PreferredWidth = $total * ($WidthPct[$i] / 100.0)
    }
  }
  return $tbl
}

function FillRow {
  param($Table, [int]$Row, [string[]]$Values)
  for ($i = 0; $i -lt $Values.Count; $i++) {
    $cell = $Table.Cell($Row, $i + 1)
    $cell.Range.Text = $Values[$i]
    $cell.Range.Font.Bold = 0
    $cell.Range.ParagraphFormat.Alignment = $wdAlignParagraphLeft
    $cell.VerticalAlignment = $wdAlignVerticalCenter
  }
}

function AddFieldSpecTable {
  param([object[]]$Rows)
  # Rows: array of objects { stt, field, control, maxlen, required, desc }
  $headers = @("STT", "Field", "Control", "Maxlength", "Bắt buộc", "Mô tả yêu cầu")
  $widths  = @(5, 22, 13, 9, 9, 42)
  $tbl = NewTable -Rows ($Rows.Count + 1) -Cols 6 -Headers $headers -WidthPct $widths
  for ($i = 0; $i -lt $Rows.Count; $i++) {
    $r = $Rows[$i]
    FillRow -Table $tbl -Row ($i + 2) -Values @(
      [string]($i + 1),
      [string]$r.field,
      [string]$r.control,
      [string]$r.maxlen,
      [string]$r.required,
      [string]$r.desc
    )
  }
  AddBlank
}

function AddFlowTable {
  param([object[]]$Rows)
  $headers = @("STT", "Bước thực hiện", "Tác nhân", "Mô tả")
  $widths = @(5, 22, 18, 55)
  $tbl = NewTable -Rows ($Rows.Count + 1) -Cols 4 -Headers $headers -WidthPct $widths
  for ($i = 0; $i -lt $Rows.Count; $i++) {
    $r = $Rows[$i]
    FillRow -Table $tbl -Row ($i + 2) -Values @(
      [string]$r.no, [string]$r.step, [string]$r.actor, [string]$r.desc
    )
  }
  AddBlank
}

function AddPermissionMatrix {
  $cols = @("Chức năng", "PMO", "ADMIN_HC (TCHC)", "PM", "Chuyên viên QLDA", "Thành viên TTK", "KSV")
  $widths = @(38, 8, 13, 8, 14, 11, 8)
  $rows = @(
    @("Đăng nhập / Đăng xuất", "x", "x", "x", "x", "x", "x"),
    @("Quản trị danh mục hệ thống", "x", "", "", "", "", ""),
    @("Quản trị danh mục KH/Đối tác", "x", "", "", "x (xem)", "", ""),
    @("Quản trị người dùng & phân quyền", "x", "", "", "", "", ""),
    @("Reset dữ liệu demo", "x", "", "", "", "", ""),
    @("Dashboard tổng quan", "x (toàn hệ thống)", "x (toàn hệ thống)", "x (DA của mình)", "x (DA phụ trách)", "x (DA tham gia)", ""),
    @("Tạo mới dự án (BA 12/05/2026)", "", "x (chỉ TCHC)", "", "", "", ""),
    @("Xem danh sách dự án", "x", "x", "x", "x", "x", ""),
    @("Sửa thông tin khởi tạo", "x", "x", "x (PM của DA)", "x (DA phụ trách)", "", ""),
    @("Cập nhật thông tin chung / tài chính", "x", "", "x (PM của DA)", "x", "", ""),
    @("Quản lý nhân sự dự án", "x", "", "x (PM của DA)", "x", "", ""),
    @("Quản lý tài liệu dự án", "x", "", "x (PM của DA)", "x", "", ""),
    @("Quản lý rủi ro", "x", "", "x (PM của DA)", "x", "", ""),
    @("Quản lý kế hoạch (Task/Subtask)", "x", "", "x (PM của DA)", "x", "", ""),
    @("Khai báo tiến độ / worklog", "", "", "x", "x", "x (task được giao)", ""),
    @("Raise chậm tiến độ", "", "", "", "", "x", ""),
    @("Phân bổ giờ công theo tháng", "x", "", "x (PM của DA)", "x", "", ""),
    @("Biểu đồ Gantt", "x", "x", "x", "x", "x", ""),
    @("Báo cáo", "x", "x", "x", "x", "x (đọc)", ""),
    @("Thông báo cảnh báo deadline", "x", "x", "x", "x", "x", ""),
    @("Tạm đóng / Mở lại dự án", "x", "", "x (PM của DA)", "x", "", ""),
    @("Yêu cầu đóng dự án", "x", "", "x (PM của DA)", "x", "", ""),
    @("Phê duyệt yêu cầu đóng (KSV)", "", "", "", "", "", "x"),
    @("Xác nhận đóng TTK (TCHC) — BA 14/05/2026", "", "x", "", "", "", ""),
    @("Hộp thư duyệt", "", "x (TCHC)", "", "", "", "x (KSV)")
  )
  $tbl = NewTable -Rows ($rows.Count + 1) -Cols 7 -Headers $cols -WidthPct $widths
  for ($i = 0; $i -lt $rows.Count; $i++) {
    FillRow -Table $tbl -Row ($i + 2) -Values $rows[$i]
  }
  $tbl.Range.Font.Size = 9
  AddBlank
}

function PageBreak {
  $selection = $word.Selection
  $selection.EndKey(6) | Out-Null  # wdStory
  $selection.InsertBreak(7) | Out-Null  # wdPageBreak
}

# ───────────────────────────── 1. COVER PAGE ─────────────────────────────
function AddCoverPage {
  $p = AddParagraph -Text "CÔNG TY CỔ PHẦN TIN HỌC VIỄN THÔNG HÀNG KHÔNG" -Align $wdAlignParagraphCenter -Bold $true -Size 13
  AddBlank
  AddBlank
  AddBlank

  AddParagraph -Text "PHẦN MỀM QUẢN LÝ DỰ ÁN QLDA" -Align $wdAlignParagraphCenter -Bold $true -Size 22 | Out-Null
  AddBlank
  AddParagraph -Text "TÀI LIỆU PHÂN TÍCH THIẾT KẾ PHẦN MỀM" -Align $wdAlignParagraphCenter -Bold $true -Size 16 | Out-Null
  AddBlank
  AddBlank
  AddBlank

  AddParagraph -Text "Thông tin tài liệu" -Align $wdAlignParagraphCenter -Bold $true -Size 13 | Out-Null
  AddBlank
  $tbl = NewTable -Rows 4 -Cols 2 -Headers @("Hạng mục", "Nội dung") -WidthPct @(40, 60)
  FillRow -Table $tbl -Row 2 -Values @("Mã phần mềm", "D26-001-2")
  FillRow -Table $tbl -Row 3 -Values @("Phiên bản tài liệu", "2.2")
  FillRow -Table $tbl -Row 4 -Values @("Đơn vị ban hành", "Tổ triển khai")
  AddBlank
  $tbl2 = NewTable -Rows 2 -Cols 2 -Headers @("Hạng mục", "Nội dung") -WidthPct @(40, 60)
  FillRow -Table $tbl2 -Row 2 -Values @("Ngày ban hành tài liệu", "05/2026")
  AddBlank
  AddBlank
  AddBlank
  AddBlank
  AddBlank
  AddParagraph -Text "HÀ NỘI (05/2026)" -Align $wdAlignParagraphCenter -Bold $true -Size 13 | Out-Null
  PageBreak
}

# ───────────────────────────── 2. CHANGE LOG + APPROVAL ─────────────────────────────
function AddChangeLog {
  AddHeading1 "BẢNG GHI NHẬN THAY ĐỔI TÀI LIỆU"
  AddParagraph -Text "T – Thêm mới, S – Sửa đổi, X – Xoá" -Italic $true -Align $wdAlignParagraphLeft | Out-Null
  $tbl = NewTable -Rows 5 -Cols 5 -Headers @("Ngày thay đổi", "Mục, bảng thay đổi", "T S X", "Mô tả thay đổi", "Phiên bản mới") -WidthPct @(13, 25, 8, 39, 15)
  FillRow -Table $tbl -Row 2 -Values @("05/2026", "Toàn bộ", "T", "Tạo tài liệu", "1.0")
  FillRow -Table $tbl -Row 3 -Values @(
    "12/05/2026",
    "B.II.3 Ma trận phân quyền; C.III.2 Tạo mới dự án; C.IV.2 Nhân sự; C.V Đóng dự án; D Danh sách API; G Phụ lục",
    "S, X",
    "Loại bỏ luồng phê duyệt khởi tạo dự án (trạng thái PENDING → APPROVED). TCHC (ADMIN_HC) khởi tạo dự án trực tiếp. Ràng buộc nhân sự AITS phải liên kết với User trong hệ thống (User picker thay free-text).",
    "1.5"
  )
  FillRow -Table $tbl -Row 4 -Values @(
    "13/05/2026",
    "C.III–C.X (toàn bộ module có thao tác CRUD); thêm phần Quy ước UX chung tại đầu phần C",
    "T, S",
    "Bổ sung quy ước UX chung: chế độ Cập nhật/Lưu thay đổi cho các tab readonly mặc định; popup xác nhận cho mọi thao tác xoá và cập nhật; loading overlay khi gọi API; toast thông báo ở góc dưới phải; bảng lịch sử thao tác tại cuối mỗi tab; cảnh báo highlight task quá hạn / sắp đến hạn trên Gantt.",
    "2.0"
  )
  FillRow -Table $tbl -Row 5 -Values @(
    "14/05/2026",
    "B.II.3 Ma trận phân quyền; B.III Thuật ngữ; C.I.2 Phân quyền; C.V.5–6 Đóng dự án; D Danh sách API; G Phụ lục FunctionalTitle",
    "S, X",
    "Loại bỏ vai trò TCNL trong luồng đóng dự án. Người duyệt sau KSV chuyển sang TCHC = role ADMIN_HC (không còn functional title TCNL). Endpoint PATCH /close-requests/:id/tcnl đổi thành /tchc; các trường DB tcnlDecision/tcnlDecidedById/tcnlDecidedAt/tcnlRejectReason đổi thành tchc*. Activity log actions CLOSE_CONFIRMED_TCNL / CLOSE_REJECTED_TCNL đổi thành CLOSE_CONFIRMED_TCHC / CLOSE_REJECTED_TCHC.",
    "2.2"
  )
  AddBlank
}

function AddApprovalPage {
  AddHeading1 "TRANG KÝ – PHÊ DUYỆT TÀI LIỆU"
  $tbl = NewTable -Rows 5 -Cols 2 -Headers @("Vai trò", "Họ và tên / Ngày") -WidthPct @(40, 60)
  FillRow -Table $tbl -Row 2 -Values @("Người lập", "Dương Minh Phúc — Ngày lập: …………")
  FillRow -Table $tbl -Row 3 -Values @("Người kiểm tra", "Lê Ngọc Huy — Ngày kiểm tra: …………")
  FillRow -Table $tbl -Row 4 -Values @("Người thông qua", "Trần Thị Hà — Ngày thông qua: …………")
  FillRow -Table $tbl -Row 5 -Values @("Người phê duyệt", "Trịnh Quốc Phong — Ngày phê duyệt: …………")
  PageBreak
}

# ───────────────────────────── 3. TABLE OF CONTENTS ─────────────────────────────
function AddTOC {
  AddHeading1 "MỤC LỤC"
  $range = $doc.Paragraphs.Add().Range
  $doc.TablesOfContents.Add($range, $true, 1, 4) | Out-Null
  PageBreak
}

# ───────────────────────────── 4. SECTION A — TỔNG QUAN ─────────────────────────────
function AddSectionA {
  AddHeading1 "A. TỔNG QUAN"

  AddHeading2 "I. Mục đích"
  AddParagraph -Text "Tài liệu này được lập nhằm mô tả phân tích thiết kế phần mềm Hệ thống Quản lý dự án QLDA, được phát triển nội bộ cho Công ty Cổ phần Tin học Viễn thông Hàng không (AITS) — phục vụ điều hành dự án triển khai cho khách hàng nội bộ VNA Group." | Out-Null
  AddParagraph -Text "Hệ thống số hoá toàn bộ quy trình quản lý dự án từ khâu khởi tạo, lập kế hoạch, phân bổ nguồn lực, theo dõi tiến độ, quản lý rủi ro, tới đóng dự án — thay thế phương pháp thủ công dùng Excel rời rạc hiện tại. Đối tượng đọc gồm: Quản trị dự án (PM/PMO), Hành chính (TCHC), Kiểm soát viên (KSV), Tổ chức Nhân lực (TCNL), Chuyên viên QLDA, Thành viên TTK, và đội ngũ phát triển." | Out-Null

  AddHeading2 "II. Tài liệu liên quan"
  AddBullets @(
    "BRD–QLDA phiên bản 27/04/2026 (tài liệu yêu cầu nghiệp vụ).",
    "Tài liệu mô tả hiện trạng (.docs/01-current-state.md).",
    "Roadmap phát triển v3.x (.docs/plan/00-overview.md).",
    "Quyết định thành lập TTK / Hồ sơ căn cứ dự án (do TCHC cung cấp).",
    "Biểu mẫu báo cáo tuần / báo cáo chi tiết do khách hàng cung cấp."
  )

  AddHeading2 "III. Thuật ngữ và các từ viết tắt"
  $terms = @(
    @{abbr="QLDA"; desc="Hệ thống Quản lý dự án – phạm vi tài liệu này"},
    @{abbr="TTK"; desc="Tổ triển khai dự án"},
    @{abbr="TCHC"; desc="Tổ chức Hành chính – khởi tạo dự án, xác nhận đóng dự án"},
    @{abbr="TCHC (vai trò xác nhận đóng dự án)"; desc="Tổ chức Hành chính — sau quyết định BA 14/05/2026, TCHC chính là vai trò ADMIN_HC; xác nhận đóng TTK sau khi KSV duyệt (thay cho vai trò TCNL ở phiên bản trước)."},
    @{abbr="KSV"; desc="Kiểm soát viên (đơn vị DBCL) – phê duyệt yêu cầu đóng dự án"},
    @{abbr="BĐH"; desc="Ban điều hành"},
    @{abbr="PMO"; desc="Phòng Quản lý Dự án – quản trị hệ thống, danh mục, tạm đóng"},
    @{abbr="PM"; desc="Project Manager – Quản trị viên dự án"},
    @{abbr="QLDA (vai trò)"; desc="Chuyên viên QLDA – quản lý kế hoạch, rủi ro, tài liệu"},
    @{abbr="Điều phối TTK"; desc="Người điều phối tổ triển khai trong một dự án"},
    @{abbr="Thành viên TTK"; desc="Thành viên tổ triển khai – khai báo giờ công, raise tiến độ"},
    @{abbr="HRM"; desc="Human Resource Management – hệ thống nhân sự (ngoài hệ thống)"},
    @{abbr="KTQT"; desc="Kế toán Quản trị – hệ thống giờ công trần (ngoài)"},
    @{abbr="a.Office"; desc="Hệ thống chấm công / kế hoạch cá nhân (ngoài)"},
    @{abbr="AD/LDAP"; desc="Active Directory / LDAP – xác thực SSO"},
    @{abbr="LOV"; desc="List of Values – danh mục giá trị"},
    @{abbr="TT"; desc="Trạng thái"},
    @{abbr="UI/UX"; desc="Giao diện người dùng / Trải nghiệm người dùng"}
  )
  $tbl = NewTable -Rows ($terms.Count + 1) -Cols 3 -Headers @("STT", "Thuật ngữ/Viết tắt", "Mô tả") -WidthPct @(6, 24, 70)
  for ($i = 0; $i -lt $terms.Count; $i++) {
    FillRow -Table $tbl -Row ($i + 2) -Values @([string]($i+1), $terms[$i].abbr, $terms[$i].desc)
  }
  AddBlank
  PageBreak
}

# ───────────────────────────── 5. SECTION B — QUY TRÌNH NGHIỆP VỤ ─────────────────────────────
function AddSectionB {
  AddHeading1 "B. CÁC QUY TRÌNH NGHIỆP VỤ HỆ THỐNG"
  AddHeading2 "I. Quy trình nghiệp vụ tổng quan"

  AddHeading3 "1. Luồng quy trình nghiệp vụ"
  AddParagraph -Text "Sơ đồ luồng nghiệp vụ minh hoạ vòng đời một dự án — từ khi TCHC khởi tạo, qua các pha lập kế hoạch / triển khai / theo dõi tiến độ, tới khi đóng dự án qua phê duyệt KSV và xác nhận TCHC (BA 14/05/2026 — vai trò TCNL trước đây được hợp nhất vào TCHC = ADMIN_HC)." | Out-Null
  AddParagraph -Text "[Khoảng trống chèn diagram — minh hoạ luồng: Khởi tạo dự án → Lập kế hoạch → Triển khai (khai báo tiến độ, cập nhật rủi ro, cập nhật tài liệu) → Cảnh báo deadline → Tạm đóng / Mở lại → Gửi yêu cầu đóng → KSV duyệt → TCHC xác nhận → Đã đóng]" -Italic $true -Align $wdAlignParagraphCenter | Out-Null
  AddBlank

  AddHeading3 "2. Mô tả luồng nghiệp vụ"
  AddParagraph -Text "Quy trình nghiệp vụ chuẩn của hệ thống QLDA được mô tả trong bảng dưới đây. Mỗi bước nêu rõ tác nhân thực hiện và đầu ra mong đợi. Chi tiết từng bước sẽ được mô tả ở phần ĐẶC TẢ CHI TIẾT YÊU CẦU CHỨC NĂNG." | Out-Null

  $flow = @(
    @{no=1; step="Đăng nhập hệ thống"; actor="Tất cả người dùng"; desc="Người dùng đăng nhập bằng tài khoản AD/LDAP của AITS. Nếu sai thông tin, hệ thống highlight trường lỗi và chặn truy cập. Ghi log đăng nhập (IP, thời gian, trạng thái)."},
    @{no=2; step="Khởi tạo dự án"; actor="TCHC (ADMIN_HC)"; desc="Sau khi có Quyết định thành lập TTK, TCHC khởi tạo dự án trực tiếp với các thông tin: mã, tên, số QĐ, hồ sơ căn cứ, nhiệm vụ TTK, ngày BĐ/KT, danh sách nhân sự TTK (chọn từ HRM). Trạng thái khởi tạo: ‘Đang triển khai’. Quyết định BA 12/05/2026: bỏ luồng phê duyệt riêng (PENDING → APPROVED) — dự án có hiệu lực ngay khi TCHC lưu."},
    @{no=3; step="Cập nhật thông tin chung"; actor="Điều phối TTK / Chuyên viên QLDA"; desc="Điền hình thức TTK (Kiêm nhiệm / Chuyên trách), loại dự án (Tiền khả thi / Khả thi / Có HĐ / Nội bộ), thông tin tài chính (doanh thu, chi phí, lợi nhuận), thông tin khách hàng / đối tác."},
    @{no=4; step="Lập kế hoạch triển khai"; actor="Chuyên viên QLDA / PM"; desc="CRUD task tổng và subtask. Trường: nội dung, timeline, giờ công kế hoạch, người thực hiện. Ghi lịch sử sau khi kế hoạch được duyệt."},
    @{no=5; step="Phân bổ giờ công"; actor="Chuyên viên QLDA"; desc="Phân bổ giờ công theo tháng cho từng thành viên TTK. Với dự án Có HĐ / Khả thi: tổng giờ công không vượt quá KTQT — hệ thống tự đối chiếu, không cho lưu nếu vượt."},
    @{no=6; step="Cập nhật nhân sự / tài liệu / rủi ro"; actor="Chuyên viên QLDA"; desc="CRUD nhân sự TTK / KH / Đối tác (chọn từ danh mục hoặc tạo mới); CRUD tài liệu (file, loại, ghi chú); CRUD rủi ro (nguyên nhân, giải pháp, người xử lý, hạn, tiến độ xử lý)."},
    @{no=7; step="Khai báo tiến độ / giờ công"; actor="Thành viên TTK"; desc="Khai báo % hoàn thành, giờ công thực hiện, nội dung kết quả. Hệ thống tổng hợp giờ công, đồng bộ worklog sang a.Office, tự động chuyển trạng thái task NOT_STARTED → IN_PROGRESS, ≥100% → DONE."},
    @{no=8; step="Raise chậm tiến độ"; actor="Thành viên TTK"; desc="Khi không đạt tiến độ, gửi yêu cầu re-plan kèm lý do và ảnh hưởng. PM tiếp nhận để điều chỉnh kế hoạch. Task chuyển trạng thái NEEDS_REPLAN."},
    @{no=9; step="Cảnh báo gần đến hạn / quá hạn"; actor="Hệ thống"; desc="Trước hạn ≤ 4 ngày (chưa xong) → trạng thái sức khoẻ ‘Cần xem xét’. Đến hạn (chưa xong) → ‘Có rủi ro’. Thông báo in-app gửi toàn bộ thành viên TTK."},
    @{no=10; step="Xuất báo cáo"; actor="Chuyên viên QLDA"; desc="Xuất báo cáo tuần TTK, báo cáo tổng hợp, báo cáo đánh giá PMO, báo cáo phát sinh — định dạng .xlsx hoặc .csv (template do khách hàng cung cấp)."},
    @{no=11; step="Tạm đóng / Mở lại dự án"; actor="PM / Chuyên viên QLDA"; desc="Tạm đóng → trạng thái PAUSED, có thể mở lại bất cứ lúc nào. Ghi lịch sử thao tác."},
    @{no=12; step="Gửi yêu cầu đóng dự án"; actor="Chuyên viên QLDA"; desc="Gửi hồ sơ + ghi chú tới nhân sự đơn vị DBCL chức danh KSV. Thông báo in-app + email tới KSV."},
    @{no=13; step="Phê duyệt / Từ chối đóng (KSV)"; actor="KSV"; desc="Phê duyệt → chuyển tiếp cho TCHC. Từ chối → gửi lại Chuyên viên QLDA kèm lý do."},
    @{no=14; step="Xác nhận và đóng TTK (TCHC)"; actor="TCHC (ADMIN_HC)"; desc="TCHC xác nhận → trạng thái ‘Đã đóng’. Từ chối → gửi lại Chuyên viên QLDA. Sau khi đã đóng: không cho phép sửa thông tin, kế hoạch, nguồn lực, tài liệu, rủi ro. BA 14/05/2026: bước này thay cho ‘TCNL xác nhận’ ở phiên bản trước — vai trò TCNL đã được loại bỏ, TCHC chính là ADMIN_HC."},
    @{no=15; step="Đăng xuất"; actor="Tất cả người dùng"; desc="Đăng xuất khỏi hệ thống. Token phiên bị huỷ."}
  )
  AddFlowTable -Rows $flow

  AddHeading3 "3. Ma trận phân quyền"
  AddParagraph -Text "Ma trận thể hiện quyền truy cập chức năng theo vai trò. Dấu ‘x’ thể hiện vai trò có quyền; ô trống biểu thị không có quyền hoặc chỉ đọc. Quyền chi tiết theo dự án tham chiếu logic getVisibleProjects / canManageProjectPlan / canEditProjectInfo (lib/calculations.ts)." | Out-Null
  AddPermissionMatrix
  PageBreak
}

# ──────────────────── 6. SECTION C — ĐẶC TẢ CHI TIẾT YÊU CẦU CHỨC NĂNG ────────────────────

# Generic function spec block
function AddFunctionBlock {
  param(
    [string]$Title,
    [string]$Description,
    [string]$Users,
    [string[]]$Steps,
    [string]$UiNote,
    [object[]]$Fields
  )
  AddHeading4 $Title
  AddBoldLabel "Mô tả chức năng:" $Description
  AddBoldLabel "Đối tượng sử dụng:" $Users
  AddBoldLabel "Các bước thực hiện:" ""
  AddBullets $Steps
  AddBoldLabel "Màn hình giao diện:" $UiNote
  AddParagraph -Text "[Khoảng trống chèn ảnh chụp màn hình hoặc wireframe]" -Italic $true -Align $wdAlignParagraphCenter | Out-Null
  AddBoldLabel "Đặc tả các trường thông tin:" ""
  AddFieldSpecTable -Rows $Fields
}

# ─── C.I  Module Quản trị hệ thống ───
function AddUXConventions {
  AddHeading1 "C. ĐẶC TẢ CHI TIẾT YÊU CẦU CHỨC NĂNG"
  AddHeading2 "0. Quy ước UX chung (áp dụng cho toàn bộ module)"
  AddParagraph -Text "Các quy ước UI/UX dưới đây có hiệu lực ở mọi màn hình của hệ thống. Mô tả của từng chức năng trong các phần tiếp theo sẽ KHÔNG lặp lại các điểm này — mặc định coi như đã áp dụng. Khi có ngoại lệ, mô tả của chức năng đó sẽ nêu rõ." | Out-Null
  AddBlank

  AddHeading3 "0.1. Chế độ Xem / Chế độ Chỉnh sửa"
  AddParagraph -Text "Toàn bộ tab có form thông tin cố định (không phải pop-up modal) sẽ ở Chế độ Xem khi mới mở — mọi trường đều readonly. Phía trên form có một thanh điều khiển EditModeBar với chỉ báo trạng thái và nút thao tác:" | Out-Null
  AddBullets @(
    "Chế độ xem (mặc định): hiển thị badge ‘○ Chế độ xem’ + nút ‘Cập nhật’ (biểu tượng bút chì). Bấm để chuyển sang Chế độ chỉnh sửa.",
    "Chế độ chỉnh sửa: hiển thị badge ‘● Chế độ chỉnh sửa’ + 2 nút ‘Lưu thay đổi’ (biểu tượng đĩa lưu) và ‘Huỷ’. Toàn bộ trường trong form trở nên editable.",
    "Khi bấm ‘Huỷ’: hệ thống khôi phục bản nháp từ snapshot mới nhất của server, không gửi mutation.",
    "Khi bấm ‘Lưu thay đổi’: mở pop-up xác nhận (xem mục 0.2), sau đó gửi API và quay về Chế độ xem nếu thành công.",
    "Trong Chế độ xem, các nút thao tác cấp dòng như ‘+ Thêm’, ‘Xoá’ trong bảng được ẨN hoàn toàn (không hiển thị, không chỉ disabled) để giao diện gọn và rõ trạng thái readonly.",
    "Phạm vi áp dụng: tab Thông tin khởi tạo, tab Overview (thông tin chung & tài chính & cơ sở căn cứ), tab Nhân sự dự án. Các tab thao tác qua pop-up (Tài liệu, Rủi ro, Kế hoạch) giữ luồng cũ — bấm nút mở pop-up trực tiếp."
  )

  AddHeading3 "0.2. Pop-up xác nhận thao tác (ConfirmDialog)"
  AddParagraph -Text "Mọi thao tác CẬP NHẬT hoặc XOÁ dữ liệu phải đi qua một pop-up xác nhận trước khi gọi API. Pop-up có cấu trúc thống nhất:" | Out-Null
  AddBullets @(
    "Icon trạng thái (cảnh báo cho xoá, check cho lưu) + tiêu đề câu hỏi rõ ràng nêu đối tượng/danh tính (ví dụ: Xoá tài liệu [HD-2026/001]).",
    "Mô tả phụ giải thích hệ quả: cascade xoá subtask/worklog/raise; ghi vào lịch sử thao tác; không thể hoàn tác (nếu áp dụng).",
    "Hai nút Huỷ / Xác nhận. Nút xác nhận có tone đỏ (danger) khi là xoá, tone xanh-teal khi là lưu/cập nhật. Click ra ngoài pop-up = Huỷ.",
    "Không sử dụng window.confirm() native — toàn bộ confirm dùng component ConfirmDialog tuân thủ style chung của app."
  )

  AddHeading3 "0.3. Loading overlay khi gọi API"
  AddParagraph -Text "Khi hệ thống đang xử lý request (sau khi user xác nhận), một overlay fullscreen được kích hoạt — chặn tương tác và hiển thị spinner + thông điệp mô tả tác vụ (vd ‘Đang lưu thay đổi…’, ‘Đang xoá rủi ro…’, ‘Đang tạo dự án…’). Overlay có tham chiếu đếm (reference-counted), tự ẩn khi tất cả tác vụ đồng thời kết thúc. Tránh việc user bấm 2 lần cùng một nút hoặc nghĩ ứng dụng đóng băng." | Out-Null

  AddHeading3 "0.4. Toast thông báo kết quả (góc dưới phải)"
  AddParagraph -Text "Kết quả của mọi thao tác (thành công hoặc thất bại) hiển thị qua toast pop-up nhỏ ở góc dưới phải màn hình. Không dùng banner message inline trong form. Quy tắc:" | Out-Null
  AddBullets @(
    "Toast success (tone xanh lá, border trái xanh): tự ẩn sau 4 giây. Tiêu đề ngắn gọn (‘Đã lưu thay đổi’) + mô tả phụ (tên đối tượng).",
    "Toast error (tone đỏ, border trái đỏ): hiển thị 6 giây hoặc đến khi user đóng. Tiêu đề (‘Không lưu được tài liệu’) + chi tiết lỗi từ server (nếu có).",
    "Toast warning (tone vàng): cho cảnh báo non-blocking — vd thiếu thông tin bắt buộc, vượt KTQT cap.",
    "Tối đa hiển thị nhiều toast cùng lúc dạng stack — toast mới chèn xuống dưới, có nút ‘X’ ở mỗi card để đóng thủ công."
  )

  AddHeading3 "0.5. Bảng lịch sử thao tác (Activity Log) tại mỗi tab"
  AddParagraph -Text "Mỗi tab thông tin của trang chi tiết dự án có một bảng ‘Nhật ký thay đổi’ ở cuối tab, hiển thị các activity log liên quan tới phạm vi tab đó. Mục đích: minh bạch — người xem có thể truy lại ai đã thay đổi gì, khi nào, từ giá trị cũ sang giá trị mới." | Out-Null
  $tblLog = NewTable -Rows 8 -Cols 2 -Headers @("Tab", "Action filter (activity log)") -WidthPct @(35, 65)
  FillRow -Table $tblLog -Row 2 -Values @("Thông tin khởi tạo", "PROJECT_INFO_UPDATED, PROJECT_CLOSED, PROJECT_REOPENED (chia sẻ với Overview)")
  FillRow -Table $tblLog -Row 3 -Values @("Overview (Thông tin chung)", "PROJECT_INFO_UPDATED, PROJECT_CLOSED, PROJECT_REOPENED")
  FillRow -Table $tblLog -Row 4 -Values @("Nhân sự", "PERSONNEL_UPDATED, PERSONNEL_ADDED, PERSONNEL_REMOVED")
  FillRow -Table $tblLog -Row 5 -Values @("Tài liệu", "DOCUMENT_ADDED, DOCUMENT_UPDATED, DOCUMENT_DELETED")
  FillRow -Table $tblLog -Row 6 -Values @("Quản lý rủi ro", "RISK_CREATED, RISK_UPDATED, RISK_DELETED")
  FillRow -Table $tblLog -Row 7 -Values @("Kế hoạch", "TASK_*, SUBTASK_*, WORKLOG_ADDED, HOURS_CHANGED")
  FillRow -Table $tblLog -Row 8 -Values @("Phân bổ giờ công", "ALLOCATION_UPDATED")
  AddBlank
  AddParagraph -Text "Cấu trúc bảng (mỗi tab): cột Thời gian (dd/MM/yyyy HH:mm), Người thực hiện (tên + avatar), Hành động (pill tiếng Việt theo ACTION_LABELS), Đối tượng (entityName), Chi tiết thay đổi (diff field → field, oldValue → newValue). Đọc-only — sắp xếp mới nhất trước." | Out-Null

  AddHeading3 "0.6. Cảnh báo task quá hạn / sắp đến hạn trên Gantt + danh sách task"
  AddParagraph -Text "Trên biểu đồ Gantt (cả tab Kế hoạch trong chi tiết dự án lẫn trang Gantt độc lập) và danh sách công việc tại trang Việc của tôi, hệ thống tự động phân loại deadline của task chưa hoàn thành (progress < 100 và status ≠ DONE):" | Out-Null
  AddBullets @(
    "Quá hạn (Overdue): endDate < hôm nay → viền đỏ trên thanh Gantt, gạch đỏ bên trái dòng task, badge ‘⚠ Quá hạn’ kèm tên task.",
    "Sắp đến hạn (Due-soon): endDate trong vòng 4 ngày tới (≤ 4 ngày) → viền vàng trên thanh Gantt, gạch vàng bên trái dòng task, badge ‘◐ Sắp đến hạn’.",
    "Task đã hoàn thành (DONE hoặc progress ≥ 100%) không bị highlight.",
    "Tooltip khi hover thanh Gantt bổ sung trạng thái deadline ‘(Quá hạn)’ / ‘(Sắp đến hạn)’ vào nội dung."
  )
  PageBreak
}

function AddModuleAdmin {
  AddHeading2 "I. Module Quản trị hệ thống"

  # 1. Đăng nhập / Đăng xuất
  AddFunctionBlock `
    -Title "1. Đăng nhập / Đăng xuất hệ thống" `
    -Description "Cho phép người dùng truy cập vào Hệ thống QLDA bằng tài khoản nội bộ AITS (xác thực qua AD/LDAP). Hệ thống ghi nhận log đăng nhập (IP, thời gian, trạng thái) phục vụ kiểm toán. Cho phép người dùng đăng xuất khỏi hệ thống và huỷ phiên." `
    -Users "Tất cả người dùng đã được cấp tài khoản trên hệ thống LDAP của Công ty (đồng bộ từ HRM, được Admin/PMO kích hoạt)." `
    -Steps @(
      "Truy cập đường dẫn hệ thống QLDA.",
      "Nhập tên tài khoản và mật khẩu LDAP.",
      "Nhấn nút ‘Đăng nhập’.",
      "Để đăng xuất: nhấn biểu tượng đăng xuất tại khối Profile (góc dưới trái sidebar)."
    ) `
    -UiNote "Trang đăng nhập (LoginPage) chia hai khối: khối giới thiệu (trái) và khối form đăng nhập (phải). Cuối form có danh sách quick-login phục vụ môi trường demo (ẩn ở môi trường Production)." `
    -Fields @(
      @{field="Tài khoản"; control="Input"; maxlen="60"; required="Có"; desc="Tài khoản LDAP của AITS (ví dụ: pm.an). Hệ thống tự động ghép hậu tố @qlda.local trước khi gọi Supabase Auth. Lưu giá trị cuối cùng đã nhập (nếu trình duyệt cho phép)."},
      @{field="Mật khẩu"; control="Password input"; maxlen="64"; required="Có"; desc="Mật khẩu LDAP. Hệ thống che ký tự, không lưu trữ trong FE state sau khi đăng nhập."},
      @{field="Đăng nhập"; control="Button"; maxlen="-"; required="-"; desc="Gọi API /auth/login (Supabase Auth signInWithPassword). Khi thành công: chuyển hướng tới trang trước đó hoặc /dashboard. Khi thất bại: highlight 2 trường, hiển thị thông báo lỗi cụ thể (sai mật khẩu / tài khoản chưa được kích hoạt / lỗi kết nối)."},
      @{field="Quick-login (Demo)"; control="Button list"; maxlen="-"; required="-"; desc="Danh sách 8 tài khoản demo (pm.an, pm.ha, sys.chau, hc.hoa, dev.binh, dev.duy, dev.khang, dev.lan). Chỉ hiển thị ở môi trường demo. Bấm sẽ gọi đăng nhập với mật khẩu 123456."},
      @{field="Đăng xuất"; control="Icon button"; maxlen="-"; required="-"; desc="Hiển thị tại Profile-block của Sidebar (AppShell). Gọi API logout, xoá Supabase session, chuyển hướng /login."}
    )

  # 2. Phân quyền người dùng — based on BRD
  AddFunctionBlock `
    -Title "2. Phân quyền người dùng" `
    -Description "Cho phép tài khoản Admin/PMO cấp vai trò cho các tài khoản khác trong hệ thống. Vai trò xác định phạm vi dữ liệu (xem dự án nào) và phạm vi chức năng (CRUD những gì). Danh sách 4 vai trò chuẩn: PMO, ADMIN_HC, PM, DELIVERY_MEMBER. Ngoài ra có thuộc tính chức danh chức năng FunctionalTitle = {NORMAL, KSV} dùng để định danh người duyệt KSV trong quy trình đóng dự án (BA 14/05/2026: TCNL đã bị loại bỏ — TCHC chính là vai trò ADMIN_HC, không cần overlay)." `
    -Users "Người dùng được phân quyền Admin/PMO." `
    -Steps @(
      "Đăng nhập với tài khoản PMO.",
      "Truy cập module Quản trị > Người dùng (tính năng Quản trị người dùng thuộc roadmap v3.x — UI sẽ bổ sung).",
      "Tìm kiếm và chọn tài khoản cần phân quyền, nhấn ‘Hành động’ để mở pop-up cập nhật vai trò."
    ) `
    -UiNote "Danh sách người dùng hiển thị dạng bảng. Header có ô tìm kiếm. Cột cuối là ‘Hành động’. Pop-up phân quyền cho phép chọn vai trò chính, gán chức danh chức năng và bật/tắt isActive." `
    -Fields @(
      @{field="Tìm kiếm"; control="Input"; maxlen="60"; required="Không"; desc="Tìm theo tên truy cập, mã NV, email, đơn vị. Filter realtime sau khi gõ 300ms."},
      @{field="Hành động"; control="Button"; maxlen="-"; required="-"; desc="Mở pop-up phân quyền của tài khoản tương ứng."},
      @{field="Tên truy cập"; control="Label"; maxlen="-"; required="-"; desc="Username LDAP của người dùng."},
      @{field="Họ và tên"; control="Label"; maxlen="-"; required="-"; desc="Họ tên đầy đủ (đồng bộ từ HRM)."},
      @{field="Email"; control="Label"; maxlen="-"; required="-"; desc="Email công ty."},
      @{field="Đơn vị"; control="Label"; maxlen="-"; required="-"; desc="Phòng/ban hiện tại của người dùng (đồng bộ từ HRM)."},
      @{field="Vai trò"; control="Dropdown"; maxlen="-"; required="Có"; desc="Một trong: PMO, ADMIN_HC, PM, DELIVERY_MEMBER. Hệ thống normalize SYSTEM_ADMIN → PMO và PROJECT_ADMIN → PM khi đọc dữ liệu."},
      @{field="Chức danh chức năng"; control="Dropdown"; maxlen="-"; required="Không"; desc="NORMAL / KSV — chỉ KSV còn là functional title overlay (BA 14/05/2026 đã loại bỏ TCNL). KSV gán cho nhân sự DBCL đóng vai trò người phê duyệt đóng dự án (stage-1)."},
      @{field="Kích hoạt"; control="Toggle"; maxlen="-"; required="Có"; desc="Bật/tắt tài khoản. Tài khoản không kích hoạt không thể đăng nhập."},
      @{field="Ngày tạo / Ngày sửa cuối"; control="Label"; maxlen="-"; required="-"; desc="Audit columns — không cho chỉnh sửa."}
    )

  # 3. Quản trị danh mục
  AddFunctionBlock `
    -Title "3. Quản trị danh mục hệ thống (LOV)" `
    -Description "Quản lý các nhóm giá trị dùng chung (List of Values) phục vụ các dropdown / nhãn trạng thái trong toàn hệ thống. Có 07 nhóm danh mục: Trạng thái dự án, Trạng thái sức khoẻ dự án, Trạng thái công việc, Mức độ rủi ro, Loại tài liệu, Đơn vị, Vai trò tổ triển khai. Hai nhóm Trạng thái dự án và Trạng thái sức khoẻ là READ-ONLY (giá trị do hệ thống quản lý)." `
    -Users "PMO." `
    -Steps @(
      "Đăng nhập với tài khoản PMO.",
      "Truy cập menu ‘Cài đặt’ ở Sidebar (route /admin/catalogs).",
      "Chọn nhóm danh mục cần chỉnh sửa.",
      "Nhấn ‘Thêm giá trị’ để mở khối nhập liệu, hoặc nhấn biểu tượng thùng rác để xoá một giá trị."
    ) `
    -UiNote "Trang AdminCatalogPage hiển thị 7 thẻ (card) — mỗi thẻ là một nhóm LOV. Mỗi thẻ có header (tên nhóm, mô tả, số giá trị hiện có), danh sách giá trị, và nút thêm. Bên dưới có panel ‘Nhân sự Khách hàng / Đối tác’ (xem mục IX.2)." `
    -Fields @(
      @{field="Tên nhóm danh mục"; control="Label"; maxlen="-"; required="-"; desc="Tiêu đề thẻ. Ví dụ: ‘Trạng thái dự án’, ‘Mức độ rủi ro’."},
      @{field="Mã giá trị (value)"; control="Input"; maxlen="40"; required="Có"; desc="Mã định danh code (ví dụ APPROVED). Không trùng trong cùng nhóm. Hệ thống kiểm tra trùng khi lưu, báo lỗi nếu trùng."},
      @{field="Nhãn hiển thị (label)"; control="Input"; maxlen="80"; required="Có"; desc="Tên hiển thị trên giao diện. Ví dụ: ‘Đã duyệt’."},
      @{field="Mô tả (description)"; control="Input"; maxlen="200"; required="Không"; desc="Ghi chú thêm về giá trị, hiển thị mờ bên dưới label."},
      @{field="Thêm giá trị"; control="Button"; maxlen="-"; required="-"; desc="Mở khối nhập liệu. Sau khi điền 3 trường, nhấn ‘Thêm’ → gọi API PATCH /catalogs/:groupKey, cập nhật toàn bộ giá trị nhóm; FE refresh snapshot."},
      @{field="Xoá giá trị"; control="Icon button"; maxlen="-"; required="-"; desc="Xoá giá trị khỏi nhóm. Cảnh báo nếu giá trị đang được dự án sử dụng."},
      @{field="Reset dữ liệu demo"; control="Button"; maxlen="-"; required="-"; desc="Chỉ hiển thị cho PMO trong môi trường demo. Bấm sẽ wipe + reseed toàn bộ dữ liệu — yêu cầu xác nhận hai bước (Reset → Xác nhận reset). Gọi POST /admin/reset-demo-data."}
    )
  PageBreak
}

# ─── C.II  Module Trang chủ / Dashboard ───
function AddModuleDashboard {
  AddHeading2 "II. Module Trang chủ – Dashboard"

  AddFunctionBlock `
    -Title "1. Hiển thị Dashboard tổng quan" `
    -Description "Cung cấp cái nhìn toàn cảnh về danh mục dự án đang phụ trách: KPI cardc về số dự án, dự án rủi ro, task chặn, raise đang mở; biểu đồ trạng thái dự án; biểu đồ giờ công kế hoạch vs thực tế; biểu đồ sức khoẻ dự án; cảnh báo lệch giờ; danh sách rủi ro nổi bật; hồ sơ tài khoản hiện tại. Dữ liệu được lọc theo phạm vi vai trò người đăng nhập (logic getVisibleProjects)." `
    -Users "Mọi người dùng đã đăng nhập (dữ liệu được lọc theo phạm vi xem dự án của vai trò)." `
    -Steps @(
      "Đăng nhập hệ thống.",
      "Trang Dashboard tự động được mở (route mặc định /dashboard).",
      "Click vào card / item để mở chi tiết dự án / rủi ro / cảnh báo tương ứng."
    ) `
    -UiNote "Bố cục dạng grid 12 cột: hàng 1 — 4 stat-card; hàng 2 — biểu đồ Pie (trạng thái) | LineChart (capacity vs planned vs actual); hàng 3 — BarChart (sức khoẻ) | danh sách rủi ro nổi bật; hàng 4 — danh sách lệch giờ tháng | hồ sơ tài khoản." `
    -Fields @(
      @{field="Card ‘Dự án phụ trách’"; control="Stat card"; maxlen="-"; required="-"; desc="Số lượng dự án trong phạm vi xem của người dùng (lọc theo role). Helper: ‘Theo vai trò hiện tại’."},
      @{field="Card ‘Dự án rủi ro’"; control="Stat card"; maxlen="-"; required="-"; desc="Số dự án có health ≠ STABLE hoặc có rủi ro mức HIGH chưa giảm nhẹ."},
      @{field="Card ‘Task bị chặn’"; control="Stat card"; maxlen="-"; required="-"; desc="Tổng số task có status = BLOCKED hoặc NEEDS_REPLAN trong tập dự án phụ trách."},
      @{field="Card ‘Raise đang mở’"; control="Stat card"; maxlen="-"; required="-"; desc="Tổng số delay-raise có status = OPEN hoặc ACKNOWLEDGED."},
      @{field="Biểu đồ ‘Trạng thái dự án’"; control="Pie chart"; maxlen="-"; required="-"; desc="Pie chart phân loại số lượng dự án theo trạng thái (ACTIVE / PAUSED / CLOSED). Hover hiện tooltip số lượng."},
      @{field="Biểu đồ ‘Kế hoạch & giờ công’"; control="Line chart"; maxlen="-"; required="-"; desc="3 đường: Capacity (tổng monthlyCapacity tháng), Planned (tổng plannedHours), Actual (tổng worklog hours) theo tháng. Trục X = tháng; trục Y = giờ."},
      @{field="Biểu đồ ‘Sức khoẻ dự án’"; control="Bar chart"; maxlen="-"; required="-"; desc="Bar chart đếm dự án theo nhóm health: Ổn định / Cần xem xét / Có rủi ro."},
      @{field="Panel ‘Rủi ro nổi bật’"; control="List"; maxlen="-"; required="-"; desc="Top 4 rủi ro mở (status ≠ MITIGATED), sắp xếp theo lastUpdated. Hiển thị: tiêu đề, mã dự án, tên dự án, mức độ."},
      @{field="Panel ‘Lệch giờ tháng’"; control="List"; maxlen="-"; required="-"; desc="Top 5 thành viên có |Planned − Capacity| > 10h trong tháng đang xét. Hiển thị: tên, capacity, planned, delta."},
      @{field="Panel ‘Hồ sơ của bạn’"; control="Profile card"; maxlen="-"; required="-"; desc="Hiển thị avatar, tên, vai trò, username, đơn vị, capacity tháng, ngày hiện tại."}
    )
  PageBreak
}

# ─── C.III  Module Khởi tạo dự án ───
function AddModuleInit {
  AddHeading2 "III. Module Khởi tạo dự án"

  # III.1 Danh sách dự án
  AddFunctionBlock `
    -Title "1. Xem danh sách dự án" `
    -Description "Cho phép người dùng xem danh sách dự án theo phạm vi vai trò. Sau BA 12/05/2026 (đã loại bỏ luồng phê duyệt): PMO thấy 3 nhóm (Đang triển khai, Tạm đóng, Đã đóng) — không còn nhóm ‘Chờ phê duyệt’; ADMIN_HC thấy 1 nhóm gộp ‘Dự án đã khởi tạo’; PM thấy 2 nhóm (PM phụ trách, Tham gia điều phối); DELIVERY_MEMBER thấy 1 nhóm (Dự án tham gia). Mỗi dự án hiển thị thông tin tổng quan và đường tới trang chi tiết." `
    -Users "Mọi người dùng đã đăng nhập (lọc theo phạm vi vai trò)." `
    -Steps @(
      "Truy cập menu ‘Dự án’ ở sidebar.",
      "Xem các section dự án theo vai trò.",
      "Bấm ‘Xem chi tiết’ trên card hoặc click vào card để mở trang chi tiết dự án."
    ) `
    -UiNote "Mỗi section có heading (tên + mô tả + tổng số dự án); bên dưới là grid card. Card hiển thị mã, tên, status pill, approval pill, sponsor, PM, timeline, health pill, progress bar, số nhân sự, số tài liệu, số rủi ro, danh sách thành viên TTK." `
    -Fields @(
      @{field="Nút ‘Tạo dự án’"; control="Button"; maxlen="-"; required="-"; desc="Chỉ hiển thị cho ADMIN_HC (TCHC) sau BA 12/05/2026. Mở pop-up ‘Tạo dự án mới’ (xem chức năng tiếp theo). Bố trí ở góc phải SectionHeader."},
      @{field="Section group"; control="Group"; maxlen="-"; required="-"; desc="Chia theo vai trò. Mỗi group hiển thị: tiêu đề, mô tả ngắn, status-pill số lượng dự án."},
      @{field="Mã dự án"; control="Label"; maxlen="-"; required="-"; desc="Hiển thị eyebrow trên card. Ví dụ: PRJ-2026-001."},
      @{field="Tên dự án"; control="Label"; maxlen="-"; required="-"; desc="Heading trên card."},
      @{field="Pill trạng thái"; control="Status pill"; maxlen="-"; required="-"; desc="Đang triển khai / Tạm đóng / Đã đóng (tone tương ứng info/warning/success). Pill ‘Chờ HC duyệt’ / ‘Đã duyệt TTK’ đã được loại bỏ sau BA 12/05/2026."},
      @{field="Tóm tắt"; control="Paragraph"; maxlen="-"; required="-"; desc="Mô tả ngắn nội dung dự án."},
      @{field="PM phụ trách"; control="Label"; maxlen="-"; required="-"; desc="Tên Project Manager (project.adminId → User.name)."},
      @{field="Sponsor"; control="Label"; maxlen="-"; required="-"; desc="Người bảo trợ dự án (chọn từ danh sách User non-DELIVERY)."},
      @{field="Thời gian"; control="Label"; maxlen="-"; required="-"; desc="startDate – endDate, format dd/MM/yyyy."},
      @{field="Health pill"; control="Status pill"; maxlen="-"; required="-"; desc="Ổn định / Cần xem xét / Có rủi ro (tone success/warning/danger)."},
      @{field="Progress bar"; control="Progress"; maxlen="-"; required="-"; desc="% hoàn thành tổng thể dự án (tính từ recalculateProjectProgress)."},
      @{field="Số nhân sự / tài liệu / rủi ro"; control="Inline metrics"; maxlen="-"; required="-"; desc="3 chip icon: số nhân sự AITS, số tài liệu, số rủi ro mở."},
      @{field="Danh sách TTK"; control="Label"; maxlen="-"; required="-"; desc="Liệt kê tên thành viên TTK (project.personnelInfo.aitsMembers.fullName)."},
      @{field="Xem chi tiết"; control="Link button"; maxlen="-"; required="-"; desc="Điều hướng tới /projects/:id."}
    )

  # III.2 Tạo mới dự án
  AddFunctionBlock `
    -Title "2. Tạo mới dự án" `
    -Description "Chỉ vai trò TCHC (ADMIN_HC) có quyền khởi tạo dự án (quyết định BA 12/05/2026 — đã loại bỏ luồng phê duyệt PENDING → APPROVED; PMO không còn thẩm quyền tạo dự án). Hiển thị dưới dạng pop-up modal full-width. Yêu cầu chọn đầy đủ thông tin cơ bản, PM, danh sách nhân sự triển khai và vai trò từng nhân sự. Hệ thống kiểm tra: tên không trùng dự án đang hoạt động, ngày kết thúc > ngày bắt đầu, tổng ≥ 1 thành viên TTK, PM nằm trong danh sách thành viên. Dự án có hiệu lực (status = ACTIVE) ngay khi TCHC bấm Tạo dự án — không còn pending state, không còn pill ‘Chờ phê duyệt’ / ‘Đã duyệt TTK’." `
    -Users "TCHC (ADMIN_HC). Tài khoản khác (PMO, PM, …) sẽ không thấy nút ‘Tạo dự án’ trên giao diện và bị BE từ chối với HTTP 403 nếu gọi trực tiếp API." `
    -Steps @(
      "Đăng nhập với tài khoản TCHC (hc.hoa trong demo).",
      "Tại trang Dự án, bấm nút ‘Tạo dự án’ (chỉ TCHC mới thấy).",
      "Điền các thông tin: mã (tự sinh, có thể sửa), tên, tóm tắt, sponsor, PM, ngày BĐ/KT, nhiệm vụ, số QĐ TTK.",
      "Trong Roster builder: dùng dropdown ‘+ Thêm nhân sự’ để chọn thành viên, sau đó cập nhật Vai trò và Nhiệm vụ cho từng dòng.",
      "Bấm ‘Tạo dự án’ → pop-up xác nhận hiển thị tóm tắt (số thành viên, mã dự án). Bấm xác nhận → loading overlay → toast thành công."
    ) `
    -UiNote "Pop-up modal full-width. Header có eyebrow ‘TCHC workspace’, tiêu đề ‘Tạo dự án mới’, nút đóng (X). Phần body chia 2 cột grid form, bên dưới là Roster builder dạng bảng. Footer có nút Huỷ và Tạo dự án." `
    -Fields @(
      @{field="Mã dự án"; control="Input"; maxlen="40"; required="Có"; desc="Tự sinh theo định dạng PRJ-<năm>-<STT 3 chữ số> (ví dụ PRJ-2026-001). Có thể sửa, không trùng với mã dự án đang hoạt động."},
      @{field="Tên dự án"; control="Input"; maxlen="255"; required="Có"; desc="Tên dự án không trùng với tên dự án đang ACTIVE."},
      @{field="Tóm tắt"; control="Textarea"; maxlen="1000"; required="Có"; desc="Mô tả ngắn về dự án, hiển thị trên card dự án."},
      @{field="Sponsor dự án"; control="Dropdown"; maxlen="-"; required="Có"; desc="Người bảo trợ — chọn từ danh sách User có vai trò ≠ DELIVERY_MEMBER."},
      @{field="PM dự án"; control="Dropdown"; maxlen="-"; required="Có"; desc="Chỉ liệt kê các User có vai trò PM đã được tick chọn trong Roster builder. Khi chọn xong, dòng tương ứng trong roster tự cập nhật vai trò ‘PM dự án’ và disable cột Vai trò."},
      @{field="Ngày bắt đầu"; control="Date input"; maxlen="-"; required="Có"; desc="Định dạng yyyy-MM-dd. Mặc định = hôm nay."},
      @{field="Ngày kết thúc"; control="Date input"; maxlen="-"; required="Có"; desc="Định dạng yyyy-MM-dd. Mặc định = cuối tháng (+ 4 tháng). Validation: endDate > startDate."},
      @{field="Nhiệm vụ"; control="Textarea"; maxlen="1000"; required="Có"; desc="Mục tiêu / nhiệm vụ TTK."},
      @{field="Số quyết định TTK"; control="Input"; maxlen="80"; required="Không"; desc="Ví dụ: QĐ-2026/001. Sau quyết định BA 12/05/2026: trường ‘File quyết định’ (approvalRequestFileName) đã được loại bỏ — file QĐ được tải lên tại tab Tài liệu của dự án sau khi tạo, không còn nằm trong luồng tạo."},
      @{field="Roster — Thêm nhân sự"; control="Dropdown"; maxlen="-"; required="-"; desc="Liệt kê tất cả User có vai trò PM hoặc DELIVERY_MEMBER chưa được chọn. Chọn để thêm vào bảng roster."},
      @{field="Roster — Họ và tên"; control="Label"; maxlen="-"; required="-"; desc="Hiển thị tên thành viên (đồng bộ HRM, không cho sửa)."},
      @{field="Roster — Chức danh"; control="Label"; maxlen="-"; required="-"; desc="Title của User (đồng bộ HRM, không sửa)."},
      @{field="Roster — Đơn vị"; control="Label"; maxlen="-"; required="-"; desc="Đơn vị (đồng bộ HRM, không sửa)."},
      @{field="Roster — Vai trò"; control="Dropdown"; maxlen="-"; required="Có"; desc="Vai trò trong TTK. Mặc định ‘Thành viên triển khai’. Lấy từ catalogs.projectMemberRoles. Bị disable nếu là PM."},
      @{field="Roster — Nhiệm vụ"; control="Input"; maxlen="255"; required="Không"; desc="Nhiệm vụ cụ thể của thành viên trong dự án."},
      @{field="Roster — Mã NV"; control="Label"; maxlen="-"; required="-"; desc="Hiển thị User.employeeCode (đồng bộ HRM, không sửa)."},
      @{field="Roster — Xoá"; control="Icon button"; maxlen="-"; required="-"; desc="Gỡ thành viên khỏi roster. Nếu thành viên là PM, hệ thống reset PM = rỗng. Thao tác drafy state — không cần confirm."},
      @{field="Huỷ"; control="Button"; maxlen="-"; required="-"; desc="Đóng modal, không lưu."},
      @{field="Tạo dự án"; control="Button (submit)"; maxlen="-"; required="-"; desc="Validate: chọn ≥1 thành viên, PM phải có trong roster. Mở ConfirmDialog xác nhận → gọi POST /api/projects (BE chỉ chấp nhận khi role = ADMIN_HC), BE: tạo project + member rows + activity log; trả về snapshot. FE refresh + đóng modal + reset form + hiển thị toast thành công ở góc dưới phải. Trạng thái khởi tạo: ACTIVE (không còn approvalInfo)."}
    )

  # III.3 Cập nhật thông tin khởi tạo
  AddFunctionBlock `
    -Title "3. Cập nhật thông tin khởi tạo" `
    -Description "Cho phép TCHC / PMO / PM phụ trách sửa các thông tin khởi tạo cơ bản của dự án: mã, tên, tóm tắt, sponsor, nhiệm vụ, số QĐ TTK, PM, ngày BĐ/KT, đơn vị. Tab áp dụng quy ước UX chung — readonly khi mở (xem mục C.0.1) và phải bấm Cập nhật để chỉnh sửa. Mọi thay đổi được ghi vào activity log với action PROJECT_INFO_UPDATED và diff field-level; hiển thị tại bảng ‘Nhật ký thay đổi’ ở cuối tab." `
    -Users "TCHC / PMO / PM của dự án / Chuyên viên QLDA (có quyền canEditProjectInfo)." `
    -Steps @(
      "Mở trang chi tiết dự án (/projects/:id).",
      "Vào tab ‘Thông tin khởi tạo’ — mặc định ở Chế độ xem, tất cả trường readonly.",
      "Bấm ‘Cập nhật’ trên thanh EditModeBar → các trường trở thành editable.",
      "Chỉnh sửa các trường được phép.",
      "Bấm ‘Lưu thay đổi’ → pop-up xác nhận → loading overlay → toast thành công ở góc dưới phải. Trang quay về Chế độ xem."
    ) `
    -UiNote "Tab PROJECT_INIT — phía trên có EditModeBar (badge trạng thái + nút Cập nhật / Lưu thay đổi / Huỷ). Form 2 cột, mỗi trường là input/select/textarea/date. Cuối tab là bảng Activity log (sắp xếp mới nhất trước)." `
    -Fields @(
      @{field="Mã dự án"; control="Input"; maxlen="40"; required="Có"; desc="Có thể sửa khi project chưa CLOSED."},
      @{field="Tên dự án"; control="Input"; maxlen="255"; required="Có"; desc="Có thể sửa."},
      @{field="Tóm tắt"; control="Textarea"; maxlen="1000"; required="Có"; desc=""},
      @{field="Sponsor"; control="Dropdown"; maxlen="-"; required="Có"; desc="Chọn từ User (≠ DELIVERY_MEMBER)."},
      @{field="PM dự án"; control="Dropdown"; maxlen="-"; required="Có"; desc="Chọn từ User có vai trò PM."},
      @{field="Ngày bắt đầu / kết thúc"; control="Date input"; maxlen="-"; required="Có"; desc="Định dạng yyyy-MM-dd."},
      @{field="Nhiệm vụ"; control="Textarea"; maxlen="1000"; required="Có"; desc=""},
      @{field="Số quyết định TTK"; control="Input"; maxlen="80"; required="Không"; desc=""},
      @{field="Đơn vị"; control="Input"; maxlen="120"; required="Không"; desc="Đơn vị chủ trì dự án."},
      @{field="Lưu thay đổi"; control="Button"; maxlen="-"; required="-"; desc="Gọi PATCH /api/projects/:id. Nếu CLOSED → API trả 403; UI ẩn nút Lưu trong tab này."}
    )
  PageBreak
}

# ─── C.IV  Module Triển khai dự án ───
function AddModuleExecution {
  AddHeading2 "IV. Module Triển khai dự án"
  AddParagraph -Text "Trang chi tiết dự án (ProjectDetailPage) chia 7 tab và một panel CloseFlow nằm ngoài tab. Các tab gồm: Thông tin khởi tạo, Overview (chung + tài chính + cơ sở căn cứ), Nhân sự, Tài liệu, Quản lý rủi ro, Kế hoạch (Gantt + task tree), Phân bổ giờ công. Khi project.status = CLOSED, tất cả mutation API bị deny ở BE; UI ẩn các nút chỉnh sửa." | Out-Null
  AddBlank

  # IV.1 Tab Overview
  AddFunctionBlock `
    -Title "1. Cập nhật thông tin chung (Tab Overview)" `
    -Description "Cập nhật các thông tin chung của dự án: tóm tắt, sponsor, nhiệm vụ, ngày bắt đầu, hình thức TTK (Kiêm nhiệm / Chuyên trách), hình thức triển khai (HD/PLHD, TK THD, Nội bộ), thời lượng dự kiến (ngày / giờ công), và 4 nhóm hồ sơ căn cứ: Hợp đồng đầu ra, Hợp đồng đầu vào, Phê duyệt triển khai, Quyết định thành lập tổ dự án. Bên cạnh đó là khối Tài chính: Doanh thu, Chi phí nội bộ, Chi phí thuê ngoài, Lợi nhuận và Nguồn chi phí. Tab áp dụng quy ước UX chung (xem C.0.1) — readonly khi mở; nút ‘Thêm mục’ và ‘Xoá’ trong 4 nhóm hồ sơ căn cứ chỉ hiển thị sau khi bấm Cập nhật. Cuối tab có bảng Activity log lọc theo phạm vi Overview." `
    -Users "PMO / PM của dự án / Chuyên viên QLDA." `
    -Steps @(
      "Mở tab ‘Overview’ — mặc định Chế độ xem (readonly).",
      "Bấm ‘Cập nhật’ trên EditModeBar → form trở thành editable, các nút ‘+ Thêm mục’ và ‘Xoá’ trong 4 thẻ hồ sơ căn cứ hiển thị.",
      "Cập nhật các trường thông tin chung và 4 nhóm hồ sơ căn cứ. Bấm ‘+ Thêm mục’ để thêm dòng; bấm ‘Xoá’ trên một dòng → ConfirmDialog danger yêu cầu xác nhận trước khi gỡ.",
      "Cập nhật khối Tài chính.",
      "Bấm ‘Lưu thay đổi’ → ConfirmDialog → loading overlay → toast thành công."
    ) `
    -UiNote "Bố cục tab Overview: phía trên EditModeBar; bên dưới chia 3 khối — (1) Thông tin chung (2 cột); (2) Cơ sở căn cứ (4 thẻ — mỗi thẻ có toolbar ‘+ Thêm mục’ trong edit-mode và danh sách dòng); (3) Tài chính (2 cột). Cuối tab là bảng Activity log." `
    -Fields @(
      @{field="Tóm tắt"; control="Textarea"; maxlen="1000"; required="Có"; desc="Cập nhật tóm tắt dự án."},
      @{field="Sponsor"; control="Dropdown"; maxlen="-"; required="Có"; desc="Chọn từ User ≠ DELIVERY_MEMBER."},
      @{field="Nhiệm vụ"; control="Textarea"; maxlen="1000"; required="Có"; desc="Mục tiêu / nhiệm vụ TTK."},
      @{field="PM dự án"; control="Dropdown"; maxlen="-"; required="Có"; desc="Chọn từ User có vai trò PM."},
      @{field="Ngày bắt đầu"; control="Date input"; maxlen="-"; required="Có"; desc=""},
      @{field="Hình thức TTK"; control="Dropdown"; maxlen="-"; required="Có"; desc="CHUYEN_TRACH (Chuyên trách) / KIEM_NHIEM (Kiêm nhiệm)."},
      @{field="Hình thức triển khai"; control="Dropdown"; maxlen="-"; required="Có"; desc="HD_PLHD / TK_THD / NOI_BO."},
      @{field="Thời lượng (ngày)"; control="Number"; maxlen="6"; required="Không"; desc="Tổng số ngày dự kiến triển khai."},
      @{field="Thời lượng (giờ công)"; control="Number"; maxlen="8"; required="Không"; desc="Tổng giờ công kế hoạch dự án."},
      @{field="Hợp đồng đầu ra — Tên tài liệu"; control="Input (row)"; maxlen="255"; required="Không"; desc="Tên hợp đồng đầu ra. Tab Overview cho phép thêm nhiều dòng."},
      @{field="Hợp đồng đầu ra — Ghi chú"; control="Input (row)"; maxlen="500"; required="Không"; desc="Ghi chú đính kèm."},
      @{field="Hợp đồng đầu vào — Tên / Ghi chú"; control="Input (row)"; maxlen="255/500"; required="Không"; desc="Tương tự — tên hợp đồng đầu vào và ghi chú."},
      @{field="Phê duyệt triển khai — Tên / Ghi chú"; control="Input (row)"; maxlen="255/500"; required="Không"; desc="Phê duyệt triển khai dự án."},
      @{field="Quyết định thành lập tổ dự án — Tên / Ghi chú"; control="Input (row)"; maxlen="255/500"; required="Không"; desc="Quyết định thành lập tổ dự án (TTK)."},
      @{field="Doanh thu — Giá trị / Ghi chú"; control="Number + Input"; maxlen="14/500"; required="Không"; desc="Tổng doanh thu dự án (VND). Hiển thị preview format ‘x.xxx.xxx VND’."},
      @{field="Chi phí nội bộ — Giá trị / Ghi chú"; control="Number + Input"; maxlen="14/500"; required="Không"; desc=""},
      @{field="Chi phí thuê ngoài — Giá trị / Ghi chú"; control="Number + Input"; maxlen="14/500"; required="Không"; desc=""},
      @{field="Lợi nhuận — Giá trị / Ghi chú"; control="Number + Input"; maxlen="14/500"; required="Không"; desc="Có thể tự tính (Doanh thu − chi phí), hoặc nhập tay."},
      @{field="Nguồn chi phí"; control="Input"; maxlen="500"; required="Không"; desc="Nguồn ngân sách: ‘Nội bộ AITS’, ‘Hợp đồng VNA’, …"},
      @{field="Lưu thay đổi"; control="Button (EditModeBar)"; maxlen="-"; required="-"; desc="Mở ConfirmDialog xác nhận; sau khi xác nhận: loading overlay → PATCH /api/projects/:id → BE ghi activity log PROJECT_INFO_UPDATED với diff → trả snapshot → FE refresh → toast thành công → tab tự thoát Chế độ chỉnh sửa."}
    )

  # IV.2 Quản lý nhân sự
  AddFunctionBlock `
    -Title "2. Quản lý nhân sự dự án (Tab Nhân sự)" `
    -Description "Quản lý 3 nhóm nhân sự dự án: (a) Nhân sự AITS — đồng bộ từ HRM, BẮT BUỘC liên kết với User trong hệ thống qua User picker (quyết định BA 12/05/2026: bỏ free-text, mỗi dòng phải có userId trỏ về User thật để có thể phân bổ capacity giờ công); (b) Nhân sự Khách hàng — chọn từ danh mục KH/Đối tác hoặc nhập tự do; (c) Đối tác — tương tự KH. Mỗi nhân sự có vai trò trong dự án, nhiệm vụ, tổng giờ công kế hoạch. Khi xoá nhân sự khỏi dự án, giờ công đã thực hiện (worklog) vẫn được giữ nguyên. Tab áp dụng quy ước UX chung (readonly mặc định + EditModeBar + nút Thêm/Xoá ẩn ở Chế độ xem). Khối ‘MAPPING — Nhân sự chưa liên kết’ ở phiên bản trước đã được loại bỏ vì không còn dòng AITS nào không có userId." `
    -Users "PMO / PM của dự án / Chuyên viên QLDA." `
    -Steps @(
      "Mở tab ‘Nhân sự’ — mặc định Chế độ xem; nút ‘+ Thêm nhân sự’ và cột ‘Tác vụ’ (chứa nút Xoá) bị ẩn.",
      "Bấm ‘Cập nhật’ trên EditModeBar → form trở thành editable; nút ‘+ Thêm nhân sự’ trong mỗi bảng và cột ‘Tác vụ’ xuất hiện.",
      "AITS: bấm ‘+ Thêm nhân sự’ → 1 dòng mới với select User dropdown; chọn nhân viên → các cột Họ tên / Chức danh / Đơn vị / Email / SĐT autofill và readonly. Chỉ nhập Vai trò / Nhiệm vụ / Tổng giờ công.",
      "KH / Đối tác: thêm dòng → nhập tự do hoặc chọn từ danh mục dùng chung.",
      "Để xoá: bấm icon thùng rác → ConfirmDialog danger (hiển thị tên thành viên) → xác nhận → dòng bị gỡ khỏi draft.",
      "Bấm ‘Lưu thay đổi’ → ConfirmDialog xác nhận → loading overlay → API PATCH → toast thành công."
    ) `
    -UiNote "Tab chia 3 khối — mỗi khối là một bảng. Trong Chế độ chỉnh sửa: mỗi khối có nút ‘+ Thêm nhân sự’ ở header và cột ‘Tác vụ’ (Xoá) ở cuối mỗi dòng. Trong Chế độ xem: 2 yếu tố này ẨN hoàn toàn. Riêng nhóm AITS, cột định danh (Họ tên / Chức danh / Đơn vị / Email / SĐT / Mã NV) là readonly autofill từ User; cột User picker là một select dropdown chỉ liệt kê User chưa được chọn ở dòng khác. Cuối tab là bảng Activity log." `
    -Fields @(
      @{field="AITS — User picker"; control="Select dropdown"; maxlen="-"; required="Có"; desc="BẮT BUỘC trong v2.0. Chọn 1 User từ danh sách (không bao gồm ADMIN_HC và những user đã được chọn ở dòng AITS khác). Khi pick: tự động fill userId + employeeCode + fullName + title + unit + email + phone từ User table. BE validate userId là UUID hợp lệ; nếu rỗng → trả 400 Bad Request."},
      @{field="AITS — Họ tên"; control="Readonly label"; maxlen="-"; required="-"; desc="Lấy từ User được chọn. Không sửa được."},
      @{field="AITS — Chức danh / Đơn vị"; control="Readonly label"; maxlen="-"; required="-"; desc="Lấy từ User được chọn (User.title, User.unit). Không sửa được."},
      @{field="AITS — Vai trò"; control="Input"; maxlen="120"; required="Có"; desc="Vai trò trong dự án (ví dụ ‘PM dự án’, ‘BA’, ‘Lập trình’, ‘Test’). Có thể nhập tự do hoặc gợi ý từ catalogs.projectMemberRoles."},
      @{field="AITS — Nhiệm vụ"; control="Input"; maxlen="500"; required="Không"; desc="Nhiệm vụ cụ thể."},
      @{field="AITS — Tổng giờ công"; control="Number"; maxlen="8"; required="Không"; desc="Tổng giờ kế hoạch của thành viên cho dự án (giờ)."},
      @{field="AITS — Email / SĐT"; control="Readonly label"; maxlen="-"; required="-"; desc="Lấy từ User. Không sửa."},
      @{field="KH — Họ tên"; control="Input"; maxlen="120"; required="Có"; desc="Họ tên nhân sự khách hàng. Có thể tự gõ hoặc bấm ‘Chọn từ danh mục’ để pick từ catalog KH/Đối tác."},
      @{field="KH — Chức danh / Đơn vị / Vai trò / Nhiệm vụ / Email / SĐT"; control="Input"; maxlen="120/120/120/500/120/20"; required="Không"; desc="Thông tin nhân sự khách hàng."},
      @{field="Đối tác — Họ tên + các trường tương tự KH"; control="Input"; maxlen="-"; required="Không"; desc="Tương tự KH, dùng cho nhân sự đối tác."},
      @{field="+ Thêm nhân sự / + Thêm đối tác"; control="Button"; maxlen="-"; required="-"; desc="CHỈ HIỂN THỊ trong Chế độ chỉnh sửa. Thêm 1 dòng trống vào bảng tương ứng — dòng AITS mặc định có userId rỗng và chưa hợp lệ; phải pick User trước khi Lưu."},
      @{field="Xoá (icon thùng rác)"; control="Icon button"; maxlen="-"; required="-"; desc="CHỈ HIỂN THỊ trong Chế độ chỉnh sửa. Bấm → mở ConfirmDialog danger với tên thành viên (nếu đã có) → xác nhận → gỡ dòng khỏi draft. Worklog đã có vẫn giữ nguyên sau khi Lưu (BE cascade chỉ áp với delete project, không phải remove row personnel)."},
      @{field="Lưu thay đổi"; control="Button (EditModeBar)"; maxlen="-"; required="-"; desc="ConfirmDialog → loading overlay → PATCH /api/projects/:id với personnelInfo mới. Trước khi gửi, FE drop bất kỳ dòng AITS nào có userId rỗng (sanitizeAitsPersonnel). BE strict-validate userId là UUID; trả 400 nếu vi phạm. BE ghi PERSONNEL_UPDATED log với diff danh sách. Toast thành công ở góc dưới phải."}
    )

  # IV.3 Quản lý tài liệu
  AddFunctionBlock `
    -Title "3. Quản lý tài liệu dự án (Tab Tài liệu)" `
    -Description "Quản lý các tài liệu phục vụ dự án, phân loại theo 4 nhóm: Hợp đồng, Tài liệu dự án, Tờ trình, Biên bản họp. Hỗ trợ thêm / sửa / xoá tài liệu. Mỗi tài liệu có tên, số văn bản, loại, mô tả, file kèm. Khi thêm/xoá hệ thống ghi DOCUMENT_ADDED / DOCUMENT_DELETED vào activity log." `
    -Users "PMO / PM của dự án / Chuyên viên QLDA." `
    -Steps @(
      "Mở tab ‘Tài liệu’ trong trang chi tiết dự án.",
      "Bấm ‘Thêm tài liệu’ để mở pop-up nhập thông tin.",
      "Chọn loại tài liệu, nhập tên, số văn bản, mô tả, đính kèm file. Bấm ‘Lưu’ hoặc ‘Cập nhật’.",
      "Để sửa: bấm icon bút chì trên dòng tài liệu. Để xoá: bấm icon thùng rác. Yêu cầu xác nhận trước khi xoá."
    ) `
    -UiNote "Tab hiển thị 4 section theo loại tài liệu. Mỗi section gồm tên loại + bảng các tài liệu (cột: tên, số văn bản, người tải, ngày tải, hành động). Pop-up Thêm/Sửa tài liệu có 5 trường + button Lưu." `
    -Fields @(
      @{field="Loại tài liệu"; control="Dropdown"; maxlen="-"; required="Có"; desc="CONTRACT (Hợp đồng) / PROJECT_DOCUMENT (Tài liệu dự án) / SUBMISSION (Tờ trình) / MEETING_MINUTES (Biên bản họp)."},
      @{field="Tên tài liệu"; control="Input"; maxlen="255"; required="Có"; desc="Tiêu đề hiển thị."},
      @{field="Số văn bản"; control="Input"; maxlen="80"; required="Không"; desc="Số / ký hiệu văn bản — ví dụ HD-2026/001."},
      @{field="Mô tả"; control="Textarea"; maxlen="500"; required="Không"; desc="Mô tả nội dung tài liệu."},
      @{field="File tài liệu"; control="File input"; maxlen="-"; required="Có (khi thêm mới)"; desc="Chấp nhận .pdf/.doc/.docx/.xls/.xlsx/.ppt/.pptx/ảnh. Lưu tên file (v3.3: upload thật vào Supabase Storage)."},
      @{field="Thêm tài liệu"; control="Button"; maxlen="-"; required="-"; desc="Mở pop-up thêm tài liệu."},
      @{field="Sửa"; control="Icon button"; maxlen="-"; required="-"; desc="Mở pop-up với dữ liệu của tài liệu được chọn."},
      @{field="Xoá"; control="Icon button"; maxlen="-"; required="-"; desc="Yêu cầu xác nhận. Gọi DELETE /api/projects/:id/documents/:docId."},
      @{field="Lưu / Cập nhật"; control="Button"; maxlen="-"; required="-"; desc="Gọi POST hoặc PATCH /api/projects/:id/documents. Ghi DOCUMENT_ADDED hoặc DOCUMENT_UPDATED log (BE hiện gộp 1 action; sẽ tách trong v3.4)."}
    )

  # IV.4 Quản lý rủi ro
  AddFunctionBlock `
    -Title "4. Quản lý rủi ro (Tab Rủi ro)" `
    -Description "Quản lý danh sách rủi ro của dự án. Mỗi rủi ro có: tiêu đề, nguyên nhân, mô tả, mức độ (LOW/MEDIUM/HIGH), trạng thái (OPEN / WATCHING / MITIGATED), người phụ trách xử lý, biện pháp giảm nhẹ, hạn xử lý, kết quả xử lý, tiến độ xử lý (%), kế hoạch tiếp theo, ghi chú. Hỗ trợ thêm / sửa / xoá. Khi cập nhật task có thay đổi kế hoạch, hệ thống có thể gợi ý tạo rủi ro liên quan." `
    -Users "PMO / PM của dự án / Chuyên viên QLDA." `
    -Steps @(
      "Mở tab ‘Quản lý rủi ro’.",
      "Bấm ‘Thêm rủi ro’ để mở pop-up rich risk modal.",
      "Cập nhật / xoá rủi ro hiện có bằng icon ở cuối mỗi dòng.",
      "Bấm ‘Lưu’ trong pop-up để hoàn tất."
    ) `
    -UiNote "Tab có KPI mini (số rủi ro mở / mức cao / đã giảm nhẹ), bảng rủi ro với pill mức độ và trạng thái, nút Thêm/Sửa/Xoá. Pop-up rich risk modal hiển thị toàn bộ trường ở dạng form 2 cột." `
    -Fields @(
      @{field="Tiêu đề"; control="Input"; maxlen="255"; required="Có"; desc="Tên ngắn của rủi ro."},
      @{field="Nguyên nhân"; control="Textarea"; maxlen="1000"; required="Không"; desc="Nguyên nhân phát sinh rủi ro."},
      @{field="Mô tả"; control="Textarea"; maxlen="2000"; required="Không"; desc="Mô tả chi tiết rủi ro."},
      @{field="Mức độ"; control="Dropdown"; maxlen="-"; required="Có"; desc="LOW / MEDIUM / HIGH. Lấy từ catalogs.riskLevels. Mặc định MEDIUM."},
      @{field="Trạng thái"; control="Dropdown"; maxlen="-"; required="Có"; desc="OPEN (đang mở) / WATCHING (đang theo dõi) / MITIGATED (đã giảm nhẹ)."},
      @{field="Người phụ trách"; control="Dropdown"; maxlen="-"; required="Có"; desc="Người chịu trách nhiệm xử lý. Mặc định = adminId của dự án."},
      @{field="Biện pháp giảm nhẹ"; control="Textarea"; maxlen="2000"; required="Không"; desc="Phương án xử lý đã / sẽ thực hiện."},
      @{field="Hạn xử lý"; control="Date input"; maxlen="-"; required="Không"; desc="Định dạng yyyy-MM-dd."},
      @{field="Kết quả xử lý"; control="Textarea"; maxlen="2000"; required="Không"; desc="Kết quả thực hiện biện pháp."},
      @{field="Tiến độ xử lý (%)"; control="Number"; maxlen="3"; required="Không"; desc="0–100. Hiển thị progress bar."},
      @{field="Kế hoạch tiếp theo"; control="Textarea"; maxlen="2000"; required="Không"; desc="Bước tiếp theo dự kiến."},
      @{field="Ghi chú"; control="Textarea"; maxlen="2000"; required="Không"; desc=""},
      @{field="Thêm rủi ro"; control="Button"; maxlen="-"; required="-"; desc="Mở pop-up tạo rủi ro mới."},
      @{field="Sửa"; control="Icon button"; maxlen="-"; required="-"; desc="Mở pop-up với dữ liệu rủi ro."},
      @{field="Xoá"; control="Icon button"; maxlen="-"; required="-"; desc="Yêu cầu xác nhận. Gọi DELETE /api/projects/:id/risks/:riskId."},
      @{field="Lưu"; control="Button"; maxlen="-"; required="-"; desc="Gọi POST /api/projects/:id/risks (upsert). Ghi RISK_CREATED/UPDATED log."}
    )

  # IV.5 Kế hoạch
  AddFunctionBlock `
    -Title "5. Quản lý kế hoạch triển khai (Tab Kế hoạch)" `
    -Description "Lập và quản lý kế hoạch dự án dưới dạng cây 2 cấp: task tổng quan và subtask. Tab Kế hoạch hiển thị Gantt overview, danh sách task tổng, focus chi tiết của task được chọn (gồm Gantt các subtask, danh sách worklog và raise). Cho phép Tạo / Sửa / Xoá task & subtask, Khai báo tiến độ và Raise chậm tiến độ. Khi xoá task cha, subtask + worklog + delay-raise + assignee cascade xoá theo cơ chế ON DELETE CASCADE." `
    -Users "PMO / PM của dự án / Chuyên viên QLDA (CRUD kế hoạch). Thành viên TTK chỉ được khai báo tiến độ / raise đối với task được giao." `
    -Steps @(
      "Mở tab ‘Kế hoạch’.",
      "Bấm ‘+ Thêm task tổng quan’ để tạo task root, hoặc bấm vào task hiện có để focus.",
      "Trong khối Focus: bấm ‘+ Thêm subtask’, ‘Sửa task’, ‘Xoá task’ hoặc ‘Khai báo tiến độ’.",
      "Pop-up Plan modal cho phép nhập đầy đủ các trường task/subtask."
    ) `
    -UiNote "Tab Plan chia 3 khối: (1) Gantt overview (task root); (2) Khối Focus (task được chọn) — Gantt subtask + bảng worklog + bảng raise; (3) Các nút thao tác và Pop-up Plan modal. Pop-up Khai báo tiến độ hiển thị: ngày, giờ công, % hoàn thành mới, nội dung kết quả. Áp dụng cảnh báo deadline (xem C.0.6): mỗi task chưa hoàn thành có endDate quá hạn (< hôm nay) sẽ hiển thị viền đỏ trên thanh Gantt + gạch đỏ bên trái dòng + badge ‘⚠ Quá hạn’; các task sắp đến hạn (≤ 4 ngày) hiển thị viền vàng + badge ‘◐ Sắp đến hạn’. Tooltip khi hover thanh Gantt bổ sung trạng thái deadline. Cuối tab có bảng Activity log lọc theo Plan." `
    -Fields @(
      @{field="Task tổng quan / Subtask — Tên"; control="Input"; maxlen="255"; required="Có"; desc="Tên công việc."},
      @{field="Task cha"; control="Dropdown"; maxlen="-"; required="Khi tạo subtask"; desc="Chọn task root. Bắt buộc khi workType = SUBTASK."},
      @{field="Loại công việc (workType)"; control="Dropdown"; maxlen="-"; required="Có"; desc="PRELIMINARY (Sơ bộ) / SUBTASK / MILESTONE."},
      @{field="Người thực hiện (assignees)"; control="Multi-select"; maxlen="-"; required="Có"; desc="Có thể chọn nhiều User là thành viên TTK của dự án. assigneeIds + assigneeId (legacy primary)."},
      @{field="Trạng thái"; control="Dropdown"; maxlen="-"; required="Có"; desc="NOT_STARTED / IN_PROGRESS / BLOCKED / DONE / NEEDS_REPLAN. Tự động chuyển khi khai báo tiến độ."},
      @{field="Baseline Start / End"; control="Date input"; maxlen="-"; required="Có"; desc="Mốc kế hoạch ban đầu (không sửa sau khi đã duyệt)."},
      @{field="Start / End thực tế"; control="Date input"; maxlen="-"; required="Có"; desc="Mốc thực tế (có thể điều chỉnh khi re-plan)."},
      @{field="Tiến độ ban đầu (%)"; control="Number"; maxlen="3"; required="Không"; desc="0–100. Mặc định 0."},
      @{field="Giờ công kế hoạch (plannedHours)"; control="Number"; maxlen="8"; required="Có"; desc="Tổng giờ công dự kiến của task. Với dự án Có HĐ/Khả thi: validation tổng giờ task & phân bổ ≤ KTQT cap."},
      @{field="Deliverable"; control="Input"; maxlen="500"; required="Không"; desc="Sản phẩm bàn giao của task."},
      @{field="Ghi chú phụ thuộc"; control="Input"; maxlen="500"; required="Không"; desc="Phụ thuộc, điều kiện tiên quyết."},
      @{field="Phân bổ theo tháng (monthAllocations)"; control="Grid"; maxlen="-"; required="Không"; desc="Mảng {month, hours} — chi tiết giờ công theo tháng cho task này."},
      @{field="+ Thêm task tổng quan"; control="Button"; maxlen="-"; required="-"; desc="Mở Plan modal với parentId=null. Quyền: canManageProjectPlan."},
      @{field="+ Thêm subtask"; control="Button"; maxlen="-"; required="-"; desc="Mở Plan modal với parentId=focusedTask.id."},
      @{field="Sửa task"; control="Button"; maxlen="-"; required="-"; desc="Mở Plan modal có dữ liệu task hiện tại."},
      @{field="Xoá task"; control="Button"; maxlen="-"; required="-"; desc="Mở ConfirmDialog danger (xem C.0.2) với tên task + cảnh báo cascade. Sau xác nhận: loading overlay → DELETE /api/projects/:id/plan-items/:taskId → toast thành công. BE cascade xoá subtask + assignee + worklog + delay-raise."},
      @{field="Badge ‘⚠ Quá hạn’ / ‘◐ Sắp đến hạn’"; control="Badge inline"; maxlen="-"; required="-"; desc="Hiển thị tự động cạnh tên task trong cột bên trái Gantt cho task chưa hoàn thành: overdue khi endDate < hôm nay, due-soon khi endDate ≤ 4 ngày tới. Task DONE không bị flag."},
      @{field="Khai báo tiến độ"; control="Button"; maxlen="-"; required="-"; desc="Mở Execution modal — cho phép thành viên ghi worklog."},
      @{field="Raise chậm tiến độ"; control="Button"; maxlen="-"; required="-"; desc="Mở pop-up nhập lý do + ảnh hưởng. Gọi POST /api/projects/:id/delay-raises. Task chuyển trạng thái NEEDS_REPLAN; replanRequested=true."}
    )

  # IV.6 Khai báo tiến độ (chi tiết)
  AddFunctionBlock `
    -Title "6. Khai báo tiến độ / giờ công (Worklog)" `
    -Description "Cho phép thành viên TTK khai báo giờ công đã thực hiện cho một task được giao. Hệ thống tự cộng dồn actualHours và auto-update trạng thái task: NOT_STARTED → IN_PROGRESS khi có worklog đầu tiên; ≥100% → DONE. Tổng giờ công của task tổng = tổng giờ công của tất cả subtask. Recalculate progress sau khi lưu worklog. Đồng bộ worklog sang a.Office (v3.7 integrations)." `
    -Users "Thành viên TTK của task. PM/PMO có thể khai báo thay khi cần (canEditProjectInfo)." `
    -Steps @(
      "Mở tab Kế hoạch → chọn task được giao.",
      "Bấm ‘Khai báo tiến độ’.",
      "Điền ngày, giờ công, % hoàn thành mới, nội dung kết quả.",
      "Bấm ‘Lưu’."
    ) `
    -UiNote "Pop-up Execution modal: 4 trường + nút Lưu. Hiển thị ngay bảng worklog đã có bên dưới task được chọn." `
    -Fields @(
      @{field="Ngày"; control="Date input"; maxlen="-"; required="Có"; desc="Ngày thực hiện (yyyy-MM-dd). Mặc định = hôm nay. Không cho chọn ngày trong tương lai."},
      @{field="Giờ công"; control="Number"; maxlen="6"; required="Có"; desc="Số giờ làm trong ngày. Range 0.25–24. Chấp nhận lẻ 0.25."},
      @{field="% hoàn thành mới"; control="Number"; maxlen="3"; required="Có"; desc="Cập nhật progress mới của task. 0–100."},
      @{field="Nội dung kết quả"; control="Textarea"; maxlen="1000"; required="Có"; desc="Mô tả công việc đã làm, output."},
      @{field="Lưu"; control="Button"; maxlen="-"; required="-"; desc="Gọi POST /api/projects/:id/worklogs. BE: bump task.actualHours, auto-status, ghi WORKLOG_ADDED log, recalculate project progress, trả snapshot."}
    )

  # IV.7 Phân bổ giờ công theo tháng
  AddFunctionBlock `
    -Title "7. Phân bổ giờ công theo tháng (Tab Workload)" `
    -Description "PM/PMO/QLDA phân bổ giờ công dự kiến cho từng thành viên TTK theo từng tháng trong vòng đời dự án. Các tháng được sinh tự động từ startDate / endDate. Bảng dạng grid: hàng = thành viên, cột = tháng. Hệ thống so sánh tổng phân bổ với KTQT cap (với dự án Có HĐ / Khả thi) — không cho lưu nếu vượt. So sánh với capacity (User.monthlyCapacity) để cảnh báo overload." `
    -Users "PMO / PM của dự án / Chuyên viên QLDA. Tab chỉ hiển thị khi canManageProject = true." `
    -Steps @(
      "Mở tab ‘Phân bổ giờ công’.",
      "Cập nhật ô giờ công của thành viên trong tháng tương ứng.",
      "Bấm ‘Lưu phân bổ’ để gửi API. Nếu vượt KTQT cap, message lỗi hiện ngay."
    ) `
    -UiNote "Grid scroll ngang khi nhiều tháng. Header dòng = thành viên (avatar + tên); header cột = tháng (MM/yyyy). Mỗi ô là number input. Footer hiển thị tổng cột (tổng giờ tháng), tổng hàng (tổng giờ thành viên)." `
    -Fields @(
      @{field="Thành viên (memberId)"; control="Label"; maxlen="-"; required="-"; desc="Lấy từ project.personnelInfo.aitsMembers + members rows."},
      @{field="Cột tháng"; control="Label"; maxlen="-"; required="-"; desc="Sinh từ getAllMonths(project.startDate, project.endDate)."},
      @{field="Ô giờ công"; control="Number"; maxlen="6"; required="Không"; desc="0–500. Mặc định 0. Cảnh báo nếu > User.monthlyCapacity của tháng. Validation tổng ≤ KTQT cap (nếu Loại = Có HĐ/Khả thi)."},
      @{field="Tổng giờ tháng"; control="Label"; maxlen="-"; required="-"; desc="Tổng theo cột. Hiển thị thay đổi realtime."},
      @{field="Tổng giờ thành viên"; control="Label"; maxlen="-"; required="-"; desc="Tổng theo hàng."},
      @{field="Lưu phân bổ"; control="Button"; maxlen="-"; required="-"; desc="Gọi POST /api/projects/:id/allocations (upsert theo {project, member, month}). Ghi ALLOCATION_UPDATED (v3.4)."}
    )

  # IV.8 Activity log
  AddFunctionBlock `
    -Title "8. Lịch sử thao tác (Activity Log)" `
    -Description "Hệ thống ghi lại các thao tác quan trọng trên dự án. Mỗi log lưu diff field-level (changes[]). Sau quyết định BA 13/05/2026, bảng Activity log hiển thị tại CUỐI CỦA MỖI TAB của trang chi tiết dự án (Thông tin khởi tạo, Overview, Nhân sự, Tài liệu, Quản lý rủi ro, Kế hoạch, Phân bổ giờ công) — không chỉ một số tab như phiên bản trước. Mỗi tab lọc theo nhóm action phù hợp (xem bảng tại mục C.0.5 Quy ước UX chung)." `
    -Users "Mọi người dùng có quyền xem dự án — đọc-only." `
    -Steps @(
      "Mở tab tương ứng. Khối lịch sử nằm ở cuối tab.",
      "Bấm vào entry để mở rộng và xem chi tiết các trường đã thay đổi."
    ) `
    -UiNote "Bảng dạng panel ‘Nhật ký thay đổi’. Mỗi entry: avatar người thực hiện, tên hành động (ACTION_LABELS — tiếng Việt), entityName, thời gian (dd/MM/yyyy HH:mm), danh sách trường thay đổi (oldValue → newValue). Sắp xếp mới nhất trước. Read-only (không có thao tác Sửa/Xoá log)." `
    -Fields @(
      @{field="Người thực hiện"; control="Label"; maxlen="-"; required="-"; desc="User.name + avatar."},
      @{field="Hành động"; control="Pill"; maxlen="-"; required="-"; desc="Mã action và nhãn tiếng Việt; tone theo ACTION_TONES."},
      @{field="Đối tượng"; control="Label"; maxlen="-"; required="-"; desc="entityName (tên project / task / document)."},
      @{field="Thời gian"; control="Label"; maxlen="-"; required="-"; desc="ISO timestamp; hiển thị dd/MM/yyyy HH:mm."},
      @{field="Diff thay đổi"; control="List"; maxlen="-"; required="-"; desc="changes[] = {field, oldValue, newValue}. Hiển thị: tên trường, giá trị cũ → giá trị mới."}
    )
  PageBreak
}

# ─── C.V  Module Đóng / Tạm đóng dự án ───
function AddModuleClose {
  AddHeading2 "V. Module Đóng / Tạm đóng dự án"
  AddParagraph -Text "Quy trình đóng dự án gồm 3 vai trò người duyệt: Chuyên viên QLDA gửi yêu cầu → KSV phê duyệt → TCHC xác nhận đóng. TCHC chính là vai trò ADMIN_HC (quyết định BA 14/05/2026: bỏ functional title TCNL — TCHC không cần overlay vì nó vốn là vai trò gốc). Tạm đóng là cơ chế nhanh — PM/QLDA tự thực hiện và mở lại bất cứ lúc nào. Khi dự án đã CLOSED, tất cả mutation API bị deny (middleware checkProjectNotClosed)." | Out-Null
  AddBlank

  AddFunctionBlock `
    -Title "1. Tạm đóng dự án" `
    -Description "Chuyển trạng thái dự án từ ACTIVE → PAUSED. Dùng trong tình huống tạm hoãn triển khai. Ghi pausedAt = thời điểm thực hiện. Người dùng vẫn xem được dự án; các thao tác chỉnh sửa vẫn cho phép nhưng UI hiển thị badge ‘Tạm đóng’." `
    -Users "PMO / PM của dự án / Chuyên viên QLDA (canManageProjectPlan = true)." `
    -Steps @(
      "Mở trang chi tiết dự án.",
      "Trong panel CloseFlow (trên cùng), bấm ‘Tạm đóng’.",
      "Xác nhận ở dialog popup."
    ) `
    -UiNote "Panel CloseFlow nằm trên đầu trang chi tiết, render theo status: ACTIVE → 2 nút ‘Tạm đóng’ + ‘Yêu cầu đóng TTK’; PAUSED → nút ‘Mở lại dự án’; CLOSED → badge khoá." `
    -Fields @(
      @{field="Nút ‘Tạm đóng’"; control="Button"; maxlen="-"; required="-"; desc="Gọi POST /api/projects/:id/pause. BE cập nhật status = PAUSED, ghi pausedAt = now, log activity."},
      @{field="Pill trạng thái"; control="Status pill"; maxlen="-"; required="-"; desc="Hiển thị ‘Đang triển khai’ khi ACTIVE."}
    )

  AddFunctionBlock `
    -Title "2. Mở lại dự án" `
    -Description "Chuyển trạng thái dự án từ PAUSED → ACTIVE. Xoá pausedAt." `
    -Users "PMO / PM của dự án." `
    -Steps @(
      "Trong panel CloseFlow, bấm ‘Mở lại dự án’.",
      "Hệ thống gọi POST /api/projects/:id/resume."
    ) `
    -UiNote "Panel CloseFlow hiển thị eyebrow ‘Trạng thái dự án’, heading ‘Tạm đóng’, paragraph thời điểm tạm dừng, nút ‘Mở lại dự án’." `
    -Fields @(
      @{field="Nút ‘Mở lại dự án’"; control="Button"; maxlen="-"; required="-"; desc="Gọi POST /api/projects/:id/resume. BE: status = ACTIVE, pausedAt = null, ghi PROJECT_REOPENED log."}
    )

  AddFunctionBlock `
    -Title "3. Gửi yêu cầu đóng dự án" `
    -Description "Chuyên viên QLDA / PM gửi yêu cầu đóng dự án tới KSV. Yêu cầu kèm ghi chú tuỳ chọn. Hệ thống tạo bản ghi project_close_requests (state: ksvDecision = PENDING, tchcDecision = PENDING). Gửi thông báo in-app + email tới tất cả người dùng có FunctionalTitle = KSV thuộc đơn vị DBCL." `
    -Users "PMO / PM của dự án / Chuyên viên QLDA (canManageProjectPlan = true)." `
    -Steps @(
      "Trong panel CloseFlow, bấm ‘Yêu cầu đóng TTK’.",
      "Khối form ‘Ghi chú gửi KSV’ hiện ra — nhập ghi chú nếu cần.",
      "Bấm ‘Gửi yêu cầu đóng’."
    ) `
    -UiNote "Form inline trong panel CloseFlow: textarea ghi chú + 2 nút ‘Gửi yêu cầu đóng’ và ‘Huỷ’." `
    -Fields @(
      @{field="Ghi chú gửi KSV"; control="Textarea"; maxlen="2000"; required="Không"; desc="Ghi chú đính kèm yêu cầu — ví dụ: ‘Đã hoàn tất bàn giao và biên bản nghiệm thu’."},
      @{field="Gửi yêu cầu đóng"; control="Button"; maxlen="-"; required="-"; desc="Gọi POST /api/projects/:id/close-requests. BE: tạo close request, gửi thông báo cho KSV."},
      @{field="Huỷ"; control="Button"; maxlen="-"; required="-"; desc="Đóng form mà không gửi."}
    )

  AddFunctionBlock `
    -Title "4. KSV phê duyệt / từ chối yêu cầu đóng" `
    -Description "Người dùng có FunctionalTitle = KSV mở Hộp thư duyệt, xem các yêu cầu đóng dự án đang chờ và phê duyệt hoặc từ chối. Khi phê duyệt, yêu cầu chuyển tiếp tới TCHC (ADMIN_HC). Khi từ chối, gửi thông báo lại Chuyên viên QLDA kèm lý do." `
    -Users "Người dùng có functionalTitle = KSV (thuộc DBCL)." `
    -Steps @(
      "Đăng nhập tài khoản KSV (demo: dev.duy / 123456).",
      "Mở menu ‘Hộp thư duyệt’.",
      "Xem danh sách yêu cầu chờ duyệt — bấm ‘Phê duyệt’ hoặc nhập lý do và bấm ‘Từ chối’."
    ) `
    -UiNote "Trang InboxPage hiển thị danh sách card. Mỗi card: mã + tên dự án (link), người gửi, ngày gửi, ghi chú, pill ‘KSV: PENDING/APPROVED/REJECTED’, pill ‘TCHC: …’. Khi cần quyết định, hiển thị input lý do + 2 nút." `
    -Fields @(
      @{field="Lý do từ chối"; control="Input"; maxlen="500"; required="Khi từ chối"; desc="Lý do KSV từ chối yêu cầu."},
      @{field="Phê duyệt"; control="Button"; maxlen="-"; required="-"; desc="Gọi PATCH /api/projects/:projectId/close-requests/:id/ksv với decision=APPROVED. BE chuyển ksvDecision=APPROVED, tchcDecision=PENDING, thông báo cho TCHC (= toàn bộ user role ADMIN_HC)."},
      @{field="Từ chối"; control="Button"; maxlen="-"; required="-"; desc="Tương tự với decision=REJECTED + ksvRejectReason. Yêu cầu Chuyên viên QLDA gửi lại."}
    )

  AddFunctionBlock `
    -Title "5. TCHC xác nhận đóng TTK (BA 14/05/2026 — thay cho TCNL)" `
    -Description "Người dùng có role = ADMIN_HC (TCHC) nhận inbox khi KSV đã phê duyệt. TCHC xác nhận đóng → dự án chuyển CLOSED, ghi closedAt, không cho phép chỉnh sửa. Nếu TCHC từ chối, dự án giữ ACTIVE, yêu cầu Chuyên viên QLDA gửi lại. Quyết định BA 14/05/2026: TCHC chính là ADMIN_HC — không còn functional title TCNL riêng biệt." `
    -Users "Tất cả người dùng có role = ADMIN_HC (demo: hc.hoa / 123456)." `
    -Steps @(
      "Đăng nhập tài khoản TCHC (hc.hoa).",
      "Mở menu ‘Hộp thư duyệt’ ở Sidebar.",
      "Xem các yêu cầu đã KSV duyệt — bấm ‘Phê duyệt’ hoặc nhập lý do và bấm ‘Từ chối’."
    ) `
    -UiNote "Tương tự inbox KSV; chỉ hiển thị các yêu cầu có ksvDecision=APPROVED & tchcDecision=PENDING." `
    -Fields @(
      @{field="Lý do từ chối"; control="Input"; maxlen="500"; required="Khi từ chối"; desc="Lý do TCHC từ chối; gửi lại Chuyên viên QLDA."},
      @{field="Phê duyệt"; control="Button"; maxlen="-"; required="-"; desc="Gọi PATCH /api/projects/:projectId/close-requests/:id/tchc với APPROVED. BE: project.status = CLOSED, closedAt = now, ghi PROJECT_CLOSED + CLOSE_CONFIRMED_TCHC log."},
      @{field="Từ chối"; control="Button"; maxlen="-"; required="-"; desc="decision=REJECTED + tchcRejectReason; ghi CLOSE_REJECTED_TCHC log."}
    )

  AddFunctionBlock `
    -Title "6. Hộp thư duyệt (Inbox)" `
    -Description "Menu Hộp thư duyệt chỉ hiển thị với người dùng có FunctionalTitle = KSV HOẶC role = ADMIN_HC (TCHC). Lọc theo phạm vi vai trò: KSV thấy yêu cầu chờ KSV; TCHC thấy yêu cầu đã KSV duyệt; người gửi (Chuyên viên QLDA / PM) thấy yêu cầu của chính mình." `
    -Users "KSV (functional title) hoặc TCHC (role ADMIN_HC) hoặc người gửi yêu cầu." `
    -Steps @(
      "Đăng nhập tài khoản KSV hoặc TCHC.",
      "Bấm menu ‘Hộp thư duyệt’ ở Sidebar."
    ) `
    -UiNote "InboxPage — heading ‘Hộp thư duyệt’ + bảng card. Mỗi card có 2 pill quyết định: ‘KSV: …’ và ‘TCHC: …’. Khi user cần quyết định, hiển thị input lý do + 2 nút." `
    -Fields @(
      @{field="Bộ lọc theo vai trò"; control="Auto"; maxlen="-"; required="-"; desc="KSV → chỉ thấy yêu cầu PENDING-KSV. TCHC (role = ADMIN_HC) → chỉ thấy KSV-APPROVED & TCHC-PENDING. Người dùng khác → chỉ thấy yêu cầu của chính mình (theo dõi)."},
      @{field="Card yêu cầu"; control="Card"; maxlen="-"; required="-"; desc="Mỗi card có mã/tên dự án (link), người gửi, ngày, ghi chú, 2 pill quyết định (KSV / TCHC), lý do từ chối (nếu có), input + 2 nút (khi user cần quyết định)."},
      @{field="Empty state"; control="Panel"; maxlen="-"; required="-"; desc="‘Tất cả yêu cầu đã được xử lý.’ khi không có yêu cầu chờ."}
    )
  PageBreak
}

# ─── C.VI  Module Việc của tôi ───
function AddModuleMemberWorkspace {
  AddHeading2 "VI. Module Việc của tôi (Member workspace)"

  AddFunctionBlock `
    -Title "1. Danh sách công việc & raise của thành viên" `
    -Description "Trang dành riêng cho Thành viên TTK. Hiển thị 2 khối: (a) Công việc của tôi — danh sách task được giao trên toàn bộ dự án, dạng bảng; (b) Raise đã gửi — danh sách delay-raise do người dùng tạo. Trang chỉ hiển thị khi role = DELIVERY_MEMBER. Khi role khác, hiển thị empty state nhắc dùng tài khoản dev.*." `
    -Users "DELIVERY_MEMBER." `
    -Steps @(
      "Đăng nhập với tài khoản DELIVERY_MEMBER.",
      "Bấm menu ‘Việc của tôi’ ở Sidebar."
    ) `
    -UiNote "MemberWorkspacePage — 2 section panel. Bảng task có cột: Dự án, Công việc, Trạng thái, Planned/Actual, Timeline. Bảng raise: tên, lý do, status pill, ngày." `
    -Fields @(
      @{field="Dự án"; control="Label"; maxlen="-"; required="-"; desc="Mã dự án (project.code)."},
      @{field="Công việc"; control="Label"; maxlen="-"; required="-"; desc="Tên task + deliverable."},
      @{field="Trạng thái"; control="Pill"; maxlen="-"; required="-"; desc="catalogs.taskStatuses label."},
      @{field="Planned / Actual"; control="Label"; maxlen="-"; required="-"; desc="plannedHours / actualHours."},
      @{field="Timeline"; control="Label"; maxlen="-"; required="-"; desc="startDate – endDate."},
      @{field="Raise — Lý do"; control="Label"; maxlen="-"; required="-"; desc=""},
      @{field="Raise — Status"; control="Pill"; maxlen="-"; required="-"; desc="OPEN / ACKNOWLEDGED / REPLANNED."}
    )
  PageBreak
}

# ─── C.VII  Module Biểu đồ Gantt ───
function AddModuleGantt {
  AddHeading2 "VII. Module Biểu đồ Gantt"

  AddFunctionBlock `
    -Title "1. Hiển thị biểu đồ Gantt theo dự án hoặc thành viên" `
    -Description "Cung cấp hai chế độ xem: (a) Theo dự án — Gantt tất cả task của 1 dự án; (b) Theo thành viên — Gantt tất cả task mà 1 thành viên TTK được giao trên toàn hệ thống. Gantt được vẽ tay (không dùng thư viện ngoài). Mỗi thanh có timeline baseline + actual và progress fill." `
    -Users "Mọi người dùng (dữ liệu filter theo phạm vi xem)." `
    -Steps @(
      "Bấm menu ‘Biểu đồ Gantt’ ở Sidebar.",
      "Chọn chế độ ‘Theo dự án’ hoặc ‘Theo thành viên’.",
      "Chọn dự án hoặc thành viên cần xem."
    ) `
    -UiNote "GanttPage có filter row (2 dropdown) + khu vẽ Gantt. Thanh task có depth chỉ thị task root hoặc subtask." `
    -Fields @(
      @{field="Chế độ"; control="Dropdown"; maxlen="-"; required="Có"; desc="‘Theo dự án’ hoặc ‘Theo thành viên’."},
      @{field="Dự án"; control="Dropdown"; maxlen="-"; required="Khi mode=project"; desc="Liệt kê visibleProjects."},
      @{field="Thành viên"; control="Dropdown"; maxlen="-"; required="Khi mode=member"; desc="Liệt kê User có role=DELIVERY_MEMBER. Riêng DELIVERY_MEMBER chỉ thấy chính mình."},
      @{field="Thanh task"; control="Bar"; maxlen="-"; required="-"; desc="Timeline baseline (mờ) + thực tế (đậm) + thanh progress fill. Tooltip hiển thị: tên, ngày, % hoàn thành, trạng thái."},
      @{field="Trục thời gian"; control="Axis"; maxlen="-"; required="-"; desc="Theo tháng. Quét theo timeline của tập task hiển thị."}
    )
  PageBreak
}

# ─── C.VIII  Module Báo cáo ───
function AddModuleReports {
  AddHeading2 "VIII. Module Báo cáo"

  AddFunctionBlock `
    -Title "1. Hiệu quả dự án" `
    -Description "Bảng báo cáo hiệu quả của tất cả dự án trong phạm vi xem. Hiển thị: mã, tên, % tiến độ, số task chậm/chặn, số rủi ro mở, giờ công thực tế. Phiên bản v3.5 sẽ thêm chức năng xuất ra .xlsx (mẫu khách hàng cung cấp)." `
    -Users "Mọi người dùng (dữ liệu filter theo phạm vi xem)." `
    -Steps @(
      "Bấm menu ‘Báo cáo’ ở Sidebar.",
      "Xem bảng ‘Hiệu quả dự án’."
    ) `
    -UiNote "ReportsPage — 3 section: (1) Hiệu quả dự án (panel + bảng); (2) Lệch giờ tháng; (3) Raise chậm tiến độ. Header có nút xuất Excel (v3.5)." `
    -Fields @(
      @{field="Mã"; control="Label"; maxlen="-"; required="-"; desc="project.code"},
      @{field="Dự án"; control="Label"; maxlen="-"; required="-"; desc="project.name"},
      @{field="Tiến độ (%)"; control="Label"; maxlen="-"; required="-"; desc="project.progress"},
      @{field="Task trễ/chặn"; control="Label"; maxlen="-"; required="-"; desc="Số task có status BLOCKED hoặc NEEDS_REPLAN hoặc endDate < today & progress < 100"},
      @{field="Rủi ro mở"; control="Label"; maxlen="-"; required="-"; desc="Số rủi ro có status ≠ MITIGATED"},
      @{field="Actual hours"; control="Label"; maxlen="-"; required="-"; desc="Tổng worklog hours"},
      @{field="Xuất Excel"; control="Button"; maxlen="-"; required="-"; desc="(v3.5) Gọi POST /api/reports/weekly hoặc /detailed-plan, tải file .xlsx theo template."}
    )

  AddFunctionBlock `
    -Title "2. Lệch giờ tháng" `
    -Description "Bảng so sánh capacity với planned của từng thành viên trong tháng đang xét. Highlight thành viên có |delta| > 10h. Tháng mặc định = tháng có dữ liệu mới nhất." `
    -Users "Mọi người dùng." `
    -Steps @(
      "Vào trang Báo cáo.",
      "Xem section ‘Lệch giờ tháng’."
    ) `
    -UiNote "Bảng 4 cột: Thành viên, Capacity, Planned, Lệch (delta). Header có nhãn tháng (formatMonthLabel)." `
    -Fields @(
      @{field="Thành viên"; control="Label"; maxlen="-"; required="-"; desc="User.name"},
      @{field="Capacity (h)"; control="Label"; maxlen="-"; required="-"; desc="User.monthlyCapacity"},
      @{field="Planned (h)"; control="Label"; maxlen="-"; required="-"; desc="Tổng phân bổ tháng của thành viên trong tất cả dự án"},
      @{field="Lệch (h)"; control="Label"; maxlen="-"; required="-"; desc="Planned − Capacity (âm = under-allocated, dương = overload)"}
    )

  AddFunctionBlock `
    -Title "3. Raise chậm tiến độ" `
    -Description "Danh sách 20 raise mới nhất trong phạm vi xem. Hiển thị: người gửi, lý do, thời điểm." `
    -Users "Mọi người dùng." `
    -Steps @(
      "Vào trang Báo cáo.",
      "Xem section ‘Raise chậm tiến độ’."
    ) `
    -UiNote "Stack list — mỗi dòng: avatar + tên requester, lý do, timestamp." `
    -Fields @(
      @{field="Người gửi"; control="Label"; maxlen="-"; required="-"; desc=""},
      @{field="Lý do"; control="Label"; maxlen="-"; required="-"; desc=""},
      @{field="Thời điểm"; control="Label"; maxlen="-"; required="-"; desc="formatDateTime"}
    )
  PageBreak
}

# ─── C.IX  Module Thông báo ───
function AddModuleNotifications {
  AddHeading2 "IX. Module Thông báo"

  AddFunctionBlock `
    -Title "1. Cảnh báo task gần đến hạn" `
    -Description "Hệ thống tự động phát hiện task có endDate trong vòng 7 ngày kể từ hôm nay và progress < 100%. Mỗi cảnh báo hiển thị thông tin task tổng quan, PM, người phụ trách, hạn, % hoàn thành, các subtask chưa xong. Badge số trên menu Sidebar và Bell icon. Trong tương lai (v3.2), thêm trigger gửi email khi gần đến hạn và quá hạn." `
    -Users "Mọi người dùng. Phạm vi task = task trong dự án mà người dùng có quyền xem." `
    -Steps @(
      "Bấm menu ‘Thông báo’ hoặc icon chuông trên Topbar.",
      "Xem danh sách cảnh báo, bấm ‘Xem dự án’ để mở chi tiết."
    ) `
    -UiNote "NotificationCenterPage — 4 KPI card (Đang mở, Khẩn, Đến hạn hôm nay, Subtask chưa xong) + danh sách card cảnh báo. Mỗi card hiển thị task root + danh sách subtask chưa xong." `
    -Fields @(
      @{field="Card ‘Đang mở’"; control="Stat card"; maxlen="-"; required="-"; desc="Tổng số task có cảnh báo."},
      @{field="Card ‘Khẩn’"; control="Stat card"; maxlen="-"; required="-"; desc="Số task có daysRemaining ≤ 3."},
      @{field="Card ‘Đến hạn hôm nay’"; control="Stat card"; maxlen="-"; required="-"; desc="Số task có daysRemaining = 0."},
      @{field="Card ‘Subtask chưa xong’"; control="Stat card"; maxlen="-"; required="-"; desc="Tổng số subtask chưa hoàn thành trong các task được cảnh báo."},
      @{field="Card cảnh báo"; control="Card"; maxlen="-"; required="-"; desc="Header: tên task, mã + tên dự án, pill ‘Còn N ngày’ / ‘Đến hạn hôm nay’. Meta: PM, người phụ trách, hạn, % tiến độ. Body: lý do cảnh báo + danh sách subtask chưa xong + nút Xem dự án."},
      @{field="Xem dự án"; control="Link"; maxlen="-"; required="-"; desc="Điều hướng /projects/:id."},
      @{field="Empty state"; control="Panel"; maxlen="-"; required="-"; desc="‘Không có cảnh báo. Tất cả task trong 7 ngày tới đều đúng tiến độ.’"}
    )
  PageBreak
}

# ─── C.X  Module Quản lý danh mục Khách hàng / Đối tác ───
function AddModuleExternalCatalog {
  AddHeading2 "X. Module Quản lý danh mục Khách hàng / Đối tác"

  AddFunctionBlock `
    -Title "1. Quản trị danh mục nhân sự Khách hàng / Đối tác" `
    -Description "Danh mục nhân sự ngoài (Khách hàng / Đối tác) dùng chung giữa các dự án. Cho phép PMO CRUD; Chuyên viên QLDA chỉ đọc và chọn từ danh mục khi thêm vào dự án. Mỗi bản ghi có: loại (Khách hàng/Đối tác), họ tên, mã NV, chức danh, đơn vị, email, SĐT, audit (người tạo, ngày tạo, người sửa cuối, ngày sửa cuối)." `
    -Users "PMO (CRUD) / Chuyên viên QLDA (đọc)." `
    -Steps @(
      "Vào trang Cài đặt (Admin Catalog).",
      "Cuộn xuống panel ‘Nhân sự Khách hàng / Đối tác’.",
      "Lọc theo loại nếu muốn, bấm ‘Thêm nhân sự KH/Đối tác’ để mở form thêm; bấm icon bút chì để sửa; icon thùng rác để xoá (yêu cầu confirm)."
    ) `
    -UiNote "Panel có dropdown lọc (Tất cả / Khách hàng / Đối tác), nút thêm, form inline (khi đang edit), danh sách dạng stack list — mỗi dòng: tên + loại (pill), chức danh / đơn vị, email / SĐT, 2 icon button (Sửa, Gỡ)." `
    -Fields @(
      @{field="Bộ lọc loại"; control="Dropdown"; maxlen="-"; required="-"; desc="ALL / CUSTOMER / PARTNER."},
      @{field="Loại"; control="Dropdown"; maxlen="-"; required="Có"; desc="CUSTOMER (Khách hàng) / PARTNER (Đối tác)."},
      @{field="Họ và tên"; control="Input"; maxlen="120"; required="Có"; desc="Bắt buộc — validate non-empty."},
      @{field="Mã nhân viên"; control="Input"; maxlen="40"; required="Không"; desc=""},
      @{field="Chức danh"; control="Input"; maxlen="120"; required="Không"; desc=""},
      @{field="Đơn vị"; control="Input"; maxlen="120"; required="Không"; desc=""},
      @{field="Email"; control="Email input"; maxlen="120"; required="Không"; desc="Format email; FE không strict-validate, BE có thể validate."},
      @{field="Số điện thoại"; control="Input"; maxlen="20"; required="Không"; desc=""},
      @{field="Tạo mới"; control="Button"; maxlen="-"; required="-"; desc="Gọi POST /api/external-personnel."},
      @{field="Lưu thay đổi"; control="Button"; maxlen="-"; required="-"; desc="Gọi PATCH /api/external-personnel/:id."},
      @{field="Huỷ"; control="Button"; maxlen="-"; required="-"; desc="Đóng form draft."},
      @{field="Gỡ khỏi danh mục"; control="Icon button"; maxlen="-"; required="-"; desc="Yêu cầu window.confirm. Gọi DELETE /api/external-personnel/:id."}
    )
  PageBreak
}

# ───────────────────────────── 7. SECTION D — API/SERVICE LIST ─────────────────────────────
function AddSectionD {
  AddHeading1 "D. DANH SÁCH API/SERVICE THAM GIA HỆ THỐNG"
  AddParagraph -Text "Tất cả mutation đi qua Express backend (port 4000). Frontend gắn JWT Bearer của Supabase Auth vào header Authorization. Mỗi mutation thành công trả về full snapshot (replace state pattern)." | Out-Null
  AddBlank

  $rows = @(
    @("Method", "Path", "Quyền", "Tác dụng"),
    @("GET", "/health", "none", "Health-check"),
    @("POST", "/auth/login", "none", "Đăng nhập (qua Supabase Auth)"),
    @("POST", "/auth/logout", "auth", "Đăng xuất"),
    @("GET", "/api/snapshot", "requireAuth", "Lấy snapshot toàn hệ thống, filter theo phạm vi xem"),
    @("POST", "/api/projects", "ADMIN_HC (TCHC) only", "Tạo dự án + member rows + activity log. BA 12/05/2026: chỉ ADMIN_HC, đã loại bỏ PMO/PM khỏi danh sách quyền tạo."),
    @("PATCH", "/api/projects/:id", "canEditProjectInfo", "Cập nhật thông tin dự án; ghi diff log"),
    @("POST", "/api/projects/:id/documents", "canEditProjectInfo", "Thêm tài liệu"),
    @("PATCH", "/api/projects/:id/documents/:docId", "canEditProjectInfo", "Sửa tài liệu"),
    @("DELETE", "/api/projects/:id/documents/:docId", "canEditProjectInfo", "Xoá tài liệu"),
    @("POST", "/api/projects/:id/plan-items", "canManageProjectPlan", "Tạo task / subtask"),
    @("PATCH", "/api/projects/:id/plan-items/:taskId", "canManageProjectPlan", "Cập nhật task"),
    @("DELETE", "/api/projects/:id/plan-items/:taskId", "canManageProjectPlan", "Xoá task (cascade)"),
    @("POST", "/api/projects/:id/worklogs", "member self / PM/PMO", "Khai báo worklog; bump actualHours; auto-status"),
    @("POST", "/api/projects/:id/delay-raises", "requester self", "Raise chậm tiến độ"),
    @("POST", "/api/projects/:id/allocations", "canManageProjectPlan", "Upsert phân bổ giờ công tháng"),
    @("POST", "/api/projects/:id/risks", "canManageProjectPlan", "Upsert rủi ro"),
    @("DELETE", "/api/projects/:id/risks/:riskId", "canManageProjectPlan", "Xoá rủi ro (v3.3)"),
    @("POST", "/api/projects/:id/pause", "canManageProjectPlan", "Tạm đóng dự án"),
    @("POST", "/api/projects/:id/resume", "PMO / admin", "Mở lại dự án"),
    @("POST", "/api/projects/:id/close-requests", "canManageProjectPlan", "Gửi yêu cầu đóng (tạo close request)"),
    @("PATCH", "/api/projects/:id/close-requests/:reqId/ksv", "KSV", "KSV phê duyệt / từ chối"),
    @("PATCH", "/api/projects/:id/close-requests/:reqId/tchc", "TCHC (ADMIN_HC role)", "TCHC xác nhận / từ chối (BA 14/05/2026 — endpoint /tcnl đã đổi thành /tchc; isTCHC = (user.role === 'ADMIN_HC'))"),
    @("GET", "/api/close-inbox", "KSV / TCHC", "Lấy danh sách yêu cầu đóng theo vai trò (KSV xem PENDING-KSV; TCHC xem KSV-APPROVED & TCHC-PENDING)"),
    @("PATCH", "/api/catalogs/:groupKey", "PMO", "Cập nhật danh mục LOV"),
    @("GET", "/api/external-personnel", "PMO/QLDA", "Liệt kê KH/Đối tác"),
    @("POST", "/api/external-personnel", "PMO", "Thêm KH/Đối tác"),
    @("PATCH", "/api/external-personnel/:id", "PMO", "Sửa KH/Đối tác"),
    @("DELETE", "/api/external-personnel/:id", "PMO", "Xoá KH/Đối tác"),
    @("POST", "/api/admin/reset-demo-data", "PMO", "Wipe + reseed dữ liệu demo")
  )
  $tbl = NewTable -Rows $rows.Count -Cols 4 -Headers $rows[0] -WidthPct @(10, 38, 22, 30)
  for ($i = 1; $i -lt $rows.Count; $i++) {
    FillRow -Table $tbl -Row ($i + 1) -Values $rows[$i]
  }
  $tbl.Range.Font.Size = 10
  AddBlank
  PageBreak
}

# ───────────────────────────── 8. SECTION E — INTEGRATION ─────────────────────────────
function AddSectionE {
  AddHeading1 "E. KỊCH BẢN TÍCH HỢP HỆ THỐNG"
  AddParagraph -Text "Hệ thống QLDA tích hợp với các hệ thống nguồn dữ liệu của AITS / VNA group. Kịch bản tích hợp được lên kế hoạch ở phase v3.7 (adapter mocks trước, real endpoints sau)." | Out-Null

  AddHeading2 "I. Tích hợp HRM (Human Resource Management)"
  AddBullets @(
    "Mục tiêu: đồng bộ danh sách nhân viên AITS sang bảng profiles. Trường: id (employeeCode), name, email, title, unit, phone.",
    "Tần suất: scheduled job hàng ngày, lúc 02:00.",
    "Phương thức: Pull qua REST API của HRM. Adapter module: backend/src/integrations/hrm.ts (v3.7).",
    "Xử lý conflict: ưu tiên dữ liệu HRM cho các trường thuộc tính cố định (name, email, title, unit). Không ghi đè trường isActive/role nội bộ."
  )
  AddHeading2 "II. Tích hợp KTQT (Kế toán Quản trị)"
  AddBullets @(
    "Mục tiêu: lấy giờ công trần (cap) cho từng dự án Có HĐ / Khả thi.",
    "Tần suất: pull khi mở Tab ‘Phân bổ giờ công’ hoặc khi save allocation.",
    "Validation: tổng giờ công phân bổ + tổng giờ task ≤ KTQT cap. Vượt → BE trả 422 với thông báo ‘Vượt KTQT cap’; FE highlight ô vượt."
  )
  AddHeading2 "III. Tích hợp a.Office"
  AddBullets @(
    "Mục tiêu: 2 chiều. (a) Push worklog QLDA sang a.Office sau khi khai báo. (b) Pull kế hoạch cá nhân (DBHĐ và khác) từ a.Office vào module Nguồn lực kế hoạch cá nhân.",
    "Tần suất: push event-based (sau worklog insert); pull scheduled hàng ngày.",
    "Note: a.Office là nguồn chuẩn cho kế hoạch cá nhân — QLDA hiển thị read-only, không cho sửa."
  )
  AddHeading2 "IV. Xác thực AD/LDAP"
  AddBullets @(
    "Hiện tại sử dụng Supabase Auth (email/password). v3.6 đã bị OUT OF SCOPE.",
    "Trong dài hạn: bind LDAP server, mapping (LDAP cn) → Supabase user. Login audit log (IP, time, status) đã được tích hợp vào v3.2."
  )
  AddHeading2 "V. Realtime sync"
  AddBullets @(
    "Frontend subscribe Supabase Realtime (postgres_changes) trên 11 bảng QLDA.",
    "Mỗi event insert/update/delete → FE refresh /api/snapshot.",
    "Đảm bảo cross-tab consistency giữa nhiều tab/người dùng."
  )
  PageBreak
}

# ───────────────────────────── 9. SECTION F — NON-FUNCTIONAL ─────────────────────────────
function AddSectionF {
  AddHeading1 "F. ĐẶC TẢ YÊU CẦU PHI CHỨC NĂNG"

  AddHeading2 "I. Quy định chung về giao diện"
  AddBullets @(
    "Ngôn ngữ: Tiếng Việt (nhãn UI). Các giá trị enum lưu code tiếng Anh, mapping nhãn tiếng Việt qua catalogs.",
    "Font chữ: Hệ thống font UI (Inter/Roboto/sans-serif). Font tài liệu xuất ra: Times New Roman.",
    "Khung màu: AITS Library design tokens (primary teal #0f766e, warning amber, danger crimson).",
    "Bố cục: Sidebar trái cố định, Topbar trên, nội dung scroll. Responsive: chưa cam kết mobile, ưu tiên desktop ≥ 1280px.",
    "Tất cả nút primary phải có icon + nhãn rõ ràng; nút destructive phải confirm.",
    "Empty state: hiển thị heading + paragraph mô tả, không để bảng/khu vực trống không."
  )

  AddHeading2 "II. Quy định về tính toàn vẹn dữ liệu"
  AddBullets @(
    "Tất cả mutation đi qua REST API; FE không write trực tiếp vào DB (RLS chặn).",
    "Mỗi mutation trả về full snapshot — đảm bảo state replace, không có partial update.",
    "Cascade delete được thực thi ở DB layer (ON DELETE CASCADE) cho project_documents, plan_items (parent), worklogs, delay_raises, plan_item_assignees, monthly_allocations, project_risks, activity_logs.",
    "Tiến độ dự án (project.progress) là computed — không cho set trực tiếp; recalculateProjectProgress chạy trong cùng transaction với save/delete plan-item và add worklog.",
    "Validation phía BE bắt buộc với mọi field bắt buộc; FE validate thêm để UX nhanh.",
    "Activity log diff-based — chỉ ghi trường thay đổi."
  )

  AddHeading2 "III. Quy định về tính dễ sử dụng"
  AddBullets @(
    "Người dùng nội bộ — không cần training >1 buổi (theo BRD V).",
    "Tooltip + helper text trên các trường có quy tắc đặc biệt.",
    "Thông báo lỗi rõ ràng, định vị tại trường lỗi.",
    "Auto-save draft cho các form dài (Overview/Personnel) — TBD."
  )

  AddHeading2 "IV. Yêu cầu về hiệu năng"
  AddBullets @(
    "100 concurrent users (BRD VIII).",
    "Tổng 300 người dùng nội bộ VNA.",
    "/api/snapshot trả về < 2s với 100 dự án và 5000 plan items.",
    "Realtime event → UI refresh < 1s."
  )

  AddHeading2 "V. Yêu cầu phi chức năng khác"
  AddBullets @(
    "An ninh: chuẩn ngành hàng không. Ghi log thao tác (IP, thời gian, trạng thái đăng nhập). Xác thực AD/LDAP (v3.6 — out of scope, dùng Supabase Auth).",
    "SLA: 24/7, ≥ 99% uptime.",
    "Backup / phục hồi: Downtime ≤ 12 giờ.",
    "Môi trường: mạng LAN nội bộ VNA.",
    "Vận hành: helpdesk@aits.vn; Service desk AITS.",
    "Tài liệu: tài liệu sử dụng + tài liệu kỹ thuật."
  )
  PageBreak
}

# ───────────────────────────── 10. SECTION G — APPENDIX ─────────────────────────────
function AddSectionG {
  AddHeading1 "G. PHỤ LỤC"

  AddHeading2 "I. Mapping enum giá trị"
  AddParagraph -Text "Bảng dưới đây liệt kê các enum giá trị quan trọng và nhãn tiếng Việt tương ứng. Toàn bộ giá trị này được lưu trong catalogs và có thể chỉnh sửa qua trang Admin Catalog (trừ projectStatuses và healthStatuses — READ-ONLY system values)." | Out-Null

  $enums = @(
    @{ enum="ProjectStatus"; values="ACTIVE / PAUSED / CLOSED"; labels="Đang triển khai / Tạm đóng / Đã đóng" }
    @{ enum="HealthStatus"; values="STABLE / NEEDS_REVIEW / AT_RISK"; labels="Ổn định / Cần xem xét / Có rủi ro" }
    @{ enum="ProjectType"; values="PRELIMINARY / FEASIBILITY / CONTRACT / INTERNAL"; labels="Tiền khả thi / Khả thi / Có HĐ / Nội bộ" }
    @{ enum="ApprovalStatus (đã loại bỏ — BA 12/05/2026)"; values="—"; labels="Trường approvalInfo đã được drop khỏi schema; dự án có hiệu lực ngay khi TCHC tạo." }
    @{ enum="TtkMode"; values="CHUYEN_TRACH / KIEM_NHIEM"; labels="Chuyên trách / Kiêm nhiệm" }
    @{ enum="DeploymentMode"; values="HD_PLHD / TK_THD / NOI_BO"; labels="HĐ/PLHĐ / TK THD / Nội bộ" }
    @{ enum="PlanTaskStatus"; values="NOT_STARTED / IN_PROGRESS / BLOCKED / DONE / NEEDS_REPLAN"; labels="Chưa bắt đầu / Đang thực hiện / Bị chặn / Hoàn thành / Cần re-plan" }
    @{ enum="WorkType"; values="PRELIMINARY / SUBTASK / MILESTONE"; labels="Sơ bộ / Subtask / Milestone" }
    @{ enum="RiskLevel"; values="LOW / MEDIUM / HIGH"; labels="Thấp / Trung bình / Cao" }
    @{ enum="RiskStatus"; values="OPEN / WATCHING / MITIGATED"; labels="Đang mở / Đang theo dõi / Đã giảm nhẹ" }
    @{ enum="DelayRaiseStatus"; values="OPEN / ACKNOWLEDGED / REPLANNED"; labels="Đã gửi / Đã ghi nhận / Đã re-plan" }
    @{ enum="UserRole"; values="PMO / ADMIN_HC / PM / DELIVERY_MEMBER"; labels="Phòng QLDA / Hành chính / PM / Thành viên TTK" }
    @{ enum="FunctionalTitle (BA 14/05/2026)"; values="NORMAL / KSV"; labels="Bình thường / Kiểm soát viên — TCNL đã bị loại bỏ; người duyệt stage-2 chuyển sang TCHC = role ADMIN_HC, không cần overlay." }
    @{ enum="DocumentCategory"; values="CONTRACT / PROJECT_DOCUMENT / SUBMISSION / MEETING_MINUTES"; labels="Hợp đồng / Tài liệu dự án / Tờ trình / Biên bản họp" }
    @{ enum="ActivityLogAction (16)"; values="PROJECT_INFO_UPDATED, PERSONNEL_UPDATED, DOCUMENT_ADDED, DOCUMENT_DELETED, TASK_CREATED, SUBTASK_CREATED, TASK_UPDATED, SUBTASK_UPDATED, TASK_DELETED, SUBTASK_DELETED, TASK_HOURS_CHANGED, SUBTASK_HOURS_CHANGED, WORKLOG_ADDED, PROJECT_CLOSED, PROJECT_REOPENED"; labels="Mỗi action có nhãn tiếng Việt — xem ACTION_LABELS." }
  )
  $tbl = NewTable -Rows ($enums.Count + 1) -Cols 3 -Headers @("Enum", "Giá trị code", "Nhãn tiếng Việt") -WidthPct @(20, 40, 40)
  for ($i = 0; $i -lt $enums.Count; $i++) {
    FillRow -Table $tbl -Row ($i + 2) -Values @($enums[$i].enum, $enums[$i].values, $enums[$i].labels)
  }
  $tbl.Range.Font.Size = 9.5
  AddBlank

  AddHeading2 "II. Schema dữ liệu (12 bảng chính)"
  AddBullets @(
    "profiles — PK = Supabase auth.users.id (uuid), normalized role.",
    "projects — core fields + 4 JSONB (approval/basis/financial/personnel).",
    "project_members — M2M project ↔ profile + isCoordinator + roleInProject.",
    "project_documents — title + URL (v3.3 sẽ thay bằng storagePath).",
    "monthly_allocations — composite key (project, member, month).",
    "project_risks — risk register full v3.3 fields.",
    "plan_items — task + parentId; monthAllocations JSONB.",
    "plan_item_assignees — M2M plan_items ↔ profiles.",
    "worklogs — entries; auto bump actualHours.",
    "delay_raises — re-plan requests.",
    "activity_logs — audit trail; 16 action enum; diff JSONB.",
    "catalog_groups (v3.0) → catalog_options (v3.4 per-row audit)."
  )

  AddHeading2 "III. Lộ trình phát hành"
  AddBullets @(
    "v3.0 — Monorepo restructure (DONE)",
    "v3.1 — Foundation: ProjectStatus 3-value, HealthStatus rename, gate create cho ADMIN_HC, User.functionalTitle, project.projectType / psUserId / closedAt / pausedAt, project_close_requests table, project_members.isCoordinator/role/responsibility",
    "v3.2 — Close workflow + auto-health, scheduled job tính health + tạo notification, FE close-flow UI",
    "v3.3 — Risks expansion (full fields), External personnel catalog, document upload (Supabase Storage)",
    "v3.4 — Catalogs redesign (per-row audit), activity actions split, history events bổ sung",
    "v3.5 — Reports xuất .xlsx (ExcelJS), endpoints /reports/weekly và /reports/detailed-plan",
    "v3.6 — AD/LDAP (OUT OF SCOPE)",
    "v3.7 — Integrations HRM / KTQT / a.Office (adapter mocks → real endpoints)",
    "v3.8 — Permission groups (deferred)"
  )
}

# ───────────────────────────── MAIN ─────────────────────────────
Write-Host "Building FSD document..."
AddCoverPage
AddChangeLog
AddApprovalPage
AddTOC
AddSectionA
AddSectionB
AddUXConventions
AddModuleAdmin
AddModuleDashboard
AddModuleInit
AddModuleExecution
AddModuleClose
AddModuleMemberWorkspace
AddModuleGantt
AddModuleReports
AddModuleNotifications
AddModuleExternalCatalog
AddSectionD
AddSectionE
AddSectionF
AddSectionG

# Update TOC
try { $doc.TablesOfContents.Item(1).Update() } catch { }

# Save
$wdFormatDocumentDefault = 16
$doc.SaveAs2($OutputPath, $wdFormatDocumentDefault)
Write-Host "Saved to: $OutputPath"

$doc.Close()
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($selection) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
[GC]::Collect() | Out-Null
[GC]::WaitForPendingFinalizers() | Out-Null
Write-Host "Done."
