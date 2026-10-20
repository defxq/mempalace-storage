let rawVaultData = [];
let currentActiveTab = "";
let currentActiveSection = "All";

// SIDEBAR ACCESSIBILITY SCALING MANAGEMENT STATE
let currentFontSizePixels = 13;
const FONT_MIN_BOUNDS = 10;
const FONT_MAX_BOUNDS = 22;

// TEXT HIGHLIGHT TRACKER TARGET STATE METRICS
let capturedHighlightNodes = [];
let activeHighlightIndex = -1;

function toggleSidebarMenu(shouldOpen) {
    const drawer = document.getElementById('settings-drawer');
    if (shouldOpen) {
        drawer.classList.add('open-pane');
    } else {
        drawer.classList.remove('open-pane');
    }
}

// FIXED: Isolated font scaling routine to safely update elements without triggering infinite render loops
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

        if (!currentActiveTab || !extractedTabs.includes(currentActiveTab)) {
            currentActiveTab = extractedTabs[0];
        }

        renderTabBar(extractedTabs);
        renderSectionBar();
        renderActiveDatabasePayload();

        // Real-time keyword tracker input events listener hook
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
            ${sec.toUpperCase()}
        </span>
    `).join('');

    sectionBar.innerHTML = sectionButtonsHTML;
}

function switchCategoryTab(targetTab) {
    currentActiveTab = targetTab;
    currentActiveSection = "All"; 
    
    // Reset any ongoing highlighted matching loops on category jump
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

    // Filter database values purely based on category tab and section index selection rules
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

            if (item.flags && item.flags.length > 0 && item.flags.flag !== "Default") {
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

            if (item.notes) {
                cardHTML += `<div class="card-notes">↳ ${item.notes}</div>`;
            }

            cardHTML += `</div>`;
            return cardHTML;
        }).join('');
    }
    
    // Apply user selected text scale settings immediately to raw items
    modifyTextScale(0);
}

// TEXT PARSING HIGHLIGHTER NAVIGATOR MATRIX ENGINE
function executeLiveTextHighlighterScanner() {
    const query = document.getElementById('search').value.trim().toLowerCase();
    const navDeck = document.getElementById('search-nav');
    
    // Wipe out any existing active highlight markers before recalculating matching elements
    renderActiveDatabasePayload();

    if (!query) {
        navDeck.style.display = 'none';
        capturedHighlightNodes = [];
        activeHighlightIndex = -1;
        return;
    }

    // Isolate target containers based on active tab category profile
    const targetTextNodes = document.querySelectorAll('.cmd-name, .syntax-box, .flag-cell-name, .flag-cell-desc, .card-notes, .blog-post h2, .continuous-markdown-body');
    
    targetTextNodes.forEach(node => {
        const originalRawHTML = node.innerHTML;
        // Escape special regex token values to keep compiling bulletproof
        const safeQueryToken = query.replace(/[-\/\\^\$*+?.()|[\]{}]/g, '\\$&');
        const searchRegex = new RegExp(`(${safeQueryToken})`, 'gi');

        if (originalRawHTML.match(searchRegex)) {
            // Inject clean styled marker tokens directly across all matching word fragments
            node.innerHTML = originalRawHTML.replace(searchRegex, `<mark class="search-highlight">$1</mark>`);
        }
    });

    // Harvest full matching elements tree from active viewport DOM container
    capturedHighlightNodes = Array.from(document.querySelectorAll('mark.search-highlight'));
    const totalMatchesCount = capturedHighlightNodes.length;

    if (totalMatchesCount > 0) {
        activeHighlightIndex = 0;
        navDeck.style.display = 'flex';
        document.getElementById('nav-count').innerText = `1/${totalMatchesCount}`;
        highlightActiveSelectionTarget(true); // Jump-snap directly to the initial matching node
    } else {
        navDeck.style.display = 'none';
        capturedHighlightNodes = [];
        activeHighlightIndex = -1;
    }
}

function shiftHighlightTarget(indexDirectionDelta) {
    if (capturedHighlightNodes.length === 0) return;

    // Clear border indicators and focal highlight styling loops from old item
    highlightActiveSelectionTarget(false);

    // Compute circular index boundary looping mapping variables
    activeHighlightIndex += indexDirectionDelta;
    if (activeHighlightIndex >= capturedHighlightNodes.length) activeHighlightIndex = 0;
    if (activeHighlightIndex < 0) activeHighlightIndex = capturedHighlightNodes.length - 1;

    // Update index trackers display counter metrics text
    document.getElementById('nav-count').innerText = `${activeHighlightIndex + 1}/${capturedHighlightNodes.length}`;
    highlightActiveSelectionTarget(true);
}

function highlightActiveSelectionTarget(shouldApplyFocus) {
    const activeTargetNode = capturedHighlightNodes[activeHighlightIndex];
    if (!activeTargetNode) return;

    // Isolate the immediate container item row layout envelope frame box block
    const parentCardEnvelope = activeTargetNode.closest('.glass-card, .blog-post');

    if (shouldApplyFocus) {
        activeTargetNode.classList.add('current-focus-node');
        if (parentCardEnvelope) parentCardEnvelope.classList.add('highlight-focus-ring');

        // Smooth hardware-accelerated viewport alignment jump
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
