import React, { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Paperclip, Send, X, Bell, Trash2 } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { enablePushNotifications, getPushPermissionState } from '../../utils/push';
import { formatDateTime } from '../../utils/formatDate';
import { fileUrl } from '../../utils/fileUrl';

const MAX_ATTACHMENT_MB = 15;

export default function EmployeeChat() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [file, setFile] = useState(null);
    const [sending, setSending] = useState(false);
    const [pushState, setPushState] = useState('default');
    const bottomRef = useRef(null);
    const fileInputRef = useRef(null);

    async function load() {
        const { data } = await api.get('/chat/mine');
        setMessages(data);
    }

    useEffect(() => {
        load();
        getPushPermissionState().then(setPushState);
        const interval = setInterval(load, 8000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    function handleFilePick(e) {
        const picked = e.target.files[0];
        if (!picked) return;
        if (picked.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
            Swal.fire('Too large', `Please choose a file under ${MAX_ATTACHMENT_MB}MB.`, 'warning');
            e.target.value = '';
            return;
        }
        setFile(picked);
    }

    async function handleSend(e) {
        e.preventDefault();
        if ((!text.trim() && !file) || sending) return;
        setSending(true);
        try {
            const form = new FormData();
            if (text.trim()) form.append('message', text.trim());
            if (file) form.append('attachment', file);
            await api.post('/chat/mine', form);
            setText('');
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to send message.', 'error');
        } finally {
            setSending(false);
        }
    }

    async function handleDeleteConversation() {
        const result = await Swal.fire({
            title: 'Delete this conversation?',
            text: 'This clears the chat on your side only - HR will still see it, and it will come back if HR replies.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Delete for me',
            confirmButtonColor: '#dc2626'
        });
        if (!result.isConfirmed) return;
        await api.delete('/chat/mine');
        setMessages([]);
    }

    async function handleEnablePush() {
        const result = await enablePushNotifications();
        setPushState(result === 'granted' ? 'granted' : result);
    }

    return (
        <Layout title="Chat with HR">
            <div className="bg-white rounded-2xl shadow max-w-2xl flex flex-col" style={{ height: '75vh', maxHeight: '820px' }}>
                <div className="border-b px-4 py-2 flex items-center justify-between">
                    <span className="font-semibold text-brand-800 text-sm">HR</span>
                    {messages.length > 0 && (
                        <button
                            onClick={handleDeleteConversation}
                            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 font-medium"
                            title="Delete conversation (for me)"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Delete conversation
                        </button>
                    )}
                </div>

                {pushState !== 'granted' && pushState !== 'unsupported' && (
                    <div className="bg-brand-50 border-b px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-brand-800 inline-flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 shrink-0" /> Get notified when HR replies</span>
                        <button onClick={handleEnablePush} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap">
                            {pushState === 'denied' ? 'Blocked - check browser settings' : 'Enable'}
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 && (
                        <p className="text-center text-gray-400 text-sm mt-8">No messages yet - say hello to HR!</p>
                    )}
                    {messages.map((m) => {
                        const isMine = m.sender_id === user.id;
                        return (
                            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMine ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                                    {!isMine && <p className="text-xs font-semibold text-brand-700 mb-0.5">{m.sender_name}</p>}
                                    {m.attachment_url && m.attachment_type === 'image' && (
                                        <a href={fileUrl(m.attachment_url)} target="_blank" rel="noreferrer">
                                            <img
                                                src={fileUrl(m.attachment_url)}
                                                alt={m.attachment_name || 'attachment'}
                                                className="rounded-lg max-h-48 mb-1"
                                            />
                                        </a>
                                    )}
                                    {m.attachment_url && m.attachment_type === 'file' && (
                                        <a
                                            href={fileUrl(m.attachment_url)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 mb-1 text-xs underline ${isMine ? 'bg-brand-700' : 'bg-white'}`}
                                        >
                                            <Paperclip className="w-3.5 h-3.5 shrink-0" /> {m.attachment_name || 'Download file'}
                                        </a>
                                    )}
                                    {m.message && <p className="whitespace-pre-wrap break-words">{m.message}</p>}
                                    <p className={`text-[10px] mt-1 ${isMine ? 'text-brand-100' : 'text-gray-400'}`}>
                                        {formatDateTime(m.created_at)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                {file && (
                    <div className="px-3 pt-2 flex items-center gap-2 text-xs text-gray-600">
                        <span className="truncate max-w-[200px] inline-flex items-center gap-1"><Paperclip className="w-3.5 h-3.5 shrink-0" /> {file.name}</span>
                        <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} aria-label="Remove attachment" className="text-red-500 hover:text-red-700">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                <form onSubmit={handleSend} className="border-t p-3 flex gap-2 items-center">
                    <label className="cursor-pointer w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition shrink-0" title="Attach a file or photo">
                        <Paperclip className="w-5 h-5" />
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                            onChange={handleFilePick}
                        />
                    </label>
                    <input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 p-2.5 border rounded-lg text-sm min-h-[42px]"
                    />
                    <button type="submit" disabled={sending || (!text.trim() && !file)} aria-label="Send message" className="w-10 h-10 shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white rounded-full disabled:opacity-50 transition">
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </Layout>
    );
}
