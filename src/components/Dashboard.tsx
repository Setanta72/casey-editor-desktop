
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Book, Layers, Camera, FileText, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

interface ContentCounts {
    posts: number;
    projects: number;
    pieces: number;
    notes: number;
}

const Dashboard = () => {
    const [counts, setCounts] = useState<ContentCounts>({ posts: 0, projects: 0, pieces: 0, notes: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const types = ['posts', 'projects', 'pieces', 'notes'];
                const results = await Promise.all(
                    types.map(type => axios.get(`${API_URL}/api/content/${type}`).then(res => res.data.length).catch(() => 0))
                );
                setCounts({
                    posts: results[0],
                    projects: results[1],
                    pieces: results[2],
                    notes: results[3],
                });
            } catch (err) {
                console.error('Failed to fetch counts:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchCounts();
    }, []);

    const cards = [
        {
            name: 'Posts',
            path: '/posts',
            icon: Book,
            color: 'bg-blue-100 text-blue-600',
            desc: 'Blog posts and articles',
            count: counts.posts
        },
        {
            name: 'Projects',
            path: '/projects',
            icon: Layers,
            color: 'bg-emerald-100 text-emerald-600',
            desc: 'Ongoing work and portfolios',
            count: counts.projects
        },
        {
            name: 'Pieces',
            path: '/pieces',
            icon: Camera,
            color: 'bg-purple-100 text-purple-600',
            desc: 'Photography and finished works',
            count: counts.pieces
        },
        {
            name: 'Notes',
            path: '/notes',
            icon: FileText,
            color: 'bg-amber-100 text-amber-600',
            desc: 'Quick thoughts and references',
            count: counts.notes
        },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-10">
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Dashboard</h1>
                <p className="text-lg text-gray-500">Manage your website content from one place.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card) => (
                    <Link
                        key={card.name}
                        to={card.path}
                        className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-100 transition-all duration-200"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.color} transition-transform group-hover:scale-110`}>
                                <card.icon size={24} />
                            </div>
                            {!loading && (
                                <span className="text-2xl font-bold text-gray-300 group-hover:text-gray-400 transition-colors">
                                    {card.count}
                                </span>
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-indigo-600 transition-colors">{card.name}</h3>
                        <p className="text-sm text-gray-500 mb-4">{card.desc}</p>
                        <div className="flex items-center text-sm font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-200">
                            Manage <ArrowRight size={16} className="ml-1" />
                        </div>
                    </Link>
                ))}
            </div>

            {/* Quick Tips */}
            <div className="mt-12 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Tips</h2>
                <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div className="flex gap-3">
                        <span className="text-indigo-500 font-bold">Ctrl+S</span>
                        <span>Save your work while editing</span>
                    </div>
                    <div className="flex gap-3">
                        <span className="text-indigo-500 font-bold">Publish</span>
                        <span>Push changes to your live site from the sidebar</span>
                    </div>
                    <div className="flex gap-3">
                        <span className="text-indigo-500 font-bold">Categories</span>
                        <span>photography, ceramics, art, code, making, research</span>
                    </div>
                    <div className="flex gap-3">
                        <span className="text-indigo-500 font-bold">Images</span>
                        <span>Click the camera icon to pick from your library</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
