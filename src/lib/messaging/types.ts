export type ChatChannel = "web_chat" | "whatsapp";

export type ChatMode = "homework_help" | "topic_practice";

export type ChatContentType = "text" | "image" | "template" | "button_reply";

export type SendMessageOptions = {
  /**
   * Required when several active students share `toPhone`.
   * Workers and chat sessions should always pass this.
   */
  studentId?: string;
  mode?: ChatMode;
  assignmentId?: string | null;
};

/**
 * Every outbound student message goes through this interface.
 * `WebChatClient` is the active implementation; `WhatsAppClient` is a stub.
 */
export type MessagingClient = {
  readonly channel: ChatChannel;
  sendText(
    toPhone: string,
    body: string,
    options?: SendMessageOptions,
  ): Promise<void>;
  sendTemplate(
    toPhone: string,
    body: string,
    options?: SendMessageOptions,
  ): Promise<void>;
};
