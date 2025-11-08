/**
 * プロンプト解析サービス
 * プロンプトからスライド枚数やテーマを抽出
 * 
 * @module services/prompt-parser
 */

/**
 * プロンプトからスライド枚数を抽出
 */
export function extractSlideCount(prompt: string): number {
  // 「30枚」「30スライド」「30 slides」などのパターンを検出
  const patterns = [
    /(\d+)\s*枚/,
    /(\d+)\s*スライド/,
    /(\d+)\s*slides?/i,
    /(\d+)\s*slide\s*deck/i,
    /slide\s*deck\s*of\s*(\d+)/i,
    /(\d+)\s*ページ/,
    /(\d+)\s*pages?/i,
  ];
  
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match) {
      const count = parseInt(match[1], 10);
      if (count > 0 && count <= 100) {
        return count;
      }
    }
  }
  
  // デフォルトは16枚
  return 16;
}

/**
 * プロンプトからテーマを抽出（画像検索用）
 */
export function extractTheme(prompt: string): string {
  // よくあるテーマのキーワードを抽出
  const themeKeywords: string[] = [];
  
  // アニメ・映画関連（優先度が高い）
  const animePatterns = [
    /鬼滅の刃/,
    /キメツノヤイバ/,
    /demon\s*slayer/i,
    /([^\s]+)\s*の映画/,
    /([^\s]+)\s*の番宣/,
    /([^\s]+)\s*のプロモーション/i,
    /([^\s]+)\s*の宣伝/i,
    /([^\s]+)\s*の紹介/i,
  ];
  
  for (const pattern of animePatterns) {
    const match = prompt.match(pattern);
    if (match) {
      if (match[1]) {
        themeKeywords.push(match[1]);
      } else {
        // 完全一致の場合はそのまま使用
        const matched = match[0];
        if (matched.includes('鬼滅') || matched.includes('demon') || matched.includes('slayer')) {
          themeKeywords.push(matched);
        } else if (match[1]) {
          themeKeywords.push(match[1]);
        }
      }
    }
  }
  
  // 一般的なテーマキーワードを抽出（名詞句）
  const generalPatterns = [
    /([^\s]+)\s*について/,
    /([^\s]+)\s*の/,
    /about\s+([^\s]+)/i,
    /regarding\s+([^\s]+)/i,
    /([^\s]+)\s*を/,
    /([^\s]+)\s*が/,
  ];
  
  for (const pattern of generalPatterns) {
    const match = prompt.match(pattern);
    if (match && match[1] && match[1].length > 2 && match[1].length < 20) {
      // ストップワードを除外
      const stopWords = ['まとめて', '作成', '生成', '作る', 'create', 'generate', 'make'];
      if (!stopWords.includes(match[1])) {
        themeKeywords.push(match[1]);
      }
    }
  }
  
  // 最初の3つのキーワードを結合（重複を除去）
  const uniqueKeywords = Array.from(new Set(themeKeywords));
  if (uniqueKeywords.length > 0) {
    return uniqueKeywords.slice(0, 3).join(' ');
  }
  
  // テーマが見つからない場合は、プロンプトの最初の30文字からキーワードを抽出
  const fallbackText = prompt.substring(0, 50);
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g;
  const japaneseMatches = fallbackText.match(japanesePattern);
  if (japaneseMatches && japaneseMatches.length > 0) {
    return japaneseMatches[0];
  }
  
  // 最後の手段：プロンプトの最初の20文字を使用
  return prompt.substring(0, 20).trim();
}

/**
 * プロンプトから画像検索キーワードを生成
 */
export function generateImageSearchKeyword(prompt: string, slideTitle?: string, slideContent?: string): string {
  // スライドのタイトルとコンテンツからもキーワードを抽出
  const allText = `${prompt} ${slideTitle || ''} ${slideContent || ''}`;
  
  // テーマを抽出
  const theme = extractTheme(prompt);
  
  // スライド固有のキーワードを抽出
  const slideKeywords: string[] = [];
  
  // 日本語のキーワードを抽出（重要度の高いものを優先）
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g;
  const japaneseMatches = allText.match(japanesePattern);
  if (japaneseMatches) {
    // 重要なキーワードを優先（アニメ、映画、キャラクター名など）
    const importantKeywords = japaneseMatches.filter(word => 
      word.includes('鬼滅') || 
      word.includes('刃') || 
      word.includes('映画') || 
      word.includes('アニメ') ||
      word.length >= 3 && word.length <= 8
    );
    slideKeywords.push(...importantKeywords.slice(0, 5));
  }
  
  // 英語のキーワードを抽出（ストップワードを除外）
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'about', 'create', 'slide', 'format', 'content', 'design', 'requirements', 'professional', 'modern', 'visually', 'appealing', 'clear', 'visual', 'hierarchy', 'balanced', 'composition', 'proper', 'spacing', 'appropriate', 'colors', 'based', 'tone']);
  
  const englishWords = allText
    .toLowerCase()
    .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word) && !/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(word));
  
  slideKeywords.push(...englishWords.slice(0, 3));
  
  // テーマを最優先し、スライド固有のキーワードを追加
  const keywords = [theme, ...slideKeywords.slice(0, 3)].filter(k => k && k.length > 0);
  
  return keywords.join(' ') || 'presentation';
}

