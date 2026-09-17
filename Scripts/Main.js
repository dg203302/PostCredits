const searchForm = document.querySelector('[data-search-form]');
const searchInput = document.querySelector('[data-search-input]');

const searchAPI = {
	onSearch: null,
	getQuery() {
		return searchInput ? searchInput.value.trim() : '';
	},
	setHandler(handler) {
		this.onSearch = typeof handler === 'function' ? handler : null;
	}
};

window.PostCreditsSearch = searchAPI;

// Inicio is now just the ambient backdrop + the "Now Showing" widget (both fixed/global) —
// homeScrollTarget/is-scrolled tracking is kept only because a couple of legacy rules still
// key off `body.is-scrolled`; it no longer drives a hero to compact since there isn't one.
let homeScrollTarget = null;

function updateHeaderState() {
	const y = homeScrollTarget ? homeScrollTarget.scrollTop : window.scrollY;
	document.body.classList.toggle('is-scrolled', y > 24);
}

function bindHomeScrollState() {
	if (homeScrollTarget) {
		homeScrollTarget.removeEventListener('scroll', updateHeaderState);
	}
	homeScrollTarget = document.querySelector('.tab-panel[data-tab="home"]');
	if (homeScrollTarget) {
		homeScrollTarget.addEventListener('scroll', updateHeaderState, { passive: true });
	}
	updateHeaderState();
}

window.addEventListener('resize', updateHeaderState);

if (searchForm) {
	searchForm.addEventListener('submit', (event) => {
		event.preventDefault();

		const query = searchAPI.getQuery();
		const searchEvent = new CustomEvent('postcredits:search', {
			detail: {
				query
			}
		});

		searchForm.dispatchEvent(searchEvent);

		if (typeof searchAPI.onSearch === 'function') {
			searchAPI.onSearch(query);
		}
	});
}

// --- Tabbed layout (Inicio / Películas & Series / Trailers / Noticias) ---
const tabFooterNav = document.getElementById('tab-footer-nav');
let tabIntersectionObserver = null;

function setActiveTab(name, { scroll = true } = {}) {
	const viewport = document.getElementById('tab-viewport');
	if (!viewport) return;

	if (document.body.dataset.activeTab !== name && typeof stopInlinePlayer === 'function') {
		stopInlinePlayer();
	}
	document.body.dataset.activeTab = name;

	if (tabFooterNav) {
		tabFooterNav.querySelectorAll('.tab-footer-btn').forEach((btn) => {
			btn.classList.toggle('active', btn.dataset.tab === name);
		});
	}

	if (scroll) {
		const panel = viewport.querySelector(`.tab-panel[data-tab="${name}"]`);
		if (panel) {
			viewport.scrollTo({ left: panel.offsetLeft, behavior: 'smooth' });
		}
	}
}

function bindTabViewport(initialTab = 'home') {
	const viewport = document.getElementById('tab-viewport');
	if (!viewport) return;

	if (tabIntersectionObserver) {
		tabIntersectionObserver.disconnect();
	}

	tabIntersectionObserver = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
				setActiveTab(entry.target.dataset.tab, { scroll: false });
			}
		});
	}, { root: viewport, threshold: [0.6] });

	viewport.querySelectorAll('.tab-panel').forEach((panel) => tabIntersectionObserver.observe(panel));

	const targetPanel = viewport.querySelector(`.tab-panel[data-tab="${initialTab}"]`);
	viewport.scrollTo({ left: targetPanel ? targetPanel.offsetLeft : 0, behavior: 'instant' });
	setActiveTab(initialTab, { scroll: false });
	bindHomeScrollState();
}

if (tabFooterNav) {
	tabFooterNav.addEventListener('click', (e) => {
		const btn = e.target.closest('.tab-footer-btn');
		if (!btn || !btn.dataset.tab) return; // ignore the chat button, handled separately

		// The footer nav also shows on detail pages (movie/person/search results); tapping a
		// section there first rebuilds the tabbed home layout, then jumps to the requested tab.
		if (!document.body.classList.contains('tabs-active')) {
			if (typeof window.restoreHome === 'function') window.restoreHome();
			if (btn.dataset.tab !== 'home') {
				setActiveTab(btn.dataset.tab, { scroll: true });
			}
			return;
		}

		setActiveTab(btn.dataset.tab, { scroll: true });
	});
}

function enterHomeMode() {
	document.body.classList.add('tabs-active');
	document.body.classList.remove('search-active');
	const main = document.getElementById('main-content');
	if (main) main.classList.remove('content-grid');
}

function enterDetailMode() {
	document.body.classList.remove('tabs-active');
	document.body.classList.remove('search-active');
	const main = document.getElementById('main-content');
	if (main) main.classList.add('content-grid');
}

// Search results keep the topbar (with its own back button) visible instead of the
// footer-nav + floating back button the other detail pages use.
let preSearchTab = 'home';
function enterSearchMode() {
	preSearchTab = document.body.dataset.activeTab || 'home';
	enterDetailMode();
	document.body.classList.add('search-active');
}

const appTopbarBackBtn = document.getElementById('app-topbar-back-btn');
if (appTopbarBackBtn) {
	appTopbarBackBtn.addEventListener('click', () => {
		document.body.classList.remove('search-active');
		restoreHome();
		if (preSearchTab !== 'home') {
			setActiveTab(preSearchTab, { scroll: false });
		}
	});
}

bindTabViewport();

// --- Search History ---
let searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
const searchHistoryContainer = document.getElementById('search-history-container');

function renderSearchHistory() {
    if (!searchHistoryContainer) return;
    if (searchHistory.length === 0) {
        searchHistoryContainer.innerHTML = '';
        return;
    }
    searchHistoryContainer.innerHTML = searchHistory.map(item => `
        <div class="history-item-row" data-query="${item}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>${item}</span>
        </div>
    `).join('');
    
    searchHistoryContainer.querySelectorAll('.history-item-row').forEach(row => {
        row.addEventListener('click', () => {
            const searchInput = document.getElementById('search-query');
            if (searchInput) {
                searchInput.value = row.dataset.query;
                searchInput.dispatchEvent(new Event('input')); // Trigger search
                searchHistoryContainer.classList.remove('active');
            }
        });
    });
}

function addToHistory(query) {
    if (!query) return;
    searchHistory = searchHistory.filter(item => item.toLowerCase() !== query.toLowerCase());
    searchHistory.unshift(query);
    if (searchHistory.length > 6) searchHistory.pop(); // Keep top 6
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    renderSearchHistory();
}

// Initial render
renderSearchHistory();

// Form submit event to save history
if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
        const searchInput = document.getElementById('search-query');
        if (searchInput) {
            addToHistory(searchInput.value.trim());
            searchHistoryContainer.classList.remove('active');
        }
    });
}

// Show/hide dropdown logic
const searchInputEl = document.getElementById('search-query');
if (searchInputEl) {
    searchInputEl.addEventListener('focus', () => {
        if (searchHistory.length > 0) {
            searchHistoryContainer.classList.add('active');
        }
    });
    // Re-trigger dropdown if typing causes length > 0
    searchInputEl.addEventListener('input', () => {
        if (searchHistory.length > 0 && searchInputEl.value.trim() === '') {
            searchHistoryContainer.classList.add('active');
        } else {
            searchHistoryContainer.classList.remove('active');
        }
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        if (searchHistoryContainer) searchHistoryContainer.classList.remove('active');
    }
});

// --- Lightbox Media ---
window.openLightbox = function(mediaHTML, title = '', overview = '', year = '', rating = '') {
    const lightbox = document.getElementById('media-lightbox');
    const body = document.getElementById('lightbox-body');
    const detailsContainer = document.getElementById('lightbox-details');
    if (!lightbox || !body || !detailsContainer) return;
    
    body.innerHTML = mediaHTML;
    
    if (title) {
        detailsContainer.style.display = 'flex';
        let ratingHTML = rating ? `<span class="lightbox-details-rating">⭐ ${rating}</span>` : '';
        detailsContainer.innerHTML = `
            <h4 class="lightbox-details-title">${title}</h4>
            <div class="lightbox-details-meta">
                ${year ? `<span>${year}</span>` : ''}
                ${year && rating ? `<span>•</span>` : ''}
                ${ratingHTML}
            </div>
            ${overview ? `<p class="lightbox-details-overview">${overview}</p>` : ''}
        `;
    } else {
        detailsContainer.style.display = 'none';
        detailsContainer.innerHTML = '';
    }
    
    lightbox.classList.add('active');
};

// --- Reproductor de vídeo en línea ---
// Los vídeos se reproducen dentro de su propia tarjeta (sin lightbox a pantalla completa).
// Solo hay uno activo a la vez; se detiene al cambiar de pestaña o al abrir otro.
// youtube.com (no youtube-nocookie): así el reproductor usa la sesión/cookies de YouTube del
// navegador y YouTube no bloquea el vídeo con "confirma que no eres un bot".
function buildYouTubeEmbedUrl(videoKey) {
    const params = new URLSearchParams({
        rel: '0',
        autoplay: '1',
        playsinline: '1',
        modestbranding: '1',
        enablejsapi: '1'
    });
    if (window.location.origin && window.location.origin.startsWith('http')) {
        params.set('origin', window.location.origin);
        params.set('widget_referrer', window.location.href);
    }
    return `https://www.youtube.com/embed/${encodeURIComponent(videoKey)}?${params}`;
}

let activeInlinePlayer = null;

function stopInlinePlayer() {
    if (!activeInlinePlayer) return;
    const { host, card, player } = activeInlinePlayer;
    activeInlinePlayer = null;
    player.remove(); // quitar el iframe detiene el vídeo
    host.classList.remove('is-playing');
    if (card) {
        card.classList.remove('is-playing');
        card.removeAttribute('aria-busy');
    }
}

/**
 * Monta el reproductor dentro de `host` (la zona de imagen de la tarjeta).
 * `card` es la tarjeta completa, que recibe .is-playing para poder agrandarse.
 */
function playVideoInline(host, videoKey, { card = null, title = '' } = {}) {
    if (!host || !videoKey) return;
    if (activeInlinePlayer && activeInlinePlayer.host === host) return; // ya está sonando aquí
    stopInlinePlayer();

    const player = document.createElement('div');
    player.className = 'inline-player';

    const iframe = document.createElement('iframe');
    iframe.src = buildYouTubeEmbedUrl(videoKey);
    iframe.title = title ? `Trailer: ${title}` : 'Trailer';
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.setAttribute('allowfullscreen', '');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'inline-player__close';
    closeBtn.setAttribute('aria-label', 'Stop video');
    closeBtn.title = 'Stop video';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopInlinePlayer();
        (card || host).focus?.({ preventScroll: true });
    });

    player.append(iframe, closeBtn);
    // Los clics dentro del reproductor no deben volver a disparar la tarjeta
    player.addEventListener('click', (e) => e.stopPropagation());
    player.addEventListener('keydown', (e) => e.stopPropagation());
    host.appendChild(player);
    host.classList.add('is-playing');
    if (card) card.classList.add('is-playing');

    activeInlinePlayer = { host, card, player };

    // Si la tarjeta cambió de tamaño (desktop) o quedó fuera de vista, llevarla a la vista
    requestAnimationFrame(() => {
        (card || host).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

const lightboxEl = document.getElementById('media-lightbox');
const lightboxCloseEl = document.getElementById('lightbox-close');
if (lightboxEl) {
    lightboxEl.addEventListener('click', (e) => {
        if (e.target === lightboxEl || e.target === lightboxCloseEl) {
            lightboxEl.classList.remove('active');
            document.getElementById('lightbox-body').innerHTML = ''; // Stop video
            const detailsContainer = document.getElementById('lightbox-details');
            if (detailsContainer) detailsContainer.innerHTML = '';
        }
    });
}

// --- TMDB Background Carousel ---
const TMDB_API_KEY = "ece12ff481fd8f23e34255eadfae14f0";
const BACKDROP_CONTAINER = document.getElementById('backdrop-container');
let currentBackdropIndex = 0;
let backdrops = [];
let originalBackdrops = [];

function setBackdrops(newBackdrops) {
	originalBackdrops = [...newBackdrops];
	applyBackdropOrdering();
}

function applyBackdropOrdering() {
	const order = localStorage.getItem('backdrop-order') || 'default';
	if (order === 'random' && originalBackdrops.length > 4) {
		backdrops = [...originalBackdrops];
		for (let i = backdrops.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[backdrops[i], backdrops[j]] = [backdrops[j], backdrops[i]];
		}
	} else {
		backdrops = [...originalBackdrops];
	}
	updateOrderControlsVisibility();
}

function updateOrderControlsVisibility() {
	const orderSection = document.getElementById('backdrop-order-section');
	if (orderSection) {
		if (originalBackdrops.length > 4) {
			orderSection.style.display = 'block';
			const savedOrder = localStorage.getItem('backdrop-order') || 'default';
			const radios = document.querySelectorAll('input[name="bg-order"]');
			radios.forEach(radio => {
				radio.checked = (radio.value === savedOrder);
			});
		} else {
			orderSection.style.display = 'none';
		}
	}
}

async function fetchLatestBackdrops() {
	if (!BACKDROP_CONTAINER) return;
	
	const bgSource = localStorage.getItem('bg-source') || 'theaters';
	const labelEl = document.getElementById('backdrop-label');
	const settingsBtn = document.getElementById('settings-backdrop-btn');
	if (settingsBtn) settingsBtn.style.display = '';
	
	if (bgSource === 'favorites') {
		const favs = JSON.parse(localStorage.getItem('postCreditsFavs') || '[]');
		if (favs.length > 0) {
			if (labelEl) labelEl.textContent = 'Favorite';
			const favBackdrops = favs.map(movie => ({
				url: `https://image.tmdb.org/t/p/original${movie.backdrop_path}`,
				title: movie.title || "Unknown"
			}));
			setBackdrops(favBackdrops);
			initCarousel();
			return;
		}
	}
	
	if (labelEl) labelEl.textContent = 'Now Showing';
	try {
		const region = (navigator.language || 'es-MX').split('-')[1] || 'US';
		// Obtener las películas recientes en cines (Now Playing) con título en inglés
		const response = await fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&region=${region}&page=1`);
		const data = await response.json();
		
		if (data.results && data.results.length > 0) {
			// Filtrar las películas que tengan imagen de fondo
			const theaterBackdrops = data.results
				.filter(movie => movie.backdrop_path)
				.map(movie => ({
					url: `https://image.tmdb.org/t/p/original${movie.backdrop_path}`,
					title: movie.title || movie.original_title || "Unknown"
				}));
			
			if (theaterBackdrops.length > 0) {
				setBackdrops(theaterBackdrops);
				initCarousel();
			}
		}
	} catch (error) {
		console.error("Error al obtener los backdrops de TMDB:", error);
	}
}

let carouselInterval;

function extractColorFromUrl(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 50; 
            canvas.height = 50;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let r = 0, g = 0, b = 0, count = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] + data[i+1] + data[i+2] > 60 && data[i] + data[i+1] + data[i+2] < 700) {
                    r += data[i];
                    g += data[i+1];
                    b += data[i+2];
                    count++;
                }
            }
            if (count > 0) {
                r = Math.floor(r / count);
                g = Math.floor(g / count);
                b = Math.floor(b / count);
                const max = Math.max(r, g, b);
                if (max < 150) {
                    const factor = 150 / (max || 1);
                    r = Math.min(255, Math.floor(r * factor));
                    g = Math.min(255, Math.floor(g * factor));
                    b = Math.min(255, Math.floor(b * factor));
                }
                resolve({r, g, b});
            } else {
                resolve({r: 241, g: 245, b: 249});
            }
        };
        img.onerror = () => resolve({r: 241, g: 245, b: 249});
        img.src = url;
    });
}

function initCarousel() {
	const infoEl = document.getElementById('backdrop-info');
	const titleEl = document.getElementById('backdrop-title');
	const titleRowEl = infoEl ? infoEl.querySelector('.backdrop-title-row') : null;

	// El mismo título se refleja como subtítulo de "PostCredits" en Inicio (el widget
	// flotante se oculta ahí para no superponerse con el hero).
	const heroNowEl = document.getElementById('hero-now');
	const heroNowTitleEl = document.getElementById('hero-now-title');
	const heroNowLabelEl = document.getElementById('hero-now-label');
	const labelSourceEl = document.getElementById('backdrop-label');

	const updateTitle = async (index) => {
		if (titleEl && backdrops[index]) {
			titleEl.textContent = backdrops[index].title;
			if (titleRowEl) titleRowEl.classList.add('visible');

			if (heroNowTitleEl) heroNowTitleEl.textContent = backdrops[index].title;
			if (heroNowLabelEl && labelSourceEl) heroNowLabelEl.textContent = labelSourceEl.textContent;
			if (heroNowEl) heroNowEl.classList.add('visible');

			const smallUrl = backdrops[index].url.replace('original', 'w300');
			const color = await extractColorFromUrl(smallUrl);
			const root = document.documentElement;
			root.style.setProperty('--title-color', `rgb(${Math.min(255, color.r + 80)}, ${Math.min(255, color.g + 80)}, ${Math.min(255, color.b + 80)})`);
			root.style.setProperty('--title-glow', `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`);
			root.style.setProperty('--title-glow-dim', `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`);
			root.style.setProperty('--title-glow-dimmer', `rgba(${color.r}, ${color.g}, ${color.b}, 0.4)`);
			root.style.setProperty('--search-bg', `rgba(${color.r}, ${color.g}, ${color.b}, 0.92)`);
		}
	};

	BACKDROP_CONTAINER.innerHTML = '';
	currentBackdropIndex = 0;

	// Crear los elementos div para cada imagen y poder hacer una transición suave
	backdrops.forEach((backdrop, index) => {
		const div = document.createElement('div');
		div.classList.add('backdrop');
		div.style.backgroundImage = `url(${backdrop.url})`;
		if (index === 0) div.classList.add('active');
		BACKDROP_CONTAINER.appendChild(div);
	});

	// Establecer el título inicial
	updateTitle(0);

	if (carouselInterval) clearInterval(carouselInterval);

	// Cambiar el fondo según la velocidad seleccionada (por defecto 30000ms)
	const savedSpeed = parseInt(localStorage.getItem('backdrop-speed') || '30000', 10);
	carouselInterval = setInterval(() => {
		const backdropElements = BACKDROP_CONTAINER.querySelectorAll('.backdrop');
		if (backdropElements.length <= 1) return;

		backdropElements[currentBackdropIndex].classList.remove('active');
		if (titleRowEl) titleRowEl.classList.remove('visible');
		if (heroNowEl) heroNowEl.classList.remove('visible');

		currentBackdropIndex = (currentBackdropIndex + 1) % backdropElements.length;
		backdropElements[currentBackdropIndex].classList.add('active');

		setTimeout(() => {
			updateTitle(currentBackdropIndex);
		}, 600);
	}, savedSpeed);
}

// Iniciar el ciclo al cargar la página
fetchLatestBackdrops();

async function loadMovieBackdrops(id, mediaType, defaultTitle) {
	try {
		const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${id}/images?api_key=${TMDB_API_KEY}`);
		const data = await res.json();
		
		if (data.backdrops && data.backdrops.length > 0) {
			const movieBackdrops = data.backdrops.slice(0, 10).map(img => ({
				url: `https://image.tmdb.org/t/p/original${img.file_path}`,
				title: defaultTitle
			}));
			setBackdrops(movieBackdrops);
			initCarousel();
            const settingsBtn = document.getElementById('settings-backdrop-btn');
            if (settingsBtn) settingsBtn.style.display = 'none';
		}
	} catch(e) {
		console.error("Error fetching specific backdrops", e);
	}
}

// Lógica del botón para ver el Backdrop
window.toggleBackdropView = function () {
	const isActive = document.body.classList.toggle('backdrop-view-mode');
	document.documentElement.classList.toggle('backdrop-view-active', isActive);
};

// --- Barra de controles del fondo (Inicio) ---
// restoreHome() reconstruye Inicio con innerHTML, lo que borraba estos botones y sus
// listeners. Por eso se generan siempre desde aquí y sus clics van por delegación.
const BACKDROP_CONTROLS_HTML = `
	<button type="button" class="backdrop-control-btn" id="roulette-backdrop-btn" data-backdrop-action="roulette"
		title="Cine-Roulette" aria-label="Cine-Roulette">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<rect x="3" y="3" width="18" height="18" rx="3"></rect>
			<circle cx="8" cy="8" r="1.2" fill="currentColor"></circle>
			<circle cx="16" cy="8" r="1.2" fill="currentColor"></circle>
			<circle cx="12" cy="12" r="1.2" fill="currentColor"></circle>
			<circle cx="8" cy="16" r="1.2" fill="currentColor"></circle>
			<circle cx="16" cy="16" r="1.2" fill="currentColor"></circle>
		</svg>
	</button>
	<button type="button" class="backdrop-control-btn" id="view-backdrop-btn" data-backdrop-action="fullscreen"
		title="View backdrop" aria-label="View backdrop fullscreen">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path>
			<circle cx="12" cy="12" r="3"></circle>
		</svg>
	</button>
	<button type="button" class="backdrop-control-btn" id="settings-backdrop-btn" data-backdrop-action="settings"
		title="Backdrop settings" aria-label="Backdrop settings" aria-expanded="false" aria-controls="backdrop-settings-menu">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<line x1="4" y1="6" x2="20" y2="6"></line>
			<line x1="4" y1="12" x2="20" y2="12"></line>
			<line x1="4" y1="18" x2="20" y2="18"></line>
			<circle cx="9" cy="6" r="2" fill="currentColor"></circle>
			<circle cx="15" cy="12" r="2" fill="currentColor"></circle>
			<circle cx="7" cy="18" r="2" fill="currentColor"></circle>
		</svg>
	</button>
`;

function renderBackdropControls() {
	document.querySelectorAll('[data-backdrop-controls]').forEach((el) => {
		el.innerHTML = BACKDROP_CONTROLS_HTML;
	});
}

renderBackdropControls();

document.addEventListener('click', (e) => {
	const btn = e.target.closest('[data-backdrop-action]');
	if (!btn) return;

	switch (btn.dataset.backdropAction) {
		case 'fullscreen':
			window.toggleBackdropView();
			break;
		case 'settings':
			toggleSettingsMenu();
			break;
		case 'roulette':
			openCineRoulette();
			break;
	}
});

// En pantalla completa <main> queda oculto (y con él la fila de controles del hero),
// así que la salida es este botón, visible solo en ese modo.
const fullscreenExitBtn = document.getElementById('fullscreen-exit-btn');

if (fullscreenExitBtn) {
	fullscreenExitBtn.addEventListener('click', () => window.toggleBackdropView());
}

// Evitar desplazamiento en la página al estar en vista de fondo (backdrop-view-mode) o con el menú de configuración activo
const preventDefault = (e) => {
	if (document.body.classList.contains('backdrop-view-mode')) {
		e.preventDefault();
		return;
	}
	const settingsMenu = document.getElementById('backdrop-settings-menu');
	const favSheet = document.getElementById('fav-search-sheet');
	if (settingsMenu && settingsMenu.classList.contains('active')) {
		if (!settingsMenu.contains(e.target) && !(favSheet && favSheet.contains(e.target))) {
			e.preventDefault();
		}
	}
};

const preventKeys = (e) => {
	if (document.body.classList.contains('backdrop-view-mode')) {
		const keys = ['Space', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'End', 'Home'];
		if (keys.includes(e.code)) {
			e.preventDefault();
		}
		return;
	}
	const settingsMenu = document.getElementById('backdrop-settings-menu');
	if (settingsMenu && settingsMenu.classList.contains('active')) {
		const activeEl = document.activeElement;
		const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
		if (!isInput) {
			const keys = ['Space', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'End', 'Home'];
			if (keys.includes(e.code)) {
				e.preventDefault();
			}
		}
	}
};

window.addEventListener('wheel', preventDefault, { passive: false });
window.addEventListener('touchmove', preventDefault, { passive: false });
window.addEventListener('keydown', preventKeys, { passive: false });

// Settings Menu Logic
const settingsMenu = document.getElementById('backdrop-settings-menu');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const bgSourceRadios = document.querySelectorAll('input[name="bg-source"]');
const bgOrderRadios = document.querySelectorAll('input[name="bg-order"]');
const bgSpeedRadios = document.querySelectorAll('input[name="bg-speed"]');

function updateFavoritesVisibility() {
	const bgSource = localStorage.getItem('bg-source') || 'theaters';
	const isFav = (bgSource === 'favorites');
	const favList = document.getElementById('settings-favorites-list');
	const favSearch = document.getElementById('settings-favorites-search');
	
	if (favList) favList.style.display = isFav ? 'flex' : 'none';
	if (favSearch) favSearch.style.display = isFav ? 'block' : 'none';
}

// El botón de ajustes se re-renderiza con Inicio, así que se busca en cada uso.
function setSettingsMenuOpen(open) {
	if (!settingsMenu) return;
	settingsMenu.classList.toggle('active', open);
	if (!open) setFavSearchOpen(false);
	const btn = document.getElementById('settings-backdrop-btn');
	if (btn) {
		btn.classList.toggle('active', open);
		btn.setAttribute('aria-expanded', String(open));
	}
	if (open) {
		renderSettingsFavorites();
		updateOrderControlsVisibility();
		updateFavoritesVisibility();
	}
}

function toggleSettingsMenu() {
	if (!settingsMenu) return;
	setSettingsMenuOpen(!settingsMenu.classList.contains('active'));
}

if (settingsMenu) {
	document.addEventListener('click', (e) => {
		if (!settingsMenu.classList.contains('active')) return;
		if (settingsMenu.contains(e.target) || e.target.closest('[data-backdrop-action="settings"]')) return;
		if (favSearchSheet && favSearchSheet.contains(e.target)) return;
		setSettingsMenuOpen(false);
	});
}

if (settingsCloseBtn && settingsMenu) {
	settingsCloseBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		setSettingsMenuOpen(false);
	});
}

/* Cerrar deslizando hacia abajo, igual que la hoja del chat: el tirador arrastra la
   hoja, el fondo se va aclarando y al pasar de 120px se cierra. */
function enableSheetSwipe(sheetEl, closeSheet) {
	if (!sheetEl) return;
	const handle = sheetEl.querySelector('[data-sheet-handle]');
	if (!handle) return;

	const setOverlayProgress = (value) => {
		document.body.style.setProperty('--sheet-drag-progress', String(value));
	};

	handle.addEventListener('touchstart', (e) => {
		const startY = e.touches[0].clientY;
		let currentY = startY;

		sheetEl.classList.add('sheet-dragging');

		const onMove = (moveEvent) => {
			currentY = moveEvent.touches[0].clientY;
			const dy = Math.max(0, currentY - startY);
			sheetEl.style.transform = `translateY(${dy}px)`;
			setOverlayProgress(Math.max(0, 1 - dy / 300));
			moveEvent.preventDefault();
		};

		const onEnd = () => {
			document.removeEventListener('touchmove', onMove);
			document.removeEventListener('touchend', onEnd);
			sheetEl.classList.remove('sheet-dragging');

			if (currentY - startY > 120) {
				sheetEl.style.transform = 'translateY(100%)';
				setOverlayProgress(0);
				setTimeout(() => {
					closeSheet();
					sheetEl.style.transform = '';
					setOverlayProgress(1);
				}, 380);
			} else {
				sheetEl.style.transform = '';
				setOverlayProgress(1);
			}
		};

		document.addEventListener('touchmove', onMove, { passive: false });
		document.addEventListener('touchend', onEnd, { passive: true });
		e.preventDefault();
	}, { passive: false });
}

if (settingsMenu) {
	enableSheetSwipe(settingsMenu, () => setSettingsMenuOpen(false));
}

// --- Buscador de favoritos: ventana flotante propia, abierta desde Ajustes ---
const favSearchSheet = document.getElementById('fav-search-sheet');
const openFavSearchBtn = document.getElementById('open-fav-search-btn');

function setFavSearchOpen(open) {
	if (!favSearchSheet) return;
	favSearchSheet.classList.toggle('active', open);
	favSearchSheet.setAttribute('aria-hidden', String(!open));
	if (openFavSearchBtn) openFavSearchBtn.setAttribute('aria-expanded', String(open));
	document.body.classList.toggle('fav-search-open', open);
	if (open && window.matchMedia('(min-width: 769px)').matches) {
		// Tras la animación de entrada, para que el foco no haga saltar la tarjeta
		setTimeout(() => document.getElementById('settings-mini-search')?.focus({ preventScroll: true }), 420);
	}
}

if (favSearchSheet) {
	openFavSearchBtn?.addEventListener('click', (e) => {
		e.stopPropagation();
		setFavSearchOpen(!favSearchSheet.classList.contains('active'));
	});
	document.getElementById('fav-search-close-btn')?.addEventListener('click', (e) => {
		e.stopPropagation();
		setSettingsMenuOpen(false);
	});
	document.getElementById('fav-search-back-btn')?.addEventListener('click', (e) => {
		e.stopPropagation();
		setFavSearchOpen(false);
	});
	enableSheetSwipe(favSearchSheet, () => setFavSearchOpen(false));
	document.addEventListener('keydown', (e) => {
		if (e.key !== 'Escape') return;
		if (favSearchSheet.classList.contains('active')) setFavSearchOpen(false);
		else if (settingsMenu?.classList.contains('active')) setSettingsMenuOpen(false);
	});
}

const downloadBackdropBtn = document.getElementById('download-backdrop-btn');
if (downloadBackdropBtn) {
	downloadBackdropBtn.addEventListener('click', async () => {
		if (typeof backdrops === 'undefined' || backdrops.length === 0 || !backdrops[currentBackdropIndex]) {
			alert('No backdrop image available to download.');
			return;
		}
		
		const originalText = downloadBackdropBtn.innerHTML;
		downloadBackdropBtn.disabled = true;
		downloadBackdropBtn.innerHTML = `
			<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
			<span>Downloading...</span>
		`;
		
		try {
			const backdrop = backdrops[currentBackdropIndex];
			const url = backdrop.url;
			const title = backdrop.title || 'backdrop';
			const cleanTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
			const filename = `${cleanTitle}_backdrop.jpg`;
			
			const response = await fetch(url);
			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);
			
			const link = document.createElement('a');
			link.href = blobUrl;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			
			URL.revokeObjectURL(blobUrl);
		} catch (error) {
			console.error('Download failed', error);
			const backdrop = backdrops[currentBackdropIndex];
			window.open(backdrop.url, '_blank');
		} finally {
			downloadBackdropBtn.disabled = false;
			downloadBackdropBtn.innerHTML = originalText;
		}
	});
}

if (bgSourceRadios.length > 0) {
	const currentSource = localStorage.getItem('bg-source') || 'theaters';
	bgSourceRadios.forEach(radio => {
		if (radio.value === currentSource) {
			radio.checked = true;
		}
		radio.addEventListener('change', (e) => {
			localStorage.setItem('bg-source', e.target.value);
			fetchLatestBackdrops();
			updateFavoritesVisibility();
		});
	});
	updateFavoritesVisibility();
}

if (bgOrderRadios.length > 0) {
	const currentOrder = localStorage.getItem('backdrop-order') || 'default';
	bgOrderRadios.forEach(radio => {
		if (radio.value === currentOrder) {
			radio.checked = true;
		}
		radio.addEventListener('change', (e) => {
			localStorage.setItem('backdrop-order', e.target.value);
			applyBackdropOrdering();
			initCarousel();
		});
	});
}

if (bgSpeedRadios.length > 0) {
	// Tiempos preestablecidos (15/30/45s) o uno personalizado, guardado siempre en ms
	const SPEED_PRESETS = ['15000', '30000', '45000'];
	const SPEED_MIN_S = 3;
	const SPEED_MAX_S = 3600;
	const customRow = document.getElementById('backdrop-speed-custom');
	const customInput = document.getElementById('backdrop-speed-custom-input');
	const currentSpeed = localStorage.getItem('backdrop-speed') || '30000';
	const isCustom = !SPEED_PRESETS.includes(currentSpeed);

	const setCustomVisible = (visible) => {
		if (customRow) customRow.hidden = !visible;
	};

	const applyCustomSpeed = () => {
		if (!customInput) return;
		let seconds = Math.round(Number(customInput.value));
		if (!Number.isFinite(seconds) || seconds <= 0) seconds = 60;
		seconds = Math.min(SPEED_MAX_S, Math.max(SPEED_MIN_S, seconds));
		customInput.value = String(seconds);
		const ms = String(seconds * 1000);
		if (localStorage.getItem('backdrop-speed') !== ms) {
			localStorage.setItem('backdrop-speed', ms);
			initCarousel();
		}
	};

	if (customInput && isCustom) {
		customInput.value = String(Math.round(parseInt(currentSpeed, 10) / 1000) || 60);
	}
	setCustomVisible(isCustom);

	bgSpeedRadios.forEach(radio => {
		radio.checked = isCustom ? radio.value === 'custom' : radio.value === currentSpeed;
		radio.addEventListener('change', (e) => {
			if (e.target.value === 'custom') {
				setCustomVisible(true);
				applyCustomSpeed();
				customInput?.focus({ preventScroll: true });
				customInput?.select();
				return;
			}
			setCustomVisible(false);
			localStorage.setItem('backdrop-speed', e.target.value);
			initCarousel();
		});
	});

	customInput?.addEventListener('change', applyCustomSpeed);
	customInput?.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			applyCustomSpeed();
			customInput.blur();
		}
	});
}

function isFavorite(id) {
    let favs = JSON.parse(localStorage.getItem('postCreditsFavs') || '[]');
    return favs.some(f => f.id == id);
}

function toggleFavorite(movieData, btnEl) {
    let favs = JSON.parse(localStorage.getItem('postCreditsFavs') || '[]');
    const index = favs.findIndex(f => f.id == movieData.id);
    if (index >= 0) {
        favs.splice(index, 1);
        if(btnEl) btnEl.classList.remove('active');
    } else {
        favs.push(movieData);
        if(btnEl) btnEl.classList.add('active');
    }
    localStorage.setItem('postCreditsFavs', JSON.stringify(favs));
    
    // If currently showing favorites, refresh backdrops
    if (localStorage.getItem('bg-source') === 'favorites') {
        fetchLatestBackdrops();
    }
}

function makeFavoritesReorderable(container) {
    if (container.dataset.reorderableAttached === 'true') return;
    container.dataset.reorderableAttached = 'true';
    
    let draggingElement = null;
    let dragTimeout = null;
    let startX = 0;
    let startY = 0;
    let isDragActive = false;
    let wasDragged = false;
    
    // Prevent default browser image dragging ghosts (crucial for desktop mouse dragging)
    container.addEventListener('dragstart', (e) => {
        if (e.target.closest('.fav-drag-item')) {
            e.preventDefault();
        }
    });
    
    // Prevent browser context menu (long press options) on mobile/desktop
    container.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.fav-drag-item')) {
            e.preventDefault();
        }
    });
    
    // Click listener to load clicked movie title into search input
    container.addEventListener('click', (e) => {
        const item = e.target.closest('.fav-drag-item');
        if (!item) return;
        
        if (wasDragged) {
            wasDragged = false;
            return;
        }
        
        const title = item.getAttribute('title');
        const searchInput = document.getElementById('search-query');
        if (searchInput && title) {
            searchInput.value = title;
            searchInput.dispatchEvent(new Event('input'));
            
            setSettingsMenuOpen(false);
        }
    });
    
    // 1. DESKTOP/MOUSE DRAG LOGIC (via MouseEvents)
    const onMouseMove = (e) => {
        if (!draggingElement) return;
        
        if (!isDragActive) {
            const deltaX = Math.abs(e.clientX - startX);
            const deltaY = Math.abs(e.clientY - startY);
            if (deltaX > 5 || deltaY > 5) {
                isDragActive = true;
                wasDragged = true;
                draggingElement.classList.add('dragging');
            }
            return;
        }
        
        const clientX = e.clientX;
        const siblings = [...container.querySelectorAll('.fav-drag-item:not(.dragging)')];
        const nextSibling = siblings.find(sibling => {
            const rect = sibling.getBoundingClientRect();
            return clientX < rect.left + rect.width / 2;
        });
        
        if (nextSibling) {
            container.insertBefore(draggingElement, nextSibling);
        } else {
            container.appendChild(draggingElement);
        }
        
        const containerRect = container.getBoundingClientRect();
        if (clientX < containerRect.left + 40) {
            container.scrollLeft -= 8;
        } else if (clientX > containerRect.right - 40) {
            container.scrollLeft += 8;
        }
    };
    
    const onMouseUp = () => {
        if (draggingElement && isDragActive) {
            draggingElement.classList.remove('dragging');
            saveNewFavoritesOrder();
        }
        draggingElement = null;
        isDragActive = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    
    container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const item = e.target.closest('.fav-drag-item');
        if (!item) return;
        
        draggingElement = item;
        startX = e.clientX;
        startY = e.clientY;
        isDragActive = false;
        wasDragged = false;
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
    
    // 2. MOBILE/TOUCH DRAG LOGIC (via TouchEvents to bypass PointerEvent bugs)
    container.addEventListener('touchstart', (e) => {
        const item = e.target.closest('.fav-drag-item');
        if (!item) return;
        
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        draggingElement = item;
        isDragActive = false;
        wasDragged = false;
        
        dragTimeout = setTimeout(() => {
            isDragActive = true;
            wasDragged = true;
            item.classList.add('dragging');
            if (navigator.vibrate) {
                navigator.vibrate(30);
            }
        }, 250);
    });
    
    container.addEventListener('touchmove', (e) => {
        if (!draggingElement) return;
        
        const touch = e.touches[0];
        const clientX = touch.clientX;
        const clientY = touch.clientY;
        
        if (!isDragActive) {
            const deltaX = Math.abs(clientX - startX);
            const deltaY = Math.abs(clientY - startY);
            if (deltaX > 15 || deltaY > 15) {
                clearTimeout(dragTimeout);
                draggingElement = null;
            }
            return;
        }
        
        // Prevent container scrolling/panning while dragging is active
        e.preventDefault();
        
        const siblings = [...container.querySelectorAll('.fav-drag-item:not(.dragging)')];
        const nextSibling = siblings.find(sibling => {
            const rect = sibling.getBoundingClientRect();
            return clientX < rect.left + rect.width / 2;
        });
        
        if (nextSibling) {
            container.insertBefore(draggingElement, nextSibling);
        } else {
            container.appendChild(draggingElement);
        }
        
        const containerRect = container.getBoundingClientRect();
        if (clientX < containerRect.left + 40) {
            container.scrollLeft -= 8;
        } else if (clientX > containerRect.right - 40) {
            container.scrollLeft += 8;
        }
    }, { passive: false });
    
    const endTouchDrag = () => {
        clearTimeout(dragTimeout);
        if (draggingElement && isDragActive) {
            draggingElement.classList.remove('dragging');
            saveNewFavoritesOrder();
        }
        draggingElement = null;
        isDragActive = false;
    };
    
    container.addEventListener('touchend', endTouchDrag);
    container.addEventListener('touchcancel', endTouchDrag);
}

function saveNewFavoritesOrder() {
    const container = document.getElementById('settings-favorites-list');
    if (!container) return;
    
    const items = [...container.querySelectorAll('.fav-drag-item')];
    const newOrderIds = items.map(item => item.dataset.id);
    
    let favs = JSON.parse(localStorage.getItem('postCreditsFavs') || '[]');
    
    const reorderedFavs = [];
    newOrderIds.forEach(id => {
        const found = favs.find(f => f.id == id);
        if (found) reorderedFavs.push(found);
    });
    
    localStorage.setItem('postCreditsFavs', JSON.stringify(reorderedFavs));
    
    if (localStorage.getItem('bg-source') === 'favorites') {
        fetchLatestBackdrops();
    }
}

function renderSettingsFavorites() {
    const favList = document.getElementById('settings-favorites-list');
    if (!favList) return;
    const favs = JSON.parse(localStorage.getItem('postCreditsFavs') || '[]');
    
    if (favs.length === 0) {
        favList.innerHTML = '<p class="settings-favorites-empty">No favorites yet. Search above to add some.</p>';
        return;
    }
    
    favList.innerHTML = favs.map(f => {
        const poster = f.poster_path ? `https://image.tmdb.org/t/p/w200${f.poster_path}` : (f.backdrop_path ? `https://image.tmdb.org/t/p/w200${f.backdrop_path}` : 'https://via.placeholder.com/150x225?text=No+Poster');
        return `<img src="${poster}" title="${f.title}" alt="${f.title}" data-id="${f.id}" class="fav-drag-item" draggable="false">`;
    }).join('');
    
    makeFavoritesReorderable(favList);
}

let miniSearchTimeout;
let miniSearchResults = [];
const miniSearchInput = document.getElementById('settings-mini-search');
if (miniSearchInput) {
    miniSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(miniSearchTimeout);
        const resultsContainer = document.getElementById('settings-mini-results');
        
        if (!query) {
            resultsContainer.innerHTML = '';
            return;
        }
        
        miniSearchTimeout = setTimeout(async () => {
            try {
                const lang = navigator.language || 'es-MX';
                const searchRes = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=${lang}&query=${encodeURIComponent(query)}&page=1`);
                const searchData = await searchRes.json();
                
                if (searchData.results && searchData.results.length > 0) {
                    miniSearchResults = searchData.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
                    
                    resultsContainer.innerHTML = miniSearchResults.map(item => {
                        const title = item.title || item.name;
                        const poster = item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : 'https://via.placeholder.com/40x60?text=?';
                        const isFav = isFavorite(item.id);
                        
                        return `
                            <div class="fav-search-row">
                                <img src="${poster}" alt="" class="fav-search-row__poster" loading="lazy">
                                <div class="fav-search-row__info">
                                    <p class="fav-search-row__title" title="${title}">${title}</p>
                                    <p class="fav-search-row__type">${item.media_type === 'movie' ? 'Movie' : 'TV Show'}${(item.release_date || item.first_air_date) ? ` · ${(item.release_date || item.first_air_date).split('-')[0]}` : ''}</p>
                                </div>
                                <button class="mini-fav-btn fav-btn ${isFav ? 'active' : ''}" data-id="${item.id}" aria-label="${isFav ? 'Remove from' : 'Add to'} favorites">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                </button>
                            </div>
                        `;
                    }).join('');
                    
                    resultsContainer.querySelectorAll('.mini-fav-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const id = btn.dataset.id;
                            const movie = miniSearchResults.find(m => m.id == id);
                            if (movie) {
                                const movieData = {
                                    id: movie.id,
                                    title: movie.title || movie.name,
                                    backdrop_path: movie.backdrop_path,
                                    poster_path: movie.poster_path,
                                    media_type: movie.media_type
                                };
                                toggleFavorite(movieData, btn);
                                renderSettingsFavorites();
                                const mainFavBtn = document.getElementById('fav-btn');
                                if (mainFavBtn && mainFavBtn.dataset.id == id) {
                                    isFavorite(id) ? mainFavBtn.classList.add('active') : mainFavBtn.classList.remove('active');
                                }
                            }
                        });
                    });
                } else {
                    resultsContainer.innerHTML = '<p class="fav-search-empty">No results found.</p>';
                }
            } catch (err) {
                console.error(err);
            }
        }, 400);
    });
}

// --- Dynamic Main Content ---
// --- Slideshow de imágenes en las tarjetas de Películas & Series ---
// Póster principal, luego pósters alternativos y fotogramas (backdrops) de la película.
const CARD_SLIDES_MAX = 5;

function buildCardSlides(item, posterPath, featured = false) {
    const images = item.details?.images || {};
    const mainBackdrop = item.details?.backdrop_path || item.backdrop_path;

    // Galería de fotogramas de la película (no solo la portada)
    const stills = [];
    const addStill = (path) => {
        if (path && !stills.includes(path)) stills.push(path);
    };
    (images.backdrops || []).forEach(img => addStill(img.file_path));
    addStill(mainBackdrop);

    if (featured && stills.length) {
        return stills.slice(0, CARD_SLIDES_MAX).map(path => `https://image.tmdb.org/t/p/w1280${path}`);
    }

    // Tarjeta normal: arranca con el póster (para reconocerla) y luego recorre la galería;
    // si no hay fotogramas, usa pósters alternativos.
    const slides = [];
    if (posterPath) slides.push(`https://image.tmdb.org/t/p/w342${posterPath}`);
    stills.slice(0, CARD_SLIDES_MAX - slides.length).forEach(path => {
        slides.push(`https://image.tmdb.org/t/p/w780${path}`);
    });
    if (slides.length < 2) {
        (images.posters || []).forEach(img => {
            const url = `https://image.tmdb.org/t/p/w342${img.file_path}`;
            if (slides.length < CARD_SLIDES_MAX && !slides.includes(url)) slides.push(url);
        });
    }
    return slides;
}

function advanceCardSlideshow(wrapper) {
    const slides = wrapper.querySelectorAll('.card-slide');
    if (slides.length < 2) return;
    const current = [...slides].findIndex(s => s.classList.contains('is-active'));
    const nextIndex = (current + 1) % slides.length;
    const next = slides[nextIndex];

    const show = () => {
        slides[current].classList.remove('is-active');
        next.classList.add('is-active');
        wrapper.querySelectorAll('.card-slide-dots span').forEach((dot, i) => {
            dot.classList.toggle('is-active', i === nextIndex);
        });
        // Precarga la siguiente para que el próximo cambio no parpadee
        const after = slides[(nextIndex + 1) % slides.length];
        if (after.dataset.src && !after.src) after.src = after.dataset.src;
    };

    if (next.dataset.src && !next.src) {
        next.src = next.dataset.src;
        next.decode ? next.decode().then(show, show) : next.addEventListener('load', show, { once: true });
    } else {
        show();
    }
}

(function startCardSlideshows() {

    const TICK_MS = 1200; // cada tarjeta cambia cada 3 ticks, escalonadas en tres oleadas
    let tick = 0;

    setInterval(() => {
        if (document.hidden || document.body.classList.contains('backdrop-view-mode')) return;
        if ((document.body.dataset.activeTab || 'home') !== 'media') return;

        tick++;
        const vh = window.innerHeight;
        document.querySelectorAll('#tab-panel-media [data-slideshow]').forEach((wrapper, i) => {
            if ((tick + i) % 3 !== 0) return;
            if (wrapper.matches(':hover')) return;
            const rect = wrapper.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > vh) return;
            advanceCardSlideshow(wrapper);
        });
    }, TICK_MS);
})();

async function renderSection(endpoint, containerId, params = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const lang = navigator.language || 'es-MX';
        const response = await fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&language=${lang}${params}`);
        const data = await response.json();
        
        if (data.results) {
            const validItems = data.results.filter(item => item.poster_path || item.profile_path).slice(0, 12);

            const isHorizontal = containerId !== 'trending-people-list';

            // Parallel details fetch for every card — no more "Show More" defer/pagination
            let detailedInitialItems = [];
            if (isHorizontal) {
                detailedInitialItems = await Promise.all(validItems.map(async (item) => {
                    const type = item.media_type || (endpoint.includes('tv') ? 'tv' : 'movie');
                    try {
                        // images (sin idioma o en inglés) alimenta el slideshow del póster de la tarjeta
                        const res = await fetch(`https://api.themoviedb.org/3/${type}/${item.id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=credits,images&include_image_language=null,en,es`);
                        const details = await res.json();
                        return { ...item, details, type };
                    } catch (err) {
                        console.error("Error fetching detailed info", err);
                        return { ...item, type };
                    }
                }));
            } else {
                detailedInitialItems = validItems.map(item => ({ ...item, type: 'person' }));
            }

            const generateCardHTML = (item, index) => {
                const title = item.title || item.name;
                const posterPath = item.poster_path || item.profile_path;
                const poster = posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : '';
                const type = item.type;
                
                if (isHorizontal) {
                    const overview = item.details?.overview || item.overview || 'No description available.';
                    const backdropPath = item.details?.backdrop_path || item.backdrop_path || '';
                    const rating = item.details?.vote_average || item.vote_average || 0;
                    const ratingPercent = Math.round(rating * 10);
                    const ratingText = rating > 0 ? rating.toFixed(1) : 'NR';
                    
                    let metaLine = '';
                    if (type === 'movie') {
                        const director = item.details?.credits?.crew?.find(person => person.job === 'Director');
                        if (director) {
                            metaLine = `Directed by: ${director.name}`;
                        } else {
                            const date = item.release_date || item.first_air_date;
                            const year = date ? date.split('-')[0] : '';
                            metaLine = year ? `Released: ${year}` : '';
                        }
                    } else if (type === 'tv') {
                        const creators = item.details?.created_by;
                        if (creators && creators.length > 0) {
                            metaLine = `Created by: ${creators.map(c => c.name).join(', ')}`;
                        } else {
                            const date = item.first_air_date || item.release_date;
                            const year = date ? date.split('-')[0] : '';
                            metaLine = year ? `First Aired: ${year}` : '';
                        }
                    }
                    
                    let genreTags = '';
                    if (item.details?.genres) {
                        genreTags = item.details.genres.slice(0, 2).map(g => `
                            <span class="genre-badge">${g.name}</span>
                        `).join('');
                    }
                    
                    const backdropUrl = backdropPath ? `https://image.tmdb.org/t/p/w780${backdropPath}` : '';
                    // La primera tarjeta es el destacado horizontal: prioriza fotogramas
                    const slides = buildCardSlides(item, posterPath, index === 0);

                    return `
                        <div class="media-card-horizontal" data-id="${item.id}" data-type="${type}" data-title="${title.replace(/"/g, '&quot;')}">
                            <div class="card-backdrop" style="background-image: url(${backdropUrl});"></div>
                            <div class="card-overlay"></div>
                            
                            <div class="card-poster-wrapper"${slides.length > 1 ? ' data-slideshow' : ''}>
                                <img src="${slides[0] || poster}" alt="${title}" class="card-poster card-slide is-active" loading="lazy">
                                ${slides.slice(1).map(url => `<img data-src="${url}" alt="" aria-hidden="true" class="card-poster card-slide" decoding="async">`).join('')}
                                ${slides.length > 1 ? `<div class="card-slide-dots" aria-hidden="true">${slides.map((_, i) => `<span${i === 0 ? ' class="is-active"' : ''}></span>`).join('')}</div>` : ''}
                            </div>
                            
                            <div class="card-content">
                                <h3 class="card-title">${title}</h3>
                                ${metaLine ? `<p class="card-meta-line">${metaLine}</p>` : ''}
                                <p class="card-overview">${overview}</p>
                                <div class="card-genres">
                                    ${genreTags}
                                </div>
                            </div>
                            
                            <div class="card-rating-wrapper">
                                <div class="rating-circle-container">
                                    <svg class="rating-svg" viewBox="0 0 36 36">
                                        <path class="rating-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                        <path class="rating-circle" stroke-dasharray="${ratingPercent}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    </svg>
                                    <div class="rating-number">${ratingText}</div>
                                </div>
                                <span class="rating-source">IMDb</span>
                            </div>
                        </div>
                    `;
                } else {
                    let extraInfo = '';
                    const knownFor = item.known_for_department ? item.known_for_department : 'Acting';
                    extraInfo = `<p class="media-card-extra">${knownFor}</p>`;

                    return `
                        <div class="media-card" data-id="${item.id}" data-type="${type}" data-title="${title.replace(/"/g, '&quot;')}">
                            <img src="${poster}" alt="${title}" loading="lazy">
                            <div class="title-overlay">
                                <span class="media-card-title">${title}</span>
                                ${extraInfo}
                            </div>
                        </div>
                    `;
                }
            };

            container.innerHTML = detailedInitialItems.map(generateCardHTML).join('');

            const attachListenerToCard = (card) => {
                card.addEventListener('click', async () => {
                    const id = card.dataset.id;
                    const type = card.dataset.type;
                    const title = card.dataset.title;
                    
                    if (searchInput) {
                        searchInput.value = title;
                    }

                    saveCurrentState();
                    window.scrollTo({ top: 30, behavior: 'smooth' });
                    
                    try {
                        const lang = navigator.language || 'es-MX';
                        if (type === 'person') {
                            const detailsRes = await fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=combined_credits,external_ids`);
                            const details = await detailsRes.json();
                            renderPersonDetails(details);
                        } else {
                            const detailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,external_ids,videos,images,watch/providers`);
                            const details = await detailsRes.json();
                            renderMovieDetails(details, type);
                        }
                    } catch(err) {
                        console.error(err);
                    }
                });
            };

            const cardsSelector = isHorizontal ? '.media-card-horizontal' : '.media-card';
            container.querySelectorAll(cardsSelector).forEach(attachListenerToCard);
        }
    } catch (error) {
        console.error("Error al cargar la sección " + containerId, error);
    }
}

const industryNewsData = [
    {
        category: "Production",
        date: "June 9, 2026",
        title: "Spider-Man 4 Begins Production: Tom Holland Returns",
        description: "Sony Pictures and Marvel Studios have officially kicked off filming for Spider-Man 4. Tom Holland and Zendaya are back, with Destin Daniel Cretton stepping in as director for this new trilogy opener.",
        image: "https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=600&auto=format&fit=crop",
        link: "https://www.themoviedb.org/movie/939243-spider-man-4"
    },
    {
        category: "Release Date",
        date: "June 8, 2026",
        title: "Dune: Messiah Target Release Set for December 2026",
        description: "Warner Bros. has added a Denis Villeneuve event film to its December 2026 release calendar. Insiders confirm this is Dune: Messiah, which will wrap up Paul Atreides' story.",
        image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
        link: "https://www.themoviedb.org/search?query=dune"
    },
    {
        category: "Streaming",
        date: "June 6, 2026",
        title: "Wednesday Season 2 Teaser: Jenna Ortega Returns to Nevermore",
        description: "Netflix has dropped the first teaser trailer for Wednesday Season 2. Jenna Ortega returns as Wednesday Addams, dealing with new mysteries, new teachers, and more gothic mayhem.",
        image: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=600&auto=format&fit=crop",
        link: "https://www.themoviedb.org/tv/119051-wednesday"
    },
    {
        category: "Casting",
        date: "June 4, 2026",
        title: "Christopher Nolan's Next Epic Adds Robert Pattinson and Lupita Nyong'o",
        description: "Universal Pictures is rounding out the stellar cast of Christopher Nolan's top-secret next feature film. Robert Pattinson and Lupita Nyong'o are the latest to join alongside Matt Damon.",
        image: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=600&auto=format&fit=crop",
        link: "https://www.themoviedb.org/person/11288-christopher-nolan"
    }
];

// Placeholder cards shown while a section is still fetching.
function renderSkeletons(container, count, variant) {
    if (!container) return;
    container.innerHTML = Array.from({ length: count }).map(() => `
        <div class="skeleton-card skeleton-card--${variant}">
            <div class="skeleton-block skeleton-card__media"></div>
            <div class="skeleton-card__body">
                <div class="skeleton-block skeleton-line skeleton-line--meta"></div>
                <div class="skeleton-block skeleton-line skeleton-line--title"></div>
                <div class="skeleton-block skeleton-line"></div>
                <div class="skeleton-block skeleton-line"></div>
                <div class="skeleton-block skeleton-line skeleton-line--short"></div>
            </div>
        </div>
    `).join('');
}

function estimateReadingTime(text) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
}

async function loadIndustryNews() {
    const container = document.getElementById('industry-news-list');
    if (!container) return;

    container.className = "news-grid-home";
    renderSkeletons(container, 6, 'news');

    let newsList = industryNewsData;

    try {
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fvariety.com%2Fv%2Ffilm%2Ffeed%2F`);
        if (res.ok) {
            const feedData = await res.json();
            if (feedData.items && feedData.items.length > 0) {
                newsList = feedData.items.slice(0, 10).map(item => {
                    const category = item.categories && item.categories.length > 0 ? item.categories[0] : "Cinema";
                    
                    let formattedDate = item.pubDate;
                    try {
                        const dateObj = new Date(item.pubDate);
                        formattedDate = dateObj.toLocaleDateString(navigator.language || 'es-MX', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    } catch(e) {
                        console.error(e);
                    }
                    
                    let cleanDesc = item.description || "";
                    cleanDesc = cleanDesc.replace(/<[^>]*>/g, '');
                    cleanDesc = cleanDesc.replace(/\[\u2026\]/g, '...');
                    
                    return {
                        category: category,
                        date: formattedDate,
                        title: item.title,
                        description: cleanDesc,
                        image: item.thumbnail || item.enclosure?.link || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop',
                        link: item.link,
                        author: item.author || '',
                        source: feedData.feed?.title || 'Variety',
                        tags: (item.categories || []).slice(0, 3)
                    };
                });
            }
        }
    } catch(err) {
        console.warn("Failed to fetch external news feed, falling back to local news", err);
    }
    
    container.className = "news-grid-home";
    currentNewsList = newsList;
    container.innerHTML = newsList.map((news, index) => {
        const tags = (news.tags || []).filter(t => t && t !== news.category);
        const readMins = estimateReadingTime(news.description);
        return `
        <article class="news-card-home" data-news-index="${index}" tabindex="0" role="button" aria-label="Read article: ${escapeAttr(news.title)}">
            <div class="news-card-image" style="background-image: url('${news.image}')">
                <span class="news-card-category">${news.category}</span>
            </div>
            <div class="news-card-content">
                <div class="news-card-meta">
                    <span class="news-card-source">${news.source || 'PostCredits'}</span>
                    <span class="news-card-dot">•</span>
                    <span class="news-card-date">${news.date}</span>
                    <span class="news-card-dot">•</span>
                    <span class="news-card-read">${readMins} min de lectura</span>
                </div>
                <h3 class="news-card-title">${news.title}</h3>
                <p class="news-card-description">${news.description}</p>
                ${tags.length ? `<div class="news-card-tags">${tags.map(t => `<span class="news-tag">${t}</span>`).join('')}</div>` : ''}
                <div class="news-card-footer">
                    ${news.author ? `<span class="news-card-author">Por ${news.author}</span>` : '<span class="news-card-author"></span>'}
                    <span class="news-card-readmore">Leer nota →</span>
                </div>
            </div>
        </article>
    `;
    }).join('');

    container.querySelectorAll('.news-card-home[data-news-index]').forEach(card => {
        const open = () => openNewsReader(currentNewsList[Number(card.dataset.newsIndex)]);
        card.addEventListener('click', open);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });
    });

    const nextEl = container.nextElementSibling;
    if (nextEl && nextEl.classList.contains('expand-btn-container')) {
        nextEl.remove();
    }
}

// --- Lector de noticias dentro de la web ---
// El RSS solo trae un extracto; el texto completo sale de la API REST de WordPress del
// medio (Variety la expone con CORS abierto). El HTML recibido se reconstruye con una
// lista blanca de etiquetas antes de insertarlo.
let currentNewsList = [];
let newsReaderRequest = 0;

function escapeAttr(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHTML(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getWordPressPostApi(link) {
    try {
        const url = new URL(link);
        const match = url.pathname.match(/-(\d{6,})\/?$/);
        if (!match) return null;
        return `${url.origin}/wp-json/wp/v2/posts/${match[1]}?_fields=content,title`;
    } catch (e) {
        return null;
    }
}

function sanitizeArticleHTML(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const ALLOWED = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'STRONG', 'EM', 'B', 'I', 'A', 'IMG', 'FIGURE', 'FIGCAPTION', 'BR']);
    const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'NOSCRIPT', 'FORM', 'BUTTON', 'SVG', 'OBJECT', 'EMBED', 'VIDEO', 'AUDIO', 'INPUT', 'SELECT', 'TEXTAREA']);
    const out = document.createElement('div');

    const toSafeUrl = (value) => {
        try {
            const url = new URL(value, baseUrl);
            return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : null;
        } catch (e) {
            return null;
        }
    };

    const walk = (node, parent) => {
        node.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                parent.appendChild(document.createTextNode(child.textContent));
                return;
            }
            if (child.nodeType !== Node.ELEMENT_NODE || DROP.has(child.tagName)) return;
            if (!ALLOWED.has(child.tagName)) {
                walk(child, parent); // desenvuelve contenedores (div, span, section...)
                return;
            }

            const el = document.createElement(child.tagName.toLowerCase());
            if (child.tagName === 'A') {
                const href = toSafeUrl(child.getAttribute('href') || '');
                if (href) {
                    el.href = href;
                    el.target = '_blank';
                    el.rel = 'noopener noreferrer';
                }
            } else if (child.tagName === 'IMG') {
                const src = toSafeUrl(child.getAttribute('data-lazy-src') || child.getAttribute('src') || '');
                if (!src) return;
                el.src = src;
                el.alt = child.getAttribute('alt') || '';
                el.loading = 'lazy';
                el.decoding = 'async';
                parent.appendChild(el);
                return;
            }

            walk(child, el);
            if (child.tagName !== 'BR' && !el.textContent.trim() && !el.querySelector('img')) return;
            parent.appendChild(el);
        });
    };

    walk(doc.body, out);
    return out;
}

function renderNewsReaderShell(news) {
    const scroll = document.getElementById('news-reader-scroll');
    const readMins = estimateReadingTime(news.description);
    const tags = (news.tags || []).filter(t => t && t !== news.category);
    document.getElementById('news-reader-source').textContent = news.source || 'PostCredits';
    document.getElementById('news-reader-category').textContent = news.category || 'News';

    scroll.innerHTML = `
        <div class="news-reader__hero">
            <img src="${escapeAttr(news.image)}" alt="" class="news-reader__hero-img">
            <span class="news-reader__chip">${escapeHTML(news.category)}</span>
        </div>
        <div class="news-reader__inner">
            <h1 class="news-reader__title" id="news-reader-title">${escapeHTML(news.title)}</h1>
            <div class="news-reader__meta">
                ${news.author ? `<span>Por <strong>${escapeHTML(news.author)}</strong></span><span class="news-card-dot">•</span>` : ''}
                <span>${escapeHTML(news.date)}</span>
                <span class="news-card-dot">•</span>
                <span id="news-reader-readtime">${readMins} min de lectura</span>
            </div>
            <p class="news-reader__lead">${escapeHTML(news.description)}</p>
            <div class="news-reader__body" id="news-reader-body" aria-busy="true">
                <div class="skeleton-block skeleton-line"></div>
                <div class="skeleton-block skeleton-line"></div>
                <div class="skeleton-block skeleton-line skeleton-line--short"></div>
                <div class="skeleton-block skeleton-line"></div>
                <div class="skeleton-block skeleton-line skeleton-line--short"></div>
            </div>
            ${tags.length ? `<div class="news-card-tags news-reader__tags">${tags.map(t => `<span class="news-tag">${escapeHTML(t)}</span>`).join('')}</div>` : ''}
            <div class="news-reader__footer">
                <span class="news-reader__credit">Fuente: ${escapeHTML(news.source || 'PostCredits')}</span>
                ${news.link ? `<a class="news-reader__source-btn" href="${escapeAttr(news.link)}" target="_blank" rel="noopener noreferrer">Ver en ${escapeHTML(news.source || 'la fuente')} ↗</a>` : ''}
            </div>
        </div>
    `;
    scroll.scrollTop = 0;
}

async function openNewsReader(news) {
    const reader = document.getElementById('news-reader');
    if (!reader || !news) return;

    renderNewsReaderShell(news);
    reader.classList.add('active');
    reader.setAttribute('aria-hidden', 'false');
    document.body.classList.add('news-reader-open');
    setTimeout(() => reader.querySelector('.news-reader__panel')?.focus({ preventScroll: true }), 50);

    const requestId = ++newsReaderRequest;
    const body = document.getElementById('news-reader-body');
    const api = news.link ? getWordPressPostApi(news.link) : null;

    const showExcerptOnly = () => {
        if (requestId !== newsReaderRequest || !body) return;
        body.removeAttribute('aria-busy');
        body.innerHTML = '<p class="news-reader__notice">No pudimos traer el texto completo de esta nota. Podés leerla en la fuente original.</p>';
    };

    if (!api) {
        showExcerptOnly();
        return;
    }

    try {
        const res = await fetch(api);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const post = await res.json();
        if (requestId !== newsReaderRequest) return;

        const article = sanitizeArticleHTML(post?.content?.rendered || '', news.link);
        if (!article.textContent.trim()) {
            showExcerptOnly();
            return;
        }

        body.removeAttribute('aria-busy');
        body.innerHTML = '';
        body.append(...article.childNodes);

        // El extracto del RSS suele ser el primer párrafo: no mostrarlo dos veces
        const lead = document.querySelector('.news-reader__lead');
        const firstP = body.querySelector('p');
        const norm = (t) => t.replace(/\s+/g, ' ').trim().slice(0, 60);
        if (lead && firstP && norm(firstP.textContent) === norm(lead.textContent)) {
            lead.remove();
        }
        const readTime = document.getElementById('news-reader-readtime');
        if (readTime) readTime.textContent = `${estimateReadingTime(body.textContent)} min de lectura`;
    } catch (err) {
        console.warn('Could not load full article', err);
        showExcerptOnly();
    }
}

function closeNewsReader() {
    const reader = document.getElementById('news-reader');
    if (!reader || !reader.classList.contains('active')) return;
    newsReaderRequest++;
    reader.classList.remove('active');
    reader.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('news-reader-open');
}

(function initNewsReader() {
    const reader = document.getElementById('news-reader');
    if (!reader) return;
    reader.addEventListener('click', (e) => {
        if (e.target.closest('[data-news-close]')) closeNewsReader();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeNewsReader();
    });
    enableSheetSwipe(reader.querySelector('.news-reader__panel'), closeNewsReader);
})();

async function loadPopularTrailers() {
    const container = document.getElementById('popular-trailers-list');
    if (!container) return;

    container.className = "media-grid-trailers";
    renderSkeletons(container, 6, 'trailer');

    try {
        const lang = navigator.language || 'es-MX';
        const response = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=${lang}&page=1`);
        const data = await response.json();
        
        if (data.results) {
            const movies = data.results.filter(m => m.backdrop_path).slice(0, 15);
            
            const trailers = await Promise.all(movies.map(async (movie) => {
                try {
                    const videoRes = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${TMDB_API_KEY}&language=en-US`);
                    const videoData = await videoRes.json();
                    const ytVideos = (videoData.results || []).filter(v => v.site === 'YouTube');
                    const trailer = ytVideos.find(v => v.type === 'Trailer' || v.type === 'Teaser');
                    if (trailer) {
                        return {
                            movieTitle: movie.title,
                            trailerName: trailer.name,
                            key: trailer.key,
                            type: trailer.type,
                            publishedAt: trailer.published_at || '',
                            videoCount: ytVideos.length,
                            overview: movie.overview || '',
                            year: (movie.release_date || '').split('-')[0],
                            rating: movie.vote_average || 0,
                            backdrop: `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`
                        };
                    }
                } catch (err) {
                    console.error("Error fetching video for movie " + movie.id, err);
                }
                return null;
            }));
            
            const validTrailers = trailers.filter(t => t !== null).slice(0, 12);
            
            if (validTrailers.length > 0) {
                container.className = "media-grid-trailers";
                container.innerHTML = validTrailers.map(t => {
                    let publishedStr = '';
                    if (t.publishedAt) {
                        try {
                            publishedStr = new Date(t.publishedAt).toLocaleDateString(navigator.language || 'es-MX', {
                                year: 'numeric', month: 'short', day: 'numeric'
                            });
                        } catch (e) {
                            publishedStr = '';
                        }
                    }
                    const ratingStr = t.rating > 0 ? t.rating.toFixed(1) : 'NR';
                    return `
                        <article class="trailer-card" tabindex="0" role="button" aria-label="Play trailer: ${t.movieTitle.replace(/"/g, '&quot;')}"
                            data-video-key="${t.key}"
                            data-video-title="${t.movieTitle.replace(/"/g, '&quot;')}"
                            data-video-sub="${t.trailerName.replace(/"/g, '&quot;')}"
                            data-video-overview="${(t.overview || '').replace(/"/g, '&quot;')}"
                            data-video-year="${t.year || ''}"
                            data-video-rating="${ratingStr}">
                            <div class="trailer-card-thumb">
                                <img src="${t.backdrop}" alt="${t.movieTitle.replace(/"/g, '&quot;')}" loading="lazy">
                                <span class="trailer-card-type">${(t.type || 'Trailer').toUpperCase()}</span>
                                <div class="trailer-card-play-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                </div>
                            </div>
                            <div class="trailer-card-body">
                                <h3 class="trailer-card-title">${t.movieTitle}</h3>
                                <p class="trailer-card-subtitle">${t.trailerName}</p>
                                <div class="trailer-card-meta">
                                    ${t.year ? `<span>${t.year}</span><span class="trailer-card-dot">•</span>` : ''}
                                    <span class="trailer-card-rating">★ ${ratingStr}</span>
                                    ${publishedStr ? `<span class="trailer-card-dot">•</span><span>${publishedStr}</span>` : ''}
                                </div>
                                ${t.overview ? `<p class="trailer-card-overview">${t.overview}</p>` : ''}
                                <div class="trailer-card-footer">
                                    <span class="trailer-card-count">${t.videoCount} video${t.videoCount === 1 ? '' : 's'} en YouTube</span>
                                    <span class="trailer-card-cta">Ver trailer →</span>
                                </div>
                            </div>
                        </article>
                    `;
                }).join('');
                
                container.querySelectorAll('.trailer-card[data-video-key]').forEach(card => {
                    card.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            card.click();
                        }
                    });
                    card.addEventListener('click', () => {
                        playVideoInline(card.querySelector('.trailer-card-thumb'), card.dataset.videoKey, {
                            card,
                            title: card.dataset.videoTitle || ''
                        });
                    });
                });

                const nextEl = container.nextElementSibling;
                if (nextEl && nextEl.classList.contains('expand-btn-container')) {
                    nextEl.remove();
                }
            } else {
                container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: rgba(255,255,255,0.4);">No trailers found.</p>';
            }
        }
    } catch (error) {
        console.error("Error loading popular trailers", error);
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: rgba(255,255,255,0.4);">Error loading trailers.</p>';
    }
}

async function loadDefaultContent() {
    const region = (navigator.language || 'es-MX').split('-')[1] || 'US';
    // Cargar en cines (Now Playing)
    await renderSection('movie/now_playing', 'now-playing-list', `&region=${region}&page=1`);
    // Cargar películas en tendencia
    await renderSection('trending/movie/week', 'trending-movies-list');
    // Cargar series en tendencia
    await renderSection('trending/tv/week', 'trending-tv-list');
    // Cargar trailers populares
    await loadPopularTrailers();
    // Cargar noticias de la industria
    loadIndustryNews();
}

// Iniciar la carga del contenido principal
loadDefaultContent();

// --- Search Functionality (Dynamic) ---
if (searchForm) {
    searchForm.addEventListener('submit', (e) => e.preventDefault());
}

let searchTimeout;

// --- Navigation History ---
let appHistory = [];
let savedState = null;

window.saveCurrentState = function() {
    savedState = {
        scrollY: window.scrollY,
        searchValue: searchInput ? searchInput.value : ''
    };
};

window.pushNavState = function() {
    if (!savedState) return;
    const main = document.getElementById('main-content');
    const isHome = !!main.querySelector('#now-playing-list');
    const container = document.createElement('div');
    while (main.firstChild) {
        container.appendChild(main.firstChild);
    }
    
    const settingsBtn = document.getElementById('settings-backdrop-btn');
    const labelEl = document.getElementById('backdrop-label');
    
    appHistory.push({
        node: container,
        scrollY: savedState.scrollY,
        searchValue: savedState.searchValue,
        isHome: isHome,
        activeTab: document.body.dataset.activeTab || 'home',
        searchActive: document.body.classList.contains('search-active'),
        backdrops: typeof backdrops !== 'undefined' ? [...backdrops] : [],
        originalBackdrops: typeof originalBackdrops !== 'undefined' ? [...originalBackdrops] : [],
        settingsBtnDisplay: settingsBtn ? settingsBtn.style.display : '',
        labelContent: labelEl ? labelEl.textContent : ''
    });
    savedState = null;
};

window.goBack = function() {
    if (appHistory.length > 0) {
        const prevState = appHistory.pop();
        const main = document.getElementById('main-content');
        main.innerHTML = '';
        while (prevState.node.firstChild) {
            main.appendChild(prevState.node.firstChild);
        }
        
        if (prevState.isHome) {
            enterHomeMode();
            bindTabViewport(prevState.activeTab || 'home');
            if (searchInput) {
                searchInput.value = '';
                searchInput.blur();
            }
            const searchHistoryContainer = document.getElementById('search-history');
            if (searchHistoryContainer) {
                searchHistoryContainer.classList.remove('active');
            }
            fetchLatestBackdrops();
        } else {
            enterDetailMode();
            if (prevState.searchActive) {
                document.body.classList.add('search-active');
            }
            if (searchInput) {
                searchInput.value = prevState.searchValue;
            }
            if (prevState.backdrops && prevState.backdrops.length > 0) {
                backdrops = prevState.backdrops;
                originalBackdrops = prevState.originalBackdrops || [...prevState.backdrops];
                updateOrderControlsVisibility();
                initCarousel();
                const settingsBtn = document.getElementById('settings-backdrop-btn');
                if (settingsBtn) settingsBtn.style.display = prevState.settingsBtnDisplay;
                const labelEl = document.getElementById('backdrop-label');
                if (labelEl) labelEl.textContent = prevState.labelContent;
            }
            // Detail pages use normal document scroll; the tabbed home layout doesn't (each
            // tab panel scrolls on its own), so only restore document scrollY for detail pages.
            window.scrollTo({ top: prevState.scrollY, behavior: 'instant' });
        }
    } else {
        restoreHome();
    }
};

window.restoreHome = function() {
    appHistory = [];
    const main = document.getElementById('main-content');
    if (searchInput) {
        searchInput.value = '';
        searchInput.blur();
    }
    const searchHistoryContainer = document.getElementById('search-history');
    if (searchHistoryContainer) {
        searchHistoryContainer.classList.remove('active');
    }
    main.innerHTML = `
        <div class="tab-viewport" id="tab-viewport">
            <section class="tab-panel tab-panel--home" data-tab="home" id="tab-panel-home">
                <header class="hero-header" data-header>
                    <div class="hero-header__glow" aria-hidden="true"></div>
                    <div class="hero-header__content">
                        <div class="hero-header__title-wrapper">
                            <h1 class="hero-header__title">
                                <span>Post</span>
                                <span>Credits</span>
                            </h1>
                            <p class="hero-header__now" id="hero-now">
                                <span class="hero-header__now-label" id="hero-now-label">Now Showing</span>
                                <span class="hero-header__now-title" id="hero-now-title"></span>
                            </p>
                        </div>
                        <div class="backdrop-controls" data-backdrop-controls role="toolbar" aria-label="Backdrop controls"></div>
                    </div>
                </header>
            </section>
            <section class="tab-panel" data-tab="media" id="tab-panel-media">
                <div class="tab-panel-inner">
                    <section class="media-section"><h2 class="section-title">In Theaters Near You</h2><div class="media-grid" id="now-playing-list"></div></section>
                    <section class="media-section"><h2 class="section-title">Trending Movies</h2><div class="media-grid" id="trending-movies-list"></div></section>
                    <section class="media-section"><h2 class="section-title">Latest Series</h2><div class="media-grid" id="trending-tv-list"></div></section>
                    <section class="links-section">
                        <h2 class="section-title">Explore More</h2>
                        <div class="links-grid">
                            <a href="https://www.themoviedb.org/" target="_blank" class="external-link tmdb" title="The Movie Database">
                                <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB">
                            </a>
                            <a href="https://letterboxd.com/" target="_blank" class="external-link letterboxd" title="Letterboxd">
                                <img src="https://a.ltrbxd.com/logos/letterboxd-logo-h-neg-rgb-1000px.png" alt="Letterboxd">
                            </a>
                            <a href="https://www.imdb.com/" target="_blank" class="external-link imdb" title="IMDb">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/6/69/IMDB_Logo_2016.svg" alt="IMDb">
                            </a>
                            <a href="https://www.rottentomatoes.com/" target="_blank" class="external-link rotten" title="Rotten Tomatoes">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/5/5b/Rotten_Tomatoes.svg" alt="Rotten Tomatoes">
                            </a>
                        </div>
                    </section>
                    <div class="global-ads-container" style="width: 100%; padding: 20px; display: flex; flex-direction: row; flex-wrap: nowrap; overflow-x: auto; justify-content: center; align-items: center; gap: 24px; z-index: 10; position: relative; scrollbar-width: none;">
                        <script async="async" data-cfasync="false" src="https://pl29579098.effectivecpmnetwork.com/5b59996c51c718c2f6769a412bd6c106/invoke.js"></script>
                        <div id="container-5b59996c51c718c2f6769a412bd6c106"></div>
                    </div>
                    <footer class="site-credits footer-credits">
                        Developed by <a href="https://www.diegogarcia-dev.com.ar" target="_blank">dg-dev</a>
                    </footer>
                </div>
            </section>
            <section class="tab-panel" data-tab="trailers" id="tab-panel-trailers">
                <div class="tab-panel-inner">
                    <section class="media-section"><h2 class="section-title">Popular Trailers</h2><div class="media-grid-trailers" id="popular-trailers-list"></div></section>
                </div>
            </section>
            <section class="tab-panel" data-tab="news" id="tab-panel-news">
                <div class="tab-panel-inner">
                    <section class="media-section"><h2 class="section-title">Latest Industry News</h2><div class="news-grid-home" id="industry-news-list"></div></section>
                </div>
            </section>
        </div>
    `;
    renderBackdropControls();
    enterHomeMode();
    bindTabViewport();
    loadDefaultContent();
    fetchLatestBackdrops();
}

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchTimeout);
        const main = document.getElementById('main-content');

        if (!query) {
            restoreHome();
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                appHistory = [];
                window.scrollTo({ top: 30, behavior: 'smooth' });
                const lang = navigator.language || 'es-MX';
                const searchRes = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=${lang}&query=${encodeURIComponent(query)}&page=1`);
                const searchData = await searchRes.json();

                if (searchData.results && searchData.results.length > 0) {
                    const results = searchData.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv' || r.media_type === 'person');
                    
                    if (results.length > 0) {
                        const html = `
                            <section class="media-section">
                                <h2 class="section-title">Results for "${query}"</h2>
                                <div class="search-results-grid">
                                    ${results.map(item => {
                                        const title = item.title || item.name;
                                        const posterPath = item.poster_path || item.profile_path;
                                        const poster = posterPath ? `https://image.tmdb.org/t/p/w200${posterPath}` : 'https://via.placeholder.com/200x300?text=No+Photo';
                                        
                                        let metaText = item.media_type === 'movie' ? 'Movie' : (item.media_type === 'tv' ? 'TV Show' : 'Person');
                                        const date = item.release_date || item.first_air_date;
                                        if (date) {
                                            metaText += ` • ${date.split('-')[0]}`;
                                        }

                                        let overview = item.overview || '';
                                        if (item.media_type === 'person') {
                                            overview = item.known_for ? item.known_for.map(k => k.title || k.name).join(', ') : 'No description.';
                                            if (!overview) overview = 'No description.';
                                        } else if (!overview) {
                                            overview = 'No description available.';
                                        }

                                        return `
                                            <div class="search-result-card" data-id="${item.id}" data-type="${item.media_type}" data-title="${title.replace(/"/g, '&quot;')}">
                                                <div class="search-result-poster">
                                                    <img src="${poster}" alt="${title}" loading="lazy">
                                                </div>
                                                <div class="search-result-info">
                                                    <h3 class="search-result-title">${title}</h3>
                                                    <span class="search-result-meta">${metaText}</span>
                                                    <p class="search-result-overview">${overview}</p>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </section>
                        `;
                        enterSearchMode();
                        main.innerHTML = html;

                        // Add click listeners to load details
                        main.querySelectorAll('.search-result-card').forEach(card => {
                            card.addEventListener('click', async () => {
                                const id = card.dataset.id;
                                const type = card.dataset.type;
                                const title = card.dataset.title;
                                
                                if (searchInput) {
                                    searchInput.value = title;
                                }
                                addToHistory(query);

                                saveCurrentState();
                                window.scrollTo({ top: 30, behavior: 'smooth' });
                                try {
                                    if (type === 'person') {
                                        const detailsRes = await fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=combined_credits,external_ids`);
                                        const details = await detailsRes.json();
                                        renderPersonDetails(details);
                                    } else {
                                        const detailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,external_ids,videos,images,watch/providers`);
                                        const details = await detailsRes.json();
                                        renderMovieDetails(details, type);
                                    }
                                } catch(err) {
                                    console.error(err);
                                }
                            });
                        });
                    } else {
                        enterSearchMode();
                        main.innerHTML = `<h2 style="color:white;text-align:center;margin-top:50px;">No results found for "${query}"</h2>`;
                    }
                } else {
                    enterSearchMode();
                    main.innerHTML = `<h2 style="color:white;text-align:center;margin-top:50px;">No results found for "${query}"</h2>`;
                }
            } catch (error) {
                console.error("Error en la búsqueda:", error);
            }
        }, 400); // 400ms debounce
    });
}

function renderMovieDetails(details, mediaType) {
    pushNavState();
    enterDetailMode();
    const main = document.getElementById('main-content');

    const title = details.title || details.name;
    const year = (details.release_date || details.first_air_date || '').split('-')[0];
    const poster = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : 'https://via.placeholder.com/300x450?text=No+Poster';
    
    // Meta data
    const runtimeStr = details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : (details.episode_run_time && details.episode_run_time[0] ? `${details.episode_run_time[0]}m` : '');
    const language = details.spoken_languages && details.spoken_languages.length > 0 ? details.spoken_languages[0].english_name : (details.original_language ? details.original_language.toUpperCase() : '');

    let directorText = '';
    if (mediaType === 'tv' && details.created_by && details.created_by.length > 0) {
        const creatorsHTML = details.created_by.map(c => `<span class="clickable-person" data-id="${c.id}">${c.name}</span>`).join(', ');
        directorText = `Created by ${creatorsHTML}`;
    } else if (details.credits && details.credits.crew) {
        const dirObj = details.credits.crew.find(c => c.job === 'Director' || c.job === 'Executive Producer' || c.job === 'Series Director');
        if (dirObj) {
            directorText = `Director by <span class="clickable-person" data-id="${dirObj.id}">${dirObj.name}</span>`;
        }
    }

    const ratingRaw = details.vote_average || 0;
    const ratingStr = ratingRaw > 0 ? ratingRaw.toFixed(1) : 'NR';

    // Watch Providers
    let watchProvidersHTML = '';
    if (details['watch/providers'] && details['watch/providers'].results) {
        const provs = details['watch/providers'].results;
        const userCountry = (navigator.language || 'es-MX').split('-')[1] || 'US';
        const data = provs[userCountry] || provs['US'] || Object.values(provs).find(p => p.flatrate || p.buy || p.rent);
        
        if (data) {
            const list = data.flatrate || data.buy || data.rent || [];
            const watchLink = data.link || `https://www.justwatch.com/search?q=${encodeURIComponent(title)}`;
            if (list.length > 0) {
                const seen = new Set();
                const uniqueList = [];
                for (const p of list) {
                    if (!seen.has(p.provider_id)) {
                        seen.add(p.provider_id);
                        uniqueList.push(p);
                    }
                }
                watchProvidersHTML = `
                    <div class="hero-watch-providers">
                        <span>AVAILABLE ON:</span>
                        <div class="provider-logos-row">
                            ${uniqueList.slice(0, 6).map(p => `
                                <a href="${watchLink}" target="_blank" rel="noopener noreferrer" title="Watch on ${p.provider_name}" class="provider-logo-link">
                                    <img src="https://image.tmdb.org/t/p/w92${p.logo_path}" alt="${p.provider_name}" class="provider-logo">
                                </a>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }
    }

    // Enlaces externos
    const imdbLink = details.external_ids && details.external_ids.imdb_id ? `<a href="https://www.imdb.com/title/${details.external_ids.imdb_id}" target="_blank" class="link-btn imdb" title="IMDb"><img src="https://upload.wikimedia.org/wikipedia/commons/6/69/IMDB_Logo_2016.svg" alt="IMDb"></a>` : '';
    let letterboxdLink = '';
    if (mediaType === 'movie') {
        letterboxdLink = `<a href="https://letterboxd.com/tmdb/${details.id}" target="_blank" class="link-btn letterboxd" title="Letterboxd"><img src="https://a.ltrbxd.com/logos/letterboxd-logo-h-neg-rgb-1000px.png" alt="Letterboxd"></a>`;
    }
    const tmdbLink = `<a href="https://www.themoviedb.org/${mediaType}/${details.id}" target="_blank" class="link-btn tmdb-link" title="TMDB"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB"></a>`;
    const favClass = isFavorite(details.id) ? 'active' : '';
    const favButton = `<button class="fav-btn ${favClass}" id="fav-btn" data-id="${details.id}" title="Toggle Favorite"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></button>`;

    // Media (Trailers & Captures in 3x3 Grid)
    let mediaItems = [];
    if (details.videos && details.videos.results) {
        const ytVideos = details.videos.results.filter(v => v.site === 'YouTube').slice(0, 3);
        ytVideos.forEach(v => {
            mediaItems.push({
                type: 'video',
                key: v.key,
                title: v.name,
                thumbnail: `https://img.youtube.com/vi/${v.key}/mqdefault.jpg`
            });
        });
    }
    if (details.images && details.images.backdrops) {
        const needed = 9 - mediaItems.length;
        const bToUse = details.images.backdrops.slice(0, needed);
        bToUse.forEach((b, idx) => {
            mediaItems.push({
                type: 'image',
                url: `https://image.tmdb.org/t/p/w780${b.file_path}`,
                fullUrl: `https://image.tmdb.org/t/p/w1280${b.file_path}`,
                title: `Capture ${idx + 1}`
            });
        });
    }

    if (mediaItems.length === 0) {
        mediaItems.push({
            type: 'image',
            url: details.backdrop_path ? `https://image.tmdb.org/t/p/w780${details.backdrop_path}` : poster,
            fullUrl: details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : poster,
            title: title
        });
    }

    const mediaGridHTML = mediaItems.map(item => {
        const escapedTitle = title.replace(/"/g, '&quot;').replace(/'/g, '\\\'');
        const escapedOverview = details.overview ? details.overview.replace(/"/g, '&quot;').replace(/'/g, '\\\'') : '';
        
        if (item.type === 'video') {
            return `
                <div class="media-capture-card"
                    data-video-key="${item.key}"
                    data-video-title="${title.replace(/"/g, '&quot;')}"
                    data-video-overview="${(details.overview || '').replace(/"/g, '&quot;')}"
                    data-video-year="${year}"
                    data-video-rating="${ratingStr}">
                    <span class="video-badge">VIDEO</span>
                    <img src="${item.thumbnail}" alt="${item.title.replace(/"/g, '&quot;')}" loading="lazy">
                    <div class="play-overlay">
                        <svg class="play-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                </div>
            `;
        } else {
            const imgHTML = `<img src="${item.fullUrl}" alt="${item.title}">`;
            const escapedImg = imgHTML.replace(/"/g, '&quot;').replace(/'/g, '\\\'');
            return `
                <div class="media-capture-card" onclick="openLightbox('${escapedImg}', '${escapedTitle}', '${escapedOverview}', '${year}', '${ratingStr}')">
                    <img src="${item.url}" alt="${item.title}" loading="lazy">
                </div>
            `;
        }
    }).join('');

    // Full Cast
    let castHTML = '';
    if (details.credits && details.credits.cast && details.credits.cast.length > 0) {
        castHTML = details.credits.cast.map(actor => {
            const initials = actor.name ? actor.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';
            const img = actor.profile_path 
                ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` 
                : `https://via.placeholder.com/150/111424/ffffff?text=${encodeURIComponent(initials)}`;
            return `
                <div class="cast-member-card clickable-person" data-id="${actor.id}">
                    <div class="cast-member-avatar-wrapper">
                        <img src="${img}" alt="${actor.name}" loading="lazy">
                    </div>
                    <span class="cast-member-name">${actor.name}</span>
                    <span class="cast-member-character">${actor.character || 'Star'}</span>
                </div>
            `;
        }).join('');
    }

    const isBackButton = appHistory.length > 0;
    const btnAction = isBackButton ? 'goBack()' : 'restoreHome()';
    const btnTitle = isBackButton ? 'Volver atrás' : 'Volver al inicio';
    const btnIcon = isBackButton
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;

    // --- Fields for the detail sheet layout ---
    const genresList = details.genres && details.genres.length > 0
        ? details.genres.map(g => g.name).join(', ')
        : 'Sin género';

    const filledStars = Math.round((ratingRaw || 0) / 2);
    const starsHTML = Array.from({ length: 5 })
        .map((_, i) => `<span class="${i < filledStars ? 'is-on' : ''}">★</span>`)
        .join('');

    const releaseDateRaw = details.release_date || details.first_air_date || '';
    let releaseStr = '';
    if (releaseDateRaw) {
        try {
            releaseStr = new Date(releaseDateRaw).toLocaleDateString(navigator.language || 'es-MX', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        } catch (e) {
            releaseStr = releaseDateRaw;
        }
    }

    // directorText already carries the clickable span; drop its English prefix for the meta list
    const directorPlain = directorText.replace(/^Director by\s*/, '').replace(/^Created by\s*/, '');

    const castLine = details.credits && details.credits.cast
        ? details.credits.cast.slice(0, 4).map(a => `<span class="clickable-person" data-id="${a.id}">${a.name}</span>`).join(', ')
        : '';

    const heroTrailer = details.videos && details.videos.results
        ? (details.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer')
            || details.videos.results.find(v => v.site === 'YouTube'))
        : null;
    const heroTrailerKey = heroTrailer ? heroTrailer.key : '';

    const html = `
        <div class="movie-details-container cinematic-view detail-sheet">
            <div class="detail-sheet__bar">
                <button class="go-back-btn" onclick="${btnAction}" title="${btnTitle}">
                    ${btnIcon}
                </button>
                <span class="detail-sheet__bar-label" title="${title.replace(/"/g, '&quot;')}">${title}</span>
                <button class="go-back-btn view-fullscreen-btn" onclick="toggleBackdropView()" title="Ver a pantalla completa">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>
                </button>
            </div>

            <div class="detail-sheet__poster" style="--detail-backdrop: url('https://image.tmdb.org/t/p/w1280${details.backdrop_path || details.poster_path}'); --detail-portrait: url('https://image.tmdb.org/t/p/w780${details.poster_path || details.backdrop_path}');">
                ${heroTrailerKey ? `
                <button class="detail-sheet__play" data-video-key="${heroTrailerKey}" title="Ver trailer">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M8 5v14l11-7z"/></svg>
                </button>` : ''}
            </div>

            <div class="detail-sheet__body">
                <div class="detail-sheet__lead">
                    <h1 class="cinematic-title-logan-new detail-sheet__title">${title}</h1>
                    <p class="detail-sheet__genres">${genresList}</p>

                    <div class="detail-sheet__rating">
                        <span class="detail-sheet__stars" aria-hidden="true">${starsHTML}</span>
                        <span class="detail-sheet__score">${ratingStr}</span>
                        ${details.vote_count ? `<span class="detail-sheet__votes">(${details.vote_count.toLocaleString()} votos)</span>` : ''}
                    </div>

                    <p class="detail-sheet__synopsis">${details.overview || 'Sin descripción disponible.'}</p>

                    <div class="detail-sheet__cta-wrap">
                        ${heroTrailerKey
                            ? `<button class="detail-sheet__cta" data-video-key="${heroTrailerKey}">Ver trailer</button>`
                            : `<button class="detail-sheet__cta" onclick="document.querySelector('.detail-sheet__rest').scrollIntoView({ behavior: 'smooth' })">Ver detalles</button>`}
                        <span class="detail-sheet__fine">${[releaseStr || year, runtimeStr].filter(Boolean).join(' · ')}</span>
                    </div>
                </div>

                <div class="detail-sheet__rest">
                    <dl class="detail-sheet__meta">
                        ${directorText ? `<div class="detail-sheet__meta-row"><dt>${mediaType === 'tv' ? 'Creación' : 'Dirección'}</dt><dd>${directorPlain}</dd></div>` : ''}
                        ${castLine ? `<div class="detail-sheet__meta-row"><dt>Reparto</dt><dd>${castLine}</dd></div>` : ''}
                        <div class="detail-sheet__meta-row"><dt>Estreno</dt><dd>${releaseStr || year || '—'}</dd></div>
                        ${runtimeStr ? `<div class="detail-sheet__meta-row"><dt>Duración</dt><dd>${runtimeStr}</dd></div>` : ''}
                        ${language ? `<div class="detail-sheet__meta-row"><dt>Idioma</dt><dd>${language}</dd></div>` : ''}
                    </dl>

                    ${watchProvidersHTML}

                    <div class="movie-links-row-new">
                        ${favButton}
                        ${letterboxdLink}
                        ${imdbLink}
                        ${tmdbLink}
                        <button class="trivia-btn" id="trivia-btn" title="Jugar Cine-Trivia">🏆 Trivia</button>
                    </div>
                </div>
            </div>

            <div class="logan-media-section">
                <h4>Captures & Videos</h4>
                <div class="media-grid-captures">
                    ${mediaGridHTML}
                </div>
            </div>

            ${castHTML ? `
            <div class="logan-news-section">
                <h4>FULL CAST</h4>
                <div class="cast-grid-full">
                    ${castHTML}
                </div>
            </div>
            ` : ''}

            <div class="logan-footer-info">
                <div class="director-info">
                    <span>${title}</span>
                </div>
            </div>
        </div>
    `;

    main.innerHTML = html;

    // Vídeos: se reproducen dentro de su tarjeta. El botón del hero y "Ver trailer" usan la
    // tarjeta de ese mismo vídeo en la galería; si no existe, el propio hero (desktop).
    main.querySelectorAll('.media-capture-card[data-video-key]').forEach(card => {
        card.addEventListener('click', () => {
            playVideoInline(card, card.dataset.videoKey, { card, title });
        });
    });
    main.querySelectorAll('.detail-sheet__play[data-video-key], .detail-sheet__cta[data-video-key]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = btn.dataset.videoKey;
            const galleryCard = [...main.querySelectorAll('.media-capture-card[data-video-key]')]
                .find(c => c.dataset.videoKey === key);
            if (galleryCard) {
                playVideoInline(galleryCard, key, { card: galleryCard, title });
            } else {
                playVideoInline(main.querySelector('.detail-sheet__poster'), key, { title });
            }
        });
    });
    
    // Extract and apply poster color
    if (details.poster_path) {
        const smallPoster = `https://image.tmdb.org/t/p/w300${details.poster_path}`;
        extractColorFromUrl(smallPoster).then(color => {
            const rgbColor = `rgb(${Math.min(255, color.r + 40)}, ${Math.min(255, color.g + 40)}, ${Math.min(255, color.b + 40)})`;
            const titleEl = main.querySelector('.cinematic-title-logan-new');
            if (titleEl) {
                titleEl.style.color = rgbColor;
                titleEl.style.transition = 'color 0.5s ease';
            }
            
            const glowEl = main.querySelector('.ambient-glow-bg');
            if (glowEl) {
                glowEl.style.setProperty('--ambient-gradient', `radial-gradient(circle, rgba(${color.r}, ${color.g}, ${color.b}, 0.35) 0%, rgba(${color.r}, ${color.g}, ${color.b}, 0) 70%)`);
            }
        });
    }
    
    const favBtnEl = document.getElementById('fav-btn');
    if (favBtnEl) {
        favBtnEl.addEventListener('click', () => {
            const movieData = {
                id: details.id,
                title: title,
                backdrop_path: details.backdrop_path,
                poster_path: details.poster_path,
                media_type: mediaType
            };
            toggleFavorite(movieData, favBtnEl);
            if (document.getElementById('backdrop-settings-menu').classList.contains('active')) {
                renderSettingsFavorites();
            }
        });
    }

    const triviaBtnEl = document.getElementById('trivia-btn');
    if (triviaBtnEl) {
        triviaBtnEl.addEventListener('click', () => {
            initCineTrivia(details);
        });
    }

    // Attach listeners for clickable people
    main.querySelectorAll('.clickable-person').forEach(el => {
        el.addEventListener('click', async () => {
            const personId = el.dataset.id;
            const lang = navigator.language || 'es-MX';
            try {
                const detailsRes = await fetch(`https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=combined_credits,external_ids`);
                const personDetails = await detailsRes.json();
                openActorDrawer(personDetails);
            } catch(err) {
                console.error(err);
            }
        });
    });

    // Cargar backdrops específicos de la película
    loadMovieBackdrops(details.id, mediaType, title);

    // Click listener para el cast
    main.querySelectorAll('.cast-card').forEach(card => {
        card.addEventListener('click', async () => {
            const id = card.dataset.id;
            try {
                const lang = navigator.language || 'es-MX';
                const detailsRes = await fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=combined_credits,external_ids`);
                const personDetails = await detailsRes.json();
                openActorDrawer(personDetails);
            } catch(err) {
                console.error(err);
            }
        });
    });
}

function renderPersonDetails(details) {
    pushNavState();
    enterDetailMode();
    const main = document.getElementById('main-content');

    const name = details.name;
    const profile = details.profile_path ? `https://image.tmdb.org/t/p/w500${details.profile_path}` : 'https://via.placeholder.com/300x450?text=No+Photo';
    
    // Meta data
    const birthday = details.birthday ? `<span>🎂 ${details.birthday}</span>` : '';
    const placeOfBirth = details.place_of_birth ? `<span>📍 ${details.place_of_birth}</span>` : '';
    const department = details.known_for_department ? `<span>🎬 ${details.known_for_department}</span>` : '';

    // Enlaces externos
    const imdbLink = details.external_ids && details.external_ids.imdb_id ? `<a href="https://www.imdb.com/name/${details.external_ids.imdb_id}" target="_blank" class="link-btn imdb" title="IMDb"><img src="https://upload.wikimedia.org/wikipedia/commons/6/69/IMDB_Logo_2016.svg" alt="IMDb"></a>` : '';
    const letterboxdLink = `<a href="https://letterboxd.com/search/${encodeURIComponent(name)}/" target="_blank" class="link-btn letterboxd" title="Letterboxd"><img src="https://a.ltrbxd.com/logos/letterboxd-logo-h-neg-rgb-1000px.png" alt="Letterboxd"></a>`;
    const tmdbLink = `<a href="https://www.themoviedb.org/person/${details.id}" target="_blank" class="link-btn tmdb-link" title="TMDB"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB"></a>`;

    // Tagline / Quote
    const quoteText = details.known_for_department ? `KNOWN FOR: ${details.known_for_department.toUpperCase()}` : 'A CINEMATIC ICON';

    // Popularity Circle (replacing laurels)
    const popularityRaw = Math.min(details.popularity || 0, 100);
    const popularityStr = popularityRaw.toFixed(1);
    const ratingHTML = `
        <div class="cinematic-rating-circle" style="transform: scale(0.8); transform-origin: left center; margin: 0;">
            <svg viewBox="0 0 36 36" class="circular-chart yellow">
                <path class="circle-bg"
                d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path class="circle"
                stroke-dasharray="${popularityRaw}, 100"
                d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" class="percentage">${popularityStr}</text>
            </svg>
            <span class="rating-label" style="display: block; text-align: center; margin-top: 5px; font-weight: bold; font-size: 1.2rem;">POPULARITY</span>
        </div>
    `;

    // Synopsis Right
    let overviewRest = details.biography || 'Sin biografía disponible.';
    let isLongBio = false;
    if (overviewRest.length > 500) {
        isLongBio = true;
        overviewRest = `
            <div class="person-biography-content collapsed" id="bio-content">
                ${overviewRest.replace(/\n/g, '<br><br>')}
            </div>
            <button class="read-more-btn" id="read-more-btn" style="background:transparent;border:none;color:#ffb703;cursor:pointer;margin-top:15px;font-weight:bold;">
                <span>Read more</span>
            </button>
        `;
    } else {
        overviewRest = overviewRest.replace(/\n/g, '<br><br>');
    }

    // Media (from combined_credits, up to 9 captures)
    let mediaItems = [];
    if (details.combined_credits && details.combined_credits.cast) {
        const sortedCast = details.combined_credits.cast
            .filter(c => c.backdrop_path)
            .sort((a,b) => b.popularity - a.popularity)
            .slice(0, 9);
        sortedCast.forEach((credit, idx) => {
            mediaItems.push({
                type: 'image',
                url: `https://image.tmdb.org/t/p/w780${credit.backdrop_path}`,
                fullUrl: `https://image.tmdb.org/t/p/w1280${credit.backdrop_path}`,
                title: credit.title || credit.name || `Capture ${idx + 1}`
            });
        });
    }

    if (mediaItems.length === 0) {
        mediaItems.push({
            type: 'image',
            url: profile,
            fullUrl: profile,
            title: name
        });
    }

    const mediaGridHTML = mediaItems.map(item => {
        const imgHTML = `<img src="${item.fullUrl}" alt="${item.title.replace(/"/g, '&quot;')}">`;
        const escapedImg = imgHTML.replace(/"/g, '&quot;').replace(/'/g, '\\\'');
        return `
            <div class="media-capture-card" onclick="openLightbox('${escapedImg}')">
                <img src="${item.url}" alt="${item.title.replace(/"/g, '&quot;')}" loading="lazy">
            </div>
        `;
    }).join('');

    // News/Cast (Known For large cards)
    let newsHTML = '';
    if (details.combined_credits && details.combined_credits.cast) {
        const topCastCredits = details.combined_credits.cast
            .sort((a,b) => b.popularity - a.popularity)
            .slice(0, 2);
        newsHTML = topCastCredits.map(credit => {
            const img = credit.backdrop_path ? `https://image.tmdb.org/t/p/w780${credit.backdrop_path}` : profile;
            const date = (credit.release_date || credit.first_air_date || '').split('-')[0];
            return `
                <div class="logan-news-card cast-card" data-id="${credit.id}" data-type="${credit.media_type || 'movie'}" data-title="${(credit.title || credit.name).replace(/"/g, '&quot;')}">
                    <img src="${img}" alt="${credit.title || credit.name}">
                    <div class="logan-news-card-content">
                        <span class="tag">KNOWN FOR</span> <span class="date">${date}</span>
                        <h2>${(credit.title || credit.name).toUpperCase()}</h2>
                    </div>
                </div>
            `;
        }).join('');
    }

    const isBackButton = appHistory.length > 0;
    const btnAction = isBackButton ? 'goBack()' : 'restoreHome()';
    const btnTitle = isBackButton ? 'Volver atrás' : 'Volver al inicio';
    const btnIcon = isBackButton 
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>` 
        : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;

    const html = `
        <div class="movie-details-container cinematic-view">
            <button class="go-back-btn" onclick="${btnAction}" title="${btnTitle}">
                ${btnIcon}
            </button>
            <button class="go-back-btn view-fullscreen-btn" onclick="toggleBackdropView()" title="Ver a pantalla completa">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
            <div class="cinematic-hero-overlay"></div>

            <div class="cinematic-hero-content">
                <img class="cinematic-hero-poster-bg" src="${profile}" alt="">
                <h1 class="cinematic-title-logan" style="font-size: clamp(3rem, 10vw, 8rem);">${name.toUpperCase()}</h1>
                
                <div class="cinematic-quote-section">
                    <p class="cinematic-quote">"${quoteText}"</p>
                    <div class="cinematic-laurels">
                        ${ratingHTML}
                    </div>
                </div>
            </div>

            <div class="logan-synopsis-section">
                <div class="logan-synopsis-left">
                    <h4>ABOUT</h4>
                    <h2>THE LIFE AND WORK OF A TALENT.</h2>
                </div>
                <div class="logan-synopsis-right">
                    ${overviewRest}
                </div>
            </div>

            <div class="logan-media-section">
                <h4>Captures</h4>
                <div class="media-grid-captures">
                    ${mediaGridHTML}
                </div>
            </div>

            ${newsHTML ? `
            <div class="logan-news-section">
                <h4>NOTABLE WORKS</h4>
                <div class="logan-news-grid">
                    ${newsHTML}
                </div>
            </div>
            ` : ''}

            <div class="logan-footer-info">
                <div class="director-info">
                    <span>${name}</span>
                </div>
                <div class="movie-links-row">
                    ${letterboxdLink}
                    ${imdbLink}
                    ${tmdbLink}
                </div>
            </div>
        </div>
    `;

    main.innerHTML = html;
    
    // Extract and apply profile color
    if (details.profile_path) {
        const smallPoster = `https://image.tmdb.org/t/p/w300${details.profile_path}`;
        extractColorFromUrl(smallPoster).then(color => {
            const rgbColor = `rgb(${Math.min(255, color.r + 40)}, ${Math.min(255, color.g + 40)}, ${Math.min(255, color.b + 40)})`;
            const titleEl = main.querySelector('.cinematic-title-logan');
            const quoteEl = main.querySelector('.cinematic-quote');
            if (titleEl) {
                titleEl.style.color = rgbColor;
                titleEl.style.transition = 'color 0.5s ease';
            }
            if (quoteEl) {
                quoteEl.style.color = rgbColor;
                quoteEl.style.transition = 'color 0.5s ease';
            }
        });
    }
    
    const readMoreBtn = document.getElementById('read-more-btn');
    const bioContent = document.getElementById('bio-content');
    if (readMoreBtn && bioContent) {
        readMoreBtn.addEventListener('click', () => {
            const isCollapsed = bioContent.classList.contains('collapsed');
            const icon = readMoreBtn.querySelector('.read-more-icon');
            const textSpan = readMoreBtn.querySelector('span');
            if (isCollapsed) {
                bioContent.classList.remove('collapsed');
                bioContent.classList.add('expanded');
                if(textSpan) textSpan.textContent = 'Show less';
                if(icon) icon.style.transform = 'rotate(180deg)';
            } else {
                bioContent.classList.add('collapsed');
                bioContent.classList.remove('expanded');
                if(textSpan) textSpan.textContent = 'Read more';
                if(icon) icon.style.transform = 'rotate(0deg)';
            }
        });
    }

    // Add click listeners to 'Known for' items so they open the movie details
    main.querySelectorAll('.cast-card').forEach(card => {
        card.addEventListener('click', async () => {
            const id = card.dataset.id;
            const type = card.dataset.type;
            const creditTitle = card.dataset.title;
            if (searchInput) searchInput.value = creditTitle;
            saveCurrentState();
            window.scrollTo({ top: 30, behavior: 'smooth' });
            try {
                const lang = navigator.language || 'es-MX';
                const detailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,external_ids,videos,images,watch/providers`);
                const creditDetails = await detailsRes.json();
                renderMovieDetails(creditDetails, type);
            } catch(err) {
                console.error(err);
            }
        });
    });
}

// --- Back to top functionality ---
// While the tabbed layout is active, the document itself doesn't scroll — each tab
// panel scrolls independently — so track whichever panel is currently active instead.
const backToTopBtn = document.getElementById('back-to-top-btn');
if (backToTopBtn) {
    function getActiveTabPanel() {
        if (!document.body.classList.contains('tabs-active')) return null;
        const activeName = document.body.dataset.activeTab || 'home';
        const viewport = document.getElementById('tab-viewport');
        return viewport ? viewport.querySelector(`.tab-panel[data-tab="${activeName}"]`) : null;
    }

    function checkBackToTop() {
        const panel = getActiveTabPanel();
        const y = panel ? panel.scrollTop : window.scrollY;
        backToTopBtn.classList.toggle('visible', y > 400);
    }

    document.addEventListener('scroll', checkBackToTop, { capture: true, passive: true });

    backToTopBtn.addEventListener('click', () => {
        const panel = getActiveTabPanel();
        if (panel) {
            panel.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

// --- Cine-Roulette Feature ---
// Azar sin sesgo: crypto cuando está disponible, con rechazo del resto que desbalancea
// el módulo (Math.random es el respaldo).
function randomInt(max) {
    if (max <= 0) return 0;
    const crypto = window.crypto || window.msCrypto;
    if (crypto && crypto.getRandomValues) {
        const limit = Math.floor(0xFFFFFFFF / max) * max;
        const buf = new Uint32Array(1);
        do {
            crypto.getRandomValues(buf);
        } while (buf[0] >= limit);
        return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Nº de páginas por género (para sortear sobre todo el catálogo sin repetir la petición sonda)
const roulettePageCache = new Map();
let lastRouletteWinnerId = null;

// La abre el botón de la barra de Inicio (delegación); queda como no-op si falta el modal.
let openCineRoulette = () => {};

function initCineRoulette() {
    const modal = document.getElementById('roulette-modal');
    const closeBtn = document.getElementById('roulette-close-btn');
    const spinBtn = document.getElementById('roulette-spin-btn');
    const genreSelect = document.getElementById('roulette-genre-select');
    const track = document.getElementById('roulette-track');
    const winnerCard = document.getElementById('roulette-winner-card');

    if (!modal || !closeBtn || !spinBtn || !genreSelect || !track || !winnerCard) return;

    openCineRoulette = () => {
        modal.classList.add('active');
        document.body.classList.add('roulette-active');
        document.documentElement.classList.add('roulette-active');
        winnerCard.classList.remove('active');
        track.innerHTML = '';
        track.style.transition = 'none';
        track.style.transform = 'translateX(0)';
        spinBtn.disabled = false;
    };

    const closeRouletteModal = () => {
        modal.classList.remove('active');
        document.body.classList.remove('roulette-active');
        document.documentElement.classList.remove('roulette-active');
    };

    closeBtn.addEventListener('click', closeRouletteModal);
    enableSheetSwipe(modal.querySelector('.roulette-modal-content'), closeRouletteModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeRouletteModal();
        }
    });

    spinBtn.addEventListener('click', async () => {
        spinBtn.disabled = true;
        winnerCard.classList.remove('active');
        track.innerHTML = '';
        track.style.transition = 'none';
        track.style.transform = 'translateX(0)';

        const genre = genreSelect.value;
        const lang = navigator.language || 'es-MX';

        try {
            const discover = (page) => `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genre}&page=${page}&vote_average.gte=6.2&vote_count.gte=200&sort_by=popularity.desc&language=${lang}&include_adult=false`;

            // Antes se pedía siempre una de las 5 primeras páginas y el ganador era el índice
            // fijo 23 del carril (= el 4º resultado de esa página), así que solo había 5
            // películas posibles. Ahora se sortea una página de todo el catálogo del género…
            let pageCount = roulettePageCache.get(genre);
            if (!pageCount) {
                const probe = await fetch(discover(1));
                const probeData = await probe.json();
                pageCount = Math.min(probeData.total_pages || 1, 500);
                roulettePageCache.set(genre, pageCount);
            }

            const res = await fetch(discover(randomInt(pageCount) + 1));
            const data = await res.json();

            if (!data.results || data.results.length < 10) {
                alert("No se encontraron suficientes películas para esta selección. Intenta con otro género.");
                spinBtn.disabled = false;
                return;
            }

            // …y el carril se baraja, así que el ganador no depende de la posición en TMDB.
            let pool = shuffleArray(data.results.filter(m => m.poster_path));
            if (pool.length < 6) pool = shuffleArray([...data.results]);
            if (pool.length > 1 && pool[0].id === lastRouletteWinnerId) {
                pool.push(pool.shift());
            }

            const movies = [];
            while (movies.length < 36) {
                movies.push(...shuffleArray([...pool]));
            }
            movies.length = 36;

            // …y hasta el punto de parada se sortea dentro del tramo final del carril.
            const winningIndex = 26 + randomInt(6);
            const winner = movies[winningIndex];
            lastRouletteWinnerId = winner.id;

            track.innerHTML = movies.map((m, idx) => {
                const poster = m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : 'https://via.placeholder.com/120x180?text=No+Poster';
                return `
                    <div class="roulette-item" id="roulette-item-${idx}">
                        <img src="${poster}" alt="${m.title}">
                    </div>
                `;
            }).join('');

            // El paso se mide del DOM (las tarjetas cambian de tamaño en móvil).
            const firstItem = track.querySelector('.roulette-item');
            const gap = parseFloat(getComputedStyle(track).columnGap || '16') || 16;
            const cardWidth = (firstItem ? firstItem.offsetWidth : 120) + gap;
            // Parada ligeramente descentrada dentro de la tarjeta ganadora: más natural
            // y deja claro que el punto de frenado no está prefijado.
            const jitter = randomInt(Math.round(cardWidth * 0.5)) - Math.round(cardWidth * 0.25);
            const spinTranslation = winningIndex * cardWidth + jitter;
            const spinDuration = 3.6 + randomInt(1200) / 1000;

            modal.classList.add('spinning');

            setTimeout(() => {
                track.style.transition = `transform ${spinDuration}s cubic-bezier(0.15, 0.85, 0.35, 1)`;
                track.style.transform = `translateX(-${spinTranslation}px)`;
            }, 50);

            setTimeout(() => {
                modal.classList.remove('spinning');
                const winElement = document.getElementById(`roulette-item-${winningIndex}`);
                if (winElement) winElement.classList.add('active');

                const winnerPoster = winner.poster_path ? `https://image.tmdb.org/t/p/w185${winner.poster_path}` : 'https://via.placeholder.com/90x135?text=No+Poster';
                winnerCard.innerHTML = `
                    <div class="roulette-winner-poster">
                        <img src="${winnerPoster}" alt="${winner.title}">
                    </div>
                    <div class="roulette-winner-info">
                        <h3 class="roulette-winner-title">${winner.title}</h3>
                        <span class="roulette-winner-rating">⭐ ${winner.vote_average.toFixed(1)} TMDB</span>
                        <p class="roulette-winner-synopsis">${winner.overview || 'Sin descripción disponible.'}</p>
                        <button class="roulette-winner-btn" id="roulette-view-winner-btn" data-id="${winner.id}">VIEW DETAILS</button>
                    </div>
                `;
                winnerCard.classList.add('active');
                spinBtn.disabled = false;

                document.getElementById('roulette-view-winner-btn').addEventListener('click', async () => {
                    const id = winner.id;
                    if (searchInput) {
                        searchInput.value = winner.title;
                    }
                    closeRouletteModal();
                    saveCurrentState();
                    window.scrollTo({ top: 30, behavior: 'smooth' });
                    try {
                        const detailsRes = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,external_ids,videos,images,watch/providers`);
                        const details = await detailsRes.json();
                        renderMovieDetails(details, 'movie');
                    } catch (err) {
                        console.error(err);
                    }
                });

            }, spinDuration * 1000 + 120);

        } catch (err) {
            console.error(err);
            alert("Error al girar la ruleta. Por favor reintenta.");
            spinBtn.disabled = false;
        }
    });
}

initCineRoulette();

// --- Actor Drawer ---
function openActorDrawer(details) {
    const drawer = document.getElementById('actor-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const body = document.getElementById('actor-drawer-body');

    if (!drawer || !backdrop || !body) return;

    const avatar = details.profile_path 
        ? `https://image.tmdb.org/t/p/w300${details.profile_path}` 
        : 'https://via.placeholder.com/150/111424/ffffff?text=N/A';
    
    const birthDate = details.birthday ? details.birthday : 'Unknown';
    const birthPlace = details.place_of_birth ? details.place_of_birth : 'Unknown';
    
    // ─── Career Timeline (Horizontal SVG) ───
    let timelineHTML = '';
    let timelineCredits = [];

    if (details.combined_credits && details.combined_credits.cast) {
        timelineCredits = details.combined_credits.cast
            .filter(c => c.release_date || c.first_air_date) // must have year
            .filter(c => c.vote_average && c.vote_count > 15) // ensure rating validity
            .sort((a, b) => b.popularity - a.popularity) // take most popular first
            .slice(0, 15) // take top 15 (less cluttered)
            .map(c => {
                const dateStr = c.release_date || c.first_air_date;
                const year = new Date(dateStr).getFullYear();
                return {
                    id: c.id,
                    media_type: c.media_type,
                    title: c.title || c.name,
                    character: c.character || 'Unknown',
                    rating: c.vote_average,
                    year: year,
                    poster: c.poster_path ? `https://image.tmdb.org/t/p/w154${c.poster_path}` : null
                };
            })
            .sort((a, b) => a.year - b.year); // sort chronologically

        if (timelineCredits.length > 0) {
            // Generate timeline SVG
            const height = 260;
            const paddingTop = 35;
            const paddingBottom = 55;
            const paddingLeft = 45;
            const paddingRight = 45;
            const availableHeight = height - paddingTop - paddingBottom;
            
            const minYear = timelineCredits[0].year;
            const maxYear = timelineCredits[timelineCredits.length - 1].year;
            const yearRange = maxYear - minYear || 1;

            // Compute positions with spacing push to avoid overlaps
            const minSpacing = 70; // min pixels between nodes (less cluttered)
            const availableWidth = Math.max(700, timelineCredits.length * minSpacing);
            const xPositions = [];
            
            for (let i = 0; i < timelineCredits.length; i++) {
                let x = paddingLeft + ((timelineCredits[i].year - minYear) / yearRange) * availableWidth;
                if (i > 0 && x - xPositions[i-1] < minSpacing) {
                    x = xPositions[i-1] + minSpacing;
                }
                xPositions.push(x);
            }

            const svgWidth = xPositions[xPositions.length - 1] + paddingRight;

            // Y scale logic (rating 3 to 10)
            const minRating = 3;
            const maxRating = 10;
            const yPositions = timelineCredits.map(c => {
                const clamped = Math.max(minRating, Math.min(maxRating, c.rating));
                return paddingTop + (1 - (clamped - minRating) / (maxRating - minRating)) * availableHeight;
            });

            // Grid lines (horizontal thresholds: 10, 8, 6, 4)
            const gridRatings = [4, 6, 8, 10];
            const gridLinesSVG = gridRatings.map(rating => {
                const y = paddingTop + (1 - (rating - minRating) / (maxRating - minRating)) * availableHeight;
                return `
                    <line x1="${paddingLeft - 10}" y1="${y}" x2="${svgWidth - paddingRight + 10}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
                    <text x="${paddingLeft - 22}" y="${y + 4}" fill="rgba(255,255,255,0.4)" font-size="10" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle">${rating}</text>
                `;
            }).join('');

            // Build path curves
            let pathPoints = '';
            let areaPoints = `L ${xPositions[xPositions.length - 1]} ${height - paddingBottom} L ${xPositions[0]} ${height - paddingBottom} Z`;
            
            for (let i = 0; i < timelineCredits.length; i++) {
                pathPoints += `${i === 0 ? 'M' : 'L'} ${xPositions[i]} ${yPositions[i]} `;
            }

            // SVG Gradient & Glow filter
            const defsSVG = `
                <defs>
                    <linearGradient id="timeline-area-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--accent, #e50914)" stop-opacity="0.25"/>
                        <stop offset="100%" stop-color="var(--accent, #e50914)" stop-opacity="0.0"/>
                    </linearGradient>
                    <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
            `;

            // Render movie nodes with higher contrast white years
            const nodesSVG = timelineCredits.map((c, i) => {
                return `
                    <g class="timeline-node" data-index="${i}" style="cursor: pointer;">
                        <circle cx="${xPositions[i]}" cy="${yPositions[i]}" r="6" fill="#080c18" stroke="var(--accent, #e50914)" stroke-width="3" style="transition: all 0.15s ease;" />
                        <text x="${xPositions[i]}" y="${height - paddingBottom + 25}" fill="#fff" font-size="11" font-family="system-ui, -apple-system, sans-serif" font-weight="700" text-anchor="middle">${c.year}</text>
                    </g>
                `;
            }).join('');

            timelineHTML = `
                <div class="actor-timeline-title">CAREER TIMELINE</div>
                <div class="actor-timeline-scroll">
                    <svg class="actor-timeline-svg" width="${svgWidth}" height="${height}">
                        ${defsSVG}
                        ${gridLinesSVG}
                        <path d="${pathPoints} ${areaPoints}" fill="url(#timeline-area-gradient)" />
                        <path d="${pathPoints}" fill="none" stroke="var(--accent, #e50914)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow-filter)" />
                        ${nodesSVG}
                    </svg>
                </div>
            `;
        }
    }

    // ─── Known For (Slider) ───
    let creditsHTML = '';
    if (details.combined_credits && details.combined_credits.cast) {
        const sortedCredits = details.combined_credits.cast
            .filter(c => c.poster_path)
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 10);
            
        if (sortedCredits.length > 0) {
            creditsHTML = `
                <h4 class="actor-credits-title">KNOWN FOR</h4>
                <div class="actor-credits-slider">
                    ${sortedCredits.map(c => `
                        <div class="actor-credit-card" data-id="${c.id}" data-type="${c.media_type}" data-title="${c.title || c.name}">
                            <img src="https://image.tmdb.org/t/p/w185${c.poster_path}" alt="${c.title || c.name}" class="actor-credit-poster" loading="lazy">
                            <span class="actor-credit-title">${c.title || c.name}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    // Populate drawer body
    body.innerHTML = `
        <div class="actor-profile-header">
            <img src="${avatar}" alt="${details.name}" class="actor-profile-avatar">
            <h3 class="actor-profile-name">${details.name}</h3>
            <span class="actor-profile-department">${details.known_for_department || 'Acting'}</span>
        </div>
        <div class="actor-profile-meta">
            <span class="actor-profile-meta-item"><strong>Born:</strong> ${birthDate}</span>
            <span class="actor-profile-meta-item"><strong>Place of birth:</strong> ${birthPlace}</span>
        </div>
        ${timelineHTML}
        ${creditsHTML}
        <h4 class="actor-timeline-title">Biography</h4>
        <p class="actor-profile-bio">${details.biography || 'No biography available for this artist.'}</p>
        <div id="actor-timeline-tooltip" class="actor-timeline-tooltip"></div>
    `;

    drawer.classList.add('active');
    backdrop.classList.add('active');

    // Add interactivity to timeline nodes
    const tooltip = document.getElementById('actor-timeline-tooltip');
    const scrollContainer = body.querySelector('.actor-timeline-scroll');

    if (scrollContainer && tooltip) {
        const nodes = scrollContainer.querySelectorAll('.timeline-node');
        nodes.forEach(node => {
            const idx = parseInt(node.dataset.index);
            const c = timelineCredits[idx];

            const showTooltip = () => {
                node.querySelector('circle').setAttribute('r', '9');
                node.querySelector('circle').setAttribute('fill', 'var(--accent, #e50914)');

                tooltip.innerHTML = `
                    <img src="${c.poster || 'https://via.placeholder.com/48x72/111424/ffffff?text=N/A'}" class="tooltip-poster">
                    <div class="tooltip-info">
                        <div class="tooltip-title">${c.title}</div>
                        <div class="tooltip-role">${c.character}</div>
                        <div class="tooltip-year-rating">
                            <span class="tooltip-rating-star">★</span>
                            <span>${c.rating.toFixed(1)}/10</span>
                            <span style="color: rgba(255,255,255,0.4); margin-left: 4px;">(${c.year})</span>
                        </div>
                    </div>
                `;
                
                // Absolute screen coordinates math for perfect positioning
                const circleEl = node.querySelector('circle');
                const rect = circleEl.getBoundingClientRect();
                const drawerRect = drawer.getBoundingClientRect();
                
                const cxVal = rect.left - drawerRect.left + (rect.width / 2);
                const cyVal = rect.top - drawerRect.top + (rect.height / 2);
                
                const drawerWidth = drawer.clientWidth || 420;
                const tooltipWidth = 230;
                const halfWidth = tooltipWidth / 2;
                
                const minLeft = halfWidth + 15;
                const maxLeft = drawerWidth - halfWidth - 15;
                const clampedLeft = Math.max(minLeft, Math.min(maxLeft, cxVal));
                
                const arrowOffset = cxVal - clampedLeft;
                const arrowPercent = 50 + (arrowOffset / tooltipWidth) * 100;
                
                tooltip.style.left = clampedLeft + 'px';
                tooltip.style.top = (cyVal - 16) + 'px';
                tooltip.style.setProperty('--tooltip-arrow-left', `${arrowPercent}%`);
                tooltip.classList.add('active');
            };

            const hideTooltip = () => {
                node.querySelector('circle').setAttribute('r', '6');
                node.querySelector('circle').setAttribute('fill', '#080c18');
                tooltip.classList.remove('active');
            };

            node.addEventListener('mouseenter', showTooltip);
            node.addEventListener('mouseleave', hideTooltip);
            
            // Allow tap/click on node to toggle tooltip or load movie
            node.addEventListener('click', async (e) => {
                e.stopPropagation();
                // If it's a mobile touch, show tooltip first, otherwise load details directly
                if (window.matchMedia("(max-width: 768px)").matches && !tooltip.classList.contains('active')) {
                    showTooltip();
                } else {
                    hideTooltip();
                    const id = c.id;
                    const type = c.media_type || 'movie';
                    const lang = navigator.language || 'es-MX';
                    
                    drawer.classList.remove('active');
                    backdrop.classList.remove('active');
                    
                    // Set search bar input value
                    const searchInput = document.getElementById('search-query');
                    if (searchInput) {
                        searchInput.value = c.title;
                    }
                    
                    saveCurrentState();
                    window.scrollTo({ top: 30, behavior: 'smooth' });
                    
                    try {
                        const detailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,external_ids,videos,images,watch/providers`);
                        const mediaDetails = await detailsRes.json();
                        renderMovieDetails(mediaDetails, type);
                    } catch (err) {
                        console.error(err);
                    }
                }
            });
        });

        // Hide tooltip on scroll
        scrollContainer.addEventListener('scroll', () => {
            tooltip.classList.remove('active');
        });
    }

    // Add interactivity to "Known For" slider cards
    body.querySelectorAll('.actor-credit-card').forEach(card => {
        card.addEventListener('click', async () => {
            const id = card.dataset.id;
            const type = card.dataset.type || 'movie';
            const title = card.dataset.title;
            const lang = navigator.language || 'es-MX';
            
            drawer.classList.remove('active');
            backdrop.classList.remove('active');
            
            // Set search bar input value
            const searchInput = document.getElementById('search-query');
            if (searchInput && title) {
                searchInput.value = title;
            }
            
            saveCurrentState();
            window.scrollTo({ top: 30, behavior: 'smooth' });
            
            try {
                const detailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,external_ids,videos,images,watch/providers`);
                const mediaDetails = await detailsRes.json();
                renderMovieDetails(mediaDetails, type);
            } catch (err) {
                console.error(err);
            }
        });
    });
}

function initActorDrawerEvents() {
    const drawer = document.getElementById('actor-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const closeBtn = document.getElementById('actor-drawer-close');

    if (!drawer || !backdrop || !closeBtn) return;

    const closeDrawer = () => {
        drawer.classList.remove('active');
        backdrop.classList.remove('active');
    };

    closeBtn.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
}

initActorDrawerEvents();

/* ── Cine-Trivia & Theme Store Minigame ────────────────────────── */
function generateTriviaQuestions(details) {
    const qs = [];
    
    // Question 1: Year of release
    const year = (details.release_date || details.first_air_date || '').split('-')[0];
    if (year) {
        const yr = parseInt(year);
        const incorrectYears = [yr - 2, yr + 1, yr - 4, yr + 3].filter(y => y !== yr);
        const options = [yr.toString(), ...incorrectYears.map(y => y.toString())].slice(0, 4);
        qs.push({
            text: `¿En qué año se estrenó "${details.title || details.name}"?`,
            options: shuffleArray(options),
            correctAnswer: yr.toString()
        });
    }
    
    // Question 2: Director
    let directorName = '';
    if (details.credits && details.credits.crew) {
        const dirObj = details.credits.crew.find(c => c.job === 'Director' || c.job === 'Executive Producer' || c.job === 'Series Director');
        if (dirObj) directorName = dirObj.name;
    }
    if (directorName) {
        const famousDirectors = ['Christopher Nolan', 'Steven Spielberg', 'Quentin Tarantino', 'Martin Scorsese', 'James Cameron', 'Guillermo del Toro', 'Denis Villeneuve', 'Greta Gerwig'];
        const incorrectDirs = famousDirectors.filter(d => d.toLowerCase() !== directorName.toLowerCase()).slice(0, 3);
        const options = [directorName, ...incorrectDirs];
        qs.push({
            text: `¿Quién dirigió la producción "${details.title || details.name}"?`,
            options: shuffleArray(options),
            correctAnswer: directorName
        });
    }

    // Question 3: Cast
    let characterName = '';
    let actorName = '';
    if (details.credits && details.credits.cast && details.credits.cast.length > 0) {
        const validCast = details.credits.cast.filter(c => c.character && c.name);
        if (validCast.length > 0) {
            const selected = validCast[0];
            actorName = selected.name;
            characterName = selected.character;
        }
    }
    if (characterName && actorName) {
        const famousActors = ['Leonardo DiCaprio', 'Brad Pitt', 'Scarlett Johansson', 'Morgan Freeman', 'Robert Downey Jr.', 'Meryl Streep', 'Tom Hanks', 'Jennifer Lawrence'];
        const incorrectActors = famousActors.filter(a => a.toLowerCase() !== actorName.toLowerCase()).slice(0, 3);
        const options = [actorName, ...incorrectActors];
        qs.push({
            text: `¿Qué actor interpretó al personaje "${characterName}" en esta producción?`,
            options: shuffleArray(options),
            correctAnswer: actorName
        });
    }

    // Fallback genre question
    if (qs.length < 3 && details.genres && details.genres.length > 0) {
        const mainGenre = details.genres[0].name;
        const genericGenres = ['Acción', 'Comedia', 'Terror', 'Drama', 'Documental', 'Ciencia Ficción', 'Aventura', 'Romance'];
        const incorrectGenres = genericGenres.filter(g => g.toLowerCase() !== mainGenre.toLowerCase()).slice(0, 3);
        const options = [mainGenre, ...incorrectGenres];
        qs.push({
            text: `¿A qué género principal pertenece "${details.title || details.name}"?`,
            options: shuffleArray(options),
            correctAnswer: mainGenre
        });
    }

    // Absolute fallback
    while (qs.length < 3) {
        qs.push({
            text: `¿Cuál es el sitio oficial de base de datos de películas utilizado en esta app?`,
            options: shuffleArray(['TMDB (The Movie Database)', 'IMDb', 'Wikipedia', 'Metacritic']),
            correctAnswer: 'TMDB (The Movie Database)'
          });
    }

    return qs.slice(0, 3);
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function initCineTrivia(movieDetails) {
    const modal = document.getElementById('trivia-modal');
    if (!modal) return;
    
    modal.classList.add('active');
    
    // Wire tabs
    const tabQuiz = document.getElementById('trivia-tab-quiz');
    const tabStore = document.getElementById('trivia-tab-store');
    
    tabQuiz.className = 'trivia-tab-btn active';
    tabStore.className = 'trivia-tab-btn';
    
    let credits = parseInt(localStorage.getItem('trivia_credits') || '0');
    document.getElementById('trivia-credits-value').textContent = credits;
    
    let questions = generateTriviaQuestions(movieDetails);
    let currentQuestionIndex = 0;
    let correctCount = 0;
    
    const showQuizTab = () => {
        tabQuiz.className = 'trivia-tab-btn active';
        tabStore.className = 'trivia-tab-btn';
        renderQuizQuestion(questions, currentQuestionIndex, correctCount, movieDetails);
    };
    
    const showStoreTab = () => {
        tabQuiz.className = 'trivia-tab-btn';
        tabStore.className = 'trivia-tab-btn active';
        renderStore();
    };
    
    tabQuiz.onclick = showQuizTab;
    tabStore.onclick = showStoreTab;
    
    showQuizTab();
}

function renderQuizQuestion(questions, index, correctCount, movieDetails) {
    const body = document.getElementById('trivia-body');
    if (!body) return;
    
    if (index >= questions.length) {
        const creditsEarned = correctCount * 10;
        let credits = parseInt(localStorage.getItem('trivia_credits') || '0');
        credits += creditsEarned;
        localStorage.setItem('trivia_credits', credits.toString());
        document.getElementById('trivia-credits-value').textContent = credits;
        
        body.innerHTML = `
            <div style="text-align: center; color: #fff;">
                <div style="font-size: 3rem; margin-bottom: 10px;">🎉</div>
                <h4 style="font-size: 1.1rem; font-weight: 800; margin: 0 0 10px 0;">¡QUIZ TERMINADO!</h4>
                <p style="font-size: 0.88rem; color: rgba(255,255,255,0.7); margin-bottom: 20px;">
                    Respuestas correctas: <strong>${correctCount} / ${questions.length}</strong>.<br>
                    Has ganado: <strong style="color: #ffb703;">${creditsEarned} créditos</strong>.
                </p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="store-item-action" id="trivia-replay-btn" style="background: var(--accent); color: #000; padding: 10px 20px; font-size: 0.85rem; border-radius: 12px; font-weight: 700; width: 130px;">Jugar de nuevo</button>
                    <button class="store-item-action" id="trivia-close-modal-btn" style="padding: 10px 20px; font-size: 0.85rem; border-radius: 12px; font-weight: 700; width: 130px;">Cerrar</button>
                </div>
            </div>
        `;
        
        document.getElementById('trivia-replay-btn').onclick = () => {
            initCineTrivia(movieDetails);
        };
        
        document.getElementById('trivia-close-modal-btn').onclick = () => {
            document.getElementById('trivia-modal').classList.remove('active');
        };
        return;
    }
    
    const q = questions[index];
    
    body.innerHTML = `
        <div class="trivia-question-box">
            <span style="font-size: 0.76rem; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">Pregunta ${index + 1} de ${questions.length}</span>
            ${q.text}
        </div>
        <div class="trivia-answers-grid">
            ${q.options.map(opt => `
                <button class="trivia-answer-btn" data-value="${opt.replace(/"/g, '&quot;')}">${opt}</button>
            `).join('')}
        </div>
    `;
    
    const btns = body.querySelectorAll('.trivia-answer-btn');
    let answered = false;
    
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (answered) return;
            answered = true;
            
            const selected = btn.dataset.value;
            const isCorrect = selected === q.correctAnswer;
            
            if (isCorrect) {
                btn.classList.add('correct');
                correctCount++;
            } else {
                btn.classList.add('wrong');
                btns.forEach(b => {
                    if (b.dataset.value === q.correctAnswer) {
                        b.classList.add('correct');
                    }
                });
            }
            
            setTimeout(() => {
                renderQuizQuestion(questions, index + 1, correctCount, movieDetails);
            }, 1500);
        });
    });
}

function renderStore() {
    const body = document.getElementById('trivia-body');
    if (!body) return;
    
    const themesList = [
        { id: 'default', name: 'Neon Cyber Classic', cost: 0, colors: ['#fff', 'rgba(255, 122, 224, 0.7)', 'rgba(122, 95, 255, 0.5)'] },
        { id: 'matrix', name: 'Matrix Green', cost: 40, colors: ['#00ff66', 'rgba(0, 255, 102, 0.8)', 'rgba(0, 255, 102, 0.15)'] },
        { id: 'interstellar', name: 'Interstellar Blue', cost: 60, colors: ['#00d2ff', 'rgba(0, 210, 255, 0.8)', 'rgba(0, 100, 255, 0.15)'] },
        { id: 'barbie', name: 'Barbie Pink', cost: 80, colors: ['#ff007f', 'rgba(255, 0, 127, 0.8)', 'rgba(255, 0, 127, 0.15)'] },
        { id: 'cyberpunk', name: 'Cyberpunk Gold', cost: 100, colors: ['#ffb703', 'rgba(255, 183, 3, 0.8)', 'rgba(255, 183, 3, 0.15)'] }
    ];
    
    let unlocked = [];
    try {
        unlocked = JSON.parse(localStorage.getItem('unlocked_themes') || '["default"]');
    } catch(e) {
        unlocked = ['default'];
    }
    
    let activeTheme = localStorage.getItem('active_theme') || 'default';
    let credits = parseInt(localStorage.getItem('trivia_credits') || '0');
    
    body.innerHTML = `
        <div class="trivia-store-list">
            ${themesList.map(theme => {
                const isUnlocked = unlocked.includes(theme.id);
                const isActive = activeTheme === theme.id;
                
                let btnHTML = '';
                if (isActive) {
                    btnHTML = `<button class="store-item-action active-theme">Equipado</button>`;
                } else if (isUnlocked) {
                    btnHTML = `<button class="store-item-action equip-theme-btn" data-theme="${theme.id}">Equipar</button>`;
                } else {
                    btnHTML = `<button class="store-item-action buy-theme-btn" data-theme="${theme.id}" data-cost="${theme.cost}">Comprar por ${theme.cost}🪙</button>`;
                }
                
                return `
                    <div class="trivia-store-item">
                        <div class="store-item-info">
                            <span class="store-item-name">${theme.name}</span>
                            <div class="store-item-colors">
                                ${theme.colors.map(c => `
                                    <div class="store-color-dot" style="background: ${c};"></div>
                                `).join('')}
                            </div>
                        </div>
                        ${btnHTML}
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    body.querySelectorAll('.equip-theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const th = btn.dataset.theme;
            localStorage.setItem('active_theme', th);
            if (th === 'default') {
                document.documentElement.className = '';
            } else {
                document.documentElement.className = `theme-${th}`;
            }
            renderStore();
        });
    });
    
    body.querySelectorAll('.buy-theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const th = btn.dataset.theme;
            const cost = parseInt(btn.dataset.cost);
            
            if (credits >= cost) {
                credits -= cost;
                localStorage.setItem('trivia_credits', credits.toString());
                document.getElementById('trivia-credits-value').textContent = credits;
                
                unlocked.push(th);
                localStorage.setItem('unlocked_themes', JSON.stringify(unlocked));
                localStorage.setItem('active_theme', th);
                document.documentElement.className = `theme-${th}`;
                
                renderStore();
            } else {
                alert("¡No tienes suficientes créditos! Juega quizzes de trivia para ganar créditos.");
            }
        });
    });
}

function initTriviaModalEvents() {
    const modal = document.getElementById('trivia-modal');
    const closeBtn = document.getElementById('trivia-close-btn');
    if (!modal || !closeBtn) return;
    
    const closeModal = () => {
        modal.classList.remove('active');
    };
    closeBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking on the background backdrop overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}
initTriviaModalEvents();

