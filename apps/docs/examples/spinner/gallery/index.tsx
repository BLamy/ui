import { Spinner, spinnerAnimations, type SpinnerProps } from '@/components/ui/spinner'

// Every animation with every pattern. `spinnerAnimations` lists them with their labels, so a gallery or a picker
// never has to hard-code the names. The iOS indicator is the default; the other twenty-two are the loaders.
export default function Gallery() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-x-6 gap-y-4 text-foreground">
      {spinnerAnimations.map((a) => (
        <section key={a.id} aria-label={a.label} className="grid gap-1.5">
          <h4 className="m-0 text-footnote font-semibold text-foreground">{a.label}</h4>
          <div className="flex gap-4">
            {a.patterns.length === 0 ? (
              <div className="grid justify-items-center gap-1">
                <Spinner size={28} />
                <code className="text-caption2 text-foreground">ios</code>
              </div>
            ) : (
              a.patterns.map((pattern) => (
                <div key={pattern} className="grid justify-items-center gap-1">
                  <Spinner {...({ animation: a.id, pattern } as SpinnerProps)} size={28} />
                  <code className="text-caption2 text-foreground">{pattern}</code>
                </div>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
