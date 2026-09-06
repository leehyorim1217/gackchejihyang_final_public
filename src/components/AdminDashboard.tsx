import { useEffect, useState } from 'react';
import { 
  Users, 
  Activity, 
  BarChart3, 
  RefreshCcw,
  Database,
  Clock,
  TrendingUp,
  Calendar,
  Trash2,
  AlertTriangle,
  Eye,
  Target
} from 'lucide-react';

interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  created_at: string;
  last_login: string | null;
}

interface Session {
  _id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  totalDetections: number;
  avgFPS: number;
  avgInferenceTime: number;
}

// 🔥 Detection 인터페이스 추가
interface Detection {
  _id: string;
  timestamp: string;
  detections: Array<{
    class: string;
    classId: number;
    score: number;
    bbox: number[];
  }>;
  count: number;
  avgConfidence: number;
}

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'sessions' | 'detections'>('users');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  // 🔥 자동 새로고침 (10초마다)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Users
      const usersRes = await fetch('http://localhost:5000/api/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      // Sessions
      const sessionsRes = await fetch('http://localhost:5000/api/sessions');
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData);
      }

      // 🔥 Detections 데이터 가져오기
      const detectionsRes = await fetch('http://localhost:5000/api/detections');
      if (detectionsRes.ok) {
        const detectionsData = await detectionsRes.json();
        setDetections(detectionsData);
      }

    } catch (error) {
      console.error('Data loading failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 개별 세션 삭제
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('이 세션을 삭제하시겠습니까?')) return;

    setDeleteLoading(sessionId);
    try {
      const response = await fetch(`http://localhost:5000/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('삭제 실패');

      setSessions(prev => prev.filter(s => s._id !== sessionId));
      alert('세션이 삭제되었습니다');
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('세션 삭제 실패');
    } finally {
      setDeleteLoading(null);
    }
  };

  // ✅ 전체 세션 삭제
  const handleDeleteAll = async () => {
    setShowDeleteAllConfirm(false);
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/sessions', {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('전체 삭제 실패');

      setSessions([]);
      alert('모든 세션이 삭제되었습니다');
    } catch (error) {
      console.error('전체 삭제 실패:', error);
      alert('전체 세션 삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 개별 detection 삭제
  const handleDeleteDetection = async (detectionId: string) => {
    if (!confirm('이 detection 기록을 삭제하시겠습니까?')) return;

    setDeleteLoading(detectionId);
    try {
      const response = await fetch(`http://localhost:5000/api/detections/${detectionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('삭제 실패');

      setDetections(prev => prev.filter(d => d._id !== detectionId));
      alert('Detection 기록이 삭제되었습니다');
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('Detection 삭제 실패');
    } finally {
      setDeleteLoading(null);
    }
  };

  // 🔥 전체 detections 삭제
  const handleDeleteAllDetections = async () => {
    if (!confirm('모든 detection 기록을 삭제하시겠습니까?')) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/detections/all', {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('전체 삭제 실패');

      setDetections([]);
      alert('모든 detection 기록이 삭제되었습니다');
    } catch (error) {
      console.error('전체 삭제 실패:', error);
      alert('전체 detection 삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  const totalDetections = sessions.reduce((sum, s) => sum + s.totalDetections, 0);
  const totalDetectionRecords = detections.reduce((sum, d) => sum + d.count, 0);

  const formatDuration = (start: string, end?: string) => {
    if (!end) return 'In Progress';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCcw className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-2xl font-semibold">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Database className="w-10 h-10 text-blue-400" />
                <h1 className="text-4xl font-bold text-white">
                  Database Dashboard
                </h1>
              </div>
              <p className="text-gray-300 text-lg">Real-time User, Session & Detection Analytics</p>
            </div>
            
            {/* 자동 새로고침 토글 */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                  autoRefresh 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                <RefreshCcw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
              </button>
              
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh Now
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Users}
            title="Total Users"
            value={users.length.toString()}
            gradient="from-blue-500 to-blue-700"
            description="Registered accounts"
          />
          <StatCard
            icon={Activity}
            title="Total Sessions"
            value={sessions.length.toString()}
            gradient="from-green-500 to-emerald-700"
            description="Detection sessions"
          />
          <StatCard
            icon={Target}
            title="Detection Records"
            value={detections.length.toString()}
            gradient="from-orange-500 to-red-700"
            description="API calls logged"
          />
          <StatCard
            icon={TrendingUp}
            title="Total Detections"
            value={totalDetectionRecords.toString()}
            gradient="from-purple-500 to-pink-700"
            description="Objects detected"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-4 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'bg-gray-800 bg-opacity-50 text-gray-300 hover:bg-opacity-70'
            }`}
          >
            <Users className="w-5 h-5" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'sessions'
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'bg-gray-800 bg-opacity-50 text-gray-300 hover:bg-opacity-70'
            }`}
          >
            <Activity className="w-5 h-5" />
            Sessions
          </button>
          
          {/* 🔥 Detections 탭 추가 */}
          <button
            onClick={() => setActiveTab('detections')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'detections'
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'bg-gray-800 bg-opacity-50 text-gray-300 hover:bg-opacity-70'
            }`}
          >
            <Eye className="w-5 h-5" />
            Detections
          </button>
          
          {/* 전체 삭제 버튼 */}
          {activeTab === 'sessions' && sessions.length > 0 && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg"
            >
              <Trash2 className="w-5 h-5" />
              Delete All Sessions
            </button>
          )}
          
          {activeTab === 'detections' && detections.length > 0 && (
            <button
              onClick={handleDeleteAllDetections}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg"
            >
              <Trash2 className="w-5 h-5" />
              Delete All Detections
            </button>
          )}
        </div>

        {/* Delete All Confirmation Modal */}
        {showDeleteAllConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <h3 className="text-2xl font-bold text-white">Confirm Delete All</h3>
              </div>
              <p className="text-gray-300 mb-6">
                Are you sure you want to delete all sessions? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAll}
                  className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors"
                >
                  Delete All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        {activeTab === 'users' && (
          <div className="bg-gray-800 bg-opacity-50 backdrop-blur-lg rounded-2xl overflow-hidden border border-gray-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 bg-opacity-70">
                  <tr>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">ID</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Email</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Username</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Role</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Created</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr
                      key={user.id}
                      className={`border-t border-gray-700 hover:bg-gray-700 hover:bg-opacity-30 transition-colors ${
                        index % 2 === 0 ? 'bg-gray-800 bg-opacity-20' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-white font-mono text-sm">{user.id}</td>
                      <td className="px-6 py-4 text-white">{user.email}</td>
                      <td className="px-6 py-4 text-white font-semibold">{user.username}</td>
                      <td className="px-6 py-4">
                        <RoleBadge role={user.role || 'user'} />
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {new Date(user.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">
                        {user.last_login ? (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {new Date(user.last_login).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        ) : (
                          <span className="text-gray-500">Never</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && (
              <div className="text-center py-16">
                <Database className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No users found</p>
              </div>
            )}
          </div>
        )}

        {/* Sessions Table */}
        {activeTab === 'sessions' && (
          <div className="bg-gray-800 bg-opacity-50 backdrop-blur-lg rounded-2xl overflow-hidden border border-gray-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 bg-opacity-70">
                  <tr>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Session ID</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">User</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Detections</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Avg FPS</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Duration</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Created</th>
                    <th className="px-6 py-4 text-center text-white font-bold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session, index) => (
                    <tr
                      key={session._id}
                      className={`border-t border-gray-700 hover:bg-gray-700 hover:bg-opacity-30 transition-colors ${
                        index % 2 === 0 ? 'bg-gray-800 bg-opacity-20' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-white font-mono text-sm">
                        {session._id.slice(-8)}
                      </td>
                      <td className="px-6 py-4 text-white font-semibold">
                        {session.userId}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-purple-400" />
                          <span className="text-white font-bold">{session.totalDetections}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {session.avgFPS.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {formatDuration(session.startTime, session.endTime)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">
                        {new Date(session.startTime).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDeleteSession(session._id)}
                          disabled={deleteLoading === session._id}
                          className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                          title="Delete session"
                        >
                          {deleteLoading === session._id ? (
                            <RefreshCcw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sessions.length === 0 && (
              <div className="text-center py-16">
                <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No sessions found</p>
              </div>
            )}
          </div>
        )}

        {/* 🔥 Detections Table - 새로 추가 */}
        {activeTab === 'detections' && (
          <div className="bg-gray-800 bg-opacity-50 backdrop-blur-lg rounded-2xl overflow-hidden border border-gray-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 bg-opacity-70">
                  <tr>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">ID</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Timestamp</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Objects</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Avg Confidence</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-sm">Details</th>
                    <th className="px-6 py-4 text-center text-white font-bold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detections.map((detection, index) => (
                    <tr
                      key={detection._id}
                      className={`border-t border-gray-700 hover:bg-gray-700 hover:bg-opacity-30 transition-colors ${
                        index % 2 === 0 ? 'bg-gray-800 bg-opacity-20' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-white font-mono text-sm">
                        {detection._id.slice(-8)}
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {new Date(detection.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-orange-400" />
                          <span className="text-white font-bold">{detection.count}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {(detection.avgConfidence * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {detection.detections.slice(0, 3).map((det, idx) => (
                            <span 
                              key={idx}
                              className="px-2 py-1 bg-blue-600 bg-opacity-30 text-blue-200 text-xs rounded-full"
                            >
                              {det.class}
                            </span>
                          ))}
                          {detection.detections.length > 3 && (
                            <span className="px-2 py-1 bg-gray-600 bg-opacity-30 text-gray-300 text-xs rounded-full">
                              +{detection.detections.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDeleteDetection(detection._id)}
                          disabled={deleteLoading === detection._id}
                          className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                          title="Delete detection"
                        >
                          {deleteLoading === detection._id ? (
                            <RefreshCcw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detections.length === 0 && (
              <div className="text-center py-16">
                <Eye className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No detection records found</p>
                <p className="text-gray-500 text-sm mt-2">Start detecting objects to see data here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ElementType;
  title: string;
  value: string;
  gradient: string;
  description: string;
}> = ({ icon: Icon, title, value, gradient, description }) => (
  <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 shadow-xl border border-white border-opacity-20`}>
    <div className="flex items-start justify-between mb-4">
      <div>
        <p className="text-white text-opacity-90 text-sm font-semibold mb-1">{title}</p>
        <p className="text-white text-4xl font-bold">{value}</p>
        <p className="text-white text-opacity-70 text-xs mt-2">{description}</p>
      </div>
      <div className="p-3 bg-white bg-opacity-20 rounded-xl">
        <Icon className="w-7 h-7 text-white" />
      </div>
    </div>
  </div>
);

const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const safeRole = role || 'user';
  
  const colors = {
    admin: 'bg-red-100 text-red-800',
    user: 'bg-blue-100 text-blue-800',
    demo: 'bg-gray-100 text-gray-800'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[safeRole as keyof typeof colors] || colors.user}`}>
      {safeRole.toUpperCase()}
    </span>
  );
};

export default AdminDashboard;