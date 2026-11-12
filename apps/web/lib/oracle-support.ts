type OracleInput = {
  subject: string;
  latestMessage: string;
  history: Array<{ role: "user" | "oracle" | "admin" | "system"; message: string }>;
  ticketId?: string;
  memorySummary?: string | null;
  accountType?: "cliente" | "negocio" | null;
};

export type OracleDecision = {
  reply: string;
  summary: string;
  category: string;
  confidence: number;
  needsEscalation: boolean;
  escalationReason?: string;
};

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseJsonLoose<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const codeBlock = raw.match(/```json\s*([\s\S]*?)\s*```/i)?.[1] ?? raw.match(/```\s*([\s\S]*?)\s*```/i)?.[1];
    if (codeBlock) {
      try {
        return JSON.parse(codeBlock) as T;
      } catch {
      }
    }

    const objectLike = raw.match(/\{[\s\S]*\}/)?.[0];
    if (objectLike) {
      try {
        return JSON.parse(objectLike) as T;
      } catch {
      }
    }
  }

  return null;
}

function pickModelText(payload: unknown): string | null {
  const data = payload as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? "").join("\n").trim() || null;
  }

  return null;
}

function pickGeminiText(payload: unknown): string | null {
  const data = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? "").join("\n").trim();
  return text || null;
}

function pickOllamaText(payload: unknown): string | null {
  const data = payload as {
    message?: {
      content?: string;
    };
    response?: string;
  };

  return (data.message?.content ?? data.response ?? "").trim() || null;
}

function hasOneOf(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function buildGeminiEndpoint(modelName: string, customUrl?: string) {
  if (!customUrl) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  }

  if (customUrl.includes(":generateContent")) {
    return customUrl;
  }

  const normalized = customUrl.endsWith("/") ? customUrl.slice(0, -1) : customUrl;

  if (normalized.endsWith(`/models/${modelName}`)) {
    return `${normalized}:generateContent`;
  }

  if (normalized.endsWith("/models")) {
    return `${normalized}/${modelName}:generateContent`;
  }

  if (normalized.includes("/v1beta")) {
    return `${normalized}/models/${modelName}:generateContent`;
  }

  return normalized;
}

function buildOllamaEndpoint(customUrl?: string) {
  if (!customUrl) {
    return "http://localhost:11434/api/chat";
  }

  if (customUrl.includes("/api/chat") || customUrl.includes("/v1/chat/completions")) {
    return customUrl;
  }

  const normalized = customUrl.endsWith("/") ? customUrl.slice(0, -1) : customUrl;
  return `${normalized}/api/chat`;
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function isInvalidModelReply(reply: string | undefined | null) {
  if (!reply) {
    return true;
  }

  const normalized = reply.trim();
  if (!normalized || normalized.length < 3) {
    return true;
  }

  if (/^[\{\}\[\]"'`:,\s]+$/.test(normalized)) {
    return true;
  }

  return false;
}

function followUpQuestion(category: string, oracleTurns: number) {
  if (category === "acceso") {
    if (oracleTurns <= 1) {
      return "¿Te aparece algún mensaje exacto al intentar iniciar sesión? Si puedes, cópiamelo tal cual.";
    }
    if (oracleTurns === 2) {
      return "Perfecto. ¿Estás entrando con Google o con correo/contraseña, y desde qué pantalla te bloquea?";
    }
    return "Último dato para ayudarte mejor: ¿ya intentaste restablecer contraseña y te llegó el correo/OTP?";
  }

  if (category === "errores") {
    if (oracleTurns <= 1) {
      return "¿En qué pantalla pasó y qué botón tocaste justo antes del error?";
    }
    if (oracleTurns === 2) {
      return "¿Te sucede siempre o solo a veces? Si puedes, dime hora aproximada y dispositivo.";
    }
    return "¿Podrías compartirme el texto exacto del error o una captura para ubicarlo mejor?";
  }

  if (category === "reservas") {
    if (oracleTurns <= 1) {
      return "¿Quieres agendar, cambiar o cancelar una cita? Cuéntame cuál de las tres.";
    }
    if (oracleTurns === 2) {
      return "¿En qué paso te atoras: servicio, horario, método de pago o confirmación?";
    }
    return "¿Qué fecha/hora intentas reservar y qué método de pago estás usando?";
  }

  if (category === "pagos") {
    if (oracleTurns <= 1) {
      return "¿El problema fue con wallet, tarjeta guardada o efectivo en local?";
    }
    if (oracleTurns === 2) {
      return "¿Te salió algún cargo, rechazo o saldo insuficiente? Dime el mensaje exacto si lo ves.";
    }
    return "¿Recuerdas monto y hora aproximada del intento? Con eso te guío mejor.";
  }

  if (oracleTurns <= 1) {
    return "Cuéntame un poco más: ¿qué intentabas hacer y en qué pantalla te pasó?";
  }
  if (oracleTurns === 2) {
    return "Gracias. ¿Qué mensaje exacto ves en pantalla o qué comportamiento notas?";
  }
  return "Con un último dato (hora aproximada y dispositivo) te doy el siguiente paso.";
}

function keywordDecision(input: OracleInput): OracleDecision {
  const combined = normalizeText([input.subject, input.latestMessage, ...input.history.map((entry) => entry.message)].join(" "));
  const escalationIntentText = normalizeText([input.latestMessage, ...input.history.map((entry) => entry.message)].join(" "));
  const oracleTurns = input.history.filter((entry) => entry.role === "oracle").length;

  const has404Error = hasOneOf(combined, ["404", "not found", "no encontrado", "pagina no encontrada"]);
  const mentionsSalonFlow = hasOneOf(combined, ["salon", "salones", "ver mas detalles", "detalle", "resumen"]);
  const confirmsAlways = hasOneOf(combined, ["siempre", "sucede siempre", "pasa siempre"]);

  if (has404Error && mentionsSalonFlow) {
    const shouldEscalate = confirmsAlways || oracleTurns >= 2;

    return {
      reply: shouldEscalate
        ? "Gracias, con esos datos ya identifiqué el patrón: en Salones, al tocar \"Ver más detalles\" te responde 404 de forma constante. Voy a escalarlo al equipo admin para corregir la ruta de detalle/resumen y te avisaremos por este mismo ticket."
        : "Perfecto, gracias. Ese 404 parece venir de la ruta de detalle/resumen del salón. Como paso temporal, vuelve al listado de Salones y abre otro salón para confirmar si falla igual.",
      summary: "Error 404 al abrir 'Ver más detalles' en Salones.",
      category: "errores",
      confidence: 0.92,
      needsEscalation: shouldEscalate,
      escalationReason: shouldEscalate ? "Error 404 reproducible en la vista de detalle/resumen de Salones." : undefined,
    };
  }

  const painPoints = [
    {
      terms: ["cancelar", "cancelacion", "reembols", "devolucion", "cobro doble", "doble cargo"],
      reply: "Claro, te ayudo con eso. Vamos a revisarlo juntos para darte una solución rápida.",
      category: "pagos",
      confidence: 0.78,
    },
    {
      terms: ["no me deja", "error", "fallo", "bug", "crash", "se traba", "no carga"],
      reply: "Entiendo, vamos paso a paso. Sí lo podemos revisar contigo desde aquí.",
      category: "errores",
      confidence: 0.62,
    },
    {
      terms: ["cita", "horario", "agenda", "reserv"],
      reply: "Perfecto, te ayudo con tu cita ahora mismo.",
      category: "reservas",
      confidence: 0.86,
    },
    {
      terms: ["wallet", "saldo", "tarjeta", "pago", "metodo"],
      reply: "Vamos a resolver el tema de pago juntos.",
      category: "pagos",
      confidence: 0.84,
    },
    {
      terms: ["contraseña", "acceso", "login", "sesion", "correo", "otp"],
      reply: "Te ayudo con acceso y recuperación de cuenta, sin problema.",
      category: "acceso",
      confidence: 0.72,
    },
  ];

  const match = painPoints.find((item) => item.terms.some((term) => combined.includes(term)));

  if (!match) {
    const shouldEscalateUnknown = oracleTurns >= 4 || hasOneOf(escalationIntentText, ["agente", "humano", "persona", "asesor"]);
    return {
      reply: shouldEscalateUnknown
        ? "Gracias por la info. Para ayudarte mejor y más rápido, voy a escalar tu caso con un agente administrativo."
        : `Soy AURA 👋 ${followUpQuestion("general", oracleTurns)}`,
      summary: input.latestMessage,
      category: "general",
      confidence: 0.35,
      needsEscalation: shouldEscalateUnknown,
      escalationReason: shouldEscalateUnknown ? "Información insuficiente tras intento de aclaración." : undefined,
    };
  }

  const explicitHumanRequest = hasOneOf(escalationIntentText, ["agente", "humano", "persona", "asesor"]);

  const repeatedLowConfidence = match.confidence < 0.7 && oracleTurns >= 4;
  const veryLowConfidence = match.confidence < 0.5;
  const needsEscalation = explicitHumanRequest || veryLowConfidence || repeatedLowConfidence;

  const conversationalReply = `${match.reply} ${followUpQuestion(match.category, oracleTurns)}`;

  return {
    reply: conversationalReply,
    summary: input.latestMessage,
    category: match.category,
    confidence: match.confidence,
    needsEscalation,
    escalationReason: needsEscalation
      ? explicitHumanRequest
        ? "El usuario solicitó atención humana."
        : "No se logró resolver automáticamente tras varios intentos."
      : undefined,
  };
}

async function modelDecision(input: OracleInput): Promise<OracleDecision | null> {
  const modelApiKey = process.env.ORACLE_MODEL_API_KEY?.trim();
  const modelName = process.env.ORACLE_MODEL_NAME?.trim() || "gemini-2.0-flash";
  const providerFromEnv = process.env.ORACLE_MODEL_PROVIDER?.trim().toLowerCase();
  const modelApiUrl = process.env.ORACLE_MODEL_API_URL?.trim();

  const resolvedProvider = providerFromEnv
    ? providerFromEnv
    : (modelApiUrl?.includes("generativelanguage.googleapis.com") || modelApiKey?.startsWith("AIza") ? "gemini" : "openai");

  if ((resolvedProvider === "gemini" || resolvedProvider === "openai") && !modelApiKey) {
    return null;
  }

  const systemPrompt = [
    "Eres AURA, asistente de soporte técnico de STYLEHUB.",
    "Habla en español natural, empático y claro.",
    "Tu objetivo es resolver sin escalar en los primeros turnos, haciendo preguntas útiles.",
    "Escala solo si: 1) el usuario lo pide explícitamente, 2) faltan datos tras varios intentos, 3) bloqueo crítico sin solución inmediata.",
    "Responde SIEMPRE en JSON estricto con este formato:",
    '{"reply":"string","summary":"string","category":"general|acceso|errores|reservas|pagos","confidence":0.0,"needsEscalation":false,"escalationReason":"string opcional"}',
  ].join("\n");

  const userPrompt = {
    ticketId: input.ticketId ?? null,
    accountType: input.accountType ?? null,
    subject: input.subject,
    memorySummary: input.memorySummary ?? null,
    latestMessage: input.latestMessage,
    history: input.history.slice(-30),
  };

  try {
    if (resolvedProvider === "ollama") {
      const ollamaUrl = buildOllamaEndpoint(modelApiUrl);
      const response = await fetch(ollamaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(userPrompt) },
          ],
          stream: false,
          format: "json",
        }),
      });

      if (!response.ok) {
        const reason = await response.text().catch(() => "");
        console.warn(`AURA Ollama call failed (${response.status}).`, reason.slice(0, 500));
        return null;
      }

      const payload = (await response.json()) as unknown;
      const text = pickOllamaText(payload);
      if (!text) {
        return null;
      }

      const parsed = parseJsonLoose<Partial<OracleDecision>>(text);
      if (!parsed?.reply || isInvalidModelReply(parsed.reply)) {
        console.warn("AURA Ollama returned invalid reply payload, using fallback.", text.slice(0, 160));
        return null;
      }

      return {
        reply: parsed.reply,
        summary: parsed.summary ?? input.latestMessage,
        category: parsed.category ?? "general",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
        needsEscalation: Boolean(parsed.needsEscalation),
        escalationReason: parsed.escalationReason,
      };
    }

    if (resolvedProvider === "gemini") {
      const modelCandidates = uniqueNonEmpty([
        "gemini-2.0-flash-lite",
        "gemini-2.5-flash-lite",
        modelName,
        "gemini-2.0-flash",
        "gemini-1.5-flash-latest",
      ]);

      let lastError: string | null = null;

      for (const candidate of modelCandidates) {
        const geminiBase = buildGeminiEndpoint(candidate, modelApiUrl);
        const url = new URL(geminiBase);

        const response = await fetch(url.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(modelApiKey ? { "x-goog-api-key": modelApiKey } : {}),
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: JSON.stringify(userPrompt) }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json",
            },
          }),
        });

        if (!response.ok) {
          const reason = await response.text().catch(() => "");
          lastError = `model=${candidate} status=${response.status} body=${reason.slice(0, 500)}`;

          const retryableGeminiError =
            response.status === 404 ||
            response.status === 429 ||
            /NOT_FOUND|not found|quota exceeded|rate limit|free_tier_requests|models\//i.test(reason);

          if (retryableGeminiError) {
            continue;
          }

          console.warn(`AURA Gemini call failed (${response.status}).`, reason.slice(0, 500));
          return null;
        }

        const payload = (await response.json()) as unknown;
        const text = pickGeminiText(payload);
        if (!text) {
          continue;
        }

        const parsed = parseJsonLoose<Partial<OracleDecision>>(text);
        if (!parsed?.reply || isInvalidModelReply(parsed.reply)) {
          continue;
        }

        return {
          reply: parsed.reply,
          summary: parsed.summary ?? input.latestMessage,
          category: parsed.category ?? "general",
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
          needsEscalation: Boolean(parsed.needsEscalation),
          escalationReason: parsed.escalationReason,
        };
      }

      if (lastError) {
        console.warn("AURA Gemini retries exhausted.", lastError);
      }

      return null;
    }

    const openAiUrl = modelApiUrl || "https://api.openai.com/v1/chat/completions";
    const response = await fetch(openAiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${modelApiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPrompt) },
        ],
      }),
    });

    if (!response.ok) {
      const reason = await response.text().catch(() => "");
      console.warn(`AURA model call failed (${response.status}).`, reason.slice(0, 500));
      return null;
    }

    const payload = (await response.json()) as unknown;
    const text = pickModelText(payload);
    if (!text) {
      return null;
    }

    const parsed = parseJsonLoose<Partial<OracleDecision>>(text);
    if (!parsed?.reply || isInvalidModelReply(parsed.reply)) {
      return null;
    }

    return {
      reply: parsed.reply,
      summary: parsed.summary ?? input.latestMessage,
      category: parsed.category ?? "general",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
      needsEscalation: Boolean(parsed.needsEscalation),
      escalationReason: parsed.escalationReason,
    };
  } catch (error) {
    console.warn("AURA model call failed, using fallback engine.", error);
    return null;
  }
}

export async function oracleRespond(input: OracleInput): Promise<OracleDecision> {
  const model = await modelDecision(input);
  if (model) {
    return model;
  }

  const endpoint = process.env.ORACLE_API_URL?.trim();
  const apiKey = process.env.ORACLE_API_KEY?.trim();

  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(input),
      });

      if (response.ok) {
        const payload = (await response.json()) as Partial<OracleDecision>;
        if (payload.reply) {
          return {
            reply: payload.reply,
            summary: payload.summary ?? input.latestMessage,
            category: payload.category ?? "general",
            confidence: typeof payload.confidence === "number" ? payload.confidence : 0.8,
            needsEscalation: Boolean(payload.needsEscalation),
            escalationReason: payload.escalationReason,
          };
        }
      }
    } catch (error) {
      console.warn("AURA endpoint unavailable, using local decision engine.", error);
    }
  }

  return keywordDecision(input);
}
