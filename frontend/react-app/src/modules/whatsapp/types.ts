export type WhatsAppStage =
  | "idle"
  | "connecting"
  | "qr_ready"
  | "connected"
  | "disconnecting"
  | "error";

export type BotMode = "beta" | "production";

export type WhatsAppStatus = {
  connected: boolean;
  stage: string;
  instanceName: string;
  botEnabled?: boolean;
  botMode?: BotMode;
  betaTestPhones?: string[];
  phoneNumber?: string;
};

export type WhatsAppConnectResult = {
  qrCode: string;
  stage: string;
  connected: boolean;
};

export type WhatsAppKnowledge = {
  knowledgeBase: string;
  welcomeMessage: string;
  assistantInstructions: string;
};
