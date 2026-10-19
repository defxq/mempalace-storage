let rawVaultData = [];
let currentActiveTab = "Linux Core";
let currentActiveSection = "All";

async function bootRevisionEngine() {
    try {
        const response = await fetch('./data.json');
        rawVaultData = await response.json();
        
        const extractedTabs = [...new Set(rawVaultData.map(item => item.tab || item.category))].filter(Boolean);
        const fixedTabs = extractedTabs.length > 0 ? extractedTabs : ["Linux Core", "Networking", "Git Mechanics", "Git Deep Theory"];
        
        renderTabMenu(fixedTabs);
        buildSubSectionMenu();
        applyFilters();
    } catch (err) {
        document.getElementById('card-grid').innerHTML = `<p style="color:var(--neon-pink); padding:20px;">Failed to parse data.json repository vault elements.</p>`;
    }
}

function renderTabMenu(tabs) {
    const tabBar = document.getElementById('tab-bar');
    tabBar.innerHTML = '';
    tabs.forEach(tabName => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${tabName === currentActiveTab ? 'active' : ''}`;
        btn.textContent = tabName;
        btn.onclick = () => {
            currentActiveTab = tabName;
            currentActiveSection = "All"; 
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            buildSubSectionMenu();
            applyFilters();
        };
        tabBar.appendChild(btn);
    });
}

function buildSubSectionMenu() {
    const sectionBar = document.getElementById('section-bar');
    sectionBar.innerHTML = '';

    const activeTabItems = rawVaultData.filter(item => (item.tab || item.category) === currentActiveTab);
    const sections = [...new Set(activeTabItems.map(item => item.section || 'General'))];

    const allBtn = document.createElement('span');
    allBtn.className = `section-link ${currentActiveSection === 'All' ? 'active' : ''}`;
    allBtn.textContent = "[ SHOW ALL ]";
    allBtn.onclick = () => {
        currentActiveSection = "All";
        document.querySelectorAll('.section-link').forEach(l => l.classList.remove('active'));
        allBtn.classList.add('active');
        applyFilters();
    };
    sectionBar.appendChild(allBtn);

    sections.forEach(secName => {
        const link = document.createElement('span');
        link.className = `section-link ${currentActiveSection === secName ? 'active' : ''}`;
        link.textContent = `# ${secName}`;
        link.onclick = () => {
            currentActiveSection = secName;
            document.querySelectorAll('.section-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            applyFilters();

            // FIXED MOBILE SCROLL ANCHOR LOGIC ROUTINE:
            // Instead of firing global scrollIntoView which breaks mobile page frames,
            // we calculate the relative offset position strictly inside the scroll container.
            const isContinuousBlog = activeTabItems.some(item => item.layoutMode === 'concept') || currentActiveTab.includes('Theory');
            if (isContinuousBlog) {
                const scrollContainer = document.getElementById('main-scroll-container');
                const targetElement = document.getElementById(`anchor-${secName}`);
                
                if (scrollContainer && targetElement) {
                    // Compute distance of the element relative to the top of the container scroll viewport
                    const targetOffsetTop = targetElement.offsetTop - scrollContainer.offsetTop;
                    scrollContainer.scrollTo({
                        top: targetOffsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        };
        sectionBar.appendChild(link);
    });
}

function highlightPlaceholders(text) {
    if (!text) return "";
    return text.replace(/(\[[^\]]+\])/g, '<span class="placeholder">\$1</span>');
}

function applyFilters() {
    const searchString = document.getElementById('search').value.toLowerCase();
    const cardGrid = document.getElementById('card-grid');
    const blogView = document.getElementById('blog-view');

    const tabFilteredItems = rawVaultData.filter(item => (item.tab || item.category) === currentActiveTab);
    const modeIsBlog = tabFilteredItems.some(item => item.layoutMode === 'concept') || currentActiveTab.includes('Theory');

    if (modeIsBlog) {
        cardGrid.style.display = "none";
        blogView.style.display = "block";
        blogView.innerHTML = '';

        const filteredBlogStack = tabFilteredItems.filter(item => {
            const matchesSection = currentActiveSection === "All" || (item.section || 'General') === currentActiveSection;
            const matchesSearch = item.title?.toLowerCase().includes(searchString) || item.content?.toLowerCase().includes(searchString);
            return matchesSection && matchesSearch;
        });

        filteredBlogStack.forEach(item => {
            const article = document.createElement('article');
            article.className = 'blog-post';
            article.id = `anchor-${item.section || 'General'}`;
            
            let processedContent = item.content || "";
            if (!processedContent.includes('<p>') && !processedContent.includes('<br>')) {
                processedContent = processedContent
                    .split('\n\n')
                    .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
                    .join('');
            }

            article.innerHTML = `
                <h2>${item.title}</h2>
                <div>${processedContent}</div>
            `;
            blogView.appendChild(article);
        });
    } else {
        cardGrid.style.display = "grid";
        blogView.style.display = "none";
        cardGrid.innerHTML = '';

        const filteredCardStack = tabFilteredItems.filter(item => {
            const matchesSection = currentActiveSection === "All" || (item.section || 'General') === currentActiveSection;
            const matchesSearch = item.command?.toLowerCase().includes(searchString) || 
                                  item.syntax?.toLowerCase().includes(searchString) || 
                                  item.notes?.toLowerCase().includes(searchString) ||
                                  item.flags?.some(f => f.flag.toLowerCase().includes(searchString) || f.desc.toLowerCase().includes(searchString));
            return matchesSection && matchesSearch;
        });

        filteredCardStack.forEach(item => {
            const card = document.createElement('div');
            card.className = 'glass-card';
            
            let flagsHTML = '<table class="flag-table">';
            item.flags?.forEach(f => {
                flagsHTML += `
                    <tr class="flag-row">
                        <td class="flag-cell-name">${f.flag}</td>
                        <td class="flag-cell-desc">${highlightPlaceholders(f.desc)}</td>
                    </tr>
                `;
            });
            flagsHTML += '</table>';

            card.innerHTML = `
                <div class="cmd-name">${item.command}</div>
                <div class="syntax-box">${highlightPlaceholders(item.syntax)}</div>
                ${flagsHTML}
                <div class="card-notes">${item.notes}</div>
            `;
            cardGrid.appendChild(card);
        });
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== document.getElementById('search')) {
        e.preventDefault();
        document.getElementById('search').focus();
        document.getElementById('search').select();
    }
});

document.getElementById('search').addEventListener('input', applyFilters);
bootRevisionEngine();
