
import { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Camera, Eye, Edit3, Image as ImageIcon, Link as LinkIcon, Bold, Italic, List, Layers, Circle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_URL, CATEGORIES, PROJECT_STATUSES } from '../config';

const Editor = () => {
    const { type, filename } = useParams<{ type: string; filename: string }>();
    const navigate = useNavigate();
    const isNew = filename === 'new';

    // State
    const [frontmatter, setFrontmatter] = useState<Record<string, any>>({});
    const [content, setContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [originalFrontmatter, setOriginalFrontmatter] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [targetFilename, setTargetFilename] = useState(filename === 'new' ? '' : filename);
    const [availableImages, setAvailableImages] = useState<string[]>([]);
    const [mediaLibraryImages, setMediaLibraryImages] = useState<any[]>([]);
    const [imageSource, setImageSource] = useState<'site' | 'library'>('library');

    // UI State
    const [showImagePicker, setShowImagePicker] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'write' | 'preview' | 'split'>('split');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Initial Templates
    const templates: Record<string, any> = {
        posts: { title: '', date: new Date().toISOString().split('T')[0], tags: [], description: '', image: '' },
        projects: { title: '', started: new Date().toISOString().split('T')[0], status: 'active', category: 'photography', tags: [], image: '' },
        pieces: { title: '', date: new Date().toISOString().split('T')[0], category: 'photography', medium: '', dimensions: '' },
        notes: { title: '', updated: new Date().toISOString().split('T')[0], category: '', tags: [] }
    };

    // Check if there are unsaved changes
    const hasUnsavedChanges = useCallback(() => {
        if (isNew) {
            return content.trim() !== '' || frontmatter.title?.trim() !== '';
        }
        return content !== originalContent || JSON.stringify(frontmatter) !== JSON.stringify(originalFrontmatter);
    }, [content, frontmatter, originalContent, originalFrontmatter, isNew]);

    // Load file content
    useEffect(() => {
        if (!isNew && filename) {
            axios.get(`${API_URL}/api/content/${type}/${filename}`)
                .then(res => {
                    setFrontmatter(res.data.frontmatter || {});
                    setOriginalFrontmatter(res.data.frontmatter || {});
                    setContent(res.data.content || '');
                    setOriginalContent(res.data.content || '');
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    alert('Failed to load file');
                    navigate(`/${type}`);
                });
        } else {
            const template = templates[type || 'posts'] || {};
            setFrontmatter(template);
            setOriginalFrontmatter(template);
        }

        // Load images from both sources
        axios.get(`${API_URL}/api/media`).then(res => setAvailableImages(res.data));
        axios.get(`${API_URL}/api/media-library`).then(res => setMediaLibraryImages(res.data));
    }, [type, filename, isNew]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [frontmatter, content, targetFilename, type]);

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const handleSave = async () => {
        if (!targetFilename) {
            alert('Filename is required');
            return;
        }

        let finalFilename = targetFilename;
        if (!finalFilename.endsWith('.md')) finalFilename += '.md';

        setSaving(true);
        try {
            await axios.post(`${API_URL}/api/content/${type}/${finalFilename}`, {
                frontmatter,
                content
            });
            setLastSaved(new Date());
            setOriginalContent(content);
            setOriginalFrontmatter({ ...frontmatter });
            if (isNew) {
                navigate(`/${type}/${finalFilename}`, { replace: true });
            }
            // Trigger git status refresh in sidebar
            window.dispatchEvent(new CustomEvent('content-saved'));
        } catch (err: any) {
            console.error(err);
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const updateFm = (key: string, value: any) => {
        setFrontmatter(prev => ({ ...prev, [key]: value }));
    };

    // Editor Toolbar Helpers
    const insertText = (before: string, after: string = '') => {
        if (!textareaRef.current) return;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const text = textareaRef.current.value;
        const selection = text.substring(start, end);

        const newText = text.substring(0, start) + before + selection + after + text.substring(end);
        setContent(newText);

        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(start + before.length, end + before.length);
            }
        }, 0);
    };

    const handleImageInsert = (imgPath: string) => {
        if (showImagePicker === 'editor') {
            insertText(`![Image](${imgPath})`);
        } else if (typeof showImagePicker === 'string') {
            updateFm(showImagePicker, imgPath);
        }
        setShowImagePicker(null);
    };

    // Render field based on key and type
    const renderField = (key: string, value: any) => {
        const isArray = Array.isArray(value);

        // Category dropdown
        if (key === 'category') {
            return (
                <select
                    value={value || ''}
                    onChange={(e) => updateFm(key, e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                >
                    <option value="">Select category...</option>
                    {CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                </select>
            );
        }

        // Status dropdown (for projects)
        if (key === 'status' && type === 'projects') {
            return (
                <select
                    value={value || 'active'}
                    onChange={(e) => updateFm(key, e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                >
                    {PROJECT_STATUSES.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                </select>
            );
        }

        // Array fields (tags)
        if (isArray) {
            return (
                <input
                    type="text"
                    value={value.join(', ')}
                    onChange={(e) => updateFm(key, e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="tag1, tag2, tag3"
                />
            );
        }

        // Description/message textarea
        if (key === 'description' || key === 'message') {
            return (
                <textarea
                    value={value || ''}
                    onChange={(e) => updateFm(key, e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none"
                    placeholder={`Enter ${key}...`}
                />
            );
        }

        // Image fields with picker
        if (key.includes('image') || key.includes('cover')) {
            return (
                <div className="relative">
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => updateFm(key, e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 pr-10 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        placeholder="/images/..."
                    />
                    <button
                        onClick={() => setShowImagePicker(showImagePicker === key ? null : key)}
                        className="absolute right-1 top-1.5 p-1 text-gray-400 hover:text-indigo-600"
                        title="Select Image"
                    >
                        <Camera size={16} />
                    </button>
                </div>
            );
        }

        // Default text input
        return (
            <input
                type={key.includes('date') || key.includes('started') || key.includes('updated') ? 'date' : 'text'}
                value={value || ''}
                onChange={(e) => updateFm(key, e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
        );
    };

    if (loading) return <div className="flex items-center justify-center h-full text-gray-500">Loading...</div>;

    const unsaved = hasUnsavedChanges();

    return (
        <div className="flex h-full flex-col overflow-hidden bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(`/${type}`)} className="text-gray-500 hover:text-gray-900 transition-colors p-1 rounded hover:bg-gray-100">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-gray-800 capitalize leading-tight">
                                {isNew ? `New ${type?.slice(0, -1)}` : frontmatter.title || filename}
                            </h1>
                            {unsaved && (
                                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                    <Circle size={8} fill="currentColor" />
                                    Unsaved
                                </span>
                            )}
                        </div>
                        {!isNew && <p className="text-xs text-gray-400 font-mono">{filename}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {lastSaved && (
                        <span className="text-xs text-gray-400">
                            Saved {lastSaved.toLocaleTimeString()}
                        </span>
                    )}
                    <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium text-gray-600">
                        <button
                            onClick={() => setViewMode('write')}
                            className={`px-3 py-1 rounded-md flex items-center gap-2 transition-all ${viewMode === 'write' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-gray-900'}`}
                        >
                            <Edit3 size={14} /> Write
                        </button>
                        <button
                            onClick={() => setViewMode('split')}
                            className={`px-3 py-1 rounded-md hidden md:flex items-center gap-2 transition-all ${viewMode === 'split' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-gray-900'}`}
                        >
                            <span className="rotate-90"><Layers size={14} /></span> Split
                        </button>
                        <button
                            onClick={() => setViewMode('preview')}
                            className={`px-3 py-1 rounded-md flex items-center gap-2 transition-all ${viewMode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-gray-900'}`}
                        >
                            <Eye size={14} /> Preview
                        </button>
                    </div>
                    <div className="h-6 w-px bg-gray-300 mx-2"></div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm font-medium text-sm ${
                            unsaved
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-gray-200 text-gray-600'
                        }`}
                    >
                        <Save size={16} />
                        {saving ? 'Saving...' : 'Save'}
                        <span className="text-xs opacity-70 hidden sm:inline">Ctrl+S</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Toolbar */}
                    {viewMode !== 'preview' && (
                        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 overflow-x-auto text-gray-600">
                            <button onClick={() => insertText('**', '**')} className="p-1.5 rounded hover:bg-gray-100 hover:text-indigo-600" title="Bold (Ctrl+B)">
                                <Bold size={18} />
                            </button>
                            <button onClick={() => insertText('*', '*')} className="p-1.5 rounded hover:bg-gray-100 hover:text-indigo-600" title="Italic (Ctrl+I)">
                                <Italic size={18} />
                            </button>
                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                            <button onClick={() => insertText('[', '](url)')} className="p-1.5 rounded hover:bg-gray-100 hover:text-indigo-600" title="Link">
                                <LinkIcon size={18} />
                            </button>
                            <button onClick={() => setShowImagePicker('editor')} className="p-1.5 rounded hover:bg-gray-100 hover:text-indigo-600" title="Image">
                                <ImageIcon size={18} />
                            </button>
                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                            <button onClick={() => insertText('\n- ')} className="p-1.5 rounded hover:bg-gray-100 hover:text-indigo-600" title="List">
                                <List size={18} />
                            </button>
                        </div>
                    )}

                    <div className="flex-1 flex overflow-hidden">
                        {/* Write Pane */}
                        {(viewMode === 'write' || viewMode === 'split') && (
                            <div className={`flex-1 flex flex-col h-full bg-white ${viewMode === 'split' ? 'border-r border-gray-200' : ''}`}>
                                <textarea
                                    ref={textareaRef}
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="flex-1 w-full p-8 font-mono text-sm leading-relaxed resize-none focus:outline-none"
                                    placeholder="Start writing your content here..."
                                />
                            </div>
                        )}

                        {/* Preview Pane */}
                        {(viewMode === 'preview' || viewMode === 'split') && (
                            <div className="flex-1 h-full overflow-auto bg-gray-50 p-8 prose prose-indigo max-w-none">
                                <h1 className="mb-8">{frontmatter.title || 'Untitled'}</h1>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        img: ({ src, alt }) => {
                                            // Prepend API_URL for local paths
                                            const imgSrc = src?.startsWith('/media/') || src?.startsWith('/images/')
                                                ? `${API_URL}${src}`
                                                : src;
                                            return <img src={imgSrc} alt={alt || ''} className="max-w-full rounded" />;
                                        }
                                    }}
                                >
                                    {content}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar - Frontmatter */}
                <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full z-10 shadow-lg">
                    <div className="overflow-y-auto p-5">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Metadata</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Filename</label>
                                <input
                                    type="text"
                                    value={targetFilename?.replace('.md', '') || ''}
                                    onChange={(e) => setTargetFilename(e.target.value)}
                                    className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                    placeholder="my-post"
                                />
                                <p className="text-xs text-gray-400 mt-1">.md extension added automatically</p>
                            </div>

                            {Object.keys(frontmatter).map(key => (
                                <div key={key}>
                                    <label className="block text-xs font-medium text-gray-500 mb-1 capitalize">{key}</label>
                                    {renderField(key, frontmatter[key])}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Picker Modal */}
            {showImagePicker && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-8 backdrop-blur-sm" onClick={() => setShowImagePicker(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <header className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-4">
                                <h3 className="font-bold text-gray-700">Select Image</h3>
                                <div className="flex bg-gray-200 rounded-lg p-1">
                                    <button
                                        onClick={() => setImageSource('library')}
                                        className={`px-3 py-1 text-sm rounded-md transition-colors ${imageSource === 'library' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                    >
                                        Media Library ({mediaLibraryImages.length})
                                    </button>
                                    <button
                                        onClick={() => setImageSource('site')}
                                        className={`px-3 py-1 text-sm rounded-md transition-colors ${imageSource === 'site' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                    >
                                        Site Images ({availableImages.length})
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => setShowImagePicker(null)} className="text-gray-500 hover:text-gray-800 px-3 py-1 rounded hover:bg-gray-200">Close</button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
                            {imageSource === 'library' ? (
                                mediaLibraryImages.length === 0 ? (
                                    <div className="text-center text-gray-500 py-12">
                                        <p>No images in Media Library</p>
                                        <p className="text-sm mt-2">Add images to ~/Media/ folder</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                        {mediaLibraryImages.map(img => (
                                            <div
                                                key={img.path}
                                                className="group relative aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-indigo-500 transition-all"
                                                onClick={() => handleImageInsert(img.path)}
                                            >
                                                <img src={`${API_URL}${img.path}`} alt={img.name} className="w-full h-full object-cover" onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23ddd" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="12">No preview</text></svg>';
                                                }} />
                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <p className="text-white text-[10px] truncate">{img.name}</p>
                                                    <p className="text-white/70 text-[9px]">{img.category}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : (
                                availableImages.length === 0 ? (
                                    <div className="text-center text-gray-500 py-12">
                                        No images found in site/public/images/
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                        {availableImages.map(img => (
                                            <div
                                                key={img}
                                                className="group relative aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-indigo-500 transition-all"
                                                onClick={() => handleImageInsert(img)}
                                            >
                                                <img src={`${API_URL}${img}`} alt={img} className="w-full h-full object-cover" onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23ddd" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="12">No preview</text></svg>';
                                                }} />
                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <p className="text-white text-[10px] truncate">{img.split('/').pop()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Editor;
