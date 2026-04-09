import { ipcMain, shell } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { AppConfig } from '../../../renderer/config';

class SillyTavernHandler {
  private process: ChildProcess | null = null;
  private logs: string[] = [];
  private initialized = false;
  private sillyTavernPath: string;

  constructor() {
    console.log('SillyTavernHandler constructor called');
    // 使用 process.cwd() 获取当前工作目录（项目根目录）
    const projectRoot = process.cwd();
    this.sillyTavernPath = path.join(projectRoot, AppConfig.sillyTavernRoot);
    console.log('Project root (process.cwd()):', projectRoot);
    console.log('SillyTavern path:', this.sillyTavernPath);
    this.setupHandlers();
  }

  private setupHandlers() {
    if (this.initialized) {
      console.log('SillyTavernHandler already initialized');
      return;
    }
    
    console.log('Setting up SillyTavern handlers...');
    
    ipcMain.handle('sillyTavern:start', async () => {
      console.log('Handler sillyTavern:start called');
      return await this.startSillyTavern();
    });

    ipcMain.handle('sillyTavern:stop', async () => {
      console.log('Handler sillyTavern:stop called');
      return await this.stopSillyTavern();
    });

    ipcMain.handle('sillyTavern:status', async () => {
      console.log('Handler sillyTavern:status called');
      return this.getStatus();
    });

    ipcMain.handle('sillyTavern:updateConfig', async (_event, config: any) => {
      console.log('Handler sillyTavern:updateConfig called');
      return await this.updateSillyTavernConfig(config);
    });
    
    this.initialized = true;
    console.log('SillyTavern handlers setup complete');
  }

  private async startSillyTavern() {
    if (this.process) {
      return { success: false, message: 'SillyTavern already running' };
    }

    this.logs = [];
    
    try {
      // 使用全局配置中的SillyTavern根目录路径
      const sillyTavernPath = this.sillyTavernPath;
      
      // 启动SillyTavern
      this.process = spawn('npm', ['start'], {
        cwd: sillyTavernPath,
        shell: true,
        stdio: 'pipe'
      });

      // 捕获 stdout
      this.process.stdout?.on('data', (data) => {
        const log = data.toString();
        this.logs.push(log);
        console.log('SillyTavern stdout:', log);
      });

      // 捕获 stderr
      this.process.stderr?.on('data', (data) => {
        const log = data.toString();
        this.logs.push(log);
        console.error('SillyTavern stderr:', log);
      });

      // 处理退出
      this.process.on('exit', (code) => {
        this.logs.push(`SillyTavern exited with code ${code}`);
        this.process = null;
      });

      // 处理错误
      this.process.on('error', (error) => {
        this.logs.push(`Error: ${error.message}`);
        this.process = null;
      });

      // 等待服务器启动，然后在默认浏览器中打开
      setTimeout(() => {
        this.logs.push('Opening SillyTavern in default browser...');
        shell.openExternal('http://127.0.0.1:8001/');
      }, 5000);

      return { success: true, message: 'SillyTavern starting' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start SillyTavern'
      };
    }
  }

  private async stopSillyTavern() {
    if (!this.process) {
      return { success: false, message: 'SillyTavern not running' };
    }

    try {
      // 终止进程
      this.process.kill();
      this.process = null;
      return { success: true, message: 'SillyTavern stopped' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to stop SillyTavern'
      };
    }
  }

  private getStatus() {
    return {
      running: this.process !== null,
      logs: this.logs
    };
  }

  private async updateSillyTavernConfig(config: any) {
    try {
      // 输出配置信息以调试
      console.log('Received config:', JSON.stringify(config, null, 2));
      console.log('API mode:', config.api_mode);
      
      // 使用全局配置中的SillyTavern根目录路径
      const sillyTavernPath = this.sillyTavernPath;
      const settingsPath = path.join(sillyTavernPath, 'data', 'default-user', 'settings.json');
      
      // 读取现有配置
      const fs = require('fs');
      const existingConfig = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      
      // 根据API模式更新配置
      if (config.api_mode === 'text_completion') {
        await this.handleTextCompletionConfig(config, existingConfig, sillyTavernPath, fs);
      } else if (config.api_mode === 'chat_completion') {
        await this.handleChatCompletionConfig(config, existingConfig, sillyTavernPath, fs);
      } else if (config.api_mode === 'novelai') {
        // 更新NovelAI模式配置
        existingConfig.main_api = 'novelai';
        existingConfig.nai_settings = {
          ...existingConfig.nai_settings,
          model_novel: config.novelai_model || 'clio-v1'
        };
      } else if (config.api_mode === 'ai_horde') {
        // 更新AI Horde模式配置
        existingConfig.main_api = 'horde';
        existingConfig.horde_settings = {
          ...existingConfig.horde_settings,
          models: config.ai_horde_model ? [config.ai_horde_model] : []
        };
      }
      
      // 保存更新后的配置
      fs.writeFileSync(settingsPath, JSON.stringify(existingConfig, null, 2), 'utf-8');
      
      return { success: true, message: 'SillyTavern config updated successfully' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update SillyTavern config'
      };
    }
  }

  private async handleTextCompletionConfig(config: any, existingConfig: any, sillyTavernPath: string, fs: any) {
    // 更新文本补全模式配置
    existingConfig.main_api = 'textgenerationwebui';
    existingConfig.textgenerationwebui_settings = {
      ...existingConfig.textgenerationwebui_settings,
      server_urls: {
        ooba: config.api_url
      },
      custom_model: config.model_name,
      bypass_status_check: config.skip_status_check || false
    };
    
    // 保存文本补全模式的模型参数到TextGen Settings目录
    console.log('Current API mode: text_completion');
    console.log('SillyTavern path:', sillyTavernPath);
    
    const textGenSettingsDir = path.join(sillyTavernPath, 'data', 'default-user', 'TextGen Settings');
    console.log('TextGen Settings directory:', textGenSettingsDir);
    
    // 确保目录存在
    if (!fs.existsSync(textGenSettingsDir)) {
      console.log('Creating TextGen Settings directory...');
      fs.mkdirSync(textGenSettingsDir, { recursive: true });
      console.log('Directory created successfully');
    } else {
      console.log('TextGen Settings directory already exists');
    }
    
    // 构建模型参数配置文件路径
    const presetName = config.preset_name || 'Default';
    console.log('Preset name:', presetName);
    
    const presetFilePath = path.join(textGenSettingsDir, `${presetName}.json`);
    console.log('Preset file path:', presetFilePath);
    
    // 构建模型参数配置对象（TextGen格式）
    const modelParams = {
      temp: config.temperature ?? 1,
      temperature_last: config.temperature_last ?? true,
      top_p: config.top_p ?? 0.95,
      top_k: config.top_k ?? 0,
      top_a: config.top_a ?? 0,
      tfs: config.tfs ?? 1,
      epsilon_cutoff: config.epsilon_cutoff ?? 0,
      eta_cutoff: config.eta_cutoff ?? 0,
      typical_p: config.typical_p ?? 1,
      min_p: config.min_p ?? 0.01,
      rep_pen: config.rep_pen ?? 1.1,
      rep_pen_range: config.rep_pen_range ?? 0,
      rep_pen_decay: config.rep_pen_decay ?? 0,
      rep_pen_slope: config.rep_pen_slope ?? 1,
      no_repeat_ngram_size: config.no_repeat_ngram_size ?? 0,
      penalty_alpha: config.penalty_alpha ?? 0,
      num_beams: config.num_beams ?? 1,
      length_penalty: config.length_penalty ?? 1,
      min_length: config.min_length ?? 0,
      encoder_rep_pen: config.encoder_rep_pen ?? 1,
      freq_pen: config.freq_pen ?? 0,
      presence_pen: config.presence_pen ?? 0,
      skew: config.skew ?? 0,
      do_sample: config.do_sample ?? true,
      early_stopping: config.early_stopping ?? false,
      dynatemp: config.dynatemp ?? false,
      min_temp: config.min_temp ?? 0,
      max_temp: config.max_temp ?? 2,
      dynatemp_exponent: config.dynatemp_exponent ?? 1,
      smoothing_factor: config.smoothing_factor ?? 0,
      smoothing_curve: config.smoothing_curve ?? 1,
      dry_allowed_length: config.dry_allowed_length ?? 2,
      dry_multiplier: config.dry_multiplier ?? 0,
      dry_base: config.dry_base ?? 1.75,
      dry_sequence_breakers: config.dry_sequence_breakers ?? '["\n", ":", "\"", "*"]',
      dry_penalty_last_n: config.dry_penalty_last_n ?? 0,
      add_bos_token: config.add_bos_token ?? true,
      ban_eos_token: config.ban_eos_token ?? false,
      skip_special_tokens: config.skip_special_tokens ?? true,
      mirostat_mode: config.mirostat_mode ?? 0,
      mirostat_tau: config.mirostat_tau ?? 5,
      mirostat_eta: config.mirostat_eta ?? 0.1,
      guidance_scale: config.guidance_scale ?? 1,
      negative_prompt: config.negative_prompt ?? "",
      grammar_string: config.grammar_string ?? "",
      json_schema: config.json_schema ?? null,
      json_schema_allow_empty: config.json_schema_allow_empty ?? false,
      banned_tokens: config.banned_tokens ?? "",
      sampler_priority: config.sampler_priority ?? [
        "repetition_penalty",
        "presence_penalty",
        "frequency_penalty",
        "dry",
        "temperature",
        "dynamic_temperature",
        "quadratic_sampling",
        "top_n_sigma",
        "top_k",
        "top_p",
        "typical_p",
        "epsilon_cutoff",
        "eta_cutoff",
        "tfs",
        "top_a",
        "min_p",
        "mirostat",
        "xtc",
        "encoder_repetition_penalty",
        "no_repeat_ngram"
      ],
      samplers: config.samplers ?? [
        "penalties",
        "dry",
        "top_n_sigma",
        "top_k",
        "typ_p",
        "tfs_z",
        "typical_p",
        "xtc",
        "top_p",
        "adaptive_p",
        "min_p",
        "temperature"
      ],
      samplers_priorities: config.samplers_priorities ?? [
        "dry",
        "penalties",
        "no_repeat_ngram",
        "temperature",
        "top_nsigma",
        "top_p_top_k",
        "top_a",
        "min_p",
        "tfs",
        "eta_cutoff",
        "epsilon_cutoff",
        "typical_p",
        "quadratic",
        "xtc"
      ],
      ignore_eos_token: config.ignore_eos_token ?? false,
      spaces_between_special_tokens: config.spaces_between_special_tokens ?? true,
      speculative_ngram: config.speculative_ngram ?? false,
      sampler_order: config.sampler_order ?? [6, 0, 1, 3, 4, 2, 5],
      logit_bias: config.logit_bias ?? [],
      xtc_threshold: config.xtc_threshold ?? 0.1,
      xtc_probability: config.xtc_probability ?? 0,
      nsigma: config.nsigma ?? 0,
      min_keep: config.min_keep ?? 0,
      extensions: config.extensions ?? {},
      adaptive_target: config.adaptive_target ?? -0.01,
      adaptive_decay: config.adaptive_decay ?? 0.9,
      rep_pen_size: config.rep_pen_size ?? 0,
      genamt: config.genamt ?? 350,
      max_length: config.max_length ?? 3840
    };
    
    console.log('Model params to save:', JSON.stringify(modelParams, null, 2));
    
    // 保存模型参数配置文件
    try {
      fs.writeFileSync(presetFilePath, JSON.stringify(modelParams, null, 2), 'utf-8');
      console.log('Preset file saved successfully:', presetFilePath);
    } catch (writeError) {
      console.error('Failed to save preset file:', writeError);
      throw writeError;
    }
  }

  private async handleChatCompletionConfig(config: any, existingConfig: any, sillyTavernPath: string, fs: any) {
    // 更新聊天补全模式配置
    existingConfig.main_api = 'openai';
    existingConfig.oai_settings = {
      ...existingConfig.oai_settings,
      openai_model: config.model_name,
      reverse_proxy: config.api_url,
      bypass_status_check: config.skip_status_check || false
    };
    
    // 保存聊天补全模式的模型参数到OpenAI Settings目录
    console.log('Current API mode: chat_completion');
    console.log('SillyTavern path:', sillyTavernPath);
    
    const openAISettingsDir = path.join(sillyTavernPath, 'data', 'default-user', 'OpenAI Settings');
    console.log('OpenAI Settings directory:', openAISettingsDir);
    
    // 确保目录存在
    if (!fs.existsSync(openAISettingsDir)) {
      console.log('Creating OpenAI Settings directory...');
      fs.mkdirSync(openAISettingsDir, { recursive: true });
      console.log('Directory created successfully');
    } else {
      console.log('OpenAI Settings directory already exists');
    }
    
    // 构建模型参数配置文件路径
    const presetName = config.preset_name || 'Default';
    console.log('Preset name:', presetName);
    
    const presetFilePath = path.join(openAISettingsDir, `${presetName}.json`);
    console.log('Preset file path:', presetFilePath);
    
    // 构建模型参数配置对象（参考Default.json格式）
    const modelParams = {
      // 基本参数
      temperature: config.temperature ?? 1,
      frequency_penalty: config.freq_pen ?? 0,
      presence_penalty: config.presence_pen ?? 0,
      top_p: config.top_p ?? 1,
      top_k: config.top_k ?? 0,
      top_a: config.top_a ?? 0,
      min_p: config.min_p ?? 0,
      repetition_penalty: config.rep_pen ?? 1,
      openai_max_context: 4095,
      openai_max_tokens: config.max_tokens ?? 300,
      names_behavior: 0,
      send_if_empty: "",
      impersonation_prompt: "[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don't write as {{char}} or system. Don't describe actions of {{char}}.]",
      new_chat_prompt: "[Start a new Chat]",
      new_group_chat_prompt: "[Start a new group chat. Group members: {{group}}]",
      new_example_chat_prompt: "[Example Chat]",
      continue_nudge_prompt: "[Continue your last message without repeating its original content.]",
      bias_preset_selected: "Default (none)",
      max_context_unlocked: false,
      wi_format: "{0}",
      scenario_format: "{{scenario}}",
      personality_format: "{{personality}}",
      group_nudge_prompt: "[Write the next reply only as {{char}}.]",
      stream_openai: config.streaming ?? true,
      
      // 提示词配置
      prompts: [
        {
          "name": "Main Prompt",
          "system_prompt": true,
          "role": "system",
          "content": "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}.",
          "identifier": "main"
        },
        {
          "name": "Auxiliary Prompt",
          "system_prompt": true,
          "role": "system",
          "content": "",
          "identifier": "nsfw"
        },
        {
          "identifier": "dialogueExamples",
          "name": "Chat Examples",
          "system_prompt": true,
          "marker": true
        },
        {
          "name": "Post-History Instructions",
          "system_prompt": true,
          "role": "system",
          "content": "",
          "identifier": "jailbreak"
        },
        {
          "identifier": "chatHistory",
          "name": "Chat History",
          "system_prompt": true,
          "marker": true
        },
        {
          "identifier": "worldInfoAfter",
          "name": "World Info (after)",
          "system_prompt": true,
          "marker": true
        },
        {
          "identifier": "worldInfoBefore",
          "name": "World Info (before)",
          "system_prompt": true,
          "marker": true
        },
        {
          "identifier": "enhanceDefinitions",
          "role": "system",
          "name": "Enhance Definitions",
          "content": "If you have more knowledge of {{char}}, add to the character's lore and personality to enhance them but keep the Character Sheet's definitions absolute.",
          "system_prompt": true,
          "marker": false
        },
        {
          "identifier": "charDescription",
          "name": "Char Description",
          "system_prompt": true,
          "marker": true
        },
        {
          "identifier": "charPersonality",
          "name": "Char Personality",
          "system_prompt": true,
          "marker": true
        },
        {
          "identifier": "scenario",
          "name": "Scenario",
          "system_prompt": true,
          "marker": true
        },
        {
          "identifier": "personaDescription",
          "name": "Persona Description",
          "system_prompt": true,
          "marker": true
        }
      ],
      
      // 提示词顺序
      prompt_order: [
        {
          "character_id": 100000,
          "order": [
            {
              "identifier": "main",
              "enabled": true
            },
            {
              "identifier": "worldInfoBefore",
              "enabled": true
            },
            {
              "identifier": "charDescription",
              "enabled": true
            },
            {
              "identifier": "charPersonality",
              "enabled": true
            },
            {
              "identifier": "scenario",
              "enabled": true
            },
            {
              "identifier": "enhanceDefinitions",
              "enabled": false
            },
            {
              "identifier": "nsfw",
              "enabled": true
            },
            {
              "identifier": "worldInfoAfter",
              "enabled": true
            },
            {
              "identifier": "dialogueExamples",
              "enabled": true
            },
            {
              "identifier": "chatHistory",
              "enabled": true
            },
            {
              "identifier": "jailbreak",
              "enabled": true
            }
          ]
        },
        {
          "character_id": 100001,
          "order": [
            {
              "identifier": "main",
              "enabled": true
            },
            {
              "identifier": "worldInfoBefore",
              "enabled": true
            },
            {
              "identifier": "personaDescription",
              "enabled": true
            },
            {
              "identifier": "charDescription",
              "enabled": true
            },
            {
              "identifier": "charPersonality",
              "enabled": true
            },
            {
              "identifier": "scenario",
              "enabled": true
            },
            {
              "identifier": "enhanceDefinitions",
              "enabled": false
            },
            {
              "identifier": "nsfw",
              "enabled": true
            },
            {
              "identifier": "worldInfoAfter",
              "enabled": true
            },
            {
              "identifier": "dialogueExamples",
              "enabled": true
            },
            {
              "identifier": "chatHistory",
              "enabled": true
            },
            {
              "identifier": "jailbreak",
              "enabled": true
            }
          ]
        }
      ],
      
      // 其他参数
      assistant_prefill: "",
      assistant_impersonation: "",
      use_sysprompt: false,
      squash_system_messages: false,
      media_inlining: true,
      continue_prefill: false,
      continue_postfix: " ",
      seed: -1,
      n: 1,
      
      // 高级参数
      rep_pen_range: config.rep_pen_range ?? 0,
      rep_pen_decay: config.rep_pen_decay ?? 0,
      rep_pen_slope: config.rep_pen_slope ?? 1,
      no_repeat_ngram_size: config.no_repeat_ngram_size ?? 0,
      penalty_alpha: config.penalty_alpha ?? 0,
      num_beams: config.num_beams ?? 1,
      length_penalty: config.length_penalty ?? 1,
      min_length: config.min_length ?? 0,
      encoder_rep_pen: config.encoder_rep_pen ?? 1,
      skew: config.skew ?? 0,
      do_sample: config.do_sample ?? true,
      early_stopping: config.early_stopping ?? false,
      dynatemp: config.dynatemp ?? false,
      min_temp: config.min_temp ?? 0,
      max_temp: config.max_temp ?? 2,
      dynatemp_exponent: config.dynatemp_exponent ?? 1,
      smoothing_factor: config.smoothing_factor ?? 0,
      smoothing_curve: config.smoothing_curve ?? 1,
      dry_allowed_length: config.dry_allowed_length ?? 2,
      dry_multiplier: config.dry_multiplier ?? 0,
      dry_base: config.dry_base ?? 1.75,
      add_bos_token: config.add_bos_token ?? true,
      ban_eos_token: config.ban_eos_token ?? false,
      skip_special_tokens: config.skip_special_tokens ?? true,
      mirostat_mode: config.mirostat_mode ?? 0,
      mirostat_tau: config.mirostat_tau ?? 5,
      mirostat_eta: config.mirostat_eta ?? 0.1,
      guidance_scale: config.guidance_scale ?? 1,
      xtc_threshold: config.xtc_threshold ?? 0.1,
      xtc_probability: config.xtc_probability ?? 0,
      nsigma: config.nsigma ?? 0,
      min_keep: config.min_keep ?? 0,
      adaptive_target: config.adaptive_target ?? -0.01,
      adaptive_decay: config.adaptive_decay ?? 0.9,
      rep_pen_size: config.rep_pen_size ?? 0,
      genamt: config.genamt ?? 350,
      max_length: config.max_length ?? 8192
    };
    
    console.log('Model params to save:', JSON.stringify(modelParams, null, 2));
    
    // 保存模型参数配置文件
    try {
      fs.writeFileSync(presetFilePath, JSON.stringify(modelParams, null, 2), 'utf-8');
      console.log('Preset file saved successfully:', presetFilePath);
    } catch (writeError) {
      console.error('Failed to save preset file:', writeError);
      throw writeError;
    }
    
    // 更新settings.json中的当前预设
    existingConfig.openai_preset = presetName;
  }
}

export const sillyTavernHandler = new SillyTavernHandler();