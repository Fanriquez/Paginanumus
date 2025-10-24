/* script.js
  - Splash: muestra 1s el logo y luego revela la página
  - Enlaces clickables
  - Carrusel: flechas y arrastre táctil
  - Form para añadir productos al carrusel (client-side, no sube al servidor)
  - Generación simple de PDF con jsPDF (cliente)
*/

/* --- Espera a que cargue todo --- */
window.addEventListener("load", () => {
  // esperar 1 segundo (1000ms) para mantener splash visible
  setTimeout(hideSplash, 1000);
});

function hideSplash(){
  const splash = document.getElementById("splash");
  const main = document.getElementById("main-content");
  if (!splash || !main) return;
  // transición simple: ocultamos el splash y mostramos contenido
  splash.style.transition = "opacity 300ms ease, visibility 300ms";
  splash.style.opacity = 0;
  splash.style.visibility = "hidden";
  main.classList.remove("hidden");
  // marcar aria-hidden
  splash.setAttribute("aria-hidden", "true");
}

/* --- Manejo de enlaces en los bloques "link-item" --- */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".link-item").forEach(item => {
    item.addEventListener("click", () => {
      const url = item.getAttribute("data-url");
      if (url) window.open(url, "_blank");
    });
    // accesibilidad: permitir Enter
    item.addEventListener("keydown", (e) => { if (e.key === "Enter") item.click(); });
  });
});

/* --- Carrusel: flechas y arrastre táctil --- */
const track = () => document.querySelector(".carousel-track");
let posX = 0;
let isDragging = false;
let startX, currentTranslate = 0, prevTranslate = 0, animationID = 0;

function initCarousel(){
  const carouselTrack = track();
  if (!carouselTrack) return;

  const prevBtn = document.querySelector(".prev");
  const nextBtn = document.querySelector(".next");

  // flechas
  if (nextBtn) nextBtn.addEventListener("click", () => moveSlide(-1));
  if (prevBtn) prevBtn.addEventListener("click", () => moveSlide(1));

  // arrastre táctil / mouse
  carouselTrack.addEventListener("pointerdown", startDrag);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointermove", drag);
}
initCarousel();

/* Mover 1 tarjeta a la vez (aprox) */
function moveSlide(direction){
  const carouselTrack = track();
  if (!carouselTrack) return;
  const card = carouselTrack.querySelector(".producto");
  if (!card) return;
  const gap = parseInt(getComputedStyle(carouselTrack).gap) || 12;
  const width = card.offsetWidth + gap;
  // calcular nueva posición
  const currentMatrix = getTranslateX(carouselTrack);
  let newPos = currentMatrix + (direction * width);
  // límites
  const maxNeg = -(carouselTrack.scrollWidth - carouselTrack.offsetWidth);
  if (newPos < maxNeg) newPos = maxNeg;
  if (newPos > 0) newPos = 0;
  carouselTrack.style.transform = `translateX(${newPos}px)`;
}

/* Obtener translateX actual */
function getTranslateX(el){
  const st = window.getComputedStyle(el);
  const tr = st.transform || st.webkitTransform || st.mozTransform;
  if (!tr || tr === "none") return 0;
  const values = tr.split('(')[1].split(')')[0].split(',');
  const tx = parseFloat(values[4] || values[0]); // fallback
  return tx;
}

/* Drag helpers */
function startDrag(e){
  isDragging = true;
  startX = e.clientX;
  posX = getTranslateX(track());
  e.target.setPointerCapture(e.pointerId);
}
function drag(e){
  if (!isDragging) return;
  const dx = e.clientX - startX;
  const newPos = posX + dx;
  const carouselTrack = track();
  // límites
  const maxNeg = -(carouselTrack.scrollWidth - carouselTrack.offsetWidth);
  if (newPos < maxNeg) {
    carouselTrack.style.transform = `translateX(${maxNeg}px)`;
    return;
  }
  if (newPos > 0) {
    carouselTrack.style.transform = `translateX(0px)`;
    return;
  }
  carouselTrack.style.transform = `translateX(${newPos}px)`;
}
function endDrag(e){
  isDragging = false;
}

/* --- Subir productos (cliente-side) --- */
const productForm = document.getElementById("product-form");
const productImageInput = document.getElementById("product-image");
const productTitleInput = document.getElementById("product-title");
const carouselTrackEl = document.getElementById("carousel-track");
const clearBtn = document.getElementById("clear-form");

if (productForm){
  productForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const file = productImageInput.files[0];
    const title = productTitleInput.value && productTitleInput.value.trim();
    if (!file || !title) {
      alert("Por favor selecciona una imagen y escribe un título.");
      return;
    }

    // leer la imagen como data URL y agregar al carrusel
    const reader = new FileReader();
    reader.onload = function(ev){
      const dataUrl = ev.target.result;
      addProductToCarousel({ title, image: dataUrl });
      // limpiar form
      productForm.reset();
    };
    reader.readAsDataURL(file);
  });
}

if (clearBtn){
  clearBtn.addEventListener("click", () => productForm.reset());
}

/* Añade un producto al DOM del carrusel */
function addProductToCarousel({ title, image }){
  const div = document.createElement("div");
  div.className = "producto";
  // crear imagen y título
  const img = document.createElement("img");
  img.src = image;
  img.alt = title;
  const h3 = document.createElement("h3");
  h3.textContent = title;
  div.appendChild(img);
  div.appendChild(h3);
  // añadir al final del track
  carouselTrackEl.appendChild(div);
}

/* --- Exportar los productos visibles a PDF (cliente) --- */
const exportBtn = document.getElementById("export-products-pdf");
if (exportBtn){
  exportBtn.addEventListener("click", async () => {
    // usar jsPDF
    if (!window.jspdf) { alert("Biblioteca PDF no disponible."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:"pt", format:"a4" });
    const products = Array.from(document.querySelectorAll(".carousel-track .producto"));
    if (products.length === 0) { alert("No hay productos para exportar."); return; }

    const margin = 40;
    let y = margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxImageWidth = 140;
    for (let i = 0; i < products.length; i++){
      const p = products[i];
      const title = p.querySelector("h3")?.textContent || "Sin título";
      const imgEl = p.querySelector("img");
      // sacar image data (si es de la carpeta /img/products/ puede no ser dataURL)
      try {
        let imgData;
        // si es data URL (subida por usuario) la usamos directamente
        if (imgEl.src.startsWith("data:")) {
          imgData = imgEl.src;
        } else {
          // si es una ruta relativa (img/productos/...), intentamos cargarla como blob y convertir a base64
          imgData = await toDataUrl(imgEl.src);
        }
        // añadir imagen (proporcional)
        let iw = maxImageWidth;
        let ih = 80;
        doc.addImage(imgData, 'JPEG', margin, y, iw, ih);
        doc.setFontSize(12);
        doc.text(title, margin + iw + 14, y + 30);
      } catch (err){
        // si falla la imagen, solo ponemos el título
        doc.setFontSize(12);
        doc.text(title, margin, y);
      }
      y += 110;
      if (y > doc.internal.pageSize.getHeight() - 80){
        doc.addPage();
        y = margin;
      }
    }
    doc.save("productos-numus.pdf");
  });
}

/* Helper: convertir imagen por URL a DataURL (fetch + blob -> base64)
   * OJO: Esto funcionará si la imagen está en el mismo dominio (GitHub Pages) o permite CORS.
*/
async function toDataUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* --- Inicializa detalles adicionales al cargar DOM --- */
document.addEventListener("DOMContentLoaded", () => {
  // previene selección accidentall al arrastrar
  document.querySelectorAll('.carousel-track, .carousel-btn').forEach(el => {
    el.addEventListener('dragstart', (e) => e.preventDefault());
  });
});
