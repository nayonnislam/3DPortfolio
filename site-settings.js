export const DEFAULT_SITE_SETTINGS = {
  text: {
    brandName: 'WAHEDUZZAMAN NAYON',
    brandRole: '3D Designer',
    navHome: 'Home',
    navProjects: 'Projects',
    navContact: 'Contact',
    headerCta: 'Let’s talk',
    heroGreeting: "Hello, I'm",
    heroFirstName: 'WAHEDUZZAMAN',
    heroLastName: 'NAYON',
    heroRole1: '3D Designer',
    heroRole2: 'Product Visualizer',
    heroRole3: 'Creative Thinker',
    heroIntro: 'I turn ideas into tactile, memorable visuals through thoughtful 3D design, product storytelling, and immersive rendering.',
    heroButton: 'Explore my work',
    heroImageAlt: '3D product design render',
    viewerLoading: 'Preparing 3D preview',
    categories: {
      eyewear: 'EYEWEAR DESIGN',
      product: 'PRODUCT DESIGN',
      character: 'CHARACTER DESIGN',
      '2d': '2D DESIGN'
    },
    addProject: '+ Add Project',
    emptyProjects: 'No projects in this category yet. Add projects from the admin panel to show them here.',
    showMore: 'Show more',
    showLess: 'Show less',
    projectGallery: 'PROJECT GALLERY',
    projectDetails: 'PROJECT DETAILS',
    interactiveModel: 'INTERACTIVE 3D MODEL',
    modelInstructions: '↔ DRAG TO ROTATE · SCROLL TO ZOOM',
    galleryHint: 'Select an image to view it full size.',
    contactTitleFirst: 'Have an idea?',
    contactTitleSecond: 'Let’s shape it.',
    contactText: 'Have a product to visualize or a concept to explore? I’d love to hear what you’re working on.',
    contactButton: 'Start a conversation',
    linkedinLabel: 'LinkedIn',
    instagramLabel: 'Instagram',
    behanceLabel: 'Behance',
    aboutFirst: 'I’m a 3D designer focused on bringing product ideas to life. From clean geometry and considered materials to lighting and final presentation, I enjoy every stage of turning a concept into a compelling visual.',
    aboutSecond: 'My approach combines technical precision with a strong eye for form, detail and atmosphere.'
  },
  contact: {
    email: 'hello@nayon.design',
    phone: '',
    address: '',
    linkedin: '',
    instagram: '',
    behance: ''
  },
  theme: {
    background: '#080a0d',
    panel: '#0d1015',
    text: '#f2f4f8',
    muted: '#9aa2b1',
    accent: '#9bb8ff',
    buttonBackground: '#f2f4f8',
    buttonText: '#0b0d11'
  },
  fonts: {
    body: 'dm-sans',
    heading: 'manrope'
  }
};

const FONT_FAMILIES = {
  'dm-sans': "'DM Sans', sans-serif",
  manrope: "'Manrope', sans-serif",
  arial: 'Arial, sans-serif',
  georgia: 'Georgia, serif',
  trebuchet: "'Trebuchet MS', sans-serif"
};

function safeString(value, fallback, maxLength) {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function safeColor(value, fallback) {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}

function safeExternalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

export function normalizeSiteSettings(value) {
  const saved = value && typeof value === 'object' ? value : {};
  const savedText = saved.text && typeof saved.text === 'object' ? saved.text : {};
  const savedCategories = savedText.categories && typeof savedText.categories === 'object'
    ? savedText.categories
    : {};
  const savedContact = saved.contact && typeof saved.contact === 'object' ? saved.contact : {};
  const savedTheme = saved.theme && typeof saved.theme === 'object' ? saved.theme : {};
  const savedFonts = saved.fonts && typeof saved.fonts === 'object' ? saved.fonts : {};
  const text = {};

  Object.entries(DEFAULT_SITE_SETTINGS.text).forEach(([key, fallback]) => {
    if (key === 'categories') {
      text.categories = {};
      Object.entries(fallback).forEach(([category, defaultLabel]) => {
        text.categories[category] = safeString(savedCategories[category], defaultLabel, 80);
      });
    } else {
      text[key] = safeString(savedText[key], fallback, 1000);
    }
  });

  const email = safeString(savedContact.email, DEFAULT_SITE_SETTINGS.contact.email, 254).trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';

  return {
    text,
    contact: {
      email: validEmail,
      phone: safeString(savedContact.phone, DEFAULT_SITE_SETTINGS.contact.phone, 80).trim(),
      address: safeString(savedContact.address, DEFAULT_SITE_SETTINGS.contact.address, 300).trim(),
      linkedin: safeExternalUrl(savedContact.linkedin),
      instagram: safeExternalUrl(savedContact.instagram),
      behance: safeExternalUrl(savedContact.behance)
    },
    theme: Object.fromEntries(
      Object.entries(DEFAULT_SITE_SETTINGS.theme).map(([key, fallback]) => [
        key,
        safeColor(savedTheme[key], fallback)
      ])
    ),
    fonts: {
      body: Object.hasOwn(FONT_FAMILIES, savedFonts.body) ? savedFonts.body : DEFAULT_SITE_SETTINGS.fonts.body,
      heading: Object.hasOwn(FONT_FAMILIES, savedFonts.heading) ? savedFonts.heading : DEFAULT_SITE_SETTINGS.fonts.heading
    }
  };
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function renderContactDetails(contact, text) {
  const details = document.querySelector('#siteContactDetails');
  if (!details) return;
  const fragment = document.createDocumentFragment();

  if (contact.phone) {
    const dialNumber = contact.phone.replace(/[^\d+]/g, '');
    if (/^\+?\d{6,15}$/.test(dialNumber)) {
      const phone = document.createElement('a');
      phone.href = `tel:${dialNumber}`;
      phone.textContent = contact.phone;
      fragment.appendChild(phone);
    } else {
      const phone = document.createElement('span');
      phone.textContent = contact.phone;
      fragment.appendChild(phone);
    }
  }

  if (contact.address) {
    const address = document.createElement('p');
    address.textContent = contact.address;
    fragment.appendChild(address);
  }

  [
    [text.linkedinLabel, contact.linkedin],
    [text.instagramLabel, contact.instagram],
    [text.behanceLabel, contact.behance]
  ].forEach(([label, href]) => {
    if (!href) return;
    const link = document.createElement('a');
    link.textContent = label;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    fragment.appendChild(link);
  });

  details.replaceChildren(fragment);
  details.hidden = details.childElementCount === 0;
}

export function applySiteSettings(settings) {
  const root = document.documentElement;
  const { text, contact, theme, fonts } = settings;
  Object.entries({
    '--bg': theme.background,
    '--panel': theme.panel,
    '--text': theme.text,
    '--muted': theme.muted,
    '--blue': theme.accent,
    '--button-bg': theme.buttonBackground,
    '--button-text': theme.buttonText,
    '--font': FONT_FAMILIES[fonts.body],
    '--display': FONT_FAMILIES[fonts.heading]
  }).forEach(([name, value]) => root.style.setProperty(name, value));

  setText(document.querySelector('.brand-copy strong'), text.brandName);
  setText(document.querySelector('.brand-copy small'), text.brandRole);
  const navigation = document.querySelectorAll('#mainNav a');
  [text.navHome, text.navProjects, text.navContact].forEach((value, index) => setText(navigation[index], value));

  const headerCta = document.querySelector('.header-cta');
  if (headerCta?.firstChild) headerCta.firstChild.textContent = `${text.headerCta} `;
  setText(document.querySelector('.hello'), text.heroGreeting);
  const heroHeading = document.querySelector('.hero h1');
  if (heroHeading?.firstChild) heroHeading.firstChild.textContent = text.heroFirstName;
  setText(heroHeading?.querySelector('span'), text.heroLastName);
  const roleLine = document.querySelector('.role-line');
  const roleTextNodes = Array.from(roleLine?.childNodes || []).filter(node => node.nodeType === Node.TEXT_NODE);
  [text.heroRole1, text.heroRole2, text.heroRole3].forEach((value, index) => {
    if (roleTextNodes[index]) roleTextNodes[index].textContent = ` ${value} `;
  });
  setText(document.querySelector('.intro'), text.heroIntro);
  const heroButton = document.querySelector('.hero-actions .button');
  if (heroButton?.firstChild) heroButton.firstChild.textContent = `${text.heroButton} `;
  const heroImage = document.querySelector('.hero-fallback');
  if (heroImage) heroImage.alt = text.heroImageAlt;
  setText(document.querySelector('#viewerLoading span:last-child'), text.viewerLoading);

  document.querySelectorAll('.project-category-button').forEach(button => {
    setText(button, text.categories[button.dataset.category] || text.categories.eyewear);
  });
  setText(document.querySelector('#addProjectButton'), text.addProject);
  setText(document.querySelector('#projectCategoryEmpty'), text.emptyProjects);
  setText(document.querySelector('.project-dialog-header .section-kicker'), text.projectGallery);
  setText(document.querySelector('.project-dialog-details > p'), text.projectDetails);
  const modelLabels = document.querySelectorAll('.project-model-heading span');
  setText(modelLabels[0], text.interactiveModel);
  setText(modelLabels[1], text.modelInstructions);
  setText(document.querySelector('.gallery-hint'), text.galleryHint);

  const contactHeading = document.querySelector('.contact-intro h2');
  if (contactHeading?.firstChild) contactHeading.firstChild.textContent = text.contactTitleFirst;
  setText(contactHeading?.querySelector('em'), text.contactTitleSecond);
  setText(document.querySelector('.contact-text'), text.contactText);
  const contactButton = document.querySelector('.contact-intro .button');
  if (contactButton?.firstChild) contactButton.firstChild.textContent = `${text.contactButton} `;
  if (contactButton) {
    contactButton.href = contact.email ? `mailto:${contact.email}` : '#contact';
    contactButton.hidden = !contact.email;
  }
  const aboutParagraphs = document.querySelectorAll('.contact-about p');
  setText(aboutParagraphs[0], text.aboutFirst);
  setText(aboutParagraphs[1], text.aboutSecond);

  const contactDetails = document.querySelector('.contact-intro');
  if (contactDetails && !document.querySelector('#siteContactDetails')) {
    const details = document.createElement('div');
    details.id = 'siteContactDetails';
    details.className = 'site-contact-details';
    details.setAttribute('aria-label', 'Contact details');
    contactButton?.after(details);
  }
  renderContactDetails(contact, text);

  document.title = `${text.brandName} — ${text.brandRole}`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = text.heroIntro;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme.background;
}
