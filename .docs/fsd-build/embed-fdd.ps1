#requires -Version 5.1
# Open a copy of the FSD, append "H. BIỂU ĐỒ PHÂN RÃ CHỨC NĂNG" and embed the PNG diagram.
$ErrorActionPreference = 'Stop'

$srcDocx = "C:\Users\phucdm\Documents\QLDA\FSD_QLDA_v2.0.docx"
$dstDocx = "C:\Users\phucdm\Documents\QLDA\FSD_QLDA_v2.1.docx"
$pngPath = "C:\Users\phucdm\Documents\QLDA\FDD_QLDA.png"

# Copy first so we never write to the user's currently-open file.
Copy-Item -Path $srcDocx -Destination $dstDocx -Force

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $word.Documents.Open($dstDocx)

# Append a new heading at end of document.
$end = $doc.Content
$end.Collapse(0) # wdCollapseEnd
$end.InsertParagraphAfter()

$h = $doc.Paragraphs.Add()
$h.Range.Text = "H. BIỂU ĐỒ PHÂN RÃ CHỨC NĂNG"
$h.Range.Style = -2  # Heading 1
$h.Range.ParagraphFormat.Alignment = 0
$h.Range.Font.Bold = -1
$h.Range.Font.Size = 16
$h.Range.InsertParagraphAfter()

$p = $doc.Paragraphs.Add()
$p.Range.Text = "Sơ đồ phân rã chức năng dưới đây thể hiện đầy đủ phạm vi chức năng của Hệ thống QLDA. Mỗi node lá có định danh dạng <Số La Mã của module>.<Số thứ tự chức năng trong module> – tương ứng với số mục trong phần C của tài liệu này. Ví dụ: ‘IV.6 Khai báo tiến độ / giờ công (Worklog)’ là chức năng số 6 trong Mục C.IV Module Triển khai dự án."
$p.Range.Font.Name = "Times New Roman"
$p.Range.Font.Size = 11
$p.Range.Font.Bold = 0
$p.Range.ParagraphFormat.Alignment = 3  # justify
$p.Range.InsertParagraphAfter()

# Insert PNG
$picPar = $doc.Paragraphs.Add()
$picPar.Range.ParagraphFormat.Alignment = 1  # center
$pic = $doc.InlineShapes.AddPicture($pngPath, $false, $true, $picPar.Range)

# Scale to page width
$maxW = $doc.PageSetup.PageWidth - $doc.PageSetup.LeftMargin - $doc.PageSetup.RightMargin
if ($pic.Width -gt $maxW) {
  $pic.LockAspectRatio = -1
  $pic.Width = $maxW
}
$picPar.Range.InsertParagraphAfter()

# Caption
$cap = $doc.Paragraphs.Add()
$cap.Range.Text = "Hình H.1 — Biểu đồ phân rã chức năng Hệ thống QLDA"
$cap.Range.Font.Italic = -1
$cap.Range.Font.Size = 10.5
$cap.Range.ParagraphFormat.Alignment = 1  # center
$cap.Range.InsertParagraphAfter()

# Save & close
$doc.Save()
$doc.Close()
$word.Quit()

[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
[GC]::Collect() | Out-Null
[GC]::WaitForPendingFinalizers() | Out-Null

Write-Host "Saved: $dstDocx"
