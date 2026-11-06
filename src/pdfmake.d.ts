// Minimal typing for the two pdfmake browser modules used by src/lib/guidePdf.ts (pdfmake ships no types).
declare module 'pdfmake/build/pdfmake' {
  const pdfMake: {
    addVirtualFileSystem(vfs: Record<string, string>): void
    addFonts(fonts: Record<string, Record<'normal' | 'bold' | 'italics' | 'bolditalics', string>>): void
    createPdf(definition: unknown): { getBlob(): Promise<Blob> }
  }
  export default pdfMake
}
