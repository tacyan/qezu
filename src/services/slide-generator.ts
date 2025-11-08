/**
 * スライド生成サービス
 * マルチエージェントの結果からスライドを生成する
 * 
 * @module services/slide-generator
 */

export interface Slide {
  title: string;
  content: string;
  slideNumber: number;
  imageUrl?: string; // 画像URL（オプション）
  colorPalette?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    gradient: string;
  }; // カラーパレット（オプション）
}

export interface SlideDeck {
  title: string;
  slides: Slide[];
  createdAt: string;
  marpMarkdown?: string; // Marp形式のMarkdown
}

/**
 * マークダウンテキストからスライドを抽出
 */
export function parseSlidesFromMarkdown(text: string): Slide[] {
  const slides: Slide[] = [];
  const lines = text.split('\n');
  
  let currentSlide: Partial<Slide> | null = null;
  let slideNumber = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // スライドタイトルの検出（## または # で始まる）
    if (line.match(/^#{1,2}\s+(.+)$/)) {
      if (currentSlide) {
        slides.push({
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
        slides.push({
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
  
  // 最後のスライドを追加
  if (currentSlide) {
    slides.push({
      title: currentSlide.title || `Slide ${slideNumber}`,
      content: currentSlide.content || '',
      slideNumber: slideNumber++,
    });
  }
  
  // スライドが見つからない場合、テキスト全体を1つのスライドとして扱う
  if (slides.length === 0) {
    // "---" で区切られたセクションを探す
    const sections = text.split(/\n---\n/).filter(s => s.trim());
    if (sections.length > 1) {
      sections.forEach((section, idx) => {
        const lines = section.trim().split('\n');
        const firstLine = lines[0] || '';
        const titleMatch = firstLine.match(/^#+\s+(.+)$/);
        const title = titleMatch ? titleMatch[1] : firstLine.substring(0, 50) || `Slide ${idx + 1}`;
        const content = titleMatch ? lines.slice(1).join('\n') : section;
        
        slides.push({
          title: title.substring(0, 100),
          content: content.trim(),
          slideNumber: idx + 1,
        });
      });
    } else {
      // 段落で分割
      const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
      paragraphs.forEach((para, idx) => {
        const titleMatch = para.match(/^(.+?)\n/);
        const title = titleMatch ? titleMatch[1].replace(/^#+\s+/, '') : `Slide ${idx + 1}`;
        const content = titleMatch ? para.substring(titleMatch[0].length) : para;
        
        slides.push({
          title: title.substring(0, 100),
          content: content.trim(),
          slideNumber: idx + 1,
        });
      });
      
      if (slides.length === 0) {
        slides.push({
          title: 'Slide 1',
          content: text.trim(),
          slideNumber: 1,
        });
      }
    }
  }
  
  return slides;
}

/**
 * スライドデッキをMarp形式のMarkdownに変換
 */
export function generateMarpMarkdown(slideDeck: SlideDeck): string {
  const marpHeader = `---
marp: true
theme: default
paginate: true
header: '${escapeHtml(slideDeck.title)}'
footer: '${new Date(slideDeck.createdAt).toLocaleDateString('ja-JP')}'
---

`;

  const slidesMarkdown = slideDeck.slides
    .sort((a, b) => a.slideNumber - b.slideNumber) // スライド番号でソート（順序保証）
    .map((slide, index) => {
      // 画像を含める
      const imageSection = slide.imageUrl 
        ? `![bg](${slide.imageUrl})\n\n` 
        : '';
      
      const slideContent = `${imageSection}# ${slide.title}\n\n${slide.content}`;
      return slideContent;
    })
    .join('\n\n---\n\n');

  return marpHeader + slidesMarkdown;
}

/**
 * スライドデッキをHTMLに変換
 */
export function generateSlideHTML(slideDeck: SlideDeck): string {
  const slidesHTML = slideDeck.slides
    .sort((a, b) => a.slideNumber - b.slideNumber) // スライド番号でソート（順序保証）
    .map((slide, idx) => {
      // カラーパレットを取得（デフォルトはグラデーション）
      const palette = slide.colorPalette || {
        primary: '#667eea',
        secondary: '#764ba2',
        accent: '#f093fb',
        background: '#1a1a1a',
        text: '#ffffff',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      };
      
      // 画像URLが存在しない場合は、テーマに基づいて生成
      const imageUrl = slide.imageUrl || `https://source.unsplash.com/1920x1080/?${encodeURIComponent(slide.title.substring(0, 30))}`;
      
      // コンテンツの長さに応じて画像のサイズを調整（1ページに収まるように）
      const contentLength = slide.content.length;
      const imageHeight = contentLength > 100 ? '40%' : contentLength > 50 ? '50%' : '60%';
      
      return `
    <div class="slide" data-slide-number="${slide.slideNumber}" style="animation: slideIn 0.5s ease-out ${idx * 0.1}s both; background: ${palette.gradient};">
      <div class="slide-image-container" style="height: ${imageHeight};">
        <img src="${imageUrl}" alt="${escapeHtml(slide.title)}" class="slide-image" loading="lazy" />
      </div>
      <div class="slide-header">
        <span class="slide-number" style="color: ${palette.text};">${slide.slideNumber} / ${slideDeck.slides.length}</span>
        <h2 class="slide-title" style="color: ${palette.text};">${escapeHtml(slide.title)}</h2>
      </div>
      <div class="slide-content" style="color: ${palette.text}; flex: 1; display: flex; align-items: center; justify-content: center;">
        ${markdownToHTML(slide.content)}
      </div>
    </div>
  `;
  }).join('\n');
  
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(slideDeck.title)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #1a1a1a;
      color: #fff;
      overflow-x: hidden;
    }
    
    .slide-container {
      display: flex;
      transition: transform 0.5s ease;
      height: 100vh;
    }
    
    .slide {
      min-width: 100vw;
      height: 100vh;
      padding: 60px 80px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 50px rgba(0, 0, 0, 0.3);
      position: relative;
      overflow: hidden;
      opacity: 0;
      animation: slideIn 0.6s ease-out forwards;
    }
    
    .slide.new-slide {
      animation: slideInNew 0.8s ease-out forwards;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(50px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }
    
    @keyframes slideInNew {
      0% {
        opacity: 0;
        transform: translateX(100px) scale(0.9);
      }
      50% {
        transform: translateX(-10px) scale(1.02);
      }
      100% {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }
    
    .slide-image-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      opacity: 0.2;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
      overflow: hidden;
    }
    
    .slide-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      filter: blur(1px) brightness(0.6);
      transform: scale(1.05); /* 少し拡大して余白を埋める */
    }
    
    /* PDF印刷用スタイル */
    @media print {
      .slide {
        page-break-after: always;
        page-break-inside: avoid;
        height: 100vh;
        width: 100vw;
        margin: 0;
        padding: 40px 60px;
      }
      
      .slide-image-container {
        opacity: 0.15;
      }
      
      .slide-image {
        filter: blur(0.5px) brightness(0.7);
      }
      
      .slide-header {
        margin-bottom: 30px;
        padding-bottom: 15px;
      }
      
      .slide-title {
        font-size: 36px;
      }
      
      .slide-content {
        font-size: 28px;
        line-height: 1.5;
      }
      
      .controls {
        display: none;
      }
      
      .slide-indicator {
        display: none;
      }
    }
    
    .slide-header,
    .slide-content {
      position: relative;
      z-index: 1;
    }
    
    .slide-header {
      margin-bottom: 40px;
      border-bottom: 2px solid rgba(255, 255, 255, 0.3);
      padding-bottom: 20px;
    }
    
    .slide-number {
      font-size: 14px;
      opacity: 0.7;
      margin-bottom: 10px;
      display: block;
    }
    
    .slide-title {
      font-size: 42px;
      font-weight: 700;
      line-height: 1.3;
      margin: 0;
      text-align: center;
    }
    
    .slide-content {
      flex: 1;
      font-size: 32px;
      line-height: 1.6;
      overflow-y: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 40px 0;
      font-weight: 400;
    }
    
    .slide-content h1, .slide-content h2, .slide-content h3 {
      margin: 30px 0 20px 0;
      font-weight: 600;
    }
    
    .slide-content h1 { font-size: 36px; }
    .slide-content h2 { font-size: 32px; }
    .slide-content h3 { font-size: 28px; }
    
    .slide-content ul, .slide-content ol {
      margin: 20px 0;
      padding-left: 40px;
    }
    
    .slide-content li {
      margin: 10px 0;
    }
    
    .slide-content code {
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    .slide-content pre {
      background: rgba(0, 0, 0, 0.3);
      padding: 20px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 20px 0;
    }
    
    .controls {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 15px;
      z-index: 1000;
    }
    
    .control-btn {
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.5);
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.3s;
    }
    
    .control-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      border-color: rgba(255, 255, 255, 0.8);
    }
    
    .control-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .slide-indicator {
      position: fixed;
      top: 30px;
      right: 30px;
      background: rgba(0, 0, 0, 0.5);
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 14px;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div class="slide-indicator">
    <span id="current-slide">1</span> / <span id="total-slides">${slideDeck.slides.length}</span>
  </div>
  
  <div class="slide-container" id="slideContainer">
    ${slidesHTML}
  </div>
  
  <div class="controls">
    <button class="control-btn" id="prevBtn" onclick="previousSlide()">← 前へ</button>
    <button class="control-btn" onclick="downloadPDF()">PDFダウンロード</button>
    <button class="control-btn" onclick="downloadHTML()">HTMLダウンロード</button>
    <button class="control-btn" id="nextBtn" onclick="nextSlide()">次へ →</button>
  </div>
  
  <script>
    let currentSlideIndex = 0;
    let totalSlides = ${slideDeck.slides.length};
    let lastSlideCount = totalSlides;
    
    // メッセージリスナー（新しいスライドが追加されたとき）
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'newSlide') {
        const newSlideCount = event.data.slideCount;
        if (newSlideCount > lastSlideCount) {
          // 新しいスライドをアニメーション付きで追加
          const container = document.getElementById('slideContainer');
          const newSlides = document.querySelectorAll('.slide');
          newSlides.forEach((slide, idx) => {
            if (idx >= lastSlideCount) {
              slide.classList.add('new-slide');
            }
          });
          lastSlideCount = newSlideCount;
          totalSlides = newSlideCount;
          document.getElementById('total-slides').textContent = totalSlides;
          
          // 最新のスライドにスクロール
          currentSlideIndex = totalSlides - 1;
          updateSlide();
        }
      }
    });
    
    function updateSlide() {
      const container = document.getElementById('slideContainer');
      container.style.transform = \`translateX(-\${currentSlideIndex * 100}vw)\`;
      document.getElementById('current-slide').textContent = currentSlideIndex + 1;
      
      document.getElementById('prevBtn').disabled = currentSlideIndex === 0;
      document.getElementById('nextBtn').disabled = currentSlideIndex >= totalSlides - 1;
    }
    
    function nextSlide() {
      if (currentSlideIndex < totalSlides - 1) {
        currentSlideIndex++;
        updateSlide();
      }
    }
    
    function previousSlide() {
      if (currentSlideIndex > 0) {
        currentSlideIndex--;
        updateSlide();
      }
    }
    
    function downloadHTML() {
      const html = document.documentElement.outerHTML;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'slides.html';
      a.click();
      URL.revokeObjectURL(url);
    }
    
    function downloadPDF() {
      window.print();
    }
    
    // キーボード操作
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previousSlide();
      }
    });
    
    updateSlide();
  </script>
</body>
</html>
  `;
}

/**
 * マークダウンをHTMLに変換（簡易版）
 */
function markdownToHTML(markdown: string): string {
  let html = markdown;
  
  // 見出し
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // 太字
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // コードブロック
  html = html.replace(/```([\\s\\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // インラインコード
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // リスト
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // 段落
  html = html.split('\n\n').map(para => {
    if (!para.trim() || para.startsWith('<')) return para;
    return `<p>${para}</p>`;
  }).join('\n');
  
  return html;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

