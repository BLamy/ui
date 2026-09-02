import './styles.css';

export { ChatIcon, chatIconPaths, type ChatIconProps } from './lib/chat-icon';
export {
  chatTokens,
  chatTokenVars,
  K,
  KFONT,
  KMONO,
  KEASE,
  type ChatTokens,
} from './lib/chat-tokens';
export { kvib } from './lib/kvib';
export {
  ChatUsersProvider,
  useChatUsers,
  type ChatUser,
  type ChatUsers,
  type ChatUsersProviderProps,
  type ChatReaction,
  type ChatThreadReply,
  type ChatThreadData,
  type ChatMessageData,
  type ChatChannel,
  type ChatChannels,
} from './lib/chat-users';
export { ChatAvatar, type ChatAvatarProps } from './lib/chat-avatar';
export { RichText, type RichTextProps } from './lib/rich-text';
export { ThreadPreview, type ThreadPreviewProps } from './lib/thread-preview';
export { Message, type MessageProps } from './lib/message';
export { Composer, type ComposerProps } from './lib/composer';
export { ChannelList, type ChannelListProps } from './lib/channel-list';
export { WorkspaceRail, type WorkspaceRailProps, type Workspace } from './lib/workspace-rail';
export {
  ChatShell,
  useChatShell,
  type ChatShellProps,
  type ChatShellContextValue,
  type ChatShellSlotChildren,
} from './lib/chat-shell';
export {
  FloatingSheet,
  useFloatingSheet,
  type FloatingSheetProps,
  type FloatingSheetContextValue,
  type FloatingSheetFabPosition,
  type FloatingSheetAppearance,
  type FloatingSheetTone,
} from './lib/floating-sheet';
export {
  FloatingChat,
  useFloatingChat,
  type FloatingChatProps,
  type FloatingChatContextValue,
  type FloatingChatFabPosition,
} from './lib/floating-chat';
export {
  ArtifactChatContainer,
  useArtifactChatContainer,
  type ArtifactChatContainerProps,
  type ArtifactChatContainerContextValue,
  type ArtifactChatContainerSlotChildren,
  type ArtifactChatFabPosition,
  type ArtifactChatLayout,
} from './lib/artifact-chat-container';
export {
  ChatDemo,
  ChannelNav,
  ChannelMain,
  seed,
  USERS,
  type ChatDemoProps,
  type ChatThreadState,
  type ChannelNavProps,
  type ChannelMainProps,
} from './demos/chat-demo';
export {
  TileMap,
  esriDarkGrayTiles,
  esriLightGrayTiles,
  ESRI_ATTRIBUTION,
  osmTiles,
  OSM_ATTRIBUTION,
  cartoDarkTiles,
  cartoVoyagerTiles,
  CARTO_ATTRIBUTION,
  type TileMapProps,
  type MapPin,
  type MapRoute,
  type TileUrlFn,
} from './demos/map-chat/tile-map';
export {
  project,
  unproject,
  resolveView,
  distanceMeters,
  walkingMinutes,
  formatDistance,
  formatMinutes,
  type LatLng,
  type MapView,
  type MapTarget,
  type MapBoundsTarget,
  type MapPadding,
} from './demos/map-chat/geo';
export { MAP_ICONS, type MapIconName } from './demos/map-chat/map-icons';
export { PLACES, PLACE_BY_ID, AREAS, CATEGORY_META, USER_POSITION, type Place, type PlaceCategory } from './demos/map-chat/places';
export {
  planTurn,
  SUGGESTIONS,
  TOOL_META,
  type MapToolName,
  type MapToolHost,
  type AgentToolStep,
  type AgentTurnPlan,
  type AgentMemory,
  type Trip,
} from './demos/map-chat/map-agent';
export { MapChatDemo, type MapChatDemoProps } from './demos/map-chat/map-chat-demo';
export { ProgressStepper, type ProgressStepperProps, type ProgressStep, type ProgressStepState } from './lib/progress-stepper';
export {
  DeliveryTrackingDemo,
  DELIVERY_STAGES,
  type DeliveryTrackingDemoProps,
  type DeliveryStage,
} from './demos/delivery/delivery-tracking-demo';
