/**
 * 画像検索サービス
 * Webから高品質な画像を検索・取得
 * 
 * @module services/image-search
 */

/**
 * Unsplash APIを使用して画像を検索
 */
export async function searchUnsplashImage(keyword: string, width: number = 800, height: number = 600): Promise<string> {
  const encodedKeyword = encodeURIComponent(keyword.trim());
  if (!encodedKeyword) {
    return `https://source.unsplash.com/${width}x${height}/?presentation`;
  }
  // Unsplash Source API（より確実な方法）
  return `https://source.unsplash.com/${width}x${height}/?${encodedKeyword}`;
}

/**
 * Pexels APIを使用して画像を検索（より高品質）
 */
export async function searchPexelsImage(keyword: string, width: number = 1920, height: number = 1080): Promise<string> {
  const encodedKeyword = encodeURIComponent(keyword.trim());
  if (!encodedKeyword) {
    return `https://images.pexels.com/photos/1591055/pexels-photo-1591055.jpeg?auto=compress&cs=tinysrgb&w=${width}&h=${height}`;
  }
  // Pexelsの検索API（APIキー不要の方法）
  return `https://images.pexels.com/photos/search/${encodedKeyword}/?auto=compress&cs=tinysrgb&w=${width}&h=${height}`;
}

/**
 * Lorem Picsumを使用（フォールバック）
 */
export function getLoremPicsumImage(width: number = 800, height: number = 600, seed?: number): string {
  const seedParam = seed ? `/${seed}` : '';
  return `https://picsum.photos${seedParam}/${width}/${height}`;
}

/**
 * テキストから最適な画像URLを取得
 */
export async function getImageForText(
  text: string, 
  width: number = 1920, 
  height: number = 1080,
  theme?: string
): Promise<string> {
  // prompt-parserから画像検索キーワードを生成
  const { generateImageSearchKeyword } = await import("./prompt-parser.js");
  
  // テーマに基づいてキーワードを生成
  const keyword = generateImageSearchKeyword(text, undefined, undefined);
  const searchKeyword = theme || keyword;
  
  // 複数の画像ソースを試す
  try {
    // まずUnsplashを試す（日本語キーワードにも対応）
    return await searchUnsplashImage(searchKeyword, width, height);
  } catch {
    try {
      // 次にPexelsを試す
      return await searchPexelsImage(searchKeyword, width, height);
    } catch {
      // 最後にLorem Picsumを使用
      const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return getLoremPicsumImage(width, height, seed);
    }
  }
}

/**
 * テキストからキーワードを抽出（日本語対応）
 */
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  
  // 日本語のキーワードを抽出（カタカナ、ひらがな、漢字を含む）
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g;
  const japaneseMatches = text.match(japanesePattern);
  if (japaneseMatches) {
    keywords.push(...japaneseMatches.filter(word => word.length >= 2 && word.length <= 10));
  }
  
  // 英語のキーワードを抽出
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'about', 'create', 'slide', 'format', 'content', 'design', 'requirements', 'professional', 'modern', 'visually', 'appealing', 'clear', 'visual', 'hierarchy', 'balanced', 'composition', 'proper', 'spacing', 'appropriate', 'colors', 'based', 'tone']);
  
  const englishWords = text
    .toLowerCase()
    .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word) && !/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(word));
  
  keywords.push(...englishWords);
  
  // 重複を除去し、上位5つを返す（日本語を優先）
  const uniqueKeywords = Array.from(new Set(keywords));
  return uniqueKeywords.slice(0, 5);
}

/**
 * テーマに基づいて画像キーワードを生成
 */
export function generateImageKeyword(text: string, theme?: string): string {
  // テーマが指定されている場合は優先
  if (theme) {
    return theme;
  }
  
  // テキストからキーワードを抽出
  const keywords = extractKeywords(text);
  
  // 重要なキーワードを優先（アニメ、映画、キャラクター名など）
  const importantKeywords = keywords.filter(k => 
    k.includes('鬼滅') || 
    k.includes('刃') || 
    k.includes('映画') || 
    k.includes('アニメ') ||
    k.includes('demon') ||
    k.includes('slayer') ||
    k.includes('movie') ||
    k.includes('anime')
  );
  
  if (importantKeywords.length > 0) {
    return importantKeywords.join(' ');
  }
  
  // 通常のキーワードを使用
  return keywords.join(' ') || 'presentation';
}

