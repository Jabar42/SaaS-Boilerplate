export type N8nModelOptions = {
  endpoint: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  parts?: Array<{
    type: 'text';
    text: string;
  }>;
};

export type ChatError = {
  message: string;
};
