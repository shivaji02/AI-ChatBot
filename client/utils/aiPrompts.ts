// AI prompt generation and processing utilities

/**
 * Builds action-specific prompts for text editing operations.
 */
export function buildActionPrompt(selection: string, action: string): string {
  const cleanSelection = selection.trim();
  
  switch (action) {
    case 'shorten':
      return `Rewrite the following text to be shorter while preserving meaning. Return only the revised text.\n\n${cleanSelection}`;
    
    case 'lengthen':
      return `Expand the following text with clear detail and smooth flow. Return only the revised text.\n\n${cleanSelection}`;
    
    case 'table':
      return `Convert the following into a simple Markdown table with headers when obvious. Return only the table.\n\n${cleanSelection}`;
    
    case 'grammar':
    default:
      return `Improve clarity and grammar. Return only the revised text.\n\n${cleanSelection}`;
  }
}

/**
 * Builds chat prompts with context.
 */
export function buildChatPrompt(message: string, documentContext?: string): string {
  if (!documentContext || documentContext.trim().length === 0) {
    return `User: ${message}\n\nPlease provide a helpful response.`;
  }
  
  return `User: ${message}\n\nDocument context:\n${documentContext}\n\nPlease provide a helpful response that takes the document context into account.`;
}

/**
 * Builds prompts for selection-based actions with context.
 */
export function buildSelectionPrompt(selection: string, action: string, documentContext?: string): string {
  const actionPrompt = buildActionPrompt(selection, action);
  
  if (!documentContext || documentContext.trim().length === 0) {
    return actionPrompt;
  }
  
  return `${actionPrompt}\n\nDocument context for reference:\n${documentContext}`;
}

/**
 * Validates and sanitizes user input for prompts.
 */
export function sanitizePromptInput(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, 10000); // Limit length
}

/**
 * Extracts and validates model selection.
 */
export function validateModel(model: string, availableModels: string[]): string {
  if (!model || typeof model !== 'string') {
    return availableModels[0] || 'llama3.2';
  }
  
  return availableModels.includes(model) ? model : availableModels[0] || 'llama3.2';
}

/**
 * Builds system prompts for different contexts.
 */
export function buildSystemPrompt(context: 'chat' | 'editor' | 'selection'): string {
  switch (context) {
    case 'chat':
      return 'You are a helpful AI assistant. Provide clear, concise, and accurate responses.';
    
    case 'editor':
      return 'You are an AI writing assistant. Help improve text by making it clearer, more engaging, and better structured.';
    
    case 'selection':
      return 'You are an AI text editor. Transform the given text according to the specified action while maintaining the original meaning and tone.';
    
    default:
      return 'You are a helpful AI assistant.';
  }
}

/**
 * Prepares request payload for AI API calls.
 */
export interface AIRequest {
  message?: string;
  selection?: string;
  action?: string;
  doc?: string;
  model: string;
}

export function prepareAIRequest(params: AIRequest): {
  model: string;
  prompt: string;
  stream: boolean;
} {
  const { message, selection, action, doc, model } = params;
  
  let prompt: string;
  
  if (selection && action) {
    // Selection-based editing
    prompt = buildSelectionPrompt(sanitizePromptInput(selection), action, doc);
  } else if (message) {
    // Chat-based interaction
    prompt = buildChatPrompt(sanitizePromptInput(message), doc);
  } else {
    throw new Error('Either message or selection with action must be provided');
  }
  
  return {
    model: model || 'llama3.2',
    prompt,
    stream: true
  };
}
