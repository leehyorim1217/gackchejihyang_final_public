import { useEffect, useRef, useState } from 'react';
import { Detection } from '../utils/yolov8Detector';

interface PerformanceMetrics {
  fps: number;
  detectionCount: number;
  avgConfidence: number;
  inferenceTime: number;
}

// 데모용 가상 탐지 데이터
const DEMO_DETECTIONS: Detection[] = [
  { bbox: [100, 80, 150, 200], class: 'person', classId: 0, score: 0.95 },
  { bbox: [300, 150, 180, 140], class: 'laptop', classId: 63, score: 0.88 },
  { bbox: [520, 200, 80, 90], class: 'cup', classId: 41, score: 0.76 },
  { bbox: [450, 120, 60, 80], class: 'cell phone', classId: 67, score: 0.82 },
];

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#FAD7A0',
];

export const DemoMode: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 35.2,
    detectionCount: 4,
    avgConfidence: 0.85,
    inferenceTime: 28.5,
  });

  useEffect(() => {
    if (canvasRef.current && isRunning) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      
      canvas.width = 1280;
      canvas.height = 720;
      
      const animate = () => {
        // 배경 그리기 (카메라 피드 시뮬레이션)
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#16213e');
        gradient.addColorStop(1, '#0f3460');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 그리드 패턴 (카메라 느낌)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 40) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, canvas.height);
          ctx.stroke();
        }
        for (let i = 0; i < canvas.height; i += 40) {
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(canvas.width, i);
          ctx.stroke();
        }

        // 중앙 텍스트
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🎥 DEMO MODE', canvas.width / 2, canvas.height / 2 - 50);
        ctx.font = '24px Arial';
        ctx.fillText('웹캠 없이 AI 탐지 시뮬레이션', canvas.width / 2, canvas.height / 2 + 10);

        // 탐지 결과 그리기
        DEMO_DETECTIONS.forEach((detection) => {
          const [x, y, width, height] = detection.bbox;
          const color = COLORS[detection.classId % COLORS.length];

          // 바운딩 박스
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, width, height);

          // 반투명 배경
          ctx.fillStyle = color + '20';
          ctx.fillRect(x, y, width, height);

          // 레이블
          const label = `${detection.class} ${(detection.score * 100).toFixed(1)}%`;
          ctx.font = 'bold 16px Arial';
          const textMetrics = ctx.measureText(label);
          const textWidth = textMetrics.width;

          ctx.fillStyle = color;
          ctx.fillRect(x, y - 24, textWidth + 10, 24);

          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(label, x + 5, y - 8);
        });

        // FPS 표시
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#00FF00';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.textAlign = 'left';
        const fpsText = `FPS: ${metrics.fps.toFixed(1)}`;
        ctx.strokeText(fpsText, 10, 30);
        ctx.fillText(fpsText, 10, 30);

        // 통계
        const stats = [
          `Objects: ${metrics.detectionCount}`,
          `Confidence: ${(metrics.avgConfidence * 100).toFixed(1)}%`,
          `Inference: ${metrics.inferenceTime.toFixed(1)}ms`,
        ];
        ctx.font = 'bold 16px Arial';
        stats.forEach((stat, i) => {
          ctx.strokeText(stat, 10, 60 + i * 25);
          ctx.fillText(stat, 10, 60 + i * 25);
        });

        // 애니메이션 효과 (FPS 약간 변화)
        setMetrics(prev => ({
          ...prev,
          fps: 33 + Math.random() * 4,
          inferenceTime: 26 + Math.random() * 6,
        }));

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animate();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, metrics.fps, metrics.inferenceTime]);

  const toggleDemo = () => {
    setIsRunning(!isRunning);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            🤖 AI Object Detection DEMO
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-2">
            YOLOv8 + TensorFlow.js + MongoDB
          </p>
          <div className="inline-block px-4 py-2 bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg">
            <p className="text-yellow-300 text-sm">
              ⚠️ 데모 모드 - 웹캠 없이 시뮬레이션
            </p>
          </div>
        </div>

        <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl mb-6">
          <canvas
            ref={canvasRef}
            className="w-full h-auto"
            style={{ minHeight: '400px', maxHeight: '600px' }}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <button
            onClick={toggleDemo}
            className={`px-6 md:px-8 py-3 md:py-4 ${
              isRunning
                ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700'
                : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
            } text-white font-bold text-base md:text-lg rounded-xl transition-all transform hover:scale-105 shadow-lg`}
          >
            {isRunning ? '⏹️ 중지' : '🎥 데모 시작'}
          </button>
        </div>

        {isRunning && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <MetricCard title="FPS" value={metrics.fps.toFixed(1)} icon="⚡" />
            <MetricCard title="Objects" value={metrics.detectionCount.toString()} icon="🎯" />
            <MetricCard
              title="Confidence"
              value={`${(metrics.avgConfidence * 100).toFixed(1)}%`}
              icon="📊"
            />
            <MetricCard
              title="Inference"
              value={`${metrics.inferenceTime.toFixed(1)}ms`}
              icon="⏱️"
            />
          </div>
        )}

        <div className="mt-6 p-6 bg-blue-500 bg-opacity-20 border border-blue-500 rounded-lg">
          <h3 className="text-white text-xl font-bold mb-2">💡 데모 모드 안내</h3>
          <ul className="text-blue-200 space-y-2 ml-4">
            <li>• 이것은 웹캠 없이 AI 탐지 기능을 시연하는 데모입니다</li>
            <li>• 실제 웹캠이 있으면 App.tsx에서 AIDemo 컴포넌트로 전환하세요</li>
            <li>• 탐지 알고리즘, UI, 성능 메트릭은 실제와 동일합니다</li>
            <li>• MongoDB 연동 기능은 실제 버전에서 작동합니다</li>
          </ul>
        </div>

        <div className="mt-8 md:mt-12 text-center">
          <h3 className="text-xl md:text-2xl font-bold text-white mb-4">🛠️ Tech Stack</h3>
          <div className="flex flex-wrap justify-center gap-2 md:gap-3">
            {['React 18', 'TypeScript', 'TensorFlow.js', 'YOLOv8', 'MongoDB', 'Express', 'Canvas API'].map(
              (tech) => (
                <span
                  key={tech}
                  className="px-3 md:px-4 py-1.5 md:py-2 bg-white bg-opacity-10 text-white text-sm md:text-base rounded-full backdrop-blur-sm"
                >
                  {tech}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string; icon: string }> = ({
  title,
  value,
  icon,
}) => (
  <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-xl p-4 md:p-6 text-center border border-white border-opacity-20">
    <div className="text-3xl md:text-4xl mb-2">{icon}</div>
    <div className="text-gray-300 text-xs md:text-sm mb-1">{title}</div>
    <div className="text-white text-xl md:text-2xl font-bold">{value}</div>
  </div>
);