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

/**
 * Cleans and formats AI-generated text for better readability.
 * Handles proper paragraph breaks, punctuation, and whitespace.
 */
export function cleanAndFormatText(text: string): string {
  // Keep this conservative to avoid removing legitimate spaces
  let cleaned = stripThinkBlocks(text);
  cleaned = cleaned
    // Remove extra spaces before punctuation
    .replace(/\s+([,.!?;:])/g, '$1')
    // Ensure a single space after punctuation when followed by a letter
    .replace(/([,.!?;:])(\S)/g, '$1 $2')
    // Collapse only runs of tabs/spaces to a single space (preserve single spaces)
    .replace(/[\t ]{2,}/g, ' ')
    // Limit multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned;
}

/**
 * Formats streaming text in real-time for chat display.
 * Less aggressive formatting to avoid interrupting the streaming flow.
 */
export function formatStreamingText(text: string): string {
  // Do not aggressively modify streaming text; just remove hidden think tags
  // so we preserve all spaces coming from the model.
  return stripThinkBlocks(text);
}

/**
 * Sanitizes text for safe display and editor insertion.
 */
export function sanitizeText(text: string): string {
  return stripHtmlTags(stripThinkBlocks(text)).trim();
}

/**
 * Removes markdown formatting (asterisks) from text.
 */
export function removeMarkdownFormatting(text: string): string {
  return text.replace(/\*\*/g, '').trim();
}

/**
 * Formats table text by cleaning up pipe separators.
 */
export function formatTableText(text: string): string {
  return text
    .split('\n')
    .map((line: string) => line.replace(/\s*\|\s*/g, ' | ').trim())
    .filter((line: string) => line.length > 0)
    .join('\n');
}

/**
 * Formats text for shortening/lengthening by removing line breaks.
 */
export function formatInlineText(text: string): string {
  return text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Formats code blocks with proper indentation.
 */
export function formatCodeBlocks(text: string): string {
  return text.replace(/```([\s\S]*?)```/g, (match, code) => {
    return '\n' + code.trim().split('\n').map((line: string) => '    ' + line).join('\n') + '\n';
  });
}

/**
 * Removes duplicate lines from text based on current content.
 */
export function removeDuplicateLines(newText: string, existingText: string): string {
  const newLines = newText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const existingLines = existingText.split('\n').map(l => l.trim());
  const uniqueLines = newLines.filter(line => !existingLines.includes(line));
  return uniqueLines.join('\n');
}

/**
 * Formats AI suggestion text for editor insertion.
 */
export function formatAISuggestion(text: string, action: string): string {
  let formatted = removeMarkdownFormatting(text);
  
  if (action === 'table') {
    formatted = formatTableText(formatted);
  }
  
  if (action === 'shorten' || action === 'lengthen') {
    formatted = formatInlineText(formatted);
  }
  
  // Format code blocks for readability
  formatted = formatCodeBlocks(formatted);
  
  return formatted;
}
