import VibecoderBlock from '@/components/blocks/vibecoder/page';

export default function Vibecoder() {
  return (
    <VibecoderBlock
      basePath={import.meta.env.BASE_URL}
      runtimeUrl={import.meta.env.VITE_OPENCODE_RUNTIME_URL}
    />
  );
}
