/* The wide layout's sidebar, as on iPad and Mac: Apple Music, Library and Playlists sections. Each row is a
   SplitViewItem, so picking one selects it in the SplitView (and closes the sidebar when it floats). */
import { Icon, SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, type IconName, type IconShape } from '@brett_lamy/ui';
import { PlaylistArt } from './artwork';
import { PLAYLISTS } from './data';
import { ALBUM_ICON } from './screens';

const Item = ({ id, icon, title }: { id: string; icon: IconName | readonly IconShape[]; title: string }) => (
  <SplitViewItem id={id} title={title}
    icon={typeof icon === 'string' ? <Icon name={icon} size={21} /> : <Icon shapes={icon} size={21} />} />
);

export function MusicSidebar() {
  return (
    <>
      <SplitViewHeader title="Music" className="shadow-none" />
      <SplitViewContent className="px-2.5 pb-24">
        <SplitViewSection>
          <Item id="search" icon="magnifyingglass" title="Search" />
        </SplitViewSection>
        <SplitViewSection title="Apple Music">
          <Item id="listen" icon="play-circle" title="Listen Now" />
          <Item id="browse" icon="grid" title="Browse" />
          <Item id="radio" icon="radiowaves" title="Radio" />
        </SplitViewSection>
        <SplitViewSection title="Library">
          <Item id="recent" icon="clock" title="Recently Added" />
          <Item id="artists" icon="mic" title="Artists" />
          <Item id="albums" icon={ALBUM_ICON} title="Albums" />
          <Item id="songs" icon="music-notes" title="Songs" />
        </SplitViewSection>
        <SplitViewSection title="Playlists">
          {PLAYLISTS.map((p) => (
            <SplitViewItem key={p.id} id={'playlist:' + p.id} title={p.title} icon={<PlaylistArt playlist={p} size={24} rounded={4} />} />
          ))}
        </SplitViewSection>
      </SplitViewContent>
    </>
  );
}
