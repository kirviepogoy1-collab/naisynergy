const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { landingImageUpload } = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');
const { logActivity } = require('../utils/activityLog');

const router = express.Router();

// Each section's `content` shape depends on its type. This is documentation,
// not enforced by a schema validator - the frontend editor builds the right
// form per type, and this list is just what the seed data / new-section
// defaults below follow:
//   hero:         { headingPrefix, headingHighlight, subheading, ctaText, ctaHref, backgroundImage }
//   about:        { badge, heading, image, paragraphs: [string], highlights: [{icon,title,text}] }
//   cards_grid:   { badge, heading, description, cards: [{icon,title,text}] }
//   systems_grid: { badge, heading, description, systems: [{name,icon,description,url,internal}] }
//   contact:      { badge, heading, description, address, phone, email, officeHours, mapQuery, mapExternalUrl, socialLinks: [{icon,label,href}] }
//   custom_html:  { html }
const ALLOWED_TYPES = ['hero', 'about', 'cards_grid', 'systems_grid', 'contact', 'custom_html'];

const DEFAULT_CONTENT = {
    hero: { headingPrefix: 'Welcome to', headingHighlight: 'Your School Name', subheading: 'A short, welcoming line about your school goes here.', ctaText: 'Learn More', ctaHref: '#about', backgroundImage: '/school.jpg' },
    about: { badge: 'ABOUT OUR SCHOOL', heading: 'Section Heading', image: '/school.jpg', paragraphs: ['Add a paragraph about your school here.'], highlights: [] },
    cards_grid: { badge: 'BADGE TEXT', heading: 'Section Heading', description: '', cards: [] },
    systems_grid: { badge: 'BADGE TEXT', heading: 'Section Heading', description: '', systems: [] },
    contact: { badge: 'CONTACT US', heading: 'Get in Touch', description: '', address: '', phone: '', email: '', officeHours: '', mapQuery: '', mapExternalUrl: '', socialLinks: [] },
    custom_html: { html: '<p>New section</p>' }
};

// Self-migrating table, seeded on first run with the school's existing
// hardcoded landing page content (so nothing changes visually until a
// superadmin actually edits something) - same pattern as system_settings.
let ready = (async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS landing_sections (
            id SERIAL PRIMARY KEY,
            type VARCHAR(30) NOT NULL,
            anchor VARCHAR(60),
            nav_label VARCHAR(50),
            show_in_nav BOOLEAN NOT NULL DEFAULT false,
            is_visible BOOLEAN NOT NULL DEFAULT true,
            position INT NOT NULL,
            content JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);

    const [[{ count }]] = await pool.query('SELECT COUNT(*)::int AS count FROM landing_sections');
    if (count > 0) return;

    const seedRows = [
        {
            type: 'hero', anchor: 'home', nav_label: 'Home', show_in_nav: true, position: 1,
            content: {
                headingPrefix: 'Welcome to', headingHighlight: 'Nissi Academy International',
                subheading: 'Empowering learners through quality education, Christian values, innovation, and technology to prepare them for lifelong success.',
                ctaText: 'Learn More', ctaHref: '#about', backgroundImage: '/school.jpg'
            }
        },
        {
            type: 'about', anchor: 'about', nav_label: 'About', show_in_nav: true, position: 2,
            content: {
                badge: 'ABOUT OUR SCHOOL', heading: 'Building Future Leaders Through Quality Christian Education',
                image: '/school.jpg',
                paragraphs: [
                    'Nissi Academy International is committed to providing quality education that develops students academically, spiritually, emotionally, socially, and morally.',
                    'Through innovative teaching methods, dedicated educators, and modern technology, we prepare our learners to become globally competitive and responsible citizens.'
                ],
                highlights: [
                    { icon: 'fa-solid fa-bullseye', title: 'Mission', text: 'To provide quality Christian education that develops competent, compassionate, and responsible learners.' },
                    { icon: 'fa-solid fa-earth-americas', title: 'Vision', text: 'To become one of the leading educational institutions recognized for excellence, innovation, and integrity.' }
                ]
            }
        },
        {
            type: 'cards_grid', anchor: null, nav_label: null, show_in_nav: false, position: 3,
            content: {
                badge: 'WHY CHOOSE NISSI ACADEMY', heading: 'Inspiring Excellence Every Day',
                description: 'We provide an engaging learning environment where students grow academically, spiritually, socially, and emotionally.',
                cards: [
                    { icon: 'fa-solid fa-graduation-cap', title: 'Quality Education', text: 'Delivering quality instruction through innovative teaching and a learner-centered curriculum.' },
                    { icon: 'fa-solid fa-laptop-code', title: 'Modern Facilities', text: 'Technology-enabled classrooms, laboratories, and learning resources for every student.' },
                    { icon: 'fa-solid fa-chalkboard-user', title: 'Dedicated Teachers', text: 'Passionate educators committed to helping every learner reach their full potential.' },
                    { icon: 'fa-solid fa-hands-praying', title: 'Christian Values', text: 'Developing character, integrity, compassion, and faith in every student.' },
                    { icon: 'fa-solid fa-trophy', title: 'Student Achievement', text: 'Encouraging excellence in academics, leadership, sports, arts, and technology.' },
                    { icon: 'fa-solid fa-handshake', title: 'Caring Community', text: 'A safe and welcoming environment where students, parents, and teachers work together.' }
                ]
            }
        },
        {
            type: 'systems_grid', anchor: 'systems', nav_label: 'Systems', show_in_nav: true, position: 4,
            content: {
                badge: 'DIGITAL SERVICES', heading: 'School Systems',
                description: "Access the school's online platforms for academic, administrative, and student services.",
                systems: [
                    { name: 'NAI Synergy', icon: 'fa-solid fa-users', description: 'HR and Inventory Staff Portal', url: '/login', internal: true },
                    { name: 'NAI Nutrition', icon: 'fa-solid fa-utensils', description: 'Judge & Admin Portal', url: 'https://nai-nutrition.vercel.app/', internal: false },
                    { name: 'NAI SSG', icon: 'fa-solid fa-vote-yea', description: 'Student E-vote Portal', url: 'https://nai-ssgevote.vercel.app/', internal: false },
                    { name: 'NAI Class Record', icon: 'fa-solid fa-chalkboard-user', description: "Teachers' Class Record Portal", url: 'https://nai-classrecord.vercel.app/', internal: false }
                ]
            }
        },
        {
            type: 'contact', anchor: 'contact', nav_label: 'Contact', show_in_nav: true, position: 5,
            content: {
                badge: 'CONTACT US', heading: 'Get in Touch',
                description: "We'd love to hear from you. Feel free to visit our campus or contact us through the information below.",
                address: 'Nissi Academy International\nSuba-Panas, Lapu-Lapu City, 6015 Cebu, Philippines',
                phone: '(+63) 912 345 6789', email: 'info@nai.edu.ph', officeHours: 'Monday - Friday\n8:00 AM - 5:00 PM',
                mapQuery: 'Nissi Academy International, Panas, Lapu-Lapu, 6015 Cebu',
                mapExternalUrl: 'https://maps.app.goo.gl/HBPC68eEVEJQ9Ag1A',
                socialLinks: [
                    { icon: 'fa-brands fa-facebook-f', label: 'Facebook', href: '#' },
                    { icon: 'fa-brands fa-instagram', label: 'Instagram', href: '#' },
                    { icon: 'fa-brands fa-facebook-messenger', label: 'Messenger', href: '#' }
                ]
            }
        }
    ];

    for (const row of seedRows) {
        await pool.query(
            `INSERT INTO landing_sections (type, anchor, nav_label, show_in_nav, is_visible, position, content)
             VALUES (?, ?, ?, ?, true, ?, ?)`,
            [row.type, row.anchor, row.nav_label, row.show_in_nav, row.position, row.content]
        );
    }
})().catch((err) => console.error('Failed to set up landing_sections table:', err.message));

// GET /api/landing-sections - public (no auth): the landing page itself needs this before login.
router.get('/', asyncHandler(async (req, res) => {
    await ready;
    const [rows] = await pool.query(
        'SELECT id, type, anchor, nav_label, show_in_nav, content FROM landing_sections WHERE is_visible = true ORDER BY position ASC'
    );
    res.json(rows);
}));

// GET /api/landing-sections/admin - superadmin only: everything, including hidden sections.
router.get('/admin', requireAuth, requireRole('superadmin'), asyncHandler(async (req, res) => {
    await ready;
    const [rows] = await pool.query('SELECT * FROM landing_sections ORDER BY position ASC');
    res.json(rows);
}));

// POST /api/landing-sections - superadmin only: add a new section, appended to the end.
router.post('/', requireAuth, requireRole('superadmin'), asyncHandler(async (req, res) => {
    await ready;
    const { type } = req.body;
    if (!ALLOWED_TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` });
    }

    const [[{ next_position }]] = await pool.query(
        'SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM landing_sections'
    );

    const [[row]] = await pool.query(
        `INSERT INTO landing_sections (type, anchor, nav_label, show_in_nav, is_visible, position, content)
         VALUES (?, NULL, NULL, false, true, ?, ?)
         RETURNING *`,
        [type, next_position, DEFAULT_CONTENT[type]]
    );

    logActivity(req.user.id, 'landing_section_create', row.id, `Added a new "${type}" landing page section`, 'users');
    res.status(201).json(row);
}));

// PUT /api/landing-sections/:id - superadmin only: update a section's content/nav/visibility.
// Type is intentionally not editable after creation - switching a section's
// type would leave its `content` in the wrong shape; delete and re-add instead.
// PUT /api/landing-sections/reorder - superadmin only: bulk-update positions after a drag/reorder.
// Registered BEFORE the /:id route below - Express matches routes in the
// order they're registered, and "/reorder" would otherwise match "/:id"
// first (with id literally = "reorder"), which fails since section ids are
// numeric. Keep this above /:id if either route is ever touched again.
// body: { order: [id, id, id, ...] } in the new top-to-bottom order.
router.put('/reorder', requireAuth, requireRole('superadmin'), asyncHandler(async (req, res) => {
    await ready;
    const { order } = req.body;
    if (!Array.isArray(order) || order.length === 0) {
        return res.status(400).json({ error: 'order must be a non-empty array of section ids.' });
    }

    for (let i = 0; i < order.length; i++) {
        await pool.query('UPDATE landing_sections SET position = ? WHERE id = ?', [i + 1, order[i]]);
    }

    logActivity(req.user.id, 'landing_section_reorder', null, 'Reordered landing page sections', 'users');
    res.json({ message: 'Order updated.' });
}));

router.put('/:id', requireAuth, requireRole('superadmin'), asyncHandler(async (req, res) => {
    await ready;
    const { anchor, nav_label, show_in_nav, is_visible, content } = req.body;

    const [[current]] = await pool.query('SELECT * FROM landing_sections WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Section not found.' });

    const next = {
        anchor: anchor !== undefined ? anchor : current.anchor,
        nav_label: nav_label !== undefined ? nav_label : current.nav_label,
        show_in_nav: show_in_nav !== undefined ? show_in_nav : current.show_in_nav,
        is_visible: is_visible !== undefined ? is_visible : current.is_visible,
        content: content !== undefined ? content : current.content
    };

    await pool.query(
        `UPDATE landing_sections
         SET anchor = ?, nav_label = ?, show_in_nav = ?, is_visible = ?, content = ?, updated_at = NOW()
         WHERE id = ?`,
        [next.anchor, next.nav_label, next.show_in_nav, next.is_visible, next.content, req.params.id]
    );

    logActivity(req.user.id, 'landing_section_update', req.params.id, `Updated the "${current.type}" landing page section`, 'users');
    res.json({ id: Number(req.params.id), type: current.type, ...next });
}));

// DELETE /api/landing-sections/:id - superadmin only.
router.delete('/:id', requireAuth, requireRole('superadmin'), asyncHandler(async (req, res) => {
    await ready;
    const [[row]] = await pool.query('SELECT type FROM landing_sections WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Section not found.' });

    await pool.query('DELETE FROM landing_sections WHERE id = ?', [req.params.id]);
    logActivity(req.user.id, 'landing_section_delete', req.params.id, `Deleted a "${row.type}" landing page section`, 'users');
    res.json({ message: 'Section deleted.' });
}));

// POST /api/landing-sections/upload-image - superadmin only: for hero/about background images etc.
router.post('/upload-image', requireAuth, requireRole('superadmin'), landingImageUpload.single('image'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    res.json({ url: req.file.path }); // Cloudinary delivery URL (public - not sensitive content)
}));

module.exports = router;
