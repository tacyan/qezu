/**
 * カラーパレットサービス
 * テキストの内容に基づいて適切な色を選択
 * 
 * @module services/color-palette
 */

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  gradient: string;
}

/**
 * テキストから感情・トーンを分析してカラーパレットを生成
 */
export function generateColorPalette(text: string): ColorPalette {
  const tone = analyzeTone(text);
  return getPaletteForTone(tone);
}

/**
 * テキストのトーンを分析
 */
function analyzeTone(text: string): string {
  const lowerText = text.toLowerCase();
  
  // ポジティブなキーワード
  const positiveKeywords = ['success', 'achievement', 'growth', 'innovation', 'future', 'opportunity', 'excellent', 'great', 'amazing', 'wonderful', 'best', 'top', 'win', 'victory', 'happy', 'joy', 'celebration'];
  
  // ネガティブなキーワード
  const negativeKeywords = ['problem', 'issue', 'challenge', 'risk', 'danger', 'warning', 'error', 'failure', 'loss', 'crisis', 'difficult', 'hard'];
  
  // テクノロジー関連
  const techKeywords = ['technology', 'digital', 'ai', 'machine learning', 'data', 'cloud', 'software', 'code', 'programming', 'algorithm', 'system', 'platform'];
  
  // ビジネス関連
  const businessKeywords = ['business', 'strategy', 'market', 'revenue', 'profit', 'sales', 'customer', 'client', 'product', 'service', 'company', 'enterprise'];
  
  // クリエイティブ関連
  const creativeKeywords = ['design', 'creative', 'art', 'visual', 'aesthetic', 'beautiful', 'elegant', 'style', 'brand', 'identity'];
  
  // カウント
  let positiveCount = 0;
  let negativeCount = 0;
  let techCount = 0;
  let businessCount = 0;
  let creativeCount = 0;
  
  positiveKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) positiveCount++;
  });
  
  negativeKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) negativeCount++;
  });
  
  techKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) techCount++;
  });
  
  businessKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) businessCount++;
  });
  
  creativeKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) creativeCount++;
  });
  
  // トーンを決定
  if (creativeCount > 0) return 'creative';
  if (techCount > 0) return 'tech';
  if (businessCount > 0) return 'business';
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  
  return 'neutral';
}

/**
 * トーンに基づいてカラーパレットを取得
 */
function getPaletteForTone(tone: string): ColorPalette {
  const palettes: Record<string, ColorPalette> = {
    positive: {
      primary: '#4CAF50',
      secondary: '#81C784',
      accent: '#FFC107',
      background: '#E8F5E9',
      text: '#1B5E20',
      gradient: 'linear-gradient(135deg, #4CAF50 0%, #81C784 100%)',
    },
    negative: {
      primary: '#F44336',
      secondary: '#E57373',
      accent: '#FF9800',
      background: '#FFEBEE',
      text: '#B71C1C',
      gradient: 'linear-gradient(135deg, #F44336 0%, #E57373 100%)',
    },
    tech: {
      primary: '#2196F3',
      secondary: '#64B5F6',
      accent: '#00BCD4',
      background: '#E3F2FD',
      text: '#0D47A1',
      gradient: 'linear-gradient(135deg, #2196F3 0%, #64B5F6 50%, #00BCD4 100%)',
    },
    business: {
      primary: '#673AB7',
      secondary: '#9575CD',
      accent: '#FF5722',
      background: '#EDE7F6',
      text: '#311B92',
      gradient: 'linear-gradient(135deg, #673AB7 0%, #9575CD 100%)',
    },
    creative: {
      primary: '#E91E63',
      secondary: '#F06292',
      accent: '#FF4081',
      background: '#FCE4EC',
      text: '#880E4F',
      gradient: 'linear-gradient(135deg, #E91E63 0%, #F06292 50%, #FF4081 100%)',
    },
    neutral: {
      primary: '#607D8B',
      secondary: '#90A4AE',
      accent: '#FF9800',
      background: '#ECEFF1',
      text: '#263238',
      gradient: 'linear-gradient(135deg, #607D8B 0%, #90A4AE 100%)',
    },
  };
  
  return palettes[tone] || palettes.neutral;
}

/**
 * グラデーションを生成
 */
export function generateGradient(colors: string[], angle: number = 135): string {
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
}

