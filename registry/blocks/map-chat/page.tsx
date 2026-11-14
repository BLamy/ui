import { MapChatDemo } from './map-chat-demo';

/* Other blocks reach the map through this entry (blocks import each other's page only, so installing one of them
   installs map-chat too): the TileMap, its tile sources and pin icons, and the geo helpers. */
export { TileMap, MAP_FONT, esriDarkGrayTiles, esriLightGrayTiles, type MapPin, type MapRoute } from './tile-map';
export { MAP_ICONS, type MapIconName } from './map-icons';
export { distanceMeters, formatDistance, type LatLng, type MapTarget } from './geo';

/** An always-floating ArtifactChatContainer over a TileMap, with map tools the chat can call. */
export default function MapChat() {
  return <MapChatDemo style={{ width: '100%', height: '100%' }} />;
}
