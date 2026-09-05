import React from 'react';
import { Link } from 'react-router-dom';

function SystemCard({ system }) {
    const card = (
        <div className="bg-white rounded-3xl shadow-lg hover:shadow-2xl hover:-translate-y-3 transition p-10 text-center h-full">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-brand-50 flex items-center justify-center">
                <i className={`${system.icon} text-3xl text-brand-700`}></i>
            </div>
            <h3 className="text-2xl font-bold text-brand-800">{system.name}</h3>
            <p className="mt-4 text-gray-600 leading-7">{system.description}</p>
            <div className="mt-8 text-brand-700 font-bold inline-flex items-center gap-2">
                Open System <i className="fa-solid fa-arrow-right text-sm"></i>
            </div>
        </div>
    );

    return system.internal ? (
        <Link to={system.url} className="block h-full">{card}</Link>
    ) : (
        <a href={system.url} target="_blank" rel="noopener noreferrer" className="block h-full">{card}</a>
    );
}

export default function SystemsGridSection({ content, anchor }) {
    const { badge, heading, description, systems = [] } = content;

    return (
        <section id={anchor || undefined} className="py-24 bg-brand-50 scroll-mt-20">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    {badge && (
                        <span className="inline-block bg-white text-brand-700 px-4 py-2 rounded-full font-semibold shadow">
                            {badge}
                        </span>
                    )}
                    <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-brand-800 mt-6">
                        {heading}
                    </h2>
                    {description && (
                        <p className="mt-5 text-gray-600 max-w-3xl mx-auto">{description}</p>
                    )}
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {systems.map((system, i) => (
                        <SystemCard key={i} system={system} />
                    ))}
                </div>
            </div>
        </section>
    );
}
