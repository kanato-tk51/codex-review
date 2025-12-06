import { AppConfig } from '../config';

export interface LlmResult {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
}

export async function callLlm(
  prompt: string,
  model: string,
  config: AppConfig,
  streamCb?: (chunk: string) => void
): Promise<LlmResult> {
  if (!config.allowExternalSend || !config.openaiApiKey) {
    const mock = 'LLM disabled: showing prompt preview\n' + prompt.slice(0, 1000);
    streamCb?.(mock);
    return { text: mock };
  }

  const { OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: Boolean(streamCb),
  });

  // openai SDK returns either stream iterator or object based on stream flag
  if (streamCb && Symbol.asyncIterator in response) {
    for await (const chunk of response as any) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) streamCb(content);
    }
    return { text: '' };
  }

  // non-stream
  const content = (response as any).choices?.[0]?.message?.content ?? '';
  const usage = (response as any).usage;
  return {
    text: content,
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
    costUsd: undefined,
  };
}
