let rawVaultData = [];
let currentActiveTab = "";
let currentActiveSection = "All";

// SIDEBAR ACCESSIBILITY SCALING MANAGEMENT STATE
let currentFontSizePixels = 13;
const FONT_MIN_BOUNDS = 10;
const FONT_MAX_BOUNDS = 22;

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

// FIXED FONT CONTROLLER: Prevents infinite page rendering loops
function modifyTextScale(pixelDelta) {
    const nextSize = currentFontSizePixels + pixelDelta;
    
    if (nextSize < FONT_MIN_BOUNDS || nextSize > FONT_MAX_BOUNDS) return;
    
    currentFontSizePixels = nextSize;
    
    document.getElementById('scaler-indicator').innerText = `${currentFontSizePixels}px`;
    document.body.style.fontSize = `${currentFontSizePixels}px`;
    
    const codeBlocks = document.querySelectorAll('.syntax-box, .flag-table, .continuous-markdown-body');
    codeBlocks.forEach(block => {
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

        // FIXED KEY SOLVER: Gracefully checks for 'tab' first, falling back onto 'category' automatically
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

        document.getElementById('search').addEventListener('input', renderActiveDatabasePayload);

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
    
    const extractedTabs = [...new Set(rawVaultData.map(item => item.tab || item.category))].filter(Boolean);
    renderTabBar(extractedTabs);
    renderSectionBar();
    renderActiveDatabasePayload();
}

function switchSubSection(targetSection) {
    currentActiveSection = targetSection;
    renderSectionBar();
    renderActiveDatabasePayload();
}

function renderActiveDatabasePayload() {
    const cardGrid = document.getElementById('card-grid');
    const blogView = document.getElementById('blog-view');
    const searchQuery = document.getElementById('search').value.toLowerCase();

    const workspacePool = rawVaultData.filter(item => {
        const matchesTab = (item.tab || item.category) === currentActiveTab;
        const matchesSection = currentActiveSection === 'All' || item.section === currentActiveSection;
        
        const cmdLower = (item.command || '').toLowerCase();
        const synLower = (item.syntax || '').toLowerCase();
        const notesLower = (item.notes || '').toLowerCase();
        const titleLower = (item.title || '').toLowerCase();
        const contentLower = (item.content || '').toLowerCase();
        
        return matchesTab && matchesSection && (
            cmdLower.includes(searchQuery) || 
            synLower.includes(searchQuery) || 
            notesLower.includes(searchQuery) ||
            titleLower.includes(searchQuery) ||
            contentLower.includes(searchQuery)
        );
    });

    const representSample = rawVaultData.find(item => (item.tab || item.category) === currentActiveTab);
    const isBlogTrack = representSample && (representSample.layoutMode === 'concept' || representSample.title);

    if (isBlogTrack) {
        cardGrid.style.display = 'none';
        blogView.style.display = 'block';

        if (workspacePool.length === 0) {
            blogView.innerHTML = `<p style="color:var(--text-main); font-style:italic; padding:12px;">No documentation steps found matching parameters.</p>`;
            return;
        }

        blogView.innerHTML = workspacePool.map(item => `
            <div class="blog-post">
                <h2>${item.title || 'Untitled Segment Log'}</h2>
                <p>${item.content || ''}</p>
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

            if (item.notes) {
                cardHTML += `<div class="card-notes">↳ ${item.notes}</div>`;
            }

            cardHTML += `</div>`;
            return cardHTML;
        }).join('');
    }
    
    const codeBlocks = document.querySelectorAll('.syntax-box, .flag-table, .continuous-markdown-body');
    codeBlocks.forEach(block => {
        block.style.fontSize = `${currentFontSizePixels - 1}px`;
    });
}

window.addEventListener('DOMContentLoaded', bootRevisionEngine);
