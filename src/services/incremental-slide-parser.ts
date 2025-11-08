/**
 * インクリメンタルスライドパーサー
 * 文字列を1文字ずつ受け取って、リアルタイムでスライドを更新する
 * 
 * @module services/incremental-slide-parser
 */

import { Slide, SlideDeck } from "./slide-generator.js";

export class IncrementalSlideParser {
  private buffer: string = "";
  private slides: Slide[] = [];
  private currentSlide: Partial<Slide> | null = null;
  private slideNumber: number = 1;

  /**
   * 新しい文字を追加してスライドを更新
   */
  append(chunk: string): Slide[] {
    this.buffer += chunk;
    return this.parse();
  }

  /**
   * 現在のバッファからスライドを解析
   */
  private parse(): Slide[] {
    const lines = this.buffer.split('\n');
    const newSlides: Slide[] = [];
    let currentSlide: Partial<Slide> | null = null;
    let slideNumber = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // スライドタイトルの検出（## または # で始まる）
      if (line.match(/^#{1,2}\s+(.+)$/)) {
        if (currentSlide) {
          newSlides.push({
            title: currentSlide.title || `Slide ${slideNumber}`,
            content: currentSlide.content || '',
            slideNumber: slideNumber++,
          });
        }
        currentSlide = {
          title: line.replace(/^#{1,2}\s+/, '').trim(),
          content: '',
        };
      } else if (line.match(/^---$/)) {
        // スライド区切り
        if (currentSlide) {
          newSlides.push({
            title: currentSlide.title || `Slide ${slideNumber}`,
            content: currentSlide.content || '',
            slideNumber: slideNumber++,
          });
          currentSlide = null;
        }
      } else if (currentSlide) {
        // スライドコンテンツ
        currentSlide.content += (currentSlide.content ? '\n' : '') + line;
      }
    }
    
    // 最後のスライドを追加（まだ完成していない可能性がある）
    if (currentSlide) {
      newSlides.push({
        title: currentSlide.title || `Slide ${slideNumber}`,
        content: currentSlide.content || '',
        slideNumber: slideNumber++,
      });
    }

    // "---" で区切られたセクションもチェック
    if (newSlides.length === 0) {
      const sections = this.buffer.split(/\n---\n/).filter(s => s.trim());
      if (sections.length > 1) {
        sections.forEach((section, idx) => {
          const sectionLines = section.trim().split('\n');
          const firstLine = sectionLines[0] || '';
          const titleMatch = firstLine.match(/^#+\s+(.+)$/);
          const title = titleMatch ? titleMatch[1] : firstLine.substring(0, 50) || `Slide ${idx + 1}`;
          const content = titleMatch ? sectionLines.slice(1).join('\n') : section;
          
          newSlides.push({
            title: title.substring(0, 100),
            content: content.trim(),
            slideNumber: idx + 1,
          });
        });
      }
    }

    // スライドが見つからない場合、段落で分割
    if (newSlides.length === 0) {
      const paragraphs = this.buffer.split(/\n\n+/).filter(p => p.trim());
      paragraphs.forEach((para, idx) => {
        const titleMatch = para.match(/^(.+?)\n/);
        const title = titleMatch ? titleMatch[1].replace(/^#+\s+/, '') : `Slide ${idx + 1}`;
        const content = titleMatch ? para.substring(titleMatch[0].length) : para;
        
        newSlides.push({
          title: title.substring(0, 100),
          content: content.trim(),
          slideNumber: idx + 1,
        });
      });
    }

    // まだスライドが見つからない場合、全体を1つのスライドとして扱う
    if (newSlides.length === 0 && this.buffer.trim()) {
      const firstLine = this.buffer.split('\n')[0] || '';
      newSlides.push({
        title: firstLine.substring(0, 100) || 'Slide 1',
        content: this.buffer.trim(),
        slideNumber: 1,
      });
    }

    this.slides = newSlides;
    return newSlides;
  }

  /**
   * 現在のスライドデッキを取得
   */
  getSlideDeck(title: string): SlideDeck {
    return {
      title,
      slides: this.slides,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * リセット
   */
  reset(): void {
    this.buffer = "";
    this.slides = [];
    this.currentSlide = null;
    this.slideNumber = 1;
  }
}

