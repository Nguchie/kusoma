export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_SUPABASE_URL?: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
      SUPABASE_SERVICE_ROLE_KEY?: string;
      DATABASE_URL?: string;
      DATABASE_DIRECT_URL?: string;
      AWS_ACCESS_KEY_ID?: string;
      AWS_SECRET_ACCESS_KEY?: string;
      AWS_REGION?: string;
      AWS_SESSION_TOKEN?: string;
      AWS_BEARER_TOKEN_BEDROCK?: string;
      CLAUDE_MODEL?: string;
      CBC_API_URL?: string;
      CBC_API_KEY?: string;
      REDIS_URL?: string;
      MPESA_CONSUMER_KEY?: string;
      MPESA_CONSUMER_SECRET?: string;
      MPESA_SHORTCODE?: string;
      MPESA_PASSKEY?: string;
      MPESA_CALLBACK_URL?: string;
      APP_URL?: string;
      NODE_ENV?: "development" | "production" | "test";
      CHAT_MIN_SECONDS_BETWEEN_MESSAGES?: string;
      CHAT_DAILY_MESSAGE_CAP?: string;
      CHAT_SESSION_SECRET?: string;
    }
  }
}
