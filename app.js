let rawVaultData = [];
let currentActiveTab = "";
let currentActiveSection = "All";

// FIXED DEFAULT FONT SCALING VALUE: Changed from 13px to 17px as requested
let currentFontSizePixels = 17;
const FONT_MIN_BOUNDS = 10;
const FONT_MAX_BOUNDS = 22;

let capturedHighlightNodes = [];
let activeHighlightIndex = -1;

function toggleSidebarMenu(shouldOpen) {
    const drawer = document.getElementById('settings-drawer');
    if (shouldOpen) drawer.classList.add('open-pane');
    else drawer.classList.remove('open-pane');
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

// HELPER FUNCTION: Parses links live to extract YouTube video tokens or images
function renderMediaAttachment(url) {
    if (!url || url.trim() === '') return '';
    const cleanUrl = url.trim();

    // Check for YouTube standard or shortened URLs
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const ytMatch = cleanUrl.match(ytRegex);

    if (ytMatch && ytMatch[1]) {
        return `
            <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:4px; border:1px solid var(--border); margin:8px 0; background:var(--code-bg);">
                <iframe src="https://youtube.com{ytMatch[1]}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allowfullscreen></iframe>
            </div>
        `;
    }

    // Default Fallback: Assume it's a standard image link asset
    return `
        <div style="margin:8px 0; border-radius:4px; overflow:hidden; border:1px solid var(--border); background:var(--code-bg);">
            <img src="${cleanUrl}" alt="Attached Resource" style="width:100%; height:auto; display:block; object-fit:contain; max-height:300px;" onerror="this.parentElement.style.display='none';" />
        </div>
    `;
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
            tabBar.innerHTML = ''; sectionBar.innerHTML = '';
            cardGrid.innerHTML = `<div class="empty-notice" style="grid-column:1/-1; width:100%;">[SYSTEM // STORAGE PRISTINE // NO LEDGER ENTRIES FOUND]</div>`;
            return;
        }

        const extractedTabs = [...new Set(rawVaultData.map(item => item.tab || item.category))].filter(Boolean);
        if (extractedTabs.length === 0) {
            cardGrid.innerHTML = `<div class="empty-notice" style="grid-column:1/-1; width:100%;">[SYSTEM // STORAGE PRISTINE // NO LEDGER ENTRIES FOUND]</div>`;
            return;
        }

        if (!currentActiveTab || !extractedTabs.includes(currentActiveTab)) {
            currentActiveTab = extractedTabs[0];
        }

        renderTabBar(extractedTabs);
        renderSectionBar();
        renderActiveDatabasePayload();

        document.getElementById('search').addEventListener('input', executeLiveTextHighlighterScanner);

    } catch (err) {
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
    
    // FIXED: Stripped .toUpperCase() out entirely to keep subsection names exactly case-preserving as written in your database payload
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
                ${item.mediaUrl ? renderMediaAttachment(item.mediaUrl) : ''}
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

            // FIXED: Only render flag block if flags array exists and actually holds valid item mappings (hides dummy 'Default' cards layout strings)
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

            // FIXED: Only inject notes footer if a custom string message was explicitly typed out into the card entry
            if (item.notes && item.notes.trim() !== "") {
                cardHTML += `<div class="card-notes">↳ ${item.notes}</div>`;
            }

            // Append optional media blocks inside command layout grids if reference strings exist
            if (item.mediaUrl) {
                cardHTML += renderMediaAttachment(item.mediaUrl);
            }

            cardHTML += `</div>`;
            return cardHTML;
        }).join('');
    }
    
    // Apply default font settings parameter directly over the drawn DOM elements canvas template layout
    document.getElementById('scaler-indicator').innerText = `${currentFontSizePixels}px`;
    document.body.style.fontSize = `${currentFontSizePixels}px`;
    const elementsToScale = document.querySelectorAll('.syntax-box, .flag-table, .continuous-markdown-body, .blog-post p, .flag-cell-name, .flag-cell-desc, .card-notes');
    elementsToScale.forEach(block => {
        block.style.fontSize = `${currentFontSizePixels - 1}px`;
    });
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
