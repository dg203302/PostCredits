const header = document.querySelector('[data-header]');
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

const updateHeaderState = () => {
	const isScrolled = window.scrollY > 24;
	document.body.classList.toggle('is-scrolled', isScrolled);
	if (header) {
		header.dataset.state = isScrolled ? 'floating' : 'hero';
	}
};

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

updateHeaderState();
window.addEventListener('scroll', updateHeaderState, { passive: true });
window.addEventListener('resize', updateHeaderState);

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
window.openLightbox = function(mediaHTML) {
    const lightbox = document.getElementById('media-lightbox');
    const body = document.getElementById('lightbox-body');
    if (!lightbox || !body) return;
    body.innerHTML = mediaHTML;
    lightbox.classList.add('active');
};
const lightboxEl = document.getElementById('media-lightbox');
const lightboxCloseEl = document.getElementById('lightbox-close');
if (lightboxEl) {
    lightboxEl.addEventListener('click', (e) => {
        if (e.target === lightboxEl || e.target === lightboxCloseEl) {
            lightboxEl.classList.remove('active');
            document.getElementById('lightbox-body').innerHTML = ''; // Stop video
        }
    });
}

// --- TMDB Background Carousel ---
const TMDB_API_KEY = "ece12ff481fd8f23e34255eadfae14f0";
const BACKDROP_CONTAINER = document.getElementById('backdrop-container');
let currentBackdropIndex = 0;
let backdrops = [];

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
			backdrops = favs.map(movie => ({
				url: `https://image.tmdb.org/t/p/original${movie.backdrop_path}`,
				title: movie.title || "Unknown"
			}));
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
			backdrops = data.results
				.filter(movie => movie.backdrop_path)
				.map(movie => ({
					url: `https://image.tmdb.org/t/p/original${movie.backdrop_path}`,
					title: movie.title || movie.original_title || "Unknown"
				}));
			
			if (backdrops.length > 0) {
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

	const updateTitle = async (index) => {
		if (titleEl && backdrops[index]) {
			titleEl.textContent = backdrops[index].title;
			if (infoEl) infoEl.classList.add('visible');
			
			const smallUrl = backdrops[index].url.replace('original', 'w300');
			const color = await extractColorFromUrl(smallUrl);
			const root = document.documentElement;
			root.style.setProperty('--title-color', `rgb(${Math.min(255, color.r + 80)}, ${Math.min(255, color.g + 80)}, ${Math.min(255, color.b + 80)})`);
			root.style.setProperty('--title-glow', `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`);
			root.style.setProperty('--title-glow-dim', `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`);
			root.style.setProperty('--title-glow-dimmer', `rgba(${color.r}, ${color.g}, ${color.b}, 0.4)`);
			root.style.setProperty('--search-bg', `rgba(${color.r}, ${color.g}, ${color.b}, 0.35)`);
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

	// Cambiar el fondo cada 8 segundos
	carouselInterval = setInterval(() => {
		const backdropElements = BACKDROP_CONTAINER.querySelectorAll('.backdrop');
		if (backdropElements.length <= 1) return;

		backdropElements[currentBackdropIndex].classList.remove('active');
		if (infoEl) infoEl.classList.remove('visible');

		currentBackdropIndex = (currentBackdropIndex + 1) % backdropElements.length;
		backdropElements[currentBackdropIndex].classList.add('active');

		setTimeout(() => {
			updateTitle(currentBackdropIndex);
		}, 600);
	}, 8000);
}

// Iniciar el ciclo al cargar la página
fetchLatestBackdrops();

async function loadMovieBackdrops(id, mediaType, defaultTitle) {
	try {
		const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${id}/images?api_key=${TMDB_API_KEY}`);
		const data = await res.json();
		
		if (data.backdrops && data.backdrops.length > 0) {
			backdrops = data.backdrops.slice(0, 10).map(img => ({
				url: `https://image.tmdb.org/t/p/original${img.file_path}`,
				title: defaultTitle
			}));
			initCarousel();
            const settingsBtn = document.getElementById('settings-backdrop-btn');
            if (settingsBtn) settingsBtn.style.display = 'none';
		}
	} catch(e) {
		console.error("Error fetching specific backdrops", e);
	}
}

// Lógica del botón para ver el Backdrop
const viewBackdropBtn = document.getElementById('view-backdrop-btn');

if (viewBackdropBtn) {
	viewBackdropBtn.addEventListener('click', () => {
		document.body.classList.toggle('backdrop-view-mode');
	});
}

// Settings Menu Logic
const settingsBtn = document.getElementById('settings-backdrop-btn');
const settingsMenu = document.getElementById('backdrop-settings-menu');
const bgSourceRadios = document.querySelectorAll('input[name="bg-source"]');

if (settingsBtn && settingsMenu) {
	settingsBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		settingsMenu.classList.toggle('active');
		if (settingsMenu.classList.contains('active')) {
			renderSettingsFavorites();
		}
	});
	document.addEventListener('click', (e) => {
		if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
			settingsMenu.classList.remove('active');
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
			settingsMenu.classList.remove('active');
			fetchLatestBackdrops();
		});
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

function renderSettingsFavorites() {
    const favList = document.getElementById('settings-favorites-list');
    if (!favList) return;
    const favs = JSON.parse(localStorage.getItem('postCreditsFavs') || '[]');
    
    if (favs.length === 0) {
        favList.innerHTML = '<span style="color: var(--muted); font-size: 0.85rem;">No favorites added yet.</span>';
        return;
    }
    
    favList.innerHTML = favs.map(f => {
        const poster = f.poster_path ? `https://image.tmdb.org/t/p/w200${f.poster_path}` : (f.backdrop_path ? `https://image.tmdb.org/t/p/w200${f.backdrop_path}` : 'https://via.placeholder.com/40x40?text=?');
        return `<img src="${poster}" title="${f.title}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent); flex-shrink: 0;">`;
    }).join('');
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
                            <div style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
                                <img src="${poster}" style="width: 32px; height: 48px; object-fit: cover; border-radius: 4px; flex-shrink: 0;">
                                <div style="flex: 1; min-width: 0;">
                                    <p style="margin: 0; font-size: 0.9rem; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff;" title="${title}">${title}</p>
                                    <p style="margin: 0; font-size: 0.75rem; color: var(--muted);">${item.media_type === 'movie' ? 'Movie' : 'TV Show'}</p>
                                </div>
                                <button class="mini-fav-btn fav-btn ${isFav ? 'active' : ''}" data-id="${item.id}" style="padding: 6px; font-size: 1rem; border-radius: 50%; min-width: 32px; height: 32px;">
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
                    resultsContainer.innerHTML = '<span style="color: var(--muted); font-size: 0.85rem; padding: 8px;">No results found.</span>';
                }
            } catch (err) {
                console.error(err);
            }
        }, 400);
    });
}

// --- Dynamic Main Content ---
async function renderSection(endpoint, containerId, params = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const lang = navigator.language || 'es-MX';
        const response = await fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&language=${lang}${params}`);
        const data = await response.json();
        
        if (data.results) {
            const validItems = data.results.filter(item => item.poster_path || item.profile_path);
            const initialItems = validItems.slice(0, 6);
            const remainingItems = validItems.slice(6);

            const generateCardHTML = (item) => {
                const title = item.title || item.name;
                const posterPath = item.poster_path || item.profile_path;
                const poster = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : '';
                const type = item.media_type || (endpoint.includes('tv') ? 'tv' : (endpoint.includes('person') ? 'person' : 'movie'));
                
                let extraInfo = '';
                if (type === 'person') {
                    const knownFor = item.known_for_department ? item.known_for_department : 'Acting';
                    extraInfo = `<p class="media-card-extra">${knownFor}</p>`;
                } else {
                    const date = item.release_date || item.first_air_date;
                    const year = date ? date.split('-')[0] : '';
                    const rating = item.vote_average ? `⭐ ${item.vote_average.toFixed(1)}` : '';
                    if (year || rating) {
                        extraInfo = `<p class="media-card-extra">${year} ${year && rating ? '&bull;' : ''} ${rating}</p>`;
                    }
                }

                return `
                    <div class="media-card" data-id="${item.id}" data-type="${type}" data-title="${title.replace(/"/g, '&quot;')}">
                        <img src="${poster}" alt="${title}" loading="lazy">
                        <div class="title-overlay">
                            <span class="media-card-title">${title}</span>
                            ${extraInfo}
                        </div>
                    </div>
                `;
            };

            container.innerHTML = initialItems.map(generateCardHTML).join('');

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
                            const detailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,external_ids,videos,images`);
                            const details = await detailsRes.json();
                            renderMovieDetails(details, type);
                        }
                    } catch(err) {
                        console.error(err);
                    }
                });
            };

            container.querySelectorAll('.media-card').forEach(attachListenerToCard);

            if (remainingItems.length > 0) {
                const showMoreIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
                const showLessIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
                
                const btnHTML = `
                    <div class="show-more-wrapper" style="grid-column: 1 / -1; text-align: center; margin-top: 10px; margin-bottom: 10px;">
                        <button class="go-back-btn show-more-btn" style="position: relative; top: auto; left: auto; margin: 0; box-shadow: none;" title="Show more">
                            ${showMoreIcon}
                        </button>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', btnHTML);
                
                const wrapper = container.querySelector('.show-more-wrapper');
                const btn = wrapper.querySelector('.show-more-btn');
                
                let isExpanded = false;
                let extraCards = [];
                
                btn.addEventListener('click', () => {
                    if (!isExpanded) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = remainingItems.map(generateCardHTML).join('');
                        extraCards = Array.from(tempDiv.children);
                        extraCards.forEach(card => {
                            container.insertBefore(card, wrapper);
                            attachListenerToCard(card);
                        });
                        btn.innerHTML = showLessIcon;
                        btn.title = "Show less";
                        isExpanded = true;
                    } else {
                        extraCards.forEach(card => card.remove());
                        extraCards = [];
                        btn.innerHTML = showMoreIcon;
                        btn.title = "Show more";
                        isExpanded = false;
                        
                        // Scroll back to the section title if needed
                        const sectionTop = container.parentElement.getBoundingClientRect().top + window.scrollY - 80;
                        window.scrollTo({ top: sectionTop, behavior: 'smooth' });
                    }
                });
            }
        }
    } catch (error) {
        console.error("Error al cargar la sección " + containerId, error);
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
    // Cargar personas en tendencia
    await renderSection('trending/person/week', 'trending-people-list');
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
        backdrops: typeof backdrops !== 'undefined' ? [...backdrops] : [],
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
            if (searchInput) {
                searchInput.value = prevState.searchValue;
            }
            if (prevState.backdrops && prevState.backdrops.length > 0) {
                backdrops = prevState.backdrops;
                initCarousel();
                const settingsBtn = document.getElementById('settings-backdrop-btn');
                if (settingsBtn) settingsBtn.style.display = prevState.settingsBtnDisplay;
                const labelEl = document.getElementById('backdrop-label');
                if (labelEl) labelEl.textContent = prevState.labelContent;
            }
        }
        
        window.scrollTo({ top: prevState.scrollY, behavior: 'instant' });
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
        <section class="media-section"><h2 class="section-title">In Theaters Near You</h2><div class="media-grid" id="now-playing-list"></div></section>
        <section class="media-section"><h2 class="section-title">Trending Movies</h2><div class="media-grid" id="trending-movies-list"></div></section>
        <section class="media-section"><h2 class="section-title">Latest Series</h2><div class="media-grid" id="trending-tv-list"></div></section>
        <section class="media-section"><h2 class="section-title">Trending People</h2><div class="media-grid" id="trending-people-list"></div></section>
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
    `;
    loadDefaultContent();
    fetchLatestBackdrops();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

const homeTitleBtn = document.querySelector('.hero-header__title');
if (homeTitleBtn) {
    homeTitleBtn.addEventListener('click', () => {
        if (document.body.classList.contains('is-scrolled')) {
            restoreHome();
        }
    });
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
                                        const detailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,external_ids,videos,images`);
                                        const details = await detailsRes.json();
                                        renderMovieDetails(details, type);
                                    }
                                } catch(err) {
                                    console.error(err);
                                }
                            });
                        });
                    } else {
                        main.innerHTML = `<h2 style="color:white;text-align:center;margin-top:50px;">No results found for "${query}"</h2>`;
                    }
                } else {
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
    const main = document.getElementById('main-content');
    
    const title = details.title || details.name;
    const year = (details.release_date || details.first_air_date || '').split('-')[0];
    const poster = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : 'https://via.placeholder.com/300x450?text=No+Poster';
    
    // Meta data
    const genres = details.genres ? details.genres.map(g => `<span class="cinematic-genre">${g.name}</span>`).join('') : '';
    const runtimeStr = details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : (details.episode_run_time && details.episode_run_time[0] ? `${details.episode_run_time[0]}m` : '');
    const language = details.spoken_languages && details.spoken_languages.length > 0 ? details.spoken_languages[0].english_name : (details.original_language ? details.original_language.toUpperCase() : '');
    
    const metaLineItems = [year, runtimeStr, language ? `Language : ${language}` : ''].filter(Boolean);
    const metaLine = metaLineItems.join(' | ');

    let director = '';
    if (details.credits && details.credits.crew) {
        const dirObj = details.credits.crew.find(c => c.job === 'Director' || c.job === 'Executive Producer' || c.job === 'Series Director');
        if (dirObj) director = `Directed by : <span class="clickable-person" data-id="${dirObj.id}">${dirObj.name}</span>`;
    }

    const ratingRaw = details.vote_average || 0;
    const ratingStr = ratingRaw > 0 ? ratingRaw.toFixed(1) : 'NR';

    // Enlaces externos
    const imdbLink = details.external_ids && details.external_ids.imdb_id ? `<a href="https://www.imdb.com/title/${details.external_ids.imdb_id}" target="_blank" class="link-btn imdb" title="IMDb"><img src="https://upload.wikimedia.org/wikipedia/commons/6/69/IMDB_Logo_2016.svg" alt="IMDb"></a>` : '';
    let letterboxdLink = '';
    if (mediaType === 'movie') {
        letterboxdLink = `<a href="https://letterboxd.com/tmdb/${details.id}" target="_blank" class="link-btn letterboxd" title="Letterboxd"><img src="https://a.ltrbxd.com/logos/letterboxd-logo-h-neg-rgb-1000px.png" alt="Letterboxd"></a>`;
    }
    const tmdbLink = `<a href="https://www.themoviedb.org/${mediaType}/${details.id}" target="_blank" class="link-btn tmdb-link" title="TMDB"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB"></a>`;
    const favClass = isFavorite(details.id) ? 'active' : '';
    const favButton = `<button class="fav-btn ${favClass}" id="fav-btn" data-id="${details.id}" title="Toggle Favorite"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></button>`;

    // Rating Circle (replacing laurels)
    const ratingHTML = `
        <div class="cinematic-rating-circle" style="transform: scale(0.8); transform-origin: left center; margin: 0;">
            <svg viewBox="0 0 36 36" class="circular-chart yellow">
                <path class="circle-bg"
                d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path class="circle"
                stroke-dasharray="${ratingRaw * 10}, 100"
                d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" class="percentage">${ratingStr}</text>
            </svg>
            <span class="rating-label" style="display: block; text-align: center; margin-top: 5px; font-weight: bold; font-size: 1.2rem;">TMDB</span>
        </div>
    `;

    // Tagline / Quote
    const quoteText = details.tagline || 'A THRILLING ADVENTURE THAT WILL KEEP YOU ON EDGE.';

    // Synopsis Heading
    let overviewParts = (details.overview || 'A journey begins.').split('. ');
    let synopsisHeading = overviewParts[0] ? overviewParts[0].toUpperCase() + '.' : 'THE TELLING OF TWO INTERTWINING LIVES.';
    let overviewRest = overviewParts.slice(1).join('. ');
    if(!overviewRest) overviewRest = details.overview || 'Sin descripción disponible.';

    // Media (Trailers & Captures)
    let trailerKey = '';
    if (details.videos && details.videos.results) {
        const trailer = details.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        if (trailer) trailerKey = trailer.key;
    }
    let backdrops = [];
    if (details.images && details.images.backdrops) {
        backdrops = details.images.backdrops.slice(0, 4);
    }
    
    let leftImg = backdrops[0] ? `https://image.tmdb.org/t/p/w780${backdrops[0].file_path}` : poster;
    let rightImg = backdrops[1] ? `https://image.tmdb.org/t/p/w780${backdrops[1].file_path}` : poster;
    let centerMedia = '';
    if (trailerKey) {
        centerMedia = `
            <div class="logan-media-center">
                <iframe src="https://www.youtube.com/embed/${trailerKey}?rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
        `;
    } else if (backdrops[2]) {
        centerMedia = `
            <div class="logan-media-center" onclick="openLightbox('<img src=\\'https://image.tmdb.org/t/p/w1280${backdrops[2].file_path}\\'>')" style="cursor: pointer;">
                <img src="https://image.tmdb.org/t/p/w1280${backdrops[2].file_path}" alt="Capture">
                <div class="media-overlay-text">
                    <h3>SCENE CAPTURE</h3>
                    <p>${title}</p>
                </div>
            </div>
        `;
    } else {
        centerMedia = `
            <div class="logan-media-center" onclick="openLightbox('<img src=\\'${poster}\\'>')" style="cursor: pointer;">
                <img src="${poster}" alt="Poster" style="object-fit: contain;">
            </div>
        `;
    }

    // News/Cast
    let newsHTML = '';
    if (details.credits && details.credits.cast) {
        const topCast = details.credits.cast.slice(0, 2);
        newsHTML = topCast.map(actor => {
            const img = actor.profile_path ? `https://image.tmdb.org/t/p/h632${actor.profile_path}` : poster;
            return `
                <div class="logan-news-card clickable-person" data-id="${actor.id}">
                    <img src="${img}" alt="${actor.name}">
                    <div class="logan-news-card-content">
                        <span class="tag">CAST</span> <span class="date">FEATURED</span>
                        <h2>${actor.name.toUpperCase()} AS ${actor.character ? actor.character.toUpperCase() : 'STAR'}</h2>
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
            <div class="cinematic-hero-overlay"></div>
            
            <div class="cinematic-hero-content">
                <img class="cinematic-hero-poster-bg" src="${poster}" alt="">
                <h1 class="cinematic-title-logan">${title.toUpperCase()}</h1>
                
                <div class="cinematic-quote-section">
                    <p class="cinematic-quote">"${quoteText}"</p>
                    <div class="cinematic-laurels">
                        ${ratingHTML}
                    </div>
                </div>
            </div>

            <div class="logan-synopsis-section">
                <div class="logan-synopsis-left">
                    <h4>SYNOPSIS</h4>
                    <h2>${synopsisHeading}</h2>
                </div>
                <div class="logan-synopsis-right">
                    <p>${overviewRest}</p>
                </div>
            </div>

            <div class="logan-media-section">
                <img class="logan-media-side" src="${leftImg}" alt="Scene" onclick="openLightbox('<img src=\\'${leftImg}\\'>')" style="cursor: pointer;">
                ${centerMedia}
                <img class="logan-media-side" src="${rightImg}" alt="Scene" onclick="openLightbox('<img src=\\'${rightImg}\\'>')" style="cursor: pointer;">
            </div>

            ${newsHTML ? `
            <div class="logan-news-section">
                <h4>CAST & CREW</h4>
                <div class="logan-news-grid">
                    ${newsHTML}
                </div>
            </div>
            ` : ''}

            <div class="logan-footer-info">
                <div class="director-info">
                    ${director ? `<span>${director}</span>` : `<span>${title}</span>`}
                </div>
                <div class="movie-links-row">
                    ${favButton}
                    ${letterboxdLink}
                    ${imdbLink}
                    ${tmdbLink}
                </div>
            </div>
        </div>
    `;

    main.innerHTML = html;
    
    // Extract and apply poster color
    if (details.poster_path) {
        const smallPoster = `https://image.tmdb.org/t/p/w300${details.poster_path}`;
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

    // Attach listeners for clickable people
    main.querySelectorAll('.clickable-person').forEach(el => {
        el.addEventListener('click', async () => {
            const personId = el.dataset.id;
            const lang = navigator.language || 'es-MX';
            saveCurrentState();
            window.scrollTo({ top: 30, behavior: 'smooth' });
            try {
                const detailsRes = await fetch(`https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=combined_credits,external_ids`);
                const personDetails = await detailsRes.json();
                renderPersonDetails(personDetails);
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
            const cardTitle = card.dataset.title;
            if (searchInput) searchInput.value = cardTitle;
            saveCurrentState();
            window.scrollTo({ top: 30, behavior: 'smooth' });
            try {
                const lang = navigator.language || 'es-MX';
                const detailsRes = await fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=combined_credits,external_ids`);
                const personDetails = await detailsRes.json();
                renderPersonDetails(personDetails);
            } catch(err) {
                console.error(err);
            }
        });
    });
}

function renderPersonDetails(details) {
    pushNavState();
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

    // Media (from combined_credits)
    let topCreditsMedia = [];
    if (details.combined_credits && details.combined_credits.cast) {
        topCreditsMedia = details.combined_credits.cast
            .filter(c => c.backdrop_path)
            .sort((a,b) => b.popularity - a.popularity)
            .slice(0, 3);
    }
    
    let leftImg = topCreditsMedia[0] ? `https://image.tmdb.org/t/p/w780${topCreditsMedia[0].backdrop_path}` : profile;
    let rightImg = topCreditsMedia[1] ? `https://image.tmdb.org/t/p/w780${topCreditsMedia[1].backdrop_path}` : profile;
    let centerMedia = '';
    if (topCreditsMedia[2]) {
        centerMedia = `
            <div class="logan-media-center" onclick="openLightbox('<img src=\\'https://image.tmdb.org/t/p/w1280${topCreditsMedia[2].backdrop_path}\\'>')" style="cursor: pointer;">
                <img src="https://image.tmdb.org/t/p/w1280${topCreditsMedia[2].backdrop_path}" alt="Capture">
                <div class="media-overlay-text">
                    <h3>SCENE CAPTURE</h3>
                    <p>${topCreditsMedia[2].title || topCreditsMedia[2].name}</p>
                </div>
            </div>
        `;
    } else {
        centerMedia = `
            <div class="logan-media-center" onclick="openLightbox('<img src=\\'${profile}\\'>')" style="cursor: pointer;">
                <img src="${profile}" alt="Profile" style="object-fit: contain;">
            </div>
        `;
    }

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
                <img class="logan-media-side" src="${leftImg}" alt="Scene" onclick="openLightbox('<img src=\\'${leftImg}\\'>')" style="cursor: pointer;">
                ${centerMedia}
                <img class="logan-media-side" src="${rightImg}" alt="Scene" onclick="openLightbox('<img src=\\'${rightImg}\\'>')" style="cursor: pointer;">
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
                const detailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,external_ids,videos,images`);
                const creditDetails = await detailsRes.json();
                renderMovieDetails(creditDetails, type);
            } catch(err) {
                console.error(err);
            }
        });
    });
}

// --- Back to top functionality ---
const backToTopBtn = document.getElementById('back-to-top-btn');
if (backToTopBtn) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    }, { passive: true });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

