import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { ImageAnnotator, type ImageAnnotatorEngine } from '@/components/ui/pencilkit/image-annotator';
import { Phone as PhoneFrame } from '../../stories/frame';

/** A light screenshot (a settings page) and a dark photo (a night sky): the paper the surface is drawn on. */
const svg = (body: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="340">${body}</svg>`);
const LIGHT_SHOT = svg(
  '<rect width="560" height="340" fill="#F2F2F7"/><rect x="20" y="20" width="520" height="52" rx="10" fill="#FFFFFF"/>' +
    '<rect x="20" y="92" width="520" height="228" rx="10" fill="#FFFFFF"/><rect x="40" y="114" width="200" height="12" rx="6" fill="#D1D1D6"/>' +
    '<rect x="40" y="160" width="300" height="12" rx="6" fill="#E5E5EA"/><rect x="40" y="206" width="260" height="12" rx="6" fill="#E5E5EA"/>' +
    '<rect x="460" y="152" width="52" height="30" rx="15" fill="#34C759"/>' +
    '<text x="40" y="52" fill="#3C3C43" font-family="-apple-system,system-ui,sans-serif" font-size="16">Settings</text>',
);
const DARK_PHOTO = svg(
  '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1026"/><stop offset="1" stop-color="#2B2F77"/></linearGradient></defs>' +
    '<rect width="560" height="340" fill="url(#s)"/><circle cx="430" cy="80" r="26" fill="#FDE68A"/>' +
    '<path d="M0 340 L120 210 L210 280 L320 190 L560 340 Z" fill="#05060F"/>',
);

/** A fixed drawing surface, as a one-line engine: a circle around the toggle, in the theme's foreground. */
const Circled: ImageAnnotatorEngine = ({ children }) =>
  children({
    title: 'Fixed surface',
    canvas: (
      <svg className="absolute inset-0 size-full" viewBox="0 0 560 340" preserveAspectRatio="none" aria-hidden="true">
        <ellipse cx="486" cy="167" rx="48" ry="30" fill="none" stroke="var(--foreground)" strokeWidth="4" />
      </svg>
    ),
  });

const meta: Meta<typeof ImageAnnotator> = {
  title: 'Organisms/ImageAnnotator',
  component: ImageAnnotator,
  parameters: { layout: 'fullscreen' },
  args: { src: LIGHT_SHOT, defaultOpen: true },
  argTypes: {
    appearance: { control: 'inline-radio', options: ['auto', 'light', 'dark'] },
    engine: { control: false },
    origin: { control: false },
  },
  render: (args) => (
    <div className="h-[640px]">
      <ImageAnnotator {...args} />
    </div>
  ),
};
export default meta;
type Story = StoryObj<typeof ImageAnnotator>;

/** Open on a light screenshot with PencilKit's tools under it. Black draws black on the image (the inks are literal:
 *  the paper is the image, not the theme), and Save flattens the strokes into one PNG. */
export const Default: Story = {};

/** A dark photo. The surface wears the image's appearance (`appearance="auto"` measures it), so a theme-following
 *  color is light here and dark on the screenshot. */
export const DarkImage: Story = { args: { src: DARK_PHOTO } };

/** A fixed surface instead of PencilKit: an engine that hands over a canvas only. Its `var(--foreground)` stroke is
 *  dark because the screenshot is light, though the lightbox is dark. */
export const FixedSurface: Story = { args: { engine: Circled } };

/** `engine={null}`: a plain preview, the image and Close. */
export const Preview: Story = { args: { engine: null } };

/** On a phone: the image fits the width and the tools fold their inks and widths into one button. */
export const Phone: Story = {
  render: (args) => (
    <PhoneFrame h={844}>
      <ImageAnnotator {...args} />
    </PhoneFrame>
  ),
};

/** Closed, with a thumbnail: pressing it opens the lightbox, and the image flies out of the thumbnail (`origin`)
 *  and back into it. A saved annotation replaces the thumbnail. */
export const FromAThumbnail: Story = {
  args: { defaultOpen: false },
  render: function Render(args) {
    const [open, setOpen] = useState(false);
    const [src, setSrc] = useState(LIGHT_SHOT);
    const thumb = useRef<HTMLImageElement>(null);
    return (
      <div className="grid h-[640px] place-items-center">
        <Button variant="plain" aria-label="Annotate settings.png" onClick={() => setOpen(true)} className="h-auto overflow-hidden rounded-lg p-0">
          <img ref={thumb} src={src} alt="" className="block w-40" />
        </Button>
        <ImageAnnotator {...args} src={src} open={open} onOpenChange={setOpen} origin={() => thumb.current} onSave={setSrc} />
      </div>
    );
  },
};
