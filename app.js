let rawVaultData = [];
let currentActiveTab = "";
let currentActiveSection = "All";

async function bootRevisionEngine() {
    try {
        // Pull cache-busted database logs via relative pathways
        const response = await fetch(`./data.json?t=${Date.now()}`);
        rawVaultData = await response.json();
        
        const cardGrid = document.getElementById('card-grid');
        const blogView = document.getElementById('blog-view');
        const tabBar = document.getElementById('tab-bar');
        const sectionBar = document.getElementById('section-bar');

        // PRISTINE FALLBACK RENDER STRATEGY: Hides standard layout if no data exists
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

        // Gather unique categories from database objects safely
        const extractedTabs = [...new Set(rawVaultData.map(item => item.tab || item.category))].filter(Boolean);
        
        if (extractedTabs.length === 0) {
            tabBar.innerHTML = '';
            sectionBar.innerHTML = '';
            cardGrid.innerHTML = `<div class="empty-notice" style="grid-column:1/-1; width:100%;">[SYSTEM // STORAGE PRISTINE // NO LEDGER ENTRIES FOUND]</div>`;
            return;
        }

        // Fallback default state protection rule
        if (!currentActiveTab || !extractedTabs.includes(currentActiveTab)) {
            currentActiveTab = extractedTabs[0];
        }

        renderTabBar(extractedTabs);
        renderSectionBar();
        renderActiveDatabasePayload();

        // Bind interactive real-time typing query hooks
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
    
    // Filter down array listings based on current selected tab to harvest child keys
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
    currentActiveSection = "All"; // Reset sub anchor navigation values on primary change
    
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

    // Filter database array variables down to match tab, section, and typing parameters
    const workspacePool = rawVaultData.filter(item => {
        const matchesTab = (item.tab || item.category) === currentActiveTab;
        const matchesSection = currentActiveSection === 'All' || item.section === currentActiveSection;
        
        const cmdLower = (item.command || '').toLowerCase();
        const synLower = (item.syntax || '').toLowerCase();
        const notesLower = (item.notes || '').toLowerCase();
        const titleLower = (item.title || '').toLowerCase();
        const contentLower = (item.content || '').toLowerCase();
        
        const matchesSearch = cmdLower.includes(searchQuery) || 
                              synLower.includes(searchQuery) || 
                              notesLower.includes(searchQuery) ||
                              titleLower.includes(searchQuery) ||
                              contentLower.includes(searchQuery);

        return matchesTab && matchesSection && matchesSearch;
    });

    // Check if the current context profile consists of Card Matrices or Blogs
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
                <div class="continuous-markdown-body">${item.content || ''}</div>
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
}

// Initialise execution on content boot load loops
window.addEventListener('DOMContentLoaded', bootRevisionEngine);
