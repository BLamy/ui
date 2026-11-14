import { StrudelPlayer } from '@/components/ui/strudel-player'

// A .strudel file by URL (served from public/strudel/), with the code open.
export default function File() {
  return (
    <div style={{ width: '100%', maxWidth: 720 }}>
      <StrudelPlayer src={`${import.meta.env.BASE_URL}strudel/night-drive.strudel`} title="Night drive" showCode />
    </div>
  )
}
