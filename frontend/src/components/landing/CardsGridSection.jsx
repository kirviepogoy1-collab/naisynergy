import React from 'react';

export default function CardsGridSection({ content, anchor }) {
    const { badge, heading, description, cards = [] } = content;

    return (
        <section id={anchor || undefined} className="py-24 bg-white scroll-mt-20">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    {badge && (
                        <span className="inline-block bg-brand-100 text-brand-700 px-4 py-2 rounded-full font-semibold">
                            {badge}
                        </span>
                    )}
                    <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-brand-800 mt-6">
                        {heading}
                    </h2>
                    {description && (
                        <p className="mt-5 text-gray-600 max-w-3xl mx-auto leading-8">{description}</p>
                    )}
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {cards.map((item, i) => (
                        <div
                            key={i}
                            className="bg-slate-50 rounded-3xl shadow-lg p-8 hover:-translate-y-2 hover:shadow-2xl transition"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-white shadow flex items-center justify-center">
                                <i className={`${item.icon} text-2xl text-brand-700`}></i>
                            </div>
                            <h3 className="text-2xl font-bold text-brand-800 mt-6">{item.title}</h3>
                            <p className="mt-4 text-gray-600 leading-7">{item.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
