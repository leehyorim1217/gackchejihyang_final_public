// server/src/services/StatsService.ts
import { pool } from '../config/mysql';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface DailyStats {
  id: number;
  date: string;
  total_sessions: number;
  total_detections: number;
  unique_users: number;
  avg_fps: number;
  avg_inference_time: number;
  most_detected_object: string | null;
}

export interface ObjectStats {
  id: number;
  object_class: string;
  total_count: number;
  avg_confidence: number;
  first_detected_at: Date;
  last_detected_at: Date;
}

export class StatsService {
  // 일별 통계 업데이트
  async updateDailyStats(date: string): Promise<void> {
    const connection = await pool.getConnection();
    
    try {
      // 해당 날짜의 세션 통계 계산
      const [sessionStats] = await connection.query<RowDataPacket[]>(
        `SELECT 
          COUNT(*) as total_sessions,
          SUM(total_detections) as total_detections,
          COUNT(DISTINCT user_id) as unique_users
         FROM user_sessions
         WHERE DATE(start_time) = ?`,
        [date]
      );
      
      const stats = sessionStats[0];
      
      // daily_stats 업데이트 또는 삽입
      await connection.query(
        `INSERT INTO daily_stats 
          (date, total_sessions, total_detections, unique_users)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          total_sessions = VALUES(total_sessions),
          total_detections = VALUES(total_detections),
          unique_users = VALUES(unique_users)`,
        [date, stats.total_sessions, stats.total_detections || 0, stats.unique_users]
      );
      
    } finally {
      connection.release();
    }
  }

  // 오늘 통계 조회
  async getTodayStats(): Promise<DailyStats | null> {
    const connection = await pool.getConnection();
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM daily_stats WHERE date = ?',
        [today]
      );
      
      return rows.length > 0 ? (rows[0] as DailyStats) : null;
      
    } finally {
      connection.release();
    }
  }

  // 날짜 범위 통계 조회
  async getStatsRange(startDate: string, endDate: string): Promise<DailyStats[]> {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM daily_stats 
         WHERE date BETWEEN ? AND ? 
         ORDER BY date DESC`,
        [startDate, endDate]
      );
      
      return rows as DailyStats[];
      
    } finally {
      connection.release();
    }
  }

  // 최근 N일 통계
  async getRecentStats(days: number = 7): Promise<DailyStats[]> {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM daily_stats 
         ORDER BY date DESC 
         LIMIT ?`,
        [days]
      );
      
      return rows as DailyStats[];
      
    } finally {
      connection.release();
    }
  }

  // 객체별 통계 업데이트
  async updateObjectStats(objectClass: string, confidence: number): Promise<void> {
    const connection = await pool.getConnection();
    
    try {
      // 기존 통계 조회
      const [existing] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM object_stats WHERE object_class = ?',
        [objectClass]
      );
      
      if (existing.length > 0) {
        const current = existing[0];
        const newCount = current.total_count + 1;
        const newAvgConfidence = (current.avg_confidence * current.total_count + confidence) / newCount;
        
        // 업데이트
        await connection.query(
          `UPDATE object_stats 
           SET total_count = ?, avg_confidence = ?, last_detected_at = NOW()
           WHERE object_class = ?`,
          [newCount, newAvgConfidence, objectClass]
        );
      } else {
        // 새로 삽입
        await connection.query(
          `INSERT INTO object_stats (object_class, total_count, avg_confidence)
           VALUES (?, 1, ?)`,
          [objectClass, confidence]
        );
      }
      
    } finally {
      connection.release();
    }
  }

  // 객체별 통계 조회
  async getObjectStats(limit: number = 20): Promise<ObjectStats[]> {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM object_stats 
         ORDER BY total_count DESC 
         LIMIT ?`,
        [limit]
      );
      
      return rows as ObjectStats[];
      
    } finally {
      connection.release();
    }
  }

  // 가장 많이 탐지된 객체
  async getMostDetectedObject(): Promise<ObjectStats | null> {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM object_stats 
         ORDER BY total_count DESC 
         LIMIT 1`
      );
      
      return rows.length > 0 ? (rows[0] as ObjectStats) : null;
      
    } finally {
      connection.release();
    }
  }

  // 대시보드 종합 통계
  async getDashboardStats(): Promise<any> {
    const connection = await pool.getConnection();
    
    try {
      // 오늘 통계
      const today = new Date().toISOString().split('T')[0];
      const [todayStats] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM daily_stats WHERE date = ?',
        [today]
      );
      
      // 전체 사용자 수
      const [userCount] = await connection.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM users'
      );
      
      // 전체 세션 수
      const [sessionCount] = await connection.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM user_sessions'
      );
      
      // 전체 탐지 수
      const [detectionCount] = await connection.query<RowDataPacket[]>(
        'SELECT SUM(total_detections) as total FROM user_sessions'
      );
      
      // 상위 5개 객체
      const [topObjects] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM object_stats 
         ORDER BY total_count DESC 
         LIMIT 5`
      );
      
      // 최근 7일 통계
      const [recentStats] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM daily_stats 
         ORDER BY date DESC 
         LIMIT 7`
      );
      
      return {
        today: todayStats[0] || null,
        totals: {
          users: userCount[0].total,
          sessions: sessionCount[0].total,
          detections: detectionCount[0].total || 0
        },
        topObjects: topObjects,
        recentStats: recentStats
      };
      
    } finally {
      connection.release();
    }
  }

  // 사용자별 통계
  async getUserStats(userId: number): Promise<any> {
    const connection = await pool.getConnection();
    
    try {
      // 세션 통계
      const [sessionStats] = await connection.query<RowDataPacket[]>(
        `SELECT 
          COUNT(*) as total_sessions,
          SUM(total_detections) as total_detections,
          SUM(duration_seconds) as total_duration,
          AVG(total_detections) as avg_detections_per_session,
          MAX(start_time) as last_session
         FROM user_sessions
         WHERE user_id = ?`,
        [userId]
      );
      
      // 최근 세션 목록
      const [recentSessions] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM user_sessions
         WHERE user_id = ?
         ORDER BY start_time DESC
         LIMIT 10`,
        [userId]
      );
      
      return {
        stats: sessionStats[0],
        recentSessions: recentSessions
      };
      
    } finally {
      connection.release();
    }
  }

  // 성능 로그 기록
  async logPerformance(data: {
    cpu_usage?: number;
    memory_usage?: number;
    active_sessions?: number;
    api_response_time?: number;
  }): Promise<void> {
    const connection = await pool.getConnection();
    
    try {
      await connection.query(
        `INSERT INTO performance_logs 
          (cpu_usage, memory_usage, active_sessions, api_response_time)
         VALUES (?, ?, ?, ?)`,
        [
          data.cpu_usage || null,
          data.memory_usage || null,
          data.active_sessions || 0,
          data.api_response_time || null
        ]
      );
      
    } finally {
      connection.release();
    }
  }

  // 에러 로그 기록
  async logError(data: {
    error_type: string;
    error_message: string;
    user_id?: number;
    stack_trace?: string;
    request_url?: string;
  }): Promise<void> {
    const connection = await pool.getConnection();
    
    try {
      await connection.query(
        `INSERT INTO error_logs 
          (error_type, error_message, user_id, stack_trace, request_url)
         VALUES (?, ?, ?, ?, ?)`,
        [
          data.error_type,
          data.error_message,
          data.user_id || null,
          data.stack_trace || null,
          data.request_url || null
        ]
      );
      
    } finally {
      connection.release();
    }
  }
}

export default new StatsService();