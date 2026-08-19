/* Slim re-export of the docstream surface the demo uses — avoids pulling the
   playground entry, whose @agent-wasm/core peer isn't needed for docs rendering. */
export { GitbookStreamdown } from '../../src/streamdown';
export { DocsRenderer, MarkdownContent } from '../../src/docs/DocsRenderer';
