import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { describeTailscalePolicy, matchTailscalePolicy, resolveTailscalePolicy, TailscalePolicyError } from '@/lib/tailscale-policy'

// Which requests would the worker route? The same matcher the service worker
// runs, here in the page. Nothing is registered and nothing is sent.
export default function Policy() {
  const [url, setUrl] = useState('http://nas.tail1234.ts.net/photos')
  const [hosts, setHosts] = useState('*.corp.example, 192.168.1.0/24')
  const [all, setAll] = useState(false)
  const result = useMemo(() => {
    try {
      const policy = resolveTailscalePolicy({
        intercept: all ? 'all' : 'tailnet',
        hosts: hosts.split(',').map((h) => h.trim()).filter(Boolean),
      })
      const m = matchTailscalePolicy(url, 'GET', policy, location.origin)
      return { text: describeTailscalePolicy(policy), m }
    } catch (e) {
      return { text: e instanceof TailscalePolicyError ? e.message : String(e), m: null }
    }
  }, [url, hosts, all])

  return (
    <div className="mx-auto grid w-full max-w-md gap-3">
      <div className="grid gap-1">
        <Label htmlFor="ts-url" variant="field" className="text-foreground/70">Request URL</Label>
        <Input id="ts-url" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="ts-hosts" variant="field" className="text-foreground/70">Extra hosts and ranges</Label>
        <Input id="ts-hosts" value={hosts} onChange={(e) => setHosts(e.target.value)} />
      </div>
      <div className="flex items-center justify-between gap-3 text-subhead">
        Route every cross-origin request
        <Switch checked={all} onChange={setAll} aria-label="Route every cross-origin request" />
      </div>
      <p className="m-0 text-footnote text-foreground/70">{result.text}</p>
      <p role="status" className="m-0 text-subhead" data-testid="verdict">
        {result.m ? (
          <>
            <strong>{result.m.route ? 'Routed through Tailscale' : 'Normal network'}</strong>
            <span className="text-foreground/70"> · {result.m.reason}</span>
          </>
        ) : 'Invalid policy'}
      </p>
    </div>
  )
}
