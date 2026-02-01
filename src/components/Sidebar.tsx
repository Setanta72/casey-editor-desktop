
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Book, Camera, Layers, FileText, Home, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

interface GitStatus {
    hasChanges: boolean;
    changes: number;
    branch: string;
    ahead: number;
}

const Sidebar = () => {
    const location = useLocation();
    const path = location.pathname.split('/')[1];
    const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [publishResult, setPublishResult] = useState<{ success: boolean; message: string } | null>(null);

    const navItems = [
        { name: 'Posts', path: '/posts', icon: Book },
        { name: 'Projects', path: '/projects', icon: Layers },
        { name: 'Pieces', path: '/pieces', icon: Camera },
        { name: 'Notes', path: '/notes', icon: FileText },
    ];

    // Fetch git status periodically
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/git/status`);
                setGitStatus(res.data);
            } catch (err) {
                console.error('Failed to fetch git status:', err);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 10000); // Every 10 seconds
        return () => clearInterval(interval);
    }, []);

    const handlePublish = async () => {
        if (!gitStatus?.hasChanges && !gitStatus?.ahead) {
            setPublishResult({ success: true, message: 'Nothing to publish' });
            setTimeout(() => setPublishResult(null), 3000);
            return;
        }

        setPublishing(true);
        setPublishResult(null);

        try {
            const res = await axios.post(`${API_URL}/api/git/publish`, {
                message: `Content update ${new Date().toLocaleDateString()}`
            });
            setPublishResult({ success: true, message: res.data.message });
            // Refresh status
            const statusRes = await axios.get(`${API_URL}/api/git/status`);
            setGitStatus(statusRes.data);
        } catch (err: any) {
            setPublishResult({ success: false, message: err.response?.data?.error || 'Publish failed' });
        } finally {
            setPublishing(false);
            setTimeout(() => setPublishResult(null), 5000);
        }
    };

    return (
        <div className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
            <div className="p-6">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    Casey Editor
                </h1>
                <p className="text-xs text-gray-500 mt-1">caseyclan.ie</p>
            </div>
            <nav className="flex-1 px-4">
                <Link
                    to="/"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${location.pathname === '/' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                >
                    <Home size={20} />
                    <span>Dashboard</span>
                </Link>
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${path === item.path.substring(1)
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`}
                    >
                        <item.icon size={20} />
                        <span>{item.name}</span>
                    </Link>
                ))}
            </nav>

            {/* Publish Section */}
            <div className="p-4 border-t border-gray-800">
                {gitStatus && (
                    <div className="mb-3 text-xs text-gray-500">
                        <div className="flex items-center justify-between">
                            <span>Branch: {gitStatus.branch || 'main'}</span>
                            {gitStatus.hasChanges && (
                                <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                                    {gitStatus.changes} changes
                                </span>
                            )}
                        </div>
                    </div>
                )}

                <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                        gitStatus?.hasChanges || gitStatus?.ahead
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-gray-800 text-gray-500 cursor-default'
                    } ${publishing ? 'opacity-50 cursor-wait' : ''}`}
                >
                    <Upload size={18} />
                    {publishing ? 'Publishing...' : 'Publish to Site'}
                </button>

                {publishResult && (
                    <div className={`mt-2 p-2 rounded text-xs flex items-center gap-2 ${
                        publishResult.success
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                    }`}>
                        {publishResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                        {publishResult.message}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar;
