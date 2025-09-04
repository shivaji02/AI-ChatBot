// AI generation and streaming utilities
import { fetchAI } from '../clientCalls';
import { prepareAIRequest, AIRequest } from './aiPrompts';
import { formatAISuggestion, cleanAndFormatText, formatStreamingText } from './textActions';

/**
 * Stream handler callback type.
 */
export type StreamHandler = (chunk: string, isComplete?: boolean) => void;

/**
 * Error handler callback type.
 */
export type ErrorHandler = (error: Error) => void;

/**
 * Generates AI response for chat messages.
 */
export async function generateChatResponse(
  message: string,
  model: string,
  documentContext: string,
  onStream: StreamHandler,
  onError?: ErrorHandler
): Promise<void> {
  try {
    const request: AIRequest = {
      message,
      model,
      doc: documentContext
    };

    await fetchAI({
      ...request,
      onStream: (chunk: string) => {
        const formattedChunk = formatStreamingText(chunk);
        onStream(formattedChunk, false);
      }
    });
    
    onStream('', true); // Signal completion
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Chat generation failed');
    if (onError) {
      onError(err);
    } else {
      throw err;
    }
  }
}

/**
 * Generates AI suggestions for text editing actions.
 */
export async function generateTextSuggestion(
  selection: string,
  action: string,
  model: string,
  documentContext?: string,
  onError?: ErrorHandler
): Promise<string> {
  try {
    const request: AIRequest = {
      selection,
      action,
      model,
      doc: documentContext
    };

    let fullResponse = '';
    await fetchAI({
      ...request,
      onStream: (chunk: string) => {
        fullResponse += chunk;
      }
    });

    return formatAISuggestion(fullResponse, action);
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Text suggestion generation failed');
    if (onError) {
      onError(err);
      return ''; // Return empty string when error handler is provided
    } else {
      throw err;
    }
  }
}

/**
 * Validates AI generation parameters.
 */
export function validateGenerationParams(params: {
  text?: string;
  selection?: string;
  action?: string;
  model?: string;
}): { isValid: boolean; error?: string } {
  const { text, selection, action, model } = params;
  
  if (!model || typeof model !== 'string' || model.trim().length === 0) {
    return { isValid: false, error: 'Valid model is required' };
  }
  
  if (selection && action) {
    if (typeof selection !== 'string' || selection.trim().length === 0) {
      return { isValid: false, error: 'Valid selection is required for text editing' };
    }
    if (typeof action !== 'string' || action.trim().length === 0) {
      return { isValid: false, error: 'Valid action is required for text editing' };
    }
  } else if (text) {
    if (typeof text !== 'string' || text.trim().length === 0) {
      return { isValid: false, error: 'Valid message is required for chat' };
    }
  } else {
    return { isValid: false, error: 'Either message or selection with action is required' };
  }
  
  return { isValid: true };
}

/**
 * Handles AI generation errors with user-friendly messages.
 */
export function handleAIError(error: Error): string {
  if (error.message.includes('fetch failed')) {
    return 'Unable to connect to AI service. Please check your connection.';
  }
  
  if (error.message.includes('aborted')) {
    return 'Request was cancelled.';
  }
  
  if (error.message.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  
  if (error.message.includes('403') || error.message.includes('Forbidden')) {
    return 'Access denied. Please check your API configuration.';
  }
  
  if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
    return 'AI service is temporarily unavailable. Please try again later.';
  }
  
  // Return sanitized error message
  const sanitized = error.message.replace(/<[^>]*>/g, '').trim();
  return sanitized.length > 0 ? sanitized : 'An unexpected error occurred.';
}

/**
 * Creates an abort controller for cancelling AI requests.
 */
export function createAIController(): {
  controller: AbortController;
  abort: () => void;
  signal: AbortSignal;
} {
  const controller = new AbortController();
  
  return {
    controller,
    abort: () => controller.abort(),
    signal: controller.signal
  };
}
