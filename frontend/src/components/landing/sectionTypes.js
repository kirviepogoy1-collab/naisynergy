import HeroSection from './HeroSection';
import AboutSection from './AboutSection';
import CardsGridSection from './CardsGridSection';
import SystemsGridSection from './SystemsGridSection';
import ContactSection from './ContactSection';
import CustomHtmlSection from './CustomHtmlSection';

// Single source of truth for what a "section type" is - the public Landing
// page and the superadmin editor both import this instead of hardcoding
// their own list, so adding a new section type only means editing this file
// (plus the matching entry in backend/routes/landingSections.js).
export const SECTION_TYPES = {
    hero: {
        label: 'Hero (top banner)',
        Component: HeroSection,
        defaultContent: { headingPrefix: 'Welcome to', headingHighlight: 'Your School Name', subheading: '', ctaText: 'Learn More', ctaHref: '#about', backgroundImage: '/school.jpg' }
    },
    about: {
        label: 'About (image + text + highlight cards)',
        Component: AboutSection,
        defaultContent: { badge: 'ABOUT', heading: 'Section Heading', image: '/school.jpg', paragraphs: [''], highlights: [] }
    },
    cards_grid: {
        label: 'Cards Grid (repeatable icon cards)',
        Component: CardsGridSection,
        defaultContent: { badge: 'BADGE TEXT', heading: 'Section Heading', description: '', cards: [] }
    },
    systems_grid: {
        label: 'Systems Grid (links to other school portals)',
        Component: SystemsGridSection,
        defaultContent: { badge: 'BADGE TEXT', heading: 'Section Heading', description: '', systems: [] }
    },
    contact: {
        label: 'Contact (info card + map)',
        Component: ContactSection,
        defaultContent: { badge: 'CONTACT US', heading: 'Get in Touch', description: '', address: '', phone: '', email: '', officeHours: '', mapQuery: '', mapExternalUrl: '', socialLinks: [] }
    },
    custom_html: {
        label: 'Custom HTML (free-form)',
        Component: CustomHtmlSection,
        defaultContent: { html: '<p>New section</p>' }
    }
};
