import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  changeEmail,
  changePassword,
  deleteProject,
  getAdminEmail,
  getProjects,
  getSiteSettings,
  isAdminSignedIn,
  isSupabaseConfigured,
  requestPasswordReset,
  restoreAdminSession,
  saveProject,
  saveSiteSettings,
  signIn,
  signOut,
  confirmPasswordReset,
  uploadFile,
  validateAdminPassword
} from './supabase-services.js';
import {
  applySiteSettings,
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettings
} from './site-settings.js';

const viewer = document.querySelector('#modelViewer');
const loading = document.querySelector('#viewerLoading');
const fallback = document.querySelector('.hero-fallback');
const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

const toggle = document.querySelector('#menuToggle');
const nav = document.querySelector('#mainNav');
toggle?.addEventListener('click', () => nav.classList.toggle('open'));
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => nav.classList.remove('open')));

const projectDialog = document.querySelector('#projectDialog');
const projectDialogTitle = document.querySelector('#projectDialogTitle');
const projectDialogDescription = document.querySelector('#projectDialogDescription');
const projectDialogPoints = document.querySelector('#projectDialogPoints');
const projectGallery = document.querySelector('#projectGallery');
const projectModelSection = document.querySelector('#projectModelSection');
const projectPreviewImage = document.querySelector('#projectPreviewImage');
const imageDialog = document.querySelector('#imageDialog');
const fullProjectImage = document.querySelector('#fullProjectImage');
const projectImageCount = document.querySelector('#projectImageCount');
const projectImagePaths = [];
let activeProjectImage = 0;
const projectModelViewer = document.querySelector('#projectModelViewer');
const projectModelStatus = document.querySelector('#projectModelStatus');
const projectModels = new Map();
const projectEditorDialog = document.querySelector('#projectEditorDialog');
const projectEditorForm = document.querySelector('#projectEditorForm');
const projectEditorError = document.querySelector('#projectEditorError');
const projectGrid = document.querySelector('#projectGrid');
const projectCategoryButtons = document.querySelectorAll('.project-category-button');
const projectCategoryTitle = document.querySelector('#projectCategoryTitle');
const projectCategoryEmpty = document.querySelector('#projectCategoryEmpty');
const projectShowMoreButton = document.querySelector('#showMoreProjects');
const projectManagerStatus = document.querySelector('#projectManagerStatus');
const websiteSettingsPanel = document.querySelector('#websiteSettings');
const websiteSettingsForm = document.querySelector('#websiteSettingsForm');
const websiteSettingsMessage = document.querySelector('#websiteSettingsMessage');
const websiteSettingsError = document.querySelector('#websiteSettingsError');
let activeProjectCategory = 'eyewear';
let siteSettings = normalizeSiteSettings(DEFAULT_SITE_SETTINGS);
const expandedProjectCategories = new Set();
let customProjects = [];
let editingProjectId = null;
let editingNewProject = false;
let savedProjects = [];
let projectModelRenderer;
let projectModelScene;
let projectModelCamera;
let projectModelControls;
let activeProjectModel;
let requestedProjectModel;

function getNestedSetting(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function setNestedSetting(object, path, value) {
  const keys = path.split('.');
  const finalKey = keys.pop();
  const parent = keys.reduce((current, key) => current[key], object);
  parent[finalKey] = value;
}

function fillWebsiteSettingsForm() {
  websiteSettingsForm.querySelectorAll('[data-setting-path]').forEach(field => {
    field.value = getNestedSetting(siteSettings, field.dataset.settingPath) ?? '';
  });
}

function readWebsiteSettingsForm() {
  const settings = JSON.parse(JSON.stringify(siteSettings));
  websiteSettingsForm.querySelectorAll('[data-setting-path]').forEach(field => {
    setNestedSetting(settings, field.dataset.settingPath, field.value.trim());
  });
  return normalizeSiteSettings(settings);
}

function showProjectImage(index) {
  activeProjectImage = (index + projectImagePaths.length) % projectImagePaths.length;
  const path = projectImagePaths[activeProjectImage];
  fullProjectImage.src = path;
  fullProjectImage.alt = `${projectDialogTitle.textContent} render ${activeProjectImage + 1}`;
  projectImageCount.textContent = `${activeProjectImage + 1} / ${projectImagePaths.length}`;
}

function resizeProjectModelViewer() {
  if (!projectModelRenderer || !projectModelCamera) return;
  const { clientWidth, clientHeight } = projectModelViewer;
  if (!clientWidth || !clientHeight) return;
  projectModelCamera.aspect = clientWidth / clientHeight;
  projectModelCamera.updateProjectionMatrix();
  projectModelRenderer.setSize(clientWidth, clientHeight);
  if (activeProjectModel) fitProjectModel(activeProjectModel);
}

function fitProjectModel(model) {
  const bounds = new THREE.Box3().setFromObject(model);
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const verticalFov = THREE.MathUtils.degToRad(projectModelCamera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * projectModelCamera.aspect);
  const limitingHalfFov = Math.min(verticalFov, horizontalFov) / 2;
  const distance = sphere.radius / Math.sin(limitingHalfFov) * 1.15;

  projectModelCamera.position.set(0, 0.1, distance);
  projectModelControls.target.set(0, 0, 0);
  projectModelControls.minDistance = distance * 0.55;
  projectModelControls.maxDistance = distance * 2.5;
  projectModelControls.update();
}

function initializeProjectModelViewer() {
  if (projectModelRenderer) return;

  const width = projectModelViewer.clientWidth;
  const height = projectModelViewer.clientHeight;
  projectModelScene = new THREE.Scene();
  projectModelCamera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
  projectModelCamera.position.set(0, 0.1, 5.3);
  projectModelRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  projectModelRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  projectModelRenderer.setSize(width, height);
  projectModelRenderer.outputColorSpace = THREE.SRGBColorSpace;
  projectModelRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  projectModelRenderer.toneMappingExposure = 1.1;
  projectModelViewer.appendChild(projectModelRenderer.domElement);
  projectModelScene.add(new THREE.HemisphereLight(0xdce8ff, 0x1a202c, 2));

  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(4, 5, 5);
  projectModelScene.add(key);
  const rim = new THREE.DirectionalLight(0x6c9dff, 3.5);
  rim.position.set(-4, 1, -4);
  projectModelScene.add(rim);
  const fill = new THREE.PointLight(0xffffff, 16, 20);
  fill.position.set(0, -2, 4);
  projectModelScene.add(fill);

  projectModelControls = new OrbitControls(projectModelCamera, projectModelRenderer.domElement);
  projectModelControls.enableDamping = true;
  projectModelControls.dampingFactor = 0.055;
  projectModelControls.enablePan = false;
  projectModelControls.minDistance = 2.6;
  projectModelControls.maxDistance = 8;
  projectModelControls.autoRotate = true;
  projectModelControls.autoRotateSpeed = 0.45;

  if ('ResizeObserver' in window) {
    new ResizeObserver(resizeProjectModelViewer).observe(projectModelViewer);
  } else {
    window.addEventListener('resize', resizeProjectModelViewer);
  }
  resizeProjectModelViewer();
}

function showProjectModel(model, path) {
  if (requestedProjectModel !== path || !projectDialog.open) return;
  if (activeProjectModel) projectModelScene.remove(activeProjectModel);
  activeProjectModel = model;
  projectModelScene.add(activeProjectModel);
  projectModelControls.reset();
  projectModelStatus.classList.add('hidden');
  resizeProjectModelViewer();
}

function loadProjectModel(path) {
  requestedProjectModel = path;
  projectModelStatus.textContent = 'Loading 3D model…';
  projectModelStatus.classList.remove('hidden');

  try {
    initializeProjectModelViewer();
    resizeProjectModelViewer();
    projectModelRenderer.setAnimationLoop(() => {
      projectModelControls.update();
      projectModelRenderer.render(projectModelScene, projectModelCamera);
    });
  } catch (error) {
    console.error('3D project viewer could not be initialized.', error);
    projectModelStatus.textContent = '3D preview is unavailable in this browser.';
    return;
  }

  if (projectModels.has(path)) {
    showProjectModel(projectModels.get(path), path);
    return;
  }

  new GLTFLoader().load(path, gltf => {
    const model = new THREE.Group();
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    gltf.scene.position.sub(center);
    model.add(gltf.scene);
    model.scale.setScalar(3.1 / (Math.max(size.x, size.y, size.z) || 1));
    projectModels.set(path, model);
    showProjectModel(model, path);
  }, undefined, error => {
    console.error(`3D project model could not be loaded: ${path}`, error);
    if (requestedProjectModel === path) {
      projectModelStatus.textContent = 'Could not load this 3D model. Please try again.';
    }
  });
}

function applyProjectCategory(category = activeProjectCategory) {
  const selectedButton = Array.from(projectCategoryButtons).find(button => button.dataset.category === category);
  if (!selectedButton) return;
  activeProjectCategory = category;
  projectCategoryButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button === selectedButton));
  });
  projectCategoryTitle.textContent = selectedButton.textContent.trim();

  const cards = Array.from(projectGrid.querySelectorAll('.project-card'));
  const matchingCards = cards.filter(card =>
    card.dataset.deleted !== 'true' && (card.dataset.category || 'eyewear') === category
  );
  const columnCount = Math.max(1, getComputedStyle(projectGrid).gridTemplateColumns.split(' ').filter(Boolean).length);
  const rowLimit = columnCount * 2;
  const expanded = expandedProjectCategories.has(category);
  const shownCards = new Set(expanded ? matchingCards : matchingCards.slice(0, rowLimit));

  cards.forEach(card => {
    card.hidden = !shownCards.has(card);
  });
  projectCategoryEmpty.hidden = matchingCards.length > 0;
  projectShowMoreButton.hidden = matchingCards.length <= rowLimit;
  projectShowMoreButton.setAttribute('aria-expanded', String(expanded));
  projectShowMoreButton.textContent = expanded ? siteSettings.text.showLess : siteSettings.text.showMore;
}

function renderCustomProjects() {
  projectGrid.querySelectorAll('.custom-project-card').forEach(card => card.remove());

  customProjects.forEach((project, index) => {
    const card = document.createElement('article');
    const link = document.createElement('a');
    const imageBox = document.createElement('div');
    const image = document.createElement('img');
    const number = document.createElement('span');
    const arrow = document.createElement('span');
    const meta = document.createElement('div');
    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    const metaArrow = document.createElement('span');
    const actions = document.createElement('div');
    const editButton = document.createElement('button');
    const removeButton = document.createElement('button');

    card.className = 'project-card custom-project-card';
    card.dataset.projectId = project.id;
    card.dataset.category = project.category || 'eyewear';
    card.dataset.project = project.title;
    card.dataset.description = project.description || '';
    card.dataset.details = project.details.join('|');
    card.dataset.gallery = project.gallery.join(',');
    if (project.model) card.dataset.model = project.model;
    link.className = 'custom-project-link';
    link.href = '#projects';
    imageBox.className = 'project-image';
    if (project.cover) {
      image.src = project.cover;
      image.alt = `${project.title} project cover`;
      image.loading = 'lazy';
    } else {
      imageBox.classList.add('project-image-empty');
      imageBox.setAttribute('aria-label', 'No cover image added yet');
    }
    number.className = 'project-number';
    number.textContent = String(projectGrid.querySelectorAll('.project-card:not(.custom-project-card):not([hidden])').length + index + 1).padStart(2, '0');
    arrow.className = 'project-arrow';
    arrow.textContent = '↗';
    meta.className = 'project-meta';
    title.textContent = project.title;
    metaArrow.className = 'meta-arrow';
    metaArrow.textContent = '↗';
    actions.className = 'custom-project-actions';
    editButton.className = 'custom-project-edit';
    editButton.type = 'button';
    editButton.dataset.projectId = project.id;
    editButton.setAttribute('aria-label', `Edit ${project.title}`);
    editButton.textContent = 'Edit';
    removeButton.className = 'custom-project-remove';
    removeButton.type = 'button';
    removeButton.dataset.projectId = project.id;
    removeButton.setAttribute('aria-label', `Delete ${project.title}`);
    removeButton.textContent = '×';
    if (project.cover) imageBox.appendChild(image);
    imageBox.append(number, arrow);
    titleWrap.appendChild(title);
    meta.append(titleWrap, metaArrow);
    link.append(imageBox, meta);
    actions.append(editButton, removeButton);
    card.append(link, actions);
    projectGrid.appendChild(card);
  });
  applyProjectCategory();
  window.__nayonAppInitialized = true;
  updateAdminControls();
}

function addAdminActions(card) {
  card.classList.add('admin-managed-project');
  let actions = card.querySelector('.custom-project-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'custom-project-actions';
    const editButton = document.createElement('button');
    editButton.className = 'custom-project-edit';
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    const removeButton = document.createElement('button');
    removeButton.className = 'custom-project-remove';
    removeButton.type = 'button';
    removeButton.textContent = '×';
    actions.append(editButton, removeButton);
    card.appendChild(actions);
  }
  const [editButton, removeButton] = actions.querySelectorAll('button');
  editButton.dataset.projectId = card.dataset.projectId;
  editButton.setAttribute('aria-label', `Edit ${card.dataset.project}`);
  removeButton.dataset.projectId = card.dataset.projectId;
  removeButton.setAttribute('aria-label', `Delete ${card.dataset.project}`);
  actions.hidden = !isAdminSignedIn();
}

function updateAdminControls() {
  const signedIn = isAdminSignedIn();
  document.querySelector('#adminLoginButton').hidden = signedIn;
  websiteSettingsPanel.hidden = !signedIn;
  document.querySelector('#adminAccountSettings').hidden = !signedIn;
  document.querySelector('#currentAdminEmail').textContent = getAdminEmail() || 'No email address is set';
  document.querySelector('#addProjectButton').hidden = !signedIn;
  projectGrid.querySelectorAll('.project-card').forEach(addAdminActions);
}

async function loadWebsiteSettings() {
  try {
    const savedSettings = await getSiteSettings();
    if (!savedSettings) return;
    siteSettings = normalizeSiteSettings(savedSettings);
    applySiteSettings(siteSettings);
    applyProjectCategory();
    if (isAdminSignedIn()) fillWebsiteSettingsForm();
  } catch (error) {
    console.error('Shared website settings could not be loaded.', error);
    websiteSettingsError.textContent = 'Could not load saved website settings. Run the updated supabase/setup.sql script in Supabase.';
  }
}

function cardToProject(card) {
  if (!card) return null;
  return {
    id: card.dataset.projectId || '',
    title: card.dataset.project || '',
    category: card.dataset.category || 'eyewear',
    description: card.dataset.description || '',
    cover: card.querySelector('.project-image img')?.getAttribute('src') || '',
    gallery: (card.dataset.gallery || '').split(',').map(path => path.trim()).filter(Boolean),
    details: (card.dataset.details || '').split('|').map(detail => detail.trim()).filter(Boolean),
    model: card.dataset.model || ''
  };
}

function applySavedProjects() {
  const savedById = new Map(savedProjects.map(project => [project.id, project]));
  projectGrid.querySelectorAll('.project-card[data-project-id^="static-"]').forEach(card => {
    const saved = savedById.get(card.dataset.projectId);
    card.dataset.deleted = String(Boolean(saved?.deleted));
    card.hidden = Boolean(saved?.deleted);
    if (!saved || saved.deleted) return;
    card.dataset.project = saved.title;
    card.dataset.category = saved.category || 'eyewear';
    card.dataset.description = saved.description || '';
    card.dataset.details = (saved.details || []).join('|');
    card.dataset.gallery = (saved.gallery || []).join(',');
    if (saved.model) card.dataset.model = saved.model;
    else delete card.dataset.model;
    const imageBox = card.querySelector('.project-image');
    let image = imageBox.querySelector('img');
    if (saved.cover) {
      if (!image) {
        image = document.createElement('img');
        image.loading = 'lazy';
        imageBox.prepend(image);
      }
      image.src = saved.cover;
      image.alt = `${saved.title} project cover`;
      imageBox.classList.remove('project-image-empty');
      imageBox.removeAttribute('aria-label');
    } else {
      image?.remove();
      imageBox.classList.add('project-image-empty');
      imageBox.setAttribute('aria-label', 'No cover image added yet');
    }
    const heading = card.querySelector('.project-meta h3');
    if (heading) heading.textContent = saved.title;
  });
  customProjects = savedProjects.filter(project => !project.id.startsWith('static-') && !project.deleted);
  renderCustomProjects();
}

async function refreshProjects() {
  try {
    savedProjects = await getProjects();
    applySavedProjects();
  } catch (error) {
    console.error('Public project data could not be loaded.', error);
    projectManagerStatus.textContent = 'Could not load online project updates. Showing the built-in projects.';
  }
}

function openProjectCard(card) {
  const title = card.dataset.project;
  const details = (card.dataset.details || '').split('|').map(value => value.trim()).filter(Boolean);
  projectDialogTitle.textContent = title;
  projectDialogDescription.textContent = card.dataset.description || '';
  projectDialogDescription.hidden = !card.dataset.description;
  projectDialogPoints.replaceChildren(...details.map(detail => {
    const item = document.createElement('li');
    item.textContent = detail;
    return item;
  }));
  projectGallery.replaceChildren();
  projectImagePaths.splice(0, projectImagePaths.length, ...(card.dataset.gallery || '').split(',').map(path => path.trim()).filter(Boolean));

  projectImagePaths.forEach((src, index) => {
    const imageButton = document.createElement('button');
    const image = document.createElement('img');
    const alt = `${title} render ${index + 1}`;

    imageButton.type = 'button';
    imageButton.className = 'gallery-image';
    imageButton.setAttribute('aria-label', `View ${alt} full size`);
    image.src = src;
    image.alt = alt;
    image.loading = 'eager';
    imageButton.appendChild(image);
    imageButton.addEventListener('click', () => {
      showProjectImage(index);
      imageDialog.showModal();
    });
    projectGallery.appendChild(imageButton);
  });

  projectDialog.showModal();
  if (card.dataset.model) {
    projectModelSection.hidden = false;
    projectPreviewImage.hidden = true;
    loadProjectModel(card.dataset.model);
  } else if (!projectImagePaths.length) {
    requestedProjectModel = null;
    projectModelRenderer?.setAnimationLoop(null);
    projectModelSection.hidden = true;
    projectPreviewImage.hidden = true;
  } else {
    requestedProjectModel = null;
    projectModelRenderer?.setAnimationLoop(null);
    projectModelSection.hidden = true;
    projectPreviewImage.src = projectImagePaths[0];
    projectPreviewImage.alt = `${title} preview`;
    projectPreviewImage.hidden = false;
  }
}

projectCategoryButtons.forEach(button => {
  button.addEventListener('click', () => applyProjectCategory(button.dataset.category));
});
projectShowMoreButton.addEventListener('click', () => {
  if (expandedProjectCategories.has(activeProjectCategory)) {
    expandedProjectCategories.delete(activeProjectCategory);
  } else {
    expandedProjectCategories.add(activeProjectCategory);
  }
  applyProjectCategory();
});
let projectGridResizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(projectGridResizeFrame);
  projectGridResizeFrame = requestAnimationFrame(() => applyProjectCategory());
});
applySiteSettings(siteSettings);
applyProjectCategory();
updateAdminControls();
if (isSupabaseConfigured()) {
  refreshProjects();
  loadWebsiteSettings();
  restoreAdminSession().then(restored => {
    updateAdminControls();
    if (restored) {
      fillWebsiteSettingsForm();
      refreshProjects();
    }
  });
}
else {
  document.querySelector('#adminLoginButton').title = 'Supabase setup is required before admin login.';
}

document.querySelector('#addProjectButton').addEventListener('click', () => {
  if (!isAdminSignedIn()) return;
  const project = {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'New Project',
    category: activeProjectCategory,
    description: '',
    cover: '',
    gallery: [],
    details: [],
    model: ''
  };
  editingNewProject = true;
  customProjects.push(project);
  renderCustomProjects();
  openProjectEditor(project);
});

websiteSettingsForm.addEventListener('submit', async event => {
  event.preventDefault();
  websiteSettingsError.textContent = '';
  websiteSettingsMessage.textContent = '';
  const saveButton = websiteSettingsForm.querySelector('[type="submit"]');
  saveButton.disabled = true;
  try {
    const requestedSettings = readWebsiteSettingsForm();
    const savedSettings = await saveSiteSettings(requestedSettings);
    siteSettings = normalizeSiteSettings(savedSettings);
    applySiteSettings(siteSettings);
    applyProjectCategory();
    fillWebsiteSettingsForm();
    websiteSettingsMessage.textContent = 'Website settings saved and published for all visitors.';
  } catch (error) {
    console.error('Website settings could not be saved.', error);
    websiteSettingsError.textContent = error.message || 'Could not save website settings.';
  } finally {
    saveButton.disabled = false;
  }
});

function openProjectEditor(project) {
  editingProjectId = project.id;
  editingNewProject = project.id.startsWith('draft-');
  projectEditorError.textContent = '';
  projectEditorForm.reset();
  projectEditorForm.elements.title.value = project.title;
  projectEditorForm.elements.category.value = project.category || 'eyewear';
  projectEditorForm.elements.description.value = project.description || '';
  projectEditorForm.elements.cover.value = project.cover;
  projectEditorForm.elements.gallery.value = project.gallery.join('\n');
  projectEditorForm.elements.details.value = project.details.join('\n');
  projectEditorForm.elements.model.value = project.model || '';
  projectEditorForm.elements.coverFile.value = '';
  projectEditorForm.elements.galleryFiles.value = '';
  projectEditorForm.elements.modelFile.value = '';
  projectEditorDialog.querySelector('#projectEditorTitle').textContent = 'Edit project';
  projectEditorDialog.showModal();
}

function closeProjectEditor() {
  projectEditorDialog.close();
}

document.querySelector('#closeProjectEditor').addEventListener('click', closeProjectEditor);
projectEditorDialog.addEventListener('click', event => {
  if (event.target === projectEditorDialog) closeProjectEditor();
});
projectEditorDialog.addEventListener('close', () => {
  if (editingNewProject) {
    customProjects = customProjects.filter(project => project.id !== editingProjectId);
    renderCustomProjects();
  }
  editingProjectId = null;
  editingNewProject = false;
});

projectEditorForm.addEventListener('submit', async event => {
  event.preventDefault();
  projectEditorError.textContent = '';
  const submitButton = projectEditorForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  const formData = new FormData(projectEditorForm);
  const projectIndex = customProjects.findIndex(project => project.id === editingProjectId);
  try {
    const existing = projectIndex >= 0
      ? customProjects[projectIndex]
      : cardToProject(projectGrid.querySelector(`.project-card[data-project-id="${CSS.escape(editingProjectId)}"]`));
    if (!existing) throw new Error('This project could not be found. Close this form and try again.');

    let cover = String(formData.get('cover') || '').trim();
    let gallery = String(formData.get('gallery') || '').split(/[\n,]+/).map(path => path.trim()).filter(Boolean);
    let model = String(formData.get('model') || '').trim();
    const coverFile = formData.get('coverFile');
    const galleryFiles = formData.getAll('galleryFiles').filter(file => file instanceof File && file.size);
    const modelFile = formData.get('modelFile');
    const selectedFiles = [coverFile, ...galleryFiles, modelFile].filter(file => file instanceof File && file.size);
    if (selectedFiles.some(file => file.size > 25 * 1024 * 1024)) {
      throw new Error('Each uploaded file must be 25 MB or smaller.');
    }
    if (coverFile instanceof File && coverFile.size) cover = await uploadFile(coverFile);
    if (galleryFiles.length) gallery = [...gallery, ...await Promise.all(galleryFiles.map(uploadFile))];
    if (modelFile instanceof File && modelFile.size) model = await uploadFile(modelFile);

    const project = {
      ...existing,
      id: editingNewProject ? '' : editingProjectId,
      title: String(formData.get('title') || '').trim() || 'New Project',
      category: String(formData.get('category') || 'eyewear'),
      description: String(formData.get('description') || '').trim(),
      cover,
      gallery: gallery.length ? gallery : (cover ? [cover] : []),
      details: String(formData.get('details') || '').split('\n').map(detail => detail.trim()).filter(Boolean),
      model
    };
    const saved = await saveProject(project);
    if (editingNewProject) {
      customProjects[projectIndex] = saved;
      editingProjectId = saved.id;
      editingNewProject = false;
    } else if (projectIndex >= 0) {
      customProjects[projectIndex] = saved;
    }
    savedProjects = [...savedProjects.filter(item => item.id !== saved.id), saved];
    applySavedProjects();
    projectManagerStatus.textContent = `“${saved.title}” saved and published.`;
    projectEditorDialog.close();
    editingProjectId = null;
  } catch (error) {
    console.error('The project could not be saved.', error);
    projectEditorError.textContent = error.message || 'Could not save this project. Try again.';
  } finally {
    submitButton.disabled = false;
  }
});

document.addEventListener('click', event => {
  const editButton = event.target.closest('.custom-project-edit');
  if (editButton) {
    const project = customProjects.find(item => item.id === editButton.dataset.projectId)
      || cardToProject(editButton.closest('.project-card'));
    if (project && isAdminSignedIn()) openProjectEditor(project);
    return;
  }

  const removeButton = event.target.closest('.custom-project-remove');
  if (removeButton) {
    const project = customProjects.find(item => item.id === removeButton.dataset.projectId)
      || cardToProject(removeButton.closest('.project-card'));
    if (!project || !isAdminSignedIn() || !window.confirm(`Remove "${project.title}" from the public site?`)) return;
    deleteProject(project.id).then(() => {
      savedProjects = project.id.startsWith('static-')
        ? [...savedProjects.filter(item => item.id !== project.id), { id: project.id, deleted: true }]
        : savedProjects.filter(item => item.id !== project.id);
      applySavedProjects();
      projectManagerStatus.textContent = `“${project.title}” removed from the public site.`;
    }).catch(error => {
      console.error('The project could not be removed.', error);
      projectManagerStatus.textContent = error.message || 'Could not remove this project.';
    });
    return;
  }

  const card = event.target.closest('.custom-project-link, .project-card[data-project]:not(.custom-project-card)');
  if (!card) return;
  event.preventDefault();
  openProjectCard(card.closest('.project-card') || card);
});

const adminDialog = document.querySelector('#adminDialog');
const adminLoginForm = document.querySelector('#adminLoginForm');
const forgotPasswordForm = document.querySelector('#forgotPasswordForm');
const changeEmailForm = document.querySelector('#changeEmailForm');
const changePasswordForm = document.querySelector('#changePasswordForm');
const adminDialogTitle = document.querySelector('#adminDialogTitle');
const adminDialogDescription = document.querySelector('#adminDialogDescription');
let resetUsername = '';

function showAdminForm(form, title, description) {
  [adminLoginForm, forgotPasswordForm].forEach(item => {
    item.hidden = item !== form;
  });
  adminDialogTitle.textContent = title;
  adminDialogDescription.textContent = description;
}

document.querySelector('#adminLoginButton').addEventListener('click', () => {
  showAdminForm(adminLoginForm, 'Admin Login', 'Sign in with your registered email or phone number and password.');
  adminDialog.showModal();
});
document.querySelector('#adminLogoutButton').addEventListener('click', async () => {
  await signOut();
  updateAdminControls();
  projectManagerStatus.textContent = 'You have logged out of the admin panel.';
});
document.querySelector('#closeAdminDialog').addEventListener('click', () => adminDialog.close());
adminDialog.addEventListener('click', event => {
  if (event.target === adminDialog) adminDialog.close();
});
document.querySelector('#showForgotPassword').addEventListener('click', () => {
  forgotPasswordForm.reset();
  document.querySelector('#forgotPasswordError').textContent = '';
  document.querySelector('#resetDeliveryMessage').textContent = '';
  showAdminForm(forgotPasswordForm, 'Reset Password', 'A code will be sent to a verified recovery method on your account.');
});
document.querySelector('#backToLogin').addEventListener('click', () => {
  showAdminForm(adminLoginForm, 'Admin Login', 'Sign in with your registered email or phone number and password.');
});
document.querySelector('#sendResetCode').addEventListener('click', async () => {
  const username = forgotPasswordForm.elements.username.value.trim();
  const message = document.querySelector('#resetDeliveryMessage');
  const errorOutput = document.querySelector('#forgotPasswordError');
  errorOutput.textContent = '';
  try {
    const channel = await requestPasswordReset(username);
    resetUsername = username;
    message.textContent = `If the account is registered, a verification code has been sent to the ${channel === 'email' ? 'email address' : 'phone number'} you entered.`;
  } catch (error) {
    errorOutput.textContent = error.message || 'Could not send the verification code.';
  }
});
adminLoginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const errorOutput = document.querySelector('#adminLoginError');
  errorOutput.textContent = '';
  try {
    await signIn(adminLoginForm.elements.username.value, adminLoginForm.elements.password.value);
    await refreshProjects();
    updateAdminControls();
    fillWebsiteSettingsForm();
    adminDialog.close();
    projectManagerStatus.textContent = 'Admin login successful. Your edits will be published for everyone.';
  } catch (error) {
    console.error('Administrator sign-in failed.', error);
    errorOutput.textContent = error.message || 'Could not sign in.';
  }
});
forgotPasswordForm.addEventListener('submit', async event => {
  event.preventDefault();
  const errorOutput = document.querySelector('#forgotPasswordError');
  errorOutput.textContent = '';
  try {
    const newPassword = forgotPasswordForm.elements.newPassword.value;
    const confirmPassword = forgotPasswordForm.elements.confirmPassword.value;
    validateAdminPassword(newPassword);
    if (newPassword !== confirmPassword) {
      throw new Error('New password and confirmation do not match.');
    }
    await confirmPasswordReset(
      resetUsername || forgotPasswordForm.elements.username.value.trim(),
      forgotPasswordForm.elements.code.value,
      newPassword
    );
    showAdminForm(adminLoginForm, 'Password Updated', 'Your password has been changed. Sign in with your new password.');
  } catch (error) {
    errorOutput.textContent = error.message || 'Could not reset the password.';
  }
});
changeEmailForm.addEventListener('submit', async event => {
  event.preventDefault();
  const errorOutput = document.querySelector('#changeEmailError');
  const message = document.querySelector('#changeEmailMessage');
  errorOutput.textContent = '';
  message.textContent = '';
  const submitButton = changeEmailForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    await changeEmail(
      changeEmailForm.elements.currentPassword.value,
      changeEmailForm.elements.newEmail.value
    );
    changeEmailForm.reset();
    document.querySelector('#currentAdminEmail').textContent = getAdminEmail() || 'No email address is set';
    message.textContent = 'Email update requested. Check your inbox and confirm the change before signing in with the new address.';
  } catch (error) {
    console.error('The administrator email could not be updated.', error);
    errorOutput.textContent = error.message || 'Could not change the email address.';
  } finally {
    submitButton.disabled = false;
  }
});
changePasswordForm.addEventListener('submit', async event => {
  event.preventDefault();
  const errorOutput = document.querySelector('#changePasswordError');
  const message = document.querySelector('#changePasswordMessage');
  errorOutput.textContent = '';
  message.textContent = '';
  const submitButton = changePasswordForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    const newPassword = changePasswordForm.elements.newPassword.value;
    const confirmPassword = changePasswordForm.elements.confirmPassword.value;
    validateAdminPassword(newPassword);
    if (newPassword !== confirmPassword) {
      throw new Error('New password and confirmation do not match.');
    }
    await changePassword(
      changePasswordForm.elements.currentPassword.value,
      newPassword
    );
    changePasswordForm.reset();
    message.textContent = 'Password changed successfully.';
  } catch (error) {
    console.error('The administrator password could not be changed.', error);
    errorOutput.textContent = error.message || 'Could not change the password.';
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#projectDialog .dialog-close').addEventListener('click', () => projectDialog.close());
document.querySelector('#imageDialog .dialog-close').addEventListener('click', () => imageDialog.close());
document.querySelector('#previousProjectImage').addEventListener('click', () => showProjectImage(activeProjectImage - 1));
document.querySelector('#nextProjectImage').addEventListener('click', () => showProjectImage(activeProjectImage + 1));
imageDialog.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    imageDialog.close();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    showProjectImage(activeProjectImage - 1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    showProjectImage(activeProjectImage + 1);
  }
});
projectDialog.addEventListener('close', () => projectModelRenderer?.setAnimationLoop(null));
projectDialog.addEventListener('click', event => {
  if (event.target === projectDialog) projectDialog.close();
});
imageDialog.addEventListener('click', event => {
  if (event.target === imageDialog) imageDialog.close();
});

let renderer, scene, camera, controls, animationId;
try {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, viewer.clientWidth / viewer.clientHeight, 0.1, 1000);
  camera.position.set(0, 0.1, 5.3);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(viewer.clientWidth, viewer.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  viewer.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xdce8ff, 0x1a202c, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(4, 5, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6c9dff, 3.5); rim.position.set(-4, 1, -4); scene.add(rim);
  const fill = new THREE.PointLight(0xffffff, 16, 20); fill.position.set(0, -2, 4); scene.add(fill);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .055; controls.enablePan = false;
  controls.minDistance = 2.6; controls.maxDistance = 8; controls.autoRotate = true; controls.autoRotateSpeed = .55;
  new GLTFLoader().load('assets/models/project1.glb', gltf => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(3.1 / maxDim);
    scene.add(model);
    fallback.style.opacity = '0';
    loading.classList.add('hidden');
    setTimeout(() => { fallback.style.display = 'none'; loading.style.display = 'none'; }, 500);
  }, undefined, error => {
    console.warn('3D model could not be loaded; showing image fallback.', error);
    loading.innerHTML = '<span>Preview image · 3D model unavailable</span>';
    loading.classList.add('hidden');
  });
  const resize = () => {
    const w = viewer.clientWidth, h = viewer.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
  };
  window.addEventListener('resize', resize);
  const animate = () => { animationId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
  animate();
} catch (error) {
  console.warn('3D viewer setup failed; keeping fallback image.', error);
  loading.classList.add('hidden');
}

// Smooth active navigation indicator based on the section currently in view.
const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...document.querySelectorAll('#mainNav a')];
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
      }
    });
  }, { rootMargin: '-35% 0px -55% 0px' });
  sections.forEach(section => observer.observe(section));
}
