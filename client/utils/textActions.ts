// Utility functions for text filtering and meta-instruction handling

/**
 * Removes <think>...</think> blocks from text.
 */
export function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Removes any HTML tags from text (for safety/display).
 */
export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, '').trim();
}

/**
 * Checks if a suggestion is already present in the document/editor.
 */
export function isDuplicateInEditor(suggestion: string, doc: string): boolean {
  return doc.includes(suggestion);
}
