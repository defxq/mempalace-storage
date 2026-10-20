let rawVaultData = [];
let currentActiveTab = "";
let currentActiveSection = "All";

// SIDEBAR ACCESSIBILITY SCALING MANAGEMENT STATE
let currentFontSizePixels = 17;
const FONT_MIN_BOUNDS = 10;
const FONT_MAX_BOUNDS = 22;

// TEXT HIGHLIGHT TRACKER TARGET STATE METRICS
let capturedHighlightNodes = [];
let activeHighlightIndex = -1;

// FIXED MENU SLIDER DISPATCHER
function toggleSidebarMenu(shouldOpen) {
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('drawer-overlay');
    
    if (shouldOpen) {
        drawer.classList.add('open-pane');
        overlay.classList.add('open-pane');
    } else {
        drawer.classList.remove('open-pane');
        overlay.classList.remove('open-pane');
    }
}

// THEME SELECTION MATRIX ROUTINE
function switchActiveThemeSheet(themeId) {
    const bodyNode = document.body;
    const btnIndustrial = document.getElementById('theme-btn-industrial');
    const btnAmethyst = document.getElementById('theme-btn-amethyst');

    if (themeId === 'amethyst') {
        bodyNode.classList.add('theme-amethyst');
        btnAmethyst.classList.add('active-theme-token');
        btnIndustrial.classList.remove('active-theme-token');
        btnAmethyst.innerText = "● MIDNIGHT AMETHYST DEEP";
        btnIndustrial.innerText = "○ INDUSTRIAL GITHUB DARK";
    } else {
        bodyNode.classList.remove('theme-amethyst');
        btnIndustrial.classList.add('active-theme-token');
        btnAmethyst.classList.remove('active-theme-token');
        btnIndustrial.innerText = "● INDUSTRIAL GITHUB DARK";
        btnAmethyst.innerText = "○ MIDNIGHT AMETHYST DEEP";
    }
}

function modifyTextScale(pixelDelta) {
    const nextSize = currentFontSizePixels + pixelDelta;
    if (nextSize < FONT_MIN_BOUNDS || nextSize > FONT_MAX_BOUNDS) return;
    
    currentFontSizePixels = nextSize;
    
    document.getElementById('scaler-indicator').innerText = `${currentFontSizePixels}px`;
    document.body.style.fontSize = `${currentFontSizePixels}px`;
    
    const elementsToScale = document.querySelectorAll('.syntax-box, .flag-table, .continuous-markdown-body, .blog-post p, .flag-cell-name, .flag-cell-desc, .card-notes');
    elementsToScale.forEach(block => {
        block.style.fontSize = `${currentFontSizePixels - 1}px`;
    });
}

async function bootRevisionEngine() {
    try {
        const response = await fetch(`./data.json?t=${Date.now()}`);
        if (!response.ok) throw new Error("Database file missing.");
        rawVaultData = await response.json();
        
        const cardGrid = document.getElementById('card-grid');
        const blogView = document.getElementById('blog-view');
        const tabBar = document.getElementById('tab-bar');
        const sectionBar = document.getElementById('section-bar');

        if (!rawVaultData || rawVaultData.length === 0) {
            tabBar.innerHTML = '';
            sectionBar.innerHTML = '';
            cardGrid.innerHTML = `
                <div class="empty-notice" style="grid-column: 1 / -1; width: 100%;">
                    [SYSTEM // STORAGE PRISTINE // NO LEDGER ENTRIES FOUND]
                </div>
            `;
            blogView.innerHTML = `
                <div class="empty-notice">
                    [SYSTEM // STORAGE PRISTINE // NO LEDGER ENTRIES FOUND]
                </div>
            `;
            blogView.style.display = 'block';
            return;
        }

        const extractedTabs = [...new Set(rawVaultData.map(item => item.tab || item.category))].filter(Boolean);
        
        if (extractedTabs.length === 0) {
            tabBar.innerHTML = '';
            sectionBar.innerHTML = '';
            cardGrid.innerHTML = `<div class="empty-notice" style="grid-column:1/-1; width:100%;">[SYSTEM // STORAGE PRISTINE // NO LEDGER ENTRIES FOUND]</div>`;
            return;
        }

        // FIXED STRING TARGET RESOLUTION: Safe fallback selection checks string correctly
        if (!currentActiveTab || !extractedTabs.includes(currentActiveTab)) {
            currentActiveTab = String(extractedTabs[0]);
        }

        renderTabBar(extractedTabs);
        renderSectionBar();
        renderActiveDatabasePayload();

        document.getElementById('search').addEventListener('input', executeLiveTextHighlighterScanner);

    } catch (err) {
        console.error("Vault fetching exception: ", err.message);
        document.getElementById('card-grid').innerHTML = `<div class="empty-notice" style="grid-column:1/-1; width:100%;">[SYSTEM // STORAGE PRISTINE // NO LEDGER ENTRIES FOUND]</div>`;
    }
}
function renderTabBar(tabs) {
    const tabBar = document.getElementById('tab-bar');
    tabBar.innerHTML = tabs.map(tab => `
        <button type="button" class="tab-btn ${tab === currentActiveTab ? 'active' : ''}" onclick="switchCategoryTab('${tab.replace(/'/g, "\\'")}')">
            ${tab}
        </button>
    `).join('');
}

function renderSectionBar() {
    const sectionBar = document.getElementById('section-bar');
    const relatedItems = rawVaultData.filter(item => (item.tab || item.category) === currentActiveTab);
    const uniqueSections = [...new Set(relatedItems.map(item => item.section))].filter(Boolean);

    if (uniqueSections.length === 0) {
        sectionBar.innerHTML = '';
        return;
    }

    let sectionButtonsHTML = `<span class="section-link ${currentActiveSection === 'All' ? 'active' : ''}" onclick="switchSubSection('All')">ALL</span>`;
    sectionButtonsHTML += uniqueSections.map(sec => `
        <span class="section-link ${currentActiveSection === sec ? 'active' : ''}" onclick="switchSubSection('${sec.replace(/'/g, "\\'")}')">
            ${sec}
        </span>
    `).join('');

    sectionBar.innerHTML = sectionButtonsHTML;
}

function switchCategoryTab(targetTab) {
    currentActiveTab = targetTab;
    currentActiveSection = "All"; 
    
    document.getElementById('search').value = '';
    document.getElementById('search-nav').style.display = 'none';
    capturedHighlightNodes = [];
    activeHighlightIndex = -1;

    const extractedTabs = [...new Set(rawVaultData.map(item => item.tab || item.category))].filter(Boolean);
    renderTabBar(extractedTabs);
    renderSectionBar();
    renderActiveDatabasePayload();
}

function switchSubSection(targetSection) {
    currentActiveSection = targetSection;
    
    document.getElementById('search').value = '';
    document.getElementById('search-nav').style.display = 'none';
    capturedHighlightNodes = [];
    activeHighlightIndex = -1;

    renderSectionBar();
    renderActiveDatabasePayload();
}

function renderActiveDatabasePayload() {
    const cardGrid = document.getElementById('card-grid');
    const blogView = document.getElementById('blog-view');

    const workspacePool = rawVaultData.filter(item => {
        const matchesTab = (item.tab || item.category) === currentActiveTab;
        const matchesSection = currentActiveSection === 'All' || item.section === currentActiveSection;
        return matchesTab && matchesSection;
    });

    const representSample = rawVaultData.find(item => (item.tab || item.category) === currentActiveTab);
    const isBlogTrack = representSample && (representSample.layoutMode === 'concept' || representSample.title);

    if (isBlogTrack) {
        cardGrid.style.display = 'none';
        blogView.style.display = 'block';

        if (workspacePool.length === 0) {
            blogView.innerHTML = `<p style="color:var(--text-main); font-style:italic; padding:12px;">No documentation steps found.</p>`;
            return;
        }

        blogView.innerHTML = workspacePool.map(item => `
            <div class="blog-post">
                <h2>${item.title || 'Untitled Segment Log'}</h2>
                <p class="continuous-markdown-body">${item.content || ''}</p>
            </div>
        `).join('');

    } else {
        blogView.style.display = 'none';
        cardGrid.style.display = 'grid';

        if (workspacePool.length === 0) {
            cardGrid.innerHTML = `<p style="grid-column: 1 / -1; color:var(--text-main); font-style:italic; padding:12px;">No CLI parameter matrices match parameters.</p>`;
            return;
        }

        cardGrid.innerHTML = workspacePool.map(item => {
            let cardHTML = `
                <div class="glass-card">
                    <div class="cmd-name">${item.command || 'Generic'}</div>
                    <div class="syntax-box">${item.syntax || ''}</div>
            `;

            if (item.flags && item.flags.length > 0 && item.flags[0].flag !== "Default") {
                cardHTML += `<table class="flag-table">`;
                item.flags.forEach(f => {
                    cardHTML += `
                        <tr class="flag-row">
                            <td class="flag-cell-name">${f.flag}</td>
                            <td class="flag-cell-desc">${f.desc}</td>
                        </tr>`;
                });
                cardHTML += `</table>`;
            }

            if (item.notes && item.notes.trim() !== "") {
                cardHTML += `<div class="card-notes">↳ ${item.notes}</div>`;
            }

            cardHTML += `</div>`;
            return cardHTML;
        }).join('');
    }
    
    modifyTextScale(0);
}

function executeLiveTextHighlighterScanner() {
    const query = document.getElementById('search').value.trim().toLowerCase();
    const navDeck = document.getElementById('search-nav');
    
    renderActiveDatabasePayload();

    if (!query) {
        navDeck.style.display = 'none';
        capturedHighlightNodes = [];
        activeHighlightIndex = -1;
        return;
    }

    const targetTextNodes = document.querySelectorAll('.cmd-name, .syntax-box, .flag-cell-name, .flag-cell-desc, .card-notes, .blog-post h2, .continuous-markdown-body');
    
    targetTextNodes.forEach(node => {
        const originalRawHTML = node.innerHTML;
        const safeQueryToken = query.replace(/[-\/\\^\$*+?.()|[\]{}]/g, '\\$&');
        const searchRegex = new RegExp(`(${safeQueryToken})`, 'gi');

        if (originalRawHTML.match(searchRegex)) {
            node.innerHTML = originalRawHTML.replace(searchRegex, `<mark class="search-highlight">$1</mark>`);
        }
    });

    capturedHighlightNodes = Array.from(document.querySelectorAll('mark.search-highlight'));
    const totalMatchesCount = capturedHighlightNodes.length;

    if (totalMatchesCount > 0) {
        activeHighlightIndex = 0;
        navDeck.style.display = 'flex';
        document.getElementById('nav-count').innerText = `1/${totalMatchesCount}`;
        highlightActiveSelectionTarget(true);
    } else {
        navDeck.style.display = 'none';
        capturedHighlightNodes = [];
        activeHighlightIndex = -1;
    }
}

function shiftHighlightTarget(indexDirectionDelta) {
    if (capturedHighlightNodes.length === 0) return;
    highlightActiveSelectionTarget(false);

    activeHighlightIndex += indexDirectionDelta;
    if (activeHighlightIndex >= capturedHighlightNodes.length) activeHighlightIndex = 0;
    if (activeHighlightIndex < 0) activeHighlightIndex = capturedHighlightNodes.length - 1;

    document.getElementById('nav-count').innerText = `${activeHighlightIndex + 1}/${capturedHighlightNodes.length}`;
    highlightActiveSelectionTarget(true);
}

function highlightActiveSelectionTarget(shouldApplyFocus) {
    const activeTargetNode = capturedHighlightNodes[activeHighlightIndex];
    if (!activeTargetNode) return;

    const parentCardEnvelope = activeTargetNode.closest('.glass-card, .blog-post');

    if (shouldApplyFocus) {
        activeTargetNode.classList.add('current-focus-node');
        if (parentCardEnvelope) parentCardEnvelope.classList.add('highlight-focus-ring');

        activeTargetNode.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    } else {
        activeTargetNode.classList.remove('current-focus-node');
        if (parentCardEnvelope) parentCardEnvelope.classList.remove('highlight-focus-ring');
    }
}

window.addEventListener('DOMContentLoaded', bootRevisionEngine);
