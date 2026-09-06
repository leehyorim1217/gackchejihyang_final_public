// server/src/config/mysql.ts
import { createPool, Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// 타입 재정의
export type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// MySQL 연결 풀 생성
export const pool: Pool = createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'ai_portfolio',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// 연결 테스트 함수
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL 연결 성공');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL 연결 실패:', error);
    return false;
  }
}

// 데이터베이스 초기화 함수
export async function initializeDatabase(): Promise<void> {
  const connection = await pool.getConnection();
  
  try {
    // Users 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user', 'guest') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        INDEX idx_email (email),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // UserSessions 테이블 (MongoDB 세션과 연결)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        mongodb_session_id VARCHAR(255) NOT NULL,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP NULL,
        duration_seconds INT NULL,
        total_detections INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_mongodb_session_id (mongodb_session_id),
        INDEX idx_start_time (start_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // DailyStats 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id INT PRIMARY KEY AUTO_INCREMENT,
        date DATE UNIQUE NOT NULL,
        total_sessions INT DEFAULT 0,
        total_detections INT DEFAULT 0,
        unique_users INT DEFAULT 0,
        avg_fps DECIMAL(5,2) DEFAULT 0,
        avg_inference_time DECIMAL(6,2) DEFAULT 0,
        most_detected_object VARCHAR(100),
        INDEX idx_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ObjectStats 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS object_stats (
        id INT PRIMARY KEY AUTO_INCREMENT,
        object_class VARCHAR(100) NOT NULL,
        total_count INT DEFAULT 0,
        avg_confidence DECIMAL(4,3) DEFAULT 0,
        first_detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_object_class (object_class),
        INDEX idx_total_count (total_count DESC),
        INDEX idx_last_detected (last_detected_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // PerformanceLogs 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS performance_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cpu_usage DECIMAL(5,2),
        memory_usage DECIMAL(5,2),
        active_sessions INT DEFAULT 0,
        api_response_time DECIMAL(8,2),
        INDEX idx_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ErrorLogs 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        error_type VARCHAR(100),
        error_message TEXT,
        user_id INT NULL,
        stack_trace TEXT,
        request_url VARCHAR(500),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_timestamp (timestamp),
        INDEX idx_error_type (error_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ 모든 MySQL 테이블 생성 완료');
    
  } catch (error) {
    console.error('❌ 테이블 생성 실패:', error);
    throw error;
  } finally {
    connection.release();
  }
}

export default pool;