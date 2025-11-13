import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { UserProfile } from '../types';

export const UserManagementPage: React.FC = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    
    useEffect(() => {
        const fetchUsers = async () => {
            // Note: This requires RLS policies that allow admins to read all user profiles.
            // In a production environment, you would create a specific RLS policy for admins.
            const { data, error } = await supabase.from('users').select('*');
            if (error) console.error("Error fetching users:", error);
            else if (data) setUsers(data);
        };
        fetchUsers();
    }, []);

    const handleDeleteUser = async (userId: string) => {
        if (confirm('Are you sure you want to delete this user? This action is irreversible and will delete all their associated data.')) {
            
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.id === userId) {
                 alert("You cannot delete your own account.");
                 return;
            }

            // In a real app, you would call a Supabase Edge Function to securely delete the user
            // and all their data, as this requires admin privileges.
            // Client-side deletion is not secure or recommended.
            // Example: await supabase.functions.invoke('delete-user', { body: { userId } })
            
            alert(`(DEMO) This would securely delete user ${userId} via a Supabase Edge Function.`);
            
            // For the UI demo, we just remove them from the list
            setUsers(prev => prev.filter(u => u.id !== userId));
        }
    };

    return (
        <div>
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-100">User Management</h1>
                <p className="mt-2 text-lg text-slate-400">View and manage all user accounts.</p>
            </header>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-full divide-y divide-slate-700">
                        <thead className="bg-slate-900/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Plan</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Role</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {users?.map(user => (
                                <tr key={user.id} className="hover:bg-slate-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">{user.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 capitalize">{user.plan}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">
                                        <span className={`px-2 py-1 font-semibold rounded-full ${user.role === 'admin' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-600 text-slate-300'}`}>{user.role}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={() => handleDeleteUser(user.id!)} className="text-red-400 hover:text-red-300">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};