// server/src/models/Session.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  userId?: string;
  startTime: Date;
  endTime?: Date;
  totalDetections: number;
  avgFPS: number;
  avgInferenceTime: number;
  detectedClasses: { [key: string]: number };
}

const SessionSchema = new Schema({
  userId: String,
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  totalDetections: { type: Number, default: 0 },
  avgFPS: { type: Number, default: 0 },
  avgInferenceTime: { type: Number, default: 0 },
  detectedClasses: { type: Schema.Types.Mixed, default: {} }
});

// 둘 다 export
export const Session = mongoose.model<ISession>('Session', SessionSchema);
export default Session;