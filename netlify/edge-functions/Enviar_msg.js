const APIkey = Deno.env.get('Chatbot_Key');
const TMDB_API_KEY = "ece12ff481fd8f23e34255eadfae14f0";

const systemPrompt = `Sos un asistente especializado en cine. Tu único rol es responder preguntas sobre la película o serie indicada utilizando la información oficial de TMDB suministrada.

[COMPORTAMIENTO]
- Respondé únicamente lo que el usuario preguntó, de forma natural, directa y conversacional.
- Utilizá estrictamente los datos oficiales de TMDB incluidos en el contexto para responder. Si algún dato no figura en la ficha o es una pregunta de opinión libre sobre el cine, usá tu conocimiento general pero mantenelo siempre breve.
- Sé sumamente conciso. No agregues introducciones largas, saludos repetitivos ni información de relleno.
- Respondé en el mismo idioma en el que te escribe el usuario.

[EJEMPLOS DE ESTILO CONCISO]
Usuario: "¿De qué trata?"
Respuesta: Resumí brevemente el argumento sin spoilers mayores, a menos que te los pidan.

Usuario: "¿Tiene escena post-créditos?"
Respuesta: Indicá si tiene o no de manera directa, y describila brevemente.

Usuario: "¿Quién la dirige?"
Respuesta: Solo el nombre del director.

Usuario: "¿Cuándo salió?"
Respuesta: Solo el año/fecha de estreno.`;

async function fetchTMDBData(query, langCode) {
    if (!query || query === 'General') return null;
    try {
        // 1. Buscar la película o serie (multi-search) usando el idioma preferido
        const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=${langCode}&page=1`;
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) return null;

        const searchData = await searchRes.json();
        const firstResult = searchData.results?.[0];
        if (!firstResult) return null;

        const { id, media_type } = firstResult;
        if (media_type !== 'movie' && media_type !== 'tv') return null;

        // 2. Obtener detalles y créditos de TMDB usando el idioma preferido
        const detailsUrl = `https://api.themoviedb.org/3/${media_type}/${id}?api_key=${TMDB_API_KEY}&language=${langCode}&append_to_response=credits`;
        const detailsRes = await fetch(detailsUrl);
        if (!detailsRes.ok) return null;

        const details = await detailsRes.json();

        // Estructurar ficha técnica
        const title = details.title || details.name || query;
        const typeLabel = media_type === 'movie' ? 'Película' : 'Serie de TV';
        const director = details.credits?.crew?.find(c => c.job === 'Director')?.name || 'Desconocido';
        const cast = details.credits?.cast?.slice(0, 8).map(c => `${c.name} (${c.character})`).join(', ') || 'No disponible';
        const overview = details.overview || 'Sinopsis no disponible.';
        const genres = details.genres?.map(g => g.name).join(', ') || 'No especificados';
        const release = details.release_date || details.first_air_date || 'Desconocida';
        const rating = details.vote_average ? `${details.vote_average.toFixed(1)}/10` : 'Sin calificación';

        return {
            title,
            typeLabel,
            director,
            cast,
            overview,
            genres,
            release,
            rating
        };
    } catch (e) {
        console.error("[CineBot TMDB Fetch Error]", e);
        return null;
    }
}

export default async function handler(request, _context) {
    const { Mensaje, Pelicula, Idioma } = await request.json();
    const origin = request.headers.get("origin") || "";
    
    // Normalizar código de idioma (ej. "es-419" o "es-MX" -> "es-ES", "en-US" -> "en-US")
    const langCode = Idioma || "es-ES";

    // Buscar ficha oficial de TMDB con el idioma del usuario
    const tmdbData = await fetchTMDBData(Pelicula, langCode);
    let contextString = `Título del contexto actual: ${Pelicula}`;
    
    if (tmdbData) {
        contextString = `[FICHA OFICIAL DE TMDB]
Tipo: ${tmdbData.typeLabel}
Título: ${tmdbData.title}
Estreno: ${tmdbData.release}
Puntuación: ${tmdbData.rating}
Director: ${tmdbData.director}
Elenco Principal: ${tmdbData.cast}
Géneros: ${tmdbData.genres}
Sinopsis: ${tmdbData.overview}`;
    }

    const prompt_consulta = `${contextString}\n\nConsulta del usuario: ${Mensaje}`;
    let respuestaTexto = "";

    try {
        const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${APIkey}`,
                "HTTP-Referer": origin,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openrouter/auto",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt_consulta }
                ],
                max_tokens: 1000
            })
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`OpenRouter API error status ${apiResponse.status}: ${errorText}`);
        }

        const data = await apiResponse.json();
        respuestaTexto = data.choices?.[0]?.message?.content || "";
    } catch (err) {
        console.warn("[CineBot Fallback Triggered] OpenRouter failed, delivering local cache.", err);
        
        const isEnglish = langCode.toLowerCase().startsWith('en');
        const isPortuguese = langCode.toLowerCase().startsWith('pt');

        if (tmdbData) {
            if (isEnglish) {
                respuestaTexto = `⚠️ **Temporary Connection Timeout (CineBot)**

I couldn't reach the AI service right now, but here is the official metadata preloaded from TMDB:

- **Title**: ${tmdbData.title}
- **Released**: ${tmdbData.release}
- **Director**: ${tmdbData.director}
- **Rating**: ${tmdbData.rating}
- **Genres**: ${tmdbData.genres}
- **Cast**: ${tmdbData.cast}
- **Overview**: ${tmdbData.overview}`;
            } else if (isPortuguese) {
                respuestaTexto = `⚠️ **Falha na conexão temporária (CineBot)**

Não consegui falar com a inteligência artificial agora, mas aqui está a ficha técnica oficial carregada do TMDB:

- **Título**: ${tmdbData.title}
- **Lançamento**: ${tmdbData.release}
- **Diretor**: ${tmdbData.director}
- **Nota**: ${tmdbData.rating}
- **Gêneros**: ${tmdbData.genres}
- **Elenco principal**: ${tmdbData.cast}
- **Sinopse**: ${tmdbData.overview}`;
            } else {
                respuestaTexto = `⚠️ **Falla de conexión temporal (CineBot)**

No he podido comunicarme con la inteligencia artificial en este momento, pero aquí tienes la ficha técnica oficial de la película/serie precargada desde TMDB:

- **Título**: ${tmdbData.title} (${tmdbData.typeLabel})
- **Estreno**: ${tmdbData.release}
- **Director**: ${tmdbData.director}
- **Puntuación**: ${tmdbData.rating}
- **Géneros**: ${tmdbData.genres}
- **Elenco principal**: ${tmdbData.cast}
- **Sinopsis**: ${tmdbData.overview}`;
            }
        } else {
            if (isEnglish) {
                respuestaTexto = `⚠️ **Temporary Connection Timeout (CineBot)**

Sorry, I'm having trouble connecting to the AI model right now and no local data is preloaded. Please try again in a few minutes.`;
            } else if (isPortuguese) {
                respuestaTexto = `⚠️ **Falha na conexão temporária (CineBot)**

Desculpe, estou com problemas para me conectar ao modelo de IA no momento e nenhum dado local foi carregado. Por favor, tente novamente em alguns minutos.`;
            } else {
                respuestaTexto = `⚠️ **Falla de conexión temporal (CineBot)**

Lo siento, estoy teniendo dificultades para conectarme con el motor de IA en este momento y no hay datos precargados para esta sección. Por favor, intenta de nuevo en unos minutos.`;
            }
        }
    }

    return new Response(
        JSON.stringify({ respuesta: respuestaTexto }),
        {
            status: 200,
            headers: { "Content-Type": "application/json" }
        }
    );
}