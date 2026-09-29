import * as React from 'react';
import {
  Composer,
  ComposerAttachments,
  ComposerBump,
  ComposerBumpHandle,
  ComposerCard,
  ComposerExpand,
  ComposerFooter,
  ComposerInput,
  ComposerOptions,
  ComposerOptionsOutlet,
  ComposerSelect,
  ComposerSend,
  ComposerSpacer,
  ComposerText,
  type ComposerAttachment,
  type ComposerProps,
} from './composer';
import { ModelPicker } from './model-picker';
import { WORKBENCH_MODELS, WORKBENCH_PROVIDERS } from './models';
import { Icon } from '../../lib/icon';

/* ══ WorkbenchComposer — the Workbench's default Composer composition ══
   Card (attachments, editor, expand, footer: model / effort / access pills, send) over a detached checkout
   strip. Everything here is public parts; copy it to build your own. */

export const WORKBENCH_EFFORTS = [
  { id: 'xhigh', label: 'Extra High' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
];
export const WORKBENCH_ACCESS = [
  { id: 'full', label: 'Full access', description: 'Read, write and run commands' },
  { id: 'read', label: 'Read only', description: 'Browse files, no edits' },
  { id: 'ask', label: 'Ask first', description: 'Confirm every change' },
];

export interface WorkbenchComposerProps extends Omit<ComposerProps, 'children'> {
  placeholder?: string;
  autoFocus?: boolean;
  /** Show the model / effort / access pills (default true). */
  options?: boolean;
  /** Show the checkout strip under the card (default true). */
  checkout?: boolean;
  /** Extra parts (e.g. a top bump). */
  children?: React.ReactNode;
}

export function WorkbenchComposer({
  placeholder,
  autoFocus,
  options = true,
  checkout = true,
  children,
  ...props
}: WorkbenchComposerProps) {
  return (
    <Composer {...props}>
      {children}
      <ComposerCard>
        <ComposerExpand />
        <ComposerAttachments />
        <ComposerInput placeholder={placeholder} autoFocus={autoFocus} />
        <ComposerFooter>
          {options ? (
            // Footer pills; they move into the checkout strip while the composer is compact.
            <ComposerOptions>
              <ModelPicker
                models={WORKBENCH_MODELS}
                providers={WORKBENCH_PROVIDERS}
                defaultValue="claude-opus-4-7"
                icon={<Icon name="asterisk" size={13.5} sw={2} />}
              />
              <ComposerSelect aria-label="Effort" options={WORKBENCH_EFFORTS} />
              <ComposerSelect aria-label="Access" icon="lock-rounded" options={WORKBENCH_ACCESS} />
            </ComposerOptions>
          ) : null}
          <ComposerSpacer />
          <ComposerSend />
        </ComposerFooter>
      </ComposerCard>
      {checkout ? (
        <ComposerBump side="bottom" variant="detached">
          <ComposerBumpHandle>
            <ComposerText icon="folder-closed">Local checkout</ComposerText>
            <ComposerOptionsOutlet />
            <ComposerSpacer />
            <ComposerText icon="branch">
              <span className="font-mono text-[11.5px]">main</span>
              <Icon name="chevron-down-wide" size={11} sw={2.4} className="opacity-60" />
            </ComposerText>
          </ComposerBumpHandle>
        </ComposerBump>
      ) : null}
    </Composer>
  );
}

/** Drops `![name](attachment:id)` refs from sent Markdown, for hosts that show attachments separately. */
export function stripAttachmentRefs(markdown: string): string {
  return markdown.replace(/!\[[^\]]*\]\(attachment:[^)\s]+\)[ \t]?/g, '').trim();
}

export type { ComposerAttachment };
