/* Step 2 — who is subscribing: a work email, a name, and the workspace (its URL previews as you type, and a few
   names are taken). Errors show on Continue, then follow each field as it is corrected. */
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/lib/icon';
import { emailError, slugify } from './checkout';
import { PRODUCT, TAKEN_WORKSPACES } from './data';
import { ErrorText, Hint, StepActions, StepHeading, useStepErrors } from './parts';
import { useCheckoutCtx } from './use-checkout';

function workspaceError(name: string) {
  const slug = slugify(name);
  if (!name.trim()) return 'Name your workspace.';
  if (slug.length < 2) return 'Use at least two letters or numbers.';
  return TAKEN_WORKSPACES.includes(slug) ? `${PRODUCT.domain}/${slug} is taken. Try another name.` : null;
}

export function AccountStep() {
  const c = useCheckoutCtx();
  const a = c.draft.account;
  const slug = slugify(a.workspace);
  const v = useStepErrors({
    email: emailError(a.email),
    name: a.name.trim() ? null : 'Enter your name.',
    workspace: workspaceError(a.workspace),
  });
  return (
    <FieldGroup render={<form noValidate onSubmit={(e) => { e.preventDefault(); if (v.check(e.currentTarget)) c.goTo('payment'); }} />} className="gap-5">
      <StepHeading title="Create your account" description="You’ll sign in with this email, and the receipt goes there too." focus={c.moved} />
      <Field name="email" invalid={v.invalid('email') || undefined}>
        <FieldLabel variant="default">Work email</FieldLabel>
        <Input type="email" required value={a.email} onValueChange={(email) => c.setAccount({ email })} placeholder="jane@company.com" autoComplete="email" />
        <ErrorText>{v.error('email')}</ErrorText>
      </Field>
      <Field name="name" invalid={v.invalid('name') || undefined}>
        <FieldLabel variant="default">Full name</FieldLabel>
        <Input required value={a.name} onValueChange={(name) => c.setAccount({ name })} placeholder="Jane Appleseed" autoComplete="name" />
        <ErrorText>{v.error('name')}</ErrorText>
      </Field>
      <Field name="workspace" invalid={v.invalid('workspace') || undefined}>
        <FieldLabel variant="default">Workspace name</FieldLabel>
        <Input required value={a.workspace} onValueChange={(workspace) => c.setAccount({ workspace })} placeholder="Acme Rockets" autoComplete="organization" />
        <Hint>
          {slug ? <>Your workspace will live at <span className="font-medium text-foreground">{PRODUCT.domain}/{slug}</span></> : 'Usually your company or team.'}
        </Hint>
        <ErrorText>{v.error('workspace')}</ErrorText>
      </Field>
      <Label variant="control" className="text-subhead">
        <Checkbox checked={a.updates} onCheckedChange={(updates) => c.setAccount({ updates: updates === true })} />
        Email me about new features (about once a month)
      </Label>
      <StepActions onBack={() => c.goTo('plan')}>
        <Button type="submit" size="lg" className="w-full @md:w-auto @md:min-w-[220px]">
          Continue to payment <Icon name="arrow-right" size={18} sw={2.2} />
        </Button>
      </StepActions>
    </FieldGroup>
  );
}
