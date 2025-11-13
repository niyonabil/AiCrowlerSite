import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Post } from '../types';
import { SpinnerIcon, ArrowLeftIcon, TwitterIcon, LinkedInIcon, FacebookIcon } from './icons';
import { GoogleTranslateWidget } from './GoogleTranslateWidget';

interface BlogPostPageProps {
    slug: string;
    onNavigateToBlog: () => void;
}

export const BlogPostPage: React.FC<BlogPostPageProps> = ({ slug, onNavigateToBlog }) => {
    const [post, setPost] = useState<Post | null>(null);

    useEffect(() => {
        const fetchPost = async () => {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .eq('slug', slug)
                .single();
            
            if (error) console.error("Error fetching post:", error);
            else if (data) setPost(data);
        };
        if (slug) {
            fetchPost();
        }
    }, [slug]);

    if (!post) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <SpinnerIcon className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
        );
    }
    
    const shareUrl = window.location.href;
    const shareTitle = post.title;
    
    return (
        <div className="min-h-screen bg-slate-900 text-slate-200">
             <header className="container mx-auto px-6 py-4 flex justify-between items-center border-b border-slate-800">
                <button onClick={onNavigateToBlog} className="flex items-center text-sm font-semibold text-slate-300 hover:text-white">
                    <ArrowLeftIcon className="w-5 h-5 mr-2" /> All Articles
                </button>
                <GoogleTranslateWidget />
            </header>
            <main className="container mx-auto px-6 py-12">
                <article className="max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-100 mb-4">{post.title}</h1>
                    <p className="text-slate-500 mb-8">{new Date(post.created_at).toLocaleDateString()}</p>
                    <div 
                        className="prose prose-invert prose-lg text-slate-300"
                        dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                    <div className="mt-12 pt-6 border-t border-slate-700 flex items-center gap-4">
                        <span className="text-sm font-semibold text-slate-400">Share this post:</span>
                        <div className="flex gap-3">
                            <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#1DA1F2] transition-colors" aria-label="Share on Twitter">
                                <TwitterIcon className="w-6 h-6" />
                            </a>
                            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#0A66C2] transition-colors" aria-label="Share on LinkedIn">
                                <LinkedInIcon className="w-6 h-6" />
                            </a>
                            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#1877F2] transition-colors" aria-label="Share on Facebook">
                                <FacebookIcon className="w-6 h-6" />
                            </a>
                        </div>
                    </div>
                </article>
            </main>
        </div>
    );
};