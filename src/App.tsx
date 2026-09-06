// src/App.tsx
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Activity, Database, Zap } from 'lucide-react';
import { AIDemo } from './components/AIDemo';
import { AdminDashboard } from './components/AdminDashboard';

function Navigation() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-gray-900 bg-opacity-80 backdrop-blur-lg border-b border-gray-700 sticky top-0 z-50 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-bold text-xl">AI Portfolio</span>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all ${
                isActive('/')
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Activity className="w-5 h-5" />
              <span>AI Detection</span>
            </Link>
            
            <Link
              to="/admin"
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all ${
                isActive('/admin')
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Database className="w-5 h-5" />
              <span>Admin Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
        <Navigation />
        
        <Routes>
          <Route path="/" element={<AIDemo />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;