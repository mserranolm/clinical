export type DoccoMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};
