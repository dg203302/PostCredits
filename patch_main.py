import re

with open("/home/dg/Documents/GitHub/AfterCredits/Scripts/Main.js", "r") as f:
    code = f.read()

# 1. Add videos to append_to_response
code = code.replace("&append_to_response=credits,external_ids", "&append_to_response=videos,credits,external_ids")

# 2. Add trailer logic to renderMovieDetails
old_trailer_comment = "// Reparto (Cast)"
new_trailer_html = """
    // Trailer
    const trailerVideo = details.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    const trailerBtn = trailerVideo ? `<button class="link-btn trailer-btn" data-trailer-key="${trailerVideo.key}" title="Ver Tráiler">▶ Ver Tráiler</button>` : '';

    // Reparto (Cast)
"""
code = code.replace(old_trailer_comment, new_trailer_html)

old_links_row = """
    <div class="movie-links-row">
        ${imdbLink}
        ${letterboxdLink}
        ${tmdbLink}
    </div>
"""
new_links_row = """
    <div class="movie-links-row">
        ${trailerBtn}
        ${imdbLink}
        ${letterboxdLink}
        ${tmdbLink}
    </div>
"""
code = code.replace(old_links_row, new_links_row)

# 3. Add view transitions
code = code.replace("main.innerHTML = html;", "renderWithTransition(() => { main.innerHTML = html; });")
code = code.replace("""main.innerHTML = `<h2 style="color:white;text-align:center;margin-top:50px;">No se encontraron resultados para "${query}"</h2>`;""", """renderWithTransition(() => { main.innerHTML = `<h2 style="color:white;text-align:center;margin-top:50px;">No se encontraron resultados para "${query}"</h2>`; });""")
code = code.replace("mainContent.innerHTML = html;", "renderWithTransition(() => { mainContent.innerHTML = html; });")
code = code.replace("mainContent.innerHTML = personHTML;", "renderWithTransition(() => { mainContent.innerHTML = personHTML; });")

old_default = """
            main.innerHTML = `
                <section class="media-section">
"""
new_default = """
            renderWithTransition(() => {
                main.innerHTML = `
                <section class="media-section">
"""
code = code.replace(old_default, new_default)

old_default_end = """
                </section>
            `;
            loadDefaultContent();
"""
new_default_end = """
                </section>
            `;
            });
            loadDefaultContent();
"""
code = code.replace(old_default_end, new_default_end)

trailer_logic = """

// --- Modal Trailer ---
document.body.addEventListener('click', (e) => {
    const trailerBtn = e.target.closest('.trailer-btn');
    if (trailerBtn) {
        const key = trailerBtn.dataset.trailerKey;
        if (key) {
            const modal = document.getElementById('trailer-modal');
            const iframe = document.getElementById('trailer-iframe');
            if (modal && iframe) {
                iframe.src = `https://www.youtube.com/embed/${key}?autoplay=1`;
                modal.classList.add('active');
            }
        }
    }
    
    const closeBtn = e.target.closest('.close-modal-btn') || (e.target.classList.contains('trailer-modal'));
    if (closeBtn) {
        const modal = document.getElementById('trailer-modal');
        const iframe = document.getElementById('trailer-iframe');
        if (modal && iframe) {
            modal.classList.remove('active');
            iframe.src = ''; // stop video
        }
    }
});
"""
code += trailer_logic

with open("/home/dg/Documents/GitHub/AfterCredits/Scripts/Main.js", "w") as f:
    f.write(code)
print("Patch applied.")
