import React from 'react';

// Renders raw HTML that superadmin typed into the section builder. This is
// intentionally NOT sanitized: it's the escape hatch for "I want something
// this builder doesn't have a specific section type for" (embeds, custom
// layouts, etc). Only superadmin can write to this field (the backend route
// gates it with requireRole('superadmin')), and a superadmin already has
// full control over the database and every other part of this app - so this
// doesn't introduce a new privilege a superadmin didn't already have. It
// WOULD be a real risk if any lower role could ever write to this field;
// don't relax that access check without re-thinking this component too.
export default function CustomHtmlSection({ content, anchor }) {
    const { html } = content;
    if (!html) return null;

    return (
        <section id={anchor || undefined} className="py-16 scroll-mt-20">
            <div
                className="max-w-7xl mx-auto px-6 prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </section>
    );
}
