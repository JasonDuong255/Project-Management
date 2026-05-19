import type { DocumentAttachmentInput } from '../types'

export function readDocumentAttachment(file: File): Promise<DocumentAttachmentInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const [, contentBase64 = ''] = result.split(',', 2)
      resolve({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        contentBase64,
      })
    }
    reader.onerror = () => reject(reader.error ?? new Error('Cannot read selected file'))
    reader.readAsDataURL(file)
  })
}
