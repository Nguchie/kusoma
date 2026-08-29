import "server-only";

import type { MessagingClient } from "@/lib/messaging/types";

/**
 * Named stub. Not wired up. Do not add Meta webhooks in this build.
 * Implement this class later; tutoring code should keep using `MessagingClient`.
 */
export class WhatsAppClient implements MessagingClient {
  readonly channel = "whatsapp" as const;

  sendText: MessagingClient["sendText"] = () =>
    Promise.reject(new Error("WhatsAppClient is not implemented"));

  sendTemplate: MessagingClient["sendTemplate"] = () =>
    Promise.reject(new Error("WhatsAppClient is not implemented"));
}
