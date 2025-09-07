import type { NextRequest } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  if (process.env.ENABLE_RESPONSES_RAW !== 'true') {
    return new Response('Disabled', { status: 404 });
  }

  const { input, model = 'gpt-4o-mini', vectorStoreIds, fileFilters } =
    await req.json();

  const response = await client.responses.create({
    model,
    input,
    tools: [
      {
        type: 'file_search',
        vector_store_ids: vectorStoreIds,
        ...(fileFilters && { filters: fileFilters }),
      },
    ],
    include: ['output_text', 'output[*].file_search_call.search_results'],
  });

  return Response.json(response);
}

