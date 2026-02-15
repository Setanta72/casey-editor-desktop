import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import FileList from './components/FileList';
import Editor from './components/Editor';
import Setup from './components/Setup';
import Settings from './components/Settings';
import { isElectron } from './config';

const App = () => {
  const location = useLocation();
  const isEditor = location.pathname.split('/').length > 2;
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkConfiguration = async () => {
      if (isElectron() && window.electronAPI) {
        const configured = await window.electronAPI.isConfigured();
        setIsConfigured(configured);
      } else {
        // Running in browser (dev mode) - assume configured
        setIsConfigured(true);
      }
      setLoading(false);
    };
    checkConfiguration();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (isConfigured === false) {
    return <Setup onComplete={() => setIsConfigured(true)} />;
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <main className={`flex-1 flex flex-col ${isEditor ? 'overflow-hidden' : 'overflow-auto'}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/:type" element={<FileList />} />
          <Route path="/:type/:filename" element={<Editor />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
