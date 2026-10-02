import { VaultGate } from '@/components/ui/vault-gate'
import { BLProvider } from '@/lib/theme'
import { memoryStorage } from '@/lib/vault-storage'
import { VaultProvider } from '@/lib/vault-react'

// What a browser without WebAuthn sees. The environment is stubbed here so the
// screen is reproducible; a real unsupported browser lands on the same one.
// VaultGate renders its children only while unlocked, so the app behind it is
// never shown unprotected by accident. An app that decides to carry on without
// encryption passes `unsupported={<App />}` and says so.
const noWebAuthn = { credentials: null, PublicKeyCredential: null, isSecureContext: true }

export default function Unsupported() {
  return (
    <div className="mx-auto h-96 max-w-lg overflow-hidden rounded-card shadow-hairline">
      <BLProvider>
        <VaultProvider options={{ id: 'docs-unsupported', rp: { name: 'BL UI docs' }, storage: memoryStorage(), env: noWebAuthn, channel: false }}>
          <VaultGate appName="Private note">
            <p>Unlocked content.</p>
          </VaultGate>
        </VaultProvider>
      </BLProvider>
    </div>
  )
}
