import { auth } from '@clerk/nextjs/server';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { NextResponse } from 'next/server';
import { getChatModel } from '@/lib/ai/client';
import { buildChatContext, formatContextForPrompt } from '@/lib/chat/context';
import { buildCompleteSystemPrompt } from '@/lib/chat/system-prompts';
import { createChatTools } from '@/lib/chat/tools';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { getToken, userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 },
      );
    }

    const token = await getToken();

    if (!token) {
      return NextResponse.json(
        { error: 'Failed to get session token' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { messages }: { messages: UIMessage[] } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
        { status: 400 },
      );
    }

    const context = await buildChatContext();
    const contextString = formatContextForPrompt(context);
    const systemPrompt = buildCompleteSystemPrompt(contextString);

    const tools = createChatTools({ userId });

    const result = streamText({
      model: getChatModel(),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 503 },
    );
  }
}
