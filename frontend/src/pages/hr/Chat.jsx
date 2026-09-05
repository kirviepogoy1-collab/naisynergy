import React, { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Paperclip, Send, X, Bell, Trash2, ArrowLeft, Image as ImageIcon, MessageSquareOff } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { enablePushNotifications, getPushPermissionState } from '../../utils/push';
import { formatDateTime } from '../../utils/formatDate';
import { fileUrl } from '../../utils/fileUrl';

const MAX_ATTACHMENT_MB = 15;

export default function HrChat() {
    const { user } = useAuth();
    const [threads, setThreads] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [file, setFile] = useState(null);
    const [sending, setSending] = useState(false);
    const [pushState, setPushState] = useState('default');
    const bottomRef = useRef(null);
    const fileInputRef = useRef(null);

    async function loadThreads() {
        const { data } = await api.get('/chat/threads');
        setThreads(data);
    }

    async function loadMessages(employeeId) {
        const { data } = await api.get(`/chat/${employeeId}`);
        setMessages(data);
        loadThreads(); // refresh unread badges now that this thread's been marked read
    }

    useEffect(() => {
        loadThreads();
        getPushPermissionState().then(setPushState);
        const interval = setInterval(loadThreads, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!activeId) return;
        loadMessages(activeId);
        const interval = setInterval(() => loadMessages(activeId), 5000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId]);

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
        if ((!text.trim() && !file) || sending || !activeId) return;
        setSending(true);
        try {
            const form = new FormData();
            if (text.trim()) form.append('message', text.trim());
            if (file) form.append('attachment', file);
            await api.post(`/chat/${activeId}`, form);
            setText('');
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            loadMessages(activeId);
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to send message.', 'error');
        } finally {
            setSending(false);
        }
    }

    async function handleDeleteConversation() {
        if (!activeId) return;
        const result = await Swal.fire({
            title: 'Delete this conversation?',
            text: 'This clears the chat on your side only - the employee will still see it, and it will come back if they message again.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Delete for me',
            confirmButtonColor: '#dc2626'
        });
        if (!result.isConfirmed) return;
        await api.delete(`/chat/${activeId}`);
        setMessages([]);
        loadThreads();
    }

    async function handleEnablePush() {
        const result = await enablePushNotifications();
        setPushState(result === 'granted' ? 'granted' : result);
    }

    const activeThread = threads.find((t) => t.employee_id === activeId);

    return (
        <Layout title="Chat">
            {pushState !== 'granted' && pushState !== 'unsupported' && (
                <div className="bg-brand-50 border rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm mb-4 max-w-4xl">
                    <span className="text-brand-800 inline-flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 shrink-0" /> Get notified when an employee messages</span>
                    <button onClick={handleEnablePush} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap">
                        {pushState === 'denied' ? 'Blocked - check browser settings' : 'Enable'}
                    </button>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow max-w-4xl flex overflow-hidden" style={{ height: '75vh', maxHeight: '820px' }}>
                {/* Thread list: full width on mobile when no chat open, fixed column on desktop */}
                <div className={`w-full md:w-64 border-r overflow-y-auto thin-scrollbar shrink-0 ${activeId ? 'hidden md:block' : 'block'}`}>
                    {threads.map((t) => (
                        <button
                            key={t.employee_id}
                            onClick={() => setActiveId(t.employee_id)}
                            className={`w-full text-left px-4 py-3 border-b hover:bg-brand-50 transition ${activeId === t.employee_id ? 'bg-brand-50' : ''}`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm">{t.employee_name}</span>
                                {t.unread_count > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                        {t.unread_count}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5 flex items-center gap-1">
                                {t.last_message ? (
                                    t.last_message
                                ) : t.last_attachment_type === 'image' ? (
                                    <><ImageIcon className="w-3 h-3 shrink-0" /> Photo</>
                                ) : t.last_attachment_type === 'file' ? (
                                    <><Paperclip className="w-3 h-3 shrink-0" /> File</>
                                ) : (
                                    'No messages yet'
                                )}
                            </p>
                        </button>
                    ))}
                    {threads.length === 0 && <p className="text-center text-gray-400 text-sm p-4">No employees found.</p>}
                </div>

                <div className={`flex-1 flex-col min-w-0 ${activeId ? 'flex' : 'hidden md:flex'}`}>
                    {!activeId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm gap-2 px-6 text-center">
                            <MessageSquareOff className="w-8 h-8 text-gray-300" />
                            Select an employee to view their conversation
                        </div>
                    ) : (
                        <>
                            <div className="border-b px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <button
                                        onClick={() => setActiveId(null)}
                                        aria-label="Back to conversations"
                                        className="md:hidden w-8 h-8 shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                    </button>
                                    <span className="font-semibold text-brand-800 truncate">{activeThread?.employee_name}</span>
                                </div>
                                {messages.length > 0 && (
                                    <button
                                        onClick={handleDeleteConversation}
                                        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 font-medium shrink-0"
                                        title="Delete conversation (for me)"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Delete conversation</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto thin-scrollbar p-3 sm:p-4 space-y-3">
                                {messages.map((m) => {
                                    const isMine = m.sender_id === user.id;
                                    return (
                                        <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMine ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
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
                                    className="flex-1 min-w-0 p-2.5 border rounded-lg text-sm min-h-[42px]"
                                />
                                <button type="submit" disabled={sending || (!text.trim() && !file)} aria-label="Send message" className="w-10 h-10 shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white rounded-full disabled:opacity-50 transition">
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}
