/* Step 2 — who is subscribing: a work email, a name, and the workspace (its URL previews as you type, and a few
   names are taken). Errors show on Continue, then follow each field as it is corrected. */
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TextField } from '@/components/ui/text-field';
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
    <Form validationBehavior="aria" onSubmit={(e) => { e.preventDefault(); if (v.check(e.currentTarget)) c.goTo('payment'); }} className="gap-5">
      <StepHeading title="Create your account" description="You’ll sign in with this email, and the receipt goes there too." focus={c.moved} />
      <TextField name="email" type="email" isRequired value={a.email} onChange={(email) => c.setAccount({ email })} isInvalid={v.invalid('email')}>
        <Label>Work email</Label>
        <Input placeholder="jane@company.com" autoComplete="email" />
        <ErrorText>{v.error('email')}</ErrorText>
      </TextField>
      <TextField name="name" isRequired value={a.name} onChange={(name) => c.setAccount({ name })} isInvalid={v.invalid('name')}>
        <Label>Full name</Label>
        <Input placeholder="Jane Appleseed" autoComplete="name" />
        <ErrorText>{v.error('name')}</ErrorText>
      </TextField>
      <TextField name="workspace" isRequired value={a.workspace} onChange={(workspace) => c.setAccount({ workspace })} isInvalid={v.invalid('workspace')}>
        <Label>Workspace name</Label>
        <Input placeholder="Acme Rockets" autoComplete="organization" />
        <Hint>
          {slug ? <>Your workspace will live at <span className="font-medium text-foreground">{PRODUCT.domain}/{slug}</span></> : 'Usually your company or team.'}
        </Hint>
        <ErrorText>{v.error('workspace')}</ErrorText>
      </TextField>
      <Checkbox isSelected={a.updates} onChange={(updates) => c.setAccount({ updates })} className="text-subhead">
        Email me about new features (about once a month)
      </Checkbox>
      <StepActions onBack={() => c.goTo('plan')}>
        <Button type="submit" size="lg" className="w-full @md:w-auto @md:min-w-[220px]">
          Continue to payment <Icon name="arrow-right" size={18} sw={2.2} />
        </Button>
      </StepActions>
    </Form>
  );
}
