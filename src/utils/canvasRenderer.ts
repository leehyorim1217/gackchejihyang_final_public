import { Detection } from './yolov8Detector';

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#FAD7A0',
  '#52BE80', '#5DADE2', '#AF7AC5', '#EC7063', '#F8B195',
  '#FF6B9D', '#C44569', '#FEA47F', '#25CCF7', '#EAB543',
].concat(Array(60).fill('#00D9FF'));

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private lastLogTime = 0;
  private logInterval = 2000;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
      willReadFrequently: false
    });
    
    if (!ctx) {
      throw new Error('Canvas context not available');
    }
    
    this.ctx = ctx;
    console.log('✅ CanvasRenderer initialized');
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawVideoFrame(video: HTMLVideoElement): void {
    // 비디오 해상도와 캔버스 크기 동기화
    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;
    
    if (this.canvas.width !== videoWidth || this.canvas.height !== videoHeight) {
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;
      console.log(`📐 Canvas resized to match video: ${videoWidth}x${videoHeight}`);
    }
    
    // 비디오 프레임 그리기
    this.ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
  }

  renderDetections(detections: Detection[]): void {
    const now = Date.now();
    const shouldLog = now - this.lastLogTime > this.logInterval;
    
    if (shouldLog && detections.length > 0) {
      console.log(`🎨 Rendering ${detections.length} detections on ${this.canvas.width}x${this.canvas.height} canvas`);
      this.lastLogTime = now;
    }
    
    detections.forEach((detection, index) => {
      const [x, y, width, height] = detection.bbox;
      
      // ✅ 유효성 검사
      if (width <= 0 || height <= 0) {
        if (shouldLog) console.warn(`  ⚠️ Invalid bbox dimensions: [${x}, ${y}, ${width}, ${height}]`);
        return;
      }
      
      if (x < 0 || y < 0 || x + width > this.canvas.width || y + height > this.canvas.height) {
        if (shouldLog) console.warn(`  ⚠️ Bbox outside canvas bounds: [${x}, ${y}, ${width}, ${height}]`);
        // 여전히 그리되, 경고만 출력
      }
      
      // 세부 로깅 (첫 번째 객체만)
      if (shouldLog && index === 0) {
        console.log(`  [0] ${detection.class}: bbox=[${x.toFixed(1)}, ${y.toFixed(1)}, ${width.toFixed(1)}, ${height.toFixed(1)}] conf=${(detection.score * 100).toFixed(1)}%`);
      }
      
      this.drawBoundingBox(detection);
      this.drawLabel(detection);
    });
  }

  private drawBoundingBox(detection: Detection): void {
    const [x, y, width, height] = detection.bbox;
    const color = COLORS[detection.classId % COLORS.length];

    // 더 명확한 바운딩 박스
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(x, y, width, height);

    // 반투명 배경
    this.ctx.fillStyle = color + '30';
    this.ctx.fillRect(x, y, width, height);
  }

  private drawLabel(detection: Detection): void {
    const [x, y] = detection.bbox;
    const color = COLORS[detection.classId % COLORS.length];
    const label = `${detection.class} ${(detection.score * 100).toFixed(1)}%`;

    this.ctx.font = 'bold 18px Arial';
    const textMetrics = this.ctx.measureText(label);
    const textWidth = textMetrics.width;
    const textHeight = 24;

    // 레이블 배경
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y - textHeight - 4, textWidth + 12, textHeight + 4);

    // 레이블 텍스트
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillText(label, x + 6, y - 8);
  }

  drawFPS(fps: number): void {
    this.ctx.font = 'bold 22px Arial';
    this.ctx.fillStyle = '#00FF00';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 3;

    const text = `FPS: ${fps.toFixed(1)}`;
    const x = 10;
    const y = 35;

    this.ctx.strokeText(text, x, y);
    this.ctx.fillText(text, x, y);
  }

  drawStats(stats: {
    detectionCount: number;
    avgConfidence: number;
    inferenceTime: number;
  }): void {
    const { detectionCount, avgConfidence, inferenceTime } = stats;

    this.ctx.font = 'bold 18px Arial';
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;

    const lines = [
      `Objects: ${detectionCount}`,
      `Confidence: ${(avgConfidence * 100).toFixed(1)}%`,
      `Inference: ${inferenceTime.toFixed(1)}ms`,
    ];

    lines.forEach((line, index) => {
      const x = 10;
      const y = 70 + index * 30;
      this.ctx.strokeText(line, x, y);
      this.ctx.fillText(line, x, y);
    });
  }

  renderLoadingScreen(progress: number, message: string): void {
    this.clear();

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const barWidth = 300;
    const barHeight = 20;
    const barX = centerX - barWidth / 2;
    const barY = centerY - barHeight / 2;

    this.ctx.fillStyle = '#333333';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    this.ctx.fillStyle = '#00D9FF';
    this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);

    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);

    this.ctx.font = 'bold 18px Arial';
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(message, centerX, barY - 20);
    this.ctx.fillText(`${(progress * 100).toFixed(0)}%`, centerX, barY + barHeight + 30);

    this.ctx.textAlign = 'left';
  }
}