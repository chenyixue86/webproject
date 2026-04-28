const ANILIST = 'https://graphql.anilist.co';
const API = 'http://127.0.0.1:5000';

let currentUser = null;
let userFavorites = new Set();
let favoritesData = [];
let currentModalAnime = null;

let allAnime = [];
let currentTab = 'airing';
let currentSort = 'score';

const MEDIA_FIELDS = `
  id
  idMal
  title { english romaji }
  coverImage { extraLarge large }
  bannerImage
  description(asHtml: false)
  episodes
  status
  format
  season
  seasonYear
  averageScore
  genres
  tags { name rank isGeneralSpoiler }
  trailer { id site }
  nextAiringEpisode { episode airingAt }
  startDate { year month day }
  endDate { year month day }
  studios(isMain: true) { nodes { name } }
  streamingEpisodes { title thumbnail url site }
`;

async function gqlFetch(queryStr, variables = {}) {
    showLoading();
    try {
        const res = await fetch(ANILIST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryStr, variables })
        });
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0].message);
        return json.data;
    } catch {
        showError();
        return null;
    }
}

function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    let season;
    if (month <= 3) season = 'WINTER';
    else if (month <= 6) season = 'SPRING';
    else if (month <= 9) season = 'SUMMER';
    else season = 'FALL';
    return { season, year };
}

function getNextSeason() {
    const { season, year } = getCurrentSeason();
    const order = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
    const idx = order.indexOf(season);
    return idx === 3
        ? { season: 'WINTER', year: year + 1 }
        : { season: order[idx + 1], year };
}

function getSeasonLabel(season, year) {
    const labels = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall' };
    return `${labels[season] || season} ${year}`;
}

function scoreColor(score) {
    if (!score) return '#555';
    if (score >= 80) return '#22c55e';
    if (score >= 70) return '#84cc16';
    if (score >= 60) return '#eab308';
    return '#ef4444';
}

function mapStatus(status) {
    const map = {
        RELEASING: 'Airing',
        NOT_YET_RELEASED: 'Upcoming',
        FINISHED: 'Finished',
        CANCELLED: 'Cancelled',
        HIATUS: 'On Hiatus'
    };
    return map[status] || status;
}

function mapFormat(format) {
    const map = {
        TV: 'TV', TV_SHORT: 'TV Short', MOVIE: 'Movie',
        SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music'
    };
    return map[format] || format || '?';
}

function statusClass(status) {
    if (status === 'RELEASING') return 'status-airing';
    if (status === 'NOT_YET_RELEASED') return 'status-upcoming';
    return 'status-done';
}

function formatReleaseDate(startDate) {
    if (!startDate?.year) return 'TBA';
    const { year, month, day } = startDate;
    if (month && day) {
        return new Date(year, month - 1, day)
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (month) {
        return new Date(year, month - 1, 1)
            .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return `${year}`;
}

function formatAiring(next) {
    if (!next) return null;
    const diff = next.airingAt - Date.now() / 1000;
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return `EP ${next.episode} in ${days}d`;
    if (hours > 0) return `EP ${next.episode} in ${hours}h`;
    return `EP ${next.episode} airing soon`;
}

function sorted(anime) {
    return [...anime].sort((a, b) => {
        if (currentSort === 'score') return (b.averageScore || 0) - (a.averageScore || 0);
        if (currentSort === 'date') {
            const toTs = s => s?.year
                ? new Date(s.year, (s.month || 1) - 1, s.day || 1).getTime()
                : Infinity;
            return toTs(a.startDate) - toTs(b.startDate);
        }
        if (currentSort === 'episodes') return (b.episodes || 0) - (a.episodes || 0);
        return 0;
    });
}

const LIST_QUERY = `
query($season: MediaSeason, $year: Int, $sort: [MediaSort]) {
    Page(page: 1, perPage: 30) {
        media(season: $season, seasonYear: $year, type: ANIME, sort: $sort) {
            ${MEDIA_FIELDS}
        }
    }
}`;

const TOP_QUERY = `
query {
    Page(page: 1, perPage: 30) {
        media(type: ANIME, sort: SCORE_DESC, status: FINISHED) {
            ${MEDIA_FIELDS}
        }
    }
}`;

async function loadAiring() {
    const { season, year } = getCurrentSeason();
    document.getElementById('season-badge').textContent = getSeasonLabel(season, year);
    document.getElementById('page-title').textContent = 'Currently Airing';
    const data = await gqlFetch(LIST_QUERY, { season, year, sort: ['SCORE_DESC'] });
    if (!data) return;
    allAnime = data.Page.media;
    renderGrid(sorted(allAnime));
}

async function loadUpcoming() {
    const { season, year } = getNextSeason();
    document.getElementById('season-badge').textContent = 'Coming Soon';
    document.getElementById('page-title').textContent = 'Upcoming Anime';
    const data = await gqlFetch(LIST_QUERY, { season, year, sort: ['POPULARITY_DESC'] });
    if (!data) return;
    allAnime = data.Page.media;
    renderGrid(sorted(allAnime));
}

async function loadTop() {
    document.getElementById('season-badge').textContent = 'All Time';
    document.getElementById('page-title').textContent = 'Top Anime';
    const data = await gqlFetch(TOP_QUERY);
    if (!data) return;
    allAnime = data.Page.media;
    renderGrid(sorted(allAnime));
}

function reload() {
    if (currentTab === 'airing') loadAiring();
    else if (currentTab === 'upcoming') loadUpcoming();
    else if (currentTab === 'schedule') loadSchedule();
    else if (currentTab === 'top') loadTop();
    else if (currentTab === 'favorites') loadFavoritesView();
}

async function loadSchedule() {
    document.getElementById('season-badge').textContent = 'This Week';
    document.getElementById('page-title').textContent = 'Airing Schedule';
    showLoading();

    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const from = Math.floor(monday.getTime() / 1000);
    const to = Math.floor(sunday.getTime() / 1000);

    const data = await gqlFetch(`
        query($from: Int, $to: Int) {
            Page(perPage: 100) {
                airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
                    airingAt
                    episode
                    media { ${MEDIA_FIELDS} }
                }
            }
        }`, { from, to });

    if (!data) return;

    const schedules = data.Page.airingSchedules;
    allAnime = schedules.map(s => s.media).filter((a, i, arr) =>
        arr.findIndex(x => x.id === a.id) === i
    );

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayName = now.toLocaleDateString('en-US', { weekday: 'long' });

    const grouped = {};
    dayNames.forEach(d => grouped[d] = []);
    schedules.forEach(s => {
        const d = new Date(s.airingAt * 1000);
        const idx = d.getDay();
        const name = idx === 0 ? 'Sunday' : dayNames[idx - 1];
        grouped[name].push(s);
    });

    const grid = document.getElementById('anime-grid');
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-msg').style.display = 'none';
    grid.style.display = 'block';
    document.getElementById('anime-count').textContent = `${schedules.length} episodes this week`;

    const activeDays = dayNames.filter(d => grouped[d].length > 0);

    grid.innerHTML = activeDays.map(day => {
        const isToday = day === todayName;
        const items = grouped[day].map(s => {
            const a = s.media;
            const title = a.title.english || a.title.romaji;
            const time = new Date(s.airingAt * 1000).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit'
            });
            const score = a.averageScore ? (a.averageScore / 10).toFixed(1) : 'N/A';
            const isFav = userFavorites.has(a.id);
            const color = scoreColor(a.averageScore);

            return `
            <div class="schedule-item" onclick="openModal(${a.id})">
                <img src="${a.coverImage.large}" alt="${title}" class="schedule-img" />
                <div class="schedule-info">
                    <span class="schedule-title">${title}</span>
                    <span class="schedule-meta">
                        <span class="schedule-ep">EP ${s.episode}</span>
                        ${time}
                    </span>
                </div>
                <div class="schedule-right">
                    <span class="schedule-score" style="color:${color}">★ ${score}</span>
                    <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${a.id}"
                        onclick="toggleFavorite(${a.id}, event)"
                        style="position:static;width:28px;height:28px;background:none">♥</button>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="schedule-day ${isToday ? 'schedule-today' : ''}">
            <div class="schedule-day-header">
                <span class="schedule-day-name">${day}</span>
                ${isToday ? '<span class="today-badge">Today</span>' : ''}
            </div>
            ${items}
        </div>`;
    }).join('');
}

function switchTab(el, tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('search-input').value = '';
    document.querySelector('.sort-bar').style.display = tab === 'schedule' ? 'none' : '';
    reload();
}

function setSort(el, sort) {
    currentSort = sort;
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    const query = document.getElementById('search-input').value;
    const results = query ? allAnime.filter(a => matchesSearch(a, query)) : allAnime;
    renderGrid(sorted(results));
}

function matchesSearch(a, query) {
    const q = query.toLowerCase();
    return (a.title.english || '').toLowerCase().includes(q) ||
           (a.title.romaji || '').toLowerCase().includes(q);
}

function handleSearch() {
    const query = document.getElementById('search-input').value.trim();
    const results = query ? allAnime.filter(a => matchesSearch(a, query)) : allAnime;
    renderGrid(sorted(results));
}

function renderGrid(anime) {
    const grid = document.getElementById('anime-grid');
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-msg').style.display = 'none';
    grid.style.display = 'grid';

    document.getElementById('anime-count').textContent = `${anime.length} titles`;

    if (anime.length === 0) {
        grid.innerHTML = '<p class="no-results">No anime found.</p>';
        return;
    }

    grid.innerHTML = anime.map(a => {
        const title = a.title.english || a.title.romaji;
        const score = a.averageScore ? (a.averageScore / 10).toFixed(1) : 'N/A';
        const color = scoreColor(a.averageScore);
        const episodes = a.episodes ? `${a.episodes} eps` : '? eps';
        const studio = a.studios.nodes[0]?.name || 'Unknown';
        const genres = a.genres.slice(0, 2).map(g =>
            `<span class="genre-tag">${g}</span>`
        ).join('');
        const image = a.coverImage.extraLarge || a.coverImage.large;
        const sc = statusClass(a.status);

        const airingBadge = a.nextAiringEpisode
            ? `<div class="card-airing">${formatAiring(a.nextAiringEpisode)}</div>`
            : '';

        const dateHtml = currentTab === 'upcoming'
            ? `<p class="card-date">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                ${formatReleaseDate(a.startDate)}
               </p>`
            : '';

        const isFav = userFavorites.has(a.id);

        return `
        <div class="anime-card" onclick="openModal(${a.id})">
            <div class="card-img-wrap">
                <img src="${image}" alt="${title}" class="card-img" loading="lazy" />
                <div class="card-score">
                    <span class="score-dot" style="background:${color}"></span>
                    ${score}
                </div>
                <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${a.id}"
                    onclick="toggleFavorite(${a.id}, event)"
                    title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">♥</button>
                <div class="card-status ${sc}">${mapStatus(a.status)}</div>
                ${airingBadge}
            </div>
            <div class="card-body">
                <h3 class="card-title">${title}</h3>
                <p class="card-studio">${studio}</p>
                ${dateHtml}
                <div class="card-meta">
                    <span class="card-eps">${episodes}</span>
                    <div class="card-genres">${genres}</div>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function fetchJikanEpisodes(malId) {
    if (!malId) return [];
    try {
        const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/episodes`);
        const json = await res.json();
        return json.data || [];
    } catch {
        return [];
    }
}

async function fetchEpisodeDates(animeId) {
    try {
        const res = await fetch(ANILIST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `query($id: Int) { Media(id: $id) { airingSchedules { episode airingAt } } }`,
                variables: { id: animeId }
            })
        });
        const json = await res.json();
        const schedules = json.data?.Media?.airingSchedules || [];
        const map = {};
        schedules.forEach(s => { map[s.episode] = s.airingAt; });
        return map;
    } catch {
        return {};
    }
}

function formatEpDate(dateInput) {
    if (!dateInput) return '';
    const d = typeof dateInput === 'number'
        ? new Date(dateInput * 1000)
        : new Date(dateInput);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function openModal(id) {
    const a = allAnime.find(x => x.id === id);
    if (!a) return;

    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('anime-modal').classList.add('active');
    document.getElementById('anime-modal').scrollTop = 0;

    const title = a.title.english || a.title.romaji;
    const score = a.averageScore ? (a.averageScore / 10).toFixed(1) : 'N/A';
    const studio = a.studios.nodes[0]?.name || 'Unknown';
    const genres = a.genres.map(g => `<span class="genre-tag">${g}</span>`).join('');
    const synopsis = a.description
        ? a.description.replace(/<[^>]+>/g, '').trim()
        : 'No description available.';
    const season = a.season
        ? a.season[0] + a.season.slice(1).toLowerCase() + ' ' + (a.seasonYear || '')
        : '?';

    currentModalAnime = a;

    const bannerImg = a.bannerImage || a.coverImage.extraLarge || a.coverImage.large;
    const trailerHtml = `<img src="${bannerImg}" alt="${title}" class="modal-trailer-fallback" />`;

    const streamingEps = a.streamingEpisodes || [];
    const hasDirectLinks = streamingEps.length > 0;

    const initialEpisodesHtml = hasDirectLinks
        ? '<div class="episode-loading"><div class="spinner" style="width:22px;height:22px;border-width:2px"></div></div>'
        : '<div class="episode-loading"><div class="spinner" style="width:22px;height:22px;border-width:2px"></div></div>';

    document.getElementById('modal-content').innerHTML = `
    <div class="modal-trailer">
        <button class="modal-close-btn" onclick="closeModal()">✕</button>
        ${trailerHtml}
    </div>
    <div class="modal-info">
        <h2 class="modal-title">${title}</h2>
        <p class="modal-title-jp">${a.title.romaji}</p>
        <div class="modal-stats">
            <div class="stat">
                <span class="stat-label">Rating</span>
                <span class="stat-val" style="color:${scoreColor(a.averageScore)}">★ ${score}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Format</span>
                <span class="stat-val">${mapFormat(a.format)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Episodes</span>
                <span class="stat-val">${a.episodes || '?'}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Status</span>
                <span class="stat-val">${mapStatus(a.status)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Studio</span>
                <span class="stat-val">${studio}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Season</span>
                <span class="stat-val">${season}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Aired</span>
                <span class="stat-val">${formatReleaseDate(a.startDate)}${a.endDate?.year ? ' – ' + formatReleaseDate(a.endDate) : a.status === 'FINISHED' ? '' : ' – now'}</span>
            </div>
        </div>
        ${(() => {
            const tags = (a.tags || [])
                .filter(t => !t.isGeneralSpoiler)
                .slice(0, 8);
            return tags.length
                ? `<div class="modal-tags">${tags.map(t => `<span class="tag-pill">${t.name}</span>`).join('')}</div>`
                : `<div class="modal-genres">${genres}</div>`;
        })()}
        <p class="modal-synopsis">${synopsis}</p>
        <a href="https://anilist.co/anime/${a.id}" target="_blank" class="mal-link">View on AniList →</a>

        <div class="episode-section">
            <div class="episode-header">
                <h3 class="episode-heading">Episodes</h3>
            </div>
            <div class="episode-list" id="episode-list-inner">${initialEpisodesHtml}</div>
        </div>
    </div>`;

    const [jikanEps, epDates] = await Promise.all([
        hasDirectLinks ? Promise.resolve([]) : fetchJikanEpisodes(a.idMal),
        fetchEpisodeDates(a.id)
    ]);

    const listEl = document.getElementById('episode-list-inner');
    if (!listEl) return;

    const searchBase = `https://www.crunchyroll.com/search?q=${encodeURIComponent(title)}`;

    if (hasDirectLinks) {
        const epNumRegex = /Episode (\d+)/i;
        listEl.innerHTML = streamingEps.map(ep => {
            const match = ep.title?.match(epNumRegex);
            const epNum = match ? parseInt(match[1]) : null;
            const date = epNum && epDates[epNum] ? formatEpDate(epDates[epNum]) : '';
            return `
            <a href="${ep.url}" target="_blank" class="episode-item">
                <span class="episode-site-badge">${ep.site}</span>
                <span class="episode-info">
                    <span class="episode-title">${ep.title}</span>
                    ${date ? `<span class="episode-date">${date}</span>` : ''}
                </span>
                <span class="episode-watch">Watch →</span>
            </a>`;
        }).join('');
    } else if (jikanEps.length > 0) {
        listEl.innerHTML = jikanEps.map(ep => {
            const date = ep.aired ? formatEpDate(ep.aired) : (epDates[ep.mal_id] ? formatEpDate(epDates[ep.mal_id]) : '');
            return `
            <a href="${searchBase}" target="_blank" class="episode-item">
                <span class="episode-num">EP ${ep.mal_id}</span>
                <span class="episode-info">
                    <span class="episode-title">${ep.title || 'Episode ' + ep.mal_id}</span>
                    ${date ? `<span class="episode-date">${date}</span>` : ''}
                </span>
                <span class="episode-watch">Search →</span>
            </a>`;
        }).join('');
    } else if (a.episodes) {
        listEl.innerHTML = Array.from({ length: a.episodes }, (_, i) => i + 1).map(n => {
            const date = epDates[n] ? formatEpDate(epDates[n]) : '';
            return `
            <a href="${searchBase}" target="_blank" class="episode-item">
                <span class="episode-num">EP ${n}</span>
                <span class="episode-info">
                    <span class="episode-title">Episode ${n}</span>
                    ${date ? `<span class="episode-date">${date}</span>` : ''}
                </span>
                <span class="episode-watch">Search →</span>
            </a>`;
        }).join('');
    } else {
        listEl.innerHTML = '<p class="no-episodes">No episodes available yet.</p>';
    }
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('anime-modal').classList.remove('active');
}

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('anime-grid').style.display = 'none';
    document.getElementById('error-msg').style.display = 'none';
}

function showError() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('anime-grid').style.display = 'none';
    document.getElementById('error-msg').style.display = 'flex';
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeAuthModal(); }
});

document.addEventListener('click', e => {
    if (!e.target.closest('#notif-wrapper')) {
        document.getElementById('notif-dropdown')?.classList.remove('active');
    }
});

window.addEventListener('message', e => {
    if (!e.origin.includes('youtube')) return;
    try {
        const data = JSON.parse(e.data);
        if (data.event === 'onError') {
            const iframe = document.querySelector('.trailer-iframe');
            if (!iframe || !currentModalAnime) return;
            const img = document.createElement('img');
            img.className = 'modal-trailer-fallback';
            img.src = currentModalAnime.bannerImage ||
                      currentModalAnime.coverImage.extraLarge ||
                      currentModalAnime.coverImage.large;
            img.alt = currentModalAnime.title?.english || '';
            iframe.replaceWith(img);
        }
    } catch {}
});

// ── AUTH ──────────────────────────────────────────────

function openAuthModal() {
    document.getElementById('auth-modal').classList.add('active');
    document.getElementById('auth-overlay').classList.add('active');
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.remove('active');
    document.getElementById('auth-overlay').classList.remove('active');
}

function switchAuthTab(tab) {
    document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok) {
        currentUser = { token: data.token, username: data.username };
        localStorage.setItem('anitrack_user', JSON.stringify(currentUser));
        closeAuthModal();
        updateAuthUI();
        await loadFavorites();
    } else {
        errorEl.textContent = data.error;
    }
}

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const errorEl = document.getElementById('register-error');
    errorEl.textContent = '';

    const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();

    if (res.ok) {
        currentUser = { token: data.token, username: data.username };
        localStorage.setItem('anitrack_user', JSON.stringify(currentUser));
        closeAuthModal();
        updateAuthUI();
        await loadFavorites();
    } else {
        errorEl.textContent = data.error;
    }
}

function logout() {
    currentUser = null;
    userFavorites.clear();
    localStorage.removeItem('anitrack_user');
    localStorage.removeItem('anitrack_seen_eps');
    updateAuthUI();
    if (currentTab === 'favorites') {
        const airingBtn = document.querySelector('[data-tab="airing"]');
        switchTab(airingBtn, 'airing');
    } else {
        updateFavButtons();
    }
}

function updateAuthUI() {
    const loggedIn = !!currentUser;
    document.getElementById('signin-btn').style.display = loggedIn ? 'none' : 'block';
    document.getElementById('nav-user').style.display = loggedIn ? 'flex' : 'none';
    document.getElementById('fav-tab').style.display = loggedIn ? 'flex' : 'none';
    document.getElementById('notif-wrapper').style.display = loggedIn ? 'flex' : 'none';
    if (loggedIn) {
        document.getElementById('nav-username').textContent = currentUser.username;
    }
}

function toggleNotifDropdown() {
    const dropdown = document.getElementById('notif-dropdown');
    dropdown.classList.toggle('active');
    if (dropdown.classList.contains('active')) renderNotifDropdown();
}

function closeNotifAndOpen(animeId) {
    document.getElementById('notif-dropdown').classList.remove('active');
    openModal(animeId);
}

function renderNotifDropdown() {
    const list = document.getElementById('notif-list');
    if (favoritesData.length === 0) {
        list.innerHTML = '<p class="notif-empty">Favorite an anime to get notifications.</p>';
        return;
    }

    const seen = JSON.parse(localStorage.getItem('anitrack_seen_eps') || '{}');

    const newItems = favoritesData.filter(a => {
        const airedEps = a.nextAiringEpisode ? a.nextAiringEpisode.episode - 1 : (a.episodes || 0);
        return airedEps > (seen[a.id] || 0);
    });

    if (newItems.length === 0) {
        list.innerHTML = '<p class="notif-empty">No new episodes right now.</p>';
        return;
    }

    list.innerHTML = newItems.map(a => {
        const title = a.title.english || a.title.romaji;
        const image = a.coverImage.large;
        const airedEps = a.nextAiringEpisode ? a.nextAiringEpisode.episode - 1 : (a.episodes || 0);
        const lastSeen = seen[a.id] || 0;
        const newEps = [];
        for (let i = lastSeen + 1; i <= airedEps; i++) newEps.push(i);
        const epText = newEps.length === 1
            ? `Episode ${newEps[0]} is now available`
            : `Episodes ${newEps.join(' & ')} are now available`;

        return `
        <div class="notif-item notif-new" onclick="closeNotifAndOpen(${a.id})" style="cursor:pointer">
            <img src="${image}" alt="${title}" class="notif-img" />
            <div class="notif-info">
                <span class="notif-title">${title}</span>
                <span class="notif-sub">${epText}</span>
            </div>
            <span class="notif-dot"></span>
        </div>`;
    }).join('');
}

// ── FAVORITES ─────────────────────────────────────────

async function loadFavorites() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API}/favorites`, {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        const favs = await res.json();
        userFavorites = new Set(favs.map(f => f.anime_id));
        updateFavButtons();

        if (favs.length > 0) {
            const ids = favs.map(f => f.anime_id);
            const data = await gqlFetch(`
                query($ids: [Int]) {
                    Page(perPage: 50) {
                        media(id_in: $ids, type: ANIME) {
                            id
                            title { english romaji }
                            coverImage { large }
                            status
                            nextAiringEpisode { episode airingAt }
                            episodes
                        }
                    }
                }`, { ids });
            if (data) favoritesData = data.Page.media;
        }

        checkNewEpisodes();
        renderNotifDropdown();
    } catch {}
}

async function toggleFavorite(animeId, e) {
    e.stopPropagation();
    if (!currentUser) { openAuthModal(); return; }

    const anime = allAnime.find(a => a.id === animeId);
    if (!anime) return;

    if (userFavorites.has(animeId)) {
        await fetch(`${API}/favorites/${animeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        userFavorites.delete(animeId);
    } else {
        await fetch(`${API}/favorites`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentUser.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                anime_id: animeId,
                anime_title: anime.title.english || anime.title.romaji,
                anime_image: anime.coverImage.extraLarge || anime.coverImage.large
            })
        });
        userFavorites.add(animeId);
    }
    updateFavButtons();
}

function updateFavButtons() {
    document.querySelectorAll('.fav-btn').forEach(btn => {
        const id = parseInt(btn.dataset.id);
        btn.classList.toggle('active', userFavorites.has(id));
        btn.title = userFavorites.has(id) ? 'Remove from favorites' : 'Add to favorites';
    });
}

function checkNewEpisodes() {
    if (!currentUser) return;
    const seen = JSON.parse(localStorage.getItem('anitrack_seen_eps') || '{}');
    let count = 0;

    favoritesData.forEach(a => {
        if (!a.nextAiringEpisode) return;
        const aired = a.nextAiringEpisode.episode - 1;
        if (aired > (seen[a.id] || 0)) count += aired - (seen[a.id] || 0);
    });

    const favBadge = document.getElementById('fav-badge');
    const notifBadge = document.getElementById('notif-badge');

    if (count > 0) {
        if (favBadge) { favBadge.textContent = count; favBadge.style.display = 'inline-flex'; }
        if (notifBadge) { notifBadge.textContent = count; notifBadge.style.display = 'flex'; }
    } else {
        if (favBadge) favBadge.style.display = 'none';
        if (notifBadge) notifBadge.style.display = 'none';
    }
}

function markEpisodesAsSeen() {
    const seen = JSON.parse(localStorage.getItem('anitrack_seen_eps') || '{}');
    favoritesData.forEach(a => {
        if (a.nextAiringEpisode) seen[a.id] = a.nextAiringEpisode.episode - 1;
    });
    localStorage.setItem('anitrack_seen_eps', JSON.stringify(seen));
    document.getElementById('fav-badge').style.display = 'none';
    document.getElementById('notif-badge').style.display = 'none';
    renderNotifDropdown();
}

async function loadFavoritesView() {
    if (!currentUser) return;
    document.getElementById('season-badge').textContent = currentUser.username;
    document.getElementById('page-title').textContent = 'My Favorites';
    showLoading();

    try {
        const res = await fetch(`${API}/favorites`, {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        const favs = await res.json();

        if (favs.length === 0) {
            document.getElementById('loading').style.display = 'none';
            const grid = document.getElementById('anime-grid');
            grid.style.display = 'grid';
            grid.innerHTML = '<p class="no-results">No favorites yet — heart an anime to add it here.</p>';
            document.getElementById('anime-count').textContent = '0 titles';
            return;
        }

        const ids = favs.map(f => f.anime_id);
        const data = await gqlFetch(`
            query($ids: [Int]) {
                Page(perPage: 50) {
                    media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} }
                }
            }`, { ids });

        if (!data) return;
        allAnime = data.Page.media;
        renderGrid(sorted(allAnime));
        markEpisodesAsSeen();
    } catch { showError(); }
}

// ── INIT ──────────────────────────────────────────────

function initAuth() {
    const stored = localStorage.getItem('anitrack_user');
    if (stored) {
        currentUser = JSON.parse(stored);
        updateAuthUI();
        loadFavorites();
    }
}

initAuth();
loadAiring();
