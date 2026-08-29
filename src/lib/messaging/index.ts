import "server-only";

import { WebChatClient } from "./web-chat-client";
import type { MessagingClient } from "./types";

export type {
  ChatChannel,
  ChatContentType,
  ChatMode,
  MessagingClient,
  SendMessageOptions,
} from "./types";
export { WebChatClient } from "./web-chat-client";

let client: MessagingClient | undefined;

/** Active channel. Chat and workers import this — never WhatsApp APIs. */
export function getMessagingClient(): MessagingClient {
  if (!client) {
    client = new WebChatClient();
  }
  return client;
}
