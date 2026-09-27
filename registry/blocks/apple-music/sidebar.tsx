/* The wide layout's sidebar, as on iPad and Mac: Apple Music, Library and Playlists sections. Each row is a
   SplitViewItem, so picking one selects it in the SplitView (and closes the sidebar when it floats). */
import { SplitViewContent, SplitViewHeader, SplitViewItem } from '@brett_lamy/ui';
import { PlaylistArt } from './artwork';
import { PLAYLISTS } from './data';
import { Glyph, type GlyphName } from './glyphs';

const Label = ({ children }: { children: string }) => (
  <div className="px-2.5 pt-5 pb-1 text-[13px] font-semibold text-muted-foreground">{children}</div>
);

const Item = ({ id, icon, title }: { id: string; icon: GlyphName; title: string }) => (
  <SplitViewItem id={id} title={title} icon={<Glyph name={icon} size={21} />} />
);

export function MusicSidebar() {
  return (
    <>
      <SplitViewHeader title="Music" className="shadow-none" />
      <SplitViewContent className="px-2.5 pb-24">
        <Item id="search" icon="search" title="Search" />
        <Label>Apple Music</Label>
        <Item id="listen" icon="listen" title="Listen Now" />
        <Item id="browse" icon="browse" title="Browse" />
        <Item id="radio" icon="radio" title="Radio" />
        <Label>Library</Label>
        <Item id="recent" icon="clock" title="Recently Added" />
        <Item id="artists" icon="mic" title="Artists" />
        <Item id="albums" icon="album" title="Albums" />
        <Item id="songs" icon="note" title="Songs" />
        <Label>Playlists</Label>
        {PLAYLISTS.map((p) => (
          <SplitViewItem key={p.id} id={'playlist:' + p.id} title={p.title} icon={<PlaylistArt playlist={p} size={24} rounded={4} />} />
        ))}
      </SplitViewContent>
    </>
  );
}
