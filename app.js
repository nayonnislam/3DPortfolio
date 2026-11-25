import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
let projectModelRenderer;
let projectModelScene;
let projectModelCamera;
let projectModelControls;
let activeProjectModel;
let requestedProjectModel;

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

document.querySelectorAll('.project-card[data-project]').forEach(card => {
  card.addEventListener('click', event => {
    event.preventDefault();
    projectDialogTitle.textContent = card.dataset.project;
    projectDialogPoints.replaceChildren(...card.dataset.details.split('|').map(detail => {
      const item = document.createElement('li');
      item.textContent = detail;
      return item;
    }));
    projectGallery.replaceChildren();
    projectImagePaths.splice(0, projectImagePaths.length, ...card.dataset.gallery.split(','));

    projectImagePaths.forEach((src, index) => {
      const imageButton = document.createElement('button');
      const image = document.createElement('img');
      const alt = `${card.dataset.project} render ${index + 1}`;

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
    } else {
      requestedProjectModel = null;
      projectModelRenderer?.setAnimationLoop(null);
      projectModelSection.hidden = true;
      projectPreviewImage.src = projectImagePaths[0];
      projectPreviewImage.alt = `${card.dataset.project} preview`;
      projectPreviewImage.hidden = false;
    }
  });
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
