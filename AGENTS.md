# AGENTS.md

## ✅ Build y pruebas
- Ejecuta antes de commitear:
  - `pnpm lint`
  - `pnpm run typecheck`
  - `OPENAI_API_KEY=sk-test pnpm run build`

## 🧱 Runtime
- Cualquier ruta que toque DB o auth debe incluir `export const runtime = 'nodejs'`.

## 🔀 Providers y `apiType`
- El chat soporta dos caminos y el cliente envía `selectedModelId` + `apiType`:
  - `gateway-chat`: usa `gw(id)` (AI Gateway, chat completions).
  - `openai-responses`: usa `openai.responses(id)` (Responses API).
- En la rama `openai-responses`:
  - Habilita herramientas nativas como `file_search` y `web_search_preview`.
  - Pasa `previousResponseId` sólo si lo obtienes de la respuesta anterior.

## 🛠️ Tools
- Las tools propias **no** se castean a `Tool<never, any>`.
  - Tools sin input → `inputSchema: z.never()`.
  - Tools con input → `z.object({ ... })`.
- Las hosted tools (ej. `file_search`) se instancian con `openaiProvider.tools.*` y, si fuese necesario, se castea `as Tool<never, any>`.
- El endpoint acepta:
  - `files` (array opcional para filtrar búsqueda por `filename`).
  - `toolChoice` (`'auto'` o `{ type: 'tool', toolName: 'file_search' }`).

## 🗂️ Persistencia Responses
- Guarda `result.providerMetadata?.openai.responseId` y reenvíalo como `previousResponseId` en el siguiente turno.

## 🖋️ Tipografías
- Usa `GeistSans` (vía `geist/font`) como `font-sans`.
- Mantén `GeistMono` para `font-mono`.
- Evita Google Fonts; define `NEXT_DISABLE_WEB_FONT_DOWNLOADS=1`.

## 🔁 Streaming / Auto-resume
- Deduplica los fragmentos por `responseId:index`.
- Actualiza el mismo mensaje del assistant mientras llega el stream.
- Limpia `dataStream` y re-habilita el input cuando llega `type === 'end'`.

## 🔐 Variables de entorno
Incluye en `.env.example` (y configura en Vercel/entorno):
```
OPENAI_API_KEY=
OPENAI_VECTOR_STORE_IDS=vs_...
POSTGRES_URL=
AUTH_SECRET=
BLOB_READ_WRITE_TOKEN=
# Para Gateway, si se usa:
# AI_GATEWAY_API_KEY=
# AI_GATEWAY_URL=
```

Con estas pautas el repositorio se mantiene estable entre Gateway y OpenAI Responses, con streaming consistente y soporte de herramientas como `file_search`.
