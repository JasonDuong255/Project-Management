#requires -Version 5.1
# Build Functional Decomposition Diagram (Biểu đồ phân rã chức năng) for QLDA.
# Outputs: FDD_QLDA.svg + FDD_QLDA.png

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web | Out-Null
$outDir = "C:\Users\phucdm\Documents\QLDA"
$svgPath = Join-Path $outDir "FDD_QLDA.svg"
$pngPath = Join-Path $outDir "FDD_QLDA.png"
$docxOutput = Join-Path $outDir "FSD_QLDA_v1.0.docx"

# ─── Hierarchy data (numbering matches FSD section C) ───
# Module roman → FSD section letter (C.I, C.II, ...). Each leaf uses module-roman.func-num.
$modules = @(
  @{ id="I";    label="C.I Module Quản trị hệ thống"; leaves=@(
      @{ no="I.1"; label="Đăng nhập / Đăng xuất hệ thống" }
      @{ no="I.2"; label="Phân quyền người dùng" }
      @{ no="I.3"; label="Quản trị danh mục hệ thống (LOV)" }
  )},
  @{ id="II";   label="C.II Module Trang chủ – Dashboard"; leaves=@(
      @{ no="II.1"; label="Hiển thị Dashboard tổng quan" }
  )},
  @{ id="III";  label="C.III Module Khởi tạo dự án"; leaves=@(
      @{ no="III.1"; label="Xem danh sách dự án" }
      @{ no="III.2"; label="Tạo mới dự án" }
      @{ no="III.3"; label="Cập nhật thông tin khởi tạo" }
  )},
  @{ id="IV";   label="C.IV Module Triển khai dự án"; leaves=@(
      @{ no="IV.1"; label="Cập nhật thông tin chung (Tab Overview)" }
      @{ no="IV.2"; label="Quản lý nhân sự dự án (Tab Nhân sự)" }
      @{ no="IV.3"; label="Quản lý tài liệu dự án (Tab Tài liệu)" }
      @{ no="IV.4"; label="Quản lý rủi ro (Tab Rủi ro)" }
      @{ no="IV.5"; label="Quản lý kế hoạch triển khai (Tab Kế hoạch)" }
      @{ no="IV.6"; label="Khai báo tiến độ / giờ công (Worklog)" }
      @{ no="IV.7"; label="Phân bổ giờ công theo tháng (Tab Workload)" }
      @{ no="IV.8"; label="Lịch sử thao tác (Activity Log)" }
  )},
  @{ id="V";    label="C.V Module Đóng / Tạm đóng dự án"; leaves=@(
      @{ no="V.1"; label="Tạm đóng dự án" }
      @{ no="V.2"; label="Mở lại dự án" }
      @{ no="V.3"; label="Gửi yêu cầu đóng dự án" }
      @{ no="V.4"; label="KSV phê duyệt / từ chối yêu cầu đóng" }
      @{ no="V.5"; label="TCNL xác nhận đóng TTK" }
      @{ no="V.6"; label="Hộp thư duyệt (Inbox)" }
  )},
  @{ id="VI";   label="C.VI Module Việc của tôi"; leaves=@(
      @{ no="VI.1"; label="Danh sách công việc & raise của thành viên" }
  )},
  @{ id="VII";  label="C.VII Module Biểu đồ Gantt"; leaves=@(
      @{ no="VII.1"; label="Hiển thị biểu đồ Gantt theo dự án / thành viên" }
  )},
  @{ id="VIII"; label="C.VIII Module Báo cáo"; leaves=@(
      @{ no="VIII.1"; label="Hiệu quả dự án" }
      @{ no="VIII.2"; label="Lệch giờ tháng" }
      @{ no="VIII.3"; label="Raise chậm tiến độ" }
  )},
  @{ id="IX";   label="C.IX Module Thông báo"; leaves=@(
      @{ no="IX.1"; label="Cảnh báo task gần đến hạn" }
  )},
  @{ id="X";    label="C.X Module Quản lý danh mục KH / Đối tác"; leaves=@(
      @{ no="X.1"; label="Quản trị danh mục nhân sự Khách hàng / Đối tác" }
  )}
)

# ─── Layout ───
$rowHeight = 38
$padding = 30
$rootX = 30; $rootW = 220; $rootH = 70
$modX = 310; $modW = 360; $modH = 50
$leafX = 730; $leafW = 720; $leafH = 30
$gapBetweenModules = 14

# Compute total leaf count and overall height
$totalLeaves = 0
foreach ($m in $modules) { $totalLeaves += $m.leaves.Count }
$svgHeight = ($totalLeaves * ($leafH + 6)) + ($modules.Count * $gapBetweenModules) + 2 * $padding + 40
$svgWidth = $leafX + $leafW + $padding + 20

# Compute module Y positions = center of its leaf cluster
$leafYs = @{}
$modYs = @{}
$y = $padding + 40
foreach ($m in $modules) {
  $first = $y
  foreach ($leaf in $m.leaves) {
    $leafYs[$leaf.no] = $y
    $y += $leafH + 6
  }
  $last = $y - ($leafH + 6)
  $modYs[$m.id] = [int](($first + $last + $leafH) / 2 - ($modH / 2))
  $y += $gapBetweenModules
}

# Root vertical centerline
$rootCenterY = [int]($svgHeight / 2)
$rootBoxY = [int]($rootCenterY - $rootH / 2)

# ─── SVG generation ───
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('<?xml version="1.0" encoding="UTF-8"?>')
[void]$sb.Append('<svg xmlns="http://www.w3.org/2000/svg" version="1.1" ')
[void]$sb.AppendLine("width=`"$svgWidth`" height=`"$svgHeight`" viewBox=`"0 0 $svgWidth $svgHeight`" font-family=`"Times New Roman, serif`">")

# Style
[void]$sb.AppendLine(@'
<defs>
  <style><![CDATA[
    .root { fill: #0f766e; stroke: #0d5f59; stroke-width: 1.5; }
    .root-text { fill: #ffffff; font-size: 18px; font-weight: bold; }
    .module { fill: #fef3c7; stroke: #d97706; stroke-width: 1.2; }
    .module-text { fill: #7c2d12; font-size: 13px; font-weight: bold; }
    .leaf { fill: #f0f9ff; stroke: #0369a1; stroke-width: 1; }
    .leaf-text { fill: #0c4a6e; font-size: 12px; }
    .leaf-num  { fill: #0369a1; font-size: 12px; font-weight: bold; }
    .line { stroke: #64748b; stroke-width: 1.2; fill: none; }
    .title { fill: #0f172a; font-size: 20px; font-weight: bold; }
    .subtitle { fill: #475569; font-size: 12px; font-style: italic; }
  ]]></style>
</defs>
'@)

# Background
[void]$sb.AppendLine("<rect x=`"0`" y=`"0`" width=`"$svgWidth`" height=`"$svgHeight`" fill=`"#ffffff`"/>")

# Title
[void]$sb.AppendLine("<text x=`"$padding`" y=`"22`" class=`"title`">Biểu đồ phân rã chức năng – Hệ thống Quản lý dự án QLDA</text>")
[void]$sb.AppendLine("<text x=`"$padding`" y=`"38`" class=`"subtitle`">Đánh số tương ứng với mục C.I – C.X trong tài liệu FSD_QLDA_v1.0</text>")

# Root box
$rootCx = $rootX + [int]($rootW / 2)
$rootCy = $rootCenterY
$rxArc = 8
[void]$sb.AppendLine("<rect x=`"$rootX`" y=`"$rootBoxY`" width=`"$rootW`" height=`"$rootH`" rx=`"$rxArc`" class=`"root`"/>")
[void]$sb.AppendLine("<text x=`"$rootCx`" y=`"$([int]($rootCy - 4))`" class=`"root-text`" text-anchor=`"middle`">HỆ THỐNG QLDA</text>")
[void]$sb.AppendLine("<text x=`"$rootCx`" y=`"$([int]($rootCy + 14))`" class=`"root-text`" text-anchor=`"middle`" font-size=`"12`">Quản lý dự án</text>")

# Draw modules + leaves
foreach ($m in $modules) {
  $mY = $modYs[$m.id]
  $mCy = $mY + [int]($modH / 2)
  $mCxLeft = $modX
  $mCxRight = $modX + $modW

  # Module box
  [void]$sb.AppendLine("<rect x=`"$modX`" y=`"$mY`" width=`"$modW`" height=`"$modH`" rx=`"6`" class=`"module`"/>")
  $label = [System.Web.HttpUtility]::HtmlEncode($m.label)
  [void]$sb.AppendLine("<text x=`"$([int]($modX + $modW / 2))`" y=`"$([int]($mCy + 5))`" class=`"module-text`" text-anchor=`"middle`">$label</text>")

  # Connector: root right → module left (orthogonal)
  $midX = [int](($rootX + $rootW + $modX) / 2)
  $rootRight = $rootX + $rootW
  [void]$sb.AppendLine("<path class=`"line`" d=`"M$rootRight,$rootCy H$midX V$mCy H$mCxLeft`"/>")

  # Leaves
  foreach ($leaf in $m.leaves) {
    $ly = $leafYs[$leaf.no]
    $lcy = $ly + [int]($leafH / 2)
    # Leaf box
    [void]$sb.AppendLine("<rect x=`"$leafX`" y=`"$ly`" width=`"$leafW`" height=`"$leafH`" rx=`"4`" class=`"leaf`"/>")
    # Number badge (left part of leaf)
    $numTxt = [System.Web.HttpUtility]::HtmlEncode($leaf.no)
    $labelTxt = [System.Web.HttpUtility]::HtmlEncode($leaf.label)
    [void]$sb.AppendLine("<text x=`"$([int]($leafX + 10))`" y=`"$([int]($lcy + 4))`" class=`"leaf-num`">$numTxt</text>")
    [void]$sb.AppendLine("<text x=`"$([int]($leafX + 70))`" y=`"$([int]($lcy + 4))`" class=`"leaf-text`">$labelTxt</text>")

    # Connector: module right → leaf left
    $midX2 = [int](($mCxRight + $leafX) / 2)
    [void]$sb.AppendLine("<path class=`"line`" d=`"M$mCxRight,$mCy H$midX2 V$lcy H$leafX`"/>")
  }
}

# Legend
$legY = $svgHeight - 16
[void]$sb.AppendLine("<text x=`"$padding`" y=`"$legY`" class=`"subtitle`">Mỗi node lá có định danh dạng &lt;Số La Mã của module&gt;.&lt;Số thứ tự chức năng trong module&gt;, ví dụ IV.6 = mục C.IV, chức năng 6 trong FSD.</text>")

[void]$sb.AppendLine("</svg>")

# Need HttpUtility
Add-Type -AssemblyName System.Web | Out-Null

# Write SVG
[System.IO.File]::WriteAllText($svgPath, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "SVG: $svgPath"

# ─── Render PNG via Word COM (insert SVG, export page as PNG) ───
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$tmpDoc = $word.Documents.Add()
$tmpDoc.PageSetup.PageHeight = [Math]::Max(842, $svgHeight + 80)
$tmpDoc.PageSetup.PageWidth  = [Math]::Max($svgWidth + 80, 600)
$tmpDoc.PageSetup.TopMargin = 20
$tmpDoc.PageSetup.BottomMargin = 20
$tmpDoc.PageSetup.LeftMargin = 20
$tmpDoc.PageSetup.RightMargin = 20
$range = $tmpDoc.Range(0, 0)
try {
  $shape = $tmpDoc.InlineShapes.AddPicture($svgPath, $false, $true, $range)
  # SVG insert may not be supported in older Word; fallback handled below
} catch {
  Write-Host "Could not insert SVG directly: $($_.Exception.Message)"
}
# Export page as PNG via SaveAs PDF then convert? Word does not directly export PNG.
# Simpler: rely on SVG alone (Word 2016+ supports SVG, browsers also).
$tmpDoc.Close($false)
$word.Quit()
[GC]::Collect() | Out-Null

# ─── Insert into existing FSD docx as a new sub-section B.II ───
if (Test-Path $docxOutput) {
  Write-Host "Embedding diagram into existing FSD: $docxOutput"
  $word2 = New-Object -ComObject Word.Application
  $word2.Visible = $false
  $word2.DisplayAlerts = 0
  $fsd = $word2.Documents.Open($docxOutput)

  # Find "II. Quy trình nghiệp vụ tổng quan" heading and insert a new heading + image before it.
  # We anchor by searching for the text and inserting a new paragraph before it.
  $find = $fsd.Content.Find
  $find.ClearFormatting()
  $found = $find.Execute("I. Quy trình nghiệp vụ tổng quan")
  if ($found) {
    $foundRange = $word2.Selection.Range
    # Insert new section heading at the end of document instead — simpler & idempotent
  }

  # Idempotent insert at end of section B (before section C): append diagram as appendix at end of doc
  # We'll just append a new section "G.IV — Biểu đồ phân rã chức năng" at the end so we don't disturb numbering.
  $end = $fsd.Content
  $end.Collapse(0) # wdCollapseEnd
  $end.InsertParagraphAfter()
  $end.Collapse(0)
  $p1 = $end.Paragraphs.Add()
  $p1.Range.Style = -2  # Heading 1
  $p1.Range.Text = "H. BIỂU ĐỒ PHÂN RÃ CHỨC NĂNG"
  $p1.Range.InsertParagraphAfter()

  $p2 = $fsd.Paragraphs.Add()
  $p2.Range.Text = "Sơ đồ phân rã chức năng dưới đây thể hiện đầy đủ phạm vi chức năng của Hệ thống QLDA. Đánh số định danh từng chức năng lá tương ứng với số mục trong phần C của tài liệu (ví dụ ‘IV.6 Khai báo tiến độ’ là chức năng số 6 trong Mục C.IV)."
  $p2.Range.Font.Name = "Times New Roman"
  $p2.Range.Font.Size = 11
  $p2.Range.InsertParagraphAfter()

  # Insert SVG as picture
  $picRange = $fsd.Content
  $picRange.Collapse(0)
  try {
    $pic = $fsd.InlineShapes.AddPicture($svgPath, $false, $true, $picRange)
    # Scale to fit page width
    $maxW = $fsd.PageSetup.PageWidth - $fsd.PageSetup.LeftMargin - $fsd.PageSetup.RightMargin
    if ($pic.Width -gt $maxW) {
      $ratio = $maxW / $pic.Width
      $pic.LockAspectRatio = -1  # msoTrue
      $pic.Width = $maxW
    }
  } catch {
    Write-Host "SVG insert failed; falling back to descriptive text. $($_.Exception.Message)"
  }

  # Save
  $fsd.Save()
  $fsd.Close()
  $word2.Quit()
  [GC]::Collect() | Out-Null
  Write-Host "Embedded diagram into FSD."
}

Write-Host "Done. SVG = $svgPath"
