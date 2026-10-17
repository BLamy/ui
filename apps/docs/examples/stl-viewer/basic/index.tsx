import { StlViewer } from '@/components/ui/stl-viewer'

// A binary .stl by URL (served from public/models/).
export default function Basic() {
  return (
    <div style={{ width: '100%', maxWidth: 640 }}>
      <StlViewer src={`${import.meta.env.BASE_URL}models/torus-knot.stl`} title="Torus knot" />
    </div>
  )
}
