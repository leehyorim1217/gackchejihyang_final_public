// src/utils/yolov8Detector.ts - 정확도 향상 및 겹침 해결 버전

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

export const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
  'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
  'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

export interface Detection {
  bbox: [number, number, number, number];
  class: string;
  classId: number;
  score: number;
}

export interface ModelConfig {
  modelPath: string;
  inputSize: number;
  scoreThreshold: number;
  iouThreshold: number;
}

export class YOLOv8Detector {
  private model: tf.GraphModel | null = null;
  private config: ModelConfig;
  private isLoading = false;
  private isReady = false;
  private lastDetections: Detection[] = [];
  private frameCount = 0;
  private skipFrames = 1;

  constructor(config: Partial<ModelConfig> = {}) {
    this.config = {
      modelPath: config.modelPath || '/models/yolov8n_web_model/model.json',
      inputSize: config.inputSize || 640,
      // ✅ 정확도 향상: threshold 상향
      scoreThreshold: config.scoreThreshold || 0.35,  // 20% → 35%로 상향
      iouThreshold: config.iouThreshold || 0.35,      // 45% → 35%로 하향 (겹침 엄격)
    };
    
    console.log('🎯 YOLOv8 Config:', {
      scoreThreshold: this.config.scoreThreshold,
      iouThreshold: this.config.iouThreshold,
    });
  }

  async loadModel(onProgress?: (progress: number) => void): Promise<void> {
    if (this.isLoading || this.isReady) return;

    this.isLoading = true;

    try {
      await tf.setBackend('webgl');
      await tf.ready();
      
      tf.env().set('WEBGL_PACK', true);
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
      
      console.log(`✅ Backend: ${tf.getBackend()}`);

      this.model = await tf.loadGraphModel(this.config.modelPath, {
        onProgress: (fraction) => onProgress?.(fraction),
      });

      // Warm-up
      for (let i = 0; i < 3; i++) {
        const dummyInput = tf.zeros([1, this.config.inputSize, this.config.inputSize, 3]);
        const dummyOutput = this.model.execute(dummyInput) as tf.Tensor;
        tf.dispose([dummyInput, dummyOutput]);
      }

      this.isReady = true;
      onProgress?.(1.0);
      console.log('🎉 모델 준비 완료');

    } catch (error) {
      console.error('❌ 모델 로딩 실패:', error);
      this.isReady = false;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  private preprocessImage(image: HTMLVideoElement | HTMLImageElement): tf.Tensor4D {
    return tf.tidy(() => {
      let tensor = tf.browser.fromPixels(image);
      const resized = tf.image.resizeBilinear(tensor, [this.config.inputSize, this.config.inputSize], true);
      const normalized = resized.div(255.0);
      return normalized.expandDims(0) as tf.Tensor4D;
    });
  }

  async detect(image: HTMLVideoElement | HTMLImageElement): Promise<Detection[]> {
    if (!this.isReady || !this.model) {
      return this.lastDetections;
    }

    this.frameCount++;
    if (this.frameCount % this.skipFrames !== 0) {
      return this.lastDetections;
    }

    let inputTensor: tf.Tensor4D | null = null;
    let outputTensor: tf.Tensor | null = null;

    try {
      inputTensor = this.preprocessImage(image);
      
      const startTime = performance.now();
      outputTensor = this.model.execute(inputTensor) as tf.Tensor;
      const inferenceTime = performance.now() - startTime;
      
      const imgWidth = image.width || (image as HTMLVideoElement).videoWidth;
      const imgHeight = image.height || (image as HTMLVideoElement).videoHeight;
      
      const detections = await this.postProcess(outputTensor, imgWidth, imgHeight);

      this.lastDetections = detections;
      
      if (detections.length > 0) {
        console.log(`⚡ ${inferenceTime.toFixed(1)}ms | ${detections.length} objects | Avg conf: ${(detections.reduce((sum, d) => sum + d.score, 0) / detections.length * 100).toFixed(1)}%`);
      }

      return detections;

    } catch (error) {
      console.error('❌ 탐지 실패:', error);
      return this.lastDetections;
    } finally {
      if (inputTensor) inputTensor.dispose();
      if (outputTensor) outputTensor.dispose();
    }
  }

  private async postProcess(
    output: tf.Tensor,
    imgWidth: number,
    imgHeight: number
  ): Promise<Detection[]> {
    const shape = output.shape;
    
    let boxes: tf.Tensor2D | null = null;
    let scores: tf.Tensor2D | null = null;
    const tempTensors: tf.Tensor[] = [];

    try {
      if (shape.length === 3 && shape[0] === 1) {
        if (shape[1] === 84 && shape[2] === 8400) {
          const squeezed = output.squeeze([0]);
          tempTensors.push(squeezed);
          const transposed = squeezed.transpose([1, 0]);
          tempTensors.push(transposed);
          boxes = transposed.slice([0, 0], [-1, 4]) as tf.Tensor2D;
          scores = transposed.slice([0, 4], [-1, 80]) as tf.Tensor2D;
        } else if (shape[1] === 8400 && shape[2] === 84) {
          const squeezed = output.squeeze([0]);
          tempTensors.push(squeezed);
          boxes = squeezed.slice([0, 0], [-1, 4]) as tf.Tensor2D;
          scores = squeezed.slice([0, 4], [-1, 80]) as tf.Tensor2D;
        } else {
          throw new Error(`Unexpected shape: ${JSON.stringify(shape)}`);
        }
      } else {
        throw new Error(`Unsupported shape: ${JSON.stringify(shape)}`);
      }

      if (!boxes || !scores) {
        throw new Error('Failed to extract boxes and scores');
      }

      const maxScores = scores.max(1);
      const classIds = scores.argMax(1);
      const mask = maxScores.greater(this.config.scoreThreshold);
      
      tempTensors.push(maxScores, classIds, mask);

      const boxesData = await boxes.array() as number[][];
      const scoresData = await maxScores.array() as number[];
      const classIdsData = await classIds.array() as number[];
      const maskData = await mask.array() as number[];

      tf.dispose([boxes, scores, ...tempTensors]);

      const detections: Detection[] = [];
      const scaleX = imgWidth / this.config.inputSize;
      const scaleY = imgHeight / this.config.inputSize;

      for (let i = 0; i < maskData.length; i++) {
        if (!maskData[i]) continue;

        const [val1, val2, val3, val4] = boxesData[i];
        
        // ✅ 개선: 좌표 형식 명확히 감지
        // YOLOv8은 항상 xywh (center_x, center_y, width, height) 형식 출력
        // 값이 0-1 범위면 정규화된 좌표, 0-640 범위면 픽셀 좌표
        
        let x, y, w, h;
        
        // 정규화 여부 확인 (모든 값이 640 이하면 픽셀 좌표로 판단)
        const isNormalized = val1 <= 1 && val2 <= 1 && val3 <= 1 && val4 <= 1;
        
        if (isNormalized) {
          // 정규화된 xywh → 픽셀 xywh
          const centerX = val1 * this.config.inputSize;
          const centerY = val2 * this.config.inputSize;
          const width = val3 * this.config.inputSize;
          const height = val4 * this.config.inputSize;
          
          // xywh (center) → xyxy (corner)
          x = (centerX - width / 2) * scaleX;
          y = (centerY - height / 2) * scaleY;
          w = width * scaleX;
          h = height * scaleY;
        } else {
          // 픽셀 좌표 xywh → 스케일 조정
          x = (val1 - val3 / 2) * scaleX;
          y = (val2 - val4 / 2) * scaleY;
          w = val3 * scaleX;
          h = val4 * scaleY;
        }

        // ✅ 엄격한 유효성 검사
        // 너무 작거나 큰 박스 필터링
        const MIN_SIZE = 10;  // 최소 10픽셀
        const MAX_SIZE_RATIO = 0.95;  // 화면의 95% 이하
        
        if (w < MIN_SIZE || h < MIN_SIZE) {
          continue;
        }
        
        if (w > imgWidth * MAX_SIZE_RATIO || h > imgHeight * MAX_SIZE_RATIO) {
          continue;
        }

        // 화면 밖 박스 필터링
        if (x + w < 0 || y + h < 0 || x > imgWidth || y > imgHeight) {
          continue;
        }

        // 경계 클리핑
        const finalX = Math.max(0, Math.min(x, imgWidth - w));
        const finalY = Math.max(0, Math.min(y, imgHeight - h));
        const finalW = Math.min(w, imgWidth - finalX);
        const finalH = Math.min(h, imgHeight - finalY);

        detections.push({
          bbox: [finalX, finalY, finalW, finalH],
          class: COCO_CLASSES[classIdsData[i]] || 'unknown',
          classId: classIdsData[i],
          score: scoresData[i],
        });
      }

      console.log(`🔍 Pre-NMS: ${detections.length} detections`);
      const filtered = this.applyNMS(detections);
      console.log(`✅ Post-NMS: ${filtered.length} detections`);
      
      return filtered;

    } catch (error) {
      console.error('❌ 후처리 에러:', error);
      if (boxes) tf.dispose(boxes);
      if (scores) tf.dispose(scores);
      tf.dispose(tempTensors);
      return [];
    }
  }

  // ✅ 개선된 NMS: 클래스별로 따로 처리 + 더 엄격한 IoU
  private applyNMS(detections: Detection[]): Detection[] {
    if (detections.length === 0) return [];

    // 클래스별로 그룹화
    const classSeparated: { [key: number]: Detection[] } = {};
    
    detections.forEach(det => {
      if (!classSeparated[det.classId]) {
        classSeparated[det.classId] = [];
      }
      classSeparated[det.classId].push(det);
    });

    const selected: Detection[] = [];

    // 각 클래스별로 NMS 적용
    Object.values(classSeparated).forEach(classDetections => {
      // 신뢰도 내림차순 정렬
      classDetections.sort((a, b) => b.score - a.score);
      
      const classSelected: Detection[] = [];
      
      while (classDetections.length > 0) {
        const current = classDetections.shift()!;
        classSelected.push(current);

        // 나머지 박스들과 IoU 계산하여 겹치는 것 제거
        classDetections = classDetections.filter((det) => {
          const iou = this.calculateIoU(current.bbox, det.bbox);
          return iou < this.config.iouThreshold;
        });
      }
      
      selected.push(...classSelected);
    });

    // 최종 결과를 신뢰도순으로 정렬
    return selected.sort((a, b) => b.score - a.score);
  }

  private calculateIoU(box1: number[], box2: number[]): number {
    const [x1, y1, w1, h1] = box1;
    const [x2, y2, w2, h2] = box2;

    const xLeft = Math.max(x1, x2);
    const yTop = Math.max(y1, y2);
    const xRight = Math.min(x1 + w1, x2 + w2);
    const yBottom = Math.min(y1 + h1, y2 + h2);

    if (xRight < xLeft || yBottom < yTop) return 0;

    const intersectionArea = (xRight - xLeft) * (yBottom - yTop);
    const unionArea = w1 * h1 + w2 * h2 - intersectionArea;

    return intersectionArea / (unionArea + 1e-6);
  }

  // ✅ 동적으로 threshold 조정 가능
  setThresholds(scoreThreshold?: number, iouThreshold?: number): void {
    if (scoreThreshold !== undefined) {
      this.config.scoreThreshold = scoreThreshold;
      console.log(`🎯 Score threshold updated: ${scoreThreshold}`);
    }
    if (iouThreshold !== undefined) {
      this.config.iouThreshold = iouThreshold;
      console.log(`🎯 IoU threshold updated: ${iouThreshold}`);
    }
  }

  setFrameSkip(skip: number): void {
    this.skipFrames = Math.max(1, skip);
  }

  isModelReady(): boolean {
    return this.isReady;
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isReady = false;
  }

  getMemoryInfo(): { numTensors: number; numBytes: number } {
    return tf.memory();
  }
  
  getCurrentConfig(): ModelConfig {
    return { ...this.config };
  }
}