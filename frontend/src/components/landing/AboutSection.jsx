import React from 'react';

export default function AboutSection({ content, anchor }) {
    const { badge, heading, image, paragraphs = [], highlights = [] } = content;

    return (
        <section id={anchor || undefined} className="py-24 bg-slate-50 scroll-mt-20">
            <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
                {image && (
                    <img
                        src={image}
                        alt=""
                        className="rounded-[30px] shadow-2xl w-full h-[280px] sm:h-[380px] lg:h-[500px] object-cover"
                    />
                )}

                <div>
                    {badge && (
                        <span className="inline-block bg-brand-100 text-brand-700 px-4 py-2 rounded-full font-semibold">
                            {badge}
                        </span>
                    )}

                    <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-brand-800 mt-6 leading-tight">
                        {heading}
                    </h2>

                    {paragraphs.map((p, i) => (
                        <p key={i} className="mt-8 text-gray-600 leading-8 first:mt-8">
                            {p}
                        </p>
                    ))}

                    {highlights.length > 0 && (
                        <div className="grid sm:grid-cols-2 gap-6 mt-10">
                            {highlights.map((h, i) => (
                                <div key={i} className="bg-white rounded-2xl shadow-lg p-6">
                                    <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mb-3">
                                        <i className={`${h.icon} text-xl text-brand-700`}></i>
                                    </div>
                                    <h3 className="text-2xl font-bold text-brand-700">{h.title}</h3>
                                    <p className="mt-4 text-gray-600">{h.text}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
