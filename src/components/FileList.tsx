
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { API_URL, CONTENT_TYPES } from '../config';

interface FileItem {
    filename: string;
    title?: string;
    date?: string;
    category?: string;
    status?: string;
    [key: string]: any;
}

const FileList = () => {
    const { type } = useParams<{ type: string }>();
    const [files, setFiles] = useState<FileItem[]>([]);
    const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [deleting, setDeleting] = useState<string | null>(null);

    const contentType = CONTENT_TYPES[type as keyof typeof CONTENT_TYPES];

    useEffect(() => {
        const fetchFiles = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await axios.get(`${API_URL}/api/content/${type}`);
                // Sort by date descending
                const sorted = response.data.sort((a: FileItem, b: FileItem) => {
                    const dateA = new Date(a.date || a.started || a.updated || 0);
                    const dateB = new Date(b.date || b.started || b.updated || 0);
                    return dateB.getTime() - dateA.getTime();
                });
                setFiles(sorted);
                setFilteredFiles(sorted);
            } catch (err: any) {
                console.error(err);
                setError('Failed to load content. Ensure the server is running on port 3001.');
            } finally {
                setLoading(false);
            }
        };

        if (type) fetchFiles();
    }, [type]);

    // Filter files based on search term
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredFiles(files);
            return;
        }

        const term = searchTerm.toLowerCase();
        const filtered = files.filter(file =>
            file.title?.toLowerCase().includes(term) ||
            file.filename.toLowerCase().includes(term) ||
            file.category?.toLowerCase().includes(term) ||
            file.tags?.some((tag: string) => tag.toLowerCase().includes(term))
        );
        setFilteredFiles(filtered);
    }, [searchTerm, files]);

    const handleDelete = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete "${filename}"? This cannot be undone.`)) {
            return;
        }

        setDeleting(filename);
        try {
            await axios.delete(`${API_URL}/api/content/${type}/${filename}`);
            setFiles(prev => prev.filter(f => f.filename !== filename));
        } catch (err: any) {
            alert('Failed to delete: ' + (err.response?.data?.error || err.message));
        } finally {
            setDeleting(null);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="text-gray-500">Loading {type}...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold capitalize text-gray-800">{contentType?.plural || type}</h1>
                    <p className="text-gray-500 text-sm mt-1">{contentType?.description}</p>
                </div>
                <Link
                    to={`/${type}/new`}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm"
                >
                    <Plus size={18} />
                    New {contentType?.singular || type?.slice(0, -1)}
                </Link>
            </div>

            {/* Search */}
            <div className="mb-4">
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={`Search ${type}...`}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    />
                </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title / Filename</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            {type === 'projects' && (
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            )}
                            {(type === 'pieces' || type === 'projects') && (
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            )}
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredFiles.map((file) => (
                            <tr key={file.filename} className="hover:bg-gray-50 group">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{file.title || file.filename.replace('.md', '')}</div>
                                    <div className="text-xs text-gray-500 font-mono">{file.filename}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {(file.date || file.started || file.updated)
                                        ? new Date(file.date || file.started || file.updated).toLocaleDateString()
                                        : '-'}
                                </td>
                                {type === 'projects' && (
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                            file.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                            file.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                            file.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                            {file.status || 'active'}
                                        </span>
                                    </td>
                                )}
                                {(type === 'pieces' || type === 'projects') && (
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                        {file.category || '-'}
                                    </td>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link
                                            to={`/${type}/${file.filename}`}
                                            className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50"
                                        >
                                            <Edit size={16} /> Edit
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(file.filename)}
                                            disabled={deleting === file.filename}
                                            className="text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredFiles.length === 0 && (
                    <div className="p-6 text-center text-gray-500">
                        {searchTerm ? `No ${type} matching "${searchTerm}"` : `No ${type} found. Create one to get started.`}
                    </div>
                )}
            </div>

            <div className="mt-4 text-sm text-gray-500">
                {filteredFiles.length} of {files.length} {type}
            </div>
        </div>
    );
};

export default FileList;
