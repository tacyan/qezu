/**
 * インクリメンタルスライドパーサー
 * 文字列を1文字ずつ受け取って、リアルタイムでスライドを更新する
 * 1スライド1センテンス形式に対応
 * 
 * @module services/incremental-slide-parser
 */

import { Slide, SlideDeck } from "./slide-generator.js";
import { getImageForText } from "./image-search.js";
import { generateColorPalette } from "./color-palette.js";
import { generateImageSearchKeyword } from "./prompt-parser.js";

export class IncrementalSlideParser {
  private buffer: string = "";
  private slides: Slide[] = [];
  private currentSlide: Partial<Slide> | null = null;
  private slideNumber: number = 1;
  private seenSlideTitles: Set<string> = new Set();
  private theme?: string; // テーマ（画像検索用）
  
  /**
   * テーマを設定
   */
  setTheme(theme: string): void {
    this.theme = theme;
  }
  
  /**
   * 画像URLを生成（Webから高品質な画像を検索）
   */
  private async generateImageUrl(keyword: string, slideTitle?: string, slideContent?: string): Promise<string> {
    try {
      // prompt-parserを使用して画像検索キーワードを生成
      const searchKeyword = generateImageSearchKeyword(keyword, slideTitle, slideContent);
      const finalKeyword = this.theme || searchKeyword;
      return await getImageForText(finalKeyword, 1920, 1080, this.theme);
    } catch (error) {
      // フォールバック
      const keywordToUse = this.theme || keyword;
      const encodedKeyword = encodeURIComponent(keywordToUse.substring(0, 50).trim());
      return `https://source.unsplash.com/1920x1080/?${encodedKeyword || 'presentation'}`;
    }
  }
  
  /**
   * テキストから画像キーワードを抽出
   */
  private extractImageKeyword(text: string): string {
    // テーマが設定されている場合は優先
    if (this.theme) {
      return this.theme;
    }
    
    // タイトルまたは最初の数単語を使用
    const words = text.split(/\s+/).filter(w => w.length > 2);
    return words.slice(0, 3).join(' ') || 'presentation';
  }
  
  /**
   * センテンスを分割（. ! ? で終わる文を検出）
   */
  private splitIntoSentences(text: string): string[] {
    // センテンス区切り文字で分割
    const sentences = text.split(/([.!?。！？]\s+)/).filter(s => s.trim());
    const result: string[] = [];
    let current = '';
    
    for (let i = 0; i < sentences.length; i++) {
      current += sentences[i];
      if (sentences[i].match(/[.!?。！？]\s*$/)) {
        result.push(current.trim());
        current = '';
      }
    }
    
    if (current.trim()) {
      result.push(current.trim());
    }
    
    return result.filter(s => s.length > 5); // 短すぎる文は除外
  }

  /**
   * 新しい文字を追加してスライドを更新
   */
  async append(chunk: string): Promise<Slide[]> {
    this.buffer += chunk;
    return await this.parse();
  }

  /**
   * 現在のバッファからスライドを解析
   * 1スライド1センテンス形式に対応
   */
  private async parse(): Promise<Slide[]> {
    const newSlides: Slide[] = [];
    
    // まず、標準的なMarkdown形式（## タイトル + コンテンツ）をチェック
    const markdownSlides = await this.parseMarkdownFormat();
    if (markdownSlides.length > 0) {
      this.slides = markdownSlides;
      return markdownSlides;
    }
    
    // Markdown形式でない場合、1センテンスごとにスライドを分割
    const sentenceSlides = await this.parseSentenceFormat();
    if (sentenceSlides.length > 0) {
      this.slides = sentenceSlides;
      return sentenceSlides;
    }
    
    return this.slides;
  }
  
  /**
   * Markdown形式（## タイトル + コンテンツ）をパース
   */
  private async parseMarkdownFormat(): Promise<Slide[]> {
    const slides: Slide[] = [];
    const lines = this.buffer.split('\n');
    let currentSlide: Partial<Slide> | null = null;
    let slideNumber = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // スライドタイトルの検出（## または # で始まる）
      if (line.match(/^#{1,2}\s+(.+)$/)) {
        if (currentSlide && currentSlide.title) {
          const title = currentSlide.title.trim();
          if (!this.seenSlideTitles.has(title)) {
            const content = (currentSlide.content || '').trim();
            // コンテンツを1センテンスに制限
            const firstSentence = this.splitIntoSentences(content)[0] || content;
            const imageKeyword = this.extractImageKeyword(title + ' ' + firstSentence);
            const fullText = title + ' ' + firstSentence;
            const colorPalette = generateColorPalette(fullText);
            const imageUrl = await this.generateImageUrl(imageKeyword, title, firstSentence);
            
            slides.push({
              title,
              content: firstSentence,
              slideNumber: slideNumber++,
              imageUrl,
              colorPalette,
            });
            this.seenSlideTitles.add(title);
          }
        }
        currentSlide = {
          title: line.replace(/^#{1,2}\s+/, '').trim(),
          content: '',
        };
      } else if (line.match(/^---$/)) {
        // スライド区切り
        if (currentSlide && currentSlide.title) {
          const title = currentSlide.title.trim();
          if (!this.seenSlideTitles.has(title)) {
            const content = (currentSlide.content || '').trim();
            const firstSentence = this.splitIntoSentences(content)[0] || content;
            const imageKeyword = this.extractImageKeyword(title + ' ' + firstSentence);
            const fullText = title + ' ' + firstSentence;
            const colorPalette = generateColorPalette(fullText);
            const imageUrl = await this.generateImageUrl(imageKeyword, title, firstSentence);
            
            slides.push({
              title,
              content: firstSentence,
              slideNumber: slideNumber++,
              imageUrl,
              colorPalette,
            });
            this.seenSlideTitles.add(title);
          }
          currentSlide = null;
        }
      } else if (currentSlide) {
        // スライドコンテンツ
        currentSlide.content += (currentSlide.content ? '\n' : '') + line;
      }
    }
    
    // 最後のスライドを追加
    if (currentSlide && currentSlide.title) {
      const title = currentSlide.title.trim();
      if (!this.seenSlideTitles.has(title)) {
        const content = (currentSlide.content || '').trim();
        const firstSentence = this.splitIntoSentences(content)[0] || content;
        const imageKeyword = this.extractImageKeyword(title + ' ' + firstSentence);
        const fullText = title + ' ' + firstSentence;
        const colorPalette = generateColorPalette(fullText);
        const imageUrl = await this.generateImageUrl(imageKeyword);
        
        slides.push({
          title,
          content: firstSentence,
          slideNumber: slideNumber++,
          imageUrl,
          colorPalette,
        });
        this.seenSlideTitles.add(title);
      }
    }
    
    return slides;
  }
  
  /**
   * 1センテンスごとにスライドを分割
   */
  private async parseSentenceFormat(): Promise<Slide[]> {
    const slides: Slide[] = [];
    
    // "---" で区切られたセクションをチェック
    const sections = this.buffer.split(/\n---\n/).filter(s => s.trim());
    if (sections.length > 1) {
      for (let idx = 0; idx < sections.length; idx++) {
        const section = sections[idx];
        const sectionLines = section.trim().split('\n');
        const firstLine = sectionLines[0] || '';
        const titleMatch = firstLine.match(/^#+\s+(.+)$/);
        const title = titleMatch ? titleMatch[1] : firstLine.substring(0, 50) || `Slide ${idx + 1}`;
        const content = titleMatch ? sectionLines.slice(1).join('\n') : section;
        
        // 1センテンスに制限
        const firstSentence = this.splitIntoSentences(content)[0] || content.trim();
        const imageKeyword = this.extractImageKeyword(title + ' ' + firstSentence);
        const fullText = title + ' ' + firstSentence;
        const colorPalette = generateColorPalette(fullText);
        const imageUrl = await this.generateImageUrl(imageKeyword, title, firstSentence);
        
        slides.push({
          title: title.substring(0, 100),
          content: firstSentence,
          slideNumber: idx + 1,
          imageUrl,
          colorPalette,
        });
      }
      return slides;
    }
    
    // 段落で分割
    const paragraphs = this.buffer.split(/\n\n+/).filter(p => p.trim());
    for (let idx = 0; idx < paragraphs.length; idx++) {
      const para = paragraphs[idx];
      const lines = para.trim().split('\n');
      const firstLine = lines[0] || '';
      const titleMatch = firstLine.match(/^#+\s+(.+)$/);
      
      let title: string;
      let content: string;
      
      if (titleMatch) {
        title = titleMatch[1].replace(/^#+\s+/, '');
        content = lines.slice(1).join('\n');
      } else {
        // タイトルがない場合、最初のセンテンスをタイトルに
        const sentences = this.splitIntoSentences(para);
        title = sentences[0]?.substring(0, 50) || `Slide ${idx + 1}`;
        content = sentences.slice(1).join(' ') || sentences[0] || para;
      }
      
      // 1センテンスに制限
      const firstSentence = this.splitIntoSentences(content)[0] || content.trim();
      const imageKeyword = this.extractImageKeyword(title + ' ' + firstSentence);
      const fullText = title + ' ' + firstSentence;
      const colorPalette = generateColorPalette(fullText);
      const imageUrl = await this.generateImageUrl(imageKeyword);
      
      slides.push({
        title: title.substring(0, 100),
        content: firstSentence,
        slideNumber: idx + 1,
        imageUrl,
        colorPalette,
      });
    }
    
    // まだスライドが見つからない場合、センテンスごとに分割
    if (slides.length === 0 && this.buffer.trim()) {
      const sentences = this.splitIntoSentences(this.buffer);
      for (let idx = 0; idx < sentences.length; idx++) {
        const sentence = sentences[idx];
        const words = sentence.split(/\s+/).slice(0, 5);
        const title = words.join(' ') || `Slide ${idx + 1}`;
        const imageKeyword = this.extractImageKeyword(sentence);
        const fullText = title + ' ' + sentence;
        const colorPalette = generateColorPalette(fullText);
        const imageUrl = await this.generateImageUrl(imageKeyword, title, sentence);
        
        slides.push({
          title: title.substring(0, 100),
          content: sentence,
          slideNumber: idx + 1,
          imageUrl,
          colorPalette,
        });
      }
    }
    
    return slides;
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
    this.seenSlideTitles.clear();
  }
}
