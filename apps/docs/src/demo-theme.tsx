import type { DemoComponent, DemoComponentProps } from '@brett_lamy/docstream';
import { themeScopeProps, useAppearance } from '@brett_lamy/ui';

/* Every demo renders inside the bl-theme for the docs' appearance: a `light` / `dark` wrapper (display: contents, so
   the demo canvas' layout is untouched) that also sets the text color the demos inherit. A plain element rather than
   <ThemeScope>: the kit's box-sizing reset reaches everything under a `data-slot`, and demos' own markup must keep
   the browser default. */
export function themed(Demo: DemoComponent): DemoComponent {
  function ThemedDemo(props: DemoComponentProps) {
    const scope = themeScopeProps({ appearance: useAppearance() ?? 'light' });
    return (
      <div data-docs-demo-theme="" className={`${scope.className} contents text-foreground`}>
        <Demo {...props} />
      </div>
    );
  }
  return ThemedDemo as DemoComponent;
}
