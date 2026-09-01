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
  ArtifactChatContainer,
  useArtifactChatContainer,
  type ArtifactChatContainerProps,
  type ArtifactChatContainerContextValue,
  type ArtifactChatContainerSlotChildren,
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
