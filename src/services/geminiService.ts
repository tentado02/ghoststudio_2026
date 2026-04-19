import { GoogleGenAI, Type } from "@google/genai";
import { VideoIdea, VideoScript, VideoScene } from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not defined. Please check your environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return aiInstance;
}

export const geminiService = {
  async searchIdeas(topic: string, language: 'pt' | 'en' = 'pt'): Promise<VideoIdea[]> {
    const ai = getAI();
    const langLabel = language === 'pt' ? 'Português' : 'Inglês';
    const isInfantil = topic.toLowerCase().includes('infantil') || topic.toLowerCase().includes('criança') || topic.toLowerCase().includes('kids');
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analise as tendências ATUAIS (hoje) no YouTube e redes sociais sobre o tema: ${topic}. 
      Gere 5 ideias virais para um canal de YouTube ${isInfantil ? '"Infantil"' : '"Dark" (sem rosto)'}.
      O conteúdo deve ser gerado inteiramente em ${langLabel}.
      As ideias devem ser focadas em alta taxa de clique (CTR) e retenção. 
      ${isInfantil ? 'As histórias devem ser educativas, lúdicas ou contos de fadas modernos.' : 'Aproveite fatos reais ou mistérios que estão em alta agora.'}
      
      Retorne APENAS um JSON seguindo este esquema:
      {
        "ideas": [
          {
            "title": "Título chamativo",
            "hook": "O gancho inicial impactante",
            "potential": 95, // potencial de 1 a 100
            "description": "Breve descrição do porquê ser viral"
          }
        ]
      }`,
      tools: [{ googleSearch: {} }] as any,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ideas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  hook: { type: Type.STRING },
                  potential: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                },
                required: ["title", "hook", "potential", "description"]
              }
            }
          },
          required: ["ideas"]
        }
      }
    } as any);

    const data = JSON.parse(response.text || '{"ideas": []}');
    return data.ideas;
  },

  async translateProject(project: any, targetLang: 'English' | 'Spanish'): Promise<any> {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Traduza todo o conteúdo deste projeto de vídeo para ${targetLang}. 
      Mantenha o tom impactante e as nuances "Dark".
      Traduza: Título, Roteiro (seções e texto completo), Sugestões de Thumbnail e as Cenas (descrições e emoções).
      
      RETORNE APENAS O JSON NO MESMO FORMATO ORIGINAL.
      
      Original: ${JSON.stringify(project)}`,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || '{}');
  },

  async generateScript(idea: VideoIdea, duration: string, style: string, language: 'pt' | 'en' = 'pt'): Promise<VideoScript> {
    const ai = getAI();
    const langLabel = language === 'pt' ? 'Português' : 'Inglês';
    const isInfantil = style.toLowerCase().includes('infantil') || style.toLowerCase().includes('kids');
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview", // Use pro for better storytelling
      contents: `Escreva um roteiro completo de vídeo ${isInfantil ? 'Infantil / Lúdico' : 'Dark'} para YouTube.
      Tema: ${idea.title}
      Duração estimada: ${duration}
      Estilo: ${style}
      Língua do Roteiro: ${langLabel}
      
      O roteiro deve estar inteiramente em ${langLabel}.
      O roteiro deve ter as seções: ${isInfantil ? 'Introdução, Aventura Principal, Lição de Moral/Clímax e Despedida/CTA' : 'Hook, Introdução, Desenvolvimento, Clímax e CTA'}.
      O tom deve ser ${isInfantil ? 'doces, educativo, calmo ou animado (dependendo do tema)' : 'envolvente e adequado ao estilo solicitado'}.
      
      IMPORTANTE: O roteiro deve ter conteúdo suficiente para cobrir ${duration} de narração (estimadamente 130-150 palavras por minuto).
      
      Também sugira 2 prompts de alta performance para a THUMBNAIL do vídeo seguindo estas diretrizes estruturais, mas ADAPTANDO TOTALMENTE ao tema específico do vídeo:
      - Estilo: ${isInfantil ? 'Colorido, estilo Disney/Pixar ou ilustração de livro infantil, vibrante' : 'Ultra-cinematic, high CTR, estética impactante (ex: conspiratória, histórica ou mistério dependendo do tema)'}.
      - Composição: Foco principal em um objeto ou símbolo dominante e icônico do tema no primeiro plano. Um elemento surreal, proibido ou revelador em segundo plano. Silhueta ou ambiente contextual ao fundo para criar atmosfera.
      - Tipografia de Thumb: Crie títulos de impacto (clickbait de alta qualidade) relacionados ao vídeo. Texto grande, negrito e agressivo. Use cores vibrantes (amarelo/branco) com sombras fortes e brilhos.
      - Elementos de Retenção: Adicione setas ou círculos vermelhos indicando detalhes "escondidos" ou curiosos da imagem, acompanhados de labels curtos e instigantes.
      - Arte: Hyper-realistic, cinematic lighting, 8K detail.
      
      IMPORTANTE: Se o tema for sobre "Egipto", não use smartphones. Se for "Finanças", use elementos de riqueza/crise. A thumbnail deve CLARAMENTE representar o conteúdo do roteiro gerado.
      
      Retorne um JSON com:
      {
        "title": "Título final do vídeo",
        "sections": [
          { "type": "hook", "content": "texto..." },
          ...
        ],
        "fullText": "O roteiro completo compilado",
        "thumbnailSuggestions": ["Prompt thumbnail 1...", "Prompt thumbnail 2..."]
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ["hook", "introduction", "development", "climax", "cta"] },
                  content: { type: Type.STRING }
                },
                required: ["type", "content"]
              }
            },
            fullText: { type: Type.STRING },
            thumbnailSuggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "sections", "fullText", "thumbnailSuggestions"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  },

  async buildScenes(script: VideoScript, duration: string, language: 'pt' | 'en' = 'pt'): Promise<VideoScene[]> {
    const ai = getAI();
    const langLabel = language === 'pt' ? 'Português' : 'Inglês';
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Divida o seguinte roteiro em cenas visuais detalhadas para um vídeo de ${duration}.
      Roteiro: ${script.fullText}
      Língua de Saída: ${langLabel} (descrições e emoções devem estar em ${langLabel}).
      
      CRÍTICO: Você deve distribuir as cenas por TODO o tempo de ${duration}. 
      Se o vídeo for de 20 minutos, a última cena deve terminar exatamente em 20:00.
      Não pare em 3 minutos se o vídeo for de 20.
      
      Cada cena deve ter um intervalo de tempo (ex: 0:00-0:15, 0:15-0:45...), uma descrição visual detalhada e a emoção predominante.
      
      Retorne um JSON com:
      {
        "scenes": [
          {
            "id": "1",
            "timeRange": "0:00-0:15",
            "description": "Descrição da imagem/vídeo",
            "emotion": "suspense/curiosiade"
          }
        ]
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  timeRange: { type: Type.STRING },
                  description: { type: Type.STRING },
                  emotion: { type: Type.STRING }
                },
                required: ["id", "timeRange", "description", "emotion"]
              }
            }
          },
          required: ["scenes"]
        }
      }
    });

    const data = JSON.parse(response.text || '{"scenes": []}');
    return data.scenes;
  },

  async synthesizeVoice(text: string, voiceName: 'Kore' | 'Fenrir' | 'Zephyr' | 'Charon' = 'Kore'): Promise<string> {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Diga com tom narrativo envolvente e adequado ao conteúdo: ${text}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Falha na síntese de voz");
    
    return `data:audio/wav;base64,${base64Audio}`;
  },

  async generateVisualPrompts(scenes: VideoScene[], style: string, characterPrompt?: string): Promise<VideoScene[]> {
    const ai = getAI();
    const isInfantil = style.toLowerCase().includes('infantil') || style.toLowerCase().includes('kids');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Crie prompts cinematográficos de alta qualidade para geração de imagens por IA (Midjourney/Leonardo) para as seguintes cenas.
      Estilo visual base: ${style}.
      ${characterPrompt ? `PERSONAGEM PRINCIPAL (PROTAGONISTA): ${characterPrompt}. Certifique-se de que este personagem apareça de forma consistente em todas as cenas onde for relevante.` : ''}
      Diretriz Visual: ${isInfantil ? 'Ilustração digital colorida, estilo Disney/Pixar, amigável, vibrante, luz mágica, traços suaves, 4k.' : 'Estética Dark, iluminação dramática, texturas detalhadas, 8k, cinematográfico.'}
      
      Cenas: ${JSON.stringify(scenes)}
      
      Cada prompt deve ser em INGLÊS, ultra detalhado, mencionando iluminação, câmera e o estilo solicitado.
      Retorne o array de cenas atualizado com o campo "imagePrompt".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  timeRange: { type: Type.STRING },
                  description: { type: Type.STRING },
                  emotion: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING }
                },
                required: ["id", "imagePrompt"]
              }
            }
          },
          required: ["scenes"]
        }
      }
    });

    const updatedScenesRaw = JSON.parse(response.text || '{"scenes": []}').scenes;
    
    // Merge back
    return scenes.map(s => {
      const updated = updatedScenesRaw.find((u: any) => u.id === s.id);
      return updated ? { ...s, imagePrompt: updated.imagePrompt } : s;
    });
  },

  async extractShorts(script: VideoScript, language: 'pt' | 'en' = 'pt'): Promise<any[]> {
    const ai = getAI();
    const langLabel = language === 'pt' ? 'Português' : 'Inglês';
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analise o seguinte roteiro de vídeo longo e extraia os 3 melhores momentos (ganchos/curiosidades) para criar roteiros de Shorts/TikTok de 60 segundos.
      Cada Short deve ser autossuficiente, impactante e focado em retenção desde o primeiro segundo.
      
      Roteiro Original: ${script.fullText}
      Língua de Saída: ${langLabel}
      
      Retorne um JSON com:
      {
        "shorts": [
          {
            "id": "1",
            "title": "Título do Short",
            "hook": "O gancho inicial ultra-impactante",
            "content": "O roteiro condensado para 60 segundos"
          }
        ]
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shorts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  hook: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ["id", "title", "hook", "content"]
              }
            }
          },
          required: ["shorts"]
        }
      }
    });

    const data = JSON.parse(response.text || '{"shorts": []}');
    return data.shorts;
  },

  async regenerateScenePrompt(scene: VideoScene, style: string): Promise<string> {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Melhore e reescreva este prompt de imagem para ser mais impactante e cinematográfico.
      Estilo: ${style}
      Cena Original: ${scene.description}
      Emoção: ${scene.emotion}
      
      Prompt Atual: ${scene.imagePrompt || 'N/A'}
      
      Retorne APENAS o novo prompt em INGLÊS, ultra-detalhado.`,
    });

    return response.text?.trim() || scene.imagePrompt || "";
  }
};
