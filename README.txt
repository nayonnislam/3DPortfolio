NAYON WAHE DUZZAMAN — 3D PORTFOLIO WEBSITE

FILES
- index.html: website content and sections
- style.css: responsive visual design and mobile layout
- gallery.css: featured project galleries and full-size image viewer styles
- app.js: mobile menu, scroll navigation, hero 3D viewer, and interactive project GLB viewers
- assets/images/: optimized WebP versions of the images from your ZIP
- assets/models/project1.glb and project2.glb: your original 3D models

HOW TO RUN (recommended)
1. Extract nayon-portfolio.zip.
2. Open the folder in Visual Studio Code.
3. Install the VS Code extension “Live Server” (or use any local static web server).
4. Right-click index.html and choose “Open with Live Server”.
   The 3D model viewer uses ES modules and usually will not work if index.html is opened directly as file://.
5. Internet is needed for Google Fonts and the Three.js CDN import map.

HOW TO PUBLISH
- GitHub Pages: upload the contents of this folder to a repository and enable Pages.
- Netlify: drag the extracted folder into Netlify Drop, or connect your Git repository.

CUSTOMIZE
- Change your name, role, intro and contact email in index.html.
- Replace the placeholder social links with your real profile links.
- Update the two project cards in the project-grid section of index.html. Each card's data-gallery attribute lists the three images shown in its gallery, and data-model selects its interactive GLB preview.
- To use the other supplied model in the hero, change assets/models/project1.glb in app.js to assets/models/project2.glb.
- The CV button is intentionally replaced by “Let’s talk”; add your CV PDF and a download link if you want a CV button.
- Use your real email instead of hello@nayon.design before publishing.

NOTE
The source ZIP's original images are included in optimized WebP format to keep the website download small. Both original GLB models are included.
