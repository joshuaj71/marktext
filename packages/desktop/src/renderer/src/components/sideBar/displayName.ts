// The extensions "Hide the extension of Markdown files" drops. Plain-text
// files (.txt) open in the editor as well but keep theirs, so a notes.txt is
// never mistaken for a notes.md beside it.
const MARKDOWN_EXTENSION = /\.(md|markdown|mdown|mkdn|mkd|mdwn|mdtxt|mdtext|mdx)$/i

/** A file's name as the sidebar lists it. */
export const sideBarFileName = (name: string, hideMarkdownExtension: boolean): string => {
  if (!hideMarkdownExtension) return name
  // A name that is nothing but the extension (".md") stays as it is.
  return name.replace(MARKDOWN_EXTENSION, '') || name
}
