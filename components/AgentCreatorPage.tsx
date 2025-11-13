import React, { useState, useEffect } from 'react';
import { UserProfile, AIAgent } from '../types';
import { supabase } from '../services/supabase';
import { PlusIcon, StarIcon, XIcon } from './icons';

const emptyAgent: Omit<AIAgent, 'id' | 'user_id'> = {
    name: '',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    system_prompt: 'You are an expert SEO content analyst. Your mission is to analyze HTML content and return a detailed JSON response as requested.',
};

export const AgentCreatorPage: React.FC<{ user: UserProfile }> = ({ user }) => {
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Partial<AIAgent> | null>(null);

    useEffect(() => {
        const fetchAgents = async () => {
            const { data, error } = await supabase.from('agents').select('*').eq('user_id', user.id);
            if (error) console.error("Error fetching agents:", error);
            else if (data) setAgents(data);
        };
        fetchAgents();
    }, [user.id]);

    const openModalForNew = () => {
        setEditingAgent(emptyAgent);
        setIsModalOpen(true);
    };
    
    const openModalForEdit = (agent: AIAgent) => {
        setEditingAgent(agent);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!editingAgent || !editingAgent.name || !editingAgent.model || !editingAgent.system_prompt) {
            alert("Please fill in all fields.");
            return;
        }

        const agentData = { ...editingAgent, user_id: user.id };
        
        if (agentData.id) {
            const { data, error } = await supabase.from('agents').update(agentData).eq('id', agentData.id).select().single();
            if (error) console.error("Error updating agent", error);
            else if (data) setAgents(prev => prev.map(a => a.id === data.id ? data : a));
        } else {
            const { data, error } = await supabase.from('agents').insert(agentData).select().single();
            if (error) console.error("Error creating agent", error);
            else if (data) setAgents(prev => [...prev, data]);
        }
        setIsModalOpen(false);
        setEditingAgent(null);
    };

    const handleDelete = async (agentId: number) => {
        if (confirm('Are you sure you want to delete this agent?')) {
            const { error } = await supabase.from('agents').delete().eq('id', agentId);
            if (error) console.error("Error deleting agent:", error);
            else setAgents(prev => prev.filter(a => a.id !== agentId));
        }
    };

    const handleSetDefault = async (agentToSet: AIAgent) => {
        // Unset current default
        const currentDefault = agents.find(a => a.is_default);
        if (currentDefault) {
            await supabase.from('agents').update({ is_default: false }).eq('id', currentDefault.id);
        }
        // Set new default
        const { data, error } = await supabase.from('agents').update({ is_default: true }).eq('id', agentToSet.id!).select().single();
        if (error) console.error("Error setting default agent:", error);
        else if (data) {
             setAgents(prev => prev.map(a => a.id === data.id ? data : {...a, is_default: false}));
        }
    };

    return (
        <div>
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">AI Agents</h1>
                    <p className="mt-2 text-lg text-slate-400">Create and manage custom agents for site analysis.</p>
                </div>
                <button
                    onClick={openModalForNew}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md transition-colors"
                >
                    <PlusIcon className="w-5 h-5"/>
                    Create Agent
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents?.map(agent => (
                    <div key={agent.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start">
                                <h3 className="text-xl font-bold text-slate-100">{agent.name}</h3>
                                {agent.is_default && <div className="text-xs font-bold bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-full flex items-center gap-1"><StarIcon className="w-3 h-3"/> Default</div>}
                            </div>
                            <p className="text-sm font-mono text-cyan-400 mt-1 capitalize">{agent.provider} / {agent.model}</p>
                            <p className="text-sm text-slate-400 mt-3 h-20 overflow-hidden text-ellipsis">{agent.system_prompt}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
                            <div className="flex gap-2">
                                <button onClick={() => openModalForEdit(agent)} className="text-sm font-semibold text-slate-300 hover:text-white">Edit</button>
                                <button onClick={() => handleDelete(agent.id!)} className="text-sm font-semibold text-red-400 hover:text-red-300">Delete</button>
                            </div>
                            {!agent.is_default && (
                                <button onClick={() => handleSetDefault(agent)} className="text-sm font-semibold text-cyan-400 hover:underline">Set as Default</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            {isModalOpen && editingAgent && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl border border-slate-700">
                        <header className="p-4 flex justify-between items-center border-b border-slate-700">
                            <h2 className="text-lg font-bold">{editingAgent.id ? 'Edit Agent' : 'Create New Agent'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><XIcon className="w-6 h-6"/></button>
                        </header>
                        <main className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Agent Name</label>
                                <input type="text" value={editingAgent.name} onChange={e => setEditingAgent({...editingAgent, name: e.target.value})} className="w-full bg-slate-700 p-2 rounded-md border border-slate-600 focus:ring-cyan-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">AI Provider</label>
                                    <select value={editingAgent.provider} onChange={e => setEditingAgent({...editingAgent, provider: e.target.value as 'gemini' | 'openai' | 'openrouter'})} className="w-full bg-slate-700 p-2 rounded-md border border-slate-600 focus:ring-cyan-500">
                                        <option value="gemini">Gemini</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="openrouter">OpenRouter</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Model Name</label>
                                    <input type="text" value={editingAgent.model} onChange={e => setEditingAgent({...editingAgent, model: e.target.value})} className="w-full bg-slate-700 p-2 rounded-md border border-slate-600 focus:ring-cyan-500" />
                                </div>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">System Prompt</label>
                                <textarea value={editingAgent.system_prompt} onChange={e => setEditingAgent({...editingAgent, system_prompt: e.target.value})} rows={5} className="w-full bg-slate-700 p-2 rounded-md border border-slate-600 focus:ring-cyan-500 font-mono text-sm"></textarea>
                            </div>
                        </main>
                        <footer className="p-4 flex justify-end gap-3 border-t border-slate-700">
                            <button onClick={() => setIsModalOpen(false)} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-md">Cancel</button>
                            <button onClick={handleSave} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md">Save Agent</button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};