import React from 'react';

export default function HeroSection({ content }) {
    const { headingPrefix, headingHighlight, subheading, ctaText, ctaHref, backgroundImage } = content;

    return (
        <section
            id="home"
            className="relative min-h-screen flex items-center justify-center bg-cover bg-center scroll-mt-20"
            style={{ backgroundImage: `url('${backgroundImage || '/school.jpg'}')` }}
        >
            <div className="absolute inset-0 bg-gradient-to-r from-brand-900/90 via-brand-900/75 to-brand-700/70" />

            <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
                <h1 className="font-display text-4xl sm:text-5xl lg:text-7xl font-semibold text-white leading-tight">
                    {headingPrefix}
                    <span className="block text-yellow-300 mt-2">{headingHighlight}</span>
                </h1>

                {subheading && (
                    <p className="mt-8 text-lg sm:text-xl text-white/90 leading-9 max-w-3xl mx-auto">
                        {subheading}
                    </p>
                )}

                {ctaText && (
                    <div className="mt-12 flex flex-wrap justify-center gap-5">
                        <a
                            href={ctaHref || '#about'}
                            className="px-8 py-4 rounded-full bg-white text-brand-700 font-bold shadow-xl hover:scale-105 transition"
                        >
                            {ctaText}
                        </a>
                    </div>
                )}
            </div>
        </section>
    );
}
