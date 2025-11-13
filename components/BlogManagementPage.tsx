import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { UserProfile, Post, AIAgent, Settings } from '../types';
import { 
    PlusIcon, XIcon, SpinnerIcon, CpuChipIcon, ExternalLinkIcon
} from './icons';
import { generateBlogPost } from '../services/aiService';
import { decrypt } from '../services/crypto';
import ReactQuill from 'react-quill';

const emptyPost: Omit<Post, 'id' | 'author_id' | 'created_at' | 'updated_at' > = {
    title: '',
    slug: '',
    content: '',
    status: 'draft',
};

const slugify = (text: string) =>
  text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');

const calculateReadingTime = (content: string) => {
    const textOnly = content.replace(/<[^>]+>/g, ' ');
    const words = textOnly.trim().split(/\s+/).filter(Boolean).length;
    const wpm = 200; // Average reading speed
    const time = Math.ceil(words / wpm);
    return { words, time };
};

const editorModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'], 
      ['blockquote', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link', 'image'],
      ['clean']
    ],
};

export const BlogManagementPage: React.FC<{ user: UserProfile }> = ({ user }) => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);
    
    const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
    const [generationTopic, setGenerationTopic] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState('');

    const [defaultAgent, setDefaultAgent] = useState<AIAgent | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    
    useEffect(() => {
        const fetchPosts = async () => {
            const { data } = await supabase.from('posts').select('*').eq('author_id', user.id).order('created_at', { ascending: false });
            if (data) setPosts(data);
        };

        const fetchInitialData = async () => {
            const { data: agentData } = await supabase.from('agents').select('*').eq('user_id', user.id).eq('is_default', true).single();
            setDefaultAgent(agentData);

            const { data: settingsData } = await supabase.from('settings').select('*').single();
            setSettings(settingsData);
        };
        
        fetchPosts();
        fetchInitialData();
    }, [user.id]);

    const openModalForNew = () => {
        setEditingPost(emptyPost);
        setIsModalOpen(true);
    };
    
    const openModalForEdit = (post: Post) => {
        setEditingPost(post);
        setIsModalOpen(true);
    };

    const openGeneratorModal = () => {
        setGenerationTopic('');
        setGenerationError('');
        setIsGeneratorModalOpen(true);
    };
    
    const handleSave = async () => {
        if (!editingPost || !editingPost.title || !editingPost.content) return;
        
        const postData = {
            author_id: user.id,
            title: editingPost.title,
            slug: editingPost.slug || slugify(editingPost.title),
            content: editingPost.content,
            status: editingPost.status || 'draft',
            updated_at: new Date().toISOString(),
        };

        if (editingPost.id) {
            const { data, error } = await supabase.from('posts').update(postData).eq('id', editingPost.id).select().single();
            if (error) console.error("Error updating post", error);
            else if (data) setPosts(p => p.map(post => post.id === data.id ? data : post));
        } else {
            const { data, error } = await supabase.from('posts').insert(postData).select().single();
            if (error) console.error("Error creating post", error);
            else if (data) setPosts(p => [data, ...p]);
        }
        setIsModalOpen(false);
        setEditingPost(null);
    };

    const handleDelete = async (postId: number) => {
        if (confirm('Are you sure you want to delete this post?')) {
            const { error } = await supabase.from('posts').delete().eq('id', postId);
            if (error) console.error("Error deleting post:", error);
            else setPosts(p => p.filter(post => post.id !== postId));
        }
    };
    
    const handleGeneratePost = async () => {
        if (!generationTopic) {
            setGenerationError('Please enter a topic.');
            return;
        }

        if (!defaultAgent) {
            setGenerationError('No default AI agent found. Please set a default agent in the AI Agents page.');
            return;
        }

        let apiKey = '';
        const userApiKey = user.api_keys?.[defaultAgent.provider];
        if (userApiKey) apiKey = decrypt(userApiKey);
        if (!apiKey) {
            const defaultApiKey = settings?.default_api_keys?.[defaultAgent.provider];
            if (defaultApiKey) apiKey = decrypt(defaultApiKey);
        }

        if (!apiKey) {
            setGenerationError(`No API key found for the default agent's provider (${defaultAgent.provider}). Please add one in Settings.`);
            return;
        }

        setIsGenerating(true);
        setGenerationError('');

        try {
            const { title, content } = await generateBlogPost(generationTopic, defaultAgent, apiKey);

            setIsGeneratorModalOpen(false);
            setEditingPost({
                ...emptyPost,
                title,
                content,
                slug: slugify(title)
            });
            setIsModalOpen(true);

        } catch (error) {
            setGenerationError(error instanceof Error ? error.message : 'An unknown error occurred.');
        } finally {
            setIsGenerating(false);
        }
    };
    
    const { words, time } = calculateReadingTime(editingPost?.content || '');
    
    return (
        <div>
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Blog Management</h1>
                    <p className="mt-2 text-lg text-slate-400">Create and manage your articles.</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={openGeneratorModal}
                        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors"
                    >
                        <CpuChipIcon className="w-5 h-5"/> Generate with AI
                    </button>
                    <button
                        onClick={openModalForNew}
                        className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md transition-colors"
                    >
                        <PlusIcon className="w-5 h-5"/> New Post
                    </button>
                </div>
            </header>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Last Updated</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {posts ? posts.map(post => (
                            <tr key={post.id}>
                                <td className="px-6 py-4 text-sm font-medium text-slate-200">{post.title}</td>
                                <td className="px-6 py-4 text-sm capitalize">
                                   <span className={`px-2 py-1 font-semibold rounded-full text-xs ${post.status === 'published' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                       {post.status}
                                   </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-400">{new Date(post.updated_at).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-sm space-x-4">
                                    <button onClick={() => openModalForEdit(post)} className="font-semibold text-cyan-400 hover:underline">Edit</button>
                                    {post.status === 'published' && (
                                        <a href={`/#/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-400 hover:underline inline-flex items-center gap-1">
                                            View <ExternalLinkIcon className="w-4 h-4" />
                                        </a>
                                    )}
                                    <button onClick={() => handleDelete(post.id!)} className="font-semibold text-red-400 hover:underline">Delete</button>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={4} className="text-center p-8"><SpinnerIcon className="w-6 h-6 animate-spin mx-auto text-cyan-400"/></td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isGeneratorModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-lg border border-slate-700">
                        <header className="p-4 flex justify-between items-center border-b border-slate-700">
                            <h2 className="text-lg font-bold">Generate Blog Post with AI</h2>
                            <button onClick={() => setIsGeneratorModalOpen(false)} className="text-slate-400 hover:text-white"><XIcon className="w-6 h-6"/></button>
                        </header>
                        <main className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Enter a topic or a title for your blog post:</label>
                                <input 
                                    type="text" 
                                    value={generationTopic} 
                                    onChange={e => setGenerationTopic(e.target.value)} 
                                    placeholder="e.g., 'The importance of sitemaps for SEO'"
                                    className="w-full bg-slate-700 p-2 rounded-md border border-slate-600 focus:ring-cyan-500" 
                                />
                            </div>
                            {generationError && <p className="text-red-400 text-sm">{generationError}</p>}
                        </main>
                        <footer className="p-4 flex justify-end gap-3 border-t border-slate-700">
                            <button onClick={() => setIsGeneratorModalOpen(false)} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-md">Cancel</button>
                            <button 
                                onClick={handleGeneratePost}
                                disabled={isGenerating}
                                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center w-36 disabled:bg-slate-500"
                            >
                                {isGenerating ? <SpinnerIcon className="w-5 h-5 animate-spin"/> : 'Generate Post'}
                            </button>
                        </footer>
                    </div>
                </div>
            )}

            {isModalOpen && editingPost && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl border border-slate-700 flex flex-col max-h-[90vh]">
                        <header className="p-4 flex justify-between items-center border-b border-slate-700">
                            <h2 className="text-lg font-bold">{editingPost.id ? 'Edit Post' : 'Create New Post'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><XIcon className="w-6 h-6"/></button>
                        </header>
                        <main className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
                                <input type="text" value={editingPost.title} onChange={e => setEditingPost({...editingPost, title: e.target.value, slug: slugify(e.target.value)})} className="w-full bg-slate-700 p-2 rounded-md border border-slate-600 focus:ring-cyan-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Slug</label>
                                <input type="text" value={editingPost.slug} onChange={e => setEditingPost({...editingPost, slug: e.target.value})} className="w-full bg-slate-700 p-2 rounded-md border border-slate-600 focus:ring-cyan-500 font-mono text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Content</label>
                                <ReactQuill
                                    theme="snow"
                                    value={editingPost.content}
                                    onChange={(content) => setEditingPost(prev => ({...prev, content}))}
                                    modules={editorModules}
                                    placeholder="Start writing your amazing article..."
                                />
                                <div className="text-right text-xs text-slate-400 mt-2">
                                    {words} words | {time} min read
                                </div>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                                <select value={editingPost.status} onChange={e => setEditingPost({...editingPost, status: e.target.value as 'draft' | 'published'})} className="w-full bg-slate-700 p-2 rounded-md border border-slate-600 focus:ring-cyan-500">
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                </select>
                            </div>
                        </main>
                        <footer className="p-4 flex justify-end gap-3 border-t border-slate-700 flex-shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-md">Cancel</button>
                            <button onClick={handleSave} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md">Save Post</button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};