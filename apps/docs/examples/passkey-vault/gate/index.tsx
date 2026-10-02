import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TextField } from '@/components/ui/text-field'
import { VaultGate, VaultStatusBadge } from '@/components/ui/vault-gate'
import { BLProvider } from '@/lib/theme'
import { VaultProvider, useEncryptedState, useVault } from '@/lib/vault-react'

// A note that only exists decrypted while the vault is unlocked. First run asks
// to set up a passkey (and shows the recovery key once); later visits ask to
// unlock. The text is stored in IndexedDB as AES-GCM ciphertext; lock the vault
// and it leaves component state too. Nothing here is sent anywhere.
function Notes() {
  const vault = useVault()
  const [note, setNote, meta] = useEncryptedState('note', '')
  return (
    <div className="grid content-start gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <VaultStatusBadge />
        <Button variant="secondary" size="sm" onPress={() => vault.lock()}>
          Lock
        </Button>
      </div>
      <TextField value={note} onChange={(text) => void setNote(text)} isDisabled={meta.status !== 'ready'}>
        <Label variant="field" className="text-foreground/70">Private note</Label>
        <Textarea size="lg" placeholder="Reload the page, then unlock to read this again." />
      </TextField>
    </div>
  )
}

export default function Gate() {
  return (
    <div className="mx-auto h-[36rem] max-w-lg overflow-hidden rounded-card shadow-hairline">
      <BLProvider>
        <VaultProvider options={{ id: 'docs-gate', rp: { name: 'BL UI docs' }, autoLockMs: 5 * 60_000 }}>
          <VaultGate appName="Private note">
            <Notes />
          </VaultGate>
        </VaultProvider>
      </BLProvider>
    </div>
  )
}
