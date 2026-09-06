// server/src/models/Detection.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IDetection extends Document {
  sessionId: string;
  timestamp: Date;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: number[];
  }>;
  performance: {
    fps: number;
    inferenceTime: number;
  };
  imageData?: string;
}

const DetectionSchema = new Schema({
  sessionId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now },
  detections: [{
    class: { type: String, required: true },
    confidence: { type: Number, required: true },
    bbox: [Number]
  }],
  performance: {
    fps: Number,
    inferenceTime: Number
  },
  imageData: String
});

// 둘 다 export
export const Detection = mongoose.model<IDetection>('Detection', DetectionSchema);
export default Detection;