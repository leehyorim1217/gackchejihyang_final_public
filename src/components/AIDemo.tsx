// src/components/AIDemo.tsx - 최종 완전판 (모든 변경사항 통합)
// ✅ MongoDB 저장 로직
// ✅ Threshold 조정 UI
// ✅ 정확도 향상 설정
// ✅ 바운딩 박스 겹침 해결
// ✅ 객체 수 정확한 집계

import React, { useEffect, useRef, useState } from 'react';
import { YOLOv8Detector } from '../utils/yolov8Detector';
import { WebcamManager } from '../utils/webcamManager';
import { CanvasRenderer } from '../utils/canvasRenderer';
import { api } from '../services/api';
import { 
  Play, Square, Download, Activity, Zap, Target, BarChart3, Clock,
  CheckCircle, XCircle, Loader2, Pause, Database, AlertCircle, Video, Sliders
} from 'lucide-react';

export const AIDemo: React.FC = () => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<YOLOv8Detector | null>(null);
  const webcamRef = useRef<WebcamManager | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const fpsTrackerRef = useRef<number[]>([]);
  
  // MongoDB Session 관련
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const detectionBufferRef = useRef<any[]>([]);
  const lastSaveTimeRef = useRef(Date.now());
  const totalDetectionsRef = useRef(0);
  
  // 모델 상태
  const [isModelReady, setIsModelReady] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  // 성능 메트릭
  const [metrics, setMetrics] = useState({
    fps: 0,
    detectionCount: 0,
    avgConfidence: 0,
    inferenceTime: 0,
  });

  // ✅ NEW: Threshold 조정 UI
  const [scoreThreshold, setScoreThreshold] = useState(0.35);
  const [iouThreshold, setIouThreshold] = useState(0.35);
  const [showSettings, setShowSettings] = useState(false);

  // 디버그 로그 추가
  const addDebug = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo((prev) => [...prev.slice(-9), `[${timestamp}] ${msg}`]);
    console.log(`[${timestamp}] ${msg}`);
  };

  // 컴포넌트 초기화
  useEffect(() => {
    addDebug('🚀 Component mounted');
    
    if (!canvasRef.current) {
      addDebug('❌ Canvas element not found');
      return;
    }

    try {
      // 핵심 객체 초기화
      detectorRef.current = new YOLOv8Detector({
        scoreThreshold: 0.35,  // ✅ 정확도 향상
        iouThreshold: 0.35,     // ✅ 겹침 최소화
      });
      webcamRef.current = new WebcamManager();
      rendererRef.current = new CanvasRenderer(canvasRef.current);
      
      addDebug('✅ Core objects initialized');
      addDebug(`📊 Initial thresholds: Score=${scoreThreshold}, IoU=${iouThreshold}`);
    } catch (err) {
      addDebug(`❌ Initialization error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    // Cleanup
    return () => {
      addDebug('🧹 Component unmounting');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      webcamRef.current?.stop();
      detectorRef.current?.dispose();
    };
  }, []);

  // ✅ Threshold 변경 핸들러
  const handleScoreThresholdChange = (value: number) => {
    setScoreThreshold(value);
    if (detectorRef.current) {
      detectorRef.current.setThresholds(value, undefined);
      addDebug(`🎯 Score threshold: ${(value * 100).toFixed(0)}%`);
    }
  };

  const handleIouThresholdChange = (value: number) => {
    setIouThreshold(value);
    if (detectorRef.current) {
      detectorRef.current.setThresholds(undefined, value);
      addDebug(`🎯 IoU threshold: ${(value * 100).toFixed(0)}%`);
    }
  };

  // 모델 로딩
  const loadModel = async (): Promise<boolean> => {
    if (!detectorRef.current) {
      setError('Detector not initialized');
      addDebug('❌ Detector not initialized');
      return false;
    }

    if (isModelLoading) {
      addDebug('⚠️ Model already loading');
      return false;
    }

    if (isModelReady && detectorRef.current.isModelReady()) {
      addDebug('✅ Model already ready');
      return true;
    }

    setIsModelLoading(true);
    setError(null);
    addDebug('🔄 Starting model load...');

    try {
      await detectorRef.current.loadModel((progress) => {
        if (progress === 1.0) {
          addDebug('📥 Model download complete');
        }
      });

      const ready = detectorRef.current.isModelReady();
      addDebug(`🔍 Model ready check: ${ready ? '✅' : '❌'}`);
      
      setIsModelReady(ready);

      if (!ready) {
        throw new Error('Model not ready after loading');
      }

      addDebug('🎉 Model loaded successfully');
      return true;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Model loading failed: ${errorMsg}`);
      addDebug(`❌ Loading failed: ${errorMsg}`);
      setIsModelReady(false);
      return false;
    } finally {
      setIsModelLoading(false);
    }
  };

  // ✅ MongoDB 배치 저장
  const saveBatchDetections = async () => {
    if (detectionBufferRef.current.length === 0) {
      return;
    }

    try {
      const batchSize = detectionBufferRef.current.length;
      addDebug(`💾 Saving ${batchSize} detection records...`);

      for (const detection of detectionBufferRef.current) {
        await api.saveDetection(detection);
      }

      addDebug(`✅ MongoDB: ${batchSize} records saved`);
      detectionBufferRef.current = [];

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown';
      console.error('❌ Batch save failed:', error);
      addDebug(`❌ MongoDB save failed: ${errorMsg}`);
    }
  };

  // 탐지 시작
  const startDetection = async () => {
    addDebug('🎬 Start detection clicked');

    // 필수 요소 확인
    if (!videoRef.current || !webcamRef.current || !detectorRef.current || 
        !rendererRef.current || !canvasRef.current) {
      setError('Required elements not initialized');
      addDebug('❌ Missing required elements');
      return;
    }

    // 모델 로딩 확인
    if (!isModelReady) {
      addDebug('🔄 Model needs loading');
      const success = await loadModel();
      if (!success) {
        addDebug('❌ Model load failed, aborting');
        return;
      }
    }

    // 최종 모델 상태 확인
    if (!detectorRef.current.isModelReady()) {
      setError('Model not ready');
      addDebug('❌ Final check: Model not ready');
      return;
    }

    try {
      // ✅ MongoDB 세션 시작
      addDebug('📊 Creating MongoDB session...');
      const session = await api.startSession({ 
        userId: `user-${Date.now()}` 
      });
      
      setCurrentSessionId(session._id);
      addDebug(`✅ Session ID: ${session._id}`);
      
      // 세션 카운터 초기화
      totalDetectionsRef.current = 0;
      detectionBufferRef.current = [];
      lastSaveTimeRef.current = Date.now();
      
      // 웹캠 시작
      addDebug('📹 Starting webcam...');
      await webcamRef.current.start(videoRef.current);
      addDebug('✅ Webcam activated');
      
      // ✅ Canvas 크기 동기화 (중요!)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        addDebug(`📐 Canvas size: ${canvasRef.current.width}x${canvasRef.current.height}`);
      } else {
        addDebug('⚠️ Video dimensions not ready, using defaults');
        canvasRef.current.width = 1280;
        canvasRef.current.height = 720;
      }
      
      // 탐지 시작
      setIsDetecting(true);
      setError(null);
      addDebug('🎯 Detection loop started');
      detectLoop();

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Detection start failed: ${errorMsg}`);
      addDebug(`❌ Start error: ${errorMsg}`);
    }
  };

  // 탐지 중지
  const stopDetection = async () => {
    addDebug('⏹️ Stopping detection...');

    // 버퍼에 남은 데이터 저장
    await saveBatchDetections();

    // 애니메이션 프레임 취소
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 웹캠 중지
    webcamRef.current?.stop();
    setIsDetecting(false);

    // ✅ MongoDB 세션 종료
    if (currentSessionId) {
      addDebug('🏁 Ending session...');
      
      try {
        await api.endSession(currentSessionId, {
          totalDetections: totalDetectionsRef.current,
          avgFPS: metrics.fps,
          avgInferenceTime: metrics.inferenceTime
        });

        addDebug(`✅ Session ended: ${totalDetectionsRef.current} total detections`);
        
        // 최종 통계 조회
        const stats = await api.getSessionStats(currentSessionId);
        console.log('📊 Final statistics:', stats);
        
        setCurrentSessionId(null);
      } catch (err) {
        addDebug(`⚠️ Session end error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    // 카운터 초기화
    fpsTrackerRef.current = [];
    totalDetectionsRef.current = 0;
    
    addDebug('✅ Detection stopped');
  };

  // ✅ 탐지 루프 (핵심 로직)
  const detectLoop = async () => {
    // 필수 요소 확인
    if (!videoRef.current || !canvasRef.current || !rendererRef.current || !detectorRef.current) {
      console.warn('⚠️ Required refs missing in detectLoop');
      return;
    }

    // 모델 상태 확인
    if (!detectorRef.current.isModelReady()) {
      addDebug('❌ Model not ready in loop - stopping');
      stopDetection();
      return;
    }

    // 웹캠 상태 확인
    if (!webcamRef.current?.isWebcamActive()) {
      console.warn('⚠️ Webcam not active');
      return;
    }

    const startTime = performance.now();

    try {
      // 1. 비디오 프레임 그리기
      rendererRef.current.drawVideoFrame(videoRef.current);
      
      // 2. 객체 탐지 실행
      const detections = await detectorRef.current.detect(videoRef.current);
      
      // 3. 콘솔 로그 (탐지 개수)
      console.log(`🎯 Detected: ${detections.length} objects`);
      if (detections.length > 0) {
        console.log('📦 Classes:', detections.map(d => 
          `${d.class}(${(d.score * 100).toFixed(1)}%)`
        ).join(', '));
      }
      
      // 4. 바운딩 박스 그리기
      rendererRef.current.renderDetections(detections);
      
      // 5. 성능 측정
      const endTime = performance.now();
      const frameTime = endTime - startTime;
      const fps = 1000 / frameTime;

      // FPS 추적 (최근 30프레임)
      fpsTrackerRef.current.push(fps);
      if (fpsTrackerRef.current.length > 30) {
        fpsTrackerRef.current.shift();
      }
      
      const avgFps = fpsTrackerRef.current.reduce((a, b) => a + b, 0) / 
                     fpsTrackerRef.current.length;
      
      const avgConfidence = detections.length > 0 
        ? detections.reduce((sum, det) => sum + det.score, 0) / detections.length 
        : 0;

      // 6. Metrics 업데이트
      setMetrics({
        fps: avgFps,
        detectionCount: detections.length,
        avgConfidence,
        inferenceTime: frameTime,
      });

      // 7. ✅ MongoDB 저장 로직 (중요!)
      if (currentSessionId && detections.length > 0) {
        totalDetectionsRef.current += detections.length;
        
        // API 인터페이스에 맞는 형식
        const detectionData = {
          sessionId: currentSessionId,
          detections: detections.map(d => ({
            class: d.class,
            confidence: d.score,
            bbox: d.bbox
          })),
          performance: {  // ✅ 객체로 감싸야 함!
            fps: avgFps,
            inferenceTime: frameTime
          }
        };
        
        detectionBufferRef.current.push(detectionData);
        
        // 5초마다 배치 저장
        const now = Date.now();
        if (now - lastSaveTimeRef.current >= 5000) {
          console.log(`💾 Saving batch: ${detectionBufferRef.current.length} records`);
          await saveBatchDetections();
          lastSaveTimeRef.current = now;
        }
      }

      // 8. Canvas에 통계 그리기
      if (rendererRef.current.drawFPS && rendererRef.current.drawStats) {
        rendererRef.current.drawFPS(avgFps);
        rendererRef.current.drawStats({
          detectionCount: detections.length,
          avgConfidence,
          inferenceTime: frameTime,
        });
      }

    } catch (err) {
      console.error('❌ Detection loop error:', err);
      addDebug(`❌ Loop error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    // 다음 프레임 예약
    animationFrameRef.current = requestAnimationFrame(detectLoop);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        
        {/* ========== Header ========== */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-3">
            🎯 Real-Time AI Object Detection
          </h1>
          <p className="text-xl text-gray-300 font-semibold">
            Powered by YOLOv8 + TensorFlow.js + WebGL + MongoDB
          </p>
        </div>

        {/* ========== Status Monitor ========== */}
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Model Status */}
            <div className="flex items-center gap-3 p-3 bg-gray-900 bg-opacity-50 rounded-lg">
              <div className={`p-2 rounded-lg ${isModelReady ? 'bg-green-500 bg-opacity-20' : 'bg-red-500 bg-opacity-20'}`}>
                {isModelReady ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div>
                <div className="text-xs text-gray-400">Model</div>
                <div className={`text-sm font-bold ${isModelReady ? 'text-green-400' : 'text-red-400'}`}>
                  {isModelReady ? 'Ready' : 'Not Ready'}
                </div>
              </div>
            </div>

            {/* Loading Status */}
            <div className="flex items-center gap-3 p-3 bg-gray-900 bg-opacity-50 rounded-lg">
              <div className={`p-2 rounded-lg ${isModelLoading ? 'bg-yellow-500 bg-opacity-20' : 'bg-gray-700'}`}>
                {isModelLoading ? (
                  <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                ) : (
                  <Pause className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <div>
                <div className="text-xs text-gray-400">Status</div>
                <div className={`text-sm font-bold ${isModelLoading ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {isModelLoading ? 'Loading' : 'Idle'}
                </div>
              </div>
            </div>

            {/* Detection Status */}
            <div className="flex items-center gap-3 p-3 bg-gray-900 bg-opacity-50 rounded-lg">
              <div className={`p-2 rounded-lg ${isDetecting ? 'bg-blue-500 bg-opacity-20' : 'bg-gray-700'}`}>
                {isDetecting ? (
                  <Video className="w-5 h-5 text-blue-400" />
                ) : (
                  <Square className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <div>
                <div className="text-xs text-gray-400">Detection</div>
                <div className={`text-sm font-bold ${isDetecting ? 'text-blue-400' : 'text-gray-500'}`}>
                  {isDetecting ? 'Running' : 'Stopped'}
                </div>
              </div>
            </div>

            {/* Database Status */}
            <div className="flex items-center gap-3 p-3 bg-gray-900 bg-opacity-50 rounded-lg">
              <div className={`p-2 rounded-lg ${api.isBackendAvailable() ? 'bg-green-500 bg-opacity-20' : 'bg-yellow-500 bg-opacity-20'}`}>
                {api.isBackendAvailable() ? (
                  <Database className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                )}
              </div>
              <div>
                <div className="text-xs text-gray-400">Database</div>
                <div className={`text-sm font-bold ${api.isBackendAvailable() ? 'text-green-400' : 'text-yellow-400'}`}>
                  {api.isBackendAvailable() ? 'Connected' : 'Local Mode'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========== Debug Log ========== */}
        <div className="mb-4 p-3 bg-black bg-opacity-40 rounded-lg border border-gray-700 max-h-28 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold text-green-400">SYSTEM LOG</span>
          </div>
          <div className="text-xs text-green-400 font-mono space-y-1">
            {debugInfo.map((log, i) => (
              <div key={i} className="opacity-80 hover:opacity-100">{log}</div>
            ))}
          </div>
        </div>

        {/* ========== Video + Canvas ========== */}
        <div 
          className="relative bg-black rounded-2xl overflow-hidden shadow-2xl mb-6 border border-gray-700" 
          style={{ aspectRatio: '16/9', maxWidth: '1280px', margin: '0 auto' }}
        >
          <video
            ref={videoRef}
            className="absolute top-0 left-0 w-full h-full object-cover"
            style={{ display: isDetecting ? 'block' : 'none' }}
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
            style={{ zIndex: 10, pointerEvents: 'none' }}
          />
          
          {/* Placeholder when not detecting */}
          {!isDetecting && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Video className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Press Start Detection to begin</p>
              </div>
            </div>
          )}
        </div>

        {/* ========== Error Display ========== */}
        {error && (
          <div className="mb-4 p-4 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-red-300">{error}</div>
          </div>
        )}

        {/* ========== ✅ Detection Settings Panel ========== */}
        {!isDetecting && (
          <div className="mb-6">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all mx-auto"
            >
              <Sliders className="w-4 h-4" />
              {showSettings ? 'Hide' : 'Show'} Detection Settings
            </button>
            
            {showSettings && (
              <div className="mt-4 p-6 bg-gray-800 bg-opacity-50 rounded-xl border border-gray-700">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <Sliders className="w-5 h-5" />
                  Detection Parameters
                </h3>
                
                <div className="space-y-6">
                  {/* Confidence Threshold */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-gray-300 text-sm font-medium">
                        Confidence Threshold
                      </label>
                      <span className="text-blue-400 font-mono text-sm">
                        {(scoreThreshold * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.05"
                      value={scoreThreshold}
                      onChange={(e) => handleScoreThresholdChange(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <p className="text-gray-400 text-xs mt-1">
                      Higher = fewer but more accurate detections (recommended: 0.35-0.50)
                    </p>
                  </div>

                  {/* Overlap Threshold (NMS) */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-gray-300 text-sm font-medium">
                        Overlap Threshold (NMS)
                      </label>
                      <span className="text-purple-400 font-mono text-sm">
                        {(iouThreshold * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.7"
                      step="0.05"
                      value={iouThreshold}
                      onChange={(e) => handleIouThresholdChange(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <p className="text-gray-400 text-xs mt-1">
                      Lower = less overlapping boxes (recommended: 0.30-0.40)
                    </p>
                  </div>

                  {/* Quick Presets */}
                  <div className="pt-4 border-t border-gray-700">
                    <label className="text-gray-300 text-sm font-medium block mb-3">
                      Quick Presets
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          handleScoreThresholdChange(0.25);
                          handleIouThresholdChange(0.45);
                        }}
                        className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-all"
                      >
                        More Detections
                      </button>
                      <button
                        onClick={() => {
                          handleScoreThresholdChange(0.35);
                          handleIouThresholdChange(0.35);
                        }}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-all"
                      >
                        Balanced ⭐
                      </button>
                      <button
                        onClick={() => {
                          handleScoreThresholdChange(0.50);
                          handleIouThresholdChange(0.25);
                        }}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-all"
                      >
                        High Accuracy
                      </button>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-500 bg-opacity-10 border border-blue-500 rounded-lg p-3">
                    <p className="text-blue-300 text-xs">
                      <strong>💡 Tip:</strong> Adjust these settings based on your environment. 
                      Good lighting and stable camera improve detection quality.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== Control Buttons ========== */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          {!isDetecting ? (
            <button
              onClick={startDetection}
              disabled={isModelLoading}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-105 shadow-lg disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5" />
              {isModelLoading ? 'Loading Model...' : 'Start Detection'}
            </button>
          ) : (
            <button
              onClick={stopDetection}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              <Square className="w-5 h-5" />
              Stop Detection
            </button>
          )}
          
          <button
            onClick={loadModel}
            disabled={isModelLoading || isModelReady}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-105 shadow-lg disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            {isModelReady ? 'Model Ready' : 'Load Model'}
          </button>
        </div>

        {/* ========== Performance Metrics ========== */}
        {isDetecting && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard 
              title="FPS" 
              value={metrics.fps.toFixed(1)} 
              icon={Zap} 
              color="blue" 
            />
            <MetricCard 
              title="Objects" 
              value={metrics.detectionCount.toString()} 
              icon={Target} 
              color="green" 
            />
            <MetricCard 
              title="Confidence" 
              value={`${(metrics.avgConfidence * 100).toFixed(1)}%`} 
              icon={BarChart3} 
              color="purple" 
            />
            <MetricCard 
              title="Inference" 
              value={`${metrics.inferenceTime.toFixed(1)}ms`} 
              icon={Clock} 
              color="orange" 
            />
          </div>
        )}

        {/* ========== Tech Stack ========== */}
        <div className="mt-12 text-center">
          <h3 className="text-2xl font-bold text-white mb-4 flex items-center justify-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" />
            Technology Stack
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              'React 18', 
              'TypeScript', 
              'TensorFlow.js', 
              'YOLOv8', 
              'MongoDB', 
              'Express', 
              'Canvas API', 
              'WebGL'
            ].map((tech) => (
              <span 
                key={tech} 
                className="px-4 py-2 bg-white bg-opacity-10 text-white text-sm rounded-full backdrop-blur-sm border border-white border-opacity-20 hover:bg-opacity-20 transition-all"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

// ========== Metric Card Component ==========
const MetricCard: React.FC<{ 
  title: string; 
  value: string; 
  icon: React.ElementType; 
  color: 'blue' | 'green' | 'purple' | 'orange';
}> = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-700',
    green: 'from-green-500 to-emerald-700',
    purple: 'from-purple-500 to-pink-700',
    orange: 'from-orange-500 to-red-700'
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-6 text-center border border-white border-opacity-20 shadow-lg`}>
      <div className="flex justify-center mb-3">
        <div className="p-3 bg-white bg-opacity-20 rounded-lg">
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="text-gray-200 text-xs font-semibold mb-1">{title}</div>
      <div className="text-white text-2xl font-bold">{value}</div>
    </div>
  );
};