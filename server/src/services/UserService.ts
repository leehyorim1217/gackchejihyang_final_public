// server/src/services/UserService.ts
import { pool } from '../config/mysql';
import bcrypt from 'bcryptjs';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface User {
  id: number;
  email: string;
  username: string;
  role: 'admin' | 'user' | 'guest';
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
}

export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  role?: 'admin' | 'user' | 'guest';
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export class UserService {
  // 사용자 생성
  async createUser(data: CreateUserData): Promise<User> {
    const connection = await pool.getConnection();
    
    try {
      // 비밀번호 해싱
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(data.password, saltRounds);
      
      // 사용자 삽입
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO users (email, username, password_hash, role) 
         VALUES (?, ?, ?, ?)`,
        [data.email, data.username, passwordHash, data.role || 'user']
      );
      
      // 생성된 사용자 조회
      const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT id, email, username, role, created_at, updated_at, last_login FROM users WHERE id = ?',
        [result.insertId]
      );
      
      return rows[0] as User;
      
    } finally {
      connection.release();
    }
  }

  // 로그인
  async login(credentials: LoginCredentials): Promise<User | null> {
    const connection = await pool.getConnection();
    
    try {
      // 이메일로 사용자 조회
      const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM users WHERE email = ?',
        [credentials.email]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      const user = rows[0];
      
      // 비밀번호 검증
      const isValid = await bcrypt.compare(credentials.password, user.password_hash);
      
      if (!isValid) {
        return null;
      }
      
      // 마지막 로그인 시간 업데이트
      await connection.query(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [user.id]
      );
      
      // 비밀번호 해시 제거 후 반환
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
      
    } finally {
      connection.release();
    }
  }

  // ID로 사용자 조회
  async getUserById(userId: number): Promise<User | null> {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT id, email, username, role, created_at, updated_at, last_login FROM users WHERE id = ?',
        [userId]
      );
      
      return rows.length > 0 ? (rows[0] as User) : null;
      
    } finally {
      connection.release();
    }
  }

  // 이메일로 사용자 조회
  async getUserByEmail(email: string): Promise<User | null> {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT id, email, username, role, created_at, updated_at, last_login FROM users WHERE email = ?',
        [email]
      );
      
      return rows.length > 0 ? (rows[0] as User) : null;
      
    } finally {
      connection.release();
    }
  }

  // 모든 사용자 조회
  async getAllUsers(limit = 100, offset = 0): Promise<User[]> {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id, email, username, role, created_at, updated_at, last_login 
         FROM users 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      
      return rows as User[];
      
    } finally {
      connection.release();
    }
  }

  // 사용자 업데이트
  async updateUser(userId: number, updates: Partial<CreateUserData>): Promise<User | null> {
    const connection = await pool.getConnection();
    
    try {
      const fields: string[] = [];
      const values: any[] = [];
      
      if (updates.email) {
        fields.push('email = ?');
        values.push(updates.email);
      }
      if (updates.username) {
        fields.push('username = ?');
        values.push(updates.username);
      }
      if (updates.password) {
        const passwordHash = await bcrypt.hash(updates.password, 10);
        fields.push('password_hash = ?');
        values.push(passwordHash);
      }
      if (updates.role) {
        fields.push('role = ?');
        values.push(updates.role);
      }
      
      if (fields.length === 0) {
        return this.getUserById(userId);
      }
      
      values.push(userId);
      
      await connection.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      
      return this.getUserById(userId);
      
    } finally {
      connection.release();
    }
  }

  // 사용자 삭제
  async deleteUser(userId: number): Promise<boolean> {
    const connection = await pool.getConnection();
    
    try {
      const [result] = await connection.query<ResultSetHeader>(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );
      
      return result.affectedRows > 0;
      
    } finally {
      connection.release();
    }
  }

  // 사용자 통계
  async getUserStats(userId: number): Promise<any> {
    const connection = await pool.getConnection();
    
    try {
      const [sessionStats] = await connection.query<RowDataPacket[]>(
        `SELECT 
          COUNT(*) as total_sessions,
          SUM(total_detections) as total_detections,
          SUM(duration_seconds) as total_duration_seconds,
          AVG(total_detections) as avg_detections_per_session
         FROM user_sessions 
         WHERE user_id = ?`,
        [userId]
      );
      
      return sessionStats[0];
      
    } finally {
      connection.release();
    }
  }
}

export default new UserService();