export interface VideoIdea {
  title: string;
  hook: string;
  potential: number; // 1-100
  description: string;
}

export interface ScriptSection {
  type: 'hook' | 'introduction' | 'development' | 'climax' | 'cta';
  content: string;
}

export interface VideoScript {
  title: string;
  sections: ScriptSection[];
  fullText: string;
  thumbnailSuggestions: string[];
}

export interface VideoScene {
  id: string;
  timeRange: string;
  description: string;
  emotion: string;
  imagePrompt?: string;
}

export interface ShortScript {
  id: string;
  title: string;
  content: string;
  hook: string;
}

export interface DarkFlowState {
  id: string;
  topic: string;
  duration: string;
  style: string;
  characterPrompt?: string;
  ideas: VideoIdea[];
  selectedIdea: VideoIdea | null;
  script: VideoScript | null;
  shortScripts?: ShortScript[];
  scenes: VideoScene[];
  language?: 'pt' | 'en';
  status: 'idle' | 'searching_ideas' | 'generating_script' | 'building_scenes' | 'creating_prompts' | 'completed';
  error: string | null;
}
