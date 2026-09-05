import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { SECTION_TYPES } from "../components/landing/sectionTypes";

export default function Landing() {
    const [menuOpen, setMenuOpen] = useState(false);
    // Seed from whatever was cached last time this loaded successfully, so
    // repeat visitors see the page instantly instead of a spinner while a
    // fresh copy is fetched quietly in the background. Falls back to the
    // loading state (null) on a first-ever visit with nothing cached yet.
    const [sections, setSections] = useState(() => {
        try {
            const cached = localStorage.getItem('nai_landing_cache');
            return cached ? JSON.parse(cached) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        let cancelled = false;
        api.get('/landing-sections')
            .then(({ data }) => {
                if (cancelled) return;
                setSections(data);
                try { localStorage.setItem('nai_landing_cache', JSON.stringify(data)); } catch { /* storage full/unavailable - fine, just skip caching */ }
            })
            .catch(() => {
                // Only fall back to an empty page if there's nothing cached to
                // keep showing - a failed refresh shouldn't blank out a page
                // that was working a moment ago.
                if (!cancelled && sections === null) setSections([]);
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (sections === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-600"></i>
            </div>
        );
    }

    const navLinks = sections
        .filter((s) => s.show_in_nav && s.anchor)
        .map((s) => ({ href: `#${s.anchor}`, label: s.nav_label || s.anchor }));

    // Systems + social links for the footer come from whichever sections
    // happen to carry that data (if the superadmin removed those section
    // types entirely, the footer columns just don't render - see below).
    const systemsSection = sections.find((s) => s.type === 'systems_grid');
    const contactSection = sections.find((s) => s.type === 'contact');

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================= NAVBAR ================= */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img src="/logo.png" alt="School Logo" className="w-12 h-12 object-contain" />
                        <div>
                            <h1 className="font-extrabold text-lg sm:text-xl text-brand-800 leading-tight">
                                Nissi Academy International
                            </h1>
                            <p className="text-xs text-gray-500">Excellence • Integrity • Innovation</p>
                        </div>
                    </div>

                    <nav className="hidden lg:flex gap-8 text-gray-600 font-medium">
                        {navLinks.map((link) => (
                            <a key={link.href} href={link.href} className="hover:text-brand-700 transition">
                                {link.label}
                            </a>
                        ))}
                    </nav>

                    <button
                        onClick={() => setMenuOpen((v) => !v)}
                        className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
                        aria-label="Toggle menu"
                    >
                        <i className={`fa-solid ${menuOpen ? "fa-xmark" : "fa-bars"} text-xl text-brand-800`}></i>
                    </button>
                </div>

                {menuOpen && (
                    <nav className="lg:hidden border-t border-gray-100 bg-white px-6 py-4 flex flex-col gap-4 text-gray-600 font-medium">
                        {navLinks.map((link) => (
                            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="hover:text-brand-700 transition">
                                {link.label}
                            </a>
                        ))}
                    </nav>
                )}
            </header>

            {/* ================= DYNAMIC SECTIONS ================= */}
            {sections.map((section) => {
                const entry = SECTION_TYPES[section.type];
                if (!entry) return null; // unknown/future type - skip rather than crash
                const { Component } = entry;
                return <Component key={section.id} content={section.content} anchor={section.anchor} />;
            })}

            {/* ================= FOOTER ================= */}
            <footer className="bg-brand-900 text-white">
                <div className="max-w-7xl mx-auto px-6 py-16">
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
                        <div>
                            <img src="/logo.png" alt="School Logo" className="w-20 h-20 object-contain mb-5" />
                        </div>

                        {navLinks.length > 0 && (
                            <div>
                                <h3 className="font-bold text-xl mb-6">Quick Links</h3>
                                <ul className="space-y-3">
                                    {navLinks.map((link) => (
                                        <li key={link.href}>
                                            <a href={link.href} className="hover:text-yellow-300 transition">{link.label}</a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {systemsSection && systemsSection.content.systems?.length > 0 && (
                            <div>
                                <h3 className="font-bold text-xl mb-6">School Systems</h3>
                                <ul className="space-y-3">
                                    {systemsSection.content.systems.map((system, i) => (
                                        <li key={i}>
                                            {system.internal ? (
                                                <Link to={system.url} className="hover:text-yellow-300 transition">{system.name}</Link>
                                            ) : (
                                                <a href={system.url} target="_blank" rel="noopener noreferrer" className="hover:text-yellow-300 transition">{system.name}</a>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {contactSection && contactSection.content.socialLinks?.length > 0 && (
                            <div>
                                <h3 className="font-bold text-xl mb-6">Follow Us</h3>
                                <div className="flex gap-3">
                                    {contactSection.content.socialLinks.map((s, i) => (
                                        <a
                                            key={i}
                                            href={s.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={s.label}
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
                                        >
                                            <i className={`${s.icon} text-base`}></i>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-white/10 mt-12 pt-8 text-center">
                        <p className="text-brand-100">
                            © {new Date().getFullYear()} Nissi Academy International. All Rights Reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
