'use client';
/* @internal: MessageScroller's context, for its items and for the Conversation messages that render as items inside
   one. Registry installs copy it with MessageScroller; it has no npm entry. */
import * as React from 'react';

export interface ScrollerContextValue {
  /** The open thread has committed once: items that mount after that are arriving (they rise in). */
  opened: React.RefObject<boolean>;
}
export const ScrollerContext = React.createContext<ScrollerContextValue | null>(null);

/** Whether an element is inside a MessageScroller (ConversationUserMessage / ConversationAssistantMessage render as items there). */
export function useInMessageScroller(): boolean {
  return React.useContext(ScrollerContext) !== null;
}
