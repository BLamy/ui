/* The sidebar, as on iPad and Mac: Apple Music, Library and Playlists sections. Each row is a SplitViewItem, so
   picking one selects it in the SplitView (and closes the sidebar when it floats). On a phone the SplitView shows it
   as the iOS tab bar (`compactPresentation="tabs"`): the `tab` items are tabs, and the Library section is one tab
   (its `value`), current while any of its rows is the selection. */
import { SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection } from '@/components/ui/split-view';
import { Icon, type IconName, type IconShape } from '@/lib/icon';
import { PlaylistArt } from './artwork';
import { PLAYLISTS } from './data';
import { ALBUM_ICON } from './screens';

const Item = ({ id, icon, title, tab }: { id: string; icon: IconName | readonly IconShape[]; title: string; tab?: boolean }) => (
  <SplitViewItem value={id} title={title} tab={tab} icon={typeof icon === 'string' ? icon : <Icon shapes={icon} size={21} />} />
);

export function MusicSidebar() {
  return (
    <>
      <SplitViewHeader title="Music" />
      <SplitViewContent className="px-2.5 pb-24">
        <SplitViewSection>
          <Item id="search" icon="magnifyingglass" title="Search" tab />
        </SplitViewSection>
        <SplitViewSection title="Apple Music">
          <Item id="listen" icon="play-circle" title="Listen Now" tab />
          <Item id="browse" icon="grid" title="Browse" tab />
          <Item id="radio" icon="radiowaves" title="Radio" tab />
        </SplitViewSection>
        <SplitViewSection title="Library" tab value="library" icon="books-vertical">
          <Item id="recent" icon="clock" title="Recently Added" />
          <Item id="artists" icon="mic" title="Artists" />
          <Item id="albums" icon={ALBUM_ICON} title="Albums" />
          <Item id="songs" icon="music-notes" title="Songs" />
        </SplitViewSection>
        <SplitViewSection title="Playlists">
          {PLAYLISTS.map((p) => (
            <SplitViewItem key={p.id} value={'playlist:' + p.id} title={p.title} icon={<PlaylistArt playlist={p} size={24} rounded={4} />} />
          ))}
        </SplitViewSection>
      </SplitViewContent>
    </>
  );
}
