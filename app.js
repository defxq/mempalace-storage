let rawVaultData = [];
let currentActiveTab = "";
let currentActiveSection = "All";

let currentFontSizePixels = 16;
const FONT_MIN_BOUNDS = 11;
const FONT_MAX_BOUNDS = 22;

let capturedHighlightNodes = [];
let activeHighlightIndex = -1;

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

function switchActiveThemeSheet(themeId) {
    const bodyNode = document.body;
    const btnIndustrial = document.getElementById('theme-btn-industrial');
    const btnAmethyst = document.getElementById('theme-btn-amethyst');

    if (themeId === 'amethyst') {
        bodyNode.classList.add('theme-amethyst');
        btnAmethyst.classList.add('active-theme-token');
        btnIndustrial.classList.remove('active-theme-token');
        btnAmethyst.innerText = "● MIDNIGHT AMETHYST AXIS";
        btnIndustrial.innerText = "○ INDUSTRIAL CYAN TERMINAL";
    } else {
        bodyNode.classList.remove('theme-amethyst');
        btnIndustrial.classList.add('active-theme-token');
        btnAmethyst.classList.remove('active-theme-token');
        btnIndustrial.innerText = "● INDUSTRIAL CYAN TERMINAL";
        btnAmethyst.innerText = "○ MIDNIGHT AMETHYST AXIS";
    }
    executeLiveTextHighlighterScanner(); 
}

function modifyTextScale(pixelDelta) {
    const nextSize = currentFontSizePixels + pixelDelta;
    if (nextSize < FONT_MIN_BOUNDS || nextSize > FONT_MAX_BOUNDS) return;
    
    currentFontSizePixels = nextSize;
    document.getElementById('scaler-indicator').innerText = `${currentFontSizePixels}px`;
    
    const elementsToScale = document.querySelectorAll('.card-title-header, .card-content-body, .vault-inline-code, .code-block-wrapper code');
    elementsToScale.forEach(block => {
        block.style.fontSize = `${currentFontSizePixels}px`;
    });
}

async function bootRevisionEngine() {
    try {
        const response = await fetch(`./data.json?t=${Date.now()}`);
        if (!response.ok) throw new Error("File missing.");
        rawVaultData = await response.json();
        
        const cardGrid = document.getElementById('card-grid');
        const tabBar = document.getElementById('tab-bar');
        const sectionBar = document.getElementById('section-bar');

        if (!rawVaultData || rawVaultData.length === 0) {
            tabBar.innerHTML = ''; sectionBar.innerHTML = '';
            cardGrid.innerHTML = `<div class="empty-notice" style="width:100%;">Data is empty...</div>`;
            return;
        }

        const extractedTabs = [...new Set(rawVaultData.map(item => item.tab).filter(Boolean))];
        if (extractedTabs.length === 0) {
            cardGrid.innerHTML = `<div class="empty-notice" style="width:100%;">Data is empty...</div>`;
            return;
        }

        if (!currentActiveTab || !extractedTabs.includes(currentActiveTab)) {
            currentActiveTab = String(extractedTabs[0]);
        }

        renderTabBar(extractedTabs);
        renderSectionBar();
        renderActiveDatabasePayload();

        document.getElementById('search').addEventListener('input', executeLiveTextHighlighterScanner);
        
        document.addEventListener('keydown', (e) => {
            const searchInput = document.getElementById('search');
            if (e.key === '/' && document.activeElement !== searchInput) {
                e.preventDefault();
                e.stopImmediatePropagation();
                searchInput.focus();
                searchInput.select();
            }
        }, true);

    } catch (err) {
        document.getElementById('card-grid').innerHTML = `<div class="empty-notice" style="width:100%;">Data is empty...</div>`;
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
    const relatedItems = rawVaultData.filter(item => item.tab === currentActiveTab);
    const uniqueSections = [...new Set(relatedItems.map(item => item.section).filter(Boolean))];

    if (uniqueSections.length === 0) {
        sectionBar.innerHTML = ''; return;
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
    currentActiveTab = targetTab; currentActiveSection = "All";
    resetSearchIndices();
    const extractedTabs = [...new Set(rawVaultData.map(item => item.tab).filter(Boolean))];
    renderTabBar(extractedTabs); renderSectionBar(); renderActiveDatabasePayload();
}

function switchSubSection(targetSection) {
    currentActiveSection = targetSection;
    resetSearchIndices();
    renderSectionBar(); renderActiveDatabasePayload();
}

function resetSearchIndices() {
    document.getElementById('search').value = '';
    document.getElementById('search-nav').style.display = 'none';
    capturedHighlightNodes = []; activeHighlightIndex = -1;
}

function renderActiveDatabasePayload() {
    const cardGrid = document.getElementById('card-grid');
    const workspacePool = rawVaultData.filter(item => {
        return item.tab === currentActiveTab && (currentActiveSection === 'All' || item.section === currentActiveSection);
    });

    if (workspacePool.length === 0) {
        cardGrid.innerHTML = `<div class="empty-notice" style="width:100%;">Data is empty...</div>`;
        return;
    }

    cardGrid.innerHTML = workspacePool.map(item => `
        <div class="glass-card" id="card-${item.id}">
            <div class="card-meta-row">
                <span class="card-section-tag">// ${item.section || 'GENERAL'}</span>
                <span>NODE_${item.id.substring(0, 6)}</span>
            </div>
            <div class="card-title-header">${item.title || 'Untitled Segment Header'}</div>
            <div class="card-content-body">${item.content || ''}</div>
        </div>
    `).join('');
    
    modifyTextScale(0);
}

// FIXED: Advanced highlighter that uses node child loops to skip background HTML code blocks entirely
function executeLiveTextHighlighterScanner() {
    const query = document.getElementById('search').value.trim().toLowerCase();
    const navDeck = document.getElementById('search-nav');
    
    renderActiveDatabasePayload();

    if (!query) {
        navDeck.style.display = 'none';
        capturedHighlightNodes = []; activeHighlightIndex = -1;
        return;
    }

    const targetContainers = document.querySelectorAll('.card-title-header, .card-content-body, .card-section-tag');
    const safeQueryToken = query.replace(/[-\/\\^\$*+?.()|[\]{}]/g, '\\$&');
    const searchRegex = new RegExp(`(${safeQueryToken})`, 'gi');

    targetContainers.forEach(container => {
        // Recursive text-only parser skips hidden attributes and macros entirely
        const walkAndHighlightNode = (element) => {
            let childNodesArray = Array.from(element.childNodes);
            
            childNodesArray.forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    const textValue = child.nodeValue;
                    if (textValue.match(searchRegex)) {
                        const tempSpanWrapper = document.createElement('span');
                        tempSpanWrapper.innerHTML = textValue.replace(searchRegex, `<mark class="search-highlight">$1</mark>`);
                        
                        // Replace pristine content text node safely with highlighted layout spans
                        while (tempSpanWrapper.firstChild) {
                            element.insertBefore(tempSpanWrapper.firstChild, child);
                        }
                        element.removeChild(child);
                    }
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    // Safe Guard: Do not search attributes inside code blocks or internal macros
                    if (!child.classList.contains('search-highlight')) {
                        walkAndHighlightNode(child);
                    }
                }
            });
        };
        walkAndHighlightNode(container);
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
        capturedHighlightNodes = []; activeHighlightIndex = -1;
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

// FIXED CRITICAL CONTAINER SCROLLING: Uses offset calculations for clean alignment
function highlightActiveSelectionTarget(shouldApplyFocus) {
    const activeTargetNode = capturedHighlightNodes[activeHighlightIndex];
    if (!activeTargetNode) return;

    const parentCardEnvelope = activeTargetNode.closest('.glass-card');
    const scrollContainer = document.getElementById('main-scroll-container');

    if (shouldApplyFocus) {
        activeTargetNode.classList.add('current-focus-node');
        if (parentCardEnvelope) parentCardEnvelope.classList.add('highlight-focus-ring');

        // FIXED CHASSIS JUMP SCROLL MATH:
        // Anchors positioning based on offset distances within the scroll frame container bounds
        setTimeout(() => {
            if (parentCardEnvelope && scrollContainer) {
                // Calculate position offsets relative to the main scroll container
                const targetCardTopOffset = parentCardEnvelope.offsetTop;
                const centerAdjustmentOffset = (scrollContainer.clientHeight / 2) - (parentCardEnvelope.clientHeight / 2);
                
                const finalCalculatedScrollPosition = targetCardTopOffset - centerAdjustmentOffset;
                
                scrollContainer.scrollTo({
                    top: finalCalculatedScrollPosition,
                    behavior: 'auto' // Instant snapping
                });
            }
        }, 15);
    } else {
        activeTargetNode.classList.remove('current-focus-node');
        if (parentCardEnvelope) parentCardEnvelope.classList.remove('highlight-focus-ring');
    }
}

window.addEventListener('DOMContentLoaded', bootRevisionEngine);
