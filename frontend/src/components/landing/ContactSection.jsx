import React from 'react';

function MapEmbed({ mapQuery, mapExternalUrl }) {
    if (!mapQuery) return null;
    const embedSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=17&output=embed`;

    return (
        <div className="relative">
            <iframe title="Campus location" src={embedSrc} className="w-full h-[360px] sm:h-[420px] lg:h-[560px]" loading="lazy" />
            {/* Overlay to prevent users from panning/zooming inside the embedded iframe */}
            <div className="absolute inset-0" style={{ pointerEvents: 'all', background: 'transparent' }} />
            {mapExternalUrl && (
                <div className="absolute top-4 right-4">
                    <a
                        href={mapExternalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-white/90 text-sm rounded-md shadow hover:bg-white"
                    >
                        Open in Google Maps
                    </a>
                </div>
            )}
        </div>
    );
}

const INFO_ROWS = [
    { key: 'address', icon: 'fa-solid fa-location-dot', label: 'Address' },
    { key: 'phone', icon: 'fa-solid fa-phone', label: 'Phone' },
    { key: 'email', icon: 'fa-solid fa-envelope', label: 'Email' },
    { key: 'officeHours', icon: 'fa-solid fa-clock', label: 'Office Hours' }
];

export default function ContactSection({ content, anchor }) {
    const { badge, heading, description, mapQuery, mapExternalUrl } = content;

    return (
        <section id={anchor || undefined} className="py-24 bg-gradient-to-b from-brand-50 to-white scroll-mt-20">
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
                        <p className="text-gray-600 mt-5 max-w-2xl mx-auto">{description}</p>
                    )}
                </div>

                <div className="grid lg:grid-cols-2 gap-12">
                    <div className="bg-white rounded-3xl shadow-lg p-8">
                        <h3 className="text-2xl font-bold text-brand-800 mb-6">Contact Information</h3>
                        <div className="space-y-5">
                            {INFO_ROWS.filter((row) => content[row.key]).map((row) => (
                                <div key={row.key} className="flex gap-4">
                                    <div className="w-12 h-12 shrink-0 rounded-xl bg-brand-50 flex items-center justify-center">
                                        <i className={`${row.icon} text-xl text-brand-700`}></i>
                                    </div>
                                    <div>
                                        <h4 className="font-bold">{row.label}</h4>
                                        <p className="text-gray-600 whitespace-pre-line">{content[row.key]}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {mapQuery && (
                        <div className="rounded-3xl overflow-hidden shadow-2xl h-full min-h-[300px] relative">
                            <MapEmbed mapQuery={mapQuery} mapExternalUrl={mapExternalUrl} />
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
