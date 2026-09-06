// src/components/UIDemoOnly.tsx
import React, { useState } from 'react';

export const UIDemoOnly: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [metrics] = useState({
    fps: 32.5,
    detectionCount: 3,
    avgConfidence: 0.87,
    inferenceTime: 28.3,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex flex-col items-center justify-center p-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4">
            AI Object Detection
          </h1>
          <p className="text-xl text-gray-300">
            YOLOv8 + TensorFlow.js 실시간 객체 탐지 시스템
          </p>
        </div>

        <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl mb-6">
          <div className="w-full h-96 flex items-center justify-center">
            <div className="text-center">
              <p className="text-white text-xl">웹캠 스트리밍 영역</p>
              <p className="text-gray-400 mt-2">
                
              </p>
            </div>
          </div>

          {isActive && (
            <>
              <div className="absolute top-20 left-20 w-32 h-32 border-4 border-blue-500 rounded">
                <div className="absolute -top-6 left-0 bg-blue-500 px-2 py-1 rounded text-white text-sm">
                  person 95.3%
                </div>
              </div>
              <div className="absolute top-40 right-32 w-24 h-24 border-4 border-green-500 rounded">
                <div className="absolute -top-6 left-0 bg-green-500 px-2 py-1 rounded text-white text-sm">
                  laptop 88.7%
                </div>
              </div>
              <div className="absolute bottom-20 left-40 w-20 h-20 border-4 border-purple-500 rounded">
                <div className="absolute -top-6 left-0 bg-purple-500 px-2 py-1 rounded text-white text-sm">
                  cup 76.2%
                </div>
              </div>
            </>
          )}

          {isActive && (
            <div className="absolute top-4 left-4 bg-green-500 px-3 py-1 rounded text-white font-bold">
              FPS: {metrics.fps.toFixed(1)}
            </div>
          )}
        </div>

        <div className="flex gap-4 justify-center mb-6">
          {!isActive ? (
            <button
              onClick={() => setIsActive(true)}
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-lg rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
            >
              시작
            </button>
          ) : (
            <button
              onClick={() => setIsActive(false)}
              className="px-8 py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white font-bold text-lg rounded-xl hover:from-red-600 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg"
            >
              ⏹️ 중지
            </button>
          )}
        </div>

        {isActive && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

        
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string; icon: string }> = ({
  title,
  value,
  icon,
}) => (
  <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-xl p-6 text-center border border-white border-opacity-20">
    <div className="text-4xl mb-2">{icon}</div>
    <div className="text-gray-300 text-sm mb-1">{title}</div>
    <div className="text-white text-2xl font-bold">{value}</div>
  </div>
);