import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Post } from '../types';
import { ArrowLeftIcon } from './icons';

interface BlogIndexPageProps {
    onPostSelect: (slug: string) => void;
    onNavigateHome: () => void;
}

const createPreview = (htmlContent: string, length = 150) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const text = tempDiv.textContent || tempDiv.innerText || "";
    return text.length > length ? text.substring(0, length) + '...' : text;
};


export const BlogIndexPage: React.FC<BlogIndexPageProps> = ({ onPostSelect, onNavigateHome }) => {
    const [posts, setPosts] = useState<Post[]>([]);

    useEffect(() => {
        const fetchPosts = async () => {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .eq('status', 'published')
                .order('created_at', { ascending: false });
            
            if (error) console.error("Error fetching posts:", error);
            else if (data) setPosts(data);
        };
        fetchPosts();
    }, []);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200">
             <header className="container mx-auto px-6 py-4 flex justify-between items-center border-b border-slate-800">
                 <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
                    Our Blog
                </h1>
                <button onClick={onNavigateHome} className="flex items-center text-sm font-semibold text-slate-300 hover:text-white">
                    <ArrowLeftIcon className="w-5 h-5 mr-2" /> Back to Home
                </button>
            </header>
            <main className="container mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {posts && posts.length > 0 ? (
                        posts.map(post => (
                            <div key={post.id} className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 hover:border-cyan-500 transition-colors">
                                <h2 className="text-xl font-bold text-slate-100 mb-2">{post.title}</h2>
                                <p className="text-xs text-slate-500 mb-4">
                                    {new Date(post.created_at).toLocaleDateString()}
                                </p>
                                <p className="text-slate-400 text-sm mb-6 line-clamp-3">
                                    {createPreview(post.content)}
                                </p>
                                <button onClick={() => onPostSelect(post.slug)} className="font-semibold text-cyan-400 hover:underline">
                                    Read More &rarr;
                                </button>
                            </div>
                        ))
                    ) : (
                        <p className="text-slate-500 col-span-full text-center">No articles have been published yet. Check back soon!</p>
                    )}
                </div>
            </main>
        </div>
    );
};