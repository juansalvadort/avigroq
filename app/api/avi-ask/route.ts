import type { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { myProvider } from '@/lib/ai/providers';

const VECTOR_STORE_IDS = (process.env.OPENAI_VECTOR_STORE_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function buildFilenameFilters(files?: string[]) {
  if (!files?.length) return undefined as any;
  return {
    type: 'or',
    filters: files.map((value) => ({ type: 'eq', key: 'filename', value })),
  } as const;
}

function normalizeSearchResults(raw: any): Array<{
  file_id: string;
  filename?: string;
  score?: number;
  chunk_id?: string;
  attributes?: Record<string, any>;
}> {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  return arr
    .map((r) => ({
      file_id: r.file_id || r.fileId || r.id,
      filename: r.filename,
      score: r.score ?? r.relevance ?? undefined,
      chunk_id: r.chunk_id || r.chunkId,
      attributes: r.attributes || r.metadata || undefined,
    }))
    .filter((x) => x.file_id);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const q: string = body.q ?? body.input ?? '';
  const files: string[] | undefined = body.files;
  const instructions: string | undefined = body.instructions;
  const verbosity: 'low' | 'medium' | 'high' = body.verbosity ?? 'medium';
  const maxNumResults: number = body.maxNumResults ?? 20;
  const forceFileSearch: boolean = !!body.forceFileSearch;

  if (!q) {
    return new Response(JSON.stringify({ error: 'Falta q (consulta).' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const filters = buildFilenameFilters(files);

  const result = await generateText({
    model: myProvider.languageModel('chat-model'),
    messages: [
      ...(instructions ? [{ role: 'system' as const, content: instructions }] : []),
      { role: 'user' as const, content: q },
    ],
    providerOptions: {
      openai: {
        tools: [
          {
            type: 'file_search',
            vector_store_ids: VECTOR_STORE_IDS,
            max_num_results: maxNumResults,
            ...(filters && { filters }),
          },
        ],
        tool_choice: forceFileSearch
          ? { type: 'tool', tool_name: 'file_search' }
          : 'auto',
        text: { verbosity },
        include: ['file_search_call.results', 'output_text'],
      },
    },
  });

  const text = result.text ?? '';
  const pm: any = result.response?.providerMetadata?.openai ?? {};
  const rawResults =
    pm['file_search_call.results'] ??
    pm['output']?.flatMap?.((o: any) => o?.file_search_call?.search_results || []) ??
    [];
  const citations = normalizeSearchResults(rawResults);

  return new Response(
    JSON.stringify({ text, citations, rawProviderMetadata: pm }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
