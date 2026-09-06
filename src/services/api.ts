// src/services/api.ts - 완전한 버전 (삭제 함수 추가)

interface SessionData {
  userId: string;
}

interface SessionResponse {
  _id: string;
  userId: string;
  startTime: Date;
}

interface DetectionData {
  sessionId: string;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: number[];
  }>;
  performance: {
    fps: number;
    inferenceTime: number;
  };
}

interface SessionEndData {
  totalDetections: number;
  avgFPS: number;
  avgInferenceTime: number;
}

class APIService {
  private baseURL: string;
  private isServerAvailable: boolean = false;
  private checkingHealth: boolean = false;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    this.checkServerHealth();
  }

  private async checkServerHealth() {
    if (this.checkingHealth) return;
    this.checkingHealth = true;

    try {
      const response = await fetch('http://localhost:5000/', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      this.isServerAvailable = response.ok;
      console.log(this.isServerAvailable ? '✅ Backend server connected' : '⚠️ Backend server unavailable');
    } catch (error) {
      this.isServerAvailable = false;
      console.warn('⚠️ Backend server offline - running in local mode');
    } finally {
      this.checkingHealth = false;
    }
  }

  async startSession(data: SessionData): Promise<SessionResponse> {
    console.log('🚀 Starting session...', data);

    if (!this.isServerAvailable) {
      const localSession = {
        _id: `local-${Date.now()}`,
        userId: data.userId,
        startTime: new Date(),
      };
      console.log('📝 Created local session:', localSession._id);
      return localSession;
    }

    try {
      const response = await fetch(`${this.baseURL}/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const session = await response.json();
      console.log('✅ Session started in database:', session._id);
      return session;
    } catch (error) {
      console.warn('⚠️ Failed to start session in database, using local:', error);
      return {
        _id: `local-${Date.now()}`,
        userId: data.userId,
        startTime: new Date(),
      };
    }
  }

  async saveDetection(data: DetectionData): Promise<void> {
    if (!this.isServerAvailable) {
      console.log('📊 Detection data (local mode):', {
        session: data.sessionId,
        count: data.detections.length,
        fps: data.performance.fps.toFixed(1),
      });
      return;
    }

    try {
      const response = await fetch(`${this.baseURL}/detections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ Saved ${data.detections.length} detections to database`);
    } catch (error) {
      console.warn('⚠️ Failed to save detection:', error);
    }
  }

  async endSession(sessionId: string, data: SessionEndData): Promise<void> {
    console.log('🏁 Ending session:', sessionId, data);

    if (!this.isServerAvailable) {
      console.log('📊 Session ended (local mode):', data);
      return;
    }

    try {
      const response = await fetch(`${this.baseURL}/sessions/end/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Session ended in database');
    } catch (error) {
      console.warn('⚠️ Failed to end session:', error);
    }
  }

  // ✅ 개별 세션 삭제
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.isServerAvailable) {
      console.log('📊 Session delete (local mode):', sessionId);
      return;
    }

    try {
      const response = await fetch(`${this.baseURL}/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Session deleted: ${sessionId} (${result.deletedDetections} detections removed)`);
    } catch (error) {
      console.error('❌ Failed to delete session:', error);
      throw error;
    }
  }

  // ✅ 전체 세션 삭제
  async deleteAllSessions(): Promise<void> {
    if (!this.isServerAvailable) {
      console.log('📊 Delete all sessions (local mode)');
      return;
    }

    try {
      const response = await fetch(`${this.baseURL}/sessions`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ All sessions deleted: ${result.deletedSessions} sessions, ${result.deletedDetections} detections`);
    } catch (error) {
      console.error('❌ Failed to delete all sessions:', error);
      throw error;
    }
  }

  async getSessionStats(sessionId: string) {
    if (!this.isServerAvailable) {
      return { message: 'Backend server offline' };
    }

    try {
      const response = await fetch(`${this.baseURL}/detections/stats/${sessionId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('⚠️ Failed to fetch stats:', error);
      return { error: 'Unable to fetch statistics' };
    }
  }

  async getSessions() {
    if (!this.isServerAvailable) {
      return [];
    }

    try {
      const response = await fetch(`${this.baseURL}/sessions`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('⚠️ Failed to fetch sessions:', error);
      return [];
    }
  }

  isBackendAvailable(): boolean {
    return this.isServerAvailable;
  }

  async recheckConnection(): Promise<boolean> {
    await this.checkServerHealth();
    return this.isServerAvailable;
  }
}

export const api = new APIService();