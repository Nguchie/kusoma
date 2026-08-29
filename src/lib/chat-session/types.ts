export type ChatSessionPayload = {
  studentId: string;
  phone: string;
  expiresAt: string;
};

export type ChatPendingPayload = {
  phone: string;
  candidateIds: string[];
  expiresAt: string;
};
