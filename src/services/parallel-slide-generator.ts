/**
 * 並列スライド生成サービス
 * 1スライドずつ並列で生成し、ストリーミングでリアルタイム表示
 * 
 * @module services/parallel-slide-generator
 */

import { Slide, SlideDeck } from "./slide-generator.js";
import { IncrementalSlideParser } from "./incremental-slide-parser.js";

export interface SlideGenerationTask {
  slideNumber: number;
  prompt: string;
  agent: string;
  theme?: string; // テーマ（画像検索用）
}

export interface SlideGenerationResult {
  slideNumber: number;
  slide: Slide | null;
  agent: string;
  error?: string;
}

/**
 * スライド生成タスクを分割
 */
export function createSlideTasks(
  topic: string,
  slideCount: number,
  agents: string[],
  useSearch?: boolean, // Web検索とFigma Make参照を有効化
  theme?: string // テーマ（画像検索用）
): SlideGenerationTask[] {
  const tasks: SlideGenerationTask[] = [];
  
  // 各スライドを異なるエージェントに割り当て（ラウンドロビン）
  for (let i = 0; i < slideCount; i++) {
    const agentIndex = i % agents.length;
    const agent = agents[agentIndex];
    
    // Web検索とFigma Makeを参考にする指示を追加
    const searchInstruction = useSearch 
      ? `IMPORTANT: Use web search to find the latest information about Figma Make and professional slide design best practices. Reference Figma Make's design principles for creating visually stunning slides.`
      : `IMPORTANT: Reference Figma Make's design principles and professional slide design best practices for creating visually stunning slides.`;
    
    // テーマに基づいた指示を追加
    const themeInstruction = theme 
      ? `IMPORTANT: The theme is "${theme}". Make sure to create content and suggest images related to this theme.`
      : '';
    
    tasks.push({
      slideNumber: i + 1,
      prompt: `${searchInstruction}
${themeInstruction}

Create slide ${i + 1} of ${slideCount} about: ${topic}. 

CRITICAL: You MUST create exactly ${slideCount} slides total. This is slide ${i + 1} of ${slideCount}.

Format: ## Slide Title (one line)
Content: One clear sentence (max 20 words) that explains the point.
Make it concise and impactful.

Design requirements (Figma Make level):
- Professional, modern, and visually appealing
- Clear visual hierarchy
- Balanced composition with proper spacing
- Use appropriate colors based on content tone
- Suggest relevant images related to the theme`,
      agent,
      theme, // テーマをタスクに追加
    });
  }
  
  return tasks;
}

/**
 * 1スライドを生成（ストリーミング対応）
 */
export async function* generateSingleSlideStream(
  task: SlideGenerationTask,
  sendProgress?: (slide: Slide | null, progress: number) => void,
  useSearch?: boolean, // --searchオプション
  sendEvent?: (event: string, data: any) => void // イベント送信用
): AsyncGenerator<Slide | null, void, unknown> {
  const { generateCodeStream } = await import("../adapters/codex.js");
  const { chatWithClaude } = await import("../adapters/claude.js");
  const { chatWithGemini } = await import("../adapters/gemini.js");
  
  const parser = new IncrementalSlideParser();
  // テーマを設定
  if (task.theme) {
    parser.setTheme(task.theme);
  }
  let streamedResult = "";
  
  try {
    let stream: AsyncGenerator<string, void, unknown>;
    
    if (task.agent === "codex") {
      stream = generateCodeStream(task.prompt, {
        maxTokens: 800, // スライド生成のため適切なサイズ（1000から800に短縮して高速化）
        cwd: process.cwd(),
        // searchオプションはプロンプト内に含まれているため、ここでは不要
      });
    } else if (task.agent === "claude") {
      // Claudeはストリーミング未対応のため、通常実行
      const result = await chatWithClaude(task.prompt, {
        model: "claude-3-opus",
        cwd: process.cwd(),
        timeout: 1200000, // 20分のタイムアウト
      });
      streamedResult = result;
      await parser.append(result);
      const slideDeck = parser.getSlideDeck("");
      if (slideDeck.slides.length > 0) {
        yield slideDeck.slides[0];
        return;
      }
      yield null;
      return;
    } else if (task.agent === "gemini") {
      // Geminiはストリーミング未対応のため、通常実行
      const result = await chatWithGemini(task.prompt, {
        model: "gemini-pro",
        cwd: process.cwd(),
      });
      streamedResult = result;
      await parser.append(result);
      const slideDeck = parser.getSlideDeck("");
      if (slideDeck.slides.length > 0) {
        yield slideDeck.slides[0];
        return;
      }
      yield null;
      return;
    } else {
      yield null;
      return;
    }
    
    // ストリーミング処理
    for await (const chunk of stream) {
      streamedResult += chunk;
      await parser.append(chunk);
      const slideDeck = parser.getSlideDeck("");
      
      if (slideDeck.slides.length > 0) {
        const slide = slideDeck.slides[0];
        slide.slideNumber = task.slideNumber;
        
        // 進捗を送信（より細かく）
        if (sendProgress) {
          const progress = Math.min(100, (streamedResult.length / 1000) * 100);
          sendProgress(slide, progress);
          
          // 個別スライドの進捗をリアルタイムで送信
          if (sendEvent) {
            sendEvent("slide-progress", {
              slideNumber: task.slideNumber,
              progress: progress,
              agent: task.agent,
              status: progress < 50 ? 'generating' : progress < 90 ? 'processing' : 'finalizing',
            });
          }
        }
        
        yield slide;
      }
    }
    
    // 最終スライドを返す（画像を確実に含める）
    const finalSlideDeck = parser.getSlideDeck("");
    if (finalSlideDeck.slides.length > 0) {
      const slide = finalSlideDeck.slides[0];
      slide.slideNumber = task.slideNumber;
      
      // 画像が存在しない場合は、テーマに基づいて生成
      if (!slide.imageUrl && task.theme) {
        const { getImageForText } = await import("./image-search.js");
        try {
          slide.imageUrl = await getImageForText(
            `${task.theme} ${slide.title} ${slide.content}`,
            1920,
            1080,
            task.theme
          );
        } catch (error) {
          console.warn(`[ParallelSlideGenerator] 画像生成エラー [slide=${task.slideNumber}, error=${error}]`);
          // フォールバック画像
          slide.imageUrl = `https://source.unsplash.com/1920x1080/?${encodeURIComponent(slide.title.substring(0, 30))}`;
        }
      }
      
      console.log(`[ParallelSlideGenerator] スライド${task.slideNumber}が完成しました [title=${slide.title.substring(0, 30)}..., imageUrl=${slide.imageUrl ? 'あり' : 'なし'}]`);
      yield slide;
    } else {
      console.warn(`[ParallelSlideGenerator] スライド${task.slideNumber}の生成に失敗しました（スライドが見つかりません）`);
      yield null;
    }
  } catch (error: any) {
    console.error(`[ParallelSlideGenerator] エラー [task=${task.slideNumber}, agent=${task.agent}, error=${error.message}]`);
    yield null;
  }
}

/**
 * 複数のスライドを並列生成（ストリーミング対応）
 */
export async function* generateSlidesInParallel(
  topic: string,
  slideCount: number,
  agents: string[],
  sendEvent?: (event: string, data: any) => void,
  useSearch?: boolean, // Web検索とFigma Make参照を有効化
  theme?: string, // テーマ（画像検索用）
  parallelCount?: number // 並列数（デフォルト50）
): AsyncGenerator<Slide[], void, unknown> {
  const actualParallelCount = parallelCount || 16; // デフォルト16並列
  const tasks = createSlideTasks(topic, slideCount, agents, useSearch, theme);
  const slideMap = new Map<number, Slide>(); // スライド番号をキーとして管理（重複防止・順序保証）
  const completedTasks = new Set<number>();
  const processingTasks = new Set<number>(); // 処理中のタスクを追跡（重複防止）
  
  console.log(`[ParallelSlideGenerator] ${slideCount}枚のスライドを${tasks.length}個のタスクで並列実行開始（最大${actualParallelCount}並列、動的タスクキューイング）`);
  console.log(`[ParallelSlideGenerator] 並列実行設定: 最大${actualParallelCount}並列、タイムアウト10分、maxTokens=800`);
  
  // タスクキューイング：最大並列数で動的にタスクを処理
  const taskQueue: SlideGenerationTask[] = [...tasks];
  const activePromises: Set<Promise<void>> = new Set();
  
  // タスクを並列実行する関数
  const executeTask = async (task: SlideGenerationTask): Promise<void> => {
    const slideNumber = task.slideNumber; // スライド番号を変数に保存
    
    // 重複チェック：既に処理中の場合はスキップ
    if (processingTasks.has(slideNumber)) {
      console.warn(`[ParallelSlideGenerator] スライド${slideNumber}は既に処理中です。スキップします。`);
      return; // 早期リターン
    }
    
    // 処理中としてマーク
    processingTasks.add(slideNumber);
    
    try {
      let lastSlide: Slide | null = null; // 最後に生成されたスライドを保持
      
      // タイムアウトを設定（各スライドに30分のタイムアウト）
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`スライド${slideNumber}の生成がタイムアウトしました（10分経過）`));
        }, 600000); // 10分（30分から短縮）
      });
      
      const slidePromise = (async () => {
        // Marp形式のMarkdown生成関数を事前にインポート
        const { generateMarpMarkdown } = await import("./slide-generator.js");
        
        // 各スライドを独立して並列生成（ストリーミング）
        for await (const slide of generateSingleSlideStream(task, (slide, progress) => {
          if (slide && sendEvent) {
            // スライド番号を確実に設定（順序保証）
            const currentSlide: Slide = { ...slide, slideNumber };
            
            // 重複チェック：既に存在する場合は更新のみ
            if (slideMap.has(slideNumber)) {
              console.log(`[ParallelSlideGenerator] スライド${slideNumber}を更新します`);
            }
            
            lastSlide = currentSlide;
            slideMap.set(slideNumber, currentSlide); // スライド番号をキーとして保存（重複防止・順序保証）
            
            // 完成したスライドを送信（リアルタイム更新、即座に送信）
            // スライド番号でソートして順序を保証
            const completedSlides = Array.from(slideMap.values())
              .filter(s => s.slideNumber > 0) // 有効なスライドのみ
              .sort((a, b) => a.slideNumber - b.slideNumber); // スライド番号でソート（順序保証）
            
            const slideDeck: SlideDeck = {
              title: topic.substring(0, 50) + "...",
              slides: completedSlides,
              createdAt: new Date().toISOString(),
            };
            
            // Marp形式のMarkdownを生成（画像を含む）
            slideDeck.marpMarkdown = generateMarpMarkdown(slideDeck);
            
            // リアルタイム更新を即座に送信（デバウンスなし、真の並列実行）
            // 個別スライドの進捗を送信（1枚ずつ完成していく様子を見せる）
            sendEvent("slide-stream", {
              slideNumber: slideNumber,
              slide: currentSlide,
              slideDeck,
              progress,
              totalSlides: slideCount,
              completedSlides: completedSlides.length,
              agent: task.agent,
              isNewSlide: !slideMap.has(slideNumber), // 新しいスライドかどうか
              timestamp: Date.now(), // タイムスタンプで順序を追跡
            });
          }
        }, useSearch, sendEvent)) {
          // 最後のスライドを保存（スライド番号を確実に設定）
          // lastSlideは既にslideNumberが設定されているため、そのまま使用
          if (lastSlide) {
            slideMap.set(slideNumber, lastSlide);
          }
        }
      })();
      
      // タイムアウトとスライド生成の競合
      await Promise.race([slidePromise, timeoutPromise]);
      
      // 処理完了をマーク
      completedTasks.add(slideNumber);
      processingTasks.delete(slideNumber);
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      console.error(`[ParallelSlideGenerator] タスクエラー [task=${slideNumber}, error=${errorMessage}]`);
      
      // タイムアウトエラーの場合は、部分的な結果を送信
      if (errorMessage.includes('タイムアウト') || errorMessage.includes('Timed out')) {
        if (sendEvent) {
          sendEvent("slide-error", {
            slideNumber: slideNumber,
            error: `スライド${slideNumber}の生成がタイムアウトしました`,
            totalSlides: slideCount,
            completedSlides: slideMap.size,
          });
        }
      }
      
      completedTasks.add(slideNumber);
      processingTasks.delete(slideNumber);
    }
  };
  
  // 動的タスクキューイング：最大並列数でタスクを処理
  // 開始時に最大並列数まで一気に開始（高速化）
  const initialTasks = taskQueue.splice(0, actualParallelCount);
  initialTasks.forEach(task => {
    const promise = executeTask(task).finally(() => {
      activePromises.delete(promise);
    });
    activePromises.add(promise);
  });
  
  console.log(`[ParallelSlideGenerator] ${initialTasks.length}個のタスクを同時に開始しました（最大${actualParallelCount}並列）`);
  
  while (taskQueue.length > 0 || activePromises.size > 0) {
    // 空きスロットがある場合は新しいタスクを開始
    while (activePromises.size < actualParallelCount && taskQueue.length > 0) {
      const task = taskQueue.shift();
      if (task) {
        const promise = executeTask(task).finally(() => {
          activePromises.delete(promise);
        });
        activePromises.add(promise);
        console.log(`[ParallelSlideGenerator] タスク${task.slideNumber}を開始しました（現在${activePromises.size}並列）`);
      }
    }
    
    // 1つでも完了するまで待つ
    if (activePromises.size > 0) {
      await Promise.race(Array.from(activePromises));
    }
  }
  
  // すべてのタスクが完了したことを確認
  console.log(`[ParallelSlideGenerator] すべてのタスクが完了しました（${completedTasks.size}/${slideCount}）`);
  
  // 完了したスライドを送信（順序保証：スライド番号でソート）
  const finalSlides = Array.from(slideMap.values())
    .filter(s => s.slideNumber > 0) // 有効なスライドのみ
    .sort((a, b) => a.slideNumber - b.slideNumber); // スライド番号でソート（順序保証）
  
  console.log(`[ParallelSlideGenerator] ${finalSlides.length}/${slideCount}枚のスライドが完成しました（順序: ${finalSlides.map(s => s.slideNumber).join(', ')}）`);
  
  // 最終結果を送信
  if (finalSlides.length > 0 && sendEvent) {
    const slideDeck: SlideDeck = {
      title: topic.substring(0, 50) + "...",
      slides: finalSlides,
      createdAt: new Date().toISOString(),
    };
    
    const { generateMarpMarkdown } = await import("./slide-generator.js");
    slideDeck.marpMarkdown = generateMarpMarkdown(slideDeck);
    
    // 完了イベントを確実に送信
    sendEvent("slide-complete", {
      slideDeck,
      completedSlides: finalSlides.length,
      totalSlides: slideCount,
      message: `スライド生成が完了しました（${finalSlides.length}/${slideCount}枚）`,
    });
    
    console.log(`[ParallelSlideGenerator] 完了イベントを送信しました [slides=${finalSlides.length}]`);
  }
  
  yield finalSlides;
}

