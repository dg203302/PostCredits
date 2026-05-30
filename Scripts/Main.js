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

function initCarousel() {
	const infoEl = document.getElementById('backdrop-info');
	const titleEl = document.getElementById('backdrop-title');

	const updateTitle = (index) => {
		if (titleEl && backdrops[index]) {
			titleEl.textContent = backdrops[index].title;
			if (infoEl) infoEl.classList.add('visible');
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

                    window.scrollTo({ top: 30, behavior: 'smooth' });
                    
                    try {
                        const lang = navigator.language || 'es-MX';
                        if (type === 'person') {
                            const detailsRes = await fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=combined_credits,external_ids`);
                            const details = await detailsRes.json();
                            renderPersonDetails(details);
                        } else {
                            const detailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,external_ids,videos`);
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
                const btnHTML = `
                    <div class="show-more-wrapper" style="grid-column: 1 / -1; text-align: center; margin-top: 10px; margin-bottom: 10px;">
                        <button class="go-back-btn show-more-btn" style="position: relative; top: auto; left: auto; margin: 0; box-shadow: none;">
                            Show more (${remainingItems.length})
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
                        btn.textContent = 'Show less';
                        isExpanded = true;
                    } else {
                        extraCards.forEach(card => card.remove());
                        extraCards = [];
                        btn.textContent = `Show more (${remainingItems.length})`;
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

function restoreHome() {
    const main = document.getElementById('main-content');
    if (searchInput) searchInput.value = '';
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

                                window.scrollTo({ top: 30, behavior: 'smooth' });
                                try {
                                    if (type === 'person') {
                                        const detailsRes = await fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=combined_credits,external_ids`);
                                        const details = await detailsRes.json();
                                        renderPersonDetails(details);
                                    } else {
                                        const detailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,external_ids,videos`);
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
    const main = document.getElementById('main-content');
    
    const title = details.title || details.name;
    const year = (details.release_date || details.first_air_date || '').split('-')[0];
    const poster = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : 'https://via.placeholder.com/300x450?text=No+Poster';
    
    // Meta data (Géneros, Duración, Puntuación)
    const genres = details.genres ? details.genres.map(g => `<span>${g.name}</span>`).join('') : '';
    const runtime = details.runtime ? `<span>${details.runtime} min</span>` : (details.episode_run_time && details.episode_run_time[0] ? `<span>${details.episode_run_time[0]} min</span>` : '');
    const rating = details.vote_average ? `<span>⭐ ${details.vote_average.toFixed(1)}/10</span>` : '';

    // Enlaces externos
    const imdbLink = details.external_ids && details.external_ids.imdb_id ? `<a href="https://www.imdb.com/title/${details.external_ids.imdb_id}" target="_blank" class="link-btn imdb" title="IMDb"><img src="https://upload.wikimedia.org/wikipedia/commons/6/69/IMDB_Logo_2016.svg" alt="IMDb"></a>` : '';
    let letterboxdLink = '';
    if (mediaType === 'movie') {
        letterboxdLink = `<a href="https://letterboxd.com/tmdb/${details.id}" target="_blank" class="link-btn letterboxd" title="Letterboxd"><img src="https://a.ltrbxd.com/logos/letterboxd-logo-h-neg-rgb-1000px.png" alt="Letterboxd"></a>`;
    }
    const tmdbLink = `<a href="https://www.themoviedb.org/${mediaType}/${details.id}" target="_blank" class="link-btn tmdb-link" title="TMDB"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB"></a>`;

    // Reparto (Cast)
    let castHTML = '';
    if (details.credits && details.credits.cast) {
        const topCast = details.credits.cast.slice(0, 15);
        castHTML = topCast.map(actor => {
            const actorImg = actor.profile_path ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` : 'https://via.placeholder.com/200x300?text=No+Image';
            return `
                <div class="media-card cast-card" data-id="${actor.id}" data-type="person" data-title="${actor.name.replace(/"/g, '&quot;')}">
                    <img src="${actorImg}" alt="${actor.name}" loading="lazy">
                    <div class="title-overlay">
                        <p class="cast-name">${actor.name}</p>
                        <p class="cast-char">${actor.character}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Trailers
    let trailersHTML = '';
    if (details.videos && details.videos.results) {
        // Filtrar trailers oficiales de YouTube
        const trailers = details.videos.results.filter(v => v.site === 'YouTube' && v.type === 'Trailer');
        if (trailers.length > 0) {
            const topTrailers = trailers.slice(0, 2);
            trailersHTML = topTrailers.map(trailer => `
                <div class="trailer-wrapper">
                    <iframe 
                        src="https://www.youtube.com/embed/${trailer.key}?controls=1&modestbranding=1&rel=0" 
                        title="${trailer.name}" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>
            `).join('');
        }
    }

    // Additional info grid
    const formatCurrency = (val) => val ? `$${(val / 1000000).toFixed(1)}M` : '';
    const extraDetailsList = [];
    if (details.status) extraDetailsList.push(`<div class="info-item"><span class="info-label">Status</span><span class="info-value">${details.status}</span></div>`);
    if (details.original_language) extraDetailsList.push(`<div class="info-item"><span class="info-label">Language</span><span class="info-value">${details.original_language.toUpperCase()}</span></div>`);
    if (details.budget) extraDetailsList.push(`<div class="info-item"><span class="info-label">Budget</span><span class="info-value">${formatCurrency(details.budget)}</span></div>`);
    if (details.revenue) extraDetailsList.push(`<div class="info-item"><span class="info-label">Revenue</span><span class="info-value">${formatCurrency(details.revenue)}</span></div>`);
    if (details.number_of_seasons) extraDetailsList.push(`<div class="info-item"><span class="info-label">Seasons</span><span class="info-value">${details.number_of_seasons}</span></div>`);
    if (details.number_of_episodes) extraDetailsList.push(`<div class="info-item"><span class="info-label">Episodes</span><span class="info-value">${details.number_of_episodes}</span></div>`);

    const extraDetailsHTML = extraDetailsList.length > 0 ? `
        <div class="movie-extra-grid">
            ${extraDetailsList.join('')}
        </div>
    ` : '';

    const favClass = isFavorite(details.id) ? 'active' : '';
    const favButton = `<button class="fav-btn ${favClass}" id="fav-btn" data-id="${details.id}" title="Toggle Favorite"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></button>`;

    const html = `
        <div class="movie-details-container">
            <div>
                <button class="go-back-btn" onclick="restoreHome()" title="Volver al inicio">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Volver
                </button>
            </div>
            <div class="movie-header">
                <img class="movie-poster" src="${poster}" alt="${title}">
                <div class="movie-info">
                    <h1>${title} ${year ? `(${year})` : ''}</h1>
                    ${details.tagline ? `<p class="movie-tagline">"${details.tagline}"</p>` : ''}
                    <div class="movie-meta">
                        ${rating}
                        ${runtime}
                        ${genres}
                    </div>
                    <p class="movie-overview">${details.overview || 'Sin descripción disponible.'}</p>
                    ${extraDetailsHTML}
                    <div class="movie-links-row">
                        ${favButton}
                        ${letterboxdLink}
                        ${imdbLink}
                        ${tmdbLink}
                    </div>
                </div>
            </div>
            ${trailersHTML ? `
            <div class="movie-trailers-section" style="margin-top: 32px;">
                <h2 class="section-title">Trailers</h2>
                <div class="trailers-grid">
                    ${trailersHTML}
                </div>
            </div>
            ` : ''}
            ${castHTML ? `
            <div class="movie-cast-section" style="margin-top: 24px;">
                <h2 class="section-title">Cast / Reparto</h2>
                <div class="media-scroller">
                    ${castHTML}
                </div>
            </div>
            ` : ''}
        </div>
    `;

    main.innerHTML = html;
    
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
    // Cargar backdrops específicos de la película
    loadMovieBackdrops(details.id, mediaType, title);

    // Click listener para el cast
    main.querySelectorAll('.cast-card').forEach(card => {
        card.addEventListener('click', async () => {
            const id = card.dataset.id;
            const cardTitle = card.dataset.title;
            if (searchInput) searchInput.value = cardTitle;
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

    // Known For
    let knownForHTML = '';
    if (details.combined_credits && details.combined_credits.cast) {
        // Ordenar por popularidad y mostrar los 15 mejores
        const topCredits = details.combined_credits.cast
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 15);
            
        knownForHTML = topCredits.map(credit => {
            const creditTitle = credit.title || credit.name;
            const creditImg = credit.poster_path ? `https://image.tmdb.org/t/p/w200${credit.poster_path}` : 'https://via.placeholder.com/200x300?text=No+Image';
            const creditType = credit.media_type || 'movie';
            
            return `
                <div class="media-card cast-card" data-id="${credit.id}" data-type="${creditType}" data-title="${creditTitle.replace(/"/g, '&quot;')}">
                    <img src="${creditImg}" alt="${creditTitle}" loading="lazy">
                    <div class="title-overlay">
                        <p class="cast-name">${creditTitle}</p>
                        <p class="cast-char">${credit.character || ''}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Extra info grid
    const extraDetailsList = [];
    if (details.known_for_department) extraDetailsList.push(`<div class="info-item"><span class="info-label">Known For</span><span class="info-value">${details.known_for_department}</span></div>`);
    if (details.gender) extraDetailsList.push(`<div class="info-item"><span class="info-label">Gender</span><span class="info-value">${details.gender === 1 ? 'Female' : details.gender === 2 ? 'Male' : 'Unknown'}</span></div>`);
    if (details.birthday) extraDetailsList.push(`<div class="info-item"><span class="info-label">Born</span><span class="info-value">${details.birthday}</span></div>`);
    if (details.deathday) extraDetailsList.push(`<div class="info-item"><span class="info-label">Died</span><span class="info-value">${details.deathday}</span></div>`);
    if (details.place_of_birth) extraDetailsList.push(`<div class="info-item"><span class="info-label">Birthplace</span><span class="info-value">${details.place_of_birth}</span></div>`);

    const extraDetailsHTML = extraDetailsList.length > 0 ? `
        <div class="movie-extra-grid">
            ${extraDetailsList.join('')}
        </div>
    ` : '';

    let bioHTML = '<p class="movie-overview" style="margin-top: 16px;">Sin biografía disponible.</p>';
    if (details.biography) {
        const paragraphs = details.biography.split('\n').filter(p => p.trim() !== '');
        const formattedBio = paragraphs.map(p => `<p class="bio-paragraph">${p}</p>`).join('');
        const isLong = details.biography.length > 400 || paragraphs.length > 2;
        bioHTML = `
            <div class="person-biography-container">
                <div class="person-biography-content ${isLong ? 'collapsed' : 'expanded'}" id="bio-content">
                    ${formattedBio}
                </div>
                ${isLong ? `
                <button class="read-more-btn" id="read-more-btn">
                    <span>Read more</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="read-more-icon" style="transition: transform 0.3s ease;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                ` : ''}
            </div>
        `;
    }

    const html = `
        <div class="movie-details-container">
            <div>
                <button class="go-back-btn" onclick="restoreHome()" title="Volver al inicio">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Volver
                </button>
            </div>
            <div class="movie-header">
                <img class="movie-poster" src="${profile}" alt="${name}">
                <div class="movie-info">
                    <h1>${name}</h1>
                    ${bioHTML}
                    ${extraDetailsHTML}
                    <div class="movie-links-row">
                        ${letterboxdLink}
                        ${imdbLink}
                        ${tmdbLink}
                    </div>
                </div>
            </div>
            ${knownForHTML ? `
            <div class="movie-cast-section" style="margin-top: 24px;">
                <h2 class="section-title">Known For / Conocido por</h2>
                <div class="media-scroller">
                    ${knownForHTML}
                </div>
            </div>
            ` : ''}
        </div>
    `;

    main.innerHTML = html;
    
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
            window.scrollTo({ top: 30, behavior: 'smooth' });
            try {
                const lang = navigator.language || 'es-MX';
                const detailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${lang}&append_to_response=credits,external_ids,videos`);
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

