import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Search, 
  FileText, 
  Image as ImageIcon, 
  Clapperboard, 
  ChevronRight, 
  RotateCcw, 
  Loader2, 
  CheckCircle2, 
  Play, 
  History,
  Settings,
  Flame,
  Wand2,
  Trash2,
  Download,
  Volume2,
  Plus,
  X,
  Globe,
  Languages,
  Save,
  Clock,
  Scissors,
  MonitorPlay,
  Film,
  Video,
  VideoOff,
  Upload,
  Layers,
  Captions,
  Copy
} from 'lucide-react';
import { geminiService } from './services/geminiService';
import { VideoIdea, VideoScript, VideoScene, DarkFlowState } from './types';
import { supabase } from './lib/supabase';

const INITIAL_FLOW_STATE = (id: string): DarkFlowState => ({
  id,
  topic: '',
  duration: '8 minutos',
  style: 'Dark Cinematográfico (Mistério/Suspense)',
  characterPrompt: '',
  ideas: [],
  selectedIdea: null,
  script: null,
  shortScripts: [],
  scenes: [],
  language: undefined,
  status: 'idle',
  error: null,
});

export default function App() {
  const [workspaces, setWorkspaces] = useState<DarkFlowState[]>([INITIAL_FLOW_STATE('tab-default')]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('tab-default');
  const [activeTab, setActiveTab] = useState<'flow' | 'batch' | 'settings' | 'srt' | 'studio'>('flow');
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [srtForStudio, setSrtForStudio] = useState<string>('');
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [fontSize, setFontSize] = useState(24);
  const [subtitleColor, setSubtitleColor] = useState('#C5A059');
  const [subtitleY, setSubtitleY] = useState(80); // percentage from top
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [refreshingScene, setRefreshingScene] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [savedProjects, setSavedProjects] = useState<DarkFlowState[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<'Kore' | 'Fenrir' | 'Zephyr' | 'Charon'>('Kore');
  const [makeWebhookUrl, setMakeWebhookUrl] = useState<string>(() => localStorage.getItem('GHOST_MAKE_WEBHOOK') || '');
  const [isSendingToMake, setIsSendingToMake] = useState(false);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  useEffect(() => {
    localStorage.setItem('GHOST_MAKE_WEBHOOK', makeWebhookUrl);
  }, [makeWebhookUrl]);

  const sendToMake = async () => {
    if (!makeWebhookUrl || !activeWorkspace.script) return;
    setIsSendingToMake(true);
    try {
      const response = await fetch(makeWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'GhostStudio AI',
          project: {
            id: activeWorkspace.id,
            topic: activeWorkspace.topic,
            idea: activeWorkspace.selectedIdea,
            script: activeWorkspace.script,
            scenes: activeWorkspace.scenes,
            style: activeWorkspace.style,
            duration: activeWorkspace.duration,
            timestamp: new Date().toISOString()
          }
        })
      });
      if (response.ok) {
        alert('Dados enviados para o Make.com com sucesso!');
      } else {
        throw new Error('Falha no Webhook do Make.com');
      }
    } catch (err) {
      console.error("Make.com Error:", err);
      alert('Erro ao enviar dados para o Make.com. Verifique a URL do Webhook.');
    } finally {
      setIsSendingToMake(false);
    }
  };

  const updateActiveWorkspace = (updates: Partial<DarkFlowState>) => {
    setWorkspaces(prev => prev.map(w => w.id === activeWorkspaceId ? { ...w, ...updates } : w));
  };

  // Supabase Persistence
  const saveToSupabase = useCallback(async (ws: DarkFlowState) => {
    if (!supabase || ws.status === 'idle' && !ws.topic) return;
    
    try {
      const { error } = await supabase
        .from('workspaces')
        .upsert({
          id: ws.id,
          topic: ws.topic,
          duration: ws.duration,
          style: ws.style,
          ideas: ws.ideas,
          selected_idea: ws.selectedIdea,
          script: ws.script,
          short_scripts: ws.shortScripts,
          scenes: ws.scenes,
          status: ws.status,
          language: ws.language,
          character_prompt: ws.characterPrompt,
          error: ws.error,
          updated_at: new Date().toISOString()
        });

      if (error) console.error("Supabase Save Error:", error);
    } catch (err) {
      console.error("Failed to sync with Supabase", err);
    }
  }, []);

  // Auto-save active workspace when it changes significantly
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (activeWorkspace.status !== 'idle' || activeWorkspace.topic) {
        saveToSupabase(activeWorkspace);
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [activeWorkspace, saveToSupabase]);

  // Load history
  const loadHistory = useCallback(async () => {
    if (!supabase) return;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (data) {
        const mappedData: DarkFlowState[] = data.map(item => ({
          id: item.id,
          topic: item.topic,
          duration: item.duration,
          style: item.style,
          ideas: item.ideas || [],
          selectedIdea: item.selected_idea,
          script: item.script,
          shortScripts: item.short_scripts || [],
          scenes: item.scenes || [],
          language: item.language,
          characterPrompt: item.character_prompt || '',
          status: item.status,
          error: item.error
        }));
        setSavedProjects(mappedData);
      }
    } catch (err) {
      console.error("Load History Error:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'batch') loadHistory();
  }, [activeTab, loadHistory]);

  const restoreProject = (project: DarkFlowState) => {
    const existing = workspaces.find(w => w.id === project.id);
    if (!existing) {
      setWorkspaces(prev => [...prev, project]);
    }
    setActiveWorkspaceId(project.id);
    setActiveTab('flow');
  };

  const createNewWorkspace = () => {
    const newId = `tab-${Math.random().toString(36).substr(2, 9)}`;
    const newWorkspace = INITIAL_FLOW_STATE(newId);
    setWorkspaces(prev => [...prev, newWorkspace]);
    setActiveWorkspaceId(newId);
    setActiveTab('flow');
  };

  const closeWorkspace = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (workspaces.length === 1) return;
    const newWorkspaces = workspaces.filter(w => w.id !== id);
    setWorkspaces(newWorkspaces);
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(newWorkspaces[newWorkspaces.length - 1].id);
    }
  };

  const handleTranslate = async (lang: 'English' | 'Spanish') => {
    if (!activeWorkspace.script) return;
    setIsTranslating(true);
    try {
      const translated = await geminiService.translateProject(activeWorkspace, lang);
      updateActiveWorkspace({
        ...translated,
        id: activeWorkspaceId // preserve ID
      });
      alert(`Projeto traduzido para ${lang}!`);
    } catch (err) {
      console.error("Translation failed", err);
      alert("Falha na tradução. Tente novamente.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRegenerateScene = async (sceneId: string) => {
    const scene = activeWorkspace.scenes.find(s => s.id === sceneId);
    if (!scene) return;
    
    setRefreshingScene(sceneId);
    try {
      const newPrompt = await geminiService.regenerateScenePrompt(scene, activeWorkspace.style);
      const updatedScenes = activeWorkspace.scenes.map(s => 
        s.id === sceneId ? { ...s, imagePrompt: newPrompt } : s
      );
      updateActiveWorkspace({ scenes: updatedScenes });
    } catch (err) {
      console.error("Failed to refresh scene", err);
    } finally {
      setRefreshingScene(null);
    }
  };

  const copySEO = () => {
    if (!activeWorkspace.script) return;
    const content = `
TITLE: ${activeWorkspace.script.title}
SEO KEYWORDS: ${activeWorkspace.topic}, viral dark, ${activeWorkspace.style}, documentary, mysteries
DESCRIPTION: Explore the deep secrets of ${activeWorkspace.topic}. A journey into the unknown.
    `;
    navigator.clipboard.writeText(content);
    alert('SEO Suite copiado!');
  };

  const synthesize = async () => {
    if (!activeWorkspace.script) return;
    setIsSynthesizing(true);
    try {
      const url = await geminiService.synthesizeVoice(activeWorkspace.script.fullText, selectedVoice);
      setAudioUrl(url);
    } catch (err) {
      updateActiveWorkspace({ error: "Falha na síntese de áudio. Verifique sua cota ou chave API." });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const copyAll = () => {
    const content = `
TÍTULO: ${activeWorkspace.script?.title}

ROTEIRO COMPLETO:
${activeWorkspace.script?.fullText}

CENAS E PROMPTS:
${activeWorkspace.scenes.map(s => `[${s.timeRange}] ${s.description}\nPROMPT: ${s.imagePrompt}\n`).join('\n')}

💡 SUGESTÕES DE THUMBNAIL:
${activeWorkspace.script?.thumbnailSuggestions.map((t, i) => `${i + 1}. ${t}`).join('\n')}
    `;
    navigator.clipboard.writeText(content);
    alert('Pack completo copiado para a área de transferência!');
  };

  const parseSRT = (content: string) => {
    if (!content) return [];
    const segments = content.split('\n\n').filter(s => s.trim().length > 0);
    return segments.map(segment => {
      const lines = segment.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 3) return null;
      
      const timeLine = lines[1];
      const match = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
      
      if (!match) return null;
      
      const toSeconds = (timeStr: string) => {
        const [h, m, sWithMs] = timeStr.split(':');
        const [s, ms] = sWithMs.split(',');
        return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
      };
      
      return {
        start: toSeconds(match[1]),
        end: toSeconds(match[2]),
        text: lines.slice(2).join('\n')
      };
    }).filter(Boolean) as { start: number, end: number, text: string }[];
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedVideo(url);
    }
  };

  const exportVideoWithSubtitles = async () => {
    if (!videoRef || !uploadedVideo) return;
    setIsExportingVideo(true);
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoRef.videoWidth;
      canvas.height = videoRef.videoHeight;
      
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'GhostStudio_Final_Video.webm';
        link.click();
        setIsExportingVideo(false);
      };

      const subtitles = parseSRT(srtForStudio || srtOutput || generateProjectSRT());
      
      videoRef.currentTime = 0;
      recorder.start();
      
      await videoRef.play();
      
      const renderFrame = () => {
        if (videoRef.paused || videoRef.ended) {
          recorder.stop();
          return;
        }
        
        ctx.drawImage(videoRef, 0, 0, canvas.width, canvas.height);
        
        const currentSub = subtitles.find(s => videoRef.currentTime >= s.start && videoRef.currentTime <= s.end);
        
        if (currentSub) {
          ctx.font = `bold ${fontSize * (canvas.width / 1280)}px Inter`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          
          // Shadow
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 10;
          ctx.fillStyle = subtitleColor;
          
          const lines = currentSub.text.split('\n');
          lines.forEach((line, i) => {
            ctx.fillText(
              line, 
              canvas.width / 2, 
              (canvas.height * subtitleY / 100) + (i * fontSize * 1.5)
            );
          });
        }
        
        requestAnimationFrame(renderFrame);
      };
      
      renderFrame();
    } catch (err) {
      console.error("Export failed", err);
      setIsExportingVideo(false);
      alert("Erro ao exportar vídeo. Tente usar um vídeo mais curto ou outro navegador.");
    }
  };

  const [srtInput, setSrtInput] = useState('');
  const [srtOutput, setSrtOutput] = useState('');
  const [wordsPerSecond, setWordsPerSecond] = useState(2.5);
  const [wordsPerSegment, setWordsPerSegment] = useState(7);

  const generateProjectSRT = () => {
    if (!activeWorkspace.scenes.length) return '';
    
    const formatTime = (totalSeconds: number) => {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = Math.floor(totalSeconds % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},000`;
    };

    const srt = activeWorkspace.scenes.map((scene, index) => {
      const [startStr, endStr] = scene.timeRange.split(' - ');
      const [sm, ss] = startStr.split(':').map(Number);
      const [em, es] = endStr.split(':').map(Number);
      const startSec = (sm || 0) * 60 + (ss || 0);
      const endSec = (em || 0) * 60 + (es || 0);

      return `${index + 1}\n${formatTime(startSec)} --> ${formatTime(endSec)}\n${scene.description}\n`;
    }).join('\n');

    return srt;
  };

  const downloadSRTFile = (content: string, filename: string = 'GhostStudio_Subtitles.srt') => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const deconstructText = () => {
    if (!srtInput) return;
    const allWords = srtInput.split(/\s+/).filter(w => w.length > 0);
    const segments: string[] = [];
    for (let i = 0; i < allWords.length; i += wordsPerSegment) {
      segments.push(allWords.slice(i, i + wordsPerSegment).join(' '));
    }
    setSrtInput(segments.join('\n\n'));
  };

  const convertTextToSRT = () => {
    if (!srtInput) return;
    
    // Split by words first if user wants to "separate"
    const allWords = srtInput.split(/\s+/).filter(w => w.length > 0);
    const segments: string[] = [];
    
    for (let i = 0; i < allWords.length; i += wordsPerSegment) {
      segments.push(allWords.slice(i, i + wordsPerSegment).join(' '));
    }

    let currentTime = 0;
    
    const formatTime = (totalSeconds: number) => {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = Math.floor(totalSeconds % 60);
      const ms = Math.floor((totalSeconds % 1) * 1000);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    };

    const srt = segments.map((text, idx) => {
      const wordCount = text.split(/\s+/).length;
      const duration = wordCount / wordsPerSecond;
      const start = currentTime;
      const end = currentTime + duration;
      
      currentTime = end;
      
      return `${idx + 1}\n${formatTime(start)} --> ${formatTime(end)}\n${text}\n`;
    }).join('\n');

    setSrtOutput(srt);
  };

  const exportProject = () => {
    if (!activeWorkspace.selectedIdea || !activeWorkspace.script) return;

    const content = `
=========================================
GHOSTSTUDIO AI - EXPORTAÇÃO DE PROJETO
=========================================

🧠 1. VISUAL DO PROJETO (IDEIA)
-----------------------------------------
TÍTULO: ${activeWorkspace.selectedIdea.title}
GANCHO: ${activeWorkspace.selectedIdea.hook}
POTENCIAL: ${activeWorkspace.selectedIdea.potential}%
DESCRIÇÃO: ${activeWorkspace.selectedIdea.description}
DURAÇÃO ALVO: ${activeWorkspace.duration}
ESTILO: ${activeWorkspace.style}

✍️ 2. SCRIPT ENGINE (ROTEIRO)
-----------------------------------------
${activeWorkspace.script.sections.map(s => `[${s.type.toUpperCase()}]\n${s.content}\n`).join('\n')}

🎬 3. SCENE BUILDER + VISUAL DIRECTOR
-----------------------------------------
${activeWorkspace.scenes.map(s => `TEMPO: ${s.timeRange}\nEMOÇÃO: ${s.emotion}\nDESCRIÇÃO: ${s.description}\nPROMPT: ${s.imagePrompt}\n-----------------------------------------`).join('\n\n')}

🖼️ 4. THUMBNAIL ORCHESTRATION
-----------------------------------------
${activeWorkspace.script.thumbnailSuggestions.map((t, i) => `SUGESTÃO ${i + 1}:\n${t}`).join('\n\n')}

=========================================
GERADO EM: ${new Date().toLocaleString()}
=========================================
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GhostStudio_${activeWorkspace.selectedIdea.title.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const startTrendHunter = async () => {
    if (!activeWorkspace.topic) return;
    updateActiveWorkspace({ status: 'searching_ideas', error: null, ideas: [], script: null, scenes: [] });
    try {
      const ideas = await geminiService.searchIdeas(activeWorkspace.topic, activeWorkspace.language || 'pt');
      updateActiveWorkspace({ ideas, status: 'idle' });
    } catch (err: any) {
      updateActiveWorkspace({ status: 'idle', error: "Falha ao buscar ideias. Verifique sua conexão ou chave API." });
    }
  };

  const handleSelectIdea = async (idea: VideoIdea) => {
    updateActiveWorkspace({ selectedIdea: idea, status: 'generating_script' });
    try {
      const script = await geminiService.generateScript(idea, activeWorkspace.duration, activeWorkspace.style, activeWorkspace.language || 'pt');
      updateActiveWorkspace({ script, status: 'building_scenes' });
      
      const scenes = await geminiService.buildScenes(script, activeWorkspace.duration, activeWorkspace.language || 'pt');
      updateActiveWorkspace({ scenes, status: 'creating_prompts' });
      
      const updatedScenes = await geminiService.generateVisualPrompts(scenes, activeWorkspace.style, activeWorkspace.characterPrompt);
      updateActiveWorkspace({ scenes: updatedScenes, status: 'completed' });
    } catch (err: any) {
      updateActiveWorkspace({ status: 'idle', error: "Erro no processamento do fluxo. Tente novamente." });
    }
  };

  const generateShorts = async () => {
    if (!activeWorkspace.script) return;
    updateActiveWorkspace({ status: 'generating_script' }); // Re-use status for loading state
    try {
      const shortScripts = await geminiService.extractShorts(activeWorkspace.script, activeWorkspace.language || 'pt');
      updateActiveWorkspace({ shortScripts, status: 'completed' });
    } catch (err: any) {
      updateActiveWorkspace({ status: 'completed', error: "Falha ao extrair Shorts." });
    }
  };

  const resetFlow = () => {
    updateActiveWorkspace(INITIAL_FLOW_STATE(activeWorkspaceId));
  };

  const renderStatus = () => {
    const steps = [
      { id: 'searching_ideas', label: 'Trend Hunter', icon: Search },
      { id: 'generating_script', label: 'Script Engine', icon: FileText },
      { id: 'building_scenes', label: 'Scene Builder', icon: Clapperboard },
      { id: 'creating_prompts', label: 'Visual AI', icon: ImageIcon },
    ];

    const activeIndex = steps.findIndex(s => s.id === activeWorkspace.status);

    return (
      <div className="flex items-center gap-4 mb-8 overflow-x-auto pb-4 no-scrollbar">
        {steps.map((step, idx) => {
          const isActive = activeWorkspace.status === step.id;
          const isCompleted = activeIndex === -1 && activeWorkspace.status !== 'idle' ? true : idx < activeIndex;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center gap-2 flex-shrink-0">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-300
                ${isActive ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 
                  isCompleted ? 'bg-green-500/20 text-green-400 border-green-500/40' : 
                  'bg-white/5 text-white/40 border-white/10'}
              `}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white/40'}`}>
                {step.label}
              </span>
              {idx < steps.length - 1 && <ChevronRight className="w-4 h-4 text-white/20" />}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen studio-bg text-white/90 selection:bg-[#C5A059]/30">
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 bottom-0 w-24 border-r border-[#8B0000]/20 flex flex-col items-center py-8 gap-10 bg-black/80 backdrop-blur-3xl z-50">
        <div className="flex items-center justify-center w-12 h-12 bg-[#8B0000] rounded-2xl shadow-[0_0_20px_rgba(139,0,0,0.5)] gold-glow transform rotate-3 hover:rotate-0 transition-transform cursor-pointer">
          <Zap className="text-white w-7 h-7 fill-current" />
        </div>
        
        <div className="flex flex-col gap-8">
          <button 
            onClick={() => setActiveTab('flow')}
            className={`p-4 rounded-2xl transition-all duration-500 scale-100 active:scale-90 ${activeTab === 'flow' ? 'nav-item-active' : 'text-white/40 hover:text-[#C5A059]/80 bg-white/5'}`}
            title="Fluxo de Produção"
          >
            <Flame className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('batch')}
            className={`p-4 rounded-2xl transition-all duration-500 scale-100 active:scale-90 ${activeTab === 'batch' ? 'nav-item-active-red' : 'text-white/40 hover:text-[#8B0000]/80 bg-white/5'}`}
            title="Histórico"
          >
            <History className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`p-4 rounded-2xl transition-all duration-500 scale-100 active:scale-90 ${activeTab === 'settings' ? 'nav-item-active' : 'text-white/40 hover:text-[#C5A059]/80 bg-white/5'}`}
            title="Configurações"
          >
            <Settings className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('srt')}
            className={`p-4 rounded-2xl transition-all duration-500 scale-100 active:scale-90 ${activeTab === 'srt' ? 'nav-item-active' : 'text-white/40 hover:text-[#C5A059]/80 bg-white/5'}`}
            title="Conversor de SRT"
          >
            <Captions className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('studio')}
            className={`p-4 rounded-2xl transition-all duration-500 scale-100 active:scale-90 ${activeTab === 'studio' ? 'nav-item-active' : 'text-white/40 hover:text-[#C5A059]/80 bg-white/5'}`}
            title="Overlay Studio"
          >
            <MonitorPlay className="w-6 h-6" />
          </button>
        </div>

        <div className="mt-auto space-y-4">
           <div className="w-1.5 h-1.5 rounded-full bg-[#8B0000] animate-pulse mx-auto" />
           <div className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse mx-auto delay-75" />
        </div>
      </nav>

      <main className="pl-24 h-screen flex flex-col w-full overflow-hidden">
        {/* Workspace Tab Bar */}
        <div className="bg-black/40 border-b border-white/5 px-8 pt-4 flex items-end gap-2 overflow-x-auto no-scrollbar min-h-[64px] flex-shrink-0">
           {workspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => {
                  setActiveWorkspaceId(ws.id);
                  setActiveTab('flow');
                }}
                className={`
                  group px-6 py-3 rounded-t-2xl flex items-center gap-4 cursor-pointer transition-all border-t border-x border-transparent
                  ${activeWorkspaceId === ws.id && activeTab === 'flow' ? 'bg-[#1a1a1a] border-white/10 !border-t-[#C5A059] text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/10'}
                `}
              >
                 <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                    {ws.topic || ws.selectedIdea?.title || 'Novo Orquestrador'}
                 </span>
                 <X 
                  className="w-3 h-3 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" 
                  onClick={(e) => closeWorkspace(ws.id, e)}
                 />
              </div>
           ))}
           <button 
            onClick={createNewWorkspace}
            className="px-4 py-3 text-white/20 hover:text-[#C5A059] transition-all mb-1"
           >
              <Plus className="w-5 h-5" />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto px-10 py-12 custom-scroll">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <header className="mb-12 flex justify-between items-start">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <h1 className="text-5xl font-black tracking-tighter text-white mb-2 uppercase italic flex items-center gap-3">
                  <span className="text-gold">Ghost</span>
                  <span className="text-[#8B0000]">Studio</span>
                  <span className="text-white/70 not-italic font-light">AI</span>
                </h1>
                <div className="flex items-center gap-3">
                  <div className="h-[1px] w-12 bg-[#C5A059]/50" />
                  <p className="text-[#C5A059]/90 font-mono text-xs uppercase tracking-[0.3em]">Advanced Dark Orchestrator</p>
                </div>
              </motion.div>
              
              <AnimatePresence>
                 {activeWorkspace.status === 'completed' && (
                    <motion.button 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={resetFlow}
                      className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-black border-2 border-[#8B0000] text-white hover:bg-[#8B0000]/10 transition-all font-bold text-sm shadow-[4px_4px_0px_#8B0000] hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-0 active:translate-y-0 active:shadow-none"
                    >
                      <RotateCcw className="w-4 h-4" />
                      REINICIAR ENGINE
                    </motion.button>
                 )}
              </AnimatePresence>
            </header>

            {activeWorkspace.error && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mb-10 p-5 bg-[#8B0000]/10 border border-[#8B0000]/30 text-white rounded-2xl flex items-center gap-4 overflow-hidden"
              >
                <Trash2 className="w-6 h-6 text-[#8B0000]" />
                <div className="flex-1">
                  <p className="font-bold text-sm uppercase tracking-wider">System Failure</p>
                  <p className="text-xs text-white/60">{activeWorkspace.error}</p>
                </div>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {activeTab === 'flow' ? (
                <motion.div
                  key={activeWorkspaceId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Input Controls */}
                  <section className="glass-card gold-border gold-glow mb-12 p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                      <div className="lg:col-span-12 xl:col-span-5 space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C5A059]/90 flex items-center gap-3">
                          <span className="w-8 h-[1px] bg-[#C5A059]/30" /> Tema da Produção
                        </label>
                        <input 
                          type="text" 
                          placeholder="MISTÉRIOS OBSCUROS OU CASOS REAIS..."
                          className="w-full bg-black/40 border-2 border-white/10 focus:border-[#C5A059]/40 rounded-2xl px-6 py-5 focus:outline-none focus:ring-4 focus:ring-[#C5A059]/5 transition-all font-bold text-xl placeholder:text-white/30 text-gold"
                          value={activeWorkspace.topic}
                          onChange={(e) => updateActiveWorkspace({ topic: e.target.value })}
                          disabled={activeWorkspace.status !== 'idle' && activeWorkspace.status !== 'searching_ideas'}
                        />
                      </div>
                      
                      <div className="lg:col-span-6 xl:col-span-3 space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C5A059]/90 flex items-center gap-3">
                          <span className="w-8 h-[1px] bg-[#C5A059]/30" /> Escala Temporal
                        </label>
                        <div className="relative">
                          <select 
                            className="w-full bg-black/40 border-2 border-white/5 focus:border-[#C5A059]/40 rounded-2xl px-6 py-5 focus:outline-none transition-all font-bold appearance-none text-[#F5F5F5] cursor-pointer"
                            value={activeWorkspace.duration}
                            onChange={(e) => updateActiveWorkspace({ duration: e.target.value })}
                            disabled={activeWorkspace.status !== 'idle'}
                          >
                            <option value="3 minutos">⚡ 3 Minutos (Short)</option>
                            <option value="5 minutos">🎬 5 Minutos (Standard)</option>
                            <option value="8 minutos">💎 8 Minutos (Optimal)</option>
                            <option value="10 minutos">🔥 10 Minutos (Premium)</option>
                            <option value="15 minutos">📜 15 Minutos (Doc)</option>
                            <option value="20 minutos">🕋 20 Minutos (Deep)</option>
                            <option value="30 minutos">♾️ 30 Minutos (Master)</option>
                          </select>
                          <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C5A059] rotate-90 pointer-events-none" />
                        </div>
                      </div>

                      <div className="lg:col-span-6 xl:col-span-4 space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C5A059]/90 flex items-center gap-3">
                          <span className="w-8 h-[1px] bg-[#C5A059]/30" /> Direção Estética
                        </label>
                        <div className="relative">
                          <select 
                            className="w-full bg-black/40 border-2 border-white/5 focus:border-[#C5A059]/40 rounded-2xl px-6 py-5 focus:outline-none transition-all font-bold appearance-none text-[#F5F5F5] cursor-pointer"
                            value={activeWorkspace.style}
                            onChange={(e) => updateActiveWorkspace({ style: e.target.value })}
                            disabled={activeWorkspace.status !== 'idle'}
                          >
                            <option value="Dark Cinematográfico">Cinematográfico Sombrio</option>
                            <option value="True Crime">True Crime (Policial)</option>
                            <option value="Creepypasta">Creepypasta (Terror)</option>
                            <option value="História Infantil">Storytelling Infantil (Fábulas)</option>
                            <option value="Aventura Kids">Aventura Kids (Educativo)</option>
                            <option value="Espacial Dark">Espacial / Cósmico</option>
                            <option value="Motivacional Dark">Motivacional de Impacto</option>
                            <option value="Documentário Noir">Documentário Investigativo</option>
                            <option value="História Perdida">História Esquecida</option>
                          </select>
                          <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C5A059] rotate-90 pointer-events-none" />
                        </div>
                      </div>

                      <div className="lg:col-span-12 xl:col-span-12 mt-6">
                        <div className="flex flex-col gap-4">
                          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C5A059]/90 flex items-center gap-3">
                            <span className="w-8 h-[1px] bg-[#C5A059]/30" /> Diretor de Consistência (Protagonista)
                          </label>
                          <textarea 
                            placeholder="Descreva o personagem principal para manter a consistência visual (ex: Um detetive com sobretudo cinza e chapéu)..."
                            className="w-full bg-black/40 border-2 border-white/10 focus:border-[#C5A059]/40 rounded-2xl px-6 py-4 focus:outline-none transition-all font-medium text-sm placeholder:text-white/30 text-white min-h-[100px]"
                            value={activeWorkspace.characterPrompt || ''}
                            onChange={(e) => updateActiveWorkspace({ characterPrompt: e.target.value })}
                            disabled={activeWorkspace.status !== 'idle'}
                          />
                        </div>
                      </div>

                      <div className="lg:col-span-12 xl:col-span-12 mt-6">
                        <div className="flex flex-col gap-4">
                          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C5A059]/90 flex items-center gap-3">
                            <span className="w-8 h-[1px] bg-[#C5A059]/30" /> Idioma de Saída (Output Language)
                          </label>
                          <div className="flex gap-4">
                            <button 
                              onClick={() => updateActiveWorkspace({ language: 'pt' })}
                              className={`flex-1 py-4 rounded-2xl border-2 transition-all font-black text-sm flex items-center justify-center gap-3 ${activeWorkspace.language === 'pt' ? 'bg-[#C5A059] border-[#C5A059] text-black shadow-[0_0_20px_rgba(197,160,89,0.2)]' : 'bg-black/40 border-white/10 text-white/60 hover:border-white/30'}`}
                            >
                              <Globe className="w-5 h-5" /> PORTUGUÊS
                            </button>
                            <button 
                              onClick={() => updateActiveWorkspace({ language: 'en' })}
                              className={`flex-1 py-4 rounded-2xl border-2 transition-all font-black text-sm flex items-center justify-center gap-3 ${activeWorkspace.language === 'en' ? 'bg-[#C5A059] border-[#C5A059] text-black shadow-[0_0_20px_rgba(197,160,89,0.2)]' : 'bg-black/40 border-white/10 text-white/60 hover:border-white/30'}`}
                            >
                              <Globe className="w-5 h-5" /> ENGLISH
                            </button>
                          </div>
                          {!activeWorkspace.language && (
                            <p className="text-[10px] text-red-500 font-bold animate-pulse mt-2 uppercase tracking-widest text-center">
                              ⚠️ Selecione o idioma para ativar o Trend Hunter
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-10 flex items-center justify-between">
                      <p className="text-[10px] font-medium text-white/20 italic max-w-sm">
                        * Todos os conteúdos são orquestrados por modelos avançados de IA para máxima retenção e engajamento.
                      </p>
                      <button 
                        onClick={startTrendHunter}
                        disabled={!activeWorkspace.topic || activeWorkspace.status !== 'idle' || !activeWorkspace.language}
                        className={`
                          px-12 py-5 bg-[#C5A059] text-black rounded-2xl font-black text-lg flex items-center gap-4 transition-all
                          hover:scale-[1.03] active:scale-[0.97] shadow-[0_10px_40px_rgba(197,160,89,0.3)]
                          disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100 uppercase italic
                        `}
                      >
                        {activeWorkspace.status === 'searching_ideas' ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            HUNTING...
                          </>
                        ) : (
                          <>
                            <Search className="w-6 h-6 stroke-[3px]" />
                            START HUNT
                          </>
                        )}
                      </button>
                    </div>
                  </section>

                  {/* Dynamic Workflow View */}
                  <AnimatePresence mode="wait">
                    {activeWorkspace.ideas.length > 0 && !activeWorkspace.selectedIdea && (
                      <motion.section 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="space-y-8"
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                          <h2 className="text-2xl font-black italic flex items-center gap-4">
                            <Flame className="text-[#8B0000] w-7 h-7 fill-current" /> 
                            TRENDING BRAINSTORM
                          </h2>
                          <span className="text-[10px] font-bold text-[#C5A059] bg-[#C5A059]/10 px-4 py-1 rounded-full uppercase tracking-widest">{activeWorkspace.ideas.length} Insights Ativos</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                          {activeWorkspace.ideas.map((idea, idx) => (
                            <motion.div 
                              key={idx}
                              whileHover={{ y: -10 }}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className="bg-black/40 border-2 border-white/5 hover:border-[#C5A059]/30 p-8 rounded-3xl transition-all cursor-pointer group relative overflow-hidden flex flex-col h-full"
                              onClick={() => handleSelectIdea(idea)}
                            >
                              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                                 <Zap className="w-20 h-20 text-white" />
                              </div>
                              
                              <div className="relative z-10 flex-1">
                                <div className="flex justify-between items-center mb-6">
                                  <div className="px-4 py-1.5 bg-[#8B0000]/20 text-[#8B0000] rounded-xl text-[10px] font-black uppercase tracking-widest border border-[#8B0000]/20">
                                    Viral Score: {idea.potential}%
                                  </div>
                                  <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-[#C5A059] group-hover:border-transparent transition-all">
                                     <ChevronRight className="w-4 h-4 text-white group-hover:text-black" />
                                  </div>
                                </div>
                                <h3 className="text-2xl font-bold mb-4 leading-tight text-white group-hover:text-gold transition-colors">{idea.title}</h3>
                                <p className="text-sm text-white/40 leading-relaxed italic mb-6 border-l-2 border-[#8B0000]/40 pl-4 font-medium">"{idea.hook}"</p>
                              </div>
                              
                              <div className="pt-6 border-t border-white/5 relative z-10">
                                <p className="text-[11px] text-white/30 font-medium group-hover:text-white/60 transition-colors uppercase tracking-wider">{idea.description}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.section>
                    )}

                    {activeWorkspace.selectedIdea && (
                      <motion.div 
                        key="active-production"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-12"
                      >
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                          <div className="space-y-2">
                             <span className="text-[10px] font-black text-[#8B0000] uppercase tracking-[0.5em]">Active Orchestration</span>
                             <h2 className="text-4xl font-black italic text-white uppercase tracking-tight">{activeWorkspace.selectedIdea.title}</h2>
                          </div>
                          <div className="w-full md:w-auto">
                             {renderStatus()}
                          </div>
                        </div>

                        {activeWorkspace.script?.thumbnailSuggestions && (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                            <motion.section 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="lg:col-span-8 glass-card gold-border bg-black/60 p-10 space-y-8"
                            >
                              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                <div className="flex items-center gap-4">
                                  <ImageIcon className="w-8 h-8 text-[#C5A059]" />
                                  <div>
                                    <h3 className="text-xl font-black italic uppercase tracking-tight">Thumbnail Orchestration</h3>
                                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Geração de Diretivas para Miniaturas de Alto CTR</p>
                                  </div>
                                </div>
                                <div className="px-4 py-1.5 bg-[#C5A059]/10 text-gold rounded-full text-[10px] font-black uppercase tracking-widest border border-[#C5A059]/20 animate-pulse">
                                  Dynamic Layout Active
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {activeWorkspace.script.thumbnailSuggestions.map((thumb, idx) => (
                                  <div key={idx} className="bg-white/[0.03] border-2 border-white/5 rounded-[2rem] p-8 group hover:border-[#C5A059]/30 transition-all">
                                    <div className="flex justify-between items-center mb-6">
                                       <div className="flex items-center gap-3">
                                          <span className="text-[10px] font-black text-[#8B0000] uppercase tracking-[0.4em]">Opção {idx + 1}</span>
                                          <div className="w-1.5 h-1.5 rounded-full bg-red-600 shadow-[0_0_8px_#8B0000]" />
                                       </div>
                                       <button 
                                         onClick={() => {
                                           navigator.clipboard.writeText(thumb);
                                           alert('Prompt de Thumbnail copiado!');
                                         }}
                                         className="text-[10px] font-black text-[#C5A059] hover:text-white uppercase tracking-widest bg-white/5 px-4 py-1.5 rounded-xl border border-white/5 transition-all"
                                       >
                                         Copy Prompt
                                       </button>
                                    </div>
                                    <p className="text-sm text-white/80 leading-relaxed italic group-hover:text-white/95 transition-all">
                                      "{thumb}"
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </motion.section>

                            <motion.section 
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="lg:col-span-4 glass-card rust-border bg-[#890000]/5 p-10 space-y-8"
                            >
                              <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                                <Search className="w-8 h-8 text-[#8B0000]" />
                                <div>
                                  <h3 className="text-xl font-black italic uppercase tracking-tight">SEO Suite</h3>
                                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Metadados de Alta Performance</p>
                                </div>
                              </div>
                              
                              <div className="space-y-6">
                                 <div className="space-y-2">
                                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Título Sugerido</span>
                                    <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-sm font-bold text-white italic">
                                       {activeWorkspace.script.title}
                                    </div>
                                 </div>
                                 <div className="space-y-2">
                                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Tags Estratégicas</span>
                                    <div className="flex flex-wrap gap-2">
                                       {['Mystery', 'Documentary', 'AI Dark', 'Secrets', 'True Crime'].map(tag => (
                                          <span key={tag} className="px-3 py-1 bg-white/5 rounded-lg text-[10px] text-white/80 border border-white/10">#{tag}</span>
                                       ))}
                                    </div>
                                 </div>
                                 <button 
                                   onClick={copySEO}
                                   className="w-full py-4 bg-[#8B0000] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-[#A50000] transition-all"
                                 >
                                   Copiar Metadados Full
                                 </button>
                              </div>
                            </motion.section>
                          </div>
                        )}

                        {activeWorkspace.status !== 'idle' && activeWorkspace.status !== 'completed' && (
                          <div className="flex flex-col items-center justify-center py-32 bg-[#8B0000]/[0.02] rounded-3xl border border-[#8B0000]/20 border-dashed relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#8B0000]/5 animate-pulse" />
                            <Loader2 className="w-16 h-16 text-[#C5A059] animate-spin mb-8 relative z-10" />
                            <p className="text-[#C5A059] font-black text-xl italic uppercase tracking-[0.3em] text-center max-w-lg relative z-10">
                              {activeWorkspace.status === 'generating_script' && 'Architecting Master Script...'}
                              {activeWorkspace.status === 'building_scenes' && 'Deconstructing Visual Sequence...'}
                              {activeWorkspace.status === 'creating_prompts' && 'Forging AI Visual Directives...'}
                            </p>
                          </div>
                        )}

                        {activeWorkspace.script && (
                          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                            <div className="xl:col-span-12 lg:col-span-5 space-y-8">
                              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                <h3 className="text-lg font-black italic flex items-center gap-3 uppercase">
                                  <FileText className="w-6 h-6 text-[#8B0000]" /> SCRIPT ENGINE
                                </h3>
                                <span className="text-[10px] font-bold text-white/20 font-mono">MOD v2.5</span>
                              </div>
                              <div className="glass-card rust-border p-0 overflow-hidden bg-black/40">
                                <div className="max-h-[800px] overflow-y-auto p-8 space-y-10 custom-scroll">
                                  {activeWorkspace.script.sections.map((section, idx) => (
                                    <motion.div 
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: idx * 0.1 }}
                                      key={idx} 
                                      className="space-y-4 group"
                                    >
                                      <div className="flex items-center gap-4">
                                        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#8B0000] bg-[#8B0000]/10 px-3 py-1 rounded border border-[#8B0000]/10">
                                          {section.type}
                                        </span>
                                        <div className="h-[1px] flex-1 bg-white/5 group-hover:bg-[#8B0000]/20 transition-all" />
                                      </div>
                                      <p className="text-lg leading-relaxed text-white/80 group-hover:text-white transition-colors font-medium">
                                        {section.content}
                                      </p>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="xl:col-span-12 lg:col-span-7 space-y-8">
                              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                <h3 className="text-lg font-black italic flex items-center gap-3 uppercase">
                                  <Clapperboard className="w-6 h-6 text-[#C5A059]" /> VISUAL DIRECTOR
                                </h3>
                                <div className="flex flex-wrap gap-4 items-center">
                                  {activeWorkspace.status === 'completed' && (
                                     <>
                                      <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                                        <button 
                                          disabled={isTranslating}
                                          onClick={() => handleTranslate('English')}
                                          className="p-1 px-3 text-[9px] font-black hover:bg-white/10 rounded-lg transition-all flex items-center gap-2"
                                        >
                                          <Languages className="w-3 h-3 text-gold" /> EN
                                        </button>
                                        <button 
                                          disabled={isTranslating}
                                          onClick={() => handleTranslate('Spanish')}
                                          className="p-1 px-3 text-[9px] font-black hover:bg-white/10 rounded-lg transition-all flex items-center gap-2"
                                        >
                                          <Globe className="w-3 h-3 text-[#8B0000]" /> ES
                                        </button>
                                        {isTranslating && <Loader2 className="w-3 h-3 animate-spin mx-2" />}
                                      </div>

                                      <button 
                                        onClick={copySEO}
                                        className="flex items-center gap-3 px-5 py-2 bg-white/5 text-white/80 rounded-xl hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest border border-white/10"
                                        title="Copiar SEO Metadados"
                                      >
                                        <Search className="w-4 h-4" />
                                        SEO Builder
                                      </button>
                                      
                                      <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                                        <select 
                                          className="bg-transparent text-[9px] font-black uppercase tracking-widest focus:outline-none cursor-pointer px-2"
                                          value={selectedVoice}
                                          onChange={(e) => setSelectedVoice(e.target.value as any)}
                                        >
                                          <option value="Kore">Kore (Dark)</option>
                                          <option value="Fenrir">Fenrir (Deep)</option>
                                          <option value="Zephyr">Zephyr (Fast)</option>
                                          <option value="Charon">Charon (Old)</option>
                                        </select>
                                        <button 
                                          onClick={synthesize}
                                          disabled={isSynthesizing}
                                          className="flex items-center gap-3 px-5 py-2 bg-[#8B0000] text-white rounded-xl hover:bg-[#A50000] transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-30"
                                        >
                                          {isSynthesizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                                          Voice Engine
                                        </button>
                                      </div>

                                      <button 
                                        onClick={() => downloadSRTFile(generateProjectSRT(), `GhostStudio_${activeWorkspace.topic || 'Video'}.srt`)}
                                        className="flex items-center gap-3 px-5 py-2 bg-black/40 text-white rounded-xl border border-white/10 hover:bg-white/5 transition-all font-black text-[10px] uppercase tracking-widest"
                                        title="Baixar Projeto como SRT"
                                      >
                                        <Captions className="w-4 h-4 text-gold" />
                                        Baixar SRT
                                      </button>

                                      <button 
                                        onClick={exportProject}
                                        className="flex items-center gap-3 px-5 py-2 bg-[#C5A059] text-black rounded-xl border-2 border-transparent hover:bg-[#D5B069] transition-all font-black text-[10px] uppercase tracking-widest"
                                      >
                                        <Download className="w-4 h-4" />
                                        Export Pack
                                      </button>

                                      <button 
                                        onClick={generateShorts}
                                        className="flex items-center gap-3 px-5 py-2 bg-black/40 text-white rounded-xl border border-white/10 hover:bg-white/5 transition-all font-black text-[10px] uppercase tracking-widest"
                                      >
                                        <Scissors className="w-4 h-4 text-[#8B0000]" />
                                        Auto-Clipper
                                      </button>
                                       {makeWebhookUrl && (
                                         <button 
                                           onClick={sendToMake}
                                           disabled={isSendingToMake}
                                           className="flex items-center gap-3 px-5 py-2 bg-gradient-to-r from-[#6A1B9A] to-[#8E24AA] text-white rounded-xl hover:opacity-90 transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                                           title="Automate with Make.com"
                                         >
                                           {isSendingToMake ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-4 h-4" />}
                                           Make IT
                                         </button>
                                       )}
                                     </>
                                   )}
                                </div>
                              </div>

                              {audioUrl && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="bg-[#C5A059] p-5 rounded-3xl flex items-center gap-6 shadow-[0_10px_30px_rgba(197,160,89,0.3)]"
                                >
                                   <div className="w-12 h-12 bg-black/10 rounded-full flex items-center justify-center">
                                      <Volume2 className="w-6 h-6 text-black" />
                                   </div>
                                   <audio src={audioUrl} controls className="flex-1 h-10 brightness-90 contrast-125" />
                                </motion.div>
                              )}

                              {activeWorkspace.shortScripts && activeWorkspace.shortScripts.length > 0 && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
                                >
                                  {activeWorkspace.shortScripts.map((short, idx) => (
                                    <div key={idx} className="glass-card rust-border p-6 bg-black/60 relative overflow-hidden group">
                                      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
                                        <Scissors className="w-12 h-12 text-[#8B0000]" />
                                      </div>
                                      <div className="text-[10px] font-black text-[#8B0000] uppercase tracking-[0.3em] mb-3">Short / TikTok #{idx + 1}</div>
                                      <h4 className="text-sm font-bold text-white uppercase italic mb-4 line-clamp-1">{short.title}</h4>
                                      <div className="space-y-3">
                                        <p className="text-[11px] text-gold font-bold italic line-clamp-2 leading-relaxed">
                                          "{short.hook}"
                                        </p>
                                        <p className="text-[10px] text-white/40 line-clamp-4 leading-relaxed">
                                          {short.content}
                                        </p>
                                      </div>
                                      <div className="flex gap-2 mt-6">
                                        <button 
                                          onClick={() => {
                                            navigator.clipboard.writeText(`SHORT: ${short.title}\n\nHook: ${short.hook}\n\nRoteiro: ${short.content}`);
                                            alert('Roteiro do Short copiado!');
                                          }}
                                          className="flex-1 py-2 bg-white/5 hover:bg-[#8B0000]/20 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-white/5"
                                        >
                                          Copiar
                                        </button>
                                        <button 
                                          onClick={() => {
                                            const srt = `1\n00:00:00,000 --> 00:00:05,000\n${short.hook}\n\n2\n00:00:05,000 --> 00:00:15,000\n${short.content}`;
                                            downloadSRTFile(srt, `GhostStudio_Short_${idx + 1}.srt`);
                                          }}
                                          className="p-2 bg-white/5 hover:bg-gold/20 rounded-lg border border-white/5 text-white/40 hover:text-gold transition-all"
                                          title="Baixar SRT do Short"
                                        >
                                          <Captions className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </motion.div>
                              )}

                              <div className="space-y-6">
                                {activeWorkspace.scenes.map((scene, idx) => (
                                  <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.15 }}
                                    key={scene.id} 
                                    className="bg-black/40 border-2 border-white/5 p-8 rounded-[2rem] grid grid-cols-1 md:grid-cols-12 gap-10 group hover:border-[#C5A059]/20 transition-all hover:bg-black/60 gold-glow"
                                  >
                                    <div className="md:col-span-3">
                                      <div className="text-[10px] font-black mb-3 text-[#C5A059]/40 uppercase tracking-[0.4em]">Timecode</div>
                                      <div className="text-3xl font-black font-mono tracking-tighter text-gold italic">{scene.timeRange}</div>
                                      <div className="mt-4 flex items-center gap-2">
                                         <div className="w-2 h-2 rounded-full bg-[#8B0000] animate-pulse" />
                                         <span className="text-[10px] font-black text-white/40 uppercase">{scene.emotion}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="md:col-span-4 border-l border-white/5 pl-10">
                                      <div className="text-[10px] font-black mb-3 text-[#C5A059]/40 uppercase tracking-[0.4em]">Narrative</div>
                                      <p className="text-sm text-white/80 leading-relaxed font-medium group-hover:text-white/95 transition-all italic">
                                        {scene.description}
                                      </p>
                                    </div>
                                    
                                    <div className="md:col-span-12 lg:col-span-5 bg-white/[0.02] rounded-3xl p-6 border-2 border-white/5 transition-all group-hover:bg-white/[0.04]">
                                      <div className="flex justify-between items-center mb-4">
                                         <div className="text-[10px] font-black text-[#8B0000] uppercase tracking-[0.5em]">AI Prompt</div>
                                         <div className="flex gap-2">
                                           <button 
                                             onClick={() => handleRegenerateScene(scene.id)}
                                             disabled={!!refreshingScene}
                                             className="p-1 px-3 text-[9px] font-black bg-[#C5A059]/10 text-[#C5A059] rounded-lg border border-[#C5A059]/10 hover:bg-[#C5A059] hover:text-black transition-all"
                                             title="Re-gerar Prompt"
                                           >
                                             {refreshingScene === scene.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                           </button>
                                           <button 
                                             onClick={() => {
                                               navigator.clipboard.writeText(scene.imagePrompt || '');
                                               alert('Prompt copiado!');
                                             }}
                                             className="text-[9px] font-black text-[#C5A059] hover:text-white transition-all uppercase tracking-widest bg-white/5 px-3 py-1 rounded-lg"
                                           >
                                             Copy
                                           </button>
                                         </div>
                                      </div>
                                      {scene.imagePrompt ? (
                                         <p className="text-[11px] font-mono text-white/50 leading-relaxed italic group-hover:text-white/80 transition-all">
                                           {scene.imagePrompt}
                                         </p>
                                      ) : (
                                         <div className="flex items-center gap-3 text-[#C5A059]/40 text-[10px] font-black uppercase tracking-widest animate-pulse">
                                           <Loader2 className="w-4 h-4 animate-spin" /> Forging Directive...
                                         </div>
                                      )}
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : activeTab === 'batch' ? (
                <motion.div 
                  key="batch-tab"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                   <div className="flex items-center justify-between border-b border-white/5 pb-6">
                      <div className="flex items-center gap-4">
                         <div className="p-4 bg-[#8B0000]/10 rounded-2xl border border-[#8B0000]/20">
                            <History className="w-8 h-8 text-[#8B0000]" />
                         </div>
                         <div>
                            <h3 className="text-3xl font-black italic uppercase text-white tracking-tight">Project Repository</h3>
                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">Backup sincronizado via Supabase</p>
                         </div>
                      </div>
                      <button 
                        onClick={loadHistory}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all"
                      >
                         <RotateCcw className={`w-5 h-5 text-white/40 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                      </button>
                   </div>

                   {savedProjects.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                         {savedProjects.map((project) => (
                            <motion.div 
                              key={project.id}
                              whileHover={{ scale: 1.02 }}
                              className="glass-card rust-border p-8 space-y-6 group cursor-pointer"
                              onClick={() => restoreProject(project)}
                            >
                               <div className="flex justify-between items-start">
                                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                     <FileText className="w-5 h-5 text-[#C5A059]" />
                                  </div>
                                  <div className="flex items-center gap-2 px-3 py-1 bg-[#8B0000]/10 border border-[#8B0000]/20 rounded-full">
                                     <Clock className="w-3 h-3 text-[#8B0000]" />
                                     <span className="text-[9px] font-black text-white/40 uppercase">Acessar</span>
                                  </div>
                               </div>
                               <div>
                                  <h4 className="text-xl font-bold text-white uppercase italic leading-tight mb-2 group-hover:text-gold transition-colors line-clamp-2">
                                     {project.selectedIdea?.title || project.topic || 'Sem Título'}
                                  </h4>
                                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-black italic">{project.style}</p>
                               </div>
                               <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                     <Zap className="w-3 h-3 text-[#8B0000]" />
                                     <span className="text-[9px] font-bold text-white/20 uppercase">{project.duration}</span>
                                  </div>
                                  <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${project.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-gold/10 text-gold'}`}>
                                     {project.status === 'completed' ? 'Finalizado' : 'Em Progresso'}
                                  </div>
                                  {project.language && (
                                    <div className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-white/5 text-white/40">
                                      {project.language}
                                    </div>
                                  )}
                               </div>
                            </motion.div>
                         ))}
                      </div>
                   ) : (
                      <div className="flex flex-col items-center justify-center py-40 text-center">
                         <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-10 border border-white/5 opacity-20">
                            <History className="w-10 h-10 text-white" />
                         </div>
                         <p className="text-white/30 max-w-sm font-medium">Nenhum projeto encontrado. Comece uma nova orquestração no painel principal.</p>
                      </div>
                   )}
                </motion.div>
              ) : activeTab === 'srt' ? (
                <motion.div 
                  key="srt-tab"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="max-w-6xl mx-auto space-y-12"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-8">
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">SRT Engine</h2>
                    <div className="flex items-center gap-4">
                       <button 
                        onClick={() => { setSrtInput(''); setSrtOutput(''); }}
                        className="p-3 bg-white/5 hover:bg-red-500/20 rounded-xl border border-white/5 text-white/40 hover:text-red-500 transition-all"
                        title="Limpar Tudo"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>
                       <div className="h-8 w-[1px] bg-white/5" />
                       <div className="flex items-center gap-2">
                          <Captions className="w-5 h-5 text-gold" />
                          <span className="text-[10px] font-black text-gold uppercase tracking-widest">Tool v1.1</span>
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div className="bg-black/40 border-2 border-zinc-800 p-8 rounded-[2.5rem] space-y-8">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[#C5A059]/80 truncate">Texto Para Legendar</label>
                          <div className="flex items-center gap-4 text-[10px] font-mono text-white/40">
                            <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {srtInput.split(/\s+/).filter(w => w.length > 0).length} PALAVRAS</span>
                            <span className="flex items-center gap-1 font-black text-gold">EST. {(srtInput.split(/\s+/).filter(w => w.length > 0).length / wordsPerSecond).toFixed(1)}s</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <label className="text-[9px] font-black uppercase text-white/30 tracking-widest">Palavras por Legenda</label>
                            <input 
                              type="number" 
                              value={wordsPerSegment}
                              onChange={(e) => setWordsPerSegment(Number(e.target.value))}
                              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-gold/40 outline-none"
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[9px] font-black uppercase text-white/30 tracking-widest">Velocidade (WPS)</label>
                            <input 
                              type="number" 
                              step="0.1"
                              value={wordsPerSecond}
                              onChange={(e) => setWordsPerSecond(Number(e.target.value))}
                              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-gold/40 outline-none"
                            />
                          </div>
                        </div>

                        <textarea 
                          className="w-full bg-black/60 border border-white/10 rounded-2xl p-6 min-h-[300px] text-sm leading-relaxed focus:outline-none focus:border-gold/40 transition-all text-white/80 font-medium placeholder:text-white/10 custom-scroll"
                          placeholder="Cole seu texto aqui..."
                          value={srtInput}
                          onChange={(e) => setSrtInput(e.target.value)}
                        />
                        
                        <div className="flex gap-4">
                          <button 
                            onClick={deconstructText}
                            className="flex-1 py-4 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            title="Separa o texto em blocos baseados no limite de palavras"
                          >
                             Separar Blocos
                          </button>
                          <button 
                            onClick={convertTextToSRT}
                            className="flex-[2] py-4 bg-gold text-black font-black uppercase tracking-[0.2em] rounded-xl hover:bg-[#D5B069] transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(197,160,89,0.2)]"
                          >
                            <Zap className="w-5 h-5 fill-current" />
                            Gerar SRT
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-black/40 border-2 border-zinc-800 p-8 rounded-[2.5rem] space-y-6 h-full flex flex-col min-h-[500px]">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[#C5A059]/80">Preview SRT</label>
                          {srtOutput && (
                             <button 
                              onClick={() => {
                                navigator.clipboard.writeText(srtOutput);
                                alert('Legenda copiada!');
                              }}
                              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase text-white hover:text-gold transition-all flex items-center gap-2"
                             >
                                <Copy className="w-3 h-3" /> Copiar Código
                             </button>
                          )}
                        </div>
                        <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl p-6 font-mono text-[11px] text-white/60 overflow-y-auto custom-scroll">
                          {srtOutput ? (
                            <div className="space-y-6">
                              <pre className="whitespace-pre-wrap mb-10 pb-10 border-b border-white/5">{srtOutput}</pre>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-[#C5A059] tracking-widest block mb-4">Análise de Densidade (Ledger)</label>
                                {srtOutput.split('\n\n').filter(s => s.trim().length > 0).map((segment, i) => {
                                   const lines = segment.split('\n');
                                   const text = lines.slice(2).join(' ');
                                   const words = text.split(/\s+/).filter(w => w.length > 0).length;
                                   const timeMatch = lines[1]?.match(/(\d+:\d+:\d+,\d+) --> (\d+:\d+:\d+,\d+)/);
                                   return (
                                     <div key={i} className="flex items-center justify-between text-[9px] border-b border-white/5 pb-2 hover:bg-white/5 transition-all px-2">
                                       <span className="text-white/20">#{i + 1}</span>
                                       <span className="flex-1 px-4 truncate text-white/40 italic">"{text}"</span>
                                       <div className="flex gap-4 items-center">
                                         <span className="text-gold font-bold">{words} W</span>
                                         <span className="text-[#8B0000] px-2 bg-[#8B0000]/10 rounded">{lines[1]?.split(' --> ')[1].split(',')[0].split(':').slice(1).join(':')}s</span>
                                       </div>
                                     </div>
                                   );
                                 })}
                              </div>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-10 italic">
                               <Captions className="w-16 h-16 mb-6" />
                               <p className="uppercase tracking-[0.3em] font-black">Waiting for Input...</p>
                            </div>
                          )}
                        </div>
                        {srtOutput && (
                           <button 
                            onClick={() => downloadSRTFile(srtOutput, 'Legenda_GhostStudio.srt')}
                            className="w-full py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-white/80 flex items-center justify-center gap-3 group"
                           >
                            <Download className="w-5 h-5 text-gold group-hover:scale-110 transition-transform" />
                            DOWNLOAD .SRT
                           </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : activeTab === 'studio' ? (
                <motion.div 
                  key="studio-tab"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-w-7xl mx-auto space-y-12 pb-20"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-8">
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">Overlay Studio</h2>
                    <div className="flex items-center gap-4">
                       {uploadedVideo && (
                          <button 
                            onClick={exportVideoWithSubtitles}
                            disabled={isExportingVideo}
                            className="px-8 py-3 bg-[#8B0000] text-white font-black uppercase tracking-[0.2em] rounded-xl hover:bg-[#A50000] transition-all flex items-center gap-3 shadow-[0_10px_30px_rgba(139,0,0,0.3)] disabled:opacity-50"
                          >
                            {isExportingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4 text-gold flex-shrink-0" />}
                            {isExportingVideo ? 'Renderizando...' : 'Renderizar & Baixar'}
                          </button>
                       )}
                       <div className="h-8 w-[1px] bg-white/5" />
                       <div className="flex items-center gap-2">
                          <MonitorPlay className="w-5 h-5 text-gold" />
                          <span className="text-[10px] font-black text-gold uppercase tracking-widest">Studio v1.0</span>
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                    <div className="xl:col-span-2 space-y-6">
                      <div className="bg-black/80 border-2 border-zinc-800 rounded-[2.5rem] overflow-hidden relative aspect-video shadow-2xl group">
                        {uploadedVideo ? (
                          <>
                            <video 
                              ref={setVideoRef}
                              src={uploadedVideo} 
                              className="w-full h-full object-contain"
                              onTimeUpdate={(e) => {
                                const video = e.currentTarget;
                                const subs = parseSRT(srtForStudio || srtOutput || generateProjectSRT());
                                const current = subs.find(s => video.currentTime >= s.start && video.currentTime <= s.end);
                                const overlay = document.getElementById('subtitle-overlay');
                                if (overlay) overlay.innerText = current ? current.text : '';
                              }}
                              controls
                            />
                            <div 
                              id="subtitle-overlay"
                              className="absolute inset-x-0 text-center pointer-events-none drop-shadow-lg font-black"
                              style={{ 
                                bottom: `${100 - subtitleY}%`,
                                fontSize: `${fontSize}px`,
                                color: subtitleColor,
                                padding: '0 20px',
                                textShadow: '2px 2px 4px rgba(0,0,0,0.9), -2px -2px 4px rgba(0,0,0,0.9)'
                              }}
                            ></div>
                            <button 
                              onClick={() => setUploadedVideo(null)}
                              className="absolute top-6 right-6 p-4 bg-black/60 hover:bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md"
                            >
                              <VideoOff className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-8 bg-[radial-gradient(circle_at_center,rgba(197,160,89,0.05)_0%,transparent_70%)]">
                             <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center animate-pulse">
                                <Upload className="w-10 h-10 text-gold" />
                             </div>
                             <div className="text-center space-y-2">
                               <p className="text-xl font-black uppercase italic tracking-widest text-white/80">Missing Media</p>
                               <p className="text-xs text-white/30 uppercase tracking-[0.3em] font-medium">Carregue um vídeo para iniciar a queima de legendas</p>
                             </div>
                             <label className="px-10 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all cursor-pointer font-black text-[10px] uppercase tracking-widest">
                                Selecionar Vídeo
                                <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                             </label>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-black/40 border border-white/5 p-6 rounded-3xl space-y-4">
                           <div className="flex items-center gap-3 text-gold">
                              <Layers className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Sub Stylist</span>
                           </div>
                           <div className="space-y-4">
                             <div className="space-y-2">
                               <label className="text-[9px] font-bold text-white/40 uppercase">Tamanho da Fonte</label>
                               <input type="range" min="12" max="72" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-gold" />
                             </div>
                             <div className="space-y-2">
                               <label className="text-[9px] font-bold text-white/40 uppercase">Posição Vertical (%)</label>
                               <input type="range" min="10" max="95" value={subtitleY} onChange={(e) => setSubtitleY(Number(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-gold" />
                             </div>
                           </div>
                        </div>
                        
                        <div className="md:col-span-2 bg-black/40 border border-white/5 p-6 rounded-3xl space-y-4">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3 text-gold">
                                <FileText className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">SRT Source</span>
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => setSrtForStudio(srtOutput || generateProjectSRT())} className="text-[9px] font-black text-white/40 hover:text-gold uppercase tracking-widest transition-all">Importar do Core</button>
                             </div>
                           </div>
                           <textarea 
                             className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 h-32 text-[11px] font-mono text-white/60 focus:outline-none focus:border-gold/30 custom-scroll"
                             placeholder="Cole o código SRT aqui..."
                             value={srtForStudio}
                             onChange={(e) => setSrtForStudio(e.target.value)}
                           />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-black/40 border-2 border-zinc-800 p-8 rounded-[2.5rem] space-y-8 h-full">
                        <div className="flex items-center justify-between">
                           <h3 className="text-xl font-black italic uppercase tracking-tighter">Segment Explorer</h3>
                           <div className="px-3 py-1 bg-gold/10 rounded-full border border-gold/20">
                              <span className="text-[9px] font-black text-gold uppercase tracking-widest">Auto-Sync</span>
                           </div>
                        </div>
                        
                        <div className="space-y-4 overflow-y-auto max-h-[600px] custom-scroll pr-2">
                          {parseSRT(srtForStudio || srtOutput || generateProjectSRT()).map((sub, i) => (
                             <button 
                               key={i} 
                               onClick={() => { if (videoRef) videoRef.currentTime = sub.start; }}
                               className="w-full p-6 bg-white/5 border border-white/5 rounded-3xl text-left hover:border-gold/30 hover:bg-gold/5 transition-all space-y-3 group"
                             >
                               <div className="flex justify-between items-center text-[10px] font-mono">
                                 <span className="text-white/20 font-black">#{i + 1}</span>
                                 <span className="text-gold opacity-40 group-hover:opacity-100 transition-opacity">{sub.start.toFixed(2)}s</span>
                               </div>
                               <p className="text-xs text-white/60 leading-relaxed font-medium group-hover:text-white transition-colors">{sub.text}</p>
                             </button>
                          ))}
                          <div className="h-20 flex items-center justify-center opacity-10">
                             <MonitorPlay className="w-8 h-8" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="settings-tab"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="max-w-4xl mx-auto space-y-12"
                >
                   <div className="flex items-center justify-between border-b border-white/5 pb-8">
                     <h2 className="text-4xl font-black italic uppercase tracking-tighter">System Setup</h2>
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                        <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Core Online</span>
                     </div>
                   </div>

                   <div className="bg-black/40 border-2 border-white/5 p-8 rounded-[2.5rem] mb-8 space-y-6">
                       <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                          <div className="p-3 bg-[#6A1B9A]/10 rounded-xl">
                             <Zap className="w-6 h-6 text-[#8E24AA]" />
                          </div>
                          <div>
                             <h4 className="text-xl font-black italic uppercase tracking-tight text-white">Make.com Automation</h4>
                             <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Connect to eu1.make.com or your Webhook</p>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Webhook URL</label>
                          <div className="flex gap-4">
                             <input 
                                type="text" 
                                placeholder="https://hook.eu1.make.com/your-unique-token"
                                className="flex-1 bg-black/60 border border-white/10 rounded-xl px-6 py-4 focus:outline-none focus:border-[#8E24AA]/50 text-sm font-mono text-white/80"
                                value={makeWebhookUrl}
                                onChange={(e) => setMakeWebhookUrl(e.target.value)}
                             />
                             <button 
                                onClick={() => alert('Webhook salvo com sucesso!')}
                                className="px-8 bg-[#8E24AA] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#9C27B0] transition-all"
                             >
                                Save Hook
                             </button>
                          </div>
                          <p className="text-[10px] text-white/20 italic">
                             Ao configurar este webhook, um novo botão "Make IT" aparecerá no painel de exportação para disparar automações instantâneas.
                          </p>
                       </div>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-[#8B0000]/5 border-2 border-[#8B0000]/20 p-8 rounded-[2.5rem] hover:border-[#8B0000]/40 transition-all group font-sans">
                         <div className="flex justify-between items-start mb-8">
                            <div className="p-4 bg-[#8B0000]/20 rounded-2xl text-[#8B0000] gold-glow transition-all group-hover:rotate-6">
                               <Flame className="w-8 h-8 fill-current" />
                            </div>
                            <span className="text-[10px] font-black text-[#C5A059] bg-[#C5A059]/10 px-4 py-1.5 rounded-full uppercase tracking-widest">MOD ACTIVE</span>
                         </div>
                         <h4 className="text-2xl font-black uppercase italic mb-2 tracking-tight">Batch Production</h4>
                         <p className="text-sm text-white/40 mb-8 leading-relaxed font-medium">Orquestre múltiplos roteiros e identidades visuais em um único pulso de IA.</p>
                         <button className="w-full py-4 bg-[#8B0000] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-[#A50000] transition-all shadow-[0_10px_30px_rgba(139,0,0,0.3)]">Explorar Interface</button>
                      </div>

                      <div className="bg-[#C5A059]/5 border-2 border-[#C5A059]/20 p-8 rounded-[2.5rem] hover:border-[#C5A059]/40 transition-all group font-sans">
                         <div className="flex justify-between items-start mb-8">
                            <div className="p-4 bg-[#C5A059]/20 rounded-2xl text-[#C5A059] transition-all group-hover:-rotate-6">
                               <Zap className="w-8 h-8 fill-current" />
                            </div>
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">READY</span>
                         </div>
                         <h4 className="text-2xl font-black uppercase italic mb-2 tracking-tight">Auto-Sync Core</h4>
                         <p className="text-sm text-white/40 mb-8 leading-relaxed font-medium">Sincronização precisa de milissegundos entre narrativa vocal e visual script.</p>
                         <button className="w-full py-4 bg-white/5 border-2 border-white/5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-white/10 hover:border-white/10 transition-all">Sincronizar Protocolos</button>
                      </div>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
